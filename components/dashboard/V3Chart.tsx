import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell,
  ScatterChart, Scatter,
  ComposedChart,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  RadialBarChart, RadialBar,
  FunnelChart, Funnel, LabelList,
  Treemap,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  Info, TrendingUp, TrendingDown, AlertTriangle, Zap,
  Lightbulb, ChevronDown, ChevronUp, BarChart2,
  Maximize2, Minimize2, Download, X,
} from 'lucide-react';
import type { V3Chart as V3ChartDef, V3ChartType } from '../../lib/v3types';

// ─── Brand palette ────────────────────────────────────────────────────────────
const PALETTE = [
  '#F54A43', '#F26A3D', '#A78BFA', '#34D399',
  '#FBBF24', '#60A5FA', '#F472B6', '#2DD4BF',
  '#566970', '#02222F',
];

// ─── Tooltip styles ───────────────────────────────────────────────────────────
const TIP_STYLE = {
  backgroundColor: '#02222F',
  border: 'none',
  borderRadius: 10,
  color: '#fff',
  fontSize: 11,
  padding: '8px 12px',
  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
};

const fmtNum = (v: unknown): string => {
  const n = Number(v);
  if (isNaN(n)) return String(v ?? '');
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(n);
};

const AxisTick = ({ x, y, payload }: any) => (
  <text x={x} y={y} dy={4} fill="#94a3b8" fontSize={9} textAnchor="end">
    {String(payload.value ?? '').length > 14
      ? String(payload.value).slice(0, 14) + '…'
      : payload.value}
  </text>
);

// ─── Custom active bar shape for hover highlight ─────────────────────────────
const ActiveBar = (props: any) => {
  const { x, y, width, height, fill } = props;
  return (
    <rect x={x} y={y} width={width} height={height} fill={fill} rx={6}
      style={{ filter: 'brightness(1.15) drop-shadow(0 2px 8px rgba(0,0,0,0.15))' }} />
  );
};

// ─── Insight strip ────────────────────────────────────────────────────────────
const InsightStrip: React.FC<{ insight: string; type: V3ChartDef['insightType'] }> = ({ insight, type }) => {
  const cfg = {
    action:      { color: 'border-vizme-red bg-vizme-red/5 text-vizme-red',      Icon: Zap },
    opportunity: { color: 'border-emerald-500 bg-emerald-50 text-emerald-700',   Icon: TrendingUp },
    risk:        { color: 'border-vizme-orange bg-orange-50 text-vizme-orange',  Icon: AlertTriangle },
    trend:       { color: 'border-blue-500 bg-blue-50 text-blue-700',           Icon: TrendingUp },
    info:        { color: 'border-vizme-navy/20 bg-vizme-bg text-vizme-greyblue', Icon: Lightbulb },
  }[type] ?? { color: 'border-vizme-navy/20 bg-vizme-bg text-vizme-greyblue', Icon: Lightbulb };

  return (
    <div className={`mt-3 border-l-2 px-3 py-2 rounded-r-lg flex items-start gap-2 ${cfg.color}`}>
      <cfg.Icon size={12} className="flex-shrink-0 mt-0.5" />
      <p className="text-[11px] leading-relaxed">{insight}</p>
    </div>
  );
};

// ─── Custom renderers for special types ──────────────────────────────────────

const HeatmapChart: React.FC<{ data: Record<string, unknown>[]; xKey: string; yKey: string; colorKey?: string }> = ({ data, xKey, yKey, colorKey }) => {
  if (!data.length) return null;
  const rows = [...new Set(data.map(d => String(d[xKey] ?? '')))];
  const cols = [...new Set(data.map(d => String(d[yKey] ?? '')))];
  const valueKey = colorKey ?? 'value';
  const values = data.map(d => Number(d[valueKey] ?? 0));
  const maxVal = Math.max(...values);

  return (
    <div className="overflow-x-auto">
      <table className="text-[9px] border-collapse w-full">
        <thead>
          <tr>
            <th className="px-1 py-0.5 text-vizme-greyblue text-left w-16"></th>
            {cols.slice(0, 8).map(c => (
              <th key={c} className="px-1 py-0.5 text-vizme-greyblue font-normal text-center truncate max-w-[60px]">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 8).map(row => (
            <tr key={row}>
              <td className="px-1 py-0.5 text-vizme-greyblue truncate max-w-[60px]">{row}</td>
              {cols.slice(0, 8).map(col => {
                const cell = data.find(d => String(d[xKey]) === row && String(d[yKey]) === col);
                const v = cell ? Number(cell[valueKey] ?? 0) : 0;
                const intensity = maxVal > 0 ? v / maxVal : 0;
                return (
                  <td key={col} className="p-0.5 text-center">
                    <div
                      className="rounded flex items-center justify-center text-[9px] font-bold transition-transform duration-150 hover:scale-110 cursor-default"
                      style={{
                        backgroundColor: `rgba(245, 74, 67, ${0.1 + intensity * 0.8})`,
                        color: intensity > 0.5 ? '#fff' : '#02222F',
                        minHeight: 24,
                        minWidth: 36,
                      }}
                    >
                      {v > 0 ? fmtNum(v) : '—'}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const GaugeChart: React.FC<{ value: number; max?: number; label?: string }> = ({ value, max = 100, label }) => {
  const pct = Math.min(1, Math.max(0, value / max));
  const color = pct >= 0.7 ? '#34D399' : pct >= 0.4 ? '#FBBF24' : '#F54A43';
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2">
      <svg viewBox="0 0 120 80" className="w-32">
        <path d="M 15 75 A 50 50 0 1 1 105 75" fill="none" stroke="#f1f5f9" strokeWidth="10" strokeLinecap="round" />
        <path
          d="M 15 75 A 50 50 0 1 1 105 75"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${pct * 157} 157`}
          className="transition-all duration-700"
        />
        <text x="60" y="68" textAnchor="middle" fontSize="18" fontWeight="700" fill="#02222F">{fmtNum(value)}</text>
        {label && <text x="60" y="80" textAnchor="middle" fontSize="8" fill="#566970">{label}</text>}
      </svg>
    </div>
  );
};

const WaterfallChart: React.FC<{ data: Record<string, unknown>[]; xKey: string; yKey: string }> = ({ data, xKey, yKey }) => {
  let running = 0;
  const wData = data.map((d, i) => {
    const v = Number(d[yKey] ?? 0);
    const start = i === 0 ? 0 : running;
    if (i > 0) running += v;
    else running = v;
    return {
      name: String(d[xKey] ?? ''),
      base: i === 0 ? 0 : start,
      up: v >= 0 ? v : 0,
      down: v < 0 ? -v : 0,
      total: running,
      isTotal: d['isTotal'] === true,
    };
  });

  return (
    <ComposedChart data={wData} margin={{ left: 0, right: 8, top: 5, bottom: 20 }}>
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
      <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" />
      <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={fmtNum} />
      <Tooltip
        contentStyle={TIP_STYLE}
        formatter={(v: unknown, name: string) => name === 'base' ? null : [fmtNum(v), name === 'up' ? '▲ Incremento' : '▼ Decremento']}
      />
      <Bar dataKey="base" stackId="wf" fill="transparent" />
      <Bar dataKey="up" stackId="wf" fill="#34D399" radius={[3, 3, 0, 0]} />
      <Bar dataKey="down" stackId="wf" fill="#F54A43" radius={[0, 0, 3, 3]} />
    </ComposedChart>
  );
};

// ─── Data table for drill-down ───────────────────────────────────────────────

const DataTable: React.FC<{ data: Record<string, unknown>[]; xKey: string; yKey: string; groupKey?: string }> = ({ data, xKey, yKey, groupKey }) => {
  const cols = [xKey, yKey, ...(groupKey ? [groupKey] : [])];
  return (
    <div className="overflow-x-auto max-h-60 overflow-y-auto">
      <table className="w-full text-[11px] border-collapse">
        <thead className="sticky top-0 bg-vizme-bg">
          <tr>
            {cols.map(c => (
              <th key={c} className="text-left px-3 py-2 text-vizme-greyblue font-semibold uppercase tracking-wider text-[9px] border-b border-vizme-navy/10">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 50).map((row, i) => (
            <tr key={i} className="hover:bg-vizme-red/5 transition-colors">
              {cols.map(c => (
                <td key={c} className="px-3 py-1.5 text-vizme-navy border-b border-vizme-navy/5">
                  {typeof row[c] === 'number' ? fmtNum(row[c]) : String(row[c] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > 50 && (
        <p className="text-[10px] text-vizme-greyblue text-center py-2">Mostrando 50 de {data.length} filas</p>
      )}
    </div>
  );
};

// ─── Fullscreen modal ────────────────────────────────────────────────────────

const FullscreenModal: React.FC<{
  chart: V3ChartDef;
  renderChart: () => React.ReactElement | null;
  onClose: () => void;
}> = ({ chart, renderChart, onClose }) => {
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-vizme-navy/5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-vizme-navy">{chart.title}</h2>
            <p className="text-xs text-vizme-greyblue mt-0.5">{chart.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTable(v => !v)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                showTable ? 'bg-vizme-navy text-white border-vizme-navy' : 'bg-vizme-bg text-vizme-greyblue border-vizme-navy/10 hover:border-vizme-navy/30'
              }`}
            >
              {showTable ? 'Ver gráfica' : 'Ver datos'}
            </button>
            <button onClick={onClose} className="h-8 w-8 rounded-xl bg-vizme-bg border border-vizme-navy/10 flex items-center justify-center hover:bg-vizme-navy hover:text-white transition-all">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {showTable ? (
            <DataTable data={chart.data} xKey={chart.xKey} yKey={chart.yKey} groupKey={chart.groupKey} />
          ) : (
            <div style={{ height: 420 }}>
              <ResponsiveContainer width="100%" height="100%">
                {renderChart() ?? <div />}
              </ResponsiveContainer>
            </div>
          )}

          {/* Question + Insight */}
          {chart.question && (
            <div className="mt-4 bg-vizme-bg rounded-xl p-4 border border-vizme-navy/5">
              <p className="text-[10px] font-bold text-vizme-greyblue uppercase tracking-wider mb-1">Pregunta de negocio</p>
              <p className="text-sm text-vizme-navy">{chart.question}</p>
            </div>
          )}
          {chart.insight && (
            <InsightStrip insight={chart.insight} type={chart.insightType} />
          )}
        </div>
      </div>
    </div>
  );
};

// ─── useInView hook for animated entry ───────────────────────────────────────

function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        obs.disconnect();
      }
    }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

// ─── Main V3Chart component ───────────────────────────────────────────────────

interface Props {
  chart: V3ChartDef;
  className?: string;
}

const V3Chart: React.FC<Props> = ({ chart, className }) => {
  const [showQuestion, setShowQuestion] = useState(false);
  const [activeType, setActiveType] = useState<V3ChartType>(chart.type);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState<number | null>(null);
  const { ref: inViewRef, visible } = useInView(0.15);

  const height = chart.gridSpan >= 8 ? 280 : chart.gridSpan >= 6 ? 220 : 180;

  const COMPATIBLE: Partial<Record<V3ChartType, V3ChartType[]>> = {
    bar_horizontal: ['bar_horizontal', 'bar_vertical', 'funnel'],
    bar_vertical:   ['bar_vertical', 'bar_horizontal'],
    line:           ['line', 'area'],
    area:           ['area', 'line'],
    donut:          ['donut', 'radar'],
    scatter:        ['scatter', 'bubble'],
    treemap:        ['treemap', 'bar_horizontal'],
    funnel:         ['funnel', 'bar_horizontal'],
    waterfall:      ['waterfall', 'bar_vertical'],
    radar:          ['radar', 'donut'],
    gauge:          ['gauge'],
    heatmap:        ['heatmap'],
    bar_grouped:    ['bar_grouped', 'bar_stacked'],
    bar_stacked:    ['bar_stacked', 'bar_grouped'],
    bubble:         ['bubble', 'scatter'],
  };

  const TYPE_LABEL: Partial<Record<V3ChartType, string>> = {
    bar_horizontal: 'Barra H', bar_vertical: 'Barra V',
    line: 'Linea', area: 'Area', donut: 'Donut',
    scatter: 'Dispersion', bubble: 'Burbuja',
    treemap: 'Treemap', funnel: 'Embudo',
    heatmap: 'Mapa calor', waterfall: 'Cascada',
    radar: 'Radar', gauge: 'Gauge',
    bar_grouped: 'Barras agrupadas', bar_stacked: 'Barras apiladas',
  };

  const handleBarClick = useCallback((_data: any, index: number) => {
    setHighlightIdx(prev => prev === index ? null : index);
  }, []);

  const renderChart = useCallback(() => {
    const { data, xKey, yKey, groupKey } = chart;
    if (!data?.length) return null;

    switch (activeType) {
      case 'bar_horizontal':
        return (
          <BarChart data={data} layout="vertical" barSize={14} margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
            <XAxis type="number" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={fmtNum} />
            <YAxis type="category" dataKey={xKey} tick={<AxisTick />} axisLine={false} tickLine={false} width={90} />
            <Tooltip contentStyle={TIP_STYLE} formatter={(v: unknown) => [fmtNum(v), yKey]} cursor={{ fill: 'rgba(245,74,67,0.06)' }} />
            <Bar dataKey={yKey} radius={[0, 6, 6, 0]} onClick={handleBarClick} cursor="pointer" activeBar={<ActiveBar />} animationDuration={800}>
              {data.map((_: unknown, i: number) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} opacity={highlightIdx !== null && highlightIdx !== i ? 0.3 : 1} />
              ))}
            </Bar>
          </BarChart>
        );

      case 'bar_vertical':
        return (
          <BarChart data={data} barSize={24} margin={{ left: 4, right: 4, top: 4, bottom: 24 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey={xKey} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={fmtNum} />
            <Tooltip contentStyle={TIP_STYLE} formatter={(v: unknown) => [fmtNum(v), yKey]} cursor={{ fill: 'rgba(245,74,67,0.06)' }} />
            <Bar dataKey={yKey} radius={[6, 6, 0, 0]} onClick={handleBarClick} cursor="pointer" activeBar={<ActiveBar />} animationDuration={800}>
              {data.map((_: unknown, i: number) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} opacity={highlightIdx !== null && highlightIdx !== i ? 0.3 : 1} />
              ))}
            </Bar>
          </BarChart>
        );

      case 'bar_grouped':
        return (
          <BarChart data={data} barGap={2} margin={{ left: 4, right: 4, top: 4, bottom: 24 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey={xKey} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" />
            <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={fmtNum} />
            <Tooltip contentStyle={TIP_STYLE} formatter={fmtNum} cursor={{ fill: 'rgba(245,74,67,0.06)' }} />
            <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey={yKey} fill={PALETTE[0]} radius={[4, 4, 0, 0]} barSize={14} cursor="pointer" activeBar={<ActiveBar />} animationDuration={800} />
            {groupKey && <Bar dataKey={groupKey} fill={PALETTE[1]} radius={[4, 4, 0, 0]} barSize={14} cursor="pointer" activeBar={<ActiveBar />} />}
          </BarChart>
        );

      case 'bar_stacked':
        return (
          <BarChart data={data} barSize={28} margin={{ left: 4, right: 4, top: 4, bottom: 24 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey={xKey} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" />
            <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={fmtNum} />
            <Tooltip contentStyle={TIP_STYLE} formatter={fmtNum} cursor={{ fill: 'rgba(245,74,67,0.06)' }} />
            <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey={yKey} stackId="s" fill={PALETTE[0]} animationDuration={800} />
            {groupKey && <Bar dataKey={groupKey} stackId="s" fill={PALETTE[1]} radius={[4, 4, 0, 0]} />}
          </BarChart>
        );

      case 'line':
        return (
          <LineChart data={data} margin={{ left: 4, right: 4, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey={xKey} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={fmtNum} />
            <Tooltip contentStyle={TIP_STYLE} formatter={(v: unknown) => [fmtNum(v), yKey]} />
            <Line type="monotone" dataKey={yKey} stroke={PALETTE[0]} strokeWidth={2.5} dot={{ r: 3, fill: PALETTE[0], cursor: 'pointer' }} activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2, fill: PALETTE[0] }} animationDuration={1000} />
            {groupKey && <Line type="monotone" dataKey={groupKey} stroke={PALETTE[2]} strokeWidth={2} strokeDasharray="4 4" dot={false} animationDuration={1000} />}
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart data={data} margin={{ left: 4, right: 4, top: 4, bottom: 4 }}>
            <defs>
              <linearGradient id={`ag-${chart.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={PALETTE[0]} stopOpacity={0.25} />
                <stop offset="95%" stopColor={PALETTE[0]} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey={xKey} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={fmtNum} />
            <Tooltip contentStyle={TIP_STYLE} formatter={(v: unknown) => [fmtNum(v), yKey]} />
            <Area type="monotone" dataKey={yKey} stroke={PALETTE[0]} strokeWidth={2.5} fill={`url(#ag-${chart.id})`} dot={false} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2, fill: PALETTE[0] }} animationDuration={1000} />
          </AreaChart>
        );

      case 'donut': {
        const pieData = data as { name: string; value: number }[];
        const total = pieData.reduce((s, d) => s + (d[yKey as keyof typeof d] as number || d.value || 0), 0);
        return (
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius="45%"
              outerRadius="75%"
              dataKey={yKey || 'value'}
              paddingAngle={2}
              animationDuration={800}
              cursor="pointer"
            >
              {pieData.map((_: unknown, i: number) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]}
                  opacity={highlightIdx !== null && highlightIdx !== i ? 0.3 : 1}
                  onClick={() => setHighlightIdx(prev => prev === i ? null : i)}
                />
              ))}
            </Pie>
            <Pie data={[{ v: 1 }]} cx="50%" cy="50%" outerRadius={0} dataKey="v">
              <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central">
                <tspan x="50%" dy="-0.3em" fontSize={14} fontWeight={700} fill="#02222F">{fmtNum(total)}</tspan>
                <tspan x="50%" dy="1.4em" fontSize={8} fill="#566970">total</tspan>
              </text>
            </Pie>
            <Tooltip contentStyle={TIP_STYLE} formatter={(v: unknown, name: string) => [fmtNum(v), name]} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
          </PieChart>
        );
      }

      case 'scatter':
      case 'bubble':
        return (
          <ScatterChart margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis type="number" dataKey={xKey} name={xKey} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={fmtNum} />
            <YAxis type="number" dataKey={yKey} name={yKey} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={fmtNum} />
            <Tooltip contentStyle={TIP_STYLE} cursor={{ strokeDasharray: '3 3' }} formatter={fmtNum} />
            <Scatter data={data} fill={PALETTE[0]} opacity={0.75} cursor="pointer" animationDuration={800} />
          </ScatterChart>
        );

      case 'radar':
        return (
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid stroke="#f1f5f9" />
            <PolarAngleAxis dataKey={xKey} tick={{ fontSize: 9, fill: '#566970' }} />
            <Radar dataKey={yKey} stroke={PALETTE[0]} fill={PALETTE[0]} fillOpacity={0.25} strokeWidth={2} animationDuration={800} />
            {groupKey && <Radar dataKey={groupKey} stroke={PALETTE[2]} fill={PALETTE[2]} fillOpacity={0.15} strokeWidth={2} />}
            <Tooltip contentStyle={TIP_STYLE} formatter={fmtNum} />
            <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
          </RadarChart>
        );

      case 'funnel': {
        const fData = [...data]
          .sort((a, b) => Number(b[yKey] ?? 0) - Number(a[yKey] ?? 0))
          .map((d, i) => ({ ...d, fill: PALETTE[i % PALETTE.length] }));
        return (
          <FunnelChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <Tooltip contentStyle={TIP_STYLE} formatter={(v: unknown) => [fmtNum(v)]} />
            <Funnel dataKey={yKey} data={fData} isAnimationActive animationDuration={800}>
              <LabelList position="center" fill="#fff" fontSize={10} formatter={(v: unknown) => fmtNum(v)} />
            </Funnel>
          </FunnelChart>
        );
      }

      case 'treemap': {
        const tData = data.map((d, i) => ({ ...d, fill: PALETTE[i % PALETTE.length] }));
        const TreemapContent = (props: any) => {
          const { x, y, width, height, name, value, fill } = props;
          if (width < 20 || height < 14) return <g />;
          return (
            <g className="cursor-pointer">
              <rect x={x} y={y} width={width} height={height} fill={fill} rx={4}
                className="transition-opacity duration-150 hover:opacity-80" />
              <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={Math.min(10, width / 6)}>
                {String(name ?? '').length > 8 ? String(name).slice(0, 8) + '…' : name}
              </text>
              {height > 34 && (
                <text x={x + width / 2} y={y + height / 2 + 13} textAnchor="middle" fill="#fff" fontSize={8} opacity={0.8}>
                  {fmtNum(value)}
                </text>
              )}
            </g>
          );
        };
        return (
          <Treemap
            data={tData}
            dataKey={yKey}
            nameKey={xKey}
            aspectRatio={4 / 3}
            animationDuration={800}
            content={<TreemapContent />}
          />
        );
      }

      case 'waterfall':
        return <WaterfallChart data={data} xKey={xKey} yKey={yKey} />;

      case 'heatmap':
        return <HeatmapChart data={data} xKey={xKey} yKey={yKey ?? 'y'} colorKey={groupKey} />;

      case 'gauge': {
        const gaugeVal = Number(data[0]?.[yKey] ?? 0);
        const gaugeMax = Number(data[0]?.max ?? 100);
        return <GaugeChart value={gaugeVal} max={gaugeMax} label={xKey} />;
      }

      default:
        return null;
    }
  }, [chart, activeType, highlightIdx, handleBarClick]);

  const compatibleTypes = COMPATIBLE[chart.type] ?? [];

  return (
    <>
      <div
        ref={inViewRef}
        className={`bg-white rounded-2xl border border-vizme-navy/5 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group ${className ?? ''}`}
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 0.5s ease, transform 0.5s ease, box-shadow 0.2s ease',
        }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-vizme-navy leading-snug">{chart.title}</p>
              <p className="text-[11px] text-vizme-greyblue mt-0.5 leading-relaxed">{chart.subtitle}</p>
            </div>
            <div className="flex items-center gap-1">
              {/* Expand button */}
              <button
                onClick={() => setIsFullscreen(true)}
                className="flex-shrink-0 h-6 w-6 rounded-full bg-vizme-bg border border-vizme-navy/10 flex items-center justify-center text-vizme-greyblue hover:text-vizme-navy hover:bg-white transition-all opacity-0 group-hover:opacity-100"
                title="Expandir"
              >
                <Maximize2 size={10} />
              </button>
              {chart.question && (
                <button
                  onClick={() => setShowQuestion(v => !v)}
                  className="flex-shrink-0 h-6 w-6 rounded-full bg-vizme-bg border border-vizme-navy/10 flex items-center justify-center text-vizme-greyblue hover:text-vizme-navy hover:bg-white transition-all"
                  title="¿Por qué importa?"
                >
                  {showQuestion ? <ChevronUp size={11} /> : <Info size={11} />}
                </button>
              )}
            </div>
          </div>

          {showQuestion && chart.question && (
            <div className="mt-2 bg-vizme-bg rounded-xl p-3 border border-vizme-navy/5 animate-in fade-in slide-in-from-top-1 duration-150">
              <p className="text-[10px] font-bold text-vizme-greyblue uppercase tracking-wider mb-1">Pregunta de negocio</p>
              <p className="text-[11px] text-vizme-navy">{chart.question}</p>
            </div>
          )}

          {/* Type switcher */}
          {compatibleTypes.length > 1 && (
            <div className="flex items-center gap-1 mt-2 flex-wrap">
              {compatibleTypes.map(t => (
                <button
                  key={t}
                  onClick={() => { setActiveType(t); setHighlightIdx(null); }}
                  className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border transition-all ${
                    activeType === t
                      ? 'bg-vizme-navy text-white border-vizme-navy'
                      : 'bg-vizme-bg border-vizme-navy/10 text-vizme-greyblue hover:border-vizme-navy/30'
                  }`}
                >
                  {TYPE_LABEL[t] ?? t}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Chart */}
        <div className="px-3 pb-3 cursor-pointer" style={{ height }} onClick={() => setIsFullscreen(true)}>
          <ResponsiveContainer width="100%" height="100%">
            {renderChart() ?? <div />}
          </ResponsiveContainer>
        </div>

        {/* Selected data point info */}
        {highlightIdx !== null && chart.data[highlightIdx] && (
          <div className="mx-5 mb-3 bg-vizme-bg rounded-xl p-3 border border-vizme-navy/5 flex items-center justify-between animate-in fade-in duration-150">
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: PALETTE[highlightIdx % PALETTE.length] }} />
              <span className="text-xs font-semibold text-vizme-navy">
                {String(chart.data[highlightIdx][chart.xKey] ?? '')}
              </span>
              <span className="text-xs text-vizme-greyblue">
                {fmtNum(chart.data[highlightIdx][chart.yKey])}
              </span>
            </div>
            <button onClick={() => setHighlightIdx(null)} className="text-vizme-greyblue hover:text-vizme-navy">
              <X size={12} />
            </button>
          </div>
        )}

        {/* Insight */}
        {chart.insight && (
          <div className="px-5 pb-5">
            <InsightStrip insight={chart.insight} type={chart.insightType} />
          </div>
        )}
      </div>

      {/* Fullscreen modal */}
      {isFullscreen && (
        <FullscreenModal
          chart={chart}
          renderChart={renderChart}
          onClose={() => setIsFullscreen(false)}
        />
      )}
    </>
  );
};

export default V3Chart;
