import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, ArrowLeft, CheckCircle2, Loader2, Sparkles,
  DollarSign, TrendingDown, Package, Users, Settings, UserCheck,
  Megaphone, BarChart2, Calendar, Target, Eye, Zap,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';

// ─────────────────────────────────────────────
// Types + Constants
// ─────────────────────────────────────────────

interface WizardData {
  name: string;
  analysisArea: string;
  period: string;
  mainQuestion: string;
  hypothesis: string;
  decisionToMake: string;
  dashboardFocus: string;
  audience: string;
  needsPredictions: boolean;
  preferredCharts: string[];
  location: string;
  state: string;
  businessAddress: string;
  competitors: string;
  seasonality: string;
  externalFactors: string[];
}

const CHART_TYPES = [
  { key: 'bar_horizontal', label: 'Barras', desc: 'Rankings y comparaciones', emoji: '📊' },
  { key: 'line',           label: 'Lineas', desc: 'Tendencias en el tiempo', emoji: '📈' },
  { key: 'area',           label: 'Area', desc: 'Volumen acumulado', emoji: '📉' },
  { key: 'donut',          label: 'Donut', desc: 'Distribucion porcentual', emoji: '🍩' },
  { key: 'scatter',        label: 'Dispersion', desc: 'Correlacion entre variables', emoji: '🔵' },
  { key: 'funnel',         label: 'Embudo', desc: 'Conversion y etapas', emoji: '🔻' },
  { key: 'treemap',        label: 'Treemap', desc: 'Composicion jerarquica', emoji: '🟩' },
  { key: 'heatmap',        label: 'Mapa de calor', desc: 'Intensidad en 2 dimensiones', emoji: '🟥' },
  { key: 'radar',          label: 'Radar', desc: 'Perfil multivariable', emoji: '🕸' },
  { key: 'waterfall',      label: 'Cascada', desc: 'Incrementos y decrementos', emoji: '🌊' },
];

const ANALYSIS_AREAS = [
  { key: 'Ventas y revenue',        icon: DollarSign,  sub: 'Ingresos, tickets, conversiones' },
  { key: 'Costos y gastos',         icon: TrendingDown, sub: 'Egresos, márgenes, eficiencia' },
  { key: 'Inventario y productos',  icon: Package,      sub: 'Stock, rotación, catalogo' },
  { key: 'Clientes y retención',    icon: Users,        sub: 'Churn, LTV, satisfacción' },
  { key: 'Operaciones y procesos',  icon: Settings,     sub: 'Eficiencia, productividad' },
  { key: 'Recursos humanos',        icon: UserCheck,    sub: 'Nómina, rotación, desempeño' },
  { key: 'Marketing y campañas',    icon: Megaphone,    sub: 'CAC, conversión, alcance' },
  { key: 'Financiero general',      icon: BarChart2,    sub: 'P&L, flujo de caja, balance' },
];

const PERIODS = [
  'Este mes', 'Este trimestre', 'Este año',
  'Múltiples períodos / histórico', 'No tengo fechas en mis datos',
];

const DECISIONS = [
  'Cambiar precios', 'Discontinuar productos', 'Abrir nueva región/sucursal',
  'Contratar o reducir personal', 'Cambiar estrategia de marketing',
  'Optimizar inventario', 'Presentar resultados a socios/inversores',
  'Solo quiero entender mis números',
];

const DASHBOARD_FOCUSES = [
  { key: 'tendencias',     label: 'Tendencias', sub: 'Evolución temporal, cómo cambia con el tiempo', icon: TrendingDown },
  { key: 'comparaciones',  label: 'Comparaciones', sub: 'Qué región/producto lidera vs el resto', icon: BarChart2 },
  { key: 'distribucion',   label: 'Distribución', sub: 'Cómo se reparte el negocio', icon: Package },
  { key: 'eficiencia',     label: 'Eficiencia', sub: 'Qué genera más con menos recursos', icon: Zap },
  { key: 'criterio_ia',    label: 'Criterio IA', sub: 'Vizme decide lo más relevante (recomendado)', icon: Sparkles },
];

const AUDIENCES = [
  { key: 'dueno',      label: 'Solo yo (dueño)' },
  { key: 'directivo',  label: 'Mi equipo directivo' },
  { key: 'socios',     label: 'Socios o inversores' },
  { key: 'operativo',  label: 'Mi equipo operativo' },
];

const EXTERNAL_FACTORS = [
  'Tipo de cambio USD/MXN', 'Precios de materias primas',
  'Temporadas/holidays', 'Tendencias de redes sociales',
  'Regulaciones gubernamentales', 'Clima o factores ambientales',
  'Ninguno en particular',
];

const MEXICAN_STATES = [
  'CDMX', 'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche',
  'Chiapas', 'Chihuahua', 'Coahuila', 'Colima', 'Durango', 'Estado de México',
  'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco', 'Michoacán', 'Morelos', 'Nayarit',
  'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí',
  'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán',
  'Zacatecas', 'Todo México', 'Más de un estado', 'Internacional',
];

const TOTAL_STEPS = 5;

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

const NewProjectWizard: React.FC = () => {
  const { user } = useAuth();
  const { loadProjects } = useProject();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [data, setData] = useState<WizardData>({
    name: '', analysisArea: '', period: '',
    mainQuestion: '', hypothesis: '', decisionToMake: '',
    dashboardFocus: 'criterio_ia', audience: 'dueno',
    needsPredictions: false, preferredCharts: [],
    location: '', state: '', businessAddress: '',
    competitors: '', seasonality: '', externalFactors: [],
  });

  const update = (patch: Partial<WizardData>) =>
    setData((prev) => ({ ...prev, ...patch }));

  const toggleFactor = (f: string) => {
    const list = data.externalFactors;
    update({ externalFactors: list.includes(f) ? list.filter((x) => x !== f) : [...list, f] });
  };

  const toggleChart = (c: string) => {
    const list = data.preferredCharts;
    update({ preferredCharts: list.includes(c) ? list.filter((x) => x !== c) : [...list, c] });
  };

  const canProceed = (): boolean => {
    if (step === 1) return data.name.trim().length >= 2 && data.analysisArea !== '' && data.period !== '';
    if (step === 2) return data.mainQuestion.trim().length >= 10 && data.decisionToMake !== '';
    if (step === 3) return data.audience !== '';
    return true; // steps 4 and 5 are optional
  };

  const handleCreate = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const locationStr = [data.businessAddress, data.state].filter(Boolean).join(', ') || 'México';
      const { data: created, error } = await supabase
        .from('projects')
        .insert({
          user_id: user.id,
          name: data.name.trim(),
          analysis_area: data.analysisArea,
          period: data.period,
          main_question: data.mainQuestion.trim(),
          hypothesis: data.hypothesis.trim() || null,
          decision_to_make: data.decisionToMake,
          dashboard_focus: data.dashboardFocus,
          audience: data.audience,
          needs_predictions: data.needsPredictions,
          location: locationStr,
          seasonality: data.seasonality || 'No especificada',
          external_factors: [...data.externalFactors, ...(data.preferredCharts.length ? [`preferred_charts:${data.preferredCharts.join(',')}`] : [])],
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;
      await loadProjects();
      navigate(`/dashboard/projects/${created.id}/data`);
    } catch (err) {
      console.error('Error creating project:', err);
    } finally {
      setSaving(false);
    }
  };

  const progress = ((step - 1) / (TOTAL_STEPS - 1)) * 100;

  const cls = "w-full rounded-xl border border-vizme-navy/10 bg-vizme-bg px-4 py-3 text-sm text-vizme-navy placeholder-vizme-greyblue/40 focus:border-vizme-red focus:outline-none focus:ring-2 focus:ring-vizme-red/20 transition-all";

  return (
    <div className="max-w-2xl mx-auto py-4">

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-vizme-greyblue">Nuevo Proyecto</p>
            <h1 className="text-xl font-bold text-vizme-navy mt-0.5">Paso {step} de {TOTAL_STEPS}</h1>
          </div>
          <button
            onClick={() => navigate('/dashboard/projects')}
            className="text-xs text-vizme-greyblue hover:text-vizme-navy transition-colors"
          >
            Cancelar
          </button>
        </div>
        <div className="h-1.5 bg-vizme-navy/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-vizme-red rounded-full transition-all duration-500 ease-out"
            style={{ width: step === 1 ? '5%' : `${progress}%` }}
          />
        </div>
      </div>

      {/* Card */}
      <div className="bg-white rounded-3xl border border-vizme-navy/10 shadow-xl shadow-vizme-navy/5 p-8">

        {/* ── Step 1: Identity ─── */}
        {step === 1 && (
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-vizme-red">Identidad del proyecto</span>
            <h2 className="mt-2 text-lg font-semibold text-vizme-navy">¿Qué vas a analizar?</h2>
            <p className="mt-1 text-sm text-vizme-greyblue mb-6">Define el alcance para que Vizme construya el dashboard correcto.</p>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-vizme-navy mb-1.5">Nombre del proyecto</label>
                <input
                  value={data.name}
                  onChange={(e) => update({ name: e.target.value })}
                  placeholder='Ej: "Ventas Q2 2026" o "Análisis de inventario"'
                  className={cls}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-vizme-navy mb-2">¿Que area del negocio te importa mas?</label>
                <div className="grid grid-cols-2 gap-2">
                  {ANALYSIS_AREAS.map(({ key, icon: Icon, sub }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => update({ analysisArea: key })}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                        data.analysisArea === key
                          ? 'border-vizme-red bg-vizme-red/5'
                          : 'border-vizme-navy/10 hover:border-vizme-navy/20 bg-white'
                      }`}
                    >
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        data.analysisArea === key ? 'bg-vizme-red text-white' : 'bg-vizme-bg text-vizme-greyblue'
                      }`}>
                        <Icon size={14} />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-vizme-navy">{key}</p>
                        <p className="text-[10px] text-vizme-greyblue">{sub}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-vizme-navy mb-2">¿Qué período vas a analizar?</label>
                <div className="grid grid-cols-2 gap-2">
                  {PERIODS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => update({ period: p })}
                      className={`p-2.5 rounded-xl border-2 text-xs font-medium text-left transition-all ${
                        data.period === p
                          ? 'border-vizme-red bg-vizme-red/5 text-vizme-navy'
                          : 'border-vizme-navy/10 bg-white text-vizme-greyblue hover:border-vizme-navy/20'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: The problem ─── */}
        {step === 2 && (
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-vizme-red">El problema específico</span>
            <h2 className="mt-2 text-lg font-semibold text-vizme-navy">¿Qué quieres descubrir?</h2>
            <p className="mt-1 text-sm text-vizme-greyblue mb-6">Esta es la pregunta mas importante. Vizme la usara como norte de todo el analisis.</p>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-vizme-navy mb-1.5">
                  Pregunta principal que quieres responder <span className="text-vizme-red">*</span>
                </label>
                <textarea
                  value={data.mainQuestion}
                  onChange={(e) => update({ mainQuestion: e.target.value.slice(0, 300) })}
                  placeholder="Ej: ¿Por qué bajaron mis ventas en marzo? / ¿Cuál es mi producto más rentable? / ¿En qué región debo enfocarme?"
                  rows={3}
                  className={`${cls} resize-none`}
                />
                <div className="flex justify-between mt-1">
                  <p className="text-[10px] text-vizme-greyblue">Sé específico — más contexto = mejor análisis</p>
                  <p className="text-[10px] text-vizme-greyblue">{data.mainQuestion.length}/300</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-vizme-navy mb-1.5">
                  ¿Ya tienes una hipótesis o sospecha? <span className="text-vizme-greyblue font-normal">(opcional)</span>
                </label>
                <textarea
                  value={data.hypothesis}
                  onChange={(e) => update({ hypothesis: e.target.value.slice(0, 200) })}
                  placeholder='Ej: "Creo que el problema es que mis precios son muy altos vs la competencia"'
                  rows={2}
                  className={`${cls} resize-none`}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-vizme-navy mb-2">
                  ¿Qué decisión vas a tomar con este análisis? <span className="text-vizme-red">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {DECISIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => update({ decisionToMake: d })}
                      className={`p-3 rounded-xl border-2 text-xs font-medium text-left transition-all ${
                        data.decisionToMake === d
                          ? 'border-vizme-red bg-vizme-red/5 text-vizme-navy'
                          : 'border-vizme-navy/10 bg-white text-vizme-greyblue hover:border-vizme-navy/20'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Dashboard config ─── */}
        {step === 3 && (
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-vizme-red">Configuración del dashboard</span>
            <h2 className="mt-2 text-lg font-semibold text-vizme-navy">¿Cómo quieres ver tus datos?</h2>
            <p className="mt-1 text-sm text-vizme-greyblue mb-6">Esto define el estilo visual y el nivel de detalle del dashboard.</p>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-vizme-navy mb-2">Enfoque del dashboard</label>
                <div className="space-y-2">
                  {DASHBOARD_FOCUSES.map(({ key, label, sub, icon: Icon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => update({ dashboardFocus: key })}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                        data.dashboardFocus === key
                          ? 'border-vizme-red bg-vizme-red/5'
                          : 'border-vizme-navy/10 bg-white hover:border-vizme-navy/20'
                      }`}
                    >
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        data.dashboardFocus === key ? 'bg-vizme-red text-white' : 'bg-vizme-bg text-vizme-greyblue'
                      }`}>
                        <Icon size={14} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-vizme-navy">{label}</p>
                        <p className="text-[10px] text-vizme-greyblue">{sub}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-vizme-navy mb-2">¿Para quién es este dashboard?</label>
                <div className="grid grid-cols-2 gap-2">
                  {AUDIENCES.map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => update({ audience: key })}
                      className={`p-3 rounded-xl border-2 text-xs font-medium text-center transition-all ${
                        data.audience === key
                          ? 'border-vizme-red bg-vizme-red/5 text-vizme-navy'
                          : 'border-vizme-navy/10 bg-white text-vizme-greyblue hover:border-vizme-navy/20'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-vizme-navy mb-2">
                  ¿Hay alguna grafica que te importe mas que otra? <span className="text-vizme-greyblue font-normal">(opcional)</span>
                </label>
                <p className="text-[10px] text-vizme-greyblue mb-3">Selecciona las que quieras en tu dashboard. Si no seleccionas ninguna, Vizme decide.</p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {CHART_TYPES.map(({ key, label, desc, emoji }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleChart(key)}
                      className={`p-2.5 rounded-xl border-2 text-center transition-all ${
                        data.preferredCharts.includes(key)
                          ? 'border-vizme-red bg-vizme-red/5'
                          : 'border-vizme-navy/10 bg-white hover:border-vizme-navy/20'
                      }`}
                    >
                      <div className="text-lg mb-0.5">{emoji}</div>
                      <p className="text-[10px] font-semibold text-vizme-navy">{label}</p>
                      <p className="text-[8px] text-vizme-greyblue leading-tight">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                data.needsPredictions
                  ? 'border-vizme-red bg-vizme-red/5'
                  : 'border-vizme-navy/10 bg-white hover:border-vizme-navy/20'
              }`}
                onClick={() => update({ needsPredictions: !data.needsPredictions })}
              >
                <div className="flex items-start gap-3">
                  <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    data.needsPredictions ? 'border-vizme-red bg-vizme-red' : 'border-vizme-navy/20'
                  }`}>
                    {data.needsPredictions && <CheckCircle2 size={12} className="text-white" />}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-vizme-navy">Quiero proyecciones a futuro</p>
                    <p className="text-[10px] text-vizme-greyblue mt-0.5">
                      Se activa cuando tienes 3+ períodos de datos históricos. Si aún no los tienes, se habilitará automáticamente después.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 4: External context ─── */}
        {step === 4 && (
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-vizme-red">Contexto externo</span>
            <h2 className="mt-2 text-lg font-semibold text-vizme-navy">¿Dónde opera tu negocio?</h2>
            <p className="mt-1 text-sm text-vizme-greyblue mb-6">El contexto local y sectorial mejora la precisión de las recomendaciones. Todo es opcional.</p>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-vizme-navy mb-1.5">Direccion del negocio <span className="text-vizme-greyblue font-normal">(opcional)</span></label>
                <input
                  value={data.businessAddress}
                  onChange={(e) => update({ businessAddress: e.target.value })}
                  placeholder="Ej: Av. Constituyentes 1000, Col. Centro, Monterrey, NL"
                  className={cls}
                />
                <p className="text-[10px] text-vizme-greyblue mt-1">Nos ayuda a darte contexto local mas preciso y analisis de competidores cercanos.</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-vizme-navy mb-1.5">Estado / Region principal</label>
                <select value={data.state} onChange={(e) => update({ state: e.target.value })} className={cls}>
                  <option value="">Seleccionar estado...</option>
                  {MEXICAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-vizme-navy mb-1.5">
                  ¿Tu negocio tiene estacionalidad?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['Sí, meses buenos y malos', 'No, es estable', 'No lo sé'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => update({ seasonality: s })}
                      className={`p-2.5 rounded-xl border-2 text-[11px] font-medium text-center transition-all ${
                        data.seasonality === s
                          ? 'border-vizme-red bg-vizme-red/5 text-vizme-navy'
                          : 'border-vizme-navy/10 bg-white text-vizme-greyblue hover:border-vizme-navy/20'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-vizme-navy mb-2">
                  Factores externos que afectan tu negocio
                </label>
                <div className="flex flex-wrap gap-2">
                  {EXTERNAL_FACTORS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => toggleFactor(f)}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-medium border transition-all ${
                        data.externalFactors.includes(f)
                          ? 'bg-vizme-navy text-white border-vizme-navy'
                          : 'bg-white text-vizme-greyblue border-vizme-navy/10 hover:border-vizme-navy/30'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-vizme-navy mb-1.5">
                  Competidores principales <span className="text-vizme-greyblue font-normal">(opcional)</span>
                </label>
                <input
                  value={data.competitors}
                  onChange={(e) => update({ competitors: e.target.value })}
                  placeholder="Ej: Empresa A, Empresa B, marcas del mismo nicho..."
                  className={cls}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 5: Summary ─── */}
        {step === 5 && (
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-vizme-red">Resumen del proyecto</span>
            <h2 className="mt-2 text-lg font-semibold text-vizme-navy">Todo listo para empezar</h2>
            <p className="mt-1 text-sm text-vizme-greyblue mb-6">Esto es lo que Vizme va a construir para ti.</p>

            <div className="bg-white rounded-2xl border border-vizme-navy/10 p-5 space-y-3 mb-5 shadow-sm">
              <SummaryRow label="Proyecto" value={data.name} />
              <SummaryRow label="Area de analisis" value={data.analysisArea} />
              <SummaryRow label="Periodo" value={data.period} />
              <SummaryRow label="Pregunta principal" value={data.mainQuestion} />
              <SummaryRow label="Decision a tomar" value={data.decisionToMake} />
              <SummaryRow label="Dashboard" value={DASHBOARD_FOCUSES.find((f) => f.key === data.dashboardFocus)?.label ?? ''} />
              <SummaryRow label="Audiencia" value={AUDIENCES.find((a) => a.key === data.audience)?.label ?? ''} />
              {data.businessAddress && <SummaryRow label="Direccion" value={data.businessAddress} />}
              {data.state && <SummaryRow label="Region" value={data.state} />}
              {data.preferredCharts.length > 0 && <SummaryRow label="Graficas preferidas" value={data.preferredCharts.length + ' seleccionadas'} />}
              {data.needsPredictions && <SummaryRow label="Predicciones" value="Activadas cuando haya 3+ periodos" />}
            </div>

            <div className="bg-vizme-navy rounded-2xl p-5">
              <p className="text-sm font-bold text-white mb-3">Lo que Vizme generara para ti:</p>
              <ul className="space-y-2.5">
                <li className="flex items-start gap-2.5 text-sm text-white leading-relaxed">
                  <CheckCircle2 size={14} className="text-vizme-red flex-shrink-0 mt-0.5" />
                  <span>Dashboard con graficas optimizadas para <strong>{data.analysisArea}</strong></span>
                </li>
                <li className="flex items-start gap-2.5 text-sm text-white leading-relaxed">
                  <CheckCircle2 size={14} className="text-vizme-red flex-shrink-0 mt-0.5" />
                  <span>Analisis enfocado en: <strong>"{data.mainQuestion}"</strong></span>
                </li>
                <li className="flex items-start gap-2.5 text-sm text-white leading-relaxed">
                  <CheckCircle2 size={14} className="text-vizme-red flex-shrink-0 mt-0.5" />
                  <span>Recomendaciones accionables conectadas con tu decision</span>
                </li>
                {data.needsPredictions && (
                  <li className="flex items-start gap-2.5 text-sm text-white leading-relaxed">
                    <CheckCircle2 size={14} className="text-vizme-red flex-shrink-0 mt-0.5" />
                    <span>Proyecciones cuando tengas 3+ periodos de datos</span>
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 mt-8">
          {step > 1 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex items-center gap-2 rounded-xl border border-vizme-navy/10 px-5 py-3 text-sm font-medium text-vizme-navy hover:bg-vizme-bg transition-colors"
            >
              <ArrowLeft size={15} />
              Anterior
            </button>
          )}
          <button
            disabled={!canProceed() || saving}
            onClick={() => step === TOTAL_STEPS ? handleCreate() : setStep((s) => s + 1)}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-vizme-red px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-vizme-red/25 hover:bg-vizme-orange transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : step === TOTAL_STEPS ? (
              <><Sparkles size={16} /><span>Crear proyecto y subir mis datos</span></>
            ) : (
              <><span>Continuar</span><ArrowRight size={16} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const SummaryRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between items-start gap-4 text-xs py-1.5 border-b border-vizme-navy/5 last:border-0">
    <span className="text-vizme-greyblue flex-shrink-0">{label}</span>
    <span className="font-medium text-vizme-navy text-right">{value}</span>
  </div>
);

export default NewProjectWizard;
