import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FileText, BarChart2, Globe, TrendingUp as TrendingUpIcon,
  RefreshCw, Loader2, Brain, TrendingUp, AlertTriangle,
  CheckCircle2, ArrowRight, Zap, Target, MapPin,
} from 'lucide-react';
import { supabase, invokeFunction } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import type { EnrichedProfile } from '../lib/v3types';

// ─────────────────────────────────────────────
// Types (V3 edge function response shapes)
// ─────────────────────────────────────────────

interface V3ExecutiveReport {
  titulo: string;
  resumen: string;
  fortalezas: string[];
  debilidades: string[];
  oportunidades: string[];
  riesgos: string[];
  acciones: { accion: string; plazo: string; impacto: string }[];
  kpiClave: string;
  score: number;
}

interface V3InternalAnalysis {
  health_score: number;
  health_justification: string;
  kpis_negocio: { nombre: string; valor: string; benchmark: string; status: 'bueno' | 'alerta' | 'critico'; tendencia: string }[];
  segmentacion: { dimension: string; segmentos: { nombre: string; descripcion: string; porcentaje: number; valor: string }[] };
  anomalias: { descripcion: string; severidad: 'alta' | 'media' | 'baja'; accion: string }[];
  fortalezas_operativas: string[];
  areas_criticas: string[];
  plan_accion: { accion: string; impacto: string; plazo: string; responsable: string }[];
}

interface V3ExternalAnalysis {
  posicionamiento: { nivel: 'lider' | 'competitivo' | 'rezagado' | 'emergente'; descripcion: string };
  benchmarks: { metrica: string; tu_valor: string; rango_mercado: string; status: 'arriba' | 'dentro' | 'abajo'; interpretacion: string }[];
  tendencias_sector: { tendencia: string; impacto: 'positivo' | 'negativo' | 'neutro'; relevancia: string }[];
  oportunidades_mercado: string[];
  amenazas_externas: string[];
  estrategia_recomendada: string;
  mapa_competidores?: { nombre: string; ubicacion: string; distancia_km?: number }[];
}

interface V3PredictiveAnalysis {
  predicciones: { metrica: string; valor_actual: string; prediccion_30d: string; prediccion_90d: string; confianza: number; tendencia: 'up' | 'down' | 'stable' }[];
  escenarios: { nombre: string; tipo: 'optimista' | 'realista' | 'pesimista'; descripcion: string; probabilidad: number; acciones: string[] }[];
  plan_accion_predictivo: { accion: string; plazo: string; impacto_esperado: string; prioridad: 'alta' | 'media' | 'baja' }[];
  resumen_predictivo: string;
}

// ─────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────

type TabId = 'executive' | 'internal' | 'external' | 'predictions';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'executive',   label: 'FODA & Ejecutivo',     icon: FileText     },
  { id: 'internal',    label: 'Cadena de Valor',      icon: BarChart2    },
  { id: 'external',    label: 'Externo & Mercado',    icon: Globe        },
  { id: 'predictions', label: 'Predicciones',         icon: TrendingUpIcon },
];

const MAX_REGENERATIONS_PER_MONTH = 5;

// ─────────────────────────────────────────────
// Score ring
// ─────────────────────────────────────────────

const ScoreRing: React.FC<{ score: number }> = ({ score }) => {
  const pct = (score / 100) * 100;
  const color = score >= 70 ? '#16a34a' : score >= 50 ? '#F26A3D' : '#F54A43';
  return (
    <div className="relative h-20 w-20 flex-shrink-0">
      <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
        <circle cx="40" cy="40" r="32" fill="none" stroke="#EBF8FE" strokeWidth="8" />
        <circle cx="40" cy="40" r="32" fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${pct * 2.01} 201`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-black text-vizme-navy" style={{ color }}>{score}</span>
        <span className="text-[9px] text-vizme-greyblue">/100</span>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// Executive tab
// ─────────────────────────────────────────────

const ExecutiveTab: React.FC<{
  report: V3ExecutiveReport | null;
  generating: boolean;
  onGenerate: () => void;
}> = ({ report, generating, onGenerate }) => {
  if (!report) {
    return <EmptyTab label="Genera el reporte ejecutivo para ver el estado completo de tu negocio: score, fortalezas, debilidades y plan de acción." onGenerate={onGenerate} generating={generating} />;
  }

  const PLAZO_COLOR: Record<string, string> = {
    'esta semana': 'text-vizme-red bg-red-50 border-vizme-red/20',
    'este mes':    'text-vizme-orange bg-orange-50 border-vizme-orange/20',
    'este trimestre': 'text-emerald-600 bg-emerald-50 border-emerald-200',
  };

  return (
    <div className="space-y-4">
      {/* Score + resumen */}
      <div className="bg-white rounded-2xl border border-vizme-navy/8 p-5 shadow-sm">
        <div className="flex items-start gap-5">
          <ScoreRing score={report.score} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-vizme-greyblue mb-1 uppercase tracking-wider">Health Score</p>
            <h3 className="text-base font-bold text-vizme-navy leading-snug mb-2">{report.titulo}</h3>
            <p className="text-sm text-vizme-greyblue leading-relaxed line-clamp-3">{report.resumen}</p>
          </div>
        </div>
        {report.kpiClave && (
          <div className="mt-4 flex items-center gap-2.5 bg-vizme-navy/4 rounded-xl px-4 py-3">
            <Target size={14} className="text-vizme-red flex-shrink-0" />
            <div>
              <p className="text-[10px] font-bold text-vizme-greyblue uppercase tracking-wider">KPI a vigilar esta semana</p>
              <p className="text-sm font-semibold text-vizme-navy mt-0.5">{report.kpiClave}</p>
            </div>
          </div>
        )}
      </div>

      {/* FODA */}
      <div className="grid sm:grid-cols-2 gap-3">
        {[
          { title: 'Fortalezas', items: report.fortalezas, icon: CheckCircle2, iconColor: 'text-emerald-500', bg: 'bg-emerald-50/60', border: 'border-emerald-100' },
          { title: 'Debilidades', items: report.debilidades, icon: AlertTriangle, iconColor: 'text-vizme-orange', bg: 'bg-orange-50/60', border: 'border-orange-100' },
          { title: 'Oportunidades', items: report.oportunidades, icon: TrendingUp, iconColor: 'text-vizme-red', bg: 'bg-red-50/40', border: 'border-vizme-red/15' },
          { title: 'Riesgos', items: report.riesgos, icon: AlertTriangle, iconColor: 'text-red-600', bg: 'bg-red-50/60', border: 'border-red-200' },
        ].map(({ title, items, icon: Icon, iconColor, bg, border }) => (
          <div key={title} className={`rounded-2xl border p-4 ${bg} ${border}`}>
            <div className="flex items-center gap-2 mb-3">
              <Icon size={13} className={iconColor} />
              <p className="text-xs font-bold text-vizme-navy">{title}</p>
            </div>
            <ul className="space-y-1.5">
              {(items ?? []).map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-[10px] font-bold text-vizme-greyblue/50 mt-0.5 flex-shrink-0">{i + 1}.</span>
                  <span className="text-xs text-vizme-navy leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Plan de acción */}
      {report.acciones?.length > 0 && (
        <div className="bg-white rounded-2xl border border-vizme-navy/8 p-5 shadow-sm">
          <p className="text-xs font-bold text-vizme-navy mb-3">Plan de acción</p>
          <div className="space-y-2.5">
            {report.acciones.map((a, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-vizme-bg rounded-xl">
                <span className="h-5 w-5 rounded-full bg-vizme-navy flex items-center justify-center text-[9px] font-black text-white flex-shrink-0 mt-0.5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-vizme-navy">{a.accion}</p>
                  <p className="text-[11px] text-vizme-greyblue mt-0.5">{a.impacto}</p>
                </div>
                <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border flex-shrink-0 ${PLAZO_COLOR[a.plazo] ?? 'text-vizme-greyblue bg-vizme-bg border-vizme-navy/10'}`}>
                  {a.plazo}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// Internal tab
// ─────────────────────────────────────────────

const InternalTab: React.FC<{
  analysis: V3InternalAnalysis | null;
  generating: boolean;
  onGenerate: () => void;
}> = ({ analysis, generating, onGenerate }) => {
  if (!analysis) {
    return <EmptyTab label="Genera el análisis interno para ver segmentación, KPIs vs benchmarks de tu industria, anomalías y plan de acción." onGenerate={onGenerate} generating={generating} />;
  }

  const STATUS_COLOR: Record<string, string> = {
    bueno:   'text-emerald-600 bg-emerald-50 border-emerald-200',
    alerta:  'text-vizme-orange bg-orange-50 border-vizme-orange/20',
    critico: 'text-vizme-red bg-red-50 border-vizme-red/20',
  };
  const SEV_COLOR: Record<string, string> = {
    alta:  'text-vizme-red bg-red-50',
    media: 'text-vizme-orange bg-orange-50',
    baja:  'text-vizme-greyblue bg-vizme-bg',
  };

  return (
    <div className="space-y-4">
      {/* Health score */}
      <div className="bg-white rounded-2xl border border-vizme-navy/8 p-5 shadow-sm flex items-start gap-5">
        <ScoreRing score={analysis.health_score} />
        <div className="flex-1">
          <p className="text-xs font-bold text-vizme-greyblue uppercase tracking-wider mb-1">Salud operacional</p>
          <p className="text-sm text-vizme-navy leading-relaxed">{analysis.health_justification}</p>
        </div>
      </div>

      {/* KPIs vs benchmarks */}
      {analysis.kpis_negocio?.length > 0 && (
        <div className="bg-white rounded-2xl border border-vizme-navy/8 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-vizme-navy/6">
            <p className="text-xs font-bold text-vizme-navy">KPIs vs benchmarks de industria</p>
          </div>
          <div className="divide-y divide-vizme-navy/5">
            {analysis.kpis_negocio.map((kpi, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-vizme-navy">{kpi.nombre}</p>
                  <p className="text-[10px] text-vizme-greyblue mt-0.5">Benchmark: {kpi.benchmark}</p>
                </div>
                <p className="text-sm font-bold text-vizme-navy flex-shrink-0">{kpi.valor}</p>
                <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border flex-shrink-0 ${STATUS_COLOR[kpi.status] ?? ''}`}>
                  {kpi.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Segmentación */}
      {analysis.segmentacion?.segmentos?.length > 0 && (
        <div className="bg-white rounded-2xl border border-vizme-navy/8 p-5 shadow-sm">
          <p className="text-xs font-bold text-vizme-navy mb-3">Segmentación por {analysis.segmentacion.dimension}</p>
          <div className="space-y-2.5">
            {analysis.segmentacion.segmentos.map((seg, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-vizme-navy">{seg.nombre}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-vizme-navy">{seg.valor}</span>
                    <span className="text-[10px] text-vizme-greyblue">{seg.porcentaje}%</span>
                  </div>
                </div>
                <div className="h-1.5 bg-vizme-bg rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-vizme-red to-vizme-orange"
                    style={{ width: `${seg.porcentaje}%` }}
                  />
                </div>
                <p className="text-[10px] text-vizme-greyblue mt-1">{seg.descripcion}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Anomalías */}
      {analysis.anomalias?.length > 0 && (
        <div className="bg-white rounded-2xl border border-vizme-navy/8 p-5 shadow-sm">
          <p className="text-xs font-bold text-vizme-navy mb-3">Anomalías detectadas</p>
          <div className="space-y-2.5">
            {analysis.anomalias.map((a, i) => (
              <div key={i} className={`rounded-xl p-3 ${SEV_COLOR[a.severidad] ?? 'bg-vizme-bg'}`}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-xs font-semibold text-vizme-navy">{a.descripcion}</p>
                  <span className="text-[9px] font-bold uppercase text-vizme-greyblue flex-shrink-0">{a.severidad}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ArrowRight size={10} className="text-vizme-greyblue flex-shrink-0" />
                  <p className="text-[10px] text-vizme-greyblue">{a.accion}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fortalezas operativas + áreas críticas */}
      <div className="grid sm:grid-cols-2 gap-3">
        {analysis.fortalezas_operativas?.length > 0 && (
          <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4">
            <p className="text-xs font-bold text-vizme-navy mb-3">Fortalezas operativas</p>
            <ul className="space-y-1.5">
              {analysis.fortalezas_operativas.map((f, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 size={11} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-vizme-navy">{f}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {analysis.areas_criticas?.length > 0 && (
          <div className="bg-red-50/60 border border-vizme-red/15 rounded-2xl p-4">
            <p className="text-xs font-bold text-vizme-navy mb-3">Áreas críticas</p>
            <ul className="space-y-1.5">
              {analysis.areas_criticas.map((a, i) => (
                <li key={i} className="flex items-start gap-2">
                  <AlertTriangle size={11} className="text-vizme-red flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-vizme-navy">{a}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Plan de acción */}
      {analysis.plan_accion?.length > 0 && (
        <div className="bg-white rounded-2xl border border-vizme-navy/8 p-5 shadow-sm">
          <p className="text-xs font-bold text-vizme-navy mb-3">Plan de acción</p>
          <div className="space-y-2.5">
            {analysis.plan_accion.map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-vizme-bg rounded-xl">
                <span className="h-5 w-5 rounded-full bg-vizme-navy flex items-center justify-center text-[9px] font-black text-white flex-shrink-0 mt-0.5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-vizme-navy">{item.accion}</p>
                  <p className="text-[11px] text-vizme-greyblue mt-0.5">{item.impacto}</p>
                  {item.responsable && (
                    <p className="text-[10px] text-vizme-greyblue/60 mt-0.5">Responsable: {item.responsable}</p>
                  )}
                </div>
                <span className="text-[9px] font-bold uppercase text-vizme-greyblue flex-shrink-0 mt-0.5">{item.plazo}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// External tab
// ─────────────────────────────────────────────

const ExternalTab: React.FC<{
  analysis: V3ExternalAnalysis | null;
  generating: boolean;
  onGenerate: () => void;
}> = ({ analysis, generating, onGenerate }) => {
  if (!analysis) {
    return <EmptyTab label="Genera el análisis externo para ver tu posición competitiva, benchmarks de tu industria en México y oportunidades de mercado." onGenerate={onGenerate} generating={generating} />;
  }

  const NIVEL_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    lider:       { label: 'Líder',       color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
    competitivo: { label: 'Competitivo', color: 'text-vizme-navy',  bg: 'bg-vizme-bg border-vizme-navy/10' },
    rezagado:    { label: 'Rezagado',    color: 'text-vizme-orange', bg: 'bg-orange-50 border-orange-200' },
    emergente:   { label: 'Emergente',   color: 'text-vizme-red',   bg: 'bg-red-50 border-vizme-red/20' },
  };
  const STATUS_COLOR: Record<string, string> = {
    arriba: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    dentro: 'text-vizme-greyblue bg-vizme-bg border-vizme-navy/10',
    abajo:  'text-vizme-red bg-red-50 border-vizme-red/20',
  };
  const IMPACTO_COLOR: Record<string, string> = {
    positivo: 'text-emerald-600',
    negativo: 'text-vizme-red',
    neutro:   'text-vizme-greyblue',
  };

  const posConfig = NIVEL_CONFIG[analysis.posicionamiento?.nivel] ?? NIVEL_CONFIG.competitivo;

  return (
    <div className="space-y-4">
      {/* Posicionamiento */}
      <div className={`rounded-2xl border p-5 shadow-sm ${posConfig.bg}`}>
        <div className="flex items-center gap-3 mb-2">
          <span className={`text-xs font-black uppercase tracking-wider ${posConfig.color}`}>
            Posición: {posConfig.label}
          </span>
        </div>
        <p className="text-sm text-vizme-navy leading-relaxed">{analysis.posicionamiento?.descripcion}</p>
      </div>

      {/* Benchmarks */}
      {analysis.benchmarks?.length > 0 && (
        <div className="bg-white rounded-2xl border border-vizme-navy/8 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-vizme-navy/6">
            <p className="text-xs font-bold text-vizme-navy">Benchmarks vs industria en México</p>
          </div>
          <div className="divide-y divide-vizme-navy/5">
            {analysis.benchmarks.map((b, i) => (
              <div key={i} className="px-4 py-3">
                <div className="flex items-center gap-3 mb-1">
                  <p className="text-xs font-semibold text-vizme-navy flex-1">{b.metrica}</p>
                  <span className="text-sm font-bold text-vizme-navy">{b.tu_valor}</span>
                  <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border flex-shrink-0 ${STATUS_COLOR[b.status] ?? ''}`}>
                    {b.status}
                  </span>
                </div>
                <p className="text-[10px] text-vizme-greyblue">Rango saludable: {b.rango_mercado}</p>
                <p className="text-[10px] text-vizme-greyblue mt-0.5 italic">{b.interpretacion}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tendencias del sector */}
      {analysis.tendencias_sector?.length > 0 && (
        <div className="bg-white rounded-2xl border border-vizme-navy/8 p-5 shadow-sm">
          <p className="text-xs font-bold text-vizme-navy mb-3">Tendencias del sector</p>
          <div className="space-y-2.5">
            {analysis.tendencias_sector.map((t, i) => (
              <div key={i} className="flex items-start gap-3">
                <TrendingUp size={12} className={`flex-shrink-0 mt-0.5 ${IMPACTO_COLOR[t.impacto] ?? ''}`} />
                <div className="flex-1">
                  <p className="text-xs text-vizme-navy">{t.tendencia}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[9px] font-bold uppercase ${IMPACTO_COLOR[t.impacto] ?? ''}`}>{t.impacto}</span>
                    <span className="text-[9px] text-vizme-greyblue">· relevancia {t.relevancia}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Oportunidades + Amenazas */}
      <div className="grid sm:grid-cols-2 gap-3">
        {analysis.oportunidades_mercado?.length > 0 && (
          <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4">
            <p className="text-xs font-bold text-vizme-navy mb-3">Oportunidades</p>
            <ul className="space-y-1.5">
              {analysis.oportunidades_mercado.map((o, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Zap size={10} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-vizme-navy">{o}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {analysis.amenazas_externas?.length > 0 && (
          <div className="bg-red-50/60 border border-vizme-red/15 rounded-2xl p-4">
            <p className="text-xs font-bold text-vizme-navy mb-3">Amenazas externas</p>
            <ul className="space-y-1.5">
              {analysis.amenazas_externas.map((a, i) => (
                <li key={i} className="flex items-start gap-2">
                  <AlertTriangle size={10} className="text-vizme-red flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-vizme-navy">{a}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Mapa de competidores / ubicaciones */}
      {analysis.mapa_competidores && analysis.mapa_competidores.length > 0 && (
        <div className="bg-white rounded-2xl border border-vizme-navy/8 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <MapPin size={13} className="text-vizme-red" />
            <p className="text-xs font-bold text-vizme-navy">Mapa de competidores</p>
          </div>
          <div className="rounded-xl border border-vizme-navy/8 overflow-hidden mb-3" style={{ height: 220 }}>
            <iframe
              title="Mapa"
              width="100%"
              height="220"
              style={{ border: 0 }}
              loading="lazy"
              src={`https://www.google.com/maps/embed/v1/search?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${encodeURIComponent(analysis.mapa_competidores.map(c => c.ubicacion).join('|'))}&zoom=12`}
            />
          </div>
          <div className="space-y-1.5">
            {analysis.mapa_competidores.map((c, i) => (
              <div key={i} className="flex items-center gap-2.5 text-xs">
                <MapPin size={10} className="text-vizme-greyblue flex-shrink-0" />
                <span className="font-medium text-vizme-navy">{c.nombre}</span>
                <span className="text-vizme-greyblue">{c.ubicacion}</span>
                {c.distancia_km && <span className="text-[10px] text-vizme-greyblue/60 ml-auto">{c.distancia_km} km</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Estrategia recomendada */}
      {analysis.estrategia_recomendada && (
        <div className="bg-vizme-navy rounded-2xl p-5">
          <p className="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-2">Estrategia recomendada</p>
          <p className="text-sm text-white leading-relaxed">{analysis.estrategia_recomendada}</p>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// Predictive tab
// ─────────────────────────────────────────────

const PredictiveTab: React.FC<{
  analysis: V3PredictiveAnalysis | null;
  generating: boolean;
  onGenerate: () => void;
}> = ({ analysis, generating, onGenerate }) => {
  if (!analysis) {
    return <EmptyTab label="Genera el análisis predictivo para ver proyecciones a 30 y 90 días, escenarios posibles y un plan de acción basado en tendencias." onGenerate={onGenerate} generating={generating} />;
  }

  const TREND_ICON: Record<string, { Icon: React.ElementType; color: string }> = {
    up:     { Icon: TrendingUp, color: 'text-emerald-600' },
    down:   { Icon: AlertTriangle, color: 'text-vizme-red' },
    stable: { Icon: ArrowRight, color: 'text-vizme-greyblue' },
  };
  const ESCENARIO_COLOR: Record<string, string> = {
    optimista: 'bg-emerald-50/60 border-emerald-100',
    realista:  'bg-vizme-bg border-vizme-navy/8',
    pesimista: 'bg-red-50/60 border-vizme-red/15',
  };
  const PRIORIDAD_COLOR: Record<string, string> = {
    alta:  'text-vizme-red bg-red-50 border-vizme-red/20',
    media: 'text-vizme-orange bg-orange-50 border-vizme-orange/20',
    baja:  'text-vizme-greyblue bg-vizme-bg border-vizme-navy/10',
  };

  return (
    <div className="space-y-4">
      {/* Resumen */}
      {analysis.resumen_predictivo && (
        <div className="bg-vizme-navy rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-vizme-red/20 blur-2xl pointer-events-none" />
          <div className="flex items-center gap-2.5 mb-3">
            <Brain size={14} className="text-white" />
            <p className="text-[10px] font-bold text-white/50 uppercase tracking-wider">Resumen predictivo</p>
          </div>
          <p className="text-sm text-white/90 leading-relaxed relative z-10">{analysis.resumen_predictivo}</p>
        </div>
      )}

      {/* Predicciones */}
      {analysis.predicciones?.length > 0 && (
        <div className="bg-white rounded-2xl border border-vizme-navy/8 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-vizme-navy/6">
            <p className="text-xs font-bold text-vizme-navy">Proyecciones de metricas clave</p>
          </div>
          <div className="divide-y divide-vizme-navy/5">
            {analysis.predicciones.map((p, i) => {
              const { Icon, color } = TREND_ICON[p.tendencia] ?? TREND_ICON.stable;
              return (
                <div key={i} className="px-4 py-3">
                  <div className="flex items-center gap-3 mb-1.5">
                    <Icon size={12} className={`flex-shrink-0 ${color}`} />
                    <p className="text-xs font-semibold text-vizme-navy flex-1">{p.metrica}</p>
                    <span className="text-sm font-bold text-vizme-navy">{p.valor_actual}</span>
                  </div>
                  <div className="flex items-center gap-4 ml-6">
                    <div>
                      <p className="text-[9px] text-vizme-greyblue uppercase">30 dias</p>
                      <p className="text-xs font-bold text-vizme-navy">{p.prediccion_30d}</p>
                    </div>
                    <ArrowRight size={10} className="text-vizme-navy/20" />
                    <div>
                      <p className="text-[9px] text-vizme-greyblue uppercase">90 dias</p>
                      <p className="text-xs font-bold text-vizme-navy">{p.prediccion_90d}</p>
                    </div>
                    <div className="ml-auto">
                      <div className="flex items-center gap-1">
                        <div className="w-16 h-1.5 bg-vizme-bg rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-vizme-red" style={{ width: `${p.confianza}%` }} />
                        </div>
                        <span className="text-[9px] text-vizme-greyblue">{p.confianza}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Escenarios */}
      {analysis.escenarios?.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-bold text-vizme-navy">Escenarios posibles</p>
          <div className="grid sm:grid-cols-3 gap-3">
            {analysis.escenarios.map((e, i) => (
              <div key={i} className={`rounded-2xl border p-4 ${ESCENARIO_COLOR[e.tipo] ?? ESCENARIO_COLOR.realista}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-vizme-navy capitalize">{e.nombre}</p>
                  <span className="text-[9px] font-bold text-vizme-greyblue">{e.probabilidad}%</span>
                </div>
                <p className="text-[11px] text-vizme-greyblue leading-relaxed mb-3">{e.descripcion}</p>
                {e.acciones?.length > 0 && (
                  <ul className="space-y-1">
                    {e.acciones.map((a, j) => (
                      <li key={j} className="flex items-start gap-1.5 text-[10px] text-vizme-navy">
                        <Zap size={8} className="text-vizme-red flex-shrink-0 mt-0.5" /> {a}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plan de acción predictivo */}
      {analysis.plan_accion_predictivo?.length > 0 && (
        <div className="bg-white rounded-2xl border border-vizme-navy/8 p-5 shadow-sm">
          <p className="text-xs font-bold text-vizme-navy mb-3">Plan de accion predictivo</p>
          <div className="space-y-2.5">
            {analysis.plan_accion_predictivo.map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-vizme-bg rounded-xl">
                <span className="h-5 w-5 rounded-full bg-vizme-navy flex items-center justify-center text-[9px] font-black text-white flex-shrink-0 mt-0.5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-vizme-navy">{item.accion}</p>
                  <p className="text-[11px] text-vizme-greyblue mt-0.5">{item.impacto_esperado}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${PRIORIDAD_COLOR[item.prioridad] ?? ''}`}>
                    {item.prioridad}
                  </span>
                  <span className="text-[9px] text-vizme-greyblue">{item.plazo}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────

const EmptyTab: React.FC<{ label: string; onGenerate: () => void; generating: boolean }> = ({ label, onGenerate, generating }) => (
  <div className="bg-white rounded-2xl border border-vizme-navy/8 p-12 text-center shadow-sm">
    <div className="h-12 w-12 rounded-2xl bg-vizme-bg mx-auto flex items-center justify-center mb-4">
      <Brain size={22} className="text-vizme-greyblue" />
    </div>
    <p className="text-sm text-vizme-greyblue max-w-xs mx-auto mb-5 leading-relaxed">{label}</p>
    <button
      onClick={onGenerate}
      disabled={generating}
      className="inline-flex items-center gap-2 rounded-xl bg-vizme-red px-5 py-2.5 text-sm font-semibold text-white hover:bg-vizme-orange transition-all hover:-translate-y-0.5 disabled:opacity-50"
    >
      {generating ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
      Generar análisis
    </button>
  </div>
);

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

const AnalysisPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const { activeProject } = useProject();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabId>('executive');
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);
  const [enrichedProfile, setEnrichedProfile] = useState<EnrichedProfile | null>(null);
  const [extractedData, setExtractedData] = useState<unknown>(null);
  const [dashboardCtx, setDashboardCtx] = useState<unknown>(null);
  const [industry, setIndustry] = useState<string>('empresa');

  // Per-tab state
  const [executiveReport, setExecutiveReport] = useState<V3ExecutiveReport | null>(null);
  const [internalAnalysis, setInternalAnalysis] = useState<V3InternalAnalysis | null>(null);
  const [externalAnalysis, setExternalAnalysis] = useState<V3ExternalAnalysis | null>(null);
  const [predictiveAnalysis, setPredictiveAnalysis] = useState<V3PredictiveAnalysis | null>(null);
  const [generating, setGenerating] = useState<TabId | null>(null);
  const [errors, setErrors] = useState<Partial<Record<TabId, string>>>({});
  const [regenCount, setRegenCount] = useState(0);

  // ── Load latest file + dashboard ──────────────────────────────────────────
  useEffect(() => {
    if (!user || !projectId) return;

    const load = async () => {
      setLoading(true);

      // Load latest active file
      const { data: file } = await supabase
        .from('files')
        .select('enriched_profile, detected_business_type, extracted_data')
        .eq('user_id', user.id)
        .eq('project_id', projectId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (file?.enriched_profile) {
        setEnrichedProfile(file.enriched_profile as EnrichedProfile);
        setHasData(true);
        if (file.detected_business_type) setIndustry(file.detected_business_type);
        if (file.extracted_data) setExtractedData(file.extracted_data);
      }

      // Load latest dashboard for context
      const { data: dash } = await supabase
        .from('dashboards')
        .select('charts_json,kpis_json,summary_json,alerts_json,health_score')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (dash) setDashboardCtx(dash);

      // Industry from project
      if ((activeProject as any)?.analysis_area) {
        setIndustry((activeProject as any).analysis_area);
      }

      // Load saved analysis results
      const { data: savedAnalyses } = await supabase
        .from('analysis_history')
        .select('mode, result_json, created_at')
        .eq('user_id', user.id)
        .in('mode', ['executive', 'internal', 'external', 'predictions'])
        .order('created_at', { ascending: false })
        .limit(20);

      if (savedAnalyses) {
        for (const sa of savedAnalyses) {
          if (sa.mode === 'executive' && !executiveReport && sa.result_json) setExecutiveReport(sa.result_json as V3ExecutiveReport);
          if (sa.mode === 'internal' && !internalAnalysis && sa.result_json) setInternalAnalysis(sa.result_json as V3InternalAnalysis);
          if (sa.mode === 'external' && !externalAnalysis && sa.result_json) setExternalAnalysis(sa.result_json as V3ExternalAnalysis);
          if (sa.mode === 'predictions' && !predictiveAnalysis && sa.result_json) setPredictiveAnalysis(sa.result_json as V3PredictiveAnalysis);
        }

        // Count this month's regenerations
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const thisMonthCount = savedAnalyses.filter(s => new Date(s.created_at) >= monthStart).length;
        setRegenCount(thisMonthCount);
      }

      setLoading(false);
    };

    load();
  }, [user, projectId, activeProject]);

  // ── Generate helpers ──────────────────────────────────────────────────────

  const clearError = (tab: TabId) => setErrors(prev => ({ ...prev, [tab]: undefined }));

  const generateExecutive = useCallback(async () => {
    if (!enrichedProfile && !dashboardCtx) return;
    setGenerating('executive');
    clearError('executive');
    try {
      const { data, error } = await invokeFunction('analyze-data', {
        body: {
          mode: 'executive',
          reportData: dashboardCtx ?? { enrichedProfile },
          enrichedProfile,
          extractedData: extractedData ?? undefined,
          projectId,
        },
      });
      if (error) throw new Error(error.message ?? 'Error desconocido');
      if (!data?.success) throw new Error(data?.error ?? 'Error generando reporte');
      setExecutiveReport(data.report as V3ExecutiveReport);

      // Save to DB
      if (user) {
        await supabase.from('analysis_history').insert({
          user_id: user.id,
          mode: 'executive',
          result_json: data.report,
        });
        setRegenCount(c => c + 1);
      }
    } catch (err: any) {
      setErrors(prev => ({ ...prev, executive: err?.message ?? 'Error desconocido' }));
    } finally {
      setGenerating(null);
    }
  }, [enrichedProfile, extractedData, dashboardCtx, projectId, user]);

  const generateInternal = useCallback(async () => {
    if (!enrichedProfile) return;
    setGenerating('internal');
    clearError('internal');
    try {
      const { data, error } = await invokeFunction('analyze-data', {
        body: {
          mode: 'internal',
          enrichedProfile,
          extractedData: extractedData ?? undefined,
          internalAnalysis: dashboardCtx ?? {},
          projectId,
        },
      });
      if (error) throw new Error(error.message ?? 'Error desconocido');
      if (!data?.success) throw new Error(data?.error ?? 'Error generando análisis interno');
      setInternalAnalysis(data.internalAnalysis as V3InternalAnalysis);

      if (user) {
        await supabase.from('analysis_history').insert({
          user_id: user.id,
          mode: 'internal',
          result_json: data.internalAnalysis,
        });
        setRegenCount(c => c + 1);
      }
    } catch (err: any) {
      setErrors(prev => ({ ...prev, internal: err?.message ?? 'Error desconocido' }));
    } finally {
      setGenerating(null);
    }
  }, [enrichedProfile, extractedData, dashboardCtx, projectId, user]);

  const generateExternal = useCallback(async () => {
    if (!enrichedProfile) return;
    setGenerating('external');
    clearError('external');
    try {
      const { data, error } = await invokeFunction('analyze-data', {
        body: {
          mode: 'external',
          enrichedProfile,
          extractedData: extractedData ?? undefined,
          externalAnalysis: { dataProfile: enrichedProfile, industry },
          profileContext: { industry },
          projectId,
        },
      });
      if (error) throw new Error(error.message ?? 'Error desconocido');
      if (!data?.success) throw new Error(data?.error ?? 'Error generando análisis externo');
      setExternalAnalysis(data.externalAnalysis as V3ExternalAnalysis);

      if (user) {
        await supabase.from('analysis_history').insert({
          user_id: user.id,
          mode: 'external',
          result_json: data.externalAnalysis,
        });
        setRegenCount(c => c + 1);
      }
    } catch (err: any) {
      setErrors(prev => ({ ...prev, external: err?.message ?? 'Error desconocido' }));
    } finally {
      setGenerating(null);
    }
  }, [enrichedProfile, extractedData, industry, projectId, user]);

  const generatePredictions = useCallback(async () => {
    if (!enrichedProfile) return;
    setGenerating('predictions');
    clearError('predictions');
    try {
      const { data, error } = await invokeFunction('analyze-data', {
        body: {
          mode: 'predictions',
          enrichedProfile,
          extractedData: extractedData ?? undefined,
          profileContext: { industry },
          projectId,
        },
      });
      if (error) throw new Error(error.message ?? 'Error desconocido');
      if (!data?.success) throw new Error(data?.error ?? 'Error generando análisis predictivo');
      setPredictiveAnalysis(data.predictions as V3PredictiveAnalysis);

      if (user) {
        await supabase.from('analysis_history').insert({
          user_id: user.id,
          mode: 'predictions',
          result_json: data.predictions,
        });
        setRegenCount(c => c + 1);
      }
    } catch (err: any) {
      setErrors(prev => ({ ...prev, predictions: err?.message ?? 'Error desconocido' }));
    } finally {
      setGenerating(null);
    }
  }, [enrichedProfile, extractedData, industry, projectId, user]);

  const canRegenerate = regenCount < MAX_REGENERATIONS_PER_MONTH;

  const generateForTab = (tab: TabId) => {
    if (!canRegenerate) return;
    if (tab === 'executive') generateExecutive();
    else if (tab === 'internal') generateInternal();
    else if (tab === 'external') generateExternal();
    else if (tab === 'predictions') generatePredictions();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={22} className="animate-spin text-vizme-greyblue" />
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <Brain size={32} className="text-vizme-navy/20 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-vizme-navy mb-2">Sin datos aún</h2>
        <p className="text-sm text-vizme-greyblue mb-5">Sube un archivo en "Mis Datos" para generar los análisis.</p>
        <button
          onClick={() => navigate(`/dashboard/projects/${projectId}/data`)}
          className="inline-flex items-center gap-2 rounded-xl bg-vizme-red px-5 py-2.5 text-sm font-semibold text-white hover:bg-vizme-orange transition-all hover:-translate-y-0.5"
        >
          <ArrowRight size={14} /> Ir a Mis Datos
        </button>
      </div>
    );
  }

  const isGenerating = generating === activeTab;

  return (
    <div className="max-w-5xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-vizme-greyblue mb-0.5">
            {activeProject?.name ?? 'Proyecto'}
          </p>
          <h1 className="text-2xl font-bold text-vizme-navy">Análisis IA</h1>
        </div>
        <div className="flex items-center gap-2">
          {!canRegenerate && (
            <span className="text-[10px] text-vizme-greyblue">Limite mensual alcanzado</span>
          )}
          <button
            onClick={() => generateForTab(activeTab)}
            disabled={isGenerating || !canRegenerate}
            className="flex items-center gap-2 rounded-xl bg-vizme-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-vizme-orange transition-all hover:-translate-y-0.5 disabled:opacity-50"
          >
            {isGenerating
              ? <><Loader2 size={13} className="animate-spin" />Generando...</>
              : <><Brain size={13} />{
                  (activeTab === 'executive' && executiveReport) ||
                  (activeTab === 'internal' && internalAnalysis) ||
                  (activeTab === 'external' && externalAnalysis) ||
                  (activeTab === 'predictions' && predictiveAnalysis)
                    ? 'Regenerar' : 'Generar análisis'
                }</>
            }
            <span className="text-[9px] opacity-70">({MAX_REGENERATIONS_PER_MONTH - regenCount}/{MAX_REGENERATIONS_PER_MONTH})</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-2xl border border-vizme-navy/8 p-1 shadow-sm">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all flex-1 justify-center ${
              activeTab === id
                ? 'bg-vizme-navy text-white shadow-sm'
                : 'text-vizme-greyblue hover:text-vizme-navy hover:bg-vizme-bg'
            }`}
          >
            <Icon size={13} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Error banner */}
      {errors[activeTab] && (
        <div className="flex items-center gap-2 bg-red-50 border border-vizme-red/20 rounded-xl px-4 py-3">
          <AlertTriangle size={14} className="text-vizme-red flex-shrink-0" />
          <p className="text-xs text-vizme-red flex-1">{errors[activeTab]}</p>
          <button onClick={() => clearError(activeTab)} className="text-[10px] text-vizme-red underline">Cerrar</button>
        </div>
      )}

      {/* Tab content */}
      {activeTab === 'executive' && (
        <ExecutiveTab report={executiveReport} generating={isGenerating} onGenerate={generateExecutive} />
      )}
      {activeTab === 'internal' && (
        <InternalTab analysis={internalAnalysis} generating={isGenerating} onGenerate={generateInternal} />
      )}
      {activeTab === 'external' && (
        <ExternalTab analysis={externalAnalysis} generating={isGenerating} onGenerate={generateExternal} />
      )}
      {activeTab === 'predictions' && (
        <PredictiveTab analysis={predictiveAnalysis} generating={isGenerating} onGenerate={generatePredictions} />
      )}
    </div>
  );
};

export default AnalysisPage;
