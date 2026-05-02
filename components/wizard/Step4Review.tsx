import { useEffect, useState } from 'react';
import { Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import type { OnboardingState } from '../../lib/onboardingState';
import type {
  SetupStage,
  FullSetupResult,
} from '../../lib/hooks/useFullDashboardSetup';
import SummaryCard from './SummaryCard';

type ReviewState =
  | 'showing_summary'
  | 'building_dashboard'
  | 'redirecting'
  | 'error';

interface Props {
  state: OnboardingState;
  onBuildDashboard: (
    onProgress: (stage: SetupStage) => void
  ) => Promise<FullSetupResult>;
  onCorrect: () => void;
  onRetry: () => void;
  onComplete: (result: FullSetupResult) => void;
  onSkipToDashboard: () => void;
}

const STAGE_TITLES: Record<Exclude<SetupStage, 'done' | 'error'>, string> = {
  ingesting: 'Procesando tu archivo histórico',
  calculating: 'Calculando tus métricas reales',
  designing: 'Diseñando tu dashboard personalizado',
  writing_insights: 'Escribiendo insights para ti',
};

const STAGE_SUBTITLES: Record<
  Exclude<SetupStage, 'done' | 'error'>,
  string
> = {
  ingesting:
    'Aplicando las reglas que encontramos para extraer cada dato.',
  calculating:
    'Calculando totales, promedios y tendencias de tu negocio.',
  designing:
    'Decidiendo qué gráficas y secciones tienen más sentido para ti.',
  writing_insights:
    'Convirtiendo tus números en historias accionables.',
};

const STAGE_ORDER: SetupStage[] = [
  'ingesting',
  'calculating',
  'designing',
  'writing_insights',
];

const STAGE_ERROR_TITLE: Record<
  Exclude<SetupStage, 'done' | 'error'>,
  string
> = {
  ingesting: 'No pudimos procesar tu archivo',
  calculating: 'Hubo un problema calculando tus métricas',
  designing: 'El diseño de tu dashboard tuvo un error',
  writing_insights: 'No pudimos generar todos los insights',
};

export default function Step4Review({
  state,
  onBuildDashboard,
  onCorrect,
  onRetry,
  onComplete,
  onSkipToDashboard,
}: Props) {
  const { analysisProgress, schema, analysisSummary, analysisError } = state;
  const [reviewState, setReviewState] = useState<ReviewState>('showing_summary');
  const [setupStage, setSetupStage] = useState<SetupStage>('ingesting');
  const [setupError, setSetupError] = useState<string | null>(null);
  const [failedStep, setFailedStep] = useState<SetupStage | null>(null);
  const [secondsAnalysis, setSecondsAnalysis] = useState(0);
  const [secondsBuild, setSecondsBuild] = useState(0);

  // Timer for the schema generation (still running)
  useEffect(() => {
    if (
      analysisProgress.stage === 'completed' ||
      analysisProgress.stage === 'failed'
    )
      return;
    const startedAt = analysisProgress.startedAt ?? Date.now();
    const interval = setInterval(() => {
      setSecondsAnalysis(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [analysisProgress.stage, analysisProgress.startedAt]);

  // Timer for the dashboard build phase
  useEffect(() => {
    if (reviewState !== 'building_dashboard') {
      setSecondsBuild(0);
      return;
    }
    const startedAt = Date.now();
    const interval = setInterval(() => {
      setSecondsBuild(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [reviewState]);

  const handleBuild = async () => {
    setReviewState('building_dashboard');
    setSetupError(null);
    setFailedStep(null);
    setSetupStage('ingesting');

    const result = await onBuildDashboard((stage) => setSetupStage(stage));

    if (result.success) {
      setReviewState('redirecting');
      onComplete(result);
      return;
    }

    setSetupError(result.error ?? 'Error desconocido durante el setup.');
    setFailedStep(result.failedStep ?? 'ingesting');
    setReviewState('error');
  };

  const handleRetryBuild = () => {
    setReviewState('showing_summary');
    setSetupError(null);
    setFailedStep(null);
  };

  // ── Schema generation failed (Sprint 3 path) ─────────
  if (analysisProgress.stage === 'failed') {
    return (
      <div className="grid place-items-center py-16 animate-fade-in">
        <div className="max-w-md space-y-6 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-vizme-coral/10 text-vizme-coral">
            <AlertCircle size={28} />
          </div>
          <div>
            <h2 className="font-display text-3xl font-light tracking-editorial text-vizme-navy">
              No pudimos terminar el análisis
            </h2>
            <p className="mt-3 text-vizme-greyblue">
              {analysisError ??
                'Algo falló de nuestro lado. Reintenta en un momento — si sigue fallando, escríbenos.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-full bg-vizme-coral px-6 py-3 font-medium text-white shadow-glow-coral hover:-translate-y-0.5 transition"
          >
            <RefreshCw size={16} />
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // ── Dashboard build failed ───────────────────────────
  if (reviewState === 'error' && failedStep) {
    const canSkip = failedStep === 'writing_insights';
    const errorTitle =
      failedStep in STAGE_ERROR_TITLE
        ? STAGE_ERROR_TITLE[failedStep as keyof typeof STAGE_ERROR_TITLE]
        : 'Algo falló';
    return (
      <div className="grid place-items-center py-16 animate-fade-in">
        <div className="max-w-md space-y-6 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-vizme-coral/10 text-vizme-coral">
            <AlertCircle size={28} />
          </div>
          <div>
            <h2 className="font-display text-3xl font-light tracking-editorial text-vizme-navy">
              {errorTitle}
            </h2>
            <p className="mt-3 text-vizme-greyblue text-pretty">
              {setupError ??
                'Algo falló de nuestro lado. Reintenta en un momento.'}
            </p>
          </div>
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={handleRetryBuild}
              className="inline-flex items-center gap-2 rounded-full bg-vizme-coral px-6 py-3 font-medium text-white shadow-glow-coral hover:-translate-y-0.5 transition"
            >
              <RefreshCw size={16} />
              Reintentar
            </button>
            {canSkip && (
              <button
                type="button"
                onClick={onSkipToDashboard}
                className="text-sm font-medium text-vizme-greyblue underline decoration-vizme-coral/40 underline-offset-4 hover:text-vizme-navy"
              >
                Saltar y ver mi dashboard sin insights
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Building dashboard (4 stages) ────────────────────
  if (reviewState === 'building_dashboard' || reviewState === 'redirecting') {
    const stage = reviewState === 'redirecting' ? 'writing_insights' : setupStage;
    const stageIndex = STAGE_ORDER.indexOf(stage);
    const safeIndex = stageIndex === -1 ? 3 : stageIndex;
    const title =
      stage === 'done'
        ? 'Tu dashboard está listo'
        : STAGE_TITLES[stage as Exclude<SetupStage, 'done' | 'error'>] ??
          'Construyendo tu dashboard';
    const subtitle =
      stage === 'done'
        ? 'Llevándote a tu dashboard…'
        : STAGE_SUBTITLES[stage as Exclude<SetupStage, 'done' | 'error'>] ?? '';

    return (
      <div className="grid place-items-center py-12">
        <div className="relative max-w-xl space-y-10 text-center">
          {/* Animated orb */}
          <div className="relative mx-auto h-32 w-32">
            <div className="absolute inset-0 rounded-full bg-vizme-coral/15 blur-3xl animate-breathe" />
            <div className="absolute inset-2 rounded-full bg-gradient-to-br from-vizme-coral via-vizme-orange to-vizme-navy opacity-90 animate-breathe" />
            <div className="absolute inset-0 grid place-items-center">
              <Sparkles size={28} className="text-white drop-shadow-lg" />
            </div>
            <div className="absolute inset-[-12px] rounded-full border border-vizme-coral/20 animate-pulse-soft" />
            <div
              className="absolute inset-[-24px] rounded-full border border-vizme-coral/10 animate-pulse-soft"
              style={{ animationDelay: '300ms' }}
            />
          </div>

          {/* Stage message */}
          <div className="space-y-3">
            <p className="label-eyebrow">Construyendo tu dashboard</p>
            <h2 className="font-display text-4xl font-light leading-tight tracking-editorial text-vizme-navy">
              {title}
            </h2>
            <p className="mx-auto max-w-md text-vizme-greyblue text-pretty">
              {subtitle}
            </p>
          </div>

          {/* 4-step indicator */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-vizme-greyblue">
              <span>Paso {Math.min(safeIndex + 1, 4)} de 4</span>
              <span className="font-mono">{secondsBuild}s</span>
            </div>
            <div className="flex items-center gap-2">
              {STAGE_ORDER.map((s, i) => {
                const done = i < safeIndex || stage === 'done';
                const active = i === safeIndex && stage !== 'done';
                return (
                  <div
                    key={s}
                    className={[
                      'h-1.5 flex-1 rounded-full transition-all duration-500',
                      done
                        ? 'bg-vizme-coral'
                        : active
                          ? 'bg-gradient-to-r from-vizme-coral via-vizme-orange to-vizme-coral bg-[length:200%_100%] animate-shimmer'
                          : 'bg-vizme-navy/8',
                    ].join(' ')}
                  />
                );
              })}
            </div>
          </div>

          <p className="text-xs text-vizme-greyblue/70">
            Puedes dejar esta ventana abierta. Esto típicamente toma entre 60 y 180 segundos.
          </p>
        </div>
      </div>
    );
  }

  // ── Showing summary (after schema is ready) ──────────
  if (
    reviewState === 'showing_summary' &&
    analysisProgress.stage === 'completed' &&
    schema &&
    analysisSummary
  ) {
    return (
      <div className="mx-auto max-w-3xl animate-scale-in">
        <SummaryCard
          summary={analysisSummary}
          schema={schema}
          primaryCtaLabel="Construir mi dashboard"
          onPrimary={handleBuild}
          onSecondary={onCorrect}
        />
      </div>
    );
  }

  // ── Schema still being analyzed (Sprint 3 path) ──────
  return (
    <div className="grid place-items-center py-12">
      <div className="relative max-w-xl space-y-10 text-center">
        <div className="relative mx-auto h-32 w-32">
          <div className="absolute inset-0 rounded-full bg-vizme-coral/15 blur-3xl animate-breathe" />
          <div className="absolute inset-2 rounded-full bg-gradient-to-br from-vizme-coral via-vizme-orange to-vizme-navy opacity-90 animate-breathe" />
          <div className="absolute inset-0 grid place-items-center">
            <Sparkles size={28} className="text-white drop-shadow-lg" />
          </div>
          <div className="absolute inset-[-12px] rounded-full border border-vizme-coral/20 animate-pulse-soft" />
          <div
            className="absolute inset-[-24px] rounded-full border border-vizme-coral/10 animate-pulse-soft"
            style={{ animationDelay: '300ms' }}
          />
        </div>

        <div className="space-y-3">
          <p className="label-eyebrow">
            {analysisProgress.totalSteps > 1
              ? 'Pipeline en curso'
              : 'Análisis en curso'}
          </p>
          <h2 className="font-display text-4xl font-light leading-tight tracking-editorial text-vizme-navy">
            {analysisProgress.humanMessage || 'Analizando tu archivo…'}
          </h2>
          <p className="mx-auto max-w-md text-vizme-greyblue text-pretty">
            {subtitleForStage(analysisProgress.stage)}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-vizme-greyblue">
            <span>
              {analysisProgress.totalSteps > 1
                ? `Paso ${Math.max(analysisProgress.step, 1)} de ${analysisProgress.totalSteps}`
                : 'Procesando'}
            </span>
            <span className="font-mono">{secondsAnalysis}s</span>
          </div>
          <div className="relative h-1.5 overflow-hidden rounded-full bg-vizme-navy/8">
            <div
              className="h-full rounded-full bg-gradient-to-r from-vizme-coral via-vizme-orange to-vizme-coral bg-[length:200%_100%] animate-shimmer transition-all duration-700"
              style={{
                width: `${Math.max(8, (analysisProgress.step / Math.max(1, analysisProgress.totalSteps)) * 100)}%`,
              }}
            />
          </div>
        </div>

        <p className="text-xs text-vizme-greyblue/70">
          Puedes dejar esta ventana abierta — usualmente toma entre 30 y 90 segundos.
        </p>
      </div>
    </div>
  );
}

function subtitleForStage(
  stage: OnboardingState['analysisProgress']['stage']
): string {
  switch (stage) {
    case 'uploading':
      return 'Cifrando y subiendo tu archivo a tu storage privado.';
    case 'classifying':
      return 'Identificando en qué industria operas y qué es importante para tu modelo de negocio.';
    case 'extracting_entities':
      return 'Detectando las métricas que mejor explican tu desempeño.';
    case 'building_rules':
      return 'Creando las reglas para que cada vez que subas datos nuevos tu dashboard se actualice solo.';
    case 'analyzing':
      return 'Tu archivo es lo bastante chico para procesarlo en una sola pasada.';
    default:
      return '';
  }
}

export type { ReviewState };
