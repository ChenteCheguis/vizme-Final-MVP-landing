import React from 'react';
import { Plus, Minus } from 'lucide-react';

const faqs = [
  {
    question: "¿Necesito conocimientos técnicos para usar Vizme?",
    answer: "Para nada. Nosotros nos encargamos de la ingeniería de datos. Tú recibes una interfaz limpia y reportes en lenguaje humano para que te enfoques en decidir, no en programar."
  },
  {
    question: "¿Cómo garantizan la seguridad de mi información?",
    answer: "La seguridad es nuestra prioridad. Utilizamos protocolos de encriptación de grado bancario y firmamos acuerdos legales de confidencialidad (NDA) antes de tocar cualquier dato."
  },
  {
    question: "¿Qué fuentes de datos pueden conectar?",
    answer: "Desde simples Excel y Google Sheets hasta infraestructuras complejas como Salesforce, Shopify, Google Ads, Meta Business Suite y bases de datos SQL propias."
  },
  {
    question: "¿En cuánto tiempo veré resultados?",
    answer: "Nuestro proceso está diseñado para la agilidad. Una vez conectadas las fuentes, entregamos tu primer mapa de decisiones funcional en un plazo de 48 a 72 horas."
  }
];

const FAQ: React.FC = () => {
  const [openIndex, setOpenIndex] = React.useState<number | null>(0);

  return (
    <section className="py-24 bg-white border-t border-vizme-navy/5">
      <div className="mx-auto max-w-3xl px-4">
        <div className="text-center mb-16">
          <span className="text-xs font-bold text-vizme-red uppercase tracking-widest">FAQ</span>
          <h2 className="mt-4 text-3xl font-semibold text-vizme-navy">Preguntas Frecuentes</h2>
        </div>
        
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div 
              key={index} 
              className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                openIndex === index 
                ? 'bg-vizme-bg border-vizme-navy/20 shadow-sm' 
                : 'bg-white border-vizme-navy/5 hover:border-vizme-navy/20'
              }`}
            >
              <button 
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-6 text-left"
              >
                <span className={`text-sm font-semibold ${openIndex === index ? 'text-vizme-navy' : 'text-vizme-greyblue'}`}>
                  {faq.question}
                </span>
                <div className={`transition-transform duration-300 ${openIndex === index ? 'rotate-180' : ''}`}>
                   {openIndex === index ? <Minus size={18} className="text-vizme-red" /> : <Plus size={18} className="text-vizme-navy" />}
                </div>
              </button>
              
              <div 
                className={`transition-all duration-300 ease-in-out ${
                  openIndex === index ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <p className="px-6 pb-6 text-sm text-vizme-greyblue leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQ;