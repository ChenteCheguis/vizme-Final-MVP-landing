import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useParams, NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboard, Database, Brain, MessageCircle,
  Plus, LogOut, Settings, Menu, X, Folder, FolderOpen,
  Building2, Users, Music2, ShoppingBag, Utensils, HardHat,
  HeartPulse, Cpu, Package, Factory, Landmark, BookOpen,
  ShoppingCart, Hotel, Wrench, ChevronRight, CalendarPlus, Flame,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';

function IndustryIcon({ industry, size = 14 }: { industry?: string; size?: number }) {
  const map: Record<string, React.ElementType> = {
    'Retail/Tienda': ShoppingBag, 'Restaurante/Food': Utensils,
    'Construcción': HardHat, 'Salud/Clínica': HeartPulse,
    'Tech/Software': Cpu, 'Distribución/Logística': Package,
    'Manufactura': Factory, 'Servicios Financieros': Landmark,
    'Educación': BookOpen, 'E-commerce': ShoppingCart,
    'Hospitalidad': Hotel, empresa: Building2, influencer: Users, artista: Music2,
  };
  const Icon = (industry && map[industry]) ? map[industry] : Wrench;
  return <Icon size={size} />;
}

const projectNav = [
  { label: 'Dashboard',       icon: LayoutDashboard, path: 'overview'  },
  { label: 'Mis Datos',       icon: Database,         path: 'data'     },
  { label: 'Entrada Semanal', icon: CalendarPlus,     path: 'weekly'   },
  { label: 'Analisis IA',     icon: Brain,             path: 'analysis' },
  { label: 'Copiloto',        icon: MessageCircle,     path: 'chat'     },
];

const ProjectLayout: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const { projects, activeProject, setActiveProject } = useProject();
  const { projectId } = useParams<{ projectId?: string }>();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [projectsExpanded, setProjectsExpanded] = useState(true);

  useEffect(() => {
    if (projectId) {
      const found = projects.find(p => p.id === projectId);
      if (found) setActiveProject(found);
    } else {
      setActiveProject(null);
    }
  }, [projectId, projects, setActiveProject]);

  const firstName    = profile?.full_name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'tú';
  const initials     = firstName.slice(0, 2).toUpperCase();
  const companyName  = profile?.company_name ?? 'Mi Empresa';
  const companyCtx   = (profile as any)?.company_context as Record<string, unknown> | null;
  const industryDetail = (companyCtx?.industryDetail as string) ?? profile?.industry ?? '';
  const streakWeeks = (profile as any)?.streak_weeks ?? 0;

  const handleSignOut = async () => { await signOut(); navigate('/'); };

  const Sidebar = () => (
    <div className="flex flex-col h-full bg-white border-r border-vizme-navy/8">

      {/* Logo */}
      <div className="px-5 pt-6 pb-5">
        <Link to="/dashboard/projects" className="flex items-center gap-2.5">
          <div
            className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #F54A43, #F26A3D)' }}
          >
            <span className="text-[11px] font-black text-white">V</span>
          </div>
          <span className="text-sm font-black uppercase tracking-[0.18em] text-vizme-navy">Vizme</span>
        </Link>
        <p className="text-xs text-vizme-greyblue mt-1.5 pl-0.5 truncate">{companyName}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 min-h-0 pb-3">

        {/* Projects list */}
        <div className="mb-2">
          <button
            onClick={() => setProjectsExpanded(v => !v)}
            className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] font-semibold text-vizme-greyblue hover:text-vizme-navy transition-colors"
          >
            <span>PROYECTOS</span>
            <div className="flex items-center gap-1">
              <button
                onClick={e => { e.stopPropagation(); navigate('/dashboard/projects/new'); setMobileOpen(false); }}
                className="h-5 w-5 rounded-md bg-vizme-red/10 hover:bg-vizme-red/20 flex items-center justify-center transition-colors"
                title="Nuevo proyecto"
              >
                <Plus size={11} className="text-vizme-red" />
              </button>
              <ChevronRight
                size={12}
                className={`text-vizme-greyblue/50 transition-transform ${projectsExpanded ? 'rotate-90' : ''}`}
              />
            </div>
          </button>

          {projectsExpanded && (
            <div className="mt-1 space-y-0.5">
              {projects.length === 0 ? (
                <button
                  onClick={() => { navigate('/dashboard/projects/new'); setMobileOpen(false); }}
                  className="w-full text-left px-3 py-2.5 text-xs text-vizme-greyblue hover:text-vizme-red rounded-xl hover:bg-vizme-red/5 transition-all"
                >
                  + Crear mi primer proyecto
                </button>
              ) : (
                projects.map(proj => {
                  const isActive = proj.id === projectId;
                  return (
                    <button
                      key={proj.id}
                      onClick={() => { navigate(`/dashboard/projects/${proj.id}/overview`); setMobileOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all ${
                        isActive
                          ? 'bg-vizme-navy text-white'
                          : 'text-vizme-greyblue hover:bg-vizme-navy/5 hover:text-vizme-navy'
                      }`}
                    >
                      <div className={`h-5 w-5 rounded-md flex items-center justify-center flex-shrink-0 ${
                        isActive ? 'bg-white/15' : 'bg-vizme-navy/6'
                      }`}>
                        {isActive
                          ? <FolderOpen size={11} className="text-white" />
                          : <Folder size={11} className="text-vizme-greyblue" />
                        }
                      </div>
                      <span className="text-xs font-medium truncate flex-1">{proj.name}</span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Project sub-nav */}
        {projectId && activeProject && (
          <div className="mt-4 pt-4 border-t border-vizme-navy/6">
            <div className="flex items-center gap-1.5 px-2 mb-2">
              <IndustryIcon industry={industryDetail} size={11} />
              <p className="text-[11px] font-semibold text-vizme-greyblue truncate">{activeProject.name}</p>
            </div>
            <div className="space-y-0.5">
              {projectNav.map(({ label, icon: Icon, path }) => (
                <NavLink
                  key={path}
                  to={`/dashboard/projects/${projectId}/${path}`}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-vizme-red/8 text-vizme-red'
                        : 'text-vizme-greyblue hover:bg-vizme-navy/5 hover:text-vizme-navy'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={14} className={isActive ? 'text-vizme-red' : ''} />
                      {label}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* User section */}
      <div className="px-3 pb-4 pt-3 border-t border-vizme-navy/6">
        <div className="flex items-center gap-2.5 px-2 py-2 mb-1">
          <div className="h-8 w-8 rounded-full bg-vizme-navy flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-white">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-semibold text-vizme-navy truncate">{firstName}</p>
              {streakWeeks > 0 && (
                <span className="flex items-center gap-0.5 text-[9px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full flex-shrink-0">
                  <Flame size={8} className="fill-orange-500" /> {streakWeeks}
                </span>
              )}
            </div>
            <p className="text-[10px] text-vizme-greyblue truncate">{user?.email}</p>
          </div>
        </div>
        <div className="space-y-0.5">
          <button className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs text-vizme-greyblue hover:text-vizme-navy hover:bg-vizme-navy/5 transition-colors">
            <Settings size={13} /> Configuración
          </button>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs text-vizme-greyblue hover:text-vizme-red hover:bg-vizme-red/5 transition-colors"
          >
            <LogOut size={13} /> Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-vizme-bg overflow-hidden">

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 flex-shrink-0">
        <Sidebar />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-60 flex-shrink-0 shadow-2xl">
            <Sidebar />
          </aside>
          <button
            onClick={() => setMobileOpen(false)}
            className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-white"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile topbar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-vizme-navy/8">
          <button
            onClick={() => setMobileOpen(true)}
            className="h-9 w-9 rounded-xl bg-vizme-bg flex items-center justify-center"
          >
            <Menu size={18} className="text-vizme-navy" />
          </button>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-bold text-vizme-navy truncate">
              {activeProject ? activeProject.name : 'Vizme'}
            </span>
          </div>
          <div
            className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #F54A43, #F26A3D)' }}
          >
            <span className="text-[10px] font-bold text-white">{initials}</span>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default ProjectLayout;
