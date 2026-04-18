import React from 'react';
import { Lock } from 'lucide-react';

interface LockedSectionProps {
  feature: string;
  description: string;
  children: React.ReactNode;
  onUpgrade: () => void;
}

const LockedSection: React.FC<LockedSectionProps> = ({
  feature,
  description,
  children,
  onUpgrade,
}) => {
  return (
    <div className="relative">
      {/* Blurred content underneath */}
      <div
        className="pointer-events-none select-none"
        style={{ filter: 'blur(6px)', opacity: 0.7 }}
        aria-hidden="true"
      >
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-[2px] rounded-2xl z-10 p-8 text-center">
        <div className="h-14 w-14 rounded-2xl bg-vizme-navy/5 border border-vizme-navy/10 flex items-center justify-center mb-4">
          <Lock size={22} className="text-vizme-navy" />
        </div>
        <h3 className="text-base font-bold text-vizme-navy mb-1">{feature}</h3>
        <p className="text-sm text-vizme-greyblue max-w-xs mb-6 leading-relaxed">{description}</p>
        <button
          onClick={onUpgrade}
          className="inline-flex items-center gap-2 rounded-xl bg-vizme-red px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-vizme-red/25 hover:bg-vizme-orange transition-all hover:-translate-y-0.5"
        >
          Desbloquear con Pro
        </button>
      </div>
    </div>
  );
};

export default LockedSection;
