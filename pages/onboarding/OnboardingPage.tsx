import { useEffect, useReducer, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  initialOnboardingState,
  onboardingReducer,
  type OnboardingState,
  type AnalysisStage,
  humanMessageForStage,
} from '../../lib/onboardingState';
import StepProgress from '../../components/wizard/StepProgress';
import Step1Welcome from '../../components/wizard/Step1Welcome';
import Step2Context from '../../components/wizard/Step2Context';
import Step3Upload from '../../components/wizard/Step3Upload';
import Step4Review from '../../components/wizard/Step4Review';
import type { BusinessSchema } from '../../lib/v5types';

const CHUNKING_THRESHOLD_TOKENS = 25_000;

export default function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(onboardingReducer, initialOnboardingState);
  const stageTimers = useRef<number[]>([]);

  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? 'tú';

  // Cleanup any pending stage simulation timers on unmount or stage change
  useEffect(() => {
    return () => {
      stageTimers.current.forEach((id) => window.clearTimeout(id));
      stageTimers.current = [];
    };
  }, []);

  const goToStep = (step: 1 | 2 | 3 | 4) => dispatch({ type: 'GO_TO_STEP', step });

  const startAnalysis = async () => {
    if (!state.fileDigest || !state.file || !user) return;

    // Decide expected route from token estimate (matches orchestrator threshold)
    const estTokens = estimateDigestTokens(state.fileDigest);
    const expectedRoute: 'simple' | 'chunked' =
      estTokens > CHUNKING_THRESHOLD_TOKENS ? 'chunked' : 'simple';
    dispatch({ type: 'START_ANALYSIS', expectedRoute });

    try {
      // 1) Project
      const { data: project, error: projErr } = await supabase
        .from('projects')
        .insert({
          user_id: user.id,
          name: state.projectName.trim(),
          description: state.businessHint.trim(),
          question: state.question.trim() || null,
        })
        .select('id')
        .single();
      if (projErr || !project) throw new Error(`No pudimos crear el proyecto. ${projErr?.message ?? ''}`);

      // 2) Storage upload
      const storagePath = `${user.id}/${Date.now()}_${sanitize(state.file.name)}`;
      const buf = await state.file.arrayBuffer();
      const { error: upErr } = await supabase.storage
        .from('user-files')
        .upload(storagePath, buf, {
          contentType: state.file.type || 'application/octet-stream',
          upsert: false,
        });
      if (upErr) throw new Error(`No pudimos subir tu archivo. ${upErr.message}`);

      // 3) Files row
      const { data: fileRow, error: fileErr } = await supabase
        .from('files')
        .insert({
          project_id: project.id,
          file_name: state.file.name,
          file_size_bytes: state.file.size,
          mime_type: state.file.type || null,
          storage_path: storagePath,
        })
        .select('id')
        .single();
      if (fileErr || !fileRow) throw new Error(`No pudimos registrar el archivo. ${fileErr?.message ?? ''}`);

      dispatch({ type: 'SET_PROJECT_AND_FILE_IDS', projectId: project.id, fileId: fileRow.id });

      // 4) Simulate progressive stage transitions while Edge Function runs
      stageTimers.current = scheduleStageSimulation(expectedRoute, dispatch);

      // 5) Invoke edge function
      const startedAt = performance.now();
      const { data, error: fnErr } = await supabase.functions.invoke('analyze-data', {
        body: {
          mode: 'build_schema',
          project_id: project.id,
          file_id: fileRow.id,
          digest: state.fileDigest,
          business_hint: state.businessHint,
          question: state.question || undefined,
        },
      });
      stageTimers.current.forEach((id) => window.clearTimeout(id));
      stageTimers.current = [];

      if (fnErr) {
        throw new Error(translateEdgeError(fnErr.message ?? '', performance.now() - startedAt));
      }
      if (!data || !data.schema_id) {
        throw new Error('La respuesta del análisis no incluye schema_id. Reintenta en un momento.');
      }

      // 6) Fetch full schema for the summary card (Edge response only includes summary)
      const { data: schemaRow, error: schemaErr } = await supabase
        .from('business_schemas')
        .select('*')
        .eq('id', data.schema_id)
        .single();
      if (schemaErr || !schemaRow) throw new Error('No pudimos leer el schema generado.');

      const schema = schemaRow as unknown as BusinessSchema;
      dispatch({
        type: 'ANALYSIS_SUCCESS',
        schemaId: data.schema_id,
        summary: data.summary,
        schema,
      });
    } catch (err) {
      stageTimers.current.forEach((id) => window.clearTimeout(id));
      stageTimers.current = [];
      dispatch({ type: 'ANALYSIS_ERROR', message: (err as Error).message });
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-12 px-2 lg:px-6">
      {/* Top progress */}
      <div className="pt-2">
        <StepProgress current={state.currentStep} />
      </div>

      {/* Step content */}
      <div className="min-h-[480px]">
        {state.currentStep === 1 && (
          <Step1Welcome userName={fullName} onContinue={() => goToStep(2)} />
        )}
        {state.currentStep === 2 && (
          <Step2Context
            projectName={state.projectName}
            businessHint={state.businessHint}
            question={state.question}
            onChangeProjectName={(v) => dispatch({ type: 'SET_PROJECT_NAME', value: v })}
            onChangeBusinessHint={(v) => dispatch({ type: 'SET_BUSINESS_HINT', value: v })}
            onChangeQuestion={(v) => dispatch({ type: 'SET_QUESTION', value: v })}
            onBack={() => goToStep(1)}
            onContinue={() => goToStep(3)}
          />
        )}
        {state.currentStep === 3 && (
          <Step3Upload
            file={state.file}
            digest={state.fileDigest}
            parsing={state.digestParsing}
            parseError={state.digestError}
            onSelectFile={(f) => dispatch({ type: 'START_PARSING_FILE', file: f })}
            onParseSuccess={(d) => dispatch({ type: 'PARSE_SUCCESS', digest: d })}
            onParseError={(m) => dispatch({ type: 'PARSE_ERROR', message: m })}
            onClear={() => dispatch({ type: 'CLEAR_FILE' })}
            onBack={() => goToStep(2)}
            onAnalyze={startAnalysis}
            isUploading={
              state.analysisProgress.stage !== 'idle' &&
              state.analysisProgress.stage !== 'completed' &&
              state.analysisProgress.stage !== 'failed'
            }
          />
        )}
        {state.currentStep === 4 && (
          <Step4Review
            state={state}
            onSeeDashboard={() => state.projectId && navigate(`/projects/${state.projectId}`)}
            onCorrect={() => {
              // Sprint 3 placeholder — visual link, modal not yet implemented.
              alert('La edición manual del schema llega en el siguiente sprint.');
            }}
            onRetry={() => {
              dispatch({ type: 'GO_TO_STEP', step: 3 });
            }}
          />
        )}
      </div>
    </div>
  );
}

function estimateDigestTokens(digest: object): number {
  try {
    return Math.ceil(JSON.stringify(digest).length / 4);
  } catch {
    return 0;
  }
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * The orchestrator runs sequentially server-side and only sends one response.
 * To give the user honest progress feedback, we schedule stage transitions
 * locally based on the expected route. Timings are conservative; if the real
 * pipeline finishes faster, ANALYSIS_SUCCESS overrides whatever stage we
 * showed; if it takes longer, the user keeps seeing the last stage with the
 * elapsed timer until success arrives.
 */
function scheduleStageSimulation(
  route: 'simple' | 'chunked',
  dispatch: React.Dispatch<{ type: 'UPDATE_STAGE'; stage: AnalysisStage; humanMessage: string; step: number; totalSteps: number }>
): number[] {
  const timers: number[] = [];
  const schedule = (delay: number, stage: AnalysisStage, step: number, totalSteps: number) => {
    timers.push(
      window.setTimeout(() => {
        dispatch({ type: 'UPDATE_STAGE', stage, humanMessage: humanMessageForStage(stage), step, totalSteps });
      }, delay)
    );
  };

  if (route === 'chunked') {
    schedule(2_000, 'classifying', 1, 3);
    schedule(22_000, 'extracting_entities', 2, 3);
    schedule(48_000, 'building_rules', 3, 3);
  } else {
    schedule(2_000, 'analyzing', 1, 1);
  }
  return timers;
}

function translateEdgeError(message: string, elapsedMs: number): string {
  if (/429|rate[_ ]?limit/i.test(message)) {
    return 'Hay mucha demanda en este momento. Reintenta en 30 segundos.';
  }
  if (elapsedMs > 180_000) {
    return 'El análisis está tardando más de lo normal. Reintenta — si sigue así, escríbenos.';
  }
  if (/network|fetch|abort/i.test(message)) {
    return 'Perdimos conexión durante el análisis. Reintenta en un momento.';
  }
  return `Algo falló de nuestro lado. (${message})`;
}

// Re-export for the wizard helpers
export type { OnboardingState };
