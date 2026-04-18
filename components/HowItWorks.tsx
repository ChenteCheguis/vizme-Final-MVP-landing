import React from 'react';
import { Upload, Brain, BarChart3, CheckCircle2 } from 'lucide-react';

const steps = [
  {
    num: '01',
    icon: Upload,
    color: '#F54A43',
    title: 'Sube tu archivo',
    body: 'Arrastra tu Excel o CSV. Vizme detecta automáticamente columnas, tipos de datos y calidad — sin configuración.',
    bullets: ['Excel .xlsx y .xls', 'CSV de cualquier fuente', 'Hasta 50,000 filas'],
  },
  {
    num: '02',
    icon: Brain,
    color: '#F26A3D',
    title: 'La IA analiza todo',
    body: 'Claude — la IA más avanzada disponible — estudia tus patrones, detecta anomalías y genera insights que no verías manualmente.',
    bullets: ['Correlaciones ocultas', 'Alertas de riesgo automáticas', 'Benchmarks de tu industria'],
  },
  {
    num: '03',
    icon: BarChart3,
    color: '#02222F',
    title: 'Actúa con claridad',
    body: 'Dashboard interactivo, reporte ejecutivo y recomendaciones concretas listos en menos de 2 minutos.',
    bullets: ['15+ tipos de gráficas', 'Health score del negocio', 'Plan de acción priorizado'],
  },
];

const HowItWorks: React.FC = () => {
  return (
    <section id="como-funciona" className="py-24 bg-white">
      <div className="mx-auto max-w-6xl px-4">

        {/* Header */}
        <div className="max-w-2xl mb-16">
          <p className="text-sm font-semibold text-vizme-red mb-3">Cómo funciona</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-vizme-navy leading-tight">
            De archivo a decisión<br />en tres pasos
          </h2>
          <p className="text-base text-vizme-greyblue mt-4 leading-relaxed">
            No necesitas ser analista de datos. No necesitas configurar nada. Solo sube tu archivo y deja que la IA haga el trabajo pesado.
          </p>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={i} className="relative">
                {/* Connector */}
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-full w-8 -translate-x-4 z-10">
                    <div className="h-px w-full bg-gradient-to-r from-vizme-navy/20 to-transparent" />
                  </div>
                )}

                <div className="space-y-5">
                  {/* Number + icon */}
                  <div className="flex items-center gap-4">
                    <div
                      className="h-14 w-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg"
                      style={{
                        background: `${step.color}12`,
                        border: `1px solid ${step.color}25`,
                      }}
                    >
                      <Icon size={24} style={{ color: step.color }} />
                    </div>
                    <span
                      className="text-4xl font-black select-none"
                      style={{ color: `${step.color}15` }}
                    >
                      {step.num}
                    </span>
                  </div>

                  {/* Content */}
                  <div>
                    <h3 className="text-lg font-bold text-vizme-navy mb-2">{step.title}</h3>
                    <p className="text-sm text-vizme-greyblue leading-relaxed mb-4">{step.body}</p>
                    <ul className="space-y-2">
                      {step.bullets.map((b, j) => (
                        <li key={j} className="flex items-center gap-2 text-sm text-vizme-greyblue">
                          <CheckCircle2 size={13} style={{ color: step.color, flexShrink: 0 }} />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom callout */}
        <div className="mt-16 bg-vizme-bg rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-vizme-navy">¿Qué tan rápido es realmente?</p>
            <p className="text-sm text-vizme-greyblue mt-0.5">
              El tiempo promedio desde que subes el archivo hasta tener tu dashboard listo es de <strong className="text-vizme-navy">menos de 90 segundos</strong>.
            </p>
          </div>
          <a
            href="#demo"
            className="flex-shrink-0 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-vizme-navy border border-vizme-navy/15 hover:bg-white hover:shadow-sm transition-all whitespace-nowrap"
          >
            Ver el demo
          </a>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
