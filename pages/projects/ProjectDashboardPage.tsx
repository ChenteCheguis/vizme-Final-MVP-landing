import { useEffect, useState } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import { Sparkles, UploadCloud, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import IngestModal from '../../components/ingest/IngestModal';
import DashboardSection from '../../components/dashboard/DashboardSection';
import type { ProjectOutletContext } from '../../components/layout/ProjectLayout';
import type { BusinessSchema } from '../../lib/v5types';

export default function ProjectDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const { project } = useOutletContext<ProjectOutletContext>();
  const [schema, setSchema] = useState<BusinessSchema | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [ingestOpen, setIngestOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setSchemaLoading(true);
      const { data } = await supabase
        .from('business_schemas')
        .select('*')
        .eq('project_id', id)
        .order('version', { ascending: false })
        .limit(1);
      if (cancelled) return;
      setSchema((data?.[0] as unknown as BusinessSchema) ?? null);
      setSchemaLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  if (schemaLoading) {
    return (
      <div className="grid place-items-center py-32">
        <div className="flex items-center gap-3 text-vizme-greyblue">
          <Loader2 size={18} className="animate-spin text-vizme-coral" />
          Cargando tu dashboard…
        </div>
      </div>
    );
  }

  if (!schema) {
    return (
      <div className="space-y-10 animate-fade-in">
        <header>
          <p className="label-eyebrow">Dashboard</p>
          <h1 className="mt-2 font-display text-5xl font-light leading-[1.05] tracking-editorial text-vizme-navy text-balance">
            {project.name}
          </h1>
        </header>
        <section className="rounded-3xl border border-dashed border-vizme-greyblue/30 bg-white/60 p-12 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-vizme-coral/10 text-vizme-coral">
            <Sparkles size={22} />
          </div>
          <p className="mt-5 font-display text-2xl font-light text-vizme-navy">
            Aún no hay datos para mostrar.
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-vizme-greyblue">
            Sube tu primer archivo desde la pestaña Archivos para que diseñemos tu dashboard.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Page header — editorial */}
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <p className="label-eyebrow">Dashboard</p>
          <h1 className="mt-2 font-display text-5xl font-light leading-[1.05] tracking-editorial text-vizme-navy lg:text-6xl text-balance">
            {project.name}
          </h1>
          {project.description && (
            <p className="mt-3 max-w-2xl text-vizme-greyblue text-pretty">
              {project.description}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIngestOpen(true)}
          className="group inline-flex shrink-0 items-center gap-2 rounded-full bg-vizme-navy px-5 py-2.5 text-sm font-medium text-white shadow-soft transition-all hover:-translate-y-0.5 hover:bg-vizme-coral hover:shadow-glow-coral"
        >
          <UploadCloud size={15} />
          Subir nueva data
        </button>
      </header>

      {/* Question banner */}
      {project.question && (
        <div className="flex items-start gap-3 rounded-2xl border-l-4 border-vizme-coral bg-vizme-coral/5 p-4 max-w-3xl">
          <Sparkles size={16} className="mt-0.5 shrink-0 text-vizme-coral" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-vizme-coral">
              Tu pregunta original
            </p>
            <p className="mt-1 text-sm leading-relaxed text-vizme-navy">{project.question}</p>
          </div>
        </div>
      )}

      {/* Dashboard editorial multi-página */}
      {id && (
        <DashboardSection projectId={id} schemaId={schema.id} reloadKey={reloadKey} />
      )}

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
