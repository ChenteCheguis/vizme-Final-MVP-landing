import React from 'react';
import { Check, X, Zap, ArrowRight, Flame, Share2, Bell, CalendarPlus } from 'lucide-react';
import { Link } from 'react-router-dom';

const features: { label: string; free: boolean | string; pro: boolean | string }[] = [
  { label: '1 proyecto',                                  free: true,              pro: '—' },
  { label: 'Proyectos ilimitados',                        free: false,             pro: true },
  { label: '1 archivo (hasta 5 MB)',                      free: true,              pro: '—' },
  { label: 'Archivos ilimitados (hasta 50 MB)',           free: false,             pro: true },
  { label: '3 analisis al mes',                           free: true,              pro: '—' },
  { label: 'Analisis ilimitados',                         free: false,             pro: true },
  { label: 'Dashboard basico — 3-4 charts',              free: true,              pro: '—' },
  { label: 'Dashboard Pro — 8+ charts + correlaciones',  free: false,             pro: true },
  { label: 'Discovery Narrado (historia de tus datos)',   free: true,              pro: true },
  { label: 'Health Score del negocio',                    free: true,              pro: true },
  { label: 'Reporte Ejecutivo',                           free: '1 insight',       pro: 'Completo' },
  { label: 'Analisis Interno + segmentacion',             free: false,             pro: true },
  { label: 'Analisis Externo + benchmarks',               free: false,             pro: true },
  { label: 'Predicciones y escenarios IA',                free: false,             pro: true },
  { label: 'Entrada semanal rapida',                      free: '3/mes',           pro: 'Ilimitada' },
  { label: 'Analisis de competidores (Google Places)',     free: false,             pro: true },
  { label: 'Exportar PDF',                                free: false,             pro: true },
  { label: 'Dashboard compartible (link publico)',         free: false,             pro: true },
  { label: 'Notificaciones por email',                    free: false,             pro: true },
  { label: 'Chat con IA ilimitado',                       free: false,             pro: true },
  { label: 'Racha y gamificacion',                        free: true,              pro: true },
  { label: 'Regeneraciones de dashboard',                 free: '2/mes',           pro: '10/mes' },
];

const FeatureCell: React.FC<{ value: boolean | string }> = ({ value }) => {
  if (typeof value === 'string') {
    return <span className="text-xs text-vizme-greyblue">{value}</span>;
  }
  return value ? (
    <div className="h-5 w-5 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
      <Check size={11} className="text-emerald-600" />
    </div>
  ) : (
    <div className="h-5 w-5 rounded-full bg-vizme-navy/5 flex items-center justify-center mx-auto">
      <X size={11} className="text-vizme-greyblue/40" />
    </div>
  );
};

const PricingSection: React.FC = () => {
  return (
    <section id="planes" className="py-24 bg-white border-t border-vizme-navy/5">
      <div className="mx-auto max-w-5xl px-4">

        <div className="text-center mb-14">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-vizme-red mb-3 block">
            Planes y precios
          </span>
          <h2 className="text-3xl font-bold text-vizme-navy sm:text-4xl mb-4">
            Empieza gratis.<br />
            <span className="text-vizme-greyblue font-medium">Escala cuando lo necesites.</span>
          </h2>
          <p className="text-sm text-vizme-greyblue max-w-lg mx-auto">
            Vizme reemplaza a un consultor de BI a una fraccion del costo. Sin contrato. Sin sorpresas.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid gap-6 md:grid-cols-2 mb-10">

          {/* Free */}
          <div className="rounded-3xl border-2 border-vizme-navy/10 p-8 flex flex-col">
            <div className="mb-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-vizme-greyblue mb-1">Vizme Free</p>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-black text-vizme-navy">$0</span>
                <span className="text-sm text-vizme-greyblue">para siempre</span>
              </div>
              <p className="text-sm text-vizme-greyblue">Prueba Vizme sin costo. Perfecto para tu primer analisis.</p>
            </div>

            <ul className="space-y-3 flex-1 mb-8">
              {[
                '1 proyecto, 1 archivo (5 MB)',
                '3 analisis al mes',
                'Dashboard basico (3-4 charts)',
                'Discovery Narrado de tus datos',
                'Health Score del negocio',
                '1 insight del reporte ejecutivo',
                'Entrada semanal (3/mes)',
                '2 regeneraciones de dashboard/mes',
              ].map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-vizme-greyblue">
                  <div className="h-4 w-4 rounded-full bg-vizme-navy/5 flex items-center justify-center flex-shrink-0">
                    <Check size={10} className="text-vizme-navy/50" />
                  </div>
                  {f}
                </li>
              ))}
            </ul>

            <Link
              to="/register"
              className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-vizme-navy/15 px-4 py-3 text-sm font-semibold text-vizme-navy hover:bg-vizme-bg transition-all"
            >
              Empezar gratis
              <ArrowRight size={14} />
            </Link>
          </div>

          {/* Pro */}
          <div className="rounded-3xl border-2 border-vizme-red bg-vizme-navy p-8 flex flex-col relative overflow-hidden">
            <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-vizme-red/10 blur-2xl" />
            <div className="absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-vizme-orange/10 blur-xl" />

            <div className="absolute top-5 right-5">
              <span className="inline-flex items-center gap-1 bg-vizme-red rounded-full px-2.5 py-1 text-[10px] font-bold text-white">
                <Zap size={9} className="fill-white" />
                Recomendado
              </span>
            </div>

            <div className="mb-6 relative">
              <p className="text-[10px] font-bold uppercase tracking-widest text-vizme-red mb-1">Vizme Pro</p>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-black text-white">$999</span>
                <span className="text-sm text-white/50">MXN/mes</span>
              </div>
              <p className="text-[11px] text-white/40 mb-2">Sin contrato · Cancela cuando quieras</p>
              <p className="text-sm text-white/60">Todo en Free, mas analisis avanzado, predicciones, competidores y mucho mas.</p>
            </div>

            <ul className="space-y-3 flex-1 mb-8 relative">
              {[
                'Proyectos y archivos ilimitados (50 MB)',
                'Analisis ilimitados',
                'Dashboard Pro — 8+ charts + correlaciones',
                'Reporte Ejecutivo completo',
                'Analisis Interno — KPIs, segmentacion, anomalias',
                'Analisis Externo — benchmarks de industria',
                'Predicciones y escenarios con IA',
                'Entrada semanal ilimitada',
                'Competidores (Google Places)',
                'Exportar PDF + Dashboard compartible',
                'Notificaciones por email semanales',
                'Chat con IA ilimitado',
                '10 regeneraciones/mes',
              ].map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-white/70">
                  <div className="h-4 w-4 rounded-full bg-vizme-red/20 flex items-center justify-center flex-shrink-0">
                    <Check size={10} className="text-vizme-red" />
                  </div>
                  {f}
                </li>
              ))}
            </ul>

            <Link
              to="/register"
              className="relative w-full flex items-center justify-center gap-2 rounded-xl bg-vizme-red px-4 py-3.5 text-sm font-bold text-white shadow-xl shadow-vizme-red/30 hover:bg-vizme-orange transition-all hover:-translate-y-0.5"
            >
              <Zap size={14} className="fill-white" />
              Empezar con Pro
            </Link>
          </div>
        </div>

        {/* Feature comparison table */}
        <div className="rounded-2xl border border-vizme-navy/8 overflow-hidden">
          <div className="bg-vizme-bg px-5 py-3 grid grid-cols-[1fr_100px_100px] gap-4 border-b border-vizme-navy/8">
            <span className="text-[10px] font-bold uppercase tracking-widest text-vizme-greyblue">Caracteristica</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-vizme-greyblue text-center">Free</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-vizme-red text-center">Pro</span>
          </div>
          {features.map((f, i) => (
            <div
              key={i}
              className={`px-5 py-3 grid grid-cols-[1fr_100px_100px] gap-4 items-center ${
                i % 2 === 0 ? 'bg-white' : 'bg-vizme-bg/40'
              } border-b border-vizme-navy/5 last:border-0`}
            >
              <span className="text-xs text-vizme-greyblue">{f.label}</span>
              <div className="text-center">
                <FeatureCell value={f.free} />
              </div>
              <div className="text-center">
                <FeatureCell value={f.pro} />
              </div>
            </div>
          ))}
        </div>

        {/* V4 highlights */}
        <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { icon: Flame, label: 'Gamificacion', desc: 'Racha semanal y logros', color: 'text-orange-500 bg-orange-50' },
            { icon: Share2, label: 'Compartir', desc: 'Links publicos de dashboard', color: 'text-blue-500 bg-blue-50' },
            { icon: Bell, label: 'Alertas Email', desc: 'Resumen semanal automatico', color: 'text-purple-500 bg-purple-50' },
            { icon: CalendarPlus, label: 'Entrada Rapida', desc: 'Actualiza sin subir Excel', color: 'text-emerald-500 bg-emerald-50' },
          ].map(({ icon: Icon, label, desc, color }) => (
            <div key={label} className="rounded-xl border border-vizme-navy/6 p-4 text-center">
              <div className={`h-9 w-9 rounded-xl ${color} flex items-center justify-center mx-auto mb-2`}>
                <Icon size={16} />
              </div>
              <p className="text-xs font-bold text-vizme-navy">{label}</p>
              <p className="text-[10px] text-vizme-greyblue mt-0.5">{desc}</p>
            </div>
          ))}
        </div>

        {/* Value prop */}
        <div className="mt-8 text-center">
          <p className="text-xs text-vizme-greyblue">
            ¿Preguntas? Escribenos a{' '}
            <a href="mailto:diego@vizme.com.mx" className="text-vizme-red hover:text-vizme-orange transition-colors font-medium">
              diego@vizme.com.mx
            </a>
          </p>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
