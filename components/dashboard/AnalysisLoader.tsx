import React, { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { DataProfile } from '../../lib/inferDataProfile';

interface Props {
  isComplete?: boolean;
  dataProfile?: DataProfile | null;
  projectName?: string;
  mainQuestion?: string;
}

const AnalysisLoader: React.FC<Props> = ({ isComplete = false, dataProfile, projectName, mainQuestion }) => {
  const [currentStep, setCurrentStep] = useState(0);

  // Build dynamic steps based on context
  const steps = [
    dataProfile
      ? `Analizando ${dataProfile.totalRows.toLocaleString('es-MX')} registros...`
      : 'Analizando estructura de datos...',
    dataProfile?.dataType
      ? `Tipo de datos detectado: ${dataProfile.dataType}`
      : 'Inferiendo tipo de negocio...',
    mainQuestion
      ? `Buscando respuesta a: "${mainQuestion.slice(0, 60)}${mainQuestion.length > 60 ? '…' : ''}"`
      : 'Evaluando qué visualizaciones aportan más valor...',
    projectName
      ? `Construyendo dashboard para "${projectName}"...`
      : 'Construyendo tu dashboard personalizado...',
    'Dashboard listo',
  ] as const;

  useEffect(() => {
    if (isComplete) { setCurrentStep(steps.length - 1); return; }
    const delays = [800, 1800, 3200, 5000];
    const timers = delays.map((delay, idx) =>
      setTimeout(() => setCurrentStep((s) => Math.max(s, idx + 1)), delay),
    );
    return () => timers.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete]);

  return (
    <div className="bg-white rounded-2xl border border-vizme-navy/5 p-8 shadow-sm">
      <div className="max-w-sm mx-auto space-y-4">
        {/* Brain animation */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="h-16 w-16 rounded-2xl bg-vizme-navy flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.5 2a2.5 2.5 0 0 1 5 0v.5" />
                <path d="M14.5 2.5c1.8.8 3 2.5 3 4.5v.5" />
                <path d="M9.5 2.5c-1.8.8-3 2.5-3 4.5v.5" />
                <path d="M6.5 7.5C4.5 8.3 3 10.3 3 12.5c0 2.5 2 4.5 4.5 4.5" />
                <path d="M17.5 7.5c2 .8 3.5 2.8 3.5 5c0 2.5-2 4.5-4.5 4.5" />
                <path d="M8 17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2" />
                <line x1="12" y1="7" x2="12" y2="17" />
                <line x1="8.5" y1="10" x2="15.5" y2="10" />
                <line x1="9" y1="13.5" x2="15" y2="13.5" />
              </svg>
            </div>
            {!isComplete && (
              <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full border-2 border-white bg-vizme-red animate-pulse" />
            )}
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {steps.map((step, idx) => {
            const isDone = idx < currentStep || (isComplete && idx === steps.length - 1);
            const isActive = idx === currentStep && !isComplete;
            const isPending = idx > currentStep && !isComplete;
            return (
              <div key={idx} className={`flex items-center gap-3 transition-all duration-500 ${isPending ? 'opacity-30' : 'opacity-100'}`}>
                <div className="flex-shrink-0 h-5 w-5 flex items-center justify-center">
                  {isDone ? (
                    <CheckCircle2 size={16} className="text-emerald-500" />
                  ) : isActive ? (
                    <div className="h-4 w-4 rounded-full border-2 border-vizme-red border-t-transparent animate-spin" />
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-vizme-navy/20" />
                  )}
                </div>
                <span className={`text-sm transition-colors ${
                  isDone ? 'text-emerald-600 font-medium' :
                  isActive ? 'text-vizme-navy font-medium' :
                  'text-vizme-greyblue'
                }`}>
                  {step}
                </span>
              </div>
            );
          })}
        </div>

        {!isComplete && (
          <p className="text-center text-[11px] text-vizme-greyblue/60 mt-6">
            Claude está analizando tus datos...
          </p>
        )}
      </div>
    </div>
  );
};

export default AnalysisLoader;
