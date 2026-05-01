// Navegador horizontal entre páginas del dashboard. Editorial: tabs
// con underline coral cuando está activa, font-display para los títulos.

import * as Icons from 'lucide-react';
import type { DashboardPage } from '../../lib/v5types';

const ICON_FALLBACK = Icons.LayoutDashboard;

function resolveIcon(name: string | undefined) {
  if (!name) return ICON_FALLBACK;
  const lookup = (Icons as unknown as Record<string, typeof ICON_FALLBACK>)[name];
  return lookup ?? ICON_FALLBACK;
}

interface PageNavProps {
  pages: DashboardPage[];
  activeId: string;
  onSelect: (id: string) => void;
}

export default function PageNav({ pages, activeId, onSelect }: PageNavProps) {
  if (pages.length <= 1) return null;
  return (
    <nav className="flex flex-wrap gap-1 border-b border-vizme-navy/10 pb-3">
      {pages.map((p) => {
        const Icon = resolveIcon(p.icon);
        const isActive = p.id === activeId;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.id)}
            className={[
              'group inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all',
              isActive
                ? 'bg-vizme-navy text-white shadow-soft'
                : 'text-vizme-greyblue hover:bg-vizme-navy/5 hover:text-vizme-navy',
            ].join(' ')}
          >
            <Icon size={14} />
            <span>{p.title}</span>
          </button>
        );
      })}
    </nav>
  );
}
