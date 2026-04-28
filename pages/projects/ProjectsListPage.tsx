import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowRight,
  Sparkles,
  Plus,
  FolderKanban,
  Calendar,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  question: string | null;
  created_at: string;
  has_schema: boolean;
  latest_industry: string | null;
}

export default function ProjectsListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        // Fetch projects + their latest schema's industry (single round trip via embedded select)
        const { data, error: err } = await supabase
          .from('projects')
          .select(
            'id, name, description, question, created_at, business_schemas ( business_identity, version )'
          )
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (cancelled) return;
        if (err) throw err;
        const rows: ProjectRow[] = (data ?? []).map((p: any) => {
          const schemas = (p.business_schemas ?? []) as Array<{
            business_identity: { industry?: string; sub_industry?: string };
            version: number;
          }>;
          const latest = schemas.sort((a, b) => b.version - a.version)[0];
          return {
            id: p.id,
            name: p.name,
            description: p.description,
            question: p.question,
            created_at: p.created_at,
            has_schema: schemas.length > 0,
            latest_industry:
              latest?.business_identity?.sub_industry ||
              latest?.business_identity?.industry ||
              null,
          };
        });
        setProjects(rows);
      } catch (err) {
        if (cancelled) return;
        setError((err as Error).message ?? 'No pudimos cargar tus proyectos.');
        setProjects([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Loading
  if (projects === null && !error) {
    return (
      <div className="grid place-items-center py-32">
        <div className="flex items-center gap-3 text-vizme-greyblue">
          <Loader2 size={18} className="animate-spin text-vizme-coral" />
          Cargando tus proyectos…
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="grid place-items-center py-24">
        <div className="max-w-md space-y-4 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-vizme-coral/10 text-vizme-coral">
            <AlertCircle size={24} />
          </div>
          <p className="text-vizme-navy">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="text-sm font-medium text-vizme-coral hover:underline"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // Empty state — first-time user
  if (projects && projects.length === 0) {
    return <EmptyState onStart={() => navigate('/onboarding')} />;
  }

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Header — editorial, asymmetric */}
      <header className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="label-eyebrow">Tu espacio · {projects?.length ?? 0} proyecto{(projects?.length ?? 0) === 1 ? '' : 's'}</p>
          <h1 className="mt-2 font-display text-5xl font-light leading-[1.05] tracking-editorial text-vizme-navy lg:text-6xl">
            Tus negocios,{' '}
            <span className="italic text-vizme-coral" style={{ fontVariationSettings: '"opsz" 144, "SOFT" 80' }}>
              entendidos
            </span>
            .
          </h1>
          <p className="mt-3 max-w-lg text-vizme-greyblue text-pretty">
            Cada proyecto es un negocio que Vizme aprendió a interpretar. Abre uno para ver
            su dashboard o sube datos nuevos.
          </p>
        </div>

        <Link
          to="/onboarding"
          className="group inline-flex items-center gap-2 self-start rounded-full bg-vizme-coral px-6 py-3 font-medium text-white shadow-glow-coral transition-all hover:-translate-y-0.5 hover:bg-vizme-orange lg:self-end"
        >
          <Plus size={16} />
          Nuevo proyecto
        </Link>
      </header>

      {/* Project cards grid */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {projects?.map((p, idx) => (
          <ProjectCard
            key={p.id}
            project={p}
            onClick={() => navigate(`/projects/${p.id}`)}
            delay={idx * 60}
          />
        ))}

        {/* Add-new tile, only when there are existing projects */}
        <button
          type="button"
          onClick={() => navigate('/onboarding')}
          className="group relative flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-vizme-greyblue/30 bg-white/30 p-6 text-vizme-greyblue transition-all hover:-translate-y-0.5 hover:border-vizme-coral hover:bg-vizme-coral/5 hover:text-vizme-coral"
        >
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-vizme-coral/8 text-vizme-coral transition-transform group-hover:scale-110">
            <Plus size={20} />
          </span>
          <span className="font-medium">Crear otro</span>
          <span className="text-xs opacity-80">Nuevo análisis</span>
        </button>
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  onClick,
  delay,
}: {
  project: ProjectRow;
  onClick: () => void;
  delay: number;
}) {
  const created = new Date(project.created_at);
  const dateStr = created.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden rounded-3xl border border-vizme-navy/8 bg-white p-6 text-left shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-vizme-coral/30 hover:shadow-card animate-slide-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-vizme-coral/8 blur-2xl opacity-0 transition-opacity group-hover:opacity-100" />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-vizme-navy text-white">
            <FolderKanban size={16} />
          </div>
          {project.has_schema ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-emerald-700">
              <Sparkles size={10} />
              Schema listo
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-vizme-coral/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-vizme-coral">
              Sin analizar
            </span>
          )}
        </div>

        <h3 className="mt-4 font-display text-2xl font-light leading-tight tracking-editorial text-vizme-navy line-clamp-2">
          {project.name}
        </h3>

        {project.latest_industry && (
          <p className="mt-1.5 text-xs uppercase tracking-[0.14em] text-vizme-coral">
            {project.latest_industry}
          </p>
        )}

        {project.description && (
          <p className="mt-3 text-sm leading-relaxed text-vizme-greyblue line-clamp-2">
            {project.description}
          </p>
        )}

        <div className="mt-5 flex items-center justify-between border-t border-vizme-navy/5 pt-4">
          <span className="inline-flex items-center gap-1.5 text-xs text-vizme-greyblue">
            <Calendar size={12} />
            {dateStr}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-vizme-coral opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5">
            Abrir
            <ArrowRight size={12} />
          </span>
        </div>
      </div>
    </button>
  );
}

function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="grid min-h-[60vh] place-items-center animate-fade-in">
      <div className="relative mx-auto max-w-2xl text-center">
        {/* Floating decoration */}
        <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-72 w-72 -translate-x-1/2 -translate-y-1/4 rounded-full bg-vizme-coral/15 blur-3xl" />

        <div className="mx-auto mb-8 grid h-20 w-20 place-items-center rounded-3xl bg-vizme-navy text-white shadow-glow-navy">
          <Sparkles size={32} />
        </div>

        <p className="label-eyebrow">Tu primer proyecto</p>
        <h1 className="mt-3 font-display text-5xl font-light leading-[1.05] tracking-editorial text-vizme-navy lg:text-6xl">
          Aún no has subido nada.{' '}
          <span className="italic text-vizme-coral" style={{ fontVariationSettings: '"opsz" 144, "SOFT" 80' }}>
            Empecemos
          </span>
          .
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-vizme-greyblue text-pretty">
          Sube tu primer Excel o CSV y deja que Vizme convierta tu data en algo que entiendas
          de un vistazo.
        </p>

        <button
          type="button"
          onClick={onStart}
          className="group mt-8 inline-flex items-center gap-2 rounded-full bg-vizme-coral px-7 py-3 font-medium text-white shadow-glow-coral transition-all hover:-translate-y-0.5 hover:bg-vizme-orange"
        >
          Crear mi primer proyecto
          <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}
