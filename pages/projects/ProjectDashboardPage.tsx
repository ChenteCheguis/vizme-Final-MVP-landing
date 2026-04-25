import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  AlertCircle,
  Loader2,
  UploadCloud,
  Sparkles,
  Activity,
  Layers,
  Calendar,
  Database,
  TrendingUp,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import SummaryCard from '../../components/wizard/SummaryCard';
import IngestModal from '../../components/ingest/IngestModal';
import type { BusinessSchema, Project } from '../../lib/v5types';
import type { AnalysisSummary } from '../../lib/onboardingState';

interface FileRow {
  id: string;
  file_name: string;
  uploaded_at: string;
  file_size_bytes: number | null;
  processed_at: string | null;
}

export default function ProjectDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [schema, setSchema] = useState<BusinessSchema | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [ingestOpen, setIngestOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!id || !user) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        // Project (RLS already scopes to user)
        const { data: proj, error: pErr } = await supabase
          .from('projects')
          .select('*')
          .eq('id', id)
          .single();
        if (cancelled) return;
        if (pErr || !proj) throw new Error('No encontramos este proyecto.');

        // Latest schema
        const { data: schemas, error: sErr } = await supabase
          .from('business_schemas')
          .select('*')
          .eq('project_id', id)
          .order('version', { ascending: false })
          .limit(1);
        if (cancelled) return;
        if (sErr) throw new Error(`No pudimos leer el schema. ${sErr.message}`);

        // Files
        const { data: fs, error: fErr } = await supabase
          .from('files')
          .select('id, file_name, uploaded_at, file_size_bytes, processed_at')
          .eq('project_id', id)
          .order('uploaded_at', { ascending: false });
        if (cancelled) return;
        if (fErr) throw new Error(`No pudimos listar los archivos. ${fErr.message}`);

        setProject(proj as unknown as Project);
        setSchema((schemas?.[0] as unknown as BusinessSchema) ?? null);
        setFiles((fs ?? []) as unknown as FileRow[]);
      } catch (err) {
        if (cancelled) return;
        setError((err as Error).message ?? 'Algo falló al cargar tu proyecto.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, user, reloadKey]);

  if (loading) {
    return (
      <div className="grid place-items-center py-32">
        <div className="flex items-center gap-3 text-vizme-greyblue">
          <Loader2 size={18} className="animate-spin text-vizme-coral" />
          Cargando tu dashboard…
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="grid place-items-center py-24">
        <div className="max-w-md space-y-4 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-vizme-coral/10 text-vizme-coral">
            <AlertCircle size={24} />
          </div>
          <p className="text-vizme-navy">{error ?? 'Proyecto no encontrado.'}</p>
          <Link
            to="/projects"
            className="inline-flex items-center gap-2 text-sm font-medium text-vizme-coral hover:underline"
          >
            <ArrowLeft size={14} />
            Volver a mis proyectos
          </Link>
        </div>
      </div>
    );
  }

  // Build the AnalysisSummary on the fly from the schema (so SummaryCard stays reusable)
  const summary: AnalysisSummary | null = schema
    ? {
        industry: schema.business_identity.industry,
        sub_industry: schema.business_identity.sub_industry ?? null,
        metrics_count: schema.metrics?.length ?? 0,
        entities_count: schema.entities?.length ?? 0,
        dimensions_count: schema.dimensions?.length ?? 0,
        extraction_rules_count: schema.extraction_rules?.length ?? 0,
        external_sources_count: schema.external_sources?.length ?? 0,
        needs_clarification: null,
      }
    : null;

  return (
    <div className="space-y-12 animate-fade-in">
      {/* Breadcrumb / back */}
      <div>
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.16em] text-vizme-greyblue transition-colors hover:text-vizme-coral"
        >
          <ArrowLeft size={12} />
          Mis proyectos
        </Link>
      </div>

      {/* Project header — editorial */}
      <header className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr] lg:items-end">
        <div>
          <p className="label-eyebrow">
            Proyecto · {new Date(project.created_at).toLocaleDateString('es-MX', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
          <h1 className="mt-2 font-display text-5xl font-light leading-[1.05] tracking-editorial text-vizme-navy lg:text-6xl text-balance">
            {project.name}
          </h1>
          {project.description && (
            <p className="mt-3 max-w-2xl text-vizme-greyblue text-pretty">
              {project.description}
            </p>
          )}
          {project.question && (
            <div className="mt-5 flex items-start gap-3 rounded-2xl border-l-4 border-vizme-coral bg-vizme-coral/5 p-4 max-w-2xl">
              <Sparkles size={16} className="mt-0.5 shrink-0 text-vizme-coral" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-vizme-coral">
                  Tu pregunta original
                </p>
                <p className="mt-1 text-sm leading-relaxed text-vizme-navy">{project.question}</p>
              </div>
            </div>
          )}
        </div>

        {/* Quick actions cluster */}
        <div className="flex flex-col items-end gap-2.5">
          <button
            type="button"
            onClick={() => setIngestOpen(true)}
            disabled={!schema}
            className="group inline-flex items-center gap-2 rounded-full bg-vizme-navy px-6 py-3 font-medium text-white shadow-soft transition-all hover:-translate-y-0.5 hover:bg-vizme-coral hover:shadow-glow-coral disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            title={schema ? 'Subir datos nuevos a este proyecto' : 'Necesitas un schema antes de ingerir datos'}
          >
            <UploadCloud size={16} />
            Subir nueva data
          </button>
          <p className="text-[10px] uppercase tracking-[0.14em] text-vizme-greyblue">
            Ingesta recurrente · Haiku anomalías
          </p>
        </div>
      </header>

      {/* Schema summary card */}
      {schema && summary ? (
        <section className="space-y-4">
          <SummaryCard
            summary={summary}
            schema={schema}
            primaryCtaLabel="Ver el schema completo"
            onPrimary={() => alert('La vista detallada del schema llega en el siguiente sprint.')}
            onSecondary={() => alert('La edición manual del schema llega en el siguiente sprint.')}
          />
        </section>
      ) : (
        <section className="rounded-3xl border border-dashed border-vizme-greyblue/30 bg-white/40 p-10 text-center">
          <p className="font-display text-2xl font-light text-vizme-navy">
            Este proyecto aún no tiene schema.
          </p>
          <p className="mt-2 text-sm text-vizme-greyblue">
            Vuelve al wizard para subir un archivo y generarlo.
          </p>
          <button
            type="button"
            onClick={() => navigate('/onboarding')}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-vizme-coral px-6 py-3 text-white shadow-glow-coral transition-all hover:-translate-y-0.5 hover:bg-vizme-orange"
          >
            <Sparkles size={16} />
            Subir un archivo ahora
          </button>
        </section>
      )}

      {/* Schema stats grid (rich detail) */}
      {schema && (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Métricas" value={schema.metrics?.length ?? 0} icon={<TrendingUp size={16} />} />
          <StatCard label="Entidades" value={schema.entities?.length ?? 0} icon={<Database size={16} />} />
          <StatCard label="Dimensiones" value={schema.dimensions?.length ?? 0} icon={<Layers size={16} />} />
          <StatCard label="Reglas" value={schema.extraction_rules?.length ?? 0} icon={<Activity size={16} />} />
        </section>
      )}

      {/* Files history */}
      <section className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="label-eyebrow">Historial</p>
            <h2 className="mt-1 font-display text-3xl font-light tracking-editorial text-vizme-navy">
              Archivos subidos
            </h2>
          </div>
          <span className="text-xs uppercase tracking-[0.14em] text-vizme-greyblue">
            {files.length} archivo{files.length === 1 ? '' : 's'}
          </span>
        </div>

        {files.length === 0 ? (
          <div className="rounded-2xl border border-vizme-navy/8 bg-white/70 p-6 text-sm text-vizme-greyblue">
            Aún no hay archivos asociados a este proyecto.
          </div>
        ) : (
          <ul className="divide-y divide-vizme-navy/5 overflow-hidden rounded-2xl border border-vizme-navy/8 bg-white/85 backdrop-blur">
            {files.map((f) => (
              <li key={f.id} className="flex items-center gap-4 px-5 py-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-vizme-navy/5 text-vizme-navy">
                  <Database size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-vizme-navy">{f.file_name}</p>
                  <p className="mt-0.5 flex items-center gap-3 text-xs text-vizme-greyblue">
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={11} />
                      {new Date(f.uploaded_at).toLocaleDateString('es-MX', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                    {f.file_size_bytes && (
                      <span className="font-mono">
                        {(f.file_size_bytes / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    )}
                  </p>
                </div>
                <span
                  className={[
                    'rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider',
                    f.processed_at
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-vizme-coral/10 text-vizme-coral',
                  ].join(' ')}
                >
                  {f.processed_at ? 'Procesado' : 'Pendiente'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Dashboard blocks placeholder — FASE 5+ */}
      <section>
        <div className="rounded-3xl border border-dashed border-vizme-navy/15 bg-gradient-to-br from-white/70 to-vizme-bg/40 p-10 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-vizme-coral/10 text-vizme-coral">
            <Activity size={22} />
          </div>
          <p className="mt-5 font-display text-2xl font-light tracking-editorial text-vizme-navy">
            Tu dashboard en vivo llega en el siguiente sprint.
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-vizme-greyblue text-pretty">
            Por ahora, sube datos nuevos para alimentar tu serie histórica — Haiku revisará
            cada upload contra el patrón habitual y te avisará si hay anomalías.
          </p>
        </div>
      </section>

      {/* Ingest modal */}
      {schema && id && (
        <IngestModal
          open={ingestOpen}
          onClose={() => setIngestOpen(false)}
          projectId={id}
          schema={schema}
          onCompleted={() => setReloadKey((k) => k + 1)}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-vizme-navy/8 bg-white/85 p-5 backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-soft">
      <div className="flex items-center gap-2 text-vizme-greyblue">
        <span className="text-vizme-coral">{icon}</span>
        <span className="text-[10px] uppercase tracking-[0.14em]">{label}</span>
      </div>
      <p className="mt-2 font-display text-3xl font-light text-vizme-navy">{value}</p>
    </div>
  );
}
