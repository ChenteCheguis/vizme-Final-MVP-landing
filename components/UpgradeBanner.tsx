import React, { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import UpgradeModal from './UpgradeModal';

const UpgradeBanner: React.FC = () => {
  const [dismissed, setDismissed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  if (dismissed) return null;

  return (
    <>
      <div className="rounded-2xl border border-vizme-orange/20 bg-gradient-to-r from-vizme-navy to-[#0a3548] p-5 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-vizme-orange/10 blur-2xl" />
        <div className="absolute -left-5 -bottom-5 h-24 w-24 rounded-full bg-vizme-red/10 blur-2xl" />

        <button
          onClick={() => setDismissed(true)}
          className="absolute top-3 right-3 h-6 w-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          <X size={12} className="text-white" />
        </button>

        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-xl bg-vizme-orange/20 border border-vizme-orange/30 flex items-center justify-center flex-shrink-0">
            <Sparkles size={18} className="text-vizme-orange" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white mb-1">
              Tu dashboard tiene insights adicionales bloqueados
            </p>
            <p className="text-xs text-white/60 mb-3 leading-relaxed">
              Mejora a Pro para ver correlaciones avanzadas, análisis interno y externo, y predicciones de tu negocio.
            </p>
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-vizme-orange px-4 py-2 text-xs font-bold text-white hover:bg-vizme-red transition-colors shadow-lg shadow-vizme-orange/30"
            >
              <Sparkles size={12} />
              Mejorar a Pro →
            </button>
          </div>
        </div>
      </div>

      <UpgradeModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
};

export default UpgradeBanner;
