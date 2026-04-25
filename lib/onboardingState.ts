import type { FileDigest } from './fileDigest';
import type { BusinessSchema } from './v5types';

export type WizardStep = 1 | 2 | 3 | 4;

export type AnalysisStage =
  | 'idle'
  | 'uploading'
  | 'classifying'
  | 'extracting_entities'
  | 'building_rules'
  | 'analyzing'
  | 'completed'
  | 'failed';

export interface AnalysisProgress {
  stage: AnalysisStage;
  humanMessage: string;
  step: number;
  totalSteps: number;
  startedAt: number | null;
}

export interface AnalysisSummary {
  industry: string;
  sub_industry: string | null;
  metrics_count: number;
  entities_count: number;
  dimensions_count: number;
  extraction_rules_count: number;
  external_sources_count: number;
  needs_clarification: string[] | null;
}

export interface OnboardingState {
  currentStep: WizardStep;
  projectName: string;
  businessHint: string;
  question: string;
  file: File | null;
  fileDigest: FileDigest | null;
  digestError: string | null;
  digestParsing: boolean;
  projectId: string | null;
  fileId: string | null;
  schemaId: string | null;
  schema: BusinessSchema | null;
  analysisSummary: AnalysisSummary | null;
  analysisProgress: AnalysisProgress;
  analysisError: string | null;
  expectedRoute: 'simple' | 'chunked' | null;
}

export const initialOnboardingState: OnboardingState = {
  currentStep: 1,
  projectName: '',
  businessHint: '',
  question: '',
  file: null,
  fileDigest: null,
  digestError: null,
  digestParsing: false,
  projectId: null,
  fileId: null,
  schemaId: null,
  schema: null,
  analysisSummary: null,
  analysisProgress: {
    stage: 'idle',
    humanMessage: '',
    step: 0,
    totalSteps: 1,
    startedAt: null,
  },
  analysisError: null,
  expectedRoute: null,
};

export type OnboardingAction =
  | { type: 'GO_TO_STEP'; step: WizardStep }
  | { type: 'SET_PROJECT_NAME'; value: string }
  | { type: 'SET_BUSINESS_HINT'; value: string }
  | { type: 'SET_QUESTION'; value: string }
  | { type: 'START_PARSING_FILE'; file: File }
  | { type: 'PARSE_SUCCESS'; digest: FileDigest }
  | { type: 'PARSE_ERROR'; message: string }
  | { type: 'CLEAR_FILE' }
  | { type: 'START_ANALYSIS'; expectedRoute: 'simple' | 'chunked' }
  | { type: 'SET_PROJECT_AND_FILE_IDS'; projectId: string; fileId: string }
  | { type: 'UPDATE_STAGE'; stage: AnalysisStage; humanMessage: string; step: number; totalSteps: number }
  | { type: 'ANALYSIS_SUCCESS'; schemaId: string; summary: AnalysisSummary; schema: BusinessSchema }
  | { type: 'ANALYSIS_ERROR'; message: string };

export function onboardingReducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case 'GO_TO_STEP':
      return { ...state, currentStep: action.step };
    case 'SET_PROJECT_NAME':
      return { ...state, projectName: action.value };
    case 'SET_BUSINESS_HINT':
      return { ...state, businessHint: action.value };
    case 'SET_QUESTION':
      return { ...state, question: action.value };
    case 'START_PARSING_FILE':
      return { ...state, file: action.file, fileDigest: null, digestError: null, digestParsing: true };
    case 'PARSE_SUCCESS':
      return { ...state, fileDigest: action.digest, digestParsing: false, digestError: null };
    case 'PARSE_ERROR':
      return { ...state, digestParsing: false, digestError: action.message, fileDigest: null };
    case 'CLEAR_FILE':
      return { ...state, file: null, fileDigest: null, digestError: null, digestParsing: false };
    case 'START_ANALYSIS':
      return {
        ...state,
        currentStep: 4,
        expectedRoute: action.expectedRoute,
        analysisError: null,
        schema: null,
        schemaId: null,
        analysisSummary: null,
        analysisProgress: {
          stage: 'uploading',
          humanMessage: 'Subiendo tu archivo de forma segura…',
          step: 0,
          totalSteps: action.expectedRoute === 'chunked' ? 3 : 1,
          startedAt: Date.now(),
        },
      };
    case 'SET_PROJECT_AND_FILE_IDS':
      return { ...state, projectId: action.projectId, fileId: action.fileId };
    case 'UPDATE_STAGE':
      return {
        ...state,
        analysisProgress: {
          ...state.analysisProgress,
          stage: action.stage,
          humanMessage: action.humanMessage,
          step: action.step,
          totalSteps: action.totalSteps,
        },
      };
    case 'ANALYSIS_SUCCESS':
      return {
        ...state,
        schemaId: action.schemaId,
        schema: action.schema,
        analysisSummary: action.summary,
        analysisProgress: {
          ...state.analysisProgress,
          stage: 'completed',
          humanMessage: 'Listo. Esto es lo que entendimos de tu negocio.',
          step: state.analysisProgress.totalSteps,
        },
      };
    case 'ANALYSIS_ERROR':
      return {
        ...state,
        analysisError: action.message,
        analysisProgress: { ...state.analysisProgress, stage: 'failed' },
      };
    default:
      return state;
  }
}

export function humanMessageForStage(stage: AnalysisStage): string {
  switch (stage) {
    case 'uploading':
      return 'Subiendo tu archivo de forma segura…';
    case 'classifying':
      return 'Entendiendo qué tipo de negocio tienes…';
    case 'extracting_entities':
      return 'Descubriendo tus métricas clave…';
    case 'building_rules':
      return 'Generando reglas para que tu dashboard se actualice solo…';
    case 'analyzing':
      return 'Analizando tu archivo…';
    case 'completed':
      return 'Listo. Esto es lo que entendimos de tu negocio.';
    case 'failed':
      return 'Algo falló de nuestro lado.';
    default:
      return '';
  }
}
