import React, { useState } from 'react';
import { ArrowRight, Check, Loader2 } from 'lucide-react';

const CTA: React.FC = () => {
  const [formState, setFormState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormState('loading');

    const myForm = e.currentTarget;
    const formData = new FormData(myForm);
    
    // Convert FormData to URLSearchParams for Netlify
    const searchParams = new URLSearchParams();
    for (const pair of formData.entries()) {
        searchParams.append(pair[0], pair[1] as string);
    }

    fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: searchParams.toString(),
    })
      .then(() => setFormState('success'))
      .catch((error) => {
        console.error(error);
        setFormState('error');
      });
  };

  const handlePhoneInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow numbers
    const value = e.target.value.replace(/[^0-9]/g, '');
    // Limit to 10 digits
    if (value.length <= 10) {
      e.target.value = value;
    } else {
      e.target.value = value.slice(0, 10);
    }
  };

  const handleNameInput = (e: React.ChangeEvent<HTMLInputElement>) => {
     if (e.target.value.length > 25) {
        e.target.value = e.target.value.slice(0, 25);
     }
  };

  return (
    <section id="cta" className="py-24 relative overflow-hidden bg-vizme-bg border-t border-vizme-navy/5">
       {/* Background Elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(2,34,47,0.05),transparent_40%)] pointer-events-none"></div>

      <div className="mx-auto max-w-5xl px-4 relative z-10">
        <div className="rounded-[2.5rem] border border-vizme-navy/10 bg-vizme-navy p-8 sm:p-14 shadow-2xl relative overflow-hidden group">
          
          {/* Decorative Glow */}
          <div className="absolute top-0 right-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-vizme-red/20 blur-[80px] group-hover:bg-vizme-red/30 transition-colors duration-700"></div>
          <div className="absolute bottom-0 left-0 -mb-10 -ml-10 h-64 w-64 rounded-full bg-vizme-orange/10 blur-[80px]"></div>

          <div className="grid gap-12 md:grid-cols-5 md:items-center relative z-10">
            
            {/* Copy */}
            <div className="md:col-span-3 space-y-6">
              
              <div className="flex items-center gap-3 mb-2">
                 {/* REMOVED LOGO HERE */}
                 <span className="text-xs font-bold uppercase tracking-[0.2em] text-vizme-orange">Siguiente Paso</span>
              </div>
              
              <h2 className="text-3xl font-semibold text-white sm:text-4xl">
                Convierte la incertidumbre en un <span className="text-vizme-red">plan de ataque</span>.
              </h2>
              <p className="text-sm text-gray-300 leading-relaxed max-w-lg">
                Tus datos ya tienen la respuesta, solo falta hacer la pregunta correcta. Conectemos tus fuentes y te entregaremos tu primer mapa de decisiones para desbloquear tu crecimiento.
              </p>
              
              <ul className="space-y-3 pt-2">
                <li className="flex items-center gap-3 text-xs text-white">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-vizme-red/20 text-vizme-red">
                    <Check size={12} />
                  </div>
                  Proyecto piloto sin contratos largos.
                </li>
                <li className="flex items-center gap-3 text-xs text-white">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-vizme-red/20 text-vizme-red">
                    <Check size={12} />
                  </div>
                  Acompañamiento para aterrizar insights.
                </li>
              </ul>
            </div>

            {/* Form */}
            <div className="md:col-span-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm shadow-inner relative overflow-hidden">
                {formState === 'success' ? (
                   <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-vizme-navy p-6 text-center animate-fade-in border border-white/10 rounded-2xl">
                      <div className="h-12 w-12 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 mb-3">
                        <Check size={24} />
                      </div>
                      <h3 className="text-white font-semibold">¡Solicitud Recibida!</h3>
                      <p className="text-xs text-gray-400 mt-1">Te contactaremos pronto para iniciar tu auditoría.</p>
                      <button 
                        onClick={() => setFormState('idle')}
                        className="mt-4 text-xs text-vizme-orange hover:text-vizme-red underline"
                      >
                        Enviar otra solicitud
                      </button>
                   </div>
                ) : null}

                {formState === 'error' && (
                  <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
                    Hubo un error al enviar. Por favor intenta de nuevo.
                  </div>
                )}

                <p className="mb-4 text-xs font-medium text-white">
                  Déjanos un correo y auditemos tu potencial.
                </p>
                <form 
                  className="space-y-4" 
                  name="contact" 
                  method="POST" 
                  onSubmit={handleSubmit}
                >
                  {/* Hidden input for Netlify */}
                  <input type="hidden" name="form-name" value="contact" />
                  
                  <div>
                    <input 
                      required
                      type="text" 
                      name="name"
                      maxLength={25}
                      onInput={handleNameInput}
                      placeholder="Tu nombre (Max 25 caracteres)"
                      className="w-full rounded-xl border border-transparent bg-white px-4 py-3 text-sm text-vizme-navy placeholder-gray-500 focus:border-vizme-red focus:outline-none focus:ring-2 focus:ring-vizme-red transition-all shadow-sm"
                    />
                  </div>
                  <div>
                    <input 
                      required
                      type="email" 
                      name="email"
                      placeholder="Correo de trabajo"
                      className="w-full rounded-xl border border-transparent bg-white px-4 py-3 text-sm text-vizme-navy placeholder-gray-500 focus:border-vizme-red focus:outline-none focus:ring-2 focus:ring-vizme-red transition-all shadow-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <select 
                      name="lada"
                      className="w-24 rounded-xl border border-transparent bg-white px-2 py-3 text-sm text-vizme-navy focus:border-vizme-red focus:outline-none focus:ring-2 focus:ring-vizme-red transition-all shadow-sm"
                    >
                      <option value="+52">🇲🇽 +52</option>
                      <option value="+1">🇺🇸 +1</option>
                      <option value="+57">🇨🇴 +57</option>
                      <option value="+34">🇪🇸 +34</option>
                      <option value="+54">🇦🇷 +54</option>
                      <option value="+56">🇨🇱 +56</option>
                    </select>
                    <input 
                      required
                      type="tel" 
                      name="phone"
                      placeholder="Celular (10 dígitos)"
                      onInput={handlePhoneInput}
                      className="w-full rounded-xl border border-transparent bg-white px-4 py-3 text-sm text-vizme-navy placeholder-gray-500 focus:border-vizme-red focus:outline-none focus:ring-2 focus:ring-vizme-red transition-all shadow-sm"
                    />
                  </div>
                  <div>
                    <div className="relative">
                      <select 
                        required 
                        name="profile"
                        defaultValue=""
                        className="w-full appearance-none rounded-xl border border-transparent bg-white px-4 py-3 text-sm text-vizme-navy focus:border-vizme-red focus:outline-none focus:ring-2 focus:ring-vizme-red transition-all shadow-sm"
                      >
                        <option value="" disabled>Perfil...</option>
                        <option value="empresa">Empresa</option>
                        <option value="influencer">Influencer / Creador</option>
                        <option value="artista">Artista</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center">
                         <svg className="h-4 w-4 text-vizme-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </div>
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={formState === 'loading'}
                    className="group mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-vizme-red px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-vizme-red/25 transition-all hover:bg-vizme-orange hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {formState === 'loading' ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <>
                        Agendar Demo gratis
                        <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>

                  <p className="text-center text-[10px] text-gray-400">
                    Datos confidenciales bajo NDA.
                  </p>
                </form>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;