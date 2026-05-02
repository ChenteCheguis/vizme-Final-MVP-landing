import { useEffect, useState } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import {
  Loader2,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Layers,
  MapPin,
  Languages,
  Building2,
  Sparkles,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { BusinessSchema } from '../../lib/v5types';
import type { ProjectOutletContext } from '../../components/layout/ProjectLayout';

export default function ProjectSchemaPage() {
  const { id } = useParams<{ id: string }>();
  const { project } = useOutletContext<ProjectOutletContext>();
  const [schema, setSchema] = useState<BusinessSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedEntity, setExpandedEntity] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('business_schemas')
        .select('*')
        .eq('project_id', id)
        .order('version', { ascending: false })
        .limit(1);
      if (cancelled) return;
      setSchema((data?.[0] as unknown as BusinessSchema) ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="grid place-items-center py-32">
        <div className="flex items-center gap-3 text-vizme-greyblue">
          <Loader2 size={18} className="animate-spin text-vizme-coral" />
          Leyendo el schema…
        </div>
      </div>
    );
  }

  if (!schema) {
    return (
      <div className="space-y-10 animate-fade-in">
        <header>
          <p className="label-eyebrow">Schema</p>
          <h1 className="mt-2 font-display text-5xl font-light leading-[1.05] tracking-editorial text-vizme-navy text-balance">
            Aún no hay schema
          </h1>
          <p className="mt-3 max-w-2xl text-vizme-greyblue">
            Sube tu primer archivo desde la pestaña Archivos para que generemos el schema de {project.name}.
          </p>
        </header>
      </div>
    );
  }

  const id_ = schema.business_identity;
  const location = id_.location
    ? [id_.location.city, id_.location.state, id_.location.country]
        .filter(Boolean)
        .join(', ')
    : '—';

  return (
    <div className="space-y-12 animate-fade-in">
      <header>
        <p className="label-eyebrow">Schema</p>
        <h1 className="mt-2 font-display text-5xl font-light leading-[1.05] tracking-editorial text-vizme-navy lg:text-6xl text-balance">
          Lo que entendió Vizme de tu negocio
        </h1>
        <p className="mt-3 max-w-2xl text-vizme-greyblue text-pretty">
          Esta es la base sobre la que generamos tu dashboard. Si algo no
          cuadra, podemos rediseñarlo.
        </p>
      </header>

      {/* Identity */}
      <Section title="Identidad del negocio">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <IdentityCard
            label="Industria"
            value={capitalize(id_.industry)}
            icon={<Building2 size={14} />}
          />
          <IdentityCard
            label="Sub-industria"
            value={id_.sub_industry ? capitalize(id_.sub_industry) : '—'}
            icon={<Building2 size={14} />}
          />
          <IdentityCard
            label="Modelo"
            value={humanizeBusinessModel(id_.business_model)}
            icon={<Layers size={14} />}
          />
          <IdentityCard label="Ubicación" value={location} icon={<MapPin size={14} />} />
          <IdentityCard
            label="Idioma"
            value={id_.language}
            icon={<Languages size={14} />}
          />
          <IdentityCard
            label="Moneda"
            value={id_.currency}
            icon={<Sparkles size={14} />}
          />
        </div>
      </Section>

      {/* Metrics */}
      <Section title="Tus métricas clave" subtitle={`${schema.metrics?.length ?? 0} métricas detectadas`}>
        <div className="grid gap-4 sm:grid-cols-2">
          {(schema.metrics ?? []).map((m) => (
            <article
              key={m.id ?? m.name}
              className="group rounded-2xl border border-vizme-navy/8 bg-white/85 p-5 backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-soft"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-display text-xl leading-tight text-vizme-navy">
                  {capitalize(m.name)}
                </p>
                <DirectionBadge dir={m.good_direction} />
              </div>
              {m.description && (
                <p className="mt-2 text-sm leading-relaxed text-vizme-greyblue">
                  {m.description}
                </p>
              )}
              <dl className="mt-4 grid gap-2 border-t border-vizme-navy/5 pt-3 text-xs">
                {m.formula && (
                  <KV label="Fórmula" value={m.formula} mono />
                )}
                <KV label="Unidad" value={m.unit ?? '—'} />
                <KV label="Agregación" value={m.aggregation} />
                <KV label="Formato" value={m.format} />
              </dl>
            </article>
          ))}
        </div>
      </Section>

      {/* Entities */}
      <Section title="Entidades de tu negocio" subtitle={`${schema.entities?.length ?? 0} entidades`}>
        <div className="overflow-hidden rounded-2xl border border-vizme-navy/8 bg-white/85 backdrop-blur">
          {(schema.entities ?? []).map((e) => {
            const open = expandedEntity === e.id;
            return (
              <div key={e.id} className="border-b border-vizme-navy/5 last:border-b-0">
                <button
                  type="button"
                  onClick={() => setExpandedEntity(open ? null : e.id)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-vizme-bg/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-vizme-navy">{capitalize(e.name)}</p>
                    <p className="mt-0.5 text-[11px] uppercase tracking-wider text-vizme-greyblue">
                      {e.type} · {e.fields.length} campos
                    </p>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`text-vizme-greyblue transition-transform ${open ? 'rotate-180' : ''}`}
                  />
                </button>
                {open && (
                  <ul className="grid gap-1 bg-vizme-bg/30 px-5 pb-4 pt-2 text-xs">
                    {e.fields.map((f) => (
                      <li
                        key={f.name}
                        className="flex items-center justify-between gap-3 rounded-lg bg-white/70 px-3 py-2"
                      >
                        <span className="font-mono text-vizme-navy">{f.name}</span>
                        <span className="flex items-center gap-2 text-vizme-greyblue">
                          <span className="rounded-full bg-vizme-navy/5 px-2 py-0.5 uppercase tracking-wider">
                            {f.type}
                          </span>
                          {f.required && (
                            <span className="rounded-full bg-vizme-coral/10 px-2 py-0.5 text-vizme-coral">
                              requerido
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {/* Dimensions */}
      <Section title="Dimensiones de análisis" subtitle={`${schema.dimensions?.length ?? 0} dimensiones`}>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(schema.dimensions ?? []).map((d) => (
            <li
              key={d.id ?? d.name}
              className="rounded-xl border border-vizme-navy/8 bg-white/85 px-4 py-3 backdrop-blur"
            >
              <p className="font-medium text-vizme-navy">{capitalize(d.name)}</p>
              <p className="mt-0.5 text-[11px] uppercase tracking-wider text-vizme-greyblue">
                {d.type}
                {d.hierarchy && d.hierarchy.length > 0 && ` · ${d.hierarchy.join(' → ')}`}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      {/* Extraction rules */}
      <Section
        title="Cómo extraemos tus datos"
        subtitle={`${schema.extraction_rules?.length ?? 0} reglas configuradas`}
      >
        <div className="grid gap-3 lg:grid-cols-2">
          {(schema.extraction_rules ?? []).map((r, idx) => (
            <article
              key={`${r.target_entity}-${idx}`}
              className="rounded-2xl border border-vizme-navy/8 bg-white/85 p-4 backdrop-blur"
            >
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-vizme-navy text-white">
                  <ArrowRight size={13} />
                </span>
                <p className="font-medium text-vizme-navy">{r.target_entity}</p>
              </div>
              <p className="mt-3 truncate font-mono text-[11px] text-vizme-greyblue">
                {r.source_pattern}
              </p>
              <div className="mt-3 flex gap-2 text-[11px] text-vizme-greyblue">
                <span className="rounded-full bg-vizme-navy/5 px-2 py-0.5">
                  {Object.keys(r.field_mappings ?? {}).length} mapeos
                </span>
                {r.validations && r.validations.length > 0 && (
                  <span className="rounded-full bg-vizme-coral/10 px-2 py-0.5 text-vizme-coral">
                    {r.validations.length} validaciones
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      </Section>

      {/* External sources */}
      {schema.external_sources && schema.external_sources.length > 0 && (
        <Section
          title="Fuentes externas conectables"
          subtitle="Datos públicos que pueden enriquecer tu análisis"
        >
          <ul className="grid gap-2 sm:grid-cols-2">
            {schema.external_sources.map((s, i) => (
              <li
                key={`${s.type}-${i}`}
                className="flex items-center justify-between rounded-xl border border-vizme-navy/8 bg-white/85 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-vizme-navy">{s.type}</p>
                  <p className="mt-0.5 text-[11px] text-vizme-greyblue">
                    Refresca cada {s.refresh_interval_days} días
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                    s.enabled
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-vizme-navy/5 text-vizme-greyblue'
                  }`}
                >
                  {s.enabled ? 'activo' : 'inactivo'}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Footer / redesign placeholder */}
      <footer className="border-t border-vizme-navy/8 pt-8">
        <button
          type="button"
          onClick={() =>
            alert(
              'El editor de schema está en planeación. Si tienes feedback urgente, escríbenos a hola@vizme.mx.'
            )
          }
          className="text-sm font-medium text-vizme-greyblue underline decoration-vizme-coral/40 underline-offset-4 transition-colors hover:text-vizme-navy"
        >
          Rediseñar este schema
        </button>
      </footer>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <h2 className="font-display text-3xl font-light tracking-editorial text-vizme-navy">
          {title}
        </h2>
        {subtitle && (
          <span className="text-xs uppercase tracking-[0.14em] text-vizme-greyblue">
            {subtitle}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function IdentityCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-vizme-navy/8 bg-white/85 p-5 backdrop-blur">
      <div className="flex items-center gap-2 text-vizme-greyblue">
        <span className="text-vizme-coral">{icon}</span>
        <span className="text-[10px] uppercase tracking-[0.14em]">{label}</span>
      </div>
      <p className="mt-2 font-display text-lg leading-tight text-vizme-navy">{value}</p>
    </div>
  );
}

function KV({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-vizme-greyblue">
        {label}
      </dt>
      <dd
        className={`min-w-0 truncate text-right text-vizme-navy ${
          mono ? 'font-mono' : ''
        }`}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

function DirectionBadge({ dir }: { dir: 'up' | 'down' }) {
  const Icon = dir === 'up' ? TrendingUp : TrendingDown;
  const label = dir === 'up' ? 'Mejor cuando sube' : 'Mejor cuando baja';
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-vizme-coral/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-vizme-coral"
      title={label}
    >
      <Icon size={11} />
      {dir}
    </span>
  );
}

function capitalize(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function humanizeBusinessModel(raw: string): string {
  const m = raw?.toLowerCase() ?? '';
  if (m.includes('b2c')) return 'B2C — Consumidor final';
  if (m.includes('b2b')) return 'B2B — Otros negocios';
  if (m.includes('marketplace')) return 'Marketplace';
  if (m.includes('saas') || m.includes('subscri')) return 'SaaS / Suscripción';
  return capitalize(raw);
}
