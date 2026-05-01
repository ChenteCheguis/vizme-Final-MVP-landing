// Cápsula editorial común para los widgets — borde sutil, fondo blanco
// translúcido, título display + insight narrativo abajo.

import { Sparkles } from 'lucide-react';
import type { WidgetCardShellProps } from './widgetTypes';

export function WidgetShell({ title, subtitle, insight, children, className }: WidgetCardShellProps) {
  return (
    <article
      className={[
        'relative flex h-full flex-col rounded-3xl border border-vizme-navy/8 bg-white/85 p-6 backdrop-blur-md shadow-soft transition-all hover:-translate-y-0.5',
        className ?? '',
      ].join(' ')}
    >
      <header className="mb-4">
        <h3 className="font-display text-lg font-light tracking-editorial text-vizme-navy">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.16em] text-vizme-greyblue">
            {subtitle}
          </p>
        )}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
      {insight && (
        <footer className="mt-4 flex items-start gap-2 border-t border-vizme-navy/5 pt-3">
          <Sparkles size={12} className="mt-0.5 shrink-0 text-vizme-coral" />
          <p className="text-xs leading-relaxed text-vizme-greyblue text-pretty">{insight}</p>
        </footer>
      )}
    </article>
  );
}

export function EmptyWidget({ message }: { message?: string }) {
  return (
    <div className="grid h-full min-h-[140px] place-items-center rounded-2xl border border-dashed border-vizme-greyblue/25 bg-white/30 p-6 text-center">
      <p className="text-xs text-vizme-greyblue">
        {message ?? 'Sin datos suficientes para esta visualización.'}
      </p>
    </div>
  );
}
