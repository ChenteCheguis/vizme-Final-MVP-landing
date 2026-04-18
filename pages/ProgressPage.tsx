import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  TrendingUp, CheckCircle2, Circle, ArrowRight, Loader2,
  Zap, Award, Target, Calendar, Brain,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import type { V3HealthScore } from '../lib/v3types';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface DashboardRow {
  id: string;
  name: string;
  created_at: string;
  health_score: V3HealthScore | null;
}

interface ActionItem {
  id: string;
  action: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  done: boolean;
}

// ─── Custom tooltip ──────────────────────────────────────────────────────────

const ScoreTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-vizme-navy text-white rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-white/50 text-[10px] mb-0.5">{label}</p>
      <p className="font-bold text-vizme-red">{payload[0].value}/10</p>
    </div>
  );
};

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

const ProgressPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const { activeProject } = useProject();
  const navigate = useNavigate();

  const [dashboards, setDashboards] = useState<DashboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actions, setActions] = useState<ActionItem[]>([]);

  const loadData = useCallback(async () => {
    if (!user || !projectId) return;
    setLoading(true);

    const { data } = await supabase
      .from('dashboards')
      .select('id, name, created_at, health_score')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    const rows = (data ?? []) as DashboardRow[];
    setDashboards(rows);

    // Build action items from the latest dashboard's improvement plan
    const latest = rows[rows.length - 1];
    if (latest?.health_score?.improvementPlan?.length) {
      const items: ActionItem[] = latest.health_score.improvementPlan.map((p, i) => ({
        id: `${latest.id}_${i}`,
        action: p.action,
        impact: p.impact,
        effort: p.effort,
        done: false,
      }));
      setActions(items);
    }

    setLoading(false);
  }, [user, projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleDone = (id: string) => {
    setActions(prev => prev.map(a => a.id === id ? { ...a, done: !a.done } : a));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={22} className="animate-spin text-vizme-greyblue" />
      </div>
    );
  }

  // Empty state
  if (dashboards.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <div className="h-16 w-16 rounded-3xl bg-vizme-navy/5 flex items-center justify-center mx-auto mb-5">
          <TrendingUp size={28} className="text-vizme-navy/30" />
        </div>
        <h2 className="text-xl font-bold text-vizme-navy mb-2">Tu progreso aparecerá aquí</h2>
        <p className="text-sm text-vizme-greyblue max-w-sm mx-auto mb-6 leading-relaxed">
          Genera tu primer dashboard y con el tiempo verás cómo evoluciona la salud de tu negocio y qué acciones tomaste.
        </p>
        <button
          onClick={() => navigate(`/dashboard/projects/${projectId}/data`)}
          className="inline-flex items-center gap-2 rounded-xl bg-vizme-red px-5 py-2.5 text-sm font-semibold text-white hover:bg-vizme-orange transition-all hover:-translate-y-0.5"
        >
          <ArrowRight size={14} />
          Subir datos y generar dashboard
        </button>

        {/* Faded preview */}
        <div className="mt-12 opacity-25 pointer-events-none select-none space-y-3">
          <div className="bg-white rounded-2xl border border-vizme-navy/8 p-5 h-32" />
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-vizme-navy/8 p-4 h-20" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const latest = dashboards[dashboards.length - 1];
  const previous = dashboards[dashboards.length - 2];
  const latestScore = latest.health_score?.overall ?? null;
  const prevScore = previous?.health_score?.overall ?? null;
  const scoreDelta = latestScore !== null && prevScore !== null ? latestScore - prevScore : null;
  const doneCount = actions.filter(a => a.done).length;
  const pendingCount = actions.filter(a => !a.done).length;

  const scoreData = dashboards.map((d, i) => ({
    date: new Date(d.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }),
    score: d.health_score?.overall ?? 0,
    label: d.name ?? `Dashboard ${i + 1}`,
  }));

  const EFFORT_COLOR: Record<string, string> = {
    low:    'text-emerald-600 bg-emerald-50 border-emerald-200',
    medium: 'text-vizme-orange bg-orange-50 border-vizme-orange/20',
    high:   'text-vizme-red bg-red-50 border-vizme-red/20',
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-vizme-greyblue mb-0.5">
          {activeProject?.name ?? 'Proyecto'}
        </p>
        <h1 className="text-2xl font-bold text-vizme-navy">Mi Progreso</h1>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            icon: Award,
            label: 'Score actual',
            value: latestScore !== null ? `${latestScore}/10` : '—',
            sub: scoreDelta !== null
              ? scoreDelta > 0 ? `↑ +${scoreDelta.toFixed(1)} vs anterior` : scoreDelta < 0 ? `↓ ${scoreDelta.toFixed(1)} vs anterior` : 'Sin cambio'
              : 'Primer dashboard',
            color: scoreDelta === null ? 'text-vizme-greyblue' : scoreDelta >= 0 ? 'text-emerald-600' : 'text-vizme-red',
          },
          {
            icon: Target,
            label: 'Dashboards generados',
            value: `${dashboards.length}`,
            sub: 'Total del proyecto',
            color: 'text-vizme-greyblue',
          },
          {
            icon: CheckCircle2,
            label: 'Acciones completadas',
            value: `${doneCount}`,
            sub: 'Del plan actual',
            color: 'text-emerald-600',
          },
          {
            icon: Zap,
            label: 'Pendientes',
            value: `${pendingCount}`,
            sub: 'Por implementar',
            color: pendingCount > 0 ? 'text-vizme-orange' : 'text-vizme-greyblue',
          },
        ].map(({ icon: Icon, label, value, sub, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-vizme-navy/8 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-6 w-6 rounded-lg bg-vizme-bg flex items-center justify-center">
                <Icon size={12} className="text-vizme-greyblue" />
              </div>
              <p className="text-[10px] uppercase tracking-wider text-vizme-greyblue">{label}</p>
            </div>
            <p className="text-2xl font-bold text-vizme-navy">{value}</p>
            <p className={`text-[11px] mt-0.5 font-medium ${color}`}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Health score chart */}
      {dashboards.length >= 2 && (
        <div className="bg-white rounded-2xl border border-vizme-navy/8 p-5 shadow-sm">
          <p className="text-sm font-bold text-vizme-navy mb-4">Evolución del health score</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={scoreData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2EFF4" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#566970' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: '#566970' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ScoreTooltip />} />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#F54A43"
                strokeWidth={2.5}
                dot={{ fill: '#F54A43', r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6, fill: '#F26A3D' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Health score dimensions (latest) */}
      {(latest.health_score?.dimensions?.length ?? 0) > 0 && (
        <div className="bg-white rounded-2xl border border-vizme-navy/8 p-5 shadow-sm">
          <p className="text-sm font-bold text-vizme-navy mb-4">Dimensiones del negocio</p>
          <div className="space-y-3">
            {(latest.health_score?.dimensions ?? []).map((dim, i) => {
              const dimColor = dim.color === 'green' ? '#16a34a' : dim.color === 'yellow' ? '#F26A3D' : '#F54A43';
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-vizme-navy">{dim.name}</p>
                    <span className="text-xs font-bold text-vizme-navy">{dim.score}/10</span>
                  </div>
                  <div className="h-1.5 bg-vizme-bg rounded-full overflow-hidden mb-1">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${(dim.score / 10) * 100}%`, background: dimColor }}
                    />
                  </div>
                  <p className="text-[10px] text-vizme-greyblue">{dim.insight}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dashboard history */}
      <div className="bg-white rounded-2xl border border-vizme-navy/8 p-5 shadow-sm">
        <p className="text-sm font-bold text-vizme-navy mb-4">Historial de dashboards</p>
        <div className="space-y-3">
          {[...dashboards].reverse().map((dash, i) => {
            const date = new Date(dash.created_at).toLocaleDateString('es-MX', {
              day: 'numeric', month: 'short', year: 'numeric',
            });
            const score = dash.health_score?.overall ?? null;
            const scoreColor = score === null ? 'bg-vizme-greyblue/20 text-vizme-greyblue'
              : score >= 7 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : score >= 5 ? 'bg-orange-50 text-orange-700 border border-orange-200'
              : 'bg-red-50 text-vizme-red border border-vizme-red/20';

            return (
              <div key={dash.id} className="flex items-center gap-3 py-2.5 border-b border-vizme-navy/5 last:border-0">
                <div className="h-8 w-8 rounded-xl bg-vizme-bg flex items-center justify-center flex-shrink-0 text-xs font-bold text-vizme-greyblue">
                  {dashboards.length - i}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-vizme-navy">{dash.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Calendar size={10} className="text-vizme-greyblue" />
                    <span className="text-[10px] text-vizme-greyblue">{date}</span>
                  </div>
                </div>
                {score !== null && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${scoreColor}`}>
                    {score}/10
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Action tracker */}
      {actions.length > 0 && (
        <div className="bg-white rounded-2xl border border-vizme-navy/8 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-vizme-navy">Plan de mejora</p>
            <div className="flex items-center gap-2 text-[11px] text-vizme-greyblue">
              <span className="text-emerald-600 font-medium">{doneCount} completadas</span>
              <span>·</span>
              <span>{pendingCount} pendientes</span>
            </div>
          </div>
          <div className="space-y-2">
            {actions.map((item) => (
              <div
                key={item.id}
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                  item.done
                    ? 'bg-emerald-50 border-emerald-100'
                    : 'bg-vizme-bg border-vizme-navy/5 hover:border-vizme-navy/15'
                }`}
              >
                <button
                  onClick={() => toggleDone(item.id)}
                  className={`flex-shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center mt-0.5 transition-all ${
                    item.done
                      ? 'border-emerald-500 bg-emerald-500'
                      : 'border-vizme-navy/20 hover:border-vizme-red/50'
                  }`}
                >
                  {item.done && <CheckCircle2 size={11} className="text-white" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium ${item.done ? 'text-emerald-700 line-through' : 'text-vizme-navy'}`}>
                    {item.action}
                  </p>
                  <p className="text-[10px] text-vizme-greyblue mt-0.5">{item.impact}</p>
                </div>
                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border flex-shrink-0 ${EFFORT_COLOR[item.effort] ?? ''}`}>
                  {item.effort === 'low' ? 'fácil' : item.effort === 'medium' ? 'medio' : 'difícil'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* If no actions yet (no improvement plan) */}
      {dashboards.length > 0 && actions.length === 0 && (
        <div className="bg-white rounded-2xl border border-vizme-navy/8 p-8 text-center shadow-sm">
          <Brain size={24} className="text-vizme-navy/20 mx-auto mb-3" />
          <p className="text-sm text-vizme-greyblue">
            Genera un análisis interno en la pestaña "Análisis IA" para ver el plan de mejora con acciones concretas.
          </p>
          <button
            onClick={() => navigate(`/dashboard/projects/${projectId}/analysis`)}
            className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-vizme-red hover:underline"
          >
            Ir a Análisis IA <ArrowRight size={12} />
          </button>
        </div>
      )}
    </div>
  );
};

export default ProgressPage;
