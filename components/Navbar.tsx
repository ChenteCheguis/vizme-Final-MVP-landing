import React, { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';

const Navbar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${isScrolled ? 'pt-2' : 'pt-0'}`}>
      <div className={`mx-auto max-w-6xl px-4 transition-all duration-300 ${isScrolled ? 'pt-0' : 'pt-4'}`}>
        <div className={`relative flex items-center justify-between rounded-2xl border px-4 py-3 backdrop-blur-md transition-all duration-300 ${
          isScrolled 
            ? 'border-vizme-grey/20 bg-white/80 shadow-lg shadow-vizme-navy/5' 
            : 'border-transparent bg-transparent'
        }`}>
          {/* Logo Section */}
          <div className="flex flex-col">
            <span className="text-sm font-bold uppercase tracking-[0.2em] text-vizme-navy">Vizme</span>
            <span className="hidden sm:block text-[10px] text-vizme-greyblue">Dashboards e insights</span>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-vizme-greyblue">
            <a href="#como-funciona" className="hover:text-vizme-navy transition-colors">Cómo funciona</a>
            <a href="#para-quien" className="hover:text-vizme-navy transition-colors">Para quién</a>
            <a href="#cta" className="group flex items-center gap-2 rounded-full bg-vizme-red px-4 py-1.5 text-white transition-all hover:bg-vizme-orange hover:shadow-lg hover:shadow-vizme-red/20">
              Solicitar demo
              <span className="flex h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]"></span>
            </a>
          </nav>

          {/* Mobile Menu Toggle */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-vizme-navy hover:text-vizme-red"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Nav Dropdown */}
      {mobileMenuOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 mx-4 p-4 rounded-2xl border border-vizme-grey/20 bg-white/95 backdrop-blur-xl md:hidden flex flex-col gap-4 text-center shadow-2xl">
          <a href="#como-funciona" onClick={() => setMobileMenuOpen(false)} className="text-sm text-vizme-greyblue py-2">Cómo funciona</a>
          <a href="#para-quien" onClick={() => setMobileMenuOpen(false)} className="text-sm text-vizme-greyblue py-2">Para quién</a>
          <a href="#cta" onClick={() => setMobileMenuOpen(false)} className="mx-auto inline-flex items-center justify-center rounded-full bg-vizme-red px-6 py-2 text-sm font-medium text-white">
            Solicitar demo
          </a>
        </div>
      )}
    </header>
  );
};

export default Navbar;