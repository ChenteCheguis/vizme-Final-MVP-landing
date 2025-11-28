import React from 'react';
import { Database, BarChart3, BrainCircuit, Rocket } from 'lucide-react';
import { Feature } from '../types';

const features: Feature[] = [
  {
    step: "01",
    title: "Entendimiento + Conexión",
    description: "Conectamos con tu realidad.",
    detail: "Partimos por entender tu negocio y cómo fluye tu información. Nos conectamos a cualquier fuente (Excel, CRM, Ads, e-commerce, finanzas, inventarios) y estructuramos todo para que tengas una base clara, sin enredos ni procesos manuales.",
    icon: Database
  },
  {
    step: "02",
    title: "Diseño Inteligente",
    description: "Solo lo que importa.",
    detail: "No hacemos dashboards infinitos. Diseñamos vistas claras que responden preguntas de negocio en segundos, sin ruido visual y sin perder tiempo explorando datos.",
    icon: BarChart3
  },
  {
    step: "03",
    title: "Análisis Predictivo",
    description: "Ve un paso adelante.",
    detail: "Nuestra IA analiza tus datos para ayudarte a anticipar riesgos y encontrar oportunidades antes de que otros las vean. Entiendes qué está pasando hoy y qué viene mañana.",
    icon: BrainCircuit
  },
  {
    step: "04",
    title: "Ejecución Guiada",
    description: "Alineamos decisiones con tus objetivos.",
    detail: "A partir de tus datos, definimos recomendaciones claras para asegurar foco, eficiencia y alineación entre equipos. Creando rendimiento real y duradero.",
    icon: Rocket
  }
];

const Features: React.FC = () => {
  return (
    <section id="como-funciona" className="py-24 bg-white relative border-t border-vizme-grey/20">
      <div className="mx-auto max-w-6xl px-4">
        
        <div className="mb-20 text-center max-w-3xl mx-auto">
          <span className="mb-4 inline-block text-xs font-bold uppercase tracking-[0.2em] text-vizme-red">
            Nuestra Metodología
          </span>
          <h2 className="text-3xl font-semibold text-vizme-navy sm:text-4xl mb-6">
            Consultoría de alto nivel, <br />
            <span className="text-vizme-greyblue">simplificada para tu día a día.</span>
          </h2>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4 relative">
          {/* Connector Line (Desktop) */}
          <div className="hidden lg:block absolute top-12 left-0 w-full h-0.5 bg-gradient-to-r from-vizme-navy/0 via-vizme-navy/10 to-vizme-navy/0 -z-10"></div>

          {features.map((f, i) => (
            <div key={i} className="group relative bg-vizme-bg border border-vizme-grey/20 p-6 rounded-2xl hover:bg-white hover:border-vizme-red/40 hover:shadow-xl hover:shadow-vizme-navy/5 transition-all duration-300 hover:-translate-y-1">
              <div className="h-12 w-12 rounded-xl bg-white border border-vizme-grey/20 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:border-vizme-red/50 group-hover:text-vizme-red transition-all shadow-sm">
                <f.icon size={24} className="text-vizme-greyblue group-hover:text-vizme-red" />
              </div>
              
              <div className="absolute top-6 right-6 text-[40px] font-bold text-vizme-grey/20 leading-none select-none">
                {f.step}
              </div>

              <h3 className="mb-2 text-lg font-bold text-vizme-navy">{f.title}</h3>
              <p className="mb-4 text-xs font-semibold text-vizme-red uppercase tracking-wide">{f.description}</p>
              <p className="text-sm leading-relaxed text-vizme-greyblue group-hover:text-vizme-navy transition-colors">
                {f.detail}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};

export default Features;