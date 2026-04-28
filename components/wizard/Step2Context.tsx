import { ArrowLeft, ArrowRight, Lightbulb } from 'lucide-react';

interface Props {
  projectName: string;
  businessHint: string;
  question: string;
  onChangeProjectName: (v: string) => void;
  onChangeBusinessHint: (v: string) => void;
  onChangeQuestion: (v: string) => void;
  onBack: () => void;
  onContinue: () => void;
}

const examples = [
  { label: 'Retail', value: 'Tienda de productos promocionales, venta online y tienda física' },
  { label: 'Logística', value: 'Empresa de última milla en Zona Metropolitana' },
  { label: 'Farmacia', value: 'Farmacia independiente con especialidad en dermocosmética' },
  { label: 'Servicios', value: 'Barbería infantil con programa de incentivos por juguete' },
];

export default function Step2Context({
  projectName,
  businessHint,
  question,
  onChangeProjectName,
  onChangeBusinessHint,
  onChangeQuestion,
  onBack,
  onContinue,
}: Props) {
  const ready = projectName.trim().length >= 2 && businessHint.trim().length >= 10;
  return (
    <div className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:gap-16">
      <div className="space-y-8 animate-slide-right">
        <div className="space-y-3">
          <p className="label-eyebrow">Paso 02 — Tu negocio</p>
          <h1 className="font-display text-4xl font-light leading-tight tracking-editorial text-vizme-navy lg:text-5xl">
            Cuéntanos qué hace tu negocio.
          </h1>
          <p className="max-w-lg text-vizme-greyblue text-pretty">
            Estos detalles entran al primer prompt que ve nuestra IA. Mientras más
            específico, mejor entiende tu contexto.
          </p>
        </div>

        <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); if (ready) onContinue(); }}>
          <FieldShell
            label="¿Cómo le ponemos a tu proyecto?"
            helper="Así lo verás siempre en tu dashboard."
            required
          >
            <input
              type="text"
              value={projectName}
              onChange={(e) => onChangeProjectName(e.target.value)}
              placeholder="Ej. Barbería Central — Ventas 2026"
              maxLength={100}
              className="input-vizme"
            />
          </FieldShell>

          <FieldShell
            label="¿A qué se dedica tu negocio?"
            helper="1-2 oraciones. Mientras más específico, mejor."
            required
            counter={`${businessHint.length}/300`}
          >
            <textarea
              value={businessHint}
              onChange={(e) => onChangeBusinessHint(e.target.value.slice(0, 300))}
              placeholder="Ej. Barbería infantil en CDMX con modelo de incentivos por juguete después del corte."
              rows={3}
              className="input-vizme resize-none leading-relaxed"
            />
          </FieldShell>

          <FieldShell
            label="¿Hay algo que te quite el sueño?"
            helper="Opcional. Si no sabes qué preguntar, está bien — la IA va a descubrir patrones por su cuenta."
          >
            <textarea
              value={question}
              onChange={(e) => onChangeQuestion(e.target.value.slice(0, 240))}
              placeholder="Ej. ¿Por qué bajó la cantidad de cortes en marzo?"
              rows={2}
              className="input-vizme resize-none leading-relaxed"
            />
          </FieldShell>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 text-sm font-medium text-vizme-greyblue transition-colors hover:text-vizme-navy"
            >
              <ArrowLeft size={16} />
              Atrás
            </button>
            <button
              type="submit"
              disabled={!ready}
              className="group inline-flex items-center gap-2 rounded-full bg-vizme-coral px-7 py-3 font-medium text-white shadow-glow-coral transition-all duration-200 hover:-translate-y-0.5 hover:bg-vizme-orange disabled:cursor-not-allowed disabled:bg-vizme-greyblue/35 disabled:shadow-none disabled:translate-y-0"
            >
              Continuar
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </form>
      </div>

      {/* Examples panel */}
      <aside className="relative animate-slide-up lg:pt-16">
        <div className="sticky top-8 space-y-4 rounded-2xl border border-vizme-navy/8 bg-white/85 p-6 shadow-soft backdrop-blur">
          <p className="flex items-center gap-2 text-sm font-medium text-vizme-navy">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-vizme-coral/10 text-vizme-coral">
              <Lightbulb size={15} />
            </span>
            Ejemplos reales que Vizme ha analizado
          </p>
          <ul className="space-y-3">
            {examples.map((ex) => (
              <li key={ex.label} className="group">
                <button
                  type="button"
                  onClick={() => onChangeBusinessHint(ex.value)}
                  className="block w-full rounded-xl border border-transparent p-3 text-left transition-all hover:border-vizme-navy/10 hover:bg-vizme-bg/60"
                >
                  <p className="text-[10px] uppercase tracking-[0.2em] text-vizme-coral">
                    {ex.label}
                  </p>
                  <p className="mt-1 text-sm text-vizme-navy/85 leading-snug">{ex.value}</p>
                </button>
              </li>
            ))}
          </ul>
          <p className="text-[11px] leading-relaxed text-vizme-greyblue/80">
            Click sobre cualquiera para usarlo como inspiración.
          </p>
        </div>
      </aside>
    </div>
  );
}

function FieldShell({
  label,
  helper,
  required,
  counter,
  children,
}: {
  label: string;
  helper?: string;
  required?: boolean;
  counter?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center justify-between">
        <span className="label-eyebrow">
          {label} {required && <span className="text-vizme-coral">*</span>}
        </span>
        {counter && <span className="text-[10px] text-vizme-greyblue/70">{counter}</span>}
      </span>
      {children}
      {helper && <span className="block text-xs text-vizme-greyblue/85">{helper}</span>}
    </label>
  );
}
