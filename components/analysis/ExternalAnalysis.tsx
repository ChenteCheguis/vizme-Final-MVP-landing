import React, { useEffect, useState } from 'react';
import {
  Globe, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Loader2, RefreshCw, Brain, ArrowUp, ArrowDown, Minus,
} from 'lucide-react';
import type { DataProfile } from '../../lib/inferDataProfile';
import {
  getExternalAnalysis,
  type ExternalAnalysisResult,
  type BenchmarkExterno,
  type TendenciaSector,
} from '../../lib/chartEngine';

interface Props {
  dataProfile: DataProfile | null;
  industry: string;
  projectId?: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const PositioningBadge: React.FC<{ nivel: ExternalAnalysisResult['posicionamiento']['nivel']; descripcion: string }> = ({ nivel, descripcion }) => {
  const config = {
    lider:       { label: 'Líder de mercado',  color: 'bg-emerald-50 border-emerald-300 text-emerald-700', dot: 'bg-emerald-500' },
    competitivo: { label: 'Competitivo',        color: 'bg-blue-50 border-blue-300 text-blue-700',          dot: 'bg-blue-500'    },
    emergente:   { label: 'Emergente',          color: 'bg-vizme-orange/10 border-vizme-orange/40 text-vizme-orange', dot: 'bg-vizme-orange' },
    rezagado:    { label: 'Necesita atención',  color: 'bg-red-50 border-red-300 text-vizme-red',           dot: 'bg-vizme-red'   },
  }[nivel];

  return (
    <div className="bg-white rounded-2xl border border-vizme-navy/5 p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-2xl bg-vizme-navy/5 flex items-center justify-center flex-shrink-0">
          <Globe size={20} className="text-vizme-navy" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-vizme-greyblue mb-1">Posicionamiento en el mercado</p>
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${config.color}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
              {config.label}
            </span>
          </div>
          <p className="text-sm text-vizme-greyblue leading-relaxed">{descripcion}</p>
        </div>
      </div>
    </div>
  );
};

const BenchmarkRow: React.FC<{ item: BenchmarkExterno }> = ({ item }) => {
  const icon = {
    arriba: <ArrowUp size={12} className="text-emerald-500" />,
    dentro: <Minus size={12} className="text-blue-500" />,
    abajo:  <ArrowDown size={12} className="text-vizme-red" />,
  }[item.status];

  const badge = {
    arriba: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dentro: 'bg-blue-50 text-blue-700 border-blue-200',
    abajo:  'bg-red-50 text-vizme-red border-red-200',
  }[item.status];

  const label = { arriba: 'Por encima', dentro: 'En rango', abajo: 'Por debajo' }[item.status];

  return (
    <div className="py-3 border-b border-vizme-navy/5 last:border-0">
      <div className="flex items-start justify-between gap-3 mb-1">
        <p className="text-[11px] font-semibold text-vizme-navy flex-1">{item.metrica}</p>
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex items-center gap-1 flex-shrink-0 ${badge}`}>
          {icon} {label}
        </span>
      </div>
      <div className="flex items-center gap-4 mb-1">
        <div>
          <span className="text-[9px] text-vizme-greyblue/60 uppercase">Tu valor</span>
          <p className="text-xs font-bold text-vizme-navy">{item.tu_valor || '—'}</p>
        </div>
        <div className="h-6 w-px bg-vizme-navy/10" />
        <div>
          <span className="text-[9px] text-vizme-greyblue/60 uppercase">Mercado</span>
          <p className="text-xs font-bold text-vizme-greyblue">{item.rango_mercado}</p>
        </div>
      </div>
      {item.interpretacion && (
        <p className="text-[11px] text-vizme-greyblue leading-relaxed">{item.interpretacion}</p>
      )}
    </div>
  );
};

const TendenciaRow: React.FC<{ item: TendenciaSector }> = ({ item }) => {
  const impactoIcon = {
    positivo: <TrendingUp size={12} className="text-emerald-500" />,
    negativo: <TrendingDown size={12} className="text-vizme-red" />,
    neutro:   <Minus size={12} className="text-vizme-greyblue" />,
  }[item.impacto];

  const relevanciaColor = {
    alta:   'bg-vizme-navy text-white',
    media:  'bg-vizme-navy/10 text-vizme-navy',
    baja:   'bg-vizme-bg text-vizme-greyblue',
  }[item.relevancia];

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-vizme-navy/5 last:border-0">
      <div className="flex-shrink-0 mt-0.5">{impactoIcon}</div>
      <p className="text-[11px] text-vizme-greyblue leading-relaxed flex-1">{item.tendencia}</p>
      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${relevanciaColor}`}>
        {item.relevancia}
      </span>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const ExternalAnalysis: React.FC<Props> = ({ dataProfile, industry, projectId }) => {
  const [result, setResult] = useState<ExternalAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!dataProfile) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getExternalAnalysis(dataProfile, industry, projectId);
      setResult(res);
    } catch (err: any) {
      setError(err?.message ?? 'Error generando análisis externo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dataProfile && !result) run();
  }, [dataProfile]);

  if (!dataProfile) {
    return (
      <div className="text-center py-16 text-vizme-greyblue text-sm">
        Sube datos para ver el análisis externo.
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
          <p className="text-sm font-semibold text-vizme-navy">Consultando benchmarks del mercado…</p>
          <p className="text-xs text-vizme-greyblue mt-1">Comparando con industria: {industry} · México 2025</p>
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
        <p className="text-xs text-vizme-greyblue">Análisis externo generado por Claude · Sector: <span className="font-semibold text-vizme-navy">{industry}</span></p>
        <button onClick={run} className="flex items-center gap-1.5 text-xs text-vizme-greyblue hover:text-vizme-navy transition-colors">
          <RefreshCw size={11} /> Regenerar
        </button>
      </div>

      {/* Posicionamiento */}
      {result.posicionamiento && (
        <PositioningBadge nivel={result.posicionamiento.nivel} descripcion={result.posicionamiento.descripcion} />
      )}

      {/* Benchmarks */}
      {result.benchmarks?.length > 0 && (
        <div className="bg-white rounded-2xl border border-vizme-navy/5 p-5 shadow-sm">
          <p className="text-xs font-bold text-vizme-navy uppercase tracking-wide mb-1">Benchmarks del mercado mexicano</p>
          <p className="text-[10px] text-vizme-greyblue mb-4">Fuentes: INEGI, AMVO, CONDUSEF, datos sectoriales 2024-2025</p>
          <div>
            {result.benchmarks.map((b, i) => <BenchmarkRow key={i} item={b} />)}
          </div>
        </div>
      )}

      {/* Tendencias del sector */}
      {result.tendencias_sector?.length > 0 && (
        <div className="bg-white rounded-2xl border border-vizme-navy/5 p-5 shadow-sm">
          <p className="text-xs font-bold text-vizme-navy uppercase tracking-wide mb-4">Tendencias del sector</p>
          <div>
            {result.tendencias_sector.map((t, i) => <TendenciaRow key={i} item={t} />)}
          </div>
        </div>
      )}

      {/* Oportunidades + Amenazas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {result.oportunidades_mercado?.length > 0 && (
          <div className="bg-white rounded-2xl border border-vizme-navy/5 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <TrendingUp size={13} className="text-emerald-600" />
              </div>
              <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Oportunidades</p>
            </div>
            <ul className="space-y-2.5">
              {result.oportunidades_mercado.map((o, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 size={12} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-vizme-greyblue leading-relaxed">{o}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.amenazas_externas?.length > 0 && (
          <div className="bg-white rounded-2xl border border-vizme-navy/5 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center">
                <AlertTriangle size={13} className="text-vizme-red" />
              </div>
              <p className="text-xs font-bold text-vizme-red uppercase tracking-wide">Amenazas externas</p>
            </div>
            <ul className="space-y-2.5">
              {result.amenazas_externas.map((a, i) => (
                <li key={i} className="flex items-start gap-2">
                  <AlertTriangle size={12} className="text-vizme-red/60 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-vizme-greyblue leading-relaxed">{a}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Estrategia recomendada */}
      {result.estrategia_recomendada && (
        <div className="rounded-2xl bg-vizme-navy p-5">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <Globe size={14} className="text-white" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1">Estrategia recomendada</p>
              <p className="text-sm text-white leading-relaxed">{result.estrategia_recomendada}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExternalAnalysis;
