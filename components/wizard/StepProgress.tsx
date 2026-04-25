import { Check } from 'lucide-react';

interface Props {
  current: 1 | 2 | 3 | 4;
}

const labels = ['Bienvenida', 'Tu negocio', 'Sube tu data', 'Review'];

export default function StepProgress({ current }: Props) {
  return (
    <div className="relative w-full">
      <div className="flex items-center justify-between gap-2">
        {labels.map((label, idx) => {
          const stepNum = (idx + 1) as 1 | 2 | 3 | 4;
          const state =
            stepNum < current ? 'done' : stepNum === current ? 'active' : 'pending';
          return (
            <div key={label} className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                {/* left line */}
                {idx > 0 && (
                  <div
                    className={[
                      'h-px flex-1 transition-colors duration-500',
                      stepNum <= current ? 'bg-vizme-navy' : 'bg-vizme-greyblue/25',
                    ].join(' ')}
                  />
                )}
                {/* circle */}
                <div
                  className={[
                    'relative grid h-9 w-9 shrink-0 place-items-center rounded-full font-mono text-xs font-medium transition-all duration-300',
                    state === 'active' &&
                      'bg-vizme-coral text-white shadow-glow-coral ring-4 ring-vizme-coral/12',
                    state === 'done' && 'bg-vizme-navy text-white',
                    state === 'pending' && 'bg-white text-vizme-greyblue/70 ring-1 ring-vizme-greyblue/25',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {state === 'done' ? <Check size={15} strokeWidth={2.5} /> : stepNum}
                  {state === 'active' && (
                    <span className="absolute inset-0 rounded-full ring-2 ring-vizme-coral/20 animate-pulse-soft" />
                  )}
                </div>
                {/* right line */}
                {idx < labels.length - 1 && (
                  <div
                    className={[
                      'h-px flex-1 transition-colors duration-500',
                      stepNum < current ? 'bg-vizme-navy' : 'bg-vizme-greyblue/25',
                    ].join(' ')}
                  />
                )}
              </div>
              <span
                className={[
                  'mt-3 text-[11px] uppercase tracking-[0.16em] transition-colors duration-300',
                  state === 'active' && 'text-vizme-coral',
                  state === 'done' && 'text-vizme-navy',
                  state === 'pending' && 'text-vizme-greyblue/60',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
