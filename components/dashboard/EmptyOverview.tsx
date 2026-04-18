import React from 'react';
import { ArrowRight, Lock, Sparkles, Brain, TrendingUp, BarChart2, MessageCircle, Building2, Users, Music2 } from 'lucide-react';

const INDUSTRY_META: Record<string, { Icon: React.ElementType; greeting: string; color: string }> = {
  empresa:    { Icon: Building2, color: '#F26A3D', greeting: 'Descubre qué producto te deja más margen, qué clientes están en riesgo de irse, y cuándo son tus picos de venta reales.' },
  influencer: { Icon: Users,     color: '#F54A43', greeting: 'Descubre qué contenido convierte en brand deals, tu horario óptimo de publicación y cuánto deberías cobrar por tu siguiente campaña.' },
  artista:    { Icon: Music2,    color: '#02222F', greeting: 'Descubre en qué plataforma estás creciendo más, cuál es tu canción con más momentum y dónde está tu fanbase emergente.' },
};

interface Props {
  firstName: string;
  companyName: string;
  industry: string;
  onGoToData: () => void;
  onShowTour: () => void;
}

const EmptyOverview: React.FC<Props> = ({ firstName, companyName, industry, onGoToData, onShowTour }) => {
  const meta = INDUSTRY_META[industry] ?? INDUSTRY_META.empresa;
  const MetaIcon = meta.Icon;

  return (
    <div className="space-y-6">

      {/* ── Hero ──────────────────────────────────── */}
      <div className="bg-vizme-navy rounded-3xl p-6 md:p-8 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 h-52 w-52 rounded-full bg-vizme-red/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 h-36 w-36 rounded-full bg-vizme-orange/15 blur-2xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
              <MetaIcon size={20} className="text-white" />
            </div>
            <div>
              <p className="text-[9px] text-white/40 uppercase tracking-widest">Bienvenido a Vizme</p>
              <p className="text-sm font-semibold text-white">{companyName || 'Tu empresa'}</p>
            </div>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white leading-snug mb-3">
            Hola, {firstName} 👋
          </h1>
          <p className="text-sm text-white/70 leading-relaxed max-w-lg mb-6">
            {meta.greeting}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onGoToData}
              className="flex items-center justify-center gap-2 rounded-xl bg-vizme-red px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-black/20 hover:bg-vizme-orange transition-all hover:-translate-y-0.5"
            >
              <ArrowRight size={15} />
              Subir mi primer archivo
            </button>
            <button
              onClick={onShowTour}
              className="flex items-center justify-center gap-2 rounded-xl bg-white/10 border border-white/10 px-5 py-3 text-sm font-medium text-white hover:bg-white/15 transition-all"
            >
              <Sparkles size={15} />
              Ver qué puede hacer Vizme
            </button>
          </div>
        </div>
      </div>

      {/* ── Dashboard preview (blurred / locked) ─── */}
      <div className="relative rounded-3xl overflow-hidden ring-1 ring-vizme-navy/10">
        {/* Blurred fake dashboard */}
        <div className="blur-sm pointer-events-none select-none opacity-70 p-5 bg-white space-y-4">
          {/* Fake KPI row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Ingresos totales', value: '$284,500', up: true },
              { label: 'Ticket promedio', value: '$3,420', up: true },
              { label: 'Churn riesgo', value: '8 cuentas', up: false },
            ].map((kpi, i) => (
              <div key={i} className="bg-vizme-bg rounded-xl p-4">
                <p className="text-[9px] text-vizme-greyblue uppercase mb-2">{kpi.label}</p>
                <p className="text-xl font-bold text-vizme-navy">{kpi.value}</p>
                <p className={`text-[10px] font-medium mt-1 ${kpi.up ? 'text-emerald-600' : 'text-vizme-red'}`}>
                  {kpi.up ? '↑ +12% vs mes anterior' : '⚠ Requiere atención'}
                </p>
              </div>
            ))}
          </div>
          {/* Fake chart */}
          <div className="bg-vizme-bg rounded-xl p-4">
            <p className="text-xs font-bold text-vizme-navy mb-3">Tendencia de ingresos — últimas 8 semanas</p>
            <div className="flex items-end gap-2 h-24">
              {[45, 60, 52, 72, 68, 80, 76, 92].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-md"
                  style={{
                    height: `${h}%`,
                    backgroundColor: i === 7 ? '#F54A43' : i === 6 ? '#F26A3D' : '#E2EFF4',
                  }}
                />
              ))}
            </div>
          </div>
          {/* Fake insight */}
          <div className="bg-red-50 border border-vizme-red/20 rounded-xl p-4">
            <p className="text-xs font-bold text-vizme-red mb-1">🔍 Descubrimiento IA · Alta prioridad</p>
            <p className="text-xs text-red-700">El producto "X Premium" genera el 43% de los ingresos pero solo representa el 8% de las transacciones — oportunidad de upsell desaprovechada.</p>
          </div>
        </div>

        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-vizme-navy/90 via-vizme-navy/50 to-transparent flex flex-col items-center justify-center text-center px-6">
          <div className="h-14 w-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mb-4">
            <Lock size={22} className="text-white" />
          </div>
          <p className="text-white font-bold text-lg mb-1">Tu Command Center te espera</p>
          <p className="text-white/60 text-sm mb-4">Así se verá tu dashboard real después de subir tus datos</p>
          <button
            onClick={onGoToData}
            className="flex items-center gap-2 rounded-xl bg-vizme-red px-5 py-2.5 text-sm font-semibold text-white hover:bg-vizme-orange transition-all hover:-translate-y-0.5 shadow-lg shadow-black/30"
          >
            <ArrowRight size={14} />
            Activar con mis datos
          </button>
        </div>
      </div>

      {/* ── Capabilities strip ────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            icon: Brain,
            label: 'Análisis IA en segundos',
            sub: 'Sube tu Excel o CSV y Claude analiza 100+ variables automáticamente',
          },
          {
            icon: MessageCircle,
            label: 'Chat con tus datos',
            sub: '"¿Cuál fue mi mejor mes?" — preguntas en español, respuestas inmediatas',
          },
          {
            icon: BarChart2,
            label: 'Reportes ejecutivos',
            sub: 'PDF y PowerPoint listos para presentar a socios o inversores',
          },
        ].map(({ icon: Icon, label, sub }) => (
          <div key={label} className="bg-white rounded-2xl border border-vizme-navy/5 p-4 shadow-sm flex gap-3 items-start">
            <div className="h-8 w-8 rounded-lg bg-vizme-bg flex items-center justify-center flex-shrink-0">
              <Icon size={15} className="text-vizme-greyblue" />
            </div>
            <div>
              <p className="text-xs font-semibold text-vizme-navy">{label}</p>
              <p className="text-[11px] text-vizme-greyblue mt-0.5 leading-relaxed">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Value prop ────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-vizme-navy/5 p-5 shadow-sm flex items-center gap-4">
        <div className="h-10 w-10 rounded-xl bg-vizme-navy/5 flex items-center justify-center flex-shrink-0">
          <TrendingUp size={18} className="text-vizme-navy" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-vizme-navy">Lo que una consultoría cobra $5,000/mes — tú lo tienes por $50</p>
          <p className="text-xs text-vizme-greyblue mt-0.5">Sube tu primer archivo y activa tu analista IA personal ahora.</p>
        </div>
        <button onClick={onGoToData} className="flex-shrink-0 flex items-center gap-1.5 rounded-xl bg-vizme-red px-4 py-2 text-sm font-semibold text-white hover:bg-vizme-orange transition-all">
          <ArrowRight size={13} />
          Empezar
        </button>
      </div>

    </div>
  );
};

export default EmptyOverview;
