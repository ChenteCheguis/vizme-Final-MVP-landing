import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Linkedin, Mail } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="border-t border-white/5 bg-vizme-navy py-16">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-10 md:grid-cols-4 md:items-start">

          {/* Brand */}
          <div className="md:col-span-1 space-y-4">
            <div className="flex flex-col">
              <span className="text-xl font-bold text-white uppercase tracking-widest">Vizme</span>
              <span className="text-[10px] text-vizme-grey uppercase tracking-[0.3em]">Business Intelligence</span>
            </div>
            <p className="text-sm text-vizme-grey max-w-xs leading-relaxed">
              Convierte tus datos de Excel en inteligencia de negocio accionable. Sin consultores, sin código.
            </p>
            <div className="flex gap-3">
              <a
                href="https://www.instagram.com/vizme_mx/"
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 w-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-vizme-grey hover:text-white hover:bg-vizme-red/20 transition-all"
              >
                <Instagram size={16} />
              </a>
              <a
                href="https://www.linkedin.com/company/vizme-com-mx/?viewAsMember=true"
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 w-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-vizme-grey hover:text-white hover:bg-vizme-red/20 transition-all"
              >
                <Linkedin size={16} />
              </a>
            </div>
          </div>

          {/* Navigation */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-widest">Producto</h4>
            <ul className="space-y-2.5">
              {[
                { label: 'Inicio', href: '/' },
                { label: 'Demo interactivo', href: '#demo' },
                { label: 'Cómo funciona', href: '#como-funciona' },
                { label: 'Planes y precios', href: '#planes' },
              ].map(({ label, href }) => (
                <li key={label}>
                  {href.startsWith('#') ? (
                    <a href={href} className="text-sm text-vizme-grey hover:text-white transition-colors">
                      {label}
                    </a>
                  ) : (
                    <Link to={href} className="text-sm text-vizme-grey hover:text-white transition-colors">
                      {label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Account */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-widest">Cuenta</h4>
            <ul className="space-y-2.5">
              {[
                { label: 'Iniciar sesión', href: '/login' },
                { label: 'Registrarse gratis', href: '/register' },
                { label: 'Mi Dashboard', href: '/dashboard' },
              ].map(({ label, href }) => (
                <li key={label}>
                  <Link to={href} className="text-sm text-vizme-grey hover:text-white transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-widest">Contacto</h4>
            <a
              href="mailto:diego@vizme.com.mx"
              className="flex items-center gap-3 text-vizme-grey hover:text-white transition-colors group"
            >
              <div className="p-2 rounded-lg bg-white/5 border border-white/10 group-hover:bg-vizme-red/20 group-hover:border-vizme-red/30 transition-all">
                <Mail size={15} />
              </div>
              <span className="text-sm">diego@vizme.com.mx</span>
            </a>
            <div className="mt-4 space-y-2.5">
              {[
                { label: 'Política de privacidad', href: '/privacidad' },
                { label: 'Términos y condiciones', href: '/terminos' },
              ].map(({ label, href }) => (
                <Link key={label} to={href} className="block text-sm text-vizme-grey/60 hover:text-white transition-colors">
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/5 pt-8">
          <p className="text-[11px] text-vizme-grey/50 uppercase tracking-widest">
            © {new Date().getFullYear()} Vizme.com.mx · Todos los derechos reservados.
          </p>
          <p className="text-[11px] text-vizme-grey/30">
            Hecho en México con datos, IA y mucho café.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
