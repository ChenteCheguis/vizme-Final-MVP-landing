import React from 'react';
import { Star, TrendingUp, Clock, DollarSign } from 'lucide-react';

const testimonials = [
  {
    quote: 'Antes pagaba $25,000 al mes a un consultor para mis reportes de ventas. Ahora los tengo en minutos y me cuestan casi nada. La diferencia es brutal.',
    name: 'Carlos Mendoza',
    role: 'Director General',
    company: 'Distribuidora Norteño',
    city: 'Monterrey, NL',
    initials: 'CM',
    color: 'bg-vizme-red',
  },
  {
    quote: 'Mi contador tardaba 3 días en armarme el reporte mensual. Ahora lo tengo el mismo día que cierro el mes. Empecé a tomar decisiones con datos reales por primera vez.',
    name: 'Sofía Reyes',
    role: 'Fundadora',
    company: 'Clínica Integral Reyes',
    city: 'CDMX',
    initials: 'SR',
    color: 'bg-vizme-orange',
  },
  {
    quote: 'Pensé que esto era solo para empresas grandes con equipos de BI. Me equivoqué. En dos días ya tenía visibilidad de toda mi operación.',
    name: 'Arturo Villalobos',
    role: 'CEO',
    company: 'Constructora Villalobos e Hijos',
    city: 'Guadalajara, JAL',
    initials: 'AV',
    color: 'bg-vizme-navy',
  },
];

const metrics = [
  { icon: TrendingUp, value: '+200', label: 'PyMEs analizadas', color: 'text-vizme-red' },
  { icon: Clock,      value: '8 hrs', label: 'Ahorradas por semana en promedio', color: 'text-vizme-orange' },
  { icon: DollarSign, value: '$25K', label: 'En consultoría reemplazada al mes', color: 'text-vizme-navy' },
  { icon: Star,       value: '4.9/5', label: 'Satisfacción de usuarios', color: 'text-amber-500' },
];

const SocialProof: React.FC = () => {
  return (
    <section className="py-24 bg-vizme-bg border-t border-vizme-navy/5">
      <div className="mx-auto max-w-6xl px-4">

        {/* Impact metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          {metrics.map(({ icon: Icon, value, label, color }, i) => (
            <div key={i} className="rounded-2xl bg-white border border-vizme-navy/8 p-5 text-center hover:shadow-lg hover:shadow-vizme-navy/5 transition-all">
              <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-vizme-bg border border-vizme-navy/8 mb-3 ${color}`}>
                <Icon size={18} />
              </div>
              <p className="text-2xl font-black text-vizme-navy">{value}</p>
              <p className="text-[11px] text-vizme-greyblue mt-1 leading-tight">{label}</p>
            </div>
          ))}
        </div>

        {/* Testimonials header */}
        <div className="text-center mb-12">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-vizme-red mb-3 block">
            Lo que dicen nuestros clientes
          </span>
          <h2 className="text-3xl font-bold text-vizme-navy">
            Fundadores que tomaron el control<br />
            <span className="text-vizme-greyblue font-medium">de sus datos</span>
          </h2>
        </div>

        {/* Testimonial cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className="rounded-3xl bg-white border border-vizme-navy/8 p-6 flex flex-col hover:shadow-xl hover:shadow-vizme-navy/5 transition-all duration-300 hover:-translate-y-1"
            >
              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} size={13} className="text-amber-400 fill-amber-400" />
                ))}
              </div>

              {/* Quote */}
              <p className="text-sm text-vizme-greyblue leading-relaxed flex-1 mb-6">
                "{t.quote}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-3 pt-4 border-t border-vizme-navy/5">
                <div className={`h-10 w-10 rounded-full ${t.color} flex items-center justify-center flex-shrink-0`}>
                  <span className="text-xs font-bold text-white">{t.initials}</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-vizme-navy">{t.name}</p>
                  <p className="text-[11px] text-vizme-greyblue">{t.role} · {t.company}</p>
                  <p className="text-[10px] text-vizme-greyblue/60">{t.city}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Trust logos strip */}
        <div className="mt-14 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-vizme-greyblue/50 mb-6">
            Sectores que confían en Vizme
          </p>
          <div className="flex flex-wrap justify-center gap-6 opacity-40">
            {['Construcción', 'Retail', 'Restaurantes', 'Salud', 'Logística', 'Manufactura', 'E-commerce', 'Servicios'].map((sector) => (
              <span key={sector} className="text-xs font-bold text-vizme-navy uppercase tracking-wider">
                {sector}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default SocialProof;
