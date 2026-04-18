import React from 'react';
import { BarChart2, AreaChart, PieChart, ScatterChart, Pencil, ExternalLink, Trash2 } from 'lucide-react';
import type { SavedDashboard } from '../../lib/chartEngine';
import type { ChartType } from '../../lib/chartEngine';

interface Props {
  dashboard: SavedDashboard;
  onOpen: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

const CHART_ICONS: Record<ChartType, React.ElementType> = {
  bar_horizontal: BarChart2,
  bar_vertical:   BarChart2,
  line:           AreaChart,
  area:           AreaChart,
  pie:            PieChart,
  donut:          PieChart,
  scatter:        ScatterChart,
  bubble:         ScatterChart,
  composed:       BarChart2,
  radialbar:      PieChart,
  funnel:         BarChart2,
};

const PERIOD_LABEL: Record<string, string> = {
  '7D': '7 días', '30D': '30 días', '90D': '90 días', all: 'Todo el tiempo',
};

const DashboardCard: React.FC<Props> = ({ dashboard, onOpen, onEdit, onDelete }) => {
  const chartTypes = dashboard.chartDecisions.slice(0, 4).map((c) => c.type);
  const createdAt = new Date(dashboard.createdAt).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  return (
    <div className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all group ${
      dashboard.isActive ? 'border-vizme-red/30 ring-1 ring-vizme-red/20' : 'border-vizme-navy/5'
    }`}>
      {/* Active badge */}
      {dashboard.isActive && (
        <div className="bg-vizme-red text-white text-[9px] font-bold uppercase tracking-widest text-center py-1 rounded-t-2xl">
          ACTIVO
        </div>
      )}

      <div className="p-4">
        {/* Chart type icons preview */}
        <div className="flex items-center gap-1.5 mb-3">
          {chartTypes.map((type, i) => {
            const Icon = CHART_ICONS[type] ?? BarChart2;
            return (
              <div key={i} className="h-7 w-7 rounded-lg bg-vizme-bg border border-vizme-navy/5 flex items-center justify-center">
                <Icon size={12} className="text-vizme-greyblue" />
              </div>
            );
          })}
          {dashboard.chartDecisions.length > 4 && (
            <div className="h-7 w-7 rounded-lg bg-vizme-bg border border-vizme-navy/5 flex items-center justify-center">
              <span className="text-[9px] font-bold text-vizme-greyblue">+{dashboard.chartDecisions.length - 4}</span>
            </div>
          )}
        </div>

        {/* Name */}
        <p className="text-sm font-semibold text-vizme-navy leading-tight mb-0.5">{dashboard.name}</p>
        {dashboard.description && (
          <p className="text-[11px] text-vizme-greyblue leading-relaxed mb-2 line-clamp-2">{dashboard.description}</p>
        )}

        {/* Meta */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-vizme-bg border border-vizme-navy/10 text-vizme-greyblue">
            {PERIOD_LABEL[dashboard.period] ?? dashboard.period}
          </span>
          <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-vizme-bg border border-vizme-navy/10 text-vizme-greyblue">
            {dashboard.chartDecisions.length} gráfica{dashboard.chartDecisions.length !== 1 ? 's' : ''}
          </span>
          {dashboard.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-vizme-navy/5 border border-vizme-navy/10 text-vizme-navy">
              {tag}
            </span>
          ))}
        </div>

        <p className="text-[10px] text-vizme-greyblue/60 mb-4">{createdAt}</p>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpen(dashboard.id)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-vizme-navy text-white text-xs font-semibold hover:bg-vizme-red transition-colors"
          >
            <ExternalLink size={11} /> Abrir
          </button>
          <button
            onClick={() => onEdit(dashboard.id)}
            className="flex items-center justify-center h-8 w-8 rounded-xl border border-vizme-navy/10 text-vizme-greyblue hover:text-vizme-navy hover:border-vizme-navy/20 transition-colors"
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={() => onDelete(dashboard.id)}
            className="flex items-center justify-center h-8 w-8 rounded-xl border border-vizme-red/10 text-vizme-red/40 hover:text-vizme-red hover:border-vizme-red/30 transition-colors"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardCard;
