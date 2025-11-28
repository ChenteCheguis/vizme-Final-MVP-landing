import React from 'react';
import { Plus, Minus } from 'lucide-react';

const faqs = [
  {
    question: "¿Necesito un equipo de ingenieros para usar Vizme?",
    answer: "No. Vizme está diseñado para ser 'No-Code'. Nosotros nos encargamos de las conexiones complejas (API, SQL, Excel) y te entregamos el dashboard listo. Tú solo te preocupas por leer los insights."
  },
  {
    question: "¿Mis datos están seguros?",
    answer: "Absolutamente. Utilizamos encriptación AES-256 de nivel bancario y nunca vendemos tus datos a terceros. Firmamos acuerdos de confidencialidad (NDA) con cada cliente antes de empezar."
  },
  {
    question: "¿Con qué plataformas se integran?",
    answer: "Conectamos con casi todo: Meta Ads, Google Analytics, Shopify, HubSpot, Salesforce, hojas de cálculo de Google/Excel y bases de datos SQL. Si tiene una API, podemos conectarlo."
  },
  {
    question: "¿Cuánto tarda la implementación?",
    answer: "Nuestro proceso de 'Piloto Rápido' toma entre 48 y 72 horas para tener tu primer dashboard funcional con datos históricos reales."
  }
];

const FAQ: React.FC = () => {
  const [openIndex, setOpenIndex] = React.useState<number | null>(0);

  return (
    <section className="py-24 bg-slate-900/20 border-t border-slate-800">
      <div className="mx-auto max-w-3xl px-4">
        <h2 className="text-3xl font-semibold text-white text-center mb-12">Preguntas Frecuentes</h2>
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div 
              key={index} 
              className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                openIndex === index 
                ? 'bg-slate-800/50 border-indigo-500/30' 
                : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
              }`}
            >
              <button 
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-6 text-left"
              >
                <span className={`text-sm font-medium ${openIndex === index ? 'text-white' : 'text-slate-300'}`}>
                  {faq.question}
                </span>
                {openIndex === index ? <Minus size={18} className="text-indigo-400" /> : <Plus size={18} className="text-slate-500" />}
              </button>
              
              <div 
                className={`transition-all duration-300 ease-in-out ${
                  openIndex === index ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <p className="px-6 pb-6 text-sm text-slate-400 leading-relaxed">
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