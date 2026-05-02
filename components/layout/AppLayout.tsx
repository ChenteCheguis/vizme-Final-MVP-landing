import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { LogOut, FolderKanban, Sparkles, ChevronDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const isOnboarding = location.pathname.startsWith('/onboarding');
  const isProjectDetail = /^\/projects\/[^/]+/.test(location.pathname);
  const hideGlobalSidebar = isOnboarding || isProjectDetail;

  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? 'Tú';
  const initials = fullName.split(' ').slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'V';

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="relative min-h-screen bg-vizme-bg text-vizme-navy">
      {/* Atmospheric background */}
      <div className="pointer-events-none fixed inset-0 bg-mesh-vizme opacity-60" />
      <div className="pointer-events-none fixed inset-0 grain" />

      <div className="relative flex min-h-screen flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-vizme-navy/5 bg-white/70 backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between px-6">
            <button
              onClick={() => navigate(isOnboarding ? '/onboarding' : '/projects')}
              className="group flex items-center gap-3"
            >
              <div className="relative grid h-9 w-9 place-items-center rounded-xl bg-vizme-navy text-white shadow-glow-navy">
                <span className="font-display text-lg leading-none">V</span>
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-vizme-coral ring-2 ring-white" />
              </div>
              <div className="flex flex-col text-left leading-tight">
                <span className="text-sm font-semibold tracking-tight text-vizme-navy">Vizme</span>
                <span className="text-[10px] uppercase tracking-[0.18em] text-vizme-greyblue">
                  Studio
                </span>
              </div>
            </button>

            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-3 rounded-full border border-vizme-navy/10 bg-white px-3 py-1.5 transition-all hover:border-vizme-navy/25 hover:shadow-soft"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-vizme-coral to-vizme-orange text-xs font-semibold text-white">
                  {initials}
                </span>
                <span className="hidden text-sm font-medium text-vizme-navy md:inline">
                  {fullName.split(' ')[0]}
                </span>
                <ChevronDown size={14} className="text-vizme-greyblue" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-12 z-20 w-56 origin-top-right animate-scale-in rounded-2xl border border-vizme-navy/10 bg-white p-2 shadow-card">
                    <div className="border-b border-vizme-navy/5 p-3">
                      <p className="text-xs uppercase tracking-wide text-vizme-greyblue">Cuenta</p>
                      <p className="mt-1 truncate text-sm font-medium text-vizme-navy">
                        {user?.email}
                      </p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-vizme-navy transition-colors hover:bg-vizme-coral/8 hover:text-vizme-coral"
                    >
                      <LogOut size={16} />
                      Cerrar sesión
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Body: sidebar + content */}
        <div className="mx-auto flex w-full max-w-[1400px] flex-1 px-6">
          {/* Sidebar (hidden on onboarding + project detail; ProjectLayout owns its own sidebar) */}
          {!hideGlobalSidebar && (
            <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-56 shrink-0 flex-col py-8 pr-6 lg:flex">
              <p className="label-eyebrow px-3">Mi espacio</p>
              <nav className="mt-3 flex flex-col gap-1">
                <SidebarLink to="/projects" icon={<FolderKanban size={16} />} label="Mis proyectos" />
                <SidebarLink
                  to="/onboarding"
                  icon={<Sparkles size={16} />}
                  label="Nuevo proyecto"
                  accent
                />
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
          )}

          <main className="min-w-0 flex-1 py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

function SidebarLink({
  to,
  icon,
  label,
  accent = false,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  accent?: boolean;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          'group flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-all duration-200',
          isActive
            ? 'bg-vizme-navy text-white shadow-soft'
            : accent
            ? 'text-vizme-coral hover:bg-vizme-coral/8'
            : 'text-vizme-greyblue hover:bg-vizme-navy/5 hover:text-vizme-navy',
        ].join(' ')
      }
    >
      <span className="opacity-90">{icon}</span>
      <span className="font-medium">{label}</span>
    </NavLink>
  );
}
