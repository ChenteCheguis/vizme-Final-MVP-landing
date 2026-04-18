import React, { useEffect, useState } from 'react';
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Loader2, RefreshCw, Activity, Target, Zap, Brain,
} from 'lucide-react';
import type { DataProfile } from '../../lib/inferDataProfile';
import type { ChartEngineResult } from '../../lib/chartEngine';
import {
  getInternalAnalysis,
  type InternalAnalysisResult,
  type KPINegocio,
  type Anomalia,
  type AccionPlan,
} from '../../lib/chartEngine';

interface Props {
  dataProfile: DataProfile | null;
  chartResult: ChartEngineResult | null;
  projectId?: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const HealthScore: React.FC<{ score: number; justification: string }> = ({ score, justification }) => {
  const color = score >= 70 ? 'text-emerald-600' : score >= 45 ? 'text-vizme-orange' : 'text-vizme-red';
  const ring  = score >= 70 ? 'bg-emerald-500' : score >= 45 ? 'bg-vizme-orange' : 'bg-vizme-red';
  const label = score >= 70 ? 'Saludable' : score >= 45 ? 'En riesgo' : 'Crítico';

  return (
    <div className="bg-white rounded-2xl border border-vizme-navy/5 p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="32" fill="none" stroke="#f1f5f9" strokeWidth="8" />
            <circle
              cx="40" cy="40" r="32" fill="none"
              stroke={score >= 70 ? '#16a34a' : score >= 45 ? '#F26A3D' : '#F54A43'}
              strokeWidth="8"
              strokeDasharray={`${(score / 100) * 201} 201`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-xl font-black ${color}`}>{score}</span>
            <span className="text-[9px] text-vizme-greyblue">/ 100</span>
          </div>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
              score >= 70 ? 'bg-emerald-50 text-emerald-700' :
              score >= 45 ? 'bg-orange-50 text-vizme-orange' :
              'bg-red-50 text-vizme-red'
            }`}>{label}</span>
          </div>
          <p className="text-sm font-bold text-vizme-navy mb-1">Health Score del negocio</p>
          <p className="text-xs text-vizme-greyblue leading-relaxed">{justification}</p>
        </div>
      </div>
    </div>
  );
};

const KPICard: React.FC<{ kpi: KPINegocio }> = ({ kpi }) => {
  const statusColors = {
    bueno:   'bg-emerald-50 border-emerald-200 text-emerald-700',
    alerta:  'bg-orange-50 border-orange-200 text-vizme-orange',
    critico: 'bg-red-50 border-red-200 text-vizme-red',
  };
  const tendenciaIcon = {
    subiendo: <TrendingUp size={11} className="text-emerald-500" />,
    bajando:  <TrendingDown size={11} className="text-vizme-red" />,
    estable:  <Activity size={11} className="text-vizme-greyblue" />,
  };

  return (
    <div className="bg-vizme-bg rounded-xl border border-vizme-navy/5 p-3.5 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-1">
        <p className="text-[10px] text-vizme-greyblue font-semibold uppercase tracking-wider leading-tight">{kpi.nombre}</p>
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${statusColors[kpi.status]}`}>
          {kpi.status}
        </span>
      </div>
      <p className="text-lg font-black text-vizme-navy leading-none">{kpi.valor}</p>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-vizme-greyblue">Benchmark: {kpi.benchmark}</span>
        <span className="flex items-center gap-1">{tendenciaIcon[kpi.tendencia]}</span>
      </div>
    </div>
  );
};

const AnomaliaCard: React.FC<{ item: Anomalia }> = ({ item }) => {
  const sev = {
    alta:  { bg: 'bg-red-50 border-red-200',    icon: 'text-vizme-red',    label: 'Alta' },
    media: { bg: 'bg-orange-50 border-orange-200', icon: 'text-vizme-orange', label: 'Media' },
    baja:  { bg: 'bg-yellow-50 border-yellow-200', icon: 'text-yellow-600',   label: 'Baja' },
  }[item.severidad];

  return (
    <div className={`rounded-xl border p-3.5 flex items-start gap-3 ${sev.bg}`}>
      <AlertTriangle size={14} className={`flex-shrink-0 mt-0.5 ${sev.icon}`} />
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-[9px] font-bold uppercase ${sev.icon}`}>{sev.label}</span>
        </div>
        <p className="text-xs font-semibold text-vizme-navy">{item.descripcion}</p>
        <p className="text-[11px] text-vizme-greyblue mt-1 leading-relaxed">→ {item.accion}</p>
      </div>
    </div>
  );
};

const PlanCard: React.FC<{ item: AccionPlan; index: number }> = ({ item, index }) => {
  const plazoBadge = {
    inmediato: 'bg-vizme-red/10 text-vizme-red',
    '1 mes':   'bg-vizme-orange/10 text-vizme-orange',
    trimestre: 'bg-blue-50 text-blue-600',
  }[item.plazo] ?? 'bg-vizme-bg text-vizme-greyblue';

  return (
    <div className="flex items-start gap-3 py-3 border-b border-vizme-navy/5 last:border-0">
      <div className="h-6 w-6 rounded-full bg-vizme-navy text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
        {index + 1}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <p className="text-xs font-semibold text-vizme-navy">{item.accion}</p>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${plazoBadge}`}>{item.plazo}</span>
        </div>
        <p className="text-[11px] text-vizme-greyblue leading-relaxed">{item.impacto}</p>
        {item.responsable && (
          <p className="text-[10px] text-vizme-greyblue/60 mt-0.5">Responsable: {item.responsable}</p>
        )}
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const InternalAnalysis: React.FC<Props> = ({ dataProfile, chartResult, projectId }) => {
  const [result, setResult] = useState<InternalAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!dataProfile || !chartResult) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getInternalAnalysis(dataProfile, chartResult, projectId);
      setResult(res);
    } catch (err: any) {
      setError(err?.message ?? 'Error generando análisis interno');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dataProfile && chartResult && !result) run();
  }, [dataProfile, chartResult]);

  if (!dataProfile) {
    return (
      <div className="text-center py-16 text-vizme-greyblue text-sm">
        Sube datos para ver el análisis interno.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="h-14 w-14 rounded-2xl bg-vizme-navy/5 flex items-center justify-center">
          <Brain size={24} className="text-vizme-navy animate-pulse" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-vizme-navy">Claude está analizando tu negocio…</p>
          <p className="text-xs text-vizme-greyblue mt-1">Calculando KPIs, segmentación y plan de acción</p>
        </div>
        <Loader2 size={18} className="animate-spin text-vizme-greyblue" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16 space-y-3">
        <AlertTriangle size={28} className="text-vizme-orange mx-auto" />
        <p className="text-sm text-vizme-greyblue">{error}</p>
        <button
          onClick={run}
          className="inline-flex items-center gap-2 rounded-xl bg-vizme-red px-4 py-2 text-xs font-bold text-white hover:bg-vizme-orange transition-all"
        >
          <RefreshCw size={12} /> Reintentar
        </button>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-vizme-greyblue">Análisis generado por Claude IA con tus datos reales</p>
        <button
          onClick={run}
          className="flex items-center gap-1.5 text-xs text-vizme-greyblue hover:text-vizme-navy transition-colors"
        >
          <RefreshCw size={11} /> Regenerar
        </button>
      </div>

      {/* Health Score */}
      <HealthScore score={result.health_score} justification={result.health_justification} />

      {/* KPIs del negocio */}
      {result.kpis_negocio?.length > 0 && (
        <div className="bg-white rounded-2xl border border-vizme-navy/5 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Target size={14} className="text-vizme-navy" />
            <p className="text-xs font-bold text-vizme-navy uppercase tracking-wide">KPIs vs Benchmarks</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {result.kpis_negocio.map((kpi, i) => <KPICard key={i} kpi={kpi} />)}
          </div>
        </div>
      )}

      {/* Segmentación */}
      {result.segmentacion?.segmentos?.length > 0 && (
        <div className="bg-white rounded-2xl border border-vizme-navy/5 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={14} className="text-vizme-navy" />
            <p className="text-xs font-bold text-vizme-navy uppercase tracking-wide">
              Segmentación por {result.segmentacion.dimension}
            </p>
          </div>
          <div className="space-y-3">
            {result.segmentacion.segmentos.map((seg, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-24 flex-shrink-0">
                  <p className="text-[11px] font-semibold text-vizme-navy truncate">{seg.nombre}</p>
                  <p className="text-[10px] text-vizme-greyblue">{seg.valor}</p>
                </div>
                <div className="flex-1">
                  <div className="h-2 rounded-full bg-vizme-bg overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(100, seg.porcentaje)}%`,
                        background: `hsl(${i * 45}, 65%, 50%)`,
                      }}
                    />
                  </div>
                </div>
                <span className="text-[11px] font-bold text-vizme-navy w-10 text-right">{seg.porcentaje}%</span>
              </div>
            ))}
          </div>
          {result.segmentacion.segmentos[0]?.descripcion && (
            <p className="text-[11px] text-vizme-greyblue mt-3 leading-relaxed">
              {result.segmentacion.segmentos[0].descripcion}
            </p>
          )}
        </div>
      )}

      {/* Fortalezas + Áreas críticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {result.fortalezas_operativas?.length > 0 && (
          <div className="bg-white rounded-2xl border border-vizme-navy/5 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <TrendingUp size={13} className="text-emerald-600" />
              </div>
              <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Fortalezas</p>
            </div>
            <ul className="space-y-2.5">
              {result.fortalezas_operativas.map((f, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 size={12} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-vizme-greyblue leading-relaxed">{f}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.areas_criticas?.length > 0 && (
          <div className="bg-white rounded-2xl border border-vizme-navy/5 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center">
                <TrendingDown size={13} className="text-vizme-orange" />
              </div>
              <p className="text-xs font-bold text-vizme-orange uppercase tracking-wide">Áreas críticas</p>
            </div>
            <ul className="space-y-2.5">
              {result.areas_criticas.map((a, i) => (
                <li key={i} className="flex items-start gap-2">
                  <AlertTriangle size={12} className="text-vizme-orange flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-vizme-greyblue leading-relaxed">{a}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Anomalías */}
      {result.anomalias?.length > 0 && (
        <div className="bg-white rounded-2xl border border-vizme-navy/5 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={14} className="text-vizme-red" />
            <p className="text-xs font-bold text-vizme-navy uppercase tracking-wide">Anomalías detectadas</p>
          </div>
          <div className="space-y-2.5">
            {result.anomalias.map((a, i) => <AnomaliaCard key={i} item={a} />)}
          </div>
        </div>
      )}

      {/* Plan de acción */}
      {result.plan_accion?.length > 0 && (
        <div className="bg-white rounded-2xl border border-vizme-navy/5 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-7 w-7 rounded-lg bg-vizme-navy flex items-center justify-center">
              <Zap size={13} className="text-white fill-white" />
            </div>
            <p className="text-xs font-bold text-vizme-navy uppercase tracking-wide">Plan de acción generado por IA</p>
          </div>
          <div>
            {result.plan_accion.map((item, i) => <PlanCard key={i} item={item} index={i} />)}
          </div>
        </div>
      )}
    </div>
  );
};

export default InternalAnalysis;
