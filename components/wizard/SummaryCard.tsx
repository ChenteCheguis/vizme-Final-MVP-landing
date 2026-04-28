import { ArrowRight, AlertTriangle, CheckCircle2, BarChart3, TrendingUp, Target } from 'lucide-react';
import type { BusinessSchema } from '../../lib/v5types';
import type { AnalysisSummary } from '../../lib/onboardingState';

interface Props {
  summary: AnalysisSummary;
  schema: BusinessSchema;
  primaryCtaLabel?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
  compact?: boolean;
}

const metricIcons = [BarChart3, TrendingUp, Target] as const;

export default function SummaryCard({
  summary,
  schema,
  primaryCtaLabel = 'Ver mi dashboard completo',
  onPrimary,
  onSecondary,
  compact = false,
}: Props) {
  const identity = schema.business_identity;
  const topMetrics = (schema.metrics ?? []).slice(0, 3);
  const subIndustry = identity.sub_industry || summary.industry;
  const location = identity.location
    ? [identity.location.city, identity.location.state, identity.location.country]
        .filter(Boolean)
        .join(', ')
    : 'Sin ubicación detectada';

  const businessModel = humanizeBusinessModel(identity.business_model);

  const alert = (summary.needs_clarification && summary.needs_clarification[0]) || null;

  return (
    <article
      className={[
        'relative overflow-hidden rounded-3xl bg-white shadow-editorial animate-scale-in',
        compact ? 'p-7' : 'p-9 lg:p-11',
      ].join(' ')}
    >
      {/* Decorative coral arc */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-vizme-coral/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-32 bottom-0 h-72 w-72 rounded-full bg-vizme-navy/8 blur-3xl" />
      <div className="grain" />

      <div className="relative">
        <p className="label-eyebrow">Esto es lo que entendimos</p>
        <h2
          className={[
            'mt-2 font-display font-light leading-tight tracking-editorial text-vizme-navy text-balance',
            compact ? 'text-3xl' : 'text-4xl lg:text-5xl',
          ].join(' ')}
        >
          {capitalize(subIndustry)}
        </h2>
        <p className="mt-3 max-w-xl text-vizme-greyblue text-pretty">
          Esto fue lo que nuestra IA aprendió sobre tu información en los últimos minutos.
          Confírmanos si todo cuadra o dinos qué corregir.
        </p>

        {/* Identity grid */}
        <div className="mt-8 grid gap-4 rounded-2xl border border-vizme-navy/8 bg-vizme-bg/60 p-5 sm:grid-cols-3">
          <IdentityField label="Industria" value={capitalize(summary.industry)} />
          <IdentityField label="Modelo" value={businessModel} />
          <IdentityField label="Ubicación" value={location} />
        </div>

        {/* Top metrics */}
        {topMetrics.length > 0 && (
          <section className="mt-8">
            <p className="label-eyebrow mb-4">Tus 3 métricas más importantes</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {topMetrics.map((metric, idx) => {
                const Icon = metricIcons[idx % metricIcons.length];
                return (
                  <div
                    key={metric.id ?? metric.name}
                    className="group relative overflow-hidden rounded-2xl border border-vizme-navy/8 bg-white p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card"
                    style={{ animationDelay: `${100 + idx * 80}ms` }}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-vizme-navy text-white">
                        <Icon size={15} />
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-vizme-coral">
                        Métrica {idx + 1}
                      </span>
                    </div>
                    <p className="mt-3 font-display text-lg leading-tight text-vizme-navy">
                      {capitalize(metric.name)}
                    </p>
                    {metric.description && (
                      <p className="mt-1.5 text-xs leading-relaxed text-vizme-greyblue">
                        {truncate(metric.description, 90)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Alert / clean state */}
        <section className="mt-7">
          {alert ? (
            <div className="flex items-start gap-3 rounded-2xl border-l-4 border-vizme-coral bg-vizme-coral/8 p-4">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-vizme-coral text-white">
                <AlertTriangle size={14} />
              </span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-vizme-coral">
                  Hallazgo importante
                </p>
                <p className="mt-1 text-sm leading-relaxed text-vizme-navy">{alert}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-2xl border-l-4 border-emerald-500 bg-emerald-50/70 p-4">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-500 text-white">
                <CheckCircle2 size={14} />
              </span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                  Todo se ve claro
                </p>
                <p className="mt-1 text-sm leading-relaxed text-vizme-navy">
                  Tu información está limpia y lista para que hagamos magia.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* CTAs */}
        {(onPrimary || onSecondary) && (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            {onSecondary ? (
              <button
                type="button"
                onClick={onSecondary}
                className="text-sm font-medium text-vizme-greyblue underline decoration-vizme-coral/40 underline-offset-4 transition-colors hover:text-vizme-navy"
              >
                Corregir algo de lo que entendimos
              </button>
            ) : (
              <span />
            )}
            {onPrimary && (
              <button
                type="button"
                onClick={onPrimary}
                className="group inline-flex items-center gap-2 rounded-full bg-vizme-coral px-7 py-3 font-medium text-white shadow-glow-coral transition-all duration-200 hover:-translate-y-0.5 hover:bg-vizme-orange"
              >
                {primaryCtaLabel}
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function IdentityField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label-eyebrow">{label}</p>
      <p className="mt-1.5 font-display text-lg leading-tight text-vizme-navy">{value}</p>
    </div>
  );
}

function capitalize(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + '…';
}

function humanizeBusinessModel(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('b2c')) return 'B2C — Consumidor final';
  if (m.includes('b2b')) return 'B2B — Otros negocios';
  if (m.includes('marketplace')) return 'Marketplace';
  if (m.includes('saas') || m.includes('subscri')) return 'SaaS / Suscripción';
  return capitalize(raw);
}
