import React from 'react';
import { Persona } from '../types';
import { Building2, Users, Palette, CheckCircle2 } from 'lucide-react';

const personas: (Persona & { icon: any })[] = [
  {
    title: "Empresas & Startups",
    subtitle: "Que buscan rentabilidad.",
    description: "Deja de operar a ciegas. Vizme te muestra qué líneas de negocio generan margen y tu proyección real de cierre.",
    metrics: ["Forecast de ventas", "Churn prediction", "Eficiencia operativa"],
    gradient: "from-vizme-navy/5 via-vizme-navy/0 to-transparent",
    icon: Building2
  },
  {
    title: "Influencers & Creadores",
    subtitle: "Que quieren crecer con intención.",
    description: "Entiende qué contenido te hace crecer, qué formatos atraen marcas y dónde se estanca tu comunidad.",
    metrics: ["Rendimiento por formato", "Mejores slots de marca", "Grow vs burnout"],
    gradient: "from-vizme-red/5 via-vizme-red/0 to-transparent",
    icon: Users
  },
  {
    title: "Artistas & Proyectos Creativos",
    subtitle: "El arte es intangible. El mercado no.",
    description: "Protege tu proceso creativo con decisiones comerciales frías. Entiende quién compra, por qué compra y cuánto están dispuestos a pagar.",
    metrics: ["Mix de portafolio", "Elasticidad de precios", "Canales de conversión"],
    gradient: "from-vizme-orange/5 via-vizme-orange/0 to-transparent",
    icon: Palette
  }
];

const Audience: React.FC = () => {
  return (
    <section id="para-quien" className="py-24 bg-vizme-bg relative overflow-hidden">
      {/* Subtle Background Blobs */}
      <div className="absolute top-1/2 left-0 w-96 h-96 bg-white rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-60"></div>

      <div className="mx-auto max-w-6xl px-4 relative z-10">
        <div className="mb-16 text-center max-w-3xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-vizme-red">Para quién es</span>
          <h2 className="mt-4 text-3xl font-semibold text-vizme-navy sm:text-4xl">
            Tres perfiles, un objetivo: <br/> decidir mejor con datos.
          </h2>
          <p className="mt-6 text-sm text-vizme-greyblue">
            Vizme está pensado para quienes ya tienen tracción, pero sienten que podrían tomar mejores decisiones si tuvieran más claridad.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {personas.map((p, i) => (
            <div key={i} className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-white bg-white p-8 hover:border-vizme-red/30 hover:shadow-xl hover:shadow-vizme-navy/5 transition-all">
              <div className={`absolute inset-0 bg-gradient-to-br ${p.gradient} opacity-100 transition-opacity duration-500`}></div>
              
              <div className="relative z-10">
                <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-vizme-bg text-vizme-navy border border-vizme-grey/20 group-hover:text-vizme-red transition-colors">
                   <p.icon size={24} />
                </div>
                
                <h3 className="text-lg font-semibold text-vizme-navy">{p.title}</h3>
                <p className="text-xs font-medium text-vizme-red mt-1 mb-3">{p.subtitle}</p>
                <p className="text-sm leading-relaxed text-vizme-greyblue mb-6">
                  {p.description}
                </p>

                <div className="space-y-2 border-t border-vizme-grey/20 pt-6">
                  {p.metrics.map((m, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-vizme-greyblue">
                      <CheckCircle2 size={12} className="text-vizme-navy" />
                      {m}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Audience;