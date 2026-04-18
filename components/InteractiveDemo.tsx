import React, { useState, useRef, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Lock, TrendingUp, TrendingDown, ArrowRight, Zap, ChevronDown, ChevronUp,
  Brain, Sparkles, MousePointer2, X, Maximize2, AlertTriangle,
  ShoppingBag, Building2, Users, Activity,
} from 'lucide-react';
import { Link } from 'react-router-dom';

// ── useInView hook ───────────────────────────────────────────────────────────

function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

// ── Scenario data ────────────────────────────────────────────────────────────

const scenarios = {
  distribucion: {
    label: 'Distribuidora',
    icon: ShoppingBag,
    company: 'Distribuidora Materiales del Norte SA de CV',
    subtitle: 'Analisis Q2 2024 · Construccion / Distribucion',
    color: '#F54A43',
    kpis: [
      { label: 'Ventas Totales Q2', value: '$614,350', change: '+14%', up: true, detail: 'vs $538K Q1 — crecimiento sostenido' },
      { label: 'Ticket Promedio', value: '$12,287', change: '+6%', up: true, detail: 'Era $11,590 el trimestre pasado' },
      { label: 'Clientes Activos', value: '52', change: '-2', up: false, detail: '2 clientes inactivos desde abril' },
    ],
    barData: [
      { name: 'Cemento Portland', value: 225000 },
      { name: 'Impermeabilizante', value: 91200 },
      { name: 'Panel de Yeso', value: 81200 },
      { name: 'Varilla 3/8"', value: 80750 },
      { name: 'Plafon PVC', value: 46200 },
      { name: 'Block 15cm', value: 50400 },
    ],
    barInsight: 'Los 2 productos top representan el 51% de tus ingresos. Alta concentracion de riesgo.',
    lineData: [
      { name: 'Ene', value: 285 }, { name: 'Feb', value: 310 }, { name: 'Mar', value: 345 },
      { name: 'Abr', value: 298 }, { name: 'May', value: 378 }, { name: 'Jun', value: 412 },
    ],
    lineInsight: 'Crecimiento del +44% de enero a junio. Abril tuvo una caida — revisar causa raiz.',
    pieData: [
      { name: 'Norte', value: 42, color: '#02222F' },
      { name: 'Centro', value: 28, color: '#F26A3D' },
      { name: 'Occidente', value: 18, color: '#566970' },
      { name: 'Sur', value: 12, color: '#F54A43' },
    ],
    topClientes: [
      { name: 'Constructora Regio SA', monto: '$89,400', cambio: '+12%', up: true },
      { name: 'Inmobiliaria Norteno', monto: '$72,100', cambio: '+8%', up: true },
      { name: 'Obras y Cimentaciones', monto: '$61,500', cambio: '-3%', up: false },
      { name: 'Constructora del Valle', monto: '$48,200', cambio: '+21%', up: true },
      { name: 'Grupo Residencial Norte', monto: '$42,800', cambio: '+5%', up: true },
    ],
    insights: [
      'El Cemento Portland representa el 34% de tus ingresos — protege este producto ante alzas de precio.',
      'Tendencia alcista del +44% en 6 meses. Junio fue tu mejor mes historico.',
      'La Region Norte domina con 42% de ventas. Occidente (18%) tiene potencial de crecimiento sin explotar.',
    ],
    healthScore: 7.4,
  },
  b2b: {
    label: 'SaaS B2B',
    icon: Building2,
    company: 'CloudMetrics MX',
    subtitle: 'MRR Dashboard · SaaS / Tecnologia',
    color: '#F26A3D',
    kpis: [
      { label: 'MRR', value: '$42.5K', change: '+12%', up: true, detail: '48 cuentas activas pagando' },
      { label: 'Churn Rate', value: '4.2%', change: '+0.8%', up: false, detail: 'Benchmark: <3%. Necesita atencion' },
      { label: 'LTV Promedio', value: '$18,200', change: '+5%', up: true, detail: 'Payback en 7.2 meses' },
    ],
    barData: [
      { name: 'Enterprise', value: 22100 },
      { name: 'Pro', value: 14000 },
      { name: 'Starter', value: 6400 },
    ],
    barInsight: 'Enterprise genera 52% del MRR con solo 12 cuentas. Alta dependencia.',
    lineData: [
      { name: 'Ene', value: 32 }, { name: 'Feb', value: 34 }, { name: 'Mar', value: 33 },
      { name: 'Abr', value: 38 }, { name: 'May', value: 37 }, { name: 'Jun', value: 42.5 },
    ],
    lineInsight: 'MRR crecio 33% en 6 meses. La caida de mayo fue por 2 Enterprise churned.',
    pieData: [
      { name: 'Enterprise', value: 52, color: '#F26A3D' },
      { name: 'Pro', value: 33, color: '#02222F' },
      { name: 'Starter', value: 15, color: '#ABB5B8' },
    ],
    topClientes: [
      { name: 'Grupo Financiero BancoPlus', monto: '$4,800/mo', cambio: '+0%', up: true },
      { name: 'Logistica Express SA', monto: '$3,200/mo', cambio: '+15%', up: true },
      { name: 'Farmacia Digital MX', monto: '$2,800/mo', cambio: '-10%', up: false },
      { name: 'EdTech Solutions', monto: '$2,400/mo', cambio: '+8%', up: true },
      { name: 'RetailConnect Pro', monto: '$2,100/mo', cambio: '+22%', up: true },
    ],
    insights: [
      'Clientes del plan Pro tienen 40% mas riesgo de fuga en el mes 4. Campana de activacion dia 90.',
      'Tu LTV:CAC es 3.2:1 — arriba del benchmark de 3:1. Buen unit economics.',
      '8 cuentas estan en riesgo de churn. Intervencion proactiva podria salvar ~$8K/mes.',
    ],
    healthScore: 6.2,
  },
  logistica: {
    label: 'Logistica',
    icon: Users,
    company: 'TransportesMX Express',
    subtitle: 'Operaciones Q2 · Logistica / Distribucion',
    color: '#02222F',
    kpis: [
      { label: 'Pedidos/Mes', value: '1,247', change: '+22%', up: true, detail: 'Fill rate 96.2% — excelente' },
      { label: 'Costo/Entrega', value: '$87', change: '-$5', up: true, detail: 'Benchmark: $80-150. Optimo' },
      { label: 'Rutas Ineficientes', value: '3', change: '+1', up: false, detail: 'Rutas C, F, H — costo 18% arriba' },
    ],
    barData: [
      { name: 'Ruta A', value: 420 }, { name: 'Ruta B', value: 380 },
      { name: 'Ruta C', value: 290 }, { name: 'Ruta D', value: 157 }, { name: 'Ruta E', value: 95 },
    ],
    barInsight: 'Ruta A y B concentran 60% del volumen. Ruta E tiene baja utilizacion — evalua eliminar.',
    lineData: [
      { name: 'Ene', value: 920 }, { name: 'Feb', value: 980 }, { name: 'Mar', value: 1050 },
      { name: 'Abr', value: 1120 }, { name: 'May', value: 1180 }, { name: 'Jun', value: 1247 },
    ],
    lineInsight: 'Crecimiento sostenido del 35% en pedidos. Capacidad de flota al 88% — planea expansion.',
    pieData: [
      { name: 'CDMX', value: 45, color: '#02222F' },
      { name: 'MTY', value: 30, color: '#F54A43' },
      { name: 'GDL', value: 25, color: '#ABB5B8' },
    ],
    topClientes: [
      { name: 'Amazon MX Fulfillment', monto: '312 envios', cambio: '+28%', up: true },
      { name: 'MercadoLibre Full', monto: '245 envios', cambio: '+15%', up: true },
      { name: 'Liverpool eCommerce', monto: '189 envios', cambio: '-5%', up: false },
      { name: 'Coppel Digital', monto: '156 envios', cambio: '+32%', up: true },
      { name: 'Soriana Express', monto: '98 envios', cambio: '+8%', up: true },
    ],
    insights: [
      '3 rutas tienen costo 18% mayor al promedio. Re-enruta por poligono de calor — ahorro $12K/mes.',
      'Fill rate de 96.2% esta arriba del benchmark (>95%). Mantener operacion actual.',
      'CDMX concentra 45% de entregas. MTY crece rapido (+30%) — prepara hub regional.',
    ],
    healthScore: 8.1,
  },
};

type ScenarioKey = keyof typeof scenarios;

// ── Shared styles ─────────────────────────────────────────────────────────────

const PALETTE = ['#F54A43', '#F26A3D', '#02222F', '#566970', '#ABB5B8', '#34D399'];

const TIP = {
  backgroundColor: '#02222F', border: 'none', borderRadius: 10,
  color: '#fff', fontSize: 11, padding: '8px 12px',
  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
};

const fmtK = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`;

// ── Health ring ──────────────────────────────────────────────────────────────

const HealthRing: React.FC<{ score: number; color: string }> = ({ score, color }) => {
  const pct = score / 10;
  const r = 22; const circ = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center">
      <svg width="56" height="56" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={r} fill="none" stroke="#f1f5f9" strokeWidth="5" />
        <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 28 28)" style={{ transition: 'stroke-dasharray 1s ease' }} />
        <text x="28" y="32" textAnchor="middle" fontSize="13" fontWeight="800" fill="#02222F">{score}</text>
      </svg>
      <span className="text-[8px] text-vizme-greyblue mt-0.5">Health Score</span>
    </div>
  );
};

// ── Active bar shape ─────────────────────────────────────────────────────────

const ActiveBarShape = (props: any) => {
  const { x, y, width, height, fill } = props;
  return <rect x={x} y={y} width={width} height={height} fill={fill} rx={6}
    style={{ filter: 'brightness(1.15) drop-shadow(0 2px 6px rgba(0,0,0,0.12))' }} />;
};

// ── Locked overlay ───────────────────────────────────────────────────────────

const LockedOverlay: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <div className="relative rounded-2xl overflow-hidden border border-vizme-navy/8">
    <div className="pointer-events-none select-none p-6" style={{ filter: 'blur(5px)' }} aria-hidden>
      <div className="h-3 w-48 bg-vizme-navy/20 rounded mb-3" />
      <div className="h-3 w-32 bg-vizme-navy/10 rounded mb-5" />
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-vizme-bg border border-vizme-navy/8" />)}
      </div>
      <div className="h-28 rounded-xl bg-vizme-bg" />
    </div>
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-[3px] text-center p-6">
      <div className="h-12 w-12 rounded-2xl bg-vizme-navy/5 border border-vizme-navy/10 flex items-center justify-center mb-3">
        <Lock size={20} className="text-vizme-navy" />
      </div>
      <h4 className="text-sm font-bold text-vizme-navy mb-1">{title}</h4>
      <p className="text-xs text-vizme-greyblue mb-4 max-w-xs leading-relaxed">{description}</p>
      <Link to="/register"
        className="inline-flex items-center gap-2 rounded-xl bg-vizme-red px-5 py-2 text-xs font-bold text-white shadow-lg shadow-vizme-red/25 hover:bg-vizme-orange transition-all hover:-translate-y-0.5">
        Desbloquear con Pro
      </Link>
    </div>
  </div>
);

// ── AnimatedSection ──────────────────────────────────────────────────────────

const AnimatedSection: React.FC<{ children: React.ReactNode; delay?: number; className?: string }> = ({ children, delay = 0, className }) => {
  const { ref, visible } = useInView(0.05);
  return (
    <div ref={ref} className={className}
      style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(16px)',
        transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms` }}>
      {children}
    </div>
  );
};

// ── Main component ───────────────────────────────────────────────────────────

const InteractiveDemo: React.FC = () => {
  const [activeScenario, setActiveScenario] = useState<ScenarioKey>('distribucion');
  const [insightsOpen, setInsightsOpen] = useState(true);
  const [expandedKpi, setExpandedKpi] = useState<number | null>(null);
  const [highlightedBar, setHighlightedBar] = useState<number | null>(null);
  const [highlightedPie, setHighlightedPie] = useState<number | null>(null);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [animate, setAnimate] = useState(true);

  const s = scenarios[activeScenario];

  // Reset animations on scenario change
  useEffect(() => {
    setAnimate(false);
    setExpandedKpi(null);
    setHighlightedBar(null);
    setHighlightedPie(null);
    const t = setTimeout(() => setAnimate(true), 100);
    return () => clearTimeout(t);
  }, [activeScenario]);

  return (
    <section id="demo" className="py-24 bg-vizme-bg border-t border-vizme-navy/5">
      <div className="mx-auto max-w-7xl px-4">

        {/* Section header */}
        <AnimatedSection className="text-center mb-10">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-vizme-red mb-3 block">
            Demo interactivo
          </span>
          <h2 className="text-3xl font-bold text-vizme-navy sm:text-4xl mb-4">
            Asi se ve Vizme en accion
          </h2>
          <p className="text-sm text-vizme-greyblue max-w-xl mx-auto">
            Dashboards reales generados por IA. Selecciona un escenario y explora — todo es interactivo.
          </p>
        </AnimatedSection>

        {/* Scenario tabs */}
        <AnimatedSection delay={100} className="flex gap-2 justify-center mb-6">
          {(Object.keys(scenarios) as ScenarioKey[]).map(key => {
            const sc = scenarios[key];
            const Icon = sc.icon;
            const isActive = activeScenario === key;
            return (
              <button key={key} onClick={() => setActiveScenario(key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all duration-200 ${
                  isActive
                    ? 'bg-vizme-navy text-white border-vizme-navy shadow-lg shadow-vizme-navy/20'
                    : 'bg-white border-vizme-navy/10 text-vizme-greyblue hover:border-vizme-navy/30 hover:text-vizme-navy hover:-translate-y-0.5'
                }`}>
                <Icon size={14} />
                {sc.label}
              </button>
            );
          })}
        </AnimatedSection>

        {/* Dashboard container */}
        <div className="bg-white rounded-3xl border border-vizme-navy/10 shadow-2xl shadow-vizme-navy/15 ring-1 ring-vizme-navy/5 overflow-hidden" style={{ boxShadow: '0 25px 60px -12px rgba(2,34,47,0.25), 0 0 0 1px rgba(2,34,47,0.05)' }}>

          {/* Dashboard topbar */}
          <div className="border-b border-vizme-navy/8 px-6 py-4 flex items-center justify-between bg-vizme-navy/2">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: s.color }}>
                <span className="text-[10px] font-black text-white">V</span>
              </div>
              <div>
                <p className="text-xs font-bold text-vizme-navy">{s.company}</p>
                <p className="text-[10px] text-vizme-greyblue">{s.subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <HealthRing score={s.healthScore} color={s.color} />
              <span className="flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                </span>
                <span className="text-[9px] text-emerald-600 font-bold uppercase">Live</span>
              </span>
            </div>
          </div>

          <div className="p-6 space-y-6">

            {/* KPI strip — clickable */}
            {animate && (
              <div className="grid grid-cols-3 gap-4">
                {s.kpis.map((kpi, i) => (
                  <div key={i}
                    onClick={() => setExpandedKpi(prev => prev === i ? null : i)}
                    className={`rounded-2xl border p-4 cursor-pointer transition-all duration-300 ${
                      expandedKpi === i
                        ? 'bg-white border-vizme-red/30 shadow-md ring-1 ring-vizme-red/10'
                        : 'bg-vizme-bg border-vizme-navy/8 hover:shadow-md hover:-translate-y-0.5 hover:border-vizme-navy/15'
                    }`}
                    style={{ animation: `fadeSlideUp 0.4s ease ${i * 100}ms forwards`, opacity: 0 }}
                  >
                    <p className="text-[10px] font-medium text-vizme-greyblue uppercase tracking-wide mb-1">{kpi.label}</p>
                    <p className="text-xl font-black text-vizme-navy mb-1">{kpi.value}</p>
                    <div className={`flex items-center gap-1 text-[11px] font-semibold ${kpi.up ? 'text-emerald-600' : 'text-vizme-red'}`}>
                      {kpi.up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                      {kpi.change} vs trimestre anterior
                    </div>
                    {expandedKpi === i && (
                      <div className="mt-3 pt-3 border-t border-vizme-navy/8 animate-in fade-in slide-in-from-top-1 duration-150">
                        <p className="text-[11px] text-vizme-greyblue flex items-center gap-1.5">
                          <Activity size={10} className="text-vizme-red flex-shrink-0" />
                          {kpi.detail}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <p className="text-center text-[9px] text-vizme-greyblue/40 flex items-center justify-center gap-1">
              <MousePointer2 size={8} /> Click en los KPIs para ver detalles
            </p>

            {/* Charts row 1 */}
            {animate && (
              <div className="grid gap-4 lg:grid-cols-2">
                {/* Bar chart — clickable bars */}
                <div className="rounded-2xl border border-vizme-navy/8 bg-white p-5 group hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-bold text-vizme-navy">
                      {activeScenario === 'b2b' ? 'MRR por Plan' : activeScenario === 'logistica' ? 'Pedidos por Ruta' : 'Ventas por Producto'}
                    </p>
                  </div>
                  <p className="text-[10px] text-vizme-greyblue mb-4">
                    {activeScenario === 'b2b' ? 'Revenue mensual recurrente' : activeScenario === 'logistica' ? 'Volumen Q2 2024' : 'Ingresos Q2 2024 (MXN)'}
                  </p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={s.barData} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtK(v)} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#566970' }} axisLine={false} tickLine={false} width={95} />
                      <Tooltip contentStyle={TIP} formatter={(v: number) => [fmtK(v), 'Valor']} cursor={{ fill: 'rgba(245,74,67,0.05)' }} />
                      <Bar dataKey="value" radius={[0, 6, 6, 0]} cursor="pointer" activeBar={<ActiveBarShape />}
                        onClick={(_: any, idx: number) => setHighlightedBar(prev => prev === idx ? null : idx)}
                        animationDuration={800}>
                        {s.barData.map((_, i) => (
                          <Cell key={i} fill={PALETTE[i % PALETTE.length]}
                            opacity={highlightedBar !== null && highlightedBar !== i ? 0.3 : 1} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  {highlightedBar !== null && s.barData[highlightedBar] && (
                    <div className="mt-2 bg-vizme-bg rounded-xl px-3 py-2 border border-vizme-navy/5 flex items-center justify-between animate-in fade-in duration-150">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ background: PALETTE[highlightedBar % PALETTE.length] }} />
                        <span className="text-[11px] font-semibold text-vizme-navy">{s.barData[highlightedBar].name}</span>
                        <span className="text-[11px] text-vizme-greyblue">{fmtK(s.barData[highlightedBar].value)}</span>
                        <span className="text-[10px] text-vizme-greyblue">({((s.barData[highlightedBar].value / s.barData.reduce((a, b) => a + b.value, 0)) * 100).toFixed(0)}% del total)</span>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); setHighlightedBar(null); }} className="text-vizme-greyblue hover:text-vizme-navy">
                        <X size={12} />
                      </button>
                    </div>
                  )}
                  {highlightedBar === null && (
                    <p className="mt-3 text-[11px] text-vizme-greyblue bg-vizme-bg rounded-xl px-3 py-2 border border-vizme-navy/5">
                      <span className="font-semibold text-vizme-navy">Insight:</span> {s.barInsight}
                    </p>
                  )}
                </div>

                {/* Line chart */}
                <div className="rounded-2xl border border-vizme-navy/8 bg-white p-5 hover:shadow-md transition-shadow">
                  <p className="text-xs font-bold text-vizme-navy mb-1">
                    {activeScenario === 'b2b' ? 'MRR Acumulado' : activeScenario === 'logistica' ? 'Pedidos Mensuales' : 'Tendencia de Ventas'}
                  </p>
                  <p className="text-[10px] text-vizme-greyblue mb-4">Ene – Jun 2024</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={s.lineData} margin={{ left: 0, right: 16 }}>
                      <defs>
                        <linearGradient id={`demo-grad-${activeScenario}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={s.color} stopOpacity={0.2} />
                          <stop offset="95%" stopColor={s.color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={TIP} />
                      <Area type="monotone" dataKey="value" stroke={s.color} strokeWidth={3}
                        fill={`url(#demo-grad-${activeScenario})`}
                        dot={{ fill: s.color, r: 4, strokeWidth: 0, cursor: 'pointer' }}
                        activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2, fill: s.color }}
                        animationDuration={1000} />
                    </AreaChart>
                  </ResponsiveContainer>
                  <p className="mt-3 text-[11px] text-vizme-greyblue bg-vizme-bg rounded-xl px-3 py-2 border border-vizme-navy/5">
                    <span className="font-semibold text-vizme-navy">Insight:</span> {s.lineInsight}
                  </p>
                </div>
              </div>
            )}

            {/* Charts row 2 */}
            {animate && (
              <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
                {/* Donut — clickable segments */}
                <div className="rounded-2xl border border-vizme-navy/8 bg-white p-5 hover:shadow-md transition-shadow">
                  <p className="text-xs font-bold text-vizme-navy mb-1">
                    {activeScenario === 'b2b' ? 'MRR por Plan' : activeScenario === 'logistica' ? 'Entregas por Ciudad' : 'Ventas por Region'}
                  </p>
                  <p className="text-[10px] text-vizme-greyblue mb-2">Distribucion porcentual</p>
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="50%" height={160}>
                      <PieChart>
                        <Pie data={s.pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                          dataKey="value" strokeWidth={0} animationDuration={800} cursor="pointer"
                          onClick={(_: any, idx: number) => setHighlightedPie(prev => prev === idx ? null : idx)}>
                          {s.pieData.map((entry, i) => (
                            <Cell key={i} fill={entry.color}
                              opacity={highlightedPie !== null && highlightedPie !== i ? 0.3 : 1}
                              style={{ transition: 'opacity 0.2s ease' }} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={TIP} formatter={(v: number) => [`${v}%`, 'Participacion']} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2 flex-1">
                      {s.pieData.map((r, i) => (
                        <div key={i}
                          onClick={() => setHighlightedPie(prev => prev === i ? null : i)}
                          className={`flex items-center gap-2 cursor-pointer rounded-lg px-2 py-1 transition-all ${
                            highlightedPie === i ? 'bg-vizme-bg' : 'hover:bg-vizme-bg/50'
                          }`}>
                          <div className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: r.color }} />
                          <span className={`text-[11px] flex-1 transition-colors ${highlightedPie === i ? 'text-vizme-navy font-semibold' : 'text-vizme-greyblue'}`}>{r.name}</span>
                          <span className="text-[11px] font-bold text-vizme-navy">{r.value}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Table — hover highlight */}
                <div className="rounded-2xl border border-vizme-navy/8 bg-white p-5 hover:shadow-md transition-shadow">
                  <p className="text-xs font-bold text-vizme-navy mb-1">Top 5 Clientes</p>
                  <p className="text-[10px] text-vizme-greyblue mb-4">Por volumen Q2</p>
                  <div className="space-y-1">
                    {s.topClientes.map((c, i) => (
                      <div key={i}
                        onMouseEnter={() => setHoveredRow(i)}
                        onMouseLeave={() => setHoveredRow(null)}
                        className={`flex items-center gap-3 py-2 px-2 rounded-xl border transition-all duration-150 ${
                          hoveredRow === i
                            ? 'border-vizme-red/20 bg-vizme-red/5 shadow-sm -translate-y-0.5'
                            : 'border-transparent'
                        }`}>
                        <span className={`text-[11px] font-black w-4 transition-colors ${hoveredRow === i ? 'text-vizme-red' : 'text-vizme-navy/20'}`}>{i + 1}</span>
                        <span className="text-xs text-vizme-navy font-medium flex-1 truncate">{c.name}</span>
                        <span className="text-xs font-bold text-vizme-navy">{c.monto}</span>
                        <span className={`text-[11px] font-semibold flex items-center gap-0.5 ${c.up ? 'text-emerald-600' : 'text-vizme-red'}`}>
                          {c.up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                          {c.cambio}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Executive Summary */}
            {animate && (
              <div className="rounded-2xl bg-vizme-navy p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 h-32 w-32 rounded-full bg-vizme-red/10 blur-2xl" />
                <div className="absolute -bottom-10 -left-10 h-24 w-24 rounded-full bg-vizme-orange/10 blur-2xl" />
                <div className="flex items-start gap-4 relative">
                  <div className="h-10 w-10 rounded-xl bg-vizme-red/20 border border-vizme-red/30 flex items-center justify-center flex-shrink-0">
                    <Brain size={18} className="text-vizme-red" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-vizme-red flex items-center gap-1.5">
                          <Sparkles size={9} /> Resumen Ejecutivo IA
                        </p>
                        <p className="text-base font-bold text-white mt-1">
                          {activeScenario === 'distribucion' ? 'Tu negocio crecio +44% en Q2 — 3 insights clave'
                            : activeScenario === 'b2b' ? 'MRR crecio 33% pero churn sube — atencion'
                            : 'Operaciones eficientes, capacidad al limite — planea expansion'}
                        </p>
                      </div>
                      <button onClick={() => setInsightsOpen(!insightsOpen)}
                        className="text-white/40 hover:text-white/80 transition-colors">
                        {insightsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>

                    {insightsOpen && (
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                        {s.insights.map((insight, i) => (
                          <div key={i} className="flex items-start gap-3 bg-white/5 rounded-xl px-3 py-2.5 hover:bg-white/8 transition-colors">
                            <span className="text-[10px] font-black text-vizme-red mt-0.5">{String(i + 1).padStart(2, '0')}</span>
                            <p className="text-xs text-white/70 leading-relaxed">{insight}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Pro locked sections */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-vizme-greyblue mb-3 flex items-center gap-2">
                <Lock size={11} />
                Disponible en Plan Pro
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                <LockedOverlay title="Analisis Interno"
                  description="Segmentacion de clientes, rentabilidad por producto, deteccion de anomalias y KPIs financieros." />
                <LockedOverlay title="Analisis Externo"
                  description="Benchmarks de industria, analisis competitivo, tendencias de mercado y factores macroeconomicos." />
                <LockedOverlay title="Predicciones IA"
                  description="Proyecciones de ventas, recomendaciones prescriptivas y analisis de escenarios para los proximos 90 dias." />
              </div>
            </div>

            {/* CTA */}
            <div className="rounded-2xl border border-vizme-red/15 p-6 flex flex-col sm:flex-row items-center justify-between gap-4"
              style={{ background: 'linear-gradient(135deg, rgba(245,74,67,0.03), rgba(242,106,61,0.03))' }}>
              <div>
                <p className="text-sm font-bold text-vizme-navy">Listo para analizar tus propios datos?</p>
                <p className="text-xs text-vizme-greyblue mt-0.5">Sube tu archivo y obtén tu dashboard en menos de 2 minutos.</p>
              </div>
              <Link to="/register"
                className="flex-shrink-0 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
                style={{ background: 'linear-gradient(135deg, #F54A43, #F26A3D)', boxShadow: '0 8px 24px rgba(245,74,67,0.3)' }}>
                Analiza tus datos
                <ArrowRight size={14} />
              </Link>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
};

export default InteractiveDemo;
