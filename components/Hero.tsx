import React, { useState, useEffect } from 'react';
import { ArrowRight, TrendingUp, AlertCircle, Zap, Building2, Users, Palette, CheckCircle2 } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, CartesianGrid } from 'recharts';

// Data scenarios
// Colors updated: Empresa is now ORANGE (#F26A3D) as requested.
const scenarios = {
  empresa: {
    label: "Empresa SaaS",
    color: "#F26A3D", // Orange
    icon: Building2,
    kpis: [
      { label: "MRR Proyectado", value: "$42.5K", trend: "+12%", trendUp: true, sub: "vs mes anterior" },
      { label: "Churn Risk", value: "8 Ctas", trend: "Alerta Alta", trendUp: false, sub: "Requiere atención" },
      { label: "LTV Promedio", value: "$3,200", trend: "Estable", trendUp: true, sub: "Últimos 90 días" }
    ],
    insight: "Detectamos que los clientes del plan 'Pro' tienen un 40% más de riesgo de fuga en el mes 4. Lanza una campaña de fidelización el día 90.",
    chartData: [
      { name: 'S1', value: 32000 }, { name: 'S2', value: 34500 }, { name: 'S3', value: 33000 },
      { name: 'S4', value: 38000 }, { name: 'S5', value: 36500 }, { name: 'S6', value: 42500 }, { name: 'S7', value: 44000 }
    ]
  },
  influencer: {
    label: "Influencer / Creador",
    color: "#F54A43", // Red
    icon: Users,
    kpis: [
      { label: "Engagement", value: "8.4%", trend: "+2.1%", trendUp: true, sub: "Mejor que el promedio" },
      { label: "Mejor Hora", value: "18:30", trend: "Jueves", trendUp: true, sub: "Para Reels y TikTok" },
      { label: "Marcas", value: "5 Activas", trend: "Pipeline", trendUp: true, sub: "En negociación" }
    ],
    insight: "Tus 'Stories' de estilo de vida tienen un 3x más de conversión para marcas de moda que tus posts del feed. Prioriza ese formato para la campaña de Nike.",
    chartData: [
      { name: 'Lun', value: 12000 }, { name: 'Mar', value: 15000 }, { name: 'Mie', value: 18000 },
      { name: 'Jue', value: 28000 }, { name: 'Vie', value: 24000 }, { name: 'Sab', value: 32000 }, { name: 'Dom', value: 35000 }
    ]
  },
  artista: {
    label: "Artista Visual",
    color: "#02222F", // Navy for contrast
    icon: Palette,
    kpis: [
      { label: "Ventas Obra", value: "$8,400", trend: "+5%", trendUp: true, sub: "Colección 'Void'" },
      { label: "Stock Crítico", value: "2 Obras", trend: "Bajo", trendUp: false, sub: "Serie limitada" },
      { label: "Canal Top", value: "Instagram", trend: "65% Conv.", trendUp: true, sub: "Fuente principal" }
    ],
    insight: "Las obras de formato mediano (50x70) se venden un 50% más rápido en tu web que en galería física. Aumenta la producción de ese tamaño.",
    chartData: [
      { name: 'Ene', value: 4000 }, { name: 'Feb', value: 3500 }, { name: 'Mar', value: 6000 },
      { name: 'Abr', value: 5500 }, { name: 'May', value: 8000 }, { name: 'Jun', value: 7500 }, { name: 'Jul', value: 9200 }
    ]
  }
};

const Hero: React.FC = () => {
  const [activePersona, setActivePersona] = useState<keyof typeof scenarios>('empresa');
  const currentScenario = scenarios[activePersona];
  const [animateChart, setAnimateChart] = useState(false);

  useEffect(() => {
    setAnimateChart(false);
    const timer = setTimeout(() => setAnimateChart(true), 100);
    return () => clearTimeout(timer);
  }, [activePersona]);

  const formatCurrency = (value: number) => {
    if (activePersona === 'influencer') return value.toLocaleString();
    return `$${value.toLocaleString()}`;
  };

  return (
    <section className="relative overflow-hidden pt-32 pb-20 lg:pt-40 lg:pb-32 bg-vizme-bg">
      
      {/* Background Blobs - Cyan & Purple/Red as requested, NO GRID */}
      <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-cyan-400/20 blur-[100px] animate-blob mix-blend-multiply"></div>
      <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-purple-400/20 blur-[100px] animate-blob animate-delay-2000 mix-blend-multiply"></div>

      <div className="mx-auto max-w-7xl px-4 relative z-10">
        <div className="grid gap-16 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          
          {/* Left: Sales Copy */}
          <div className="space-y-8 animate-fade-in text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-vizme-navy/10 bg-white/60 px-3 py-1 text-[11px] font-medium text-vizme-navy backdrop-blur-sm mx-auto lg:mx-0 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-vizme-red opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-vizme-red"></span>
              </span>
              Startup de Business Intelligence + IA aplicada
            </div>

            <h1 className="text-4xl font-semibold tracking-tight text-vizme-navy sm:text-5xl lg:text-6xl leading-[1.1]">
              Decisiones claras <br className="hidden lg:block"/>
              {/* Text updated to solid Orange */}
              <span className="text-vizme-orange">
                hechas con datos.
              </span>
            </h1>

            <p className="max-w-xl text-lg text-vizme-greyblue leading-relaxed mx-auto lg:mx-0">
              Vizme no es una herramienta más. Es un <strong>proceso de inteligencia</strong> que limpia tus datos, identifica oportunidades y te muestra, sin adornos, dónde está el verdadero crecimiento.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <a href="#cta" className="inline-flex items-center justify-center gap-2 rounded-full bg-vizme-red px-8 py-4 text-sm font-bold text-white hover:bg-vizme-orange transition-colors shadow-lg shadow-vizme-red/30 transform hover:-translate-y-0.5 duration-200">
                Analizar mi potencial
                <ArrowRight size={16} />
              </a>
              <a href="#como-funciona" className="inline-flex items-center justify-center gap-2 rounded-full border border-vizme-navy/20 bg-white px-8 py-4 text-sm font-semibold text-vizme-navy hover:bg-white/80 transition-colors shadow-sm">
                Nuestra metodología
              </a>
            </div>

            <div className="pt-6 border-t border-vizme-navy/5 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start text-xs text-vizme-greyblue">
              <span className="flex items-center gap-2"><CheckCircle2 size={14} className="text-vizme-navy"/> Sin configuraciones complejas</span>
              <span className="flex items-center gap-2"><CheckCircle2 size={14} className="text-vizme-navy"/> Reportes estratégicos</span>
              <span className="flex items-center gap-2"><CheckCircle2 size={14} className="text-vizme-navy"/> Decisiones fundamentadas</span>
            </div>
          </div>

          {/* Right: Interactive Dashboard Simulator */}
          <div className="relative w-full">
            
            {/* Persona Switcher Tabs */}
            <div className="flex justify-center lg:justify-end mb-4 gap-2">
              {(Object.keys(scenarios) as Array<keyof typeof scenarios>).map((key) => {
                 const isActive = activePersona === key;
                 const ScenIcon = scenarios[key].icon;
                 return (
                   <button
                    key={key}
                    onClick={() => setActivePersona(key)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all duration-300 border ${
                      isActive 
                      ? 'bg-vizme-navy text-white border-vizme-navy shadow-lg' 
                      : 'bg-white border-vizme-navy/10 text-vizme-greyblue hover:text-vizme-navy hover:border-vizme-navy/30'
                    }`}
                   >
                     <ScenIcon size={14} className={isActive ? 'text-white' : ''} />
                     {key.charAt(0).toUpperCase() + key.slice(1)}
                   </button>
                 )
              })}
            </div>

            {/* The Dashboard Card */}
            <div className="group relative transition-all duration-500">
                {/* Glow effect matching chart color */}
                <div 
                  className="absolute -inset-0.5 rounded-3xl opacity-20 blur-xl group-hover:opacity-30 transition-all duration-500"
                  style={{ background: `linear-gradient(to right, ${currentScenario.color}, transparent)` }}
                ></div>
                
                <div className="glass-panel relative overflow-hidden rounded-2xl p-5 sm:p-6 shadow-2xl bg-white">
                  
                  {/* Dashboard Header */}
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      {/* Logo Container REMOVED as requested */}
                      <div>
                        <h3 className="text-sm font-semibold text-vizme-navy">Vista General: {currentScenario.label}</h3>
                        <p className="text-[10px] text-vizme-greyblue">Datos actualizados en tiempo real</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-vizme-red opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-vizme-red"></span>
                      </span>
                      <span className="text-[10px] font-mono text-vizme-red uppercase font-bold">Live</span>
                    </div>
                  </div>

                  {/* KPIs */}
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    {currentScenario.kpis.map((kpi, i) => (
                      <div key={i} className="rounded-xl bg-vizme-bg/50 border border-vizme-navy/5 p-3 flex flex-col justify-between hover:border-vizme-navy/10 transition-colors">
                        <span className="text-[10px] text-vizme-greyblue font-medium uppercase truncate">{kpi.label}</span>
                        <div className="my-1 overflow-hidden">
                          {/* Mobile Fix: Adjusted font sizes (text-xs sm:text-xl) to fit 'Instagram' */}
                          <span className="text-xs sm:text-xl font-bold text-vizme-navy block tracking-tight truncate" title={kpi.value}>
                            {kpi.value}
                          </span>
                        </div>
                        <div className={`text-[10px] font-medium flex items-center gap-1 ${kpi.trendUp ? 'text-emerald-600' : 'text-vizme-red'}`}>
                           {kpi.trendUp ? <TrendingUp size={10} /> : <AlertCircle size={10} />}
                           {kpi.trend}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Dynamic Chart */}
                  <div className="h-48 w-full mb-6 relative rounded-xl bg-white border border-gray-100 p-2 overflow-hidden shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">
                    <div className="absolute top-2 left-4 z-10 text-[10px] text-vizme-greyblue font-medium">Tendencia (Último periodo)</div>
                    
                    {animateChart && (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={currentScenario.chartData}>
                          <defs>
                            <linearGradient id={`gradient-${activePersona}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={currentScenario.color} stopOpacity={0.2}/>
                              <stop offset="95%" stopColor={currentScenario.color} stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', fontSize: '12px', borderRadius: '8px', color: '#02222F', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                            itemStyle={{ color: '#02222F', fontWeight: 600 }}
                            cursor={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                            formatter={(value: number) => [formatCurrency(value), "Valor"]}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="value" 
                            stroke={currentScenario.color} 
                            strokeWidth={3} 
                            fillOpacity={1} 
                            fill={`url(#gradient-${activePersona})`} 
                            animationDuration={1000}
                            animationEasing="ease-out"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  {/* AI Insight Box */}
                  <div className="rounded-xl bg-vizme-bg border border-vizme-navy/5 p-4 flex gap-3 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-vizme-navy"></div>
                    <div className="mt-0.5 min-w-[24px]">
                      <div className="h-6 w-6 rounded-full bg-white border border-vizme-navy/10 flex items-center justify-center text-vizme-navy shadow-sm">
                        <Zap size={14} className="fill-current" />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-vizme-navy mb-1 flex items-center gap-2">
                        IA Insight Detectado
                      </p>
                      <p className="text-xs text-vizme-greyblue leading-relaxed">
                        {currentScenario.insight}
                      </p>
                    </div>
                  </div>

                </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default Hero;