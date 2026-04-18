import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, CheckCircle2, Loader2, Sparkles, MapPin } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface OnboardingData {
  companyName: string;
  industryDetail: string;
  customIndustry: string;
  size: string;
  businessAddress: string;
  mainPains: string[];
  dataFrequency: string;
  expectations: string;
  dataAvailability: string;
  website: string;
}

const TOTAL_STEPS = 3;

const INDUSTRIES = [
  { key: 'Retail/Tienda',          emoji: '🏪', sub: 'Tienda física o en línea' },
  { key: 'Restaurante/Food',       emoji: '🍽', sub: 'Cocina, cafetería, food truck' },
  { key: 'Construcción',           emoji: '🏗', sub: 'Obra, inmobiliaria, materiales' },
  { key: 'Salud/Clínica',          emoji: '🏥', sub: 'Médicos, clínicas, wellness' },
  { key: 'Tech/Software',          emoji: '💻', sub: 'SaaS, apps, desarrollo' },
  { key: 'Distribución/Logística', emoji: '📦', sub: 'Cadena de suministro' },
  { key: 'Manufactura',            emoji: '🏭', sub: 'Producción, fábrica, maquila' },
  { key: 'Servicios Financieros',  emoji: '💰', sub: 'Crédito, seguros, inversión' },
  { key: 'Educación',              emoji: '📚', sub: 'Escuela, cursos, capacitación' },
  { key: 'E-commerce',             emoji: '🛍', sub: 'Venta online, marketplace' },
  { key: 'Hospitalidad',           emoji: '🏨', sub: 'Hotel, turismo, eventos' },
  { key: 'Otro',                   emoji: '⚙', sub: 'Otro tipo de negocio' },
];

const SIZES = [
  { key: '1-10',   label: '1–10 empleados',   sub: 'Micro empresa' },
  { key: '11-50',  label: '11–50 empleados',  sub: 'Pequeña empresa' },
  { key: '51-200', label: '51–200 empleados', sub: 'Mediana empresa' },
  { key: '200+',   label: '200+ empleados',   sub: 'Gran empresa' },
];

const PAINS = [
  'Mis ventas no crecen',
  'No sé qué productos me dejan más dinero',
  'No entiendo mis costos',
  'Quiero expandirme pero no sé a dónde',
  'Pierdo clientes y no sé por qué',
  'Mis datos están dispersos en Excel',
  'Nunca he analizado mis datos formalmente',
  'Quiero tomar mejores decisiones con datos',
];

const DATA_FREQUENCIES = ['Nunca', 'Rara vez', 'A veces', 'Siempre'];

const DATA_AVAILABILITIES = [
  { key: 'varios_anios',   label: 'Sí, tengo varios años de datos' },
  { key: 'menos_1_anio',  label: 'Tengo menos de 1 año de datos' },
  { key: 'solo_recientes', label: 'Solo tengo datos recientes' },
  { key: 'sin_ordenar',   label: 'No tengo datos ordenados aún' },
];

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

const OnboardingPage: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [data, setData] = useState<OnboardingData>({
    companyName: profile?.company_name ?? '',
    industryDetail: '',
    customIndustry: '',
    size: '',
    businessAddress: '',
    mainPains: [],
    dataFrequency: '',
    expectations: '',
    dataAvailability: '',
    website: '',
  });

  const update = (patch: Partial<OnboardingData>) =>
    setData((prev) => ({ ...prev, ...patch }));

  const togglePain = (p: string) => {
    const pains = data.mainPains;
    if (pains.includes(p)) {
      update({ mainPains: pains.filter((x) => x !== p) });
    } else if (pains.length < 2) {
      update({ mainPains: [...pains, p] });
    }
  };

  const canProceed = (): boolean => {
    if (step === 1) {
      const hasIndustry = data.industryDetail !== '' && (data.industryDetail !== 'Otro' || data.customIndustry.trim().length >= 2);
      return data.companyName.trim().length >= 2 && hasIndustry && data.size !== '';
    }
    if (step === 2) return data.mainPains.length > 0 && data.dataFrequency !== '';
    return data.dataAvailability !== '';
  };

  const handleComplete = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const resolvedIndustry = data.industryDetail === 'Otro' ? data.customIndustry.trim() : data.industryDetail;
      const companyContext = {
        industryDetail: resolvedIndustry,
        industryBroad: 'empresa',
        size: data.size,
        businessAddress: data.businessAddress.trim() || null,
        mainPains: data.mainPains,
        dataFrequency: data.dataFrequency,
        expectations: data.expectations,
        dataAvailability: data.dataAvailability,
        website: data.website.trim() || null,
      };
      // Core upsert with only guaranteed columns
      const upsertData: Record<string, unknown> = {
        id: user.id,
        email: user.email,
        full_name: profile?.full_name ?? user.user_metadata?.full_name ?? null,
        company_name: data.companyName,
        industry: 'empresa',
        onboarding_complete: true,
        company_context: companyContext,
        updated_at: new Date().toISOString(),
      };

      const { error: upsertError } = await supabase.from('profiles').upsert(upsertData);

      if (upsertError) {
        console.error('Upsert error:', upsertError);
        throw new Error(upsertError.message);
      }

      // Try to set business_address if column exists (V4 migration)
      if (data.businessAddress.trim()) {
        await supabase.from('profiles')
          .update({ business_address: data.businessAddress.trim() })
          .eq('id', user.id)
          .then(() => {/* ignore error if column doesn't exist */});
      }

      // Force full reload so AuthContext re-fetches the updated profile
      window.location.href = '/dashboard/projects';
    } catch (err: any) {
      console.error('Error saving onboarding:', err);
      alert('Error al guardar tu perfil: ' + (err?.message ?? 'Intenta de nuevo'));
      setSaving(false);
    }
  };

  const progress = ((step - 1) / (TOTAL_STEPS - 1)) * 100;

  return (
    <div className="min-h-screen bg-vizme-bg flex flex-col items-center justify-center px-4 py-12">

      {/* Header */}
      <div className="w-full max-w-xl mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xl font-bold uppercase tracking-[0.2em] text-vizme-navy">Vizme</span>
          <span className="text-xs text-vizme-greyblue font-medium">
            Paso <span className="text-vizme-navy font-semibold">{step}</span> de {TOTAL_STEPS}
          </span>
        </div>
        <div className="h-1.5 bg-vizme-navy/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-vizme-red rounded-full transition-all duration-500 ease-out"
            style={{ width: step === 1 ? '5%' : `${progress}%` }}
          />
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-xl bg-white rounded-3xl border border-vizme-navy/10 shadow-xl shadow-vizme-navy/5 p-8">

        {step === 1 && <Step1 data={data} update={update} />}
        {step === 2 && <Step2 data={data} togglePain={togglePain} update={update} />}
        {step === 3 && <Step3 data={data} update={update} />}

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
            onClick={() => step === TOTAL_STEPS ? handleComplete() : setStep((s) => s + 1)}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-vizme-red px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-vizme-red/25 hover:bg-vizme-orange transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : step === TOTAL_STEPS ? (
              <><Sparkles size={16} /><span>Crear mi primer proyecto</span></>
            ) : (
              <><span>Continuar</span><ArrowRight size={16} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Step 1: Company + Industry + Size ──────────────────────────────────────

const Step1: React.FC<{ data: OnboardingData; update: (p: Partial<OnboardingData>) => void }> = ({ data, update }) => {
  const cls = "w-full rounded-xl border border-vizme-navy/10 bg-vizme-bg px-4 py-3 text-sm text-vizme-navy placeholder-vizme-greyblue/40 focus:border-vizme-red focus:outline-none focus:ring-2 focus:ring-vizme-red/20 transition-all";
  return (
    <div>
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-vizme-red">Paso 1 de 3</span>
      <h2 className="mt-2 text-xl font-semibold text-vizme-navy">Cuéntanos sobre tu negocio</h2>
      <p className="mt-1 text-sm text-vizme-greyblue mb-6">Personalizamos todo tu análisis desde el primer día.</p>

      <div className="space-y-5">
        <div>
          <label className="block text-xs font-medium text-vizme-navy mb-1.5">Nombre de la empresa</label>
          <input
            value={data.companyName}
            onChange={(e) => update({ companyName: e.target.value })}
            placeholder="Mi Empresa SA de CV"
            className={cls}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-vizme-navy mb-1.5">
            Dirección del negocio <span className="text-vizme-greyblue font-normal">(opcional)</span>
          </label>
          <div className="relative">
            <MapPin size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-vizme-greyblue" />
            <input
              value={data.businessAddress}
              onChange={(e) => update({ businessAddress: e.target.value })}
              placeholder="Calle, colonia, ciudad, estado"
              className={cls + ' pl-9'}
            />
          </div>
          <p className="text-[9px] text-vizme-greyblue/60 mt-1">Nos ayuda a enriquecer tu análisis con datos de tu zona</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-vizme-navy mb-2">¿En qué industria operas?</label>
          <div className="grid grid-cols-3 gap-2">
            {INDUSTRIES.map(({ key, emoji, sub }) => (
              <button
                key={key}
                type="button"
                onClick={() => update({ industryDetail: key })}
                className={`p-3 rounded-2xl border-2 text-left transition-all ${
                  data.industryDetail === key
                    ? 'border-vizme-red bg-vizme-red/5'
                    : 'border-vizme-navy/10 hover:border-vizme-navy/20 bg-white'
                }`}
              >
                <div className="text-xl mb-1">{emoji}</div>
                <p className="text-[11px] font-semibold text-vizme-navy leading-tight">{key}</p>
                <p className="text-[9px] text-vizme-greyblue mt-0.5 leading-tight">{sub}</p>
              </button>
            ))}
          </div>

          {/* Custom industry input when "Otro" is selected */}
          {data.industryDetail === 'Otro' && (
            <div className="mt-3">
              <label className="block text-xs font-medium text-vizme-navy mb-1.5">
                Especifica tu industria o giro <span className="text-vizme-red">*</span>
              </label>
              <input
                value={data.customIndustry}
                onChange={(e) => update({ customIndustry: e.target.value })}
                placeholder="Ej: Agencia de publicidad, Consultoria ambiental, etc."
                className={cls}
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-vizme-navy mb-2">Tamaño de la empresa</label>
          <div className="grid grid-cols-2 gap-2">
            {SIZES.map(({ key, label, sub }) => (
              <button
                key={key}
                type="button"
                onClick={() => update({ size: key })}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  data.size === key
                    ? 'border-vizme-red bg-vizme-red/5'
                    : 'border-vizme-navy/10 hover:border-vizme-navy/20 bg-white'
                }`}
              >
                <p className="text-xs font-semibold text-vizme-navy">{label}</p>
                <p className="text-[10px] text-vizme-greyblue">{sub}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Step 2: Pain points + data maturity ────────────────────────────────────

const Step2: React.FC<{
  data: OnboardingData;
  togglePain: (p: string) => void;
  update: (p: Partial<OnboardingData>) => void;
}> = ({ data, togglePain, update }) => (
  <div>
    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-vizme-red">Paso 2 de 3</span>
    <h2 className="mt-2 text-xl font-semibold text-vizme-navy">¿Cuáles son tus dolores?</h2>
    <p className="mt-1 text-sm text-vizme-greyblue mb-6">Selecciona hasta 2. Esto define el foco de cada análisis.</p>

    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-vizme-navy">Mayor dolor hoy</label>
          <span className="text-[10px] text-vizme-greyblue">{data.mainPains.length}/2 seleccionados</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PAINS.map((pain) => {
            const selected = data.mainPains.includes(pain);
            const disabled = !selected && data.mainPains.length >= 2;
            return (
              <button
                key={pain}
                type="button"
                onClick={() => togglePain(pain)}
                disabled={disabled}
                className={`p-3 rounded-xl border-2 text-left text-xs font-medium transition-all ${
                  selected
                    ? 'border-vizme-red bg-vizme-red/5 text-vizme-navy'
                    : disabled
                    ? 'border-vizme-navy/5 bg-vizme-bg text-vizme-greyblue/50 cursor-not-allowed'
                    : 'border-vizme-navy/10 hover:border-vizme-navy/20 bg-white text-vizme-navy'
                }`}
              >
                {selected && <span className="mr-1">✓</span>}{pain}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-vizme-navy mb-2">
          ¿Con qué frecuencia tomas decisiones basadas en datos?
        </label>
        <div className="grid grid-cols-4 gap-2">
          {DATA_FREQUENCIES.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => update({ dataFrequency: f })}
              className={`py-2.5 rounded-xl border-2 text-xs font-medium transition-all ${
                data.dataFrequency === f
                  ? 'border-vizme-red bg-vizme-red/5 text-vizme-navy'
                  : 'border-vizme-navy/10 bg-white text-vizme-greyblue hover:border-vizme-navy/20'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// ─── Step 3: Expectations + data availability + smart summary ───────────────

const Step3: React.FC<{ data: OnboardingData; update: (p: Partial<OnboardingData>) => void }> = ({ data, update }) => {
  const cls = "w-full rounded-xl border border-vizme-navy/10 bg-vizme-bg px-4 py-3 text-sm text-vizme-navy placeholder-vizme-greyblue/40 focus:border-vizme-red focus:outline-none focus:ring-2 focus:ring-vizme-red/20 transition-all resize-none";

  const summaryLines: string[] = [];
  if (data.industryDetail) summaryLines.push(`Analizaremos datos de tu ${data.industryDetail.toLowerCase()} con benchmarks del sector en México.`);
  if (data.mainPains.length) summaryLines.push(`Cada análisis priorizará: "${data.mainPains[0]}".`);
  if (data.dataAvailability === 'varios_anios') summaryLines.push('Con tus datos históricos activaremos análisis predictivo.');
  else if (data.dataAvailability === 'sin_ordenar') summaryLines.push('Te guiaremos para ordenar tus datos desde cero.');

  return (
    <div>
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-vizme-red">Paso 3 de 3</span>
      <h2 className="mt-2 text-xl font-semibold text-vizme-navy">Últimos detalles</h2>
      <p className="mt-1 text-sm text-vizme-greyblue mb-6">Estás a un paso de tu dashboard personalizado.</p>

      <div className="space-y-5">
        <div>
          <label className="block text-xs font-medium text-vizme-navy mb-1.5">
            ¿Qué esperas lograr con Vizme? <span className="text-vizme-greyblue font-normal">(opcional)</span>
          </label>
          <textarea
            value={data.expectations}
            onChange={(e) => update({ expectations: e.target.value.slice(0, 200) })}
            placeholder="Ej: Quiero entender cuál de mis productos me deja más margen y tomar decisiones de precio con datos..."
            rows={3}
            className={cls}
          />
          <p className="text-right text-[10px] text-vizme-greyblue mt-1">{data.expectations.length}/200</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-vizme-navy mb-1.5">
            Pagina web o red social mas activa <span className="text-vizme-greyblue font-normal">(opcional)</span>
          </label>
          <input
            value={data.website}
            onChange={(e) => update({ website: e.target.value })}
            placeholder="Ej: www.miempresa.com o @miempresa en Instagram"
            className={cls}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-vizme-navy mb-2">¿Tienes datos historicos disponibles?</label>
          <div className="space-y-2">
            {DATA_AVAILABILITIES.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => update({ dataAvailability: key })}
                className={`w-full p-3 rounded-xl border-2 text-left text-xs font-medium transition-all ${
                  data.dataAvailability === key
                    ? 'border-vizme-red bg-vizme-red/5 text-vizme-navy'
                    : 'border-vizme-navy/10 bg-white text-vizme-navy hover:border-vizme-navy/20'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {summaryLines.length > 0 && (
          <div className="bg-vizme-navy/5 rounded-2xl p-4 border border-vizme-navy/10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-vizme-navy mb-2">Lo que hará Vizme por ti</p>
            <ul className="space-y-1.5">
              {summaryLines.map((line, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-vizme-greyblue">
                  <CheckCircle2 size={12} className="text-vizme-red flex-shrink-0 mt-0.5" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingPage;
