import React from 'react';
import { Instagram, Facebook } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="border-t border-white/5 bg-vizme-navy py-12">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          
          <div className="flex items-center gap-3">
             {/* REMOVED LOGO HERE */}
            <div>
              <p className="text-sm font-bold text-white uppercase tracking-widest">Vizme</p>
              <p className="text-xs text-gray-400">Dashboards e insights accionables.</p>
            </div>
          </div>

          <div className="flex gap-6">
            <a href="https://www.instagram.com/vizme.io/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
              <Instagram size={18} />
            </a>
            <a href="https://www.facebook.com/profile.php?id=61557174016134" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
              <Facebook size={18} />
            </a>
          </div>
        </div>

        <div className="mt-8 flex flex-col md:flex-row justify-between items-center border-t border-white/10 pt-8 text-xs text-gray-500">
          <p>© 2025 Vizme Inc. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;