import React, { useState, useMemo } from 'react';
import { DollarSign, Clock, TrendingUp, Calculator, ArrowRight, Sparkles } from 'lucide-react';

// ─── ROI Calculator ─────────────────────────────────────────────────────────

const ROICalculator: React.FC = () => {
  const [revenue, setRevenue] = useState(500); // thousands MXN
  const [employees, setEmployees] = useState(10);
  const [hoursData, setHoursData] = useState(8); // hrs/week on data tasks

  const results = useMemo(() => {
    const monthlyRevenue = revenue * 1000;
    // Conservative estimates based on McKinsey/BCG SMB data studies
    const revenueGain = Math.round(monthlyRevenue * 0.05); // 5% revenue improvement
    const timeSaved = Math.round(hoursData * 0.7); // 70% time reduction
    const costPerHour = 250; // avg MXN/hr for analyst-level work
    const monthlySavings = timeSaved * 4 * costPerHour;
    const annualROI = (revenueGain + monthlySavings) * 12;
    const vizmeMonthly = 990; // Pro plan
    const roiMultiplier = Math.round((revenueGain + monthlySavings) / vizmeMonthly);

    return {
      revenueGain,
      timeSaved,
      monthlySavings,
      annualROI,
      roiMultiplier: Math.max(roiMultiplier, 1),
    };
  }, [revenue, employees, hoursData]);

  const fmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(0)}K` : `$${n.toLocaleString('es-MX')}`;

  return (
    <section className="py-20 bg-white relative overflow-hidden" id="roi">
      {/* Subtle bg pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #02222F 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

      <div className="mx-auto max-w-6xl px-4 relative z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full bg-vizme-red/8 px-3.5 py-1.5 text-[11px] font-semibold text-vizme-red mb-4">
            <Calculator size={12} /> Calculadora de ROI
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-vizme-navy tracking-tight">
            ¿Cuanto dinero te deja Vizme{' '}
            <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(90deg, #F54A43, #F26A3D)' }}>
              cada mes?
            </span>
          </h2>
          <p className="text-vizme-greyblue mt-3 max-w-lg mx-auto">
            Mueve los controles para ver cuanto ahorras con inteligencia de datos automatizada.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-10 items-start">
          {/* Sliders */}
          <div className="space-y-8 bg-vizme-bg rounded-2xl border border-vizme-navy/6 p-6 sm:p-8">
            {/* Revenue */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-vizme-navy">Facturacion mensual</label>
                <span className="text-sm font-bold text-vizme-red">${revenue.toLocaleString('es-MX')}K MXN</span>
              </div>
              <input
                type="range" min={50} max={5000} step={50}
                value={revenue}
                onChange={e => setRevenue(+e.target.value)}
                className="w-full h-2 bg-vizme-navy/10 rounded-full appearance-none cursor-pointer accent-vizme-red"
              />
              <div className="flex justify-between text-[9px] text-vizme-greyblue mt-1">
                <span>$50K</span><span>$5M</span>
              </div>
            </div>

            {/* Employees */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-vizme-navy">Empleados</label>
                <span className="text-sm font-bold text-vizme-red">{employees}</span>
              </div>
              <input
                type="range" min={1} max={200} step={1}
                value={employees}
                onChange={e => setEmployees(+e.target.value)}
                className="w-full h-2 bg-vizme-navy/10 rounded-full appearance-none cursor-pointer accent-vizme-red"
              />
              <div className="flex justify-between text-[9px] text-vizme-greyblue mt-1">
                <span>1</span><span>200+</span>
              </div>
            </div>

            {/* Hours on data */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-vizme-navy">Horas/semana en datos y reportes</label>
                <span className="text-sm font-bold text-vizme-red">{hoursData} hrs</span>
              </div>
              <input
                type="range" min={1} max={40} step={1}
                value={hoursData}
                onChange={e => setHoursData(+e.target.value)}
                className="w-full h-2 bg-vizme-navy/10 rounded-full appearance-none cursor-pointer accent-vizme-red"
              />
              <div className="flex justify-between text-[9px] text-vizme-greyblue mt-1">
                <span>1 hr</span><span>40 hrs</span>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="space-y-4">
            {/* ROI multiplier hero */}
            <div className="rounded-2xl p-6 text-center text-white relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #02222F, #0a3a4d)' }}>
              <div className="absolute top-0 right-0 w-40 h-40 bg-vizme-red/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-2">Retorno de inversion</p>
              <p className="text-5xl sm:text-6xl font-black" style={{ color: '#F54A43' }}>
                {results.roiMultiplier}x
              </p>
              <p className="text-sm text-white/60 mt-1">por cada peso invertido en Vizme</p>
            </div>

            {/* Metric cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                <DollarSign size={16} className="text-emerald-600 mb-2" />
                <p className="text-xl font-black text-vizme-navy">{fmt(results.revenueGain)}</p>
                <p className="text-[10px] text-vizme-greyblue mt-0.5">Ingreso adicional/mes</p>
              </div>
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
                <Clock size={16} className="text-blue-600 mb-2" />
                <p className="text-xl font-black text-vizme-navy">{results.timeSaved} hrs</p>
                <p className="text-[10px] text-vizme-greyblue mt-0.5">Ahorro semanal</p>
              </div>
              <div className="rounded-xl bg-purple-50 border border-purple-200 p-4">
                <TrendingUp size={16} className="text-purple-600 mb-2" />
                <p className="text-xl font-black text-vizme-navy">{fmt(results.monthlySavings)}</p>
                <p className="text-[10px] text-vizme-greyblue mt-0.5">Ahorro en nomina/mes</p>
              </div>
              <div className="rounded-xl bg-orange-50 border border-orange-200 p-4">
                <Sparkles size={16} className="text-vizme-orange mb-2" />
                <p className="text-xl font-black text-vizme-navy">{fmt(results.annualROI)}</p>
                <p className="text-[10px] text-vizme-greyblue mt-0.5">Impacto anual</p>
              </div>
            </div>

            {/* CTA */}
            <a
              href="/register"
              className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg, #F54A43, #F26A3D)', boxShadow: '0 4px 16px rgba(245,74,67,0.3)' }}
            >
              Empieza gratis y compruebalo
              <ArrowRight size={15} />
            </a>

            <p className="text-[9px] text-center text-vizme-greyblue">
              * Estimaciones basadas en estudios de McKinsey y BCG sobre adopcion de BI en PyMEs. Resultados reales varian.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ROICalculator;
