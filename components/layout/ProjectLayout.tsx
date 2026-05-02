import { useEffect, useState } from 'react';
import {
  NavLink,
  Outlet,
  useParams,
  Link,
  useNavigate,
} from 'react-router-dom';
import {
  ArrowLeft,
  LayoutDashboard,
  FileText,
  FolderOpen,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Project } from '../../lib/v5types';

interface ProjectMenuItem {
  to: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

const PROJECT_MENU: ProjectMenuItem[] = [
  {
    to: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    description: 'Tus métricas en vivo',
  },
  {
    to: 'schema',
    label: 'Schema',
    icon: FileText,
    description: 'Lo que Vizme entendió',
  },
  {
    to: 'files',
    label: 'Archivos',
    icon: FolderOpen,
    description: 'Tus datos subidos',
  },
];

export default function ProjectLayout() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [healthStatus, setHealthStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [projRes, bpRes] = await Promise.all([
        supabase.from('projects').select('*').eq('id', id).single(),
        supabase
          .from('dashboard_blueprints')
          .select('health_status')
          .eq('project_id', id)
          .eq('is_active', true)
          .order('version', { ascending: false })
          .limit(1),
      ]);
      if (cancelled) return;
      if (projRes.error || !projRes.data) {
        setError('No encontramos este proyecto.');
        setLoading(false);
        return;
      }
      setProject(projRes.data as unknown as Project);
      setHealthStatus(
        (bpRes.data?.[0]?.health_status as string | undefined) ?? null
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, user]);

  if (loading) {
    return (
      <div className="grid place-items-center py-32">
        <div className="flex items-center gap-3 text-vizme-greyblue">
          <Loader2 size={18} className="animate-spin text-vizme-coral" />
          Cargando tu proyecto…
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
          <button
            type="button"
            onClick={() => navigate('/projects')}
            className="inline-flex items-center gap-2 text-sm font-medium text-vizme-coral hover:underline"
          >
            <ArrowLeft size={14} />
            Volver a mis proyectos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 gap-8">
      {/* Project sidebar */}
      <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-[240px] shrink-0 flex-col py-8 lg:flex">
        <Link
          to="/projects"
          className="mb-6 inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-vizme-greyblue transition-colors hover:text-vizme-coral"
        >
          <ArrowLeft size={11} />
          Mis proyectos
        </Link>

        <div className="mb-8">
          <p className="font-display text-2xl font-light leading-tight tracking-editorial text-vizme-navy text-balance">
            {project.name}
          </p>
          {project.description && (
            <p className="mt-2 text-xs leading-relaxed text-vizme-greyblue line-clamp-3">
              {project.description}
            </p>
          )}
        </div>

        <nav className="-mx-2 flex flex-col gap-0.5">
          {PROJECT_MENU.map((item) => {
            const Icon = item.icon;
            const isDashboard = item.to === 'dashboard';
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    'flex items-start gap-3 border-l-2 px-4 py-3 transition-all',
                    isActive
                      ? 'border-vizme-coral bg-vizme-coral/10 text-vizme-coral'
                      : 'border-transparent text-vizme-greyblue hover:bg-vizme-bg hover:text-vizme-navy',
                  ].join(' ')
                }
              >
                <Icon size={18} className="mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-sm font-medium leading-tight">
                    {item.label}
                    {isDashboard && healthStatus && (
                      <HealthDot status={healthStatus} />
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] leading-snug opacity-70">
                    {item.description}
                  </div>
                </div>
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-auto rounded-2xl border border-vizme-navy/8 bg-white/70 p-4 backdrop-blur">
          <p className="font-display text-sm leading-snug text-vizme-navy">
            Tu data, sin que la conviertas en problema.
          </p>
          <p className="mt-2 text-xs text-vizme-greyblue">
            Vizme aprende de tu negocio cada vez que subes algo nuevo.
          </p>
        </div>
      </aside>

      {/* Sub-route content */}
      <main className="min-w-0 flex-1 py-8">
        <Outlet context={{ project }} />
      </main>
    </div>
  );
}

function HealthDot({ status }: { status: string }) {
  const map: Record<string, { color: string; title: string }> = {
    complete: { color: 'bg-emerald-500', title: 'Dashboard completo' },
    partial: { color: 'bg-amber-500', title: 'Datos parciales' },
    limited: { color: 'bg-orange-500', title: 'Datos limitados' },
    no_data: { color: 'bg-rose-500', title: 'Sin datos' },
  };
  const cfg = map[status];
  if (!cfg) return null;
  return (
    <span
      className={['h-2 w-2 shrink-0 rounded-full', cfg.color].join(' ')}
      title={cfg.title}
      aria-label={cfg.title}
    />
  );
}

export interface ProjectOutletContext {
  project: Project;
}
