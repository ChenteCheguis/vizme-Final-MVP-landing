import { useEffect, useState } from 'react';
import { Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import type { OnboardingState } from '../../lib/onboardingState';
import SummaryCard from './SummaryCard';

interface Props {
  state: OnboardingState;
  onSeeDashboard: () => void;
  onCorrect: () => void;
  onRetry: () => void;
}

export default function Step4Review({ state, onSeeDashboard, onCorrect, onRetry }: Props) {
  const { analysisProgress, schema, analysisSummary, analysisError } = state;
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (analysisProgress.stage === 'completed' || analysisProgress.stage === 'failed') return;
    const startedAt = analysisProgress.startedAt ?? Date.now();
    const interval = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [analysisProgress.stage, analysisProgress.startedAt]);

  // Failure
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

  // Success — schema available
  if (analysisProgress.stage === 'completed' && schema && analysisSummary) {
    return (
      <div className="mx-auto max-w-3xl animate-scale-in">
        <SummaryCard
          summary={analysisSummary}
          schema={schema}
          onPrimary={onSeeDashboard}
          onSecondary={onCorrect}
        />
      </div>
    );
  }

  // Analyzing
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
          {/* Orbital rings */}
          <div className="absolute inset-[-12px] rounded-full border border-vizme-coral/20 animate-pulse-soft" />
          <div className="absolute inset-[-24px] rounded-full border border-vizme-coral/10 animate-pulse-soft" style={{ animationDelay: '300ms' }} />
        </div>

        {/* Stage message */}
        <div className="space-y-3">
          <p className="label-eyebrow">{analysisProgress.totalSteps > 1 ? 'Pipeline en curso' : 'Análisis en curso'}</p>
          <h2 className="font-display text-4xl font-light leading-tight tracking-editorial text-vizme-navy">
            {analysisProgress.humanMessage || 'Analizando tu archivo…'}
          </h2>
          <p className="mx-auto max-w-md text-vizme-greyblue text-pretty">
            {subtitleForStage(analysisProgress.stage)}
          </p>
        </div>

        {/* Linear progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-vizme-greyblue">
            <span>
              {analysisProgress.totalSteps > 1
                ? `Paso ${Math.max(analysisProgress.step, 1)} de ${analysisProgress.totalSteps}`
                : 'Procesando'}
            </span>
            <span className="font-mono">{seconds}s</span>
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

function subtitleForStage(stage: OnboardingState['analysisProgress']['stage']): string {
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
