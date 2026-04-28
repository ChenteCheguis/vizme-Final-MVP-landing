import { Building2, UploadCloud, Sparkles, ShieldCheck, ArrowRight } from 'lucide-react';

interface Props {
  userName: string;
  onContinue: () => void;
}

export default function Step1Welcome({ userName, onContinue }: Props) {
  const firstName = userName.split(' ')[0] || 'tú';
  const cards = [
    {
      icon: Building2,
      title: 'Cuéntanos de tu negocio',
      body: 'Un par de frases nos ayudan a entender tu contexto. Mientras más específico, mejor.',
    },
    {
      icon: UploadCloud,
      title: 'Sube tu archivo de datos',
      body: 'Excel, CSV — cualquier formato. Tu data nunca sale de tus servidores sin permiso.',
    },
    {
      icon: Sparkles,
      title: 'Nuestra IA hace su magia',
      body: 'En menos de dos minutos te mostramos lo que aprendió sobre tu negocio.',
    },
  ];

  return (
    <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
      {/* Left — editorial */}
      <div className="space-y-8 animate-slide-right">
        <p className="label-eyebrow">Paso 01 — Bienvenida</p>
        <h1 className="font-display text-5xl font-light leading-[1.05] tracking-editorial text-vizme-navy text-balance lg:text-[3.5rem]">
          Hola <span className="text-vizme-coral">{firstName}</span>, listo para que Vizme entienda tu negocio.
        </h1>
        <p className="max-w-lg text-lg text-vizme-greyblue text-pretty">
          En los próximos tres minutos vas a ver qué tan inteligente es nuestra IA analizando tu información.
          Sin demos, sin mock data — con tus números reales.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={onContinue}
            className="group inline-flex items-center gap-2 rounded-full bg-vizme-coral px-7 py-3.5 text-base font-medium text-white shadow-glow-coral transition-all duration-200 hover:-translate-y-0.5 hover:bg-vizme-orange"
          >
            Empecemos
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
          </button>
          <span className="flex items-center gap-2 text-sm text-vizme-greyblue">
            <ShieldCheck size={15} className="text-vizme-navy" />
            Tu data es 100% tuya. Nunca la vendemos.
          </span>
        </div>
      </div>

      {/* Right — what's about to happen */}
      <div className="relative animate-slide-up">
        <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-vizme-coral/10 via-transparent to-vizme-navy/10 blur-2xl" />
        <div className="relative space-y-3">
          {cards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className="group relative overflow-hidden rounded-2xl border border-vizme-navy/8 bg-white/85 p-5 shadow-soft backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card"
                style={{ animationDelay: `${120 + idx * 80}ms` }}
              >
                <div className="grain" />
                <div className="relative flex items-start gap-4">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-vizme-navy text-white">
                    <Icon size={18} />
                  </div>
                  <div className="space-y-1">
                    <p className="flex items-baseline gap-2">
                      <span className="font-mono text-xs text-vizme-coral">{idx + 1}</span>
                      <span className="font-display text-lg text-vizme-navy">{card.title}</span>
                    </p>
                    <p className="text-sm leading-relaxed text-vizme-greyblue">{card.body}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
