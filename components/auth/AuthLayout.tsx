import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  eyebrow: string;
  quote: string;
  attribution?: string;
}

export default function AuthLayout({ children, eyebrow, quote, attribution }: Props) {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.1fr_1fr]">
      {/* Editorial side */}
      <aside className="relative hidden overflow-hidden bg-vizme-ink text-white lg:block">
        <div className="absolute inset-0 bg-mesh-night opacity-90" />
        <div className="absolute inset-0 grain mix-blend-screen opacity-[0.06]" />
        {/* Decorative geometry */}
        <div className="pointer-events-none absolute -left-24 top-1/3 h-96 w-96 rounded-full border border-white/[0.06]" />
        <div className="pointer-events-none absolute -left-12 top-1/3 h-96 w-96 rounded-full border border-white/[0.04]" />
        <div className="pointer-events-none absolute right-12 top-12 h-2 w-2 rounded-full bg-vizme-coral animate-pulse-soft" />

        <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
          {/* Top */}
          <div className="flex items-center gap-3">
            <Link to="/" className="group flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur">
                <span className="font-display text-xl text-white">V</span>
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-white">Vizme</p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">{eyebrow}</p>
              </div>
            </Link>
          </div>

          {/* Middle quote */}
          <div className="max-w-[34rem]">
            <p className="font-display text-5xl font-light leading-[1.05] tracking-editorial text-balance text-white xl:text-6xl">
              {renderQuoteWithAccent(quote)}
            </p>
            {attribution && (
              <p className="mt-6 inline-flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-white/55">
                <span className="h-px w-8 bg-white/30" />
                {attribution}
              </p>
            )}
          </div>

          {/* Bottom */}
          <div className="flex items-end justify-between text-xs text-white/40">
            <span className="font-mono">MMXXVI</span>
            <span>Hecho en México</span>
          </div>
        </div>
      </aside>

      {/* Form side */}
      <section className="relative flex min-h-screen flex-col bg-vizme-bg">
        <div className="pointer-events-none absolute inset-0 bg-mesh-vizme opacity-40" />
        <header className="relative flex items-center justify-between p-6 lg:hidden">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-vizme-navy text-white">
              <span className="font-display text-base">V</span>
            </div>
            <span className="font-semibold tracking-tight">Vizme</span>
          </Link>
        </header>
        <div className="relative flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-[28rem] animate-fade-in">{children}</div>
        </div>
      </section>
    </div>
  );
}

/**
 * Visual hack: highlight the last word of the quote in coral via a span,
 * so we get a sharp accent instead of a uniformly-distributed wall of text.
 */
function renderQuoteWithAccent(quote: string) {
  const words = quote.trim().split(/\s+/);
  if (words.length < 2) return <span>{quote}</span>;
  const lastTwo = words.slice(-2).join(' ');
  const head = words.slice(0, -2).join(' ');
  return (
    <>
      {head}{' '}
      <span className="relative whitespace-nowrap text-vizme-coral">
        {lastTwo}
        <span className="absolute -bottom-2 left-0 h-[3px] w-full rounded-full bg-vizme-coral/60" />
      </span>
    </>
  );
}
