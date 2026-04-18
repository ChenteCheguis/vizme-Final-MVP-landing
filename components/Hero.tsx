import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, TrendingUp, AlertCircle, Zap, Building2, Users, ShoppingBag, Upload, Brain, LayoutDashboard, CheckCircle2, Star, MousePointer2 } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, CartesianGrid, BarChart, Bar, Cell, PieChart, Pie } from 'recharts';

// ─── Scenarios ───────────────────────────────────────────────────────────────

const scenarios = {
  retail: {
    label: 'Retail',
    icon: ShoppingBag,
    kpis: [
      { label: 'Ventas del Mes',     value: '$284K',   trend: '+18%',      trendUp: true,  detail: 'vs $240K mes anterior' },
      { label: 'Producto Estrella',  value: 'Cemento', trend: '34% share', trendUp: true,  detail: 'Portland tipo I' },
      { label: 'Stock Crítico',      value: '3 SKUs',  trend: '⚠ Reorden', trendUp: false, detail: 'Impermeabilizante, Varilla, Block' },
    ],
    insight: 'La Región Norte genera el 42% de tus ventas con solo 2 visitas/mes. Abre un punto regional — potencial +$38K/mes.',
    chartLabel: 'Ingresos mensuales ($K)',
    chartData: [
      { name: 'Ene', v: 185 }, { name: 'Feb', v: 210 }, { name: 'Mar', v: 198 },
      { name: 'Abr', v: 245 }, { name: 'May', v: 230 }, { name: 'Jun', v: 284 },
    ],
    chartType: 'area' as const,
    pieData: [
      { name: 'Norte', value: 42, color: '#F54A43' },
      { name: 'Centro', value: 31, color: '#02222F' },
      { name: 'Sur', value: 27, color: '#ABB5B8' },
    ],
    color: '#F54A43',
    healthScore: 7.8,
  },
  b2b: {
    label: 'Empresa B2B',
    icon: Building2,
    kpis: [
      { label: 'MRR Proyectado',     value: '$42.5K',  trend: '+12%',     trendUp: true,  detail: '48 cuentas activas' },
      { label: 'Clientes en Riesgo', value: '8 ctas',  trend: '⚠ Churn', trendUp: false, detail: 'Plan Pro mes 4-6' },
      { label: 'LTV Promedio',       value: '$18,200', trend: '+5%',      trendUp: true,  detail: 'Payback 7.2 meses' },
    ],
    insight: 'Clientes del plan Pro tienen 40% más riesgo de fuga en el mes 4. Campaña de activación día 90 → ahorra ~$8K/mes.',
    chartLabel: 'MRR acumulado ($K)',
    chartData: [
      { name: 'Ene', v: 32 }, { name: 'Feb', v: 34 }, { name: 'Mar', v: 33 },
      { name: 'Abr', v: 38 }, { name: 'May', v: 37 }, { name: 'Jun', v: 42 },
    ],
    chartType: 'area' as const,
    pieData: [
      { name: 'Enterprise', value: 52, color: '#F26A3D' },
      { name: 'Pro', value: 33, color: '#02222F' },
      { name: 'Starter', value: 15, color: '#ABB5B8' },
    ],
    color: '#F26A3D',
    healthScore: 6.4,
  },
  distribucion: {
    label: 'Distribución',
    icon: Users,
    kpis: [
      { label: 'Pedidos del Mes',    value: '1,247',  trend: '+22%',   trendUp: true,  detail: 'Fill rate 96.2%' },
      { label: 'Costo / Entrega',    value: '$87',    trend: 'Óptimo', trendUp: true,  detail: 'Benchmark: $80-150' },
      { label: 'Rutas Ineficientes', value: '3',      trend: '⚠ -18%', trendUp: false, detail: 'Rutas C, F, H' },
    ],
    insight: '3 rutas tienen costo 18% mayor al promedio. Re-enruta por polígono de calor — ahorro estimado $12K/mes.',
    chartLabel: 'Pedidos por ruta',
    chartData: [
      { name: 'Ruta A', v: 420 }, { name: 'Ruta B', v: 380 }, { name: 'Ruta C', v: 290 },
      { name: 'Ruta D', v: 157 }, { name: 'Ruta E', v: 95 },
    ],
    chartType: 'bar' as const,
    pieData: [
      { name: 'CDMX', value: 45, color: '#02222F' },
      { name: 'MTY', value: 30, color: '#F54A43' },
      { name: 'GDL', value: 25, color: '#ABB5B8' },
    ],
    color: '#02222F',
    healthScore: 8.1,
  },
};

type Key = keyof typeof scenarios;

// ─── Health ring ─────────────────────────────────────────────────────────────

const HealthRing: React.FC<{ score: number; color: string }> = ({ score, color }) => {
  const r = 14;
  const circ = 2 * Math.PI * r;
  const arc = circ * (score / 10);
  return (
    <svg width="40" height="40" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r={r} fill="none" stroke="#EBF8FE" strokeWidth="4" />
      <circle
        cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${arc} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 20 20)"
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
      <text x="20" y="24" textAnchor="middle" fontSize="9" fontWeight="800" fill="#02222F">{score}</text>
    </svg>
  );
};

// ─── Component ───────────────────────────────────────────────────────────────

const Hero: React.FC = () => {
  const [active, setActive] = useState<Key>('retail');
  const [animate, setAnimate] = useState(true);
  const [hoveredKpi, setHoveredKpi] = useState<number | null>(null);
  const [showPie, setShowPie] = useState(false);
  const autoRotateRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const s = scenarios[active];
  const keys = Object.keys(scenarios) as Key[];

  // Auto-rotate scenarios every 5s
  useEffect(() => {
    autoRotateRef.current = setInterval(() => {
      setActive(prev => {
        const idx = keys.indexOf(prev);
        return keys[(idx + 1) % keys.length];
      });
    }, 5000);
    return () => { if (autoRotateRef.current) clearInterval(autoRotateRef.current); };
  }, []);

  // Reset animation on tab change
  useEffect(() => {
    setAnimate(false);
    setShowPie(false);
    const t1 = setTimeout(() => setAnimate(true), 80);
    const t2 = setTimeout(() => setShowPie(true), 600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [active]);

  const handleTabClick = (key: Key) => {
    // Stop auto-rotate when user manually clicks
    if (autoRotateRef.current) { clearInterval(autoRotateRef.current); autoRotateRef.current = null; }
    setActive(key);
  };

  return (
    <section className="relative overflow-hidden bg-[#02222F] pt-28 pb-0 lg:pt-36">

      {/* Mesh gradient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(ellipse 80% 60% at 20% 20%, #F54A43 0%, transparent 70%), radial-gradient(ellipse 60% 50% at 80% 80%, #F26A3D 0%, transparent 70%)' }} />
        <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(235,248,254,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(235,248,254,0.03) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
      </div>

      <div className="mx-auto max-w-7xl px-4 relative z-10">
        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-12 lg:items-end">

          {/* ─── Left ─────────────────────────────────────── */}
          <div className="space-y-8 py-8 lg:py-0 text-center lg:text-left lg:pb-20">

            <div className="inline-flex items-center gap-2 rounded-full bg-white/8 border border-white/10 px-3.5 py-1.5 text-[11px] font-semibold text-white/80 backdrop-blur-sm mx-auto lg:mx-0">
              <Star size={10} className="text-vizme-orange fill-vizme-orange" />
              Business Intelligence + IA para PyMEs mexicanas
            </div>

            <div className="space-y-3">
              <h1 className="text-4xl sm:text-5xl lg:text-[3.4rem] font-black tracking-tight text-white leading-[1.05]">
                Convierte tu Excel
                <br />
                <span className="text-transparent bg-clip-text"
                  style={{ backgroundImage: 'linear-gradient(90deg, #F54A43, #F26A3D)' }}>
                  en decisiones que dan dinero.
                </span>
              </h1>
              <p className="text-base sm:text-lg text-white/55 leading-relaxed max-w-lg mx-auto lg:mx-0">
                Sube tus datos, la IA descubre lo que nadie ve y te dice exactamente qué hacer — dashboards, alertas, predicciones y ROI en menos de 2 minutos.
              </p>
            </div>

            <div className="flex items-center gap-2 justify-center lg:justify-start flex-wrap">
              {[
                { icon: Upload,          label: 'Sube tu archivo', num: '1' },
                { icon: Brain,           label: 'IA lo analiza',   num: '2' },
                { icon: LayoutDashboard, label: 'Dashboard listo', num: '3' },
              ].map(({ icon: Icon, label, num }, i) => (
                <React.Fragment key={num}>
                  <div className="flex items-center gap-2 bg-white/8 border border-white/10 rounded-xl px-3 py-2">
                    <span className="h-5 w-5 rounded-full bg-vizme-red flex items-center justify-center text-[9px] font-black text-white flex-shrink-0">{num}</span>
                    <Icon size={12} className="text-white/70 flex-shrink-0" />
                    <span className="text-[11px] font-medium text-white/80 whitespace-nowrap">{label}</span>
                  </div>
                  {i < 2 && <ArrowRight size={12} className="text-white/20 flex-shrink-0 hidden sm:block" />}
                </React.Fragment>
              ))}
            </div>

            <div className="flex justify-center lg:justify-start">
              <a
                href="/register"
                className="inline-flex items-center justify-center gap-3 rounded-2xl px-16 py-5 text-lg font-black text-white transition-all shadow-lg hover:-translate-y-1 duration-200 group"
                style={{ background: 'linear-gradient(135deg, #F54A43, #F26A3D)', boxShadow: '0 8px 32px rgba(245,74,67,0.4)' }}
              >
                Empezar gratis
                <ArrowRight size={20} className="transition-transform group-hover:translate-x-1" />
              </a>
            </div>

            <div className="flex flex-wrap gap-4 justify-center lg:justify-start text-xs text-white/40">
              {['Sin código', 'Sin consultores', 'Datos bajo NDA', 'Cancela cuando quieras'].map(t => (
                <span key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 size={11} className="text-white/30" />{t}
                </span>
              ))}
            </div>
          </div>

          {/* ─── Right — interactive dashboard preview ───── */}
          <div className="relative pb-0">

            <div className="absolute -inset-4 rounded-3xl blur-3xl opacity-20 pointer-events-none"
              style={{ background: `radial-gradient(circle at 50% 50%, ${s.color}, transparent 70%)`, transition: 'background 0.5s ease' }} />

            {/* Scenario tabs with auto-rotate indicator */}
            <div className="flex gap-2 mb-3 justify-center lg:justify-start">
              {keys.map((key) => {
                const Icon = scenarios[key].icon;
                const isActive = active === key;
                return (
                  <button
                    key={key}
                    onClick={() => handleTabClick(key)}
                    className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all border ${
                      isActive
                        ? 'bg-white text-vizme-navy border-transparent shadow-lg'
                        : 'bg-white/8 border-white/10 text-white/60 hover:bg-white/15 hover:text-white'
                    }`}
                  >
                    <Icon size={11} />
                    {scenarios[key].label}
                    {/* Auto-rotate progress bar */}
                    {isActive && autoRotateRef.current && (
                      <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-vizme-navy/10 rounded-full overflow-hidden">
                        <div className="h-full bg-vizme-red rounded-full animate-[progress_5s_linear_infinite]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Dashboard card */}
            <div className="relative bg-white rounded-t-3xl shadow-2xl overflow-hidden border border-white/10"
              style={{ transition: 'all 0.3s ease' }}>

              {/* Window chrome */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-vizme-navy/6 bg-vizme-bg/40">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                    <div className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
                    <div className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
                  </div>
                  <p className="text-[10px] font-semibold text-vizme-greyblue ml-1">{s.label} — Dashboard IA</p>
                </div>
                <div className="flex items-center gap-3">
                  <HealthRing score={s.healthScore} color={s.color} />
                  <span className="flex items-center gap-1.5">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                    </span>
                    <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wide">Live</span>
                  </span>
                </div>
              </div>

              <div className="p-4 space-y-4">

                {/* Interactive KPIs — hover to see detail */}
                <div className="grid grid-cols-3 gap-2">
                  {s.kpis.map((kpi, i) => (
                    <div
                      key={i}
                      className="rounded-xl bg-vizme-bg border border-vizme-navy/5 p-3 cursor-pointer transition-all duration-200 hover:shadow-md hover:border-vizme-navy/15 hover:scale-[1.02]"
                      onMouseEnter={() => setHoveredKpi(i)}
                      onMouseLeave={() => setHoveredKpi(null)}
                    >
                      <p className="text-[9px] text-vizme-greyblue font-semibold uppercase tracking-wider truncate mb-1">{kpi.label}</p>
                      <p className="text-base font-black text-vizme-navy leading-none truncate" title={kpi.value}>{kpi.value}</p>
                      <p className={`text-[10px] font-semibold flex items-center gap-1 mt-1.5 transition-all ${kpi.trendUp ? 'text-emerald-600' : 'text-vizme-red'}`}>
                        {kpi.trendUp ? <TrendingUp size={9} /> : <AlertCircle size={9} />}
                        {hoveredKpi === i ? kpi.detail : kpi.trend}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Chart + mini pie side by side */}
                <div className="grid grid-cols-[1fr_90px] gap-2">
                  <div className="rounded-xl bg-vizme-bg border border-vizme-navy/5 p-3">
                    <p className="text-[9px] text-vizme-greyblue font-semibold mb-2 uppercase tracking-wider">{s.chartLabel}</p>
                    <div className="h-32">
                      {animate && (
                        <ResponsiveContainer width="100%" height="100%">
                          {s.chartType === 'bar' ? (
                            <BarChart data={s.chartData} barSize={20} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2EFF4" />
                              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#566970' }} axisLine={false} tickLine={false} />
                              <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8, backgroundColor: '#02222F', border: 'none', color: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }} cursor={{ fill: 'rgba(2,34,47,0.04)' }} />
                              <Bar dataKey="v" radius={[4, 4, 0, 0]} animationDuration={800}>
                                {s.chartData.map((_, idx) => (
                                  <Cell key={idx} fill={idx < 3 ? s.color : '#ABB5B8'} />
                                ))}
                              </Bar>
                            </BarChart>
                          ) : (
                            <AreaChart data={s.chartData} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
                              <defs>
                                <linearGradient id={`grad-${active}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={s.color} stopOpacity={0.2} />
                                  <stop offset="95%" stopColor={s.color} stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2EFF4" />
                              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#566970' }} axisLine={false} tickLine={false} />
                              <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8, backgroundColor: '#02222F', border: 'none', color: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }} formatter={(v: number) => [`$${v}K`, 'Valor']} />
                              <Area type="monotone" dataKey="v" stroke={s.color} strokeWidth={2.5}
                                fill={`url(#grad-${active})`} dot={{ r: 3, fill: s.color, strokeWidth: 0 }}
                                activeDot={{ r: 5, strokeWidth: 0 }} animationDuration={800} />
                            </AreaChart>
                          )}
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* Mini donut */}
                  <div className="rounded-xl bg-vizme-bg border border-vizme-navy/5 p-2 flex flex-col items-center justify-center">
                    <div className="h-16 w-16">
                      {showPie && (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={s.pieData} dataKey="value" cx="50%" cy="50%" innerRadius={18} outerRadius={28} strokeWidth={0} animationDuration={600}>
                              {s.pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                    <div className="space-y-0.5 mt-1">
                      {s.pieData.map((d, i) => (
                        <div key={i} className="flex items-center gap-1">
                          <div className="h-1.5 w-1.5 rounded-full" style={{ background: d.color }} />
                          <span className="text-[7px] text-vizme-greyblue truncate">{d.name} {d.value}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* AI Insight */}
                <div className="rounded-xl border border-vizme-navy/8 p-3.5 flex gap-3 group cursor-pointer hover:shadow-md transition-all"
                  style={{ background: `linear-gradient(135deg, ${s.color}08, transparent)` }}>
                  <div className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
                    style={{ background: s.color }}>
                    <Zap size={12} className="text-white fill-white" />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-vizme-navy mb-0.5 uppercase tracking-wide">Insight detectado por IA</p>
                    <p className="text-[11px] text-vizme-greyblue leading-relaxed">{s.insight}</p>
                  </div>
                </div>

                {/* Interactive hint */}
                <div className="flex items-center justify-center gap-1.5 opacity-40">
                  <MousePointer2 size={9} className="text-vizme-greyblue" />
                  <p className="text-[8px] text-vizme-greyblue">Hover en los KPIs para ver detalles</p>
                </div>
              </div>

              <div className="h-6 bg-gradient-to-b from-white to-transparent" />
            </div>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="relative z-10 bg-white/6 border-t border-white/8 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex flex-wrap items-center justify-center lg:justify-between gap-6">
            {[
              { value: '+200',    label: 'PyMEs en México' },
              { value: '<2 min',  label: 'Tiempo promedio de análisis' },
              { value: '15+',     label: 'Tipos de gráfica' },
              { value: '100%',    label: 'Datos bajo tu control' },
            ].map(({ value, label }) => (
              <div key={label} className="text-center">
                <p className="text-xl font-black text-white">{value}</p>
                <p className="text-[10px] text-white/40 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
