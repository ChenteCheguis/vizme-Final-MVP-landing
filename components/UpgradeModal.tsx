import React from 'react';
import { X, Check, Zap, Lock } from 'lucide-react';

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  featureName?: string;
}

const PRO_FEATURES = [
  'Archivos ilimitados (hasta 50MB)',
  'Dashboard Pro — 6-8 charts + correlaciones',
  'Reporte Ejecutivo completo',
  'Análisis Interno — KPIs, segmentación, anomalías',
  'Análisis Externo — benchmarks de industria',
  'Predicciones y recomendaciones prescriptivas',
  'Exportar PDF y Presentación PowerPoint',
  'Chat con IA ilimitado',
  'Historial de archivos y dashboards',
];

const UpgradeModal: React.FC<UpgradeModalProps> = ({ open, onClose, featureName }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-vizme-navy/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-vizme-navy px-6 pt-6 pb-8 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 h-32 w-32 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-vizme-red/50 via-vizme-orange/50 to-transparent" />

          <button
            onClick={onClose}
            className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X size={14} className="text-white" />
          </button>

          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-vizme-red/20 border border-vizme-red/30 flex items-center justify-center">
              <Zap size={18} className="text-vizme-red" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-vizme-red">Vizme Pro</span>
              <h2 className="text-xl font-bold text-white">Desbloquea el análisis completo</h2>
            </div>
          </div>

          {featureName && (
            <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2 mt-3">
              <Lock size={12} className="text-vizme-grey flex-shrink-0" />
              <p className="text-xs text-vizme-grey">
                Intentaste acceder a: <span className="text-white font-medium">{featureName}</span>
              </p>
            </div>
          )}
        </div>

        {/* Features list */}
        <div className="px-6 py-5">
          <p className="text-xs font-bold uppercase tracking-widest text-vizme-greyblue mb-3">Todo lo que incluye Pro</p>
          <ul className="space-y-2 mb-5">
            {PRO_FEATURES.map((feature, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <div className="h-4 w-4 rounded-full bg-vizme-red/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check size={9} className="text-vizme-red" />
                </div>
                <span className="text-xs text-vizme-greyblue">{feature}</span>
              </li>
            ))}
          </ul>

          {/* Pricing */}
          <div className="bg-vizme-bg rounded-2xl border border-vizme-navy/8 px-5 py-4 mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-vizme-greyblue">Plan Pro mensual</p>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl font-black text-vizme-navy">$50</span>
                <span className="text-sm text-vizme-greyblue">USD/mes</span>
              </div>
              <p className="text-[10px] text-vizme-greyblue">≈ $999 MXN/mes · Sin contrato</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-vizme-greyblue">Reemplaza a</p>
              <p className="text-sm font-bold text-vizme-navy line-through opacity-50">$25,000/mes</p>
              <p className="text-[10px] text-vizme-greyblue">en consultoría</p>
            </div>
          </div>

          <a
            href="mailto:diego@vizme.com.mx?subject=Quiero%20activar%20Vizme%20Pro"
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-vizme-red px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-vizme-red/25 hover:bg-vizme-orange transition-all hover:-translate-y-0.5"
          >
            <Zap size={15} className="fill-white" />
            Activar Vizme Pro
          </a>

          <button
            onClick={onClose}
            className="w-full mt-2 text-xs text-vizme-greyblue hover:text-vizme-navy transition-colors py-2"
          >
            Seguir con el plan gratuito
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpgradeModal;
