import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import type { SavedDashboard } from '../../lib/chartEngine';

interface Props {
  dashboard: SavedDashboard;
  onSave: (id: string, patch: Partial<SavedDashboard>) => void;
  onClose: () => void;
}

const PERIOD_OPTIONS = [
  { id: '7D',  label: 'Últimos 7 días' },
  { id: '30D', label: 'Últimos 30 días' },
  { id: '90D', label: 'Últimos 90 días' },
  { id: 'all', label: 'Todo el tiempo' },
] as const;

const DashboardEditModal: React.FC<Props> = ({ dashboard, onSave, onClose }) => {
  const [name, setName] = useState(dashboard.name);
  const [description, setDescription] = useState(dashboard.description);
  const [period, setPeriod] = useState(dashboard.period);
  const [selectedCharts, setSelectedCharts] = useState(
    new Set(dashboard.chartDecisions.map((c) => c.id))
  );
  const [tag, setTag] = useState('');
  const [tags, setTags] = useState(dashboard.tags);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const toggleChart = (id: string) => {
    setSelectedCharts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addTag = () => {
    const t = tag.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTag('');
  };

  const handleSave = () => {
    onSave(dashboard.id, {
      name,
      description,
      period,
      tags,
      chartDecisions: dashboard.chartDecisions.filter((c) => selectedCharts.has(c.id)),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-vizme-navy/5 sticky top-0 bg-white">
          <p className="text-sm font-semibold text-vizme-navy">Editar dashboard</p>
          <button onClick={onClose} className="text-vizme-greyblue hover:text-vizme-navy transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-[10px] font-bold text-vizme-navy uppercase tracking-wide mb-1.5">Nombre</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-vizme-navy/10 text-sm text-vizme-navy focus:outline-none focus:ring-1 focus:ring-vizme-red/40 bg-vizme-bg"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-bold text-vizme-navy uppercase tracking-wide mb-1.5">Descripción (opcional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-vizme-navy/10 text-sm text-vizme-navy focus:outline-none focus:ring-1 focus:ring-vizme-red/40 bg-vizme-bg resize-none"
            />
          </div>

          {/* Period */}
          <div>
            <label className="block text-[10px] font-bold text-vizme-navy uppercase tracking-wide mb-1.5">Período por defecto</label>
            <div className="grid grid-cols-2 gap-2">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setPeriod(opt.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
                    period === opt.id
                      ? 'bg-vizme-navy text-white border-vizme-navy'
                      : 'bg-vizme-bg text-vizme-greyblue border-vizme-navy/10 hover:border-vizme-navy/20'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Charts selection */}
          {dashboard.chartDecisions.length > 0 && (
            <div>
              <label className="block text-[10px] font-bold text-vizme-navy uppercase tracking-wide mb-2">
                Gráficas incluidas ({selectedCharts.size}/{dashboard.chartDecisions.length})
              </label>
              <div className="space-y-1.5">
                {dashboard.chartDecisions.map((chart) => (
                  <label key={chart.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCharts.has(chart.id)}
                      onChange={() => toggleChart(chart.id)}
                      className="rounded accent-vizme-red"
                    />
                    <span className="text-xs text-vizme-navy">{chart.title}</span>
                    <span className="text-[9px] text-vizme-greyblue uppercase">{chart.type}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          <div>
            <label className="block text-[10px] font-bold text-vizme-navy uppercase tracking-wide mb-1.5">Etiquetas</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((t) => (
                <span key={t} className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-vizme-bg border border-vizme-navy/10 text-vizme-greyblue">
                  {t}
                  <button onClick={() => setTags((prev) => prev.filter((x) => x !== t))} className="hover:text-vizme-red">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTag()}
                placeholder="Añadir etiqueta"
                className="flex-1 px-3 py-1.5 rounded-xl border border-vizme-navy/10 text-xs focus:outline-none focus:ring-1 focus:ring-vizme-red/40 bg-vizme-bg"
              />
              <button onClick={addTag} className="px-3 py-1.5 rounded-xl bg-vizme-bg border border-vizme-navy/10 text-xs text-vizme-greyblue hover:text-vizme-navy">
                +
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-vizme-navy/5 flex justify-end gap-2 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-vizme-navy/10 text-sm text-vizme-greyblue hover:text-vizme-navy transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-vizme-red text-white text-sm font-semibold hover:bg-vizme-orange transition-colors"
          >
            <Save size={13} /> Guardar
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardEditModal;
