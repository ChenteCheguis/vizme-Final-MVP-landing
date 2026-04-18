import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  CalendarPlus, Plus, Trash2, Save, Loader2, CheckCircle2,
  AlertCircle, Clock, TrendingUp, FileSpreadsheet,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';

// ─── Types ──────────────────────────────────────────────────────────────────

interface WeeklyEntry {
  id: string;
  period_label: string;
  entry_data: Record<string, string | number>;
  created_at: string;
  file_id: string | null;
}

interface MetricField {
  key: string;
  label: string;
  type: 'number' | 'currency' | 'percentage';
  placeholder: string;
}

// ─── Detect metrics from existing files ─────────────────────────────────────

function detectMetrics(files: any[]): MetricField[] {
  const metrics: MetricField[] = [];
  const seen = new Set<string>();

  // Priority 1: Use metrics_for_weekly_entry from structural_map (Claude's recommendation)
  for (const file of files) {
    const weeklyFields = file.structural_map?.metrics_for_weekly_entry;
    if (!Array.isArray(weeklyFields)) continue;

    for (const field of weeklyFields) {
      if (!field.field_name || seen.has(field.field_name)) continue;
      seen.add(field.field_name);
      metrics.push({
        key: field.field_name,
        label: field.label ?? field.field_name,
        type: field.type === 'currency' ? 'currency' : field.type === 'percentage' ? 'percentage' : 'number',
        placeholder: field.example_value ?? (field.type === 'currency' ? '$0' : '0'),
      });
    }
  }

  // Priority 2: Fall back to numeric columns from enriched profile
  if (metrics.length === 0) {
    for (const file of files) {
      const ep = file.enriched_profile;
      if (!ep?.numericColumns) continue;

      for (const col of ep.numericColumns) {
        const key = col.toLowerCase().replace(/\s+/g, '_');
        if (seen.has(key)) continue;
        seen.add(key);

        const lc = col.toLowerCase();
        const isCurrency = /venta|ingreso|costo|gasto|revenue|precio|monto|total|factur/i.test(lc);
        const isPct = /porcentaje|pct|tasa|rate|margen|%/i.test(lc);

        metrics.push({
          key,
          label: col,
          type: isCurrency ? 'currency' : isPct ? 'percentage' : 'number',
          placeholder: isCurrency ? '$0' : isPct ? '0%' : '0',
        });
      }
    }
  }

  // Priority 3: Default fields if nothing found
  if (metrics.length === 0) {
    return [
      { key: 'ventas', label: 'Ventas', type: 'currency', placeholder: '$0' },
      { key: 'clientes', label: 'Clientes', type: 'number', placeholder: '0' },
      { key: 'gastos', label: 'Gastos', type: 'currency', placeholder: '$0' },
    ];
  }

  return metrics.slice(0, 10);
}

// ─── Period label helpers ────────────────────────────────────────────────────

function getCurrentWeekLabel(): string {
  const now = new Date();
  const weekNum = Math.ceil((now.getDate()) / 7);
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `Semana ${weekNum} ${months[now.getMonth()]} ${now.getFullYear()}`;
}

// ─── Page ───────────────────────────────────────────────────────────────────

const WeeklyEntryPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const { activeProject } = useProject();

  const [entries, setEntries] = useState<WeeklyEntry[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form state
  const [periodLabel, setPeriodLabel] = useState(getCurrentWeekLabel());
  const [formData, setFormData] = useState<Record<string, string>>({});

  const metrics = detectMetrics(files);

  // Load data
  const loadData = useCallback(async () => {
    if (!user || !projectId) return;

    const [entriesRes, filesRes] = await Promise.all([
      supabase
        .from('weekly_entries')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('files')
        .select('id, enriched_profile, structural_map')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .eq('is_active', true),
    ]);

    setEntries((entriesRes.data ?? []) as WeeklyEntry[]);
    setFiles(filesRes.data ?? []);
    setLoading(false);
  }, [user, projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Save entry
  const handleSave = async () => {
    if (!user || !projectId || !periodLabel.trim()) return;

    // Convert form values to numbers
    const entryData: Record<string, number> = {};
    for (const m of metrics) {
      const raw = formData[m.key];
      if (raw) {
        const num = parseFloat(raw.replace(/[$,%\s]/g, ''));
        if (!isNaN(num)) entryData[m.key] = num;
      }
    }

    if (Object.keys(entryData).length === 0) return;

    setSaving(true);
    try {
      const { error } = await supabase.from('weekly_entries').insert({
        project_id: projectId,
        user_id: user.id,
        period_label: periodLabel.trim(),
        entry_data: entryData,
      });

      if (error) throw error;

      // Update streak
      await supabase.from('profiles').update({
        streak_weeks: (entries.length > 0 ? entries.length + 1 : 1),
        last_data_update: new Date().toISOString(),
      }).eq('id', user.id);

      setSuccess(true);
      setFormData({});
      setPeriodLabel(getCurrentWeekLabel());
      setTimeout(() => setSuccess(false), 3000);
      loadData();
    } catch (err: any) {
      console.error('Error saving weekly entry:', err);
      alert('Error guardando: ' + (err?.message ?? 'Intenta de nuevo'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta entrada?')) return;
    await supabase.from('weekly_entries').delete().eq('id', id);
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-vizme-greyblue" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <p className="text-xs text-vizme-greyblue font-medium mb-0.5">
          {activeProject?.name ?? 'Proyecto'}
        </p>
        <h1 className="text-2xl font-bold text-vizme-navy flex items-center gap-2">
          <CalendarPlus size={22} className="text-vizme-red" />
          Entrada Semanal
        </h1>
        <p className="text-sm text-vizme-greyblue mt-1">
          Actualiza tus metricas clave sin subir archivos. Vizme recalcula tu dashboard automaticamente.
        </p>
      </div>

      {/* Quick entry form */}
      <div className="rounded-2xl border border-vizme-navy/8 bg-white overflow-hidden">
        <div className="p-5 border-b border-vizme-navy/6 bg-vizme-bg/40">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-vizme-red/10 flex items-center justify-center flex-shrink-0">
              <Plus size={18} className="text-vizme-red" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-vizme-navy">Nueva entrada</p>
              <p className="text-xs text-vizme-greyblue">Ingresa los datos mas recientes de tu negocio</p>
            </div>
            {success && (
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
                <CheckCircle2 size={12} /> Guardado
              </span>
            )}
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Period */}
          <div>
            <label className="block text-xs font-medium text-vizme-navy mb-1.5">Periodo</label>
            <input
              value={periodLabel}
              onChange={e => setPeriodLabel(e.target.value)}
              placeholder="Ej: Semana 1 Abril 2026"
              className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-vizme-navy/12 bg-white text-vizme-navy placeholder-vizme-greyblue/40 focus:outline-none focus:ring-2 focus:ring-vizme-red/20 focus:border-vizme-red transition-all"
            />
          </div>

          {/* Metric fields */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {metrics.map(m => (
              <div key={m.key}>
                <label className="block text-[10px] font-semibold text-vizme-greyblue uppercase tracking-wider mb-1">{m.label}</label>
                <div className="relative">
                  {m.type === 'currency' && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-vizme-greyblue text-xs">$</span>
                  )}
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formData[m.key] ?? ''}
                    onChange={e => setFormData(prev => ({ ...prev, [m.key]: e.target.value }))}
                    placeholder={m.placeholder}
                    className={`w-full text-sm py-2.5 rounded-xl border border-vizme-navy/12 bg-vizme-bg text-vizme-navy placeholder-vizme-greyblue/30 focus:outline-none focus:ring-2 focus:ring-vizme-red/20 focus:border-vizme-red transition-all ${
                      m.type === 'currency' ? 'pl-7 pr-3' : 'px-3'
                    }`}
                  />
                  {m.type === 'percentage' && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-vizme-greyblue text-xs">%</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving || Object.values(formData).every(v => !v)}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0"
            style={{ background: 'linear-gradient(135deg, #F54A43, #F26A3D)', boxShadow: '0 4px 16px rgba(245,74,67,0.3)' }}
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? 'Guardando…' : 'Guardar entrada'}
          </button>

          {files.length === 0 && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <AlertCircle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                Sube al menos un archivo en <strong>Mis Datos</strong> para que Vizme detecte tus metricas automaticamente.
                Las metricas que ves arriba son genericas.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Previous entries */}
      {entries.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-vizme-greyblue" />
            <p className="text-sm font-semibold text-vizme-navy">Entradas anteriores</p>
            <span className="text-xs text-vizme-greyblue">({entries.length})</span>
          </div>

          <div className="space-y-2">
            {entries.map(entry => (
              <div key={entry.id} className="rounded-xl border border-vizme-navy/6 bg-white p-4 hover:border-vizme-navy/15 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-vizme-navy">{entry.period_label}</span>
                    {entry.file_id && (
                      <span className="flex items-center gap-1 text-[9px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                        <FileSpreadsheet size={8} /> Vinculado
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-vizme-greyblue">{fmtDate(entry.created_at)}</span>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="h-6 w-6 rounded-lg border border-vizme-navy/8 flex items-center justify-center text-vizme-greyblue hover:text-vizme-red hover:border-vizme-red/25 transition-all"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {Object.entries(entry.entry_data).map(([key, val]) => {
                    const metric = metrics.find(m => m.key === key);
                    const formatted = metric?.type === 'currency'
                      ? `$${Number(val).toLocaleString('es-MX')}`
                      : metric?.type === 'percentage'
                        ? `${val}%`
                        : String(val);
                    return (
                      <div key={key} className="bg-vizme-bg rounded-lg px-2.5 py-1.5 border border-vizme-navy/5">
                        <p className="text-[8px] uppercase tracking-wider text-vizme-greyblue font-semibold">{metric?.label ?? key}</p>
                        <p className="text-xs font-bold text-vizme-navy">{formatted}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Streak info */}
      {entries.length >= 2 && (
        <div className="rounded-xl bg-gradient-to-r from-vizme-navy to-vizme-navy/90 p-5 text-white">
          <div className="flex items-center gap-3">
            <TrendingUp size={20} className="text-vizme-orange" />
            <div>
              <p className="text-sm font-bold">Racha de {entries.length} entradas</p>
              <p className="text-xs text-white/60">Sigue actualizando tus datos cada semana para mejores predicciones.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeeklyEntryPage;
