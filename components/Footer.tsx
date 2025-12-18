import React from 'react';
import { Instagram, Facebook, Linkedin, Mail } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="border-t border-vizme-navy/10 bg-vizme-navy py-16">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-10 md:grid-cols-3 md:items-start">
          
          {/* Brand Column */}
          <div className="space-y-4">
            <div className="flex flex-col">
              <span className="text-xl font-bold text-white uppercase tracking-widest">Vizme</span>
              <span className="text-[10px] text-vizme-grey uppercase tracking-[0.3em]">dashboards e insights</span>
            </div>
            <p className="text-sm text-vizme-grey max-w-xs leading-relaxed">
              Deja que los datos trabajen para ti.
            </p>
          </div>

          {/* Contact Column */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-widest">Contacto Directo</h4>
            <div className="space-y-3">
              <a 
                href="mailto:diego@vizme.com.mx" 
                className="flex items-center gap-3 text-vizme-grey hover:text-white transition-colors group"
              >
                <div className="p-2 rounded-lg bg-white/5 border border-white/10 group-hover:bg-vizme-red/20 group-hover:border-vizme-red/30 transition-all">
                  <Mail size={16} />
                </div>
                <span className="text-sm">diego@vizme.com.mx</span>
              </a>
              <a 
                href="https://www.linkedin.com/company/vizme-com-mx/?viewAsMember=true" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center gap-3 text-vizme-grey hover:text-white transition-colors group"
              >
                <div className="p-2 rounded-lg bg-white/5 border border-white/10 group-hover:bg-vizme-red/20 group-hover:border-vizme-red/30 transition-all">
                  <Linkedin size={16} />
                </div>
                <span className="text-sm">Vizme LinkedIn</span>
              </a>
            </div>
          </div>

          {/* Social Links */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-widest">Siguenos</h4>
            <div className="flex gap-4">
              <a href="https://www.instagram.com/vizme.io/" target="_blank" rel="noopener noreferrer" className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-vizme-grey hover:text-white hover:bg-vizme-red/20 transition-all">
                <Instagram size={20} />
              </a>
              <a href="https://www.facebook.com/profile.php?id=61557174016134" target="_blank" rel="noopener noreferrer" className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-vizme-grey hover:text-white hover:bg-vizme-red/20 transition-all">
                <Facebook size={20} />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-16 flex justify-center items-center border-t border-white/5 pt-8 text-[10px] text-vizme-grey uppercase tracking-widest text-center">
          <p>© 2025 Vizme.com.mx Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;