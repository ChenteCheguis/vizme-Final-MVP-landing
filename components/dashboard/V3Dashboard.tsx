import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  RefreshCw, Star, StarOff, Zap,
  TrendingUp, TrendingDown, Minus, Filter, X, Brain,
  ChevronDown, ChevronUp, Activity, Sparkles,
  MousePointer2, Maximize2, Minimize2, Plus,
  MessageCircle, Send, ThumbsUp, ThumbsDown, Heart,
  ArrowUpRight, ArrowDownRight, Equal, FileDown,
  Share2, Link2, Copy, CheckCircle2 as Check2,
} from 'lucide-react';
import { exportDashboardPdf } from '../../lib/exportPdf';
import { supabase } from '../../lib/supabase';
import * as LucideIcons from 'lucide-react';
import type {
  V3DashboardResponse, V3KPI, V3Filter,
  V3Chart as V3ChartDef,
} from '../../lib/v3types';
import V3Chart from './V3Chart';

// ─── useInView hook ──────────────────────────────────────────────────────────

function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

// ─── Animated counter ────────────────────────────────────────────────────────

const AnimatedValue: React.FC<{ value: string }> = ({ value }) => {
  const [displayVal, setDisplayVal] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    if (prevRef.current !== value) {
      // Simple fade transition
      setDisplayVal(value);
      prevRef.current = value;
    }
  }, [value]);

  return <span className="transition-all duration-300">{displayVal}</span>;
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────

const KPICard: React.FC<{ kpi: V3KPI; index: number; isExpanded: boolean; onToggle: () => void }> = ({ kpi, index, isExpanded, onToggle }) => {
  const DirIcon = kpi.delta?.direction === 'up' ? TrendingUp
    : kpi.delta?.direction === 'down' ? TrendingDown : Minus;
  const dirColor = kpi.delta?.direction === 'up' ? 'text-emerald-600'
    : kpi.delta?.direction === 'down' ? 'text-vizme-red' : 'text-vizme-greyblue';
  const dirBg = kpi.delta?.direction === 'up' ? 'bg-emerald-50'
    : kpi.delta?.direction === 'down' ? 'bg-red-50' : 'bg-vizme-bg';

  const IconComponent = (LucideIcons as any)[kpi.icon] ?? (LucideIcons as any)['BarChart2'];

  return (
    <div
      onClick={onToggle}
      className={`bg-white rounded-2xl border p-5 shadow-sm cursor-pointer transition-all duration-300 flex flex-col gap-3 group
        ${isExpanded ? 'border-vizme-red/30 shadow-md ring-1 ring-vizme-red/10' : 'border-vizme-navy/5 hover:shadow-md hover:-translate-y-0.5'}
      `}
      style={{
        animationDelay: `${index * 80}ms`,
        animation: 'fadeSlideUp 0.5s ease forwards',
        opacity: 0,
      }}
    >
      <div className="flex items-center justify-between">
        <div className={`h-9 w-9 rounded-xl border border-vizme-navy/5 flex items-center justify-center transition-colors duration-200 ${isExpanded ? 'bg-vizme-red/10' : 'bg-vizme-bg group-hover:bg-vizme-red/5'}`}>
          <IconComponent size={16} className={`transition-colors ${isExpanded ? 'text-vizme-red' : 'text-vizme-navy'}`} />
        </div>
        {kpi.delta && (
          <span className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${dirColor} ${dirBg}`}>
            <DirIcon size={11} />
            {kpi.delta.value}
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-black text-vizme-navy leading-none font-mono tracking-tight">
          <AnimatedValue value={kpi.value} />
        </p>
        <p className="text-[10px] font-semibold text-vizme-greyblue uppercase tracking-wider mt-1">{kpi.label}</p>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t border-vizme-navy/5 pt-3 mt-1 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
          {kpi.delta?.context && (
            <p className="text-[11px] text-vizme-greyblue flex items-center gap-1.5">
              <Activity size={10} className="text-vizme-red flex-shrink-0" />
              {kpi.delta.context}
            </p>
          )}
          <div className="flex items-center gap-1.5 text-[10px] text-vizme-greyblue/60">
            <Sparkles size={9} />
            Valor real: {kpi.rawValue?.toLocaleString('es-MX') ?? kpi.value}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Rating modal (shown after regenerate) ──────────────────────────────────

const RatingModal: React.FC<{
  onRate: (rating: 'good' | 'bad', feedback?: string) => void;
  onDismiss: () => void;
}> = ({ onRate, onDismiss }) => {
  const [feedback, setFeedback] = useState('');
  const [selectedRating, setSelectedRating] = useState<'good' | 'bad' | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onDismiss}>
      <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="text-center">
          <p className="text-sm font-bold text-vizme-navy">¿Como quedo tu dashboard?</p>
          <p className="text-xs text-vizme-greyblue mt-1">Tu feedback nos ayuda a mejorar</p>
        </div>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setSelectedRating('good')}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
              selectedRating === 'good' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-vizme-navy/10 text-vizme-greyblue hover:border-emerald-300'
            }`}
          >
            <ThumbsUp size={16} /> Me gusta
          </button>
          <button
            onClick={() => setSelectedRating('bad')}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
              selectedRating === 'bad' ? 'border-vizme-red/40 bg-red-50 text-vizme-red' : 'border-vizme-navy/10 text-vizme-greyblue hover:border-vizme-red/30'
            }`}
          >
            <ThumbsDown size={16} /> Puede mejorar
          </button>
        </div>
        {selectedRating === 'bad' && (
          <textarea
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            placeholder="¿Que te gustaria diferente? (opcional)"
            className="w-full text-xs px-3 py-2.5 border border-vizme-navy/12 rounded-xl focus:outline-none focus:ring-2 focus:ring-vizme-red/20 resize-none"
            rows={2}
          />
        )}
        {selectedRating && (
          <button
            onClick={() => onRate(selectedRating, feedback || undefined)}
            className="w-full py-2.5 rounded-xl bg-vizme-navy text-white text-xs font-semibold hover:bg-vizme-navy/80 transition-colors"
          >
            Enviar
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Executive Summary Modal ─────────────────────────────────────────────────

const ExecutiveSummaryModal: React.FC<{
  summary: V3DashboardResponse['executiveSummary'];
  onClose: () => void;
}> = ({ summary, onClose }) => {
  if (!summary) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-vizme-navy rounded-3xl p-6 sm:p-8 shadow-2xl max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto relative" onClick={e => e.stopPropagation()}>
        <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-vizme-red/20 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 h-24 w-24 rounded-full bg-vizme-orange/10 blur-2xl pointer-events-none" />

        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center">
              <Brain size={16} className="text-white" />
            </div>
            <div>
              <p className="text-[9px] font-bold text-vizme-red uppercase tracking-wider">Resumen Ejecutivo</p>
              <p className="text-sm font-bold text-white mt-0.5">{summary.headline}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white flex-shrink-0 mt-1">
            <X size={16} />
          </button>
        </div>

        {summary.topInsights?.length > 0 && (
          <ul className="space-y-2 mb-5">
            {summary.topInsights.map((ins, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-white/80 leading-relaxed">
                <span className="text-vizme-red flex-shrink-0 font-bold mt-0.5">→</span> {ins}
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {summary.mainRisk && (
            <div className="bg-vizme-red/15 rounded-xl p-3.5 border border-vizme-red/30">
              <p className="text-[9px] font-bold text-vizme-red uppercase tracking-wider mb-1">Riesgo principal</p>
              <p className="text-xs text-white/90 leading-relaxed">{summary.mainRisk}</p>
            </div>
          )}
          {summary.mainOpportunity && (
            <div className="bg-emerald-500/15 rounded-xl p-3.5 border border-emerald-500/30">
              <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider mb-1">Oportunidad</p>
              <p className="text-xs text-white/90 leading-relaxed">{summary.mainOpportunity}</p>
            </div>
          )}
        </div>

        {summary.recommendedAction && (
          <div className="bg-white/8 rounded-xl p-3.5 border border-white/10 flex items-start gap-2.5">
            <Zap size={14} className="text-vizme-orange fill-vizme-orange flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[9px] font-bold text-vizme-orange uppercase tracking-wider mb-1">Accion para esta semana</p>
              <p className="text-xs text-white leading-relaxed">{summary.recommendedAction}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Inline mini-chatbot ─────────────────────────────────────────────────────

const InlineChatInput: React.FC<{ projectId?: string }> = ({ projectId }) => {
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = () => {
    if (!msg.trim()) return;
    // Navigate to chat page with the message as a query param
    const params = new URLSearchParams({ q: msg.trim() });
    window.location.href = `/dashboard/projects/${projectId}/chat?${params}`;
  };

  return (
    <div className="bg-white rounded-2xl border border-vizme-navy/8 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <MessageCircle size={13} className="text-vizme-red" />
        <p className="text-xs font-semibold text-vizme-navy">Preguntale a tu copiloto</p>
      </div>
      <div className="flex items-center gap-2">
        <input
          value={msg}
          onChange={e => setMsg(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Ej: ¿Cual es mi producto mas rentable?"
          className="flex-1 text-sm px-3.5 py-2.5 rounded-xl border border-vizme-navy/10 bg-vizme-bg text-vizme-navy placeholder-vizme-greyblue/40 focus:outline-none focus:ring-2 focus:ring-vizme-red/20 focus:border-vizme-red transition-all"
        />
        <button
          onClick={handleSend}
          disabled={!msg.trim() || sending}
          className="h-10 w-10 rounded-xl bg-vizme-red text-white flex items-center justify-center hover:bg-vizme-orange transition-colors disabled:opacity-40"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
};

// ─── Global filter bar ────────────────────────────────────────────────────────

interface ActiveFilter { id: string; value: string | string[] }

const FilterBar: React.FC<{
  filters: V3Filter[];
  active: ActiveFilter[];
  onChange: (f: ActiveFilter[]) => void;
  totalRows: number;
  filteredRows: number;
}> = ({ filters, active, onChange, totalRows, filteredRows }) => {
  if (!filters.length) return null;

  const getActive = (id: string) => active.find(f => f.id === id)?.value ?? '';

  const set = (id: string, value: string) => {
    const next = active.filter(f => f.id !== id);
    if (value) next.push({ id, value });
    onChange(next);
  };

  const clearAll = () => onChange([]);
  const isFiltered = active.length > 0;

  return (
    <div className={`rounded-2xl border px-4 py-3 shadow-sm flex items-center gap-3 flex-wrap transition-all duration-200 ${
      isFiltered ? 'bg-vizme-red/5 border-vizme-red/20' : 'bg-white border-vizme-navy/5'
    }`}>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Filter size={12} className={isFiltered ? 'text-vizme-red' : 'text-vizme-greyblue'} />
        <span className="text-[11px] font-bold text-vizme-greyblue uppercase tracking-wider">Filtros</span>
        {isFiltered && (
          <span className="text-[9px] font-bold bg-vizme-red text-white px-1.5 py-0.5 rounded-full">
            {filteredRows}/{totalRows}
          </span>
        )}
      </div>

      {filters.map(f => (
        <div key={f.id} className="flex items-center gap-1">
          <label className="text-[10px] text-vizme-greyblue font-medium">{f.label}:</label>
          {f.type === 'select' || f.type === 'multiselect' ? (
            <select
              value={String(getActive(f.id))}
              onChange={e => set(f.id, e.target.value)}
              className={`text-[10px] border rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-vizme-red/30 transition-colors ${
                getActive(f.id) ? 'text-vizme-red border-vizme-red/30 font-semibold' : 'text-vizme-navy border-vizme-navy/15'
              }`}
            >
              <option value="">Todos</option>
              {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : f.type === 'range' ? (
            <input
              type="number"
              placeholder="Min"
              value={String(getActive(f.id))}
              onChange={e => set(f.id, e.target.value)}
              className="text-[10px] text-vizme-navy border border-vizme-navy/15 rounded-lg px-2 py-1 w-20 focus:outline-none focus:ring-1 focus:ring-vizme-red/30"
            />
          ) : null}
        </div>
      ))}

      {isFiltered && (
        <button onClick={clearAll} className="flex items-center gap-1 text-[10px] text-vizme-red hover:text-vizme-orange ml-auto font-semibold transition-colors">
          <X size={10} /> Limpiar
        </button>
      )}
    </div>
  );
};

// ─── Health Score Hero ───────────────────────────────────────────────────────

const HealthScoreHero: React.FC<{ hs: V3DashboardResponse['healthScore'] }> = ({ hs }) => {
  if (!hs || hs.overall == null) return null;

  const score100 = Math.round(hs.overall * 10); // API returns 0-10, display 0-100
  const circumference = 2 * Math.PI * 52;
  const offset = circumference - (score100 / 100) * circumference;
  const strokeColor = score100 >= 70 ? '#10b981' : score100 >= 50 ? '#f97316' : '#ef4444';
  const bgGrad = score100 >= 70 ? 'from-emerald-50 to-emerald-100/50' : score100 >= 50 ? 'from-orange-50 to-amber-100/50' : 'from-red-50 to-red-100/50';

  const TrendIcon = hs.trend === 'improving' ? ArrowUpRight : hs.trend === 'declining' ? ArrowDownRight : Equal;
  const trendColor = hs.trend === 'improving' ? 'text-emerald-600' : hs.trend === 'declining' ? 'text-red-500' : 'text-vizme-greyblue';
  const trendLabel = hs.trend === 'improving' ? 'Mejorando' : hs.trend === 'declining' ? 'Bajando' : 'Estable';

  return (
    <div className={`rounded-2xl border border-vizme-navy/6 bg-gradient-to-br ${bgGrad} p-5 overflow-hidden`}>
      <div className="flex items-center gap-6">
        {/* SVG Ring */}
        <div className="relative flex-shrink-0">
          <svg width="120" height="120" className="-rotate-90">
            <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="8" className="text-white/60" />
            <circle
              cx="60" cy="60" r="52" fill="none"
              stroke={strokeColor} strokeWidth="8" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 1s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black text-vizme-navy">{score100}</span>
            <span className="text-[8px] uppercase tracking-widest text-vizme-greyblue font-bold">/ 100</span>
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Heart size={14} className="text-vizme-red" />
            <span className="text-xs font-bold uppercase tracking-wider text-vizme-greyblue">Health Score</span>
            <span className={`flex items-center gap-0.5 text-[10px] font-semibold ${trendColor}`}>
              <TrendIcon size={11} /> {trendLabel}
            </span>
          </div>

          {/* Dimension bars */}
          {hs.dimensions?.length > 0 && (
            <div className="space-y-1.5 mt-2">
              {hs.dimensions.slice(0, 4).map((dim, i) => {
                const dimPct = Math.round(dim.score * 10);
                const barColor = dim.color === 'green' ? 'bg-emerald-500' : dim.color === 'yellow' ? 'bg-amber-400' : 'bg-red-500';
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[10px] text-vizme-navy font-medium w-24 truncate">{dim.name}</span>
                    <div className="flex-1 h-1.5 bg-white/60 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${dimPct}%`, transition: 'width 0.8s ease' }} />
                    </div>
                    <span className="text-[10px] font-bold text-vizme-navy w-7 text-right">{dimPct}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick improvement tips */}
          {hs.improvementPlan?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {hs.improvementPlan.slice(0, 2).map((tip, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-[9px] font-medium px-2 py-1 rounded-full bg-white/70 text-vizme-navy border border-vizme-navy/5">
                  <Zap size={8} className="text-vizme-orange" /> {tip.action}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Section wrapper with animation ──────────────────────────────────────────

const AnimatedSection: React.FC<{ children: React.ReactNode; delay?: number; className?: string }> = ({ children, delay = 0, className }) => {
  const { ref, visible } = useInView(0.05);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
};

// ─── Main V3Dashboard component ───────────────────────────────────────────────

const MAX_REGENERATIONS = 5;

interface Props {
  dashboard: V3DashboardResponse;
  rawData: Record<string, unknown>[];
  fileName: string;
  projectName?: string;
  projectId?: string;
  onRefresh: () => void;
  onAddData?: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  regenerateCount?: number;
  onRateRegenerate?: (rating: 'good' | 'bad', feedback?: string) => void;
}

const V3Dashboard: React.FC<Props> = ({
  dashboard, rawData, fileName, projectName, projectId,
  onRefresh, onAddData, isFavorite, onToggleFavorite,
  regenerateCount = 0, onRateRegenerate,
}) => {
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [expandedKPI, setExpandedKPI] = useState<string | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const [activeArea, setActiveArea] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [sharingLoading, setSharingLoading] = useState(false);

  // Detect area/department tabs from data
  const areaTabs = useMemo(() => {
    const areaKeys = ['area', 'departamento', 'department', 'sucursal', 'tienda', 'region', '_hoja'];
    for (const key of areaKeys) {
      const vals = [...new Set(rawData.map(r => String(r[key] ?? '')).filter(Boolean))];
      if (vals.length >= 2 && vals.length <= 15) return { key, values: vals };
    }
    return null;
  }, [rawData]);

  // Apply global filters + area filter to rawData
  const filteredData = useMemo(() => {
    let data = rawData;
    if (activeArea && areaTabs) {
      data = data.filter(r => String(r[areaTabs.key] ?? '') === activeArea);
    }
    if (!activeFilters.length) return data;
    return data.filter(row =>
      activeFilters.every(f => {
        const val = String(row[f.id] ?? '');
        return Array.isArray(f.value) ? f.value.includes(val) : val === f.value;
      }),
    );
  }, [rawData, activeFilters, activeArea, areaTabs]);

  // Filter chart data based on active filters
  const filterChartData = useCallback((chart: V3ChartDef): V3ChartDef => {
    if (!activeFilters.length && !activeArea) return chart;
    const filtered = chart.data.filter((row: Record<string, unknown>) => {
      if (activeArea && areaTabs) {
        const cell = row[areaTabs.key];
        if (cell !== undefined && String(cell) !== activeArea) return false;
      }
      return activeFilters.every(f => {
        const cell = row[f.id];
        if (cell === undefined) return true;
        return Array.isArray(f.value) ? f.value.includes(String(cell)) : String(cell) === f.value;
      });
    });
    return { ...chart, data: filtered.length >= 1 ? filtered : chart.data };
  }, [activeFilters, activeArea, areaTabs]);

  const charts = (dashboard.charts ?? [])
    .sort((a, b) => a.priority - b.priority);

  const largeCharts = charts.filter(c => c.gridSpan >= 8);
  const medCharts   = charts.filter(c => c.gridSpan === 6);
  const smallCharts = charts.filter(c => c.gridSpan <= 4);

  const canRegenerate = regenerateCount < MAX_REGENERATIONS;

  const handleRegenerate = () => {
    if (!canRegenerate) return;
    onRefresh();
    // Show rating after a delay to let the new dashboard load
    setTimeout(() => setShowRating(true), 2000);
  };

  const handleRate = (rating: 'good' | 'bad', feedback?: string) => {
    onRateRegenerate?.(rating, feedback);
    setShowRating(false);
  };

  // Presentation mode wrapper
  const containerClass = presentationMode
    ? 'fixed inset-0 z-40 bg-vizme-bg overflow-y-auto p-6 md:p-10'
    : 'space-y-5';

  const handleExportPdf = () => {
    if (dashboardRef.current) {
      exportDashboardPdf(dashboardRef.current, `${projectName ?? 'Dashboard'} - Vizme.pdf`, projectName ?? 'Dashboard');
    }
  };

  const handleShare = async () => {
    if (shareLink) { setShareLink(null); return; } // toggle off
    if (!dashboard || !projectId) return;
    setSharingLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      // Get or create dashboard record id
      const { data: dbDash } = await supabase
        .from('dashboards')
        .select('id')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!dbDash) { alert('Genera el dashboard primero'); return; }

      // Check for existing active link
      const { data: existing } = await supabase
        .from('shared_links')
        .select('token')
        .eq('dashboard_id', dbDash.id)
        .eq('is_active', true)
        .maybeSingle();

      const token = existing?.token;
      if (token) {
        setShareLink(`${window.location.origin}/shared/${token}`);
      } else {
        // Create new shared link
        const { data: newLink, error } = await supabase
          .from('shared_links')
          .insert({ dashboard_id: dbDash.id, created_by: user.id })
          .select('token')
          .single();
        if (error) throw error;
        setShareLink(`${window.location.origin}/shared/${newLink.token}`);
      }
    } catch (err: any) {
      console.error('Share error:', err);
    } finally {
      setSharingLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  };

  return (
    <div className={containerClass} ref={dashboardRef}>

      {/* Modals */}
      {showSummaryModal && dashboard.executiveSummary && (
        <ExecutiveSummaryModal summary={dashboard.executiveSummary} onClose={() => setShowSummaryModal(false)} />
      )}
      {showRating && <RatingModal onRate={handleRate} onDismiss={() => setShowRating(false)} />}

      {/* Topbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-vizme-greyblue">
            {projectName ?? 'Proyecto'}
          </p>
          <h1 className="text-xl font-bold text-vizme-navy flex items-center gap-2">
            Dashboard IA
            <span className="inline-flex items-center gap-1 text-[10px] font-normal text-vizme-greyblue normal-case bg-vizme-bg px-2 py-0.5 rounded-full">
              <Sparkles size={9} className="text-vizme-red" /> {fileName}
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {onAddData && (
            <button onClick={onAddData} className="h-9 flex items-center gap-1.5 px-3 rounded-xl border border-dashed border-vizme-navy/15 bg-white hover:border-vizme-red/40 hover:text-vizme-red transition-all text-xs text-vizme-greyblue">
              <Plus size={12} /> Agregar datos
            </button>
          )}
          {onToggleFavorite && (
            <button onClick={onToggleFavorite} className="h-9 w-9 flex items-center justify-center rounded-xl border border-vizme-navy/10 bg-white hover:bg-vizme-bg transition-all hover:-translate-y-0.5">
              {isFavorite ? <StarOff size={14} className="text-vizme-orange" /> : <Star size={14} className="text-vizme-greyblue" />}
            </button>
          )}
          {dashboard.executiveSummary && (
            <button onClick={() => setShowSummaryModal(true)} className="h-9 flex items-center gap-1.5 px-3 rounded-xl border border-vizme-navy/10 bg-white hover:bg-vizme-bg transition-all hover:-translate-y-0.5 text-xs text-vizme-navy">
              <Brain size={13} /> Resumen
            </button>
          )}
          <div className="relative" data-no-print>
            <button
              onClick={handleShare}
              disabled={sharingLoading}
              className={`h-9 flex items-center gap-1.5 px-3 rounded-xl border transition-all hover:-translate-y-0.5 text-xs ${
                shareLink ? 'border-vizme-red/30 bg-vizme-red/5 text-vizme-red' : 'border-vizme-navy/10 bg-white hover:bg-vizme-bg text-vizme-greyblue hover:text-vizme-navy'
              }`}
              title="Compartir dashboard"
            >
              {sharingLoading ? <span className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Share2 size={13} />}
              Compartir
            </button>
            {shareLink && (
              <div className="absolute right-0 top-11 z-30 bg-white rounded-xl border border-vizme-navy/10 shadow-xl p-3 w-72">
                <p className="text-[10px] font-bold text-vizme-greyblue uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Link2 size={10} /> Link publico
                </p>
                <div className="flex items-center gap-1.5">
                  <input
                    readOnly
                    value={shareLink}
                    className="flex-1 text-[10px] px-2.5 py-2 rounded-lg border border-vizme-navy/10 bg-vizme-bg text-vizme-navy truncate"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="h-8 w-8 flex items-center justify-center rounded-lg bg-vizme-red text-white hover:bg-vizme-orange transition-colors flex-shrink-0"
                  >
                    {shareCopied ? <Check2 size={12} /> : <Copy size={12} />}
                  </button>
                </div>
                <p className="text-[9px] text-vizme-greyblue mt-1.5">Cualquiera con el link puede ver este dashboard (solo lectura).</p>
              </div>
            )}
          </div>
          <button
            onClick={handleExportPdf}
            className="h-9 flex items-center gap-1.5 px-3 rounded-xl border border-vizme-navy/10 bg-white hover:bg-vizme-bg transition-all hover:-translate-y-0.5 text-xs text-vizme-greyblue hover:text-vizme-navy"
            title="Exportar PDF"
            data-no-print
          >
            <FileDown size={13} /> PDF
          </button>
          <button
            onClick={() => setPresentationMode(v => !v)}
            className="h-9 w-9 flex items-center justify-center rounded-xl border border-vizme-navy/10 bg-white hover:bg-vizme-bg transition-all hover:-translate-y-0.5"
            title={presentationMode ? 'Salir de presentacion' : 'Modo presentacion'}
          >
            {presentationMode ? <Minimize2 size={14} className="text-vizme-navy" /> : <Maximize2 size={14} className="text-vizme-greyblue" />}
          </button>
          <button
            onClick={handleRegenerate}
            disabled={!canRegenerate}
            className="h-9 flex items-center gap-1.5 px-4 rounded-xl bg-vizme-red text-white text-xs font-semibold hover:bg-vizme-orange transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-vizme-red/20 disabled:opacity-40 disabled:hover:translate-y-0"
          >
            <RefreshCw size={13} /> Regenerar
            <span className="text-[9px] opacity-70">({MAX_REGENERATIONS - regenerateCount}/{MAX_REGENERATIONS})</span>
          </button>
        </div>
      </div>

      {/* Area / department tabs */}
      {areaTabs && (
        <AnimatedSection>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold text-vizme-greyblue uppercase tracking-wider mr-1">
              {areaTabs.key === '_hoja' ? 'Hoja' : areaTabs.key}:
            </span>
            <button
              onClick={() => setActiveArea(null)}
              className={`text-[11px] font-medium px-3 py-1.5 rounded-full border transition-all ${
                !activeArea ? 'bg-vizme-navy text-white border-vizme-navy' : 'bg-white text-vizme-greyblue border-vizme-navy/10 hover:border-vizme-red/40'
              }`}
            >
              Todas
            </button>
            {areaTabs.values.map(v => (
              <button
                key={v}
                onClick={() => setActiveArea(prev => prev === v ? null : v)}
                className={`text-[11px] font-medium px-3 py-1.5 rounded-full border transition-all ${
                  activeArea === v ? 'bg-vizme-navy text-white border-vizme-navy' : 'bg-white text-vizme-greyblue border-vizme-navy/10 hover:border-vizme-red/40'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </AnimatedSection>
      )}

      {/* Health Score Hero */}
      {dashboard.healthScore && (
        <AnimatedSection delay={50}>
          <HealthScoreHero hs={dashboard.healthScore} />
        </AnimatedSection>
      )}

      {/* KPIs */}
      {dashboard.kpis?.length > 0 && (
        <AnimatedSection delay={100}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {dashboard.kpis.sort((a, b) => a.priority - b.priority).slice(0, 4).map((kpi, i) => (
              <KPICard
                key={kpi.id}
                kpi={kpi}
                index={i}
                isExpanded={expandedKPI === kpi.id}
                onToggle={() => setExpandedKPI(prev => prev === kpi.id ? null : kpi.id)}
              />
            ))}
          </div>
          <p className="text-[10px] text-vizme-greyblue/50 mt-2 flex items-center gap-1">
            <MousePointer2 size={9} /> Click en un KPI para ver detalles
          </p>
        </AnimatedSection>
      )}

      {/* Filter bar */}
      {dashboard.suggestedFilters?.length > 0 && (
        <AnimatedSection delay={200}>
          <FilterBar
            filters={dashboard.suggestedFilters}
            active={activeFilters}
            onChange={setActiveFilters}
            totalRows={rawData.length}
            filteredRows={filteredData.length}
          />
        </AnimatedSection>
      )}

      {/* Large charts (full width) */}
      {largeCharts.map(chart => (
        <V3Chart key={chart.id} chart={filterChartData(chart)} className="w-full" />
      ))}

      {/* Medium charts (2-col grid) */}
      {medCharts.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {medCharts.map(chart => (
            <V3Chart key={chart.id} chart={filterChartData(chart)} />
          ))}
        </div>
      )}

      {/* Small charts (3-col or 2-col grid) */}
      {smallCharts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {smallCharts.map(chart => (
            <V3Chart key={chart.id} chart={filterChartData(chart)} />
          ))}
        </div>
      )}

      {/* Inline chatbot */}
      <AnimatedSection delay={400}>
        <InlineChatInput projectId={projectId} />
      </AnimatedSection>
    </div>
  );
};

export default V3Dashboard;
