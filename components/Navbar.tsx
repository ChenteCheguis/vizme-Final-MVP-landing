import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Navbar: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navLinks = [
    { label: 'Como funciona', href: '#como-funciona' },
    { label: 'Demo',          href: '#demo'          },
    { label: 'Planes',        href: '#planes'        },
  ];

  // On white backgrounds (scrolled), text needs to be dark
  const textBase = scrolled ? 'text-vizme-navy/60 hover:text-vizme-navy' : 'text-white/60 hover:text-white';
  const textBrand = scrolled ? 'text-vizme-navy' : 'text-white';

  return (
    <>
      <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-lg shadow-lg shadow-vizme-navy/5 border-b border-vizme-navy/8'
          : 'bg-transparent'
      }`}>
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex h-16 items-center justify-between">

            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5">
              <div
                className="h-7 w-7 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #F54A43, #F26A3D)' }}
              >
                <span className="text-[11px] font-black text-white">V</span>
              </div>
              <span className={`text-base font-black uppercase tracking-[0.18em] ${textBrand}`}>Vizme</span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  className={`px-4 py-2 text-sm font-medium rounded-lg hover:bg-vizme-navy/5 transition-all ${textBase}`}
                >
                  {label}
                </a>
              ))}
            </nav>

            {/* Desktop actions — only "Iniciar sesion" (no "Empezar gratis") */}
            <div className="hidden md:flex items-center gap-3">
              {user ? (
                <button
                  onClick={() => navigate('/dashboard')}
                  className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold border transition-all ${
                    scrolled
                      ? 'text-vizme-navy border-vizme-navy/15 hover:bg-vizme-navy/5'
                      : 'text-white border-white/15 hover:bg-white/10'
                  }`}
                >
                  Ir al app <ArrowRight size={14} />
                </button>
              ) : (
                <Link
                  to="/login"
                  className={`flex items-center gap-1.5 rounded-xl px-5 py-2 text-sm font-semibold border transition-all ${
                    scrolled
                      ? 'text-vizme-navy border-vizme-navy/15 hover:bg-vizme-navy/5'
                      : 'text-white border-white/15 hover:bg-white/10'
                  }`}
                >
                  Iniciar sesion
                </Link>
              )}
            </div>

            {/* Mobile toggle */}
            <button
              className={`md:hidden h-9 w-9 rounded-xl flex items-center justify-center ${scrolled ? 'bg-vizme-navy/5 text-vizme-navy' : 'bg-white/10 text-white'}`}
              onClick={() => setMenuOpen(v => !v)}
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-[#02222F]/95 backdrop-blur-xl"
            onClick={() => setMenuOpen(false)}
          />
          <div className="relative flex flex-col h-full pt-20 px-6 pb-10">
            <nav className="space-y-1 mb-8">
              {navLinks.map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-3.5 text-base font-medium text-white/70 hover:text-white rounded-xl hover:bg-white/8 transition-all"
                >
                  {label}
                </a>
              ))}
            </nav>
            <div className="mt-auto space-y-3">
              {user ? (
                <button
                  onClick={() => { navigate('/dashboard'); setMenuOpen(false); }}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white border border-white/20"
                >
                  Ir al app <ArrowRight size={14} />
                </button>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setMenuOpen(false)}
                  className="block w-full text-center rounded-2xl py-3.5 text-sm font-medium text-white/70 border border-white/15 hover:bg-white/8 transition-colors"
                >
                  Iniciar sesion
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
