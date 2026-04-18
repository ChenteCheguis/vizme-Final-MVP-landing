import React, { useState } from 'react';
import { Loader2, RefreshCw, TrendingUp, AlertTriangle, Zap, Star } from 'lucide-react';
import type { ExecutiveReport as IExecutiveReport } from '../../lib/chartEngine';
import { getExecutiveReport } from '../../lib/chartEngine';
import type { ChartEngineResult } from '../../lib/chartEngine';
import type { DataProfile } from '../../lib/inferDataProfile';

interface Props {
  dataProfile: DataProfile | null;
  chartResult: ChartEngineResult | null;
}

const PLAZO_COLOR: Record<string, string> = {
  inmediato: 'text-vizme-red bg-red-50 border-vizme-red/20',
  '1 mes':   'text-vizme-orange bg-orange-50 border-vizme-orange/20',
  trimestre: 'text-emerald-600 bg-emerald-50 border-emerald-200',
};

const ScoreMeter: React.FC<{ score: number }> = ({ score }) => {
  const pct = (score / 10) * 100;
  const color = score >= 7 ? '#16a34a' : score >= 5 ? '#F26A3D' : '#F54A43';
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-20 w-20 flex-shrink-0">
        <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
          <circle cx="40" cy="40" r="32" fill="none" stroke="#EBF8FE" strokeWidth="8" />
          <circle cx="40" cy="40" r="32" fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={`${pct * 2.01} 201`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black" style={{ color }}>{score}</span>
          <span className="text-[9px] text-vizme-greyblue">/10</span>
        </div>
      </div>
      <div>
        <p className="text-sm font-bold text-vizme-navy">Score de negocio</p>
        <p className="text-xs text-vizme-greyblue mt-0.5 leading-relaxed">
          {score >= 8 ? 'Excelente. Tu operación está muy bien estructurada.' :
           score >= 6 ? 'Bueno. Hay oportunidades claras de mejora.' :
           score >= 4 ? 'Regular. Atención inmediata recomendada.' :
           'Crítico. Requiere acción urgente.'}
        </p>
      </div>
    </div>
  );
};

const ExecutiveReport: React.FC<Props> = ({ dataProfile, chartResult }) => {
  const [report, setReport] = useState<IExecutiveReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    if (!dataProfile || !chartResult) return;
    setLoading(true);
    setError('');
    try {
      const r = await getExecutiveReport(dataProfile, chartResult);
      setReport(r);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!dataProfile) {
    return (
      <div className="text-center py-16 text-vizme-greyblue">
        <p className="text-sm">Sube datos para generar el reporte ejecutivo.</p>
      </div>
    );
  }

  if (!report && !loading) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <div className="h-14 w-14 rounded-2xl bg-vizme-navy/5 border border-vizme-navy/10 flex items-center justify-center">
          <Star size={22} className="text-vizme-navy" />
        </div>
        <div className="text-center">
          <p className="text-base font-semibold text-vizme-navy">Reporte Ejecutivo IA</p>
          <p className="text-xs text-vizme-greyblue mt-1 max-w-xs">
            Claude analiza tus datos y genera un diagnóstico completo con score, fortalezas, debilidades y recomendaciones priorizadas.
          </p>
        </div>
        {error && <p className="text-xs text-vizme-red">{error}</p>}
        <button
          onClick={generate}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-vizme-red text-white text-sm font-semibold hover:bg-vizme-orange transition-all shadow-lg shadow-vizme-red/20"
        >
          <Zap size={14} className="fill-current" />
          Generar reporte ejecutivo
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <Loader2 size={28} className="text-vizme-navy animate-spin" />
        <p className="text-sm font-medium text-vizme-navy">Claude está redactando tu reporte...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-vizme-navy">Reporte Ejecutivo</h3>
        <button onClick={generate} className="flex items-center gap-1.5 text-xs text-vizme-greyblue hover:text-vizme-navy transition-colors">
          <RefreshCw size={11} /> Regenerar
        </button>
      </div>

      {/* Score */}
      <div className="bg-white rounded-2xl border border-vizme-navy/5 p-5 shadow-sm">
        <ScoreMeter score={report!.score} />
        {report!.scoreJustification && (
          <p className="text-xs text-vizme-greyblue mt-3 pt-3 border-t border-vizme-navy/5 leading-relaxed">
            {report!.scoreJustification}
          </p>
        )}
      </div>

      {/* Resumen ejecutivo */}
      {report!.resumenEjecutivo && (
        <div className="bg-vizme-navy rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute -top-8 -right-8 h-28 w-28 rounded-full bg-vizme-red/20 blur-2xl pointer-events-none" />
          <p className="text-xs font-bold text-vizme-orange uppercase tracking-wide mb-2">Resumen ejecutivo</p>
          <p className="text-sm text-white/85 leading-relaxed relative">{report!.resumenEjecutivo}</p>
        </div>
      )}

      {/* Fortalezas / Debilidades */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {report!.fortalezas?.length > 0 && (
          <div className="bg-white rounded-2xl border border-vizme-navy/5 p-5 shadow-sm">
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <TrendingUp size={11} /> Fortalezas
            </p>
            <ul className="space-y-2">
              {report!.fortalezas.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-vizme-greyblue leading-relaxed">
                  <span className="flex-shrink-0 h-4 w-4 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 font-bold text-[9px] mt-0.5">
                    {i + 1}
                  </span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        {report!.debilidades?.length > 0 && (
          <div className="bg-white rounded-2xl border border-vizme-navy/5 p-5 shadow-sm">
            <p className="text-xs font-bold text-vizme-orange uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <AlertTriangle size={11} /> Áreas de mejora
            </p>
            <ul className="space-y-2">
              {report!.debilidades.map((d, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-vizme-greyblue leading-relaxed">
                  <span className="flex-shrink-0 h-4 w-4 rounded-full bg-orange-50 border border-orange-200 flex items-center justify-center text-vizme-orange font-bold text-[9px] mt-0.5">
                    {i + 1}
                  </span>
                  {d}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Recomendaciones */}
      {report!.recomendaciones?.length > 0 && (
        <div className="bg-white rounded-2xl border border-vizme-navy/5 p-5 shadow-sm">
          <p className="text-xs font-bold text-vizme-navy uppercase tracking-wide mb-4">Plan de acción</p>
          <div className="space-y-3">
            {report!.recomendaciones.map((rec, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-vizme-bg rounded-xl border border-vizme-navy/5">
                <span className="flex-shrink-0 h-6 w-6 rounded-lg bg-vizme-navy text-white text-[10px] font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-vizme-navy">{rec.accion}</p>
                  <p className="text-[11px] text-vizme-greyblue mt-0.5">{rec.impacto}</p>
                </div>
                <span className={`flex-shrink-0 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${PLAZO_COLOR[rec.plazo] ?? PLAZO_COLOR.trimestre}`}>
                  {rec.plazo}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExecutiveReport;
