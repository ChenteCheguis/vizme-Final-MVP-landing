import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Brain, ArrowRight, Loader2, CheckCircle2, AlertTriangle,
  Plus, FileSpreadsheet, Clock, Sparkles, BarChart2, TrendingUp,
  Layers, Upload, Star, ChevronRight, RefreshCw,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { getV3Dashboard } from '../lib/chartEngine';
import type { V3DashboardResponse, V3File, V3SavedDashboard } from '../lib/v3types';
import V3Dashboard from '../components/dashboard/V3Dashboard';

// ─────────────────────────────────────────────
// Progress loader (full screen takeover)
// ─────────────────────────────────────────────

const steps = [
  'Leyendo perfil del dataset…',
  'Identificando métricas clave…',
  'Seleccionando visualizaciones óptimas…',
  'Generando insights de negocio…',
  'Preparando tu dashboard…',
];

const ProgressLoader: React.FC<{ step: number; fileName?: string }> = ({ step, fileName }) => (
  <div className="flex flex-col items-center justify-center py-20 gap-6 max-w-sm mx-auto text-center animate-in fade-in">
    <div className="h-16 w-16 rounded-2xl bg-vizme-navy flex items-center justify-center shadow-lg">
      <Brain size={28} className="text-white animate-pulse" />
    </div>
    <div>
      <p className="text-lg font-bold text-vizme-navy mb-1">Vizme AI está analizando tus datos</p>
      {fileName && <p className="text-xs text-vizme-greyblue">{fileName}</p>}
    </div>
    <div className="w-full space-y-3">
      {steps.map((s, i) => (
        <div key={i} className={`flex items-center gap-3 transition-all duration-500 ${
          i < step ? 'opacity-100' : i === step ? 'opacity-100' : 'opacity-30'
        }`}>
          {i < step ? (
            <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
          ) : i === step ? (
            <Loader2 size={14} className="animate-spin text-vizme-red flex-shrink-0" />
          ) : (
            <div className="h-3.5 w-3.5 rounded-full border-2 border-vizme-navy/20 flex-shrink-0" />
          )}
          <p className={`text-xs text-left ${i <= step ? 'text-vizme-navy font-medium' : 'text-vizme-greyblue'}`}>{s}</p>
        </div>
      ))}
    </div>
    <div className="w-full mt-2">
      <div className="h-1.5 bg-vizme-bg rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${((step + 1) / steps.length) * 100}%`,
            background: 'linear-gradient(90deg, #F54A43, #F26A3D)',
          }}
        />
      </div>
      <p className="text-[10px] text-vizme-greyblue mt-2">Powered by Claude AI · ~30 segundos</p>
    </div>
  </div>
);

// ─────────────────────────────────────────────
// File summary card (pre-dashboard state)
// ─────────────────────────────────────────────

const FileSummaryCard: React.FC<{
  file: V3File;
  onGenerate: () => void;
  generating: boolean;
}> = ({ file, onGenerate, generating }) => {
  const ep = file.enriched_profile as any;
  const qs = ep?.qualityScore ?? file.quality_score ?? 0;
  const qColor = qs >= 80 ? 'text-emerald-600' : qs >= 60 ? 'text-vizme-orange' : 'text-vizme-red';
  const qBg = qs >= 80 ? 'bg-emerald-50 border-emerald-200' : qs >= 60 ? 'bg-orange-50 border-orange-200' : 'bg-red-50 border-vizme-red/20';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* File info card */}
      <div className="bg-white rounded-3xl border border-vizme-navy/8 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-vizme-bg border border-vizme-navy/8 flex items-center justify-center flex-shrink-0">
            <FileSpreadsheet size={22} className="text-vizme-navy" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-vizme-navy truncate">{file.file_name}</h3>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-xs text-vizme-greyblue">{(file.row_count ?? 0).toLocaleString('es-MX')} filas</span>
              <span className="text-vizme-navy/15">·</span>
              <span className="text-xs text-vizme-greyblue">{file.column_count} columnas</span>
              {file.detected_business_type && file.detected_business_type !== 'desconocido' && (
                <>
                  <span className="text-vizme-navy/15">·</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-vizme-navy/5 text-vizme-navy capitalize">{file.detected_business_type}</span>
                </>
              )}
            </div>
          </div>
          <div className={`text-center px-3 py-2 rounded-xl border ${qBg}`}>
            <p className={`text-lg font-black ${qColor}`}>{qs}%</p>
            <p className="text-[8px] text-vizme-greyblue uppercase tracking-wide">Calidad</p>
          </div>
        </div>

        {/* Quick stats from enriched profile */}
        {ep && (
          <div className="grid grid-cols-4 gap-2 mt-5">
            {[
              { label: 'Métricas', value: ep.numericColumns?.length ?? 0, icon: TrendingUp },
              { label: 'Dimensiones', value: ep.categoryColumns?.length ?? 0, icon: Layers },
              { label: 'Correlaciones', value: ep.correlations?.length ?? 0, icon: BarChart2 },
              { label: 'Series de tiempo', value: ep.timeSeries?.length ?? 0, icon: Clock },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-vizme-bg rounded-xl border border-vizme-navy/5 p-3 text-center">
                <Icon size={13} className="text-vizme-greyblue mx-auto mb-1" />
                <p className="text-lg font-black text-vizme-navy">{value}</p>
                <p className="text-[8px] uppercase tracking-wide text-vizme-greyblue">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Column preview */}
        {ep?.columnDetails && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {ep.columnDetails.slice(0, 10).map((col: any, i: number) => (
              <span key={i} className={`text-[10px] font-medium px-2 py-1 rounded-lg border ${
                col.type === 'numeric' ? 'bg-blue-50 text-blue-700 border-blue-200'
                : col.type === 'categorical' ? 'bg-purple-50 text-purple-700 border-purple-200'
                : col.type === 'date' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-vizme-bg text-vizme-greyblue border-vizme-navy/8'
              }`}>
                {col.name}
              </span>
            ))}
            {ep.columnDetails.length > 10 && (
              <span className="text-[10px] text-vizme-greyblue px-2 py-1">+{ep.columnDetails.length - 10} más</span>
            )}
          </div>
        )}
      </div>

      {/* Generate CTA */}
      <button
        onClick={onGenerate}
        disabled={generating}
        className="w-full group relative overflow-hidden rounded-2xl py-5 px-8 text-white font-bold text-base shadow-xl transition-all hover:-translate-y-1 hover:shadow-2xl disabled:opacity-60 disabled:hover:translate-y-0"
        style={{ background: 'linear-gradient(135deg, #F54A43 0%, #F26A3D 50%, #02222F 100%)', boxShadow: '0 12px 40px rgba(245,74,67,0.35)' }}
      >
        <div className="relative z-10 flex items-center justify-center gap-3">
          {generating ? (
            <><Loader2 size={18} className="animate-spin" /> Generando dashboard…</>
          ) : (
            <>
              <Sparkles size={18} />
              Generar Dashboard con IA
              <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" />
            </>
          )}
        </div>
        {/* Shimmer effect */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%, rgba(255,255,255,0.05) 100%)' }} />
      </button>

      <p className="text-center text-[10px] text-vizme-greyblue">
        Vizme AI analizará tus datos y generará KPIs, gráficas, alertas y recomendaciones personalizadas
      </p>
    </div>
  );
};

// ─────────────────────────────────────────────
// Saved dashboard list (when no active file)
// ─────────────────────────────────────────────

const SavedDashboardsList: React.FC<{
  dashboards: V3SavedDashboard[];
  onSelect: (d: V3SavedDashboard) => void;
}> = ({ dashboards, onSelect }) => {
  if (dashboards.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold text-vizme-greyblue uppercase tracking-wider">Dashboards anteriores</p>
      {dashboards.map(d => (
        <button
          key={d.id}
          onClick={() => onSelect(d)}
          className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border border-vizme-navy/8 hover:border-vizme-red/30 hover:shadow-md transition-all text-left group"
        >
          <div className="h-10 w-10 rounded-xl bg-vizme-bg border border-vizme-navy/5 flex items-center justify-center flex-shrink-0 group-hover:bg-vizme-red/5">
            <BarChart2 size={16} className="text-vizme-greyblue group-hover:text-vizme-red" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-vizme-navy truncate">{d.name}</p>
            <p className="text-[10px] text-vizme-greyblue mt-0.5">
              {(d.kpis_json?.length ?? 0)} KPIs · {(d.charts_json?.length ?? 0)} gráficas
              · {new Date(d.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
            </p>
          </div>
          {d.is_favorite && <Star size={12} className="text-amber-400 fill-amber-400 flex-shrink-0" />}
          <ChevronRight size={14} className="text-vizme-greyblue/50 flex-shrink-0" />
        </button>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

const OverviewPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileIdParam = searchParams.get('fileId');
  const autoGenerate = searchParams.get('auto') === '1';

  const { user, profile } = useAuth();
  const { activeProject } = useProject();
  const navigate = useNavigate();

  const [loadStep, setLoadStep] = useState(-1);
  const [dashboard, setDashboard] = useState<V3DashboardResponse | null>(null);
  const [savedDashboard, setSavedDashboard] = useState<V3SavedDashboard | null>(null);
  const [savedDashboards, setSavedDashboards] = useState<V3SavedDashboard[]>([]);
  const [activeFile, setActiveFile] = useState<V3File | null>(null);
  const [projectFiles, setProjectFiles] = useState<V3File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loadingInit, setLoadingInit] = useState(true);
  const [regenerateCount, setRegenerateCount] = useState(0);

  // ── Restore a saved dashboard into state ─────────────────────────────────
  const restoreDashboard = useCallback((saved: V3SavedDashboard) => {
    setDashboard({
      charts: saved.charts_json ?? [],
      kpis: saved.kpis_json ?? [],
      alerts: saved.alerts_json ?? [],
      executiveSummary: saved.summary_json ?? { headline: '', topInsights: [], mainRisk: '', mainOpportunity: '', recommendedAction: '' },
      suggestedFilters: saved.filters_json ?? [],
      healthScore: saved.health_score ?? { overall: 0, dimensions: [], improvementPlan: [], trend: 'stable' as const },
      dataQuality: { overallScore: 80, issues: [], suggestions: [] },
    });
    setSavedDashboard(saved);
    setIsFavorite(saved.is_favorite ?? false);
  }, []);

  // ── Generate V3 dashboard (only called on user click) ────────────────────
  const generate = useCallback(async (file: V3File) => {
    if (!file.enriched_profile) {
      setError('El archivo no tiene perfil enriquecido. Ve a "Mis Datos" y súbelo de nuevo.');
      return;
    }

    setError(null);
    setDashboard(null);
    setSavedDashboard(null);
    setLoadStep(0);

    const intervals = [1200, 2400, 4000, 6000].map((delay, i) =>
      setTimeout(() => setLoadStep(prev => Math.max(prev, i + 1)), delay),
    );

    try {
      const result = await getV3Dashboard(
        file.enriched_profile,
        { company_name: profile?.company_name, industry: profile?.industry ?? activeProject?.analysis_area },
        projectId,
        file.extracted_data ?? undefined,
      );

      intervals.forEach(clearTimeout);
      setLoadStep(4);
      await new Promise(r => setTimeout(r, 500));

      setDashboard(result);
      setActiveFile(file);

      // Auto-save
      if (user && projectId) {
        try {
          const { data: saved } = await supabase.from('dashboards').insert({
            user_id: user.id,
            project_id: projectId,
            file_id: file.id,
            name: `Dashboard ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}`,
            charts_json: result.charts,
            kpis_json: result.kpis,
            alerts_json: result.alerts,
            summary_json: result.executiveSummary,
            filters_json: result.suggestedFilters,
            health_score: result.healthScore,
            ai_model_used: 'claude-sonnet-4-20250514',
          }).select().single();

          if (saved) {
            setSavedDashboard(saved as V3SavedDashboard);
            await supabase.from('files').update({ dashboard_id: saved.id }).eq('id', file.id);
            supabase.from('analysis_history').insert({
              user_id: user.id,
              dashboard_id: saved.id,
              file_id: file.id,
              mode: 'dashboard',
            }).then(() => {});
          }
        } catch (e) {
          console.warn('Save error (non-fatal):', e);
        }
      }

      // Remove auto param from URL
      if (autoGenerate) {
        searchParams.delete('auto');
        setSearchParams(searchParams, { replace: true });
      }
    } catch (err: any) {
      intervals.forEach(clearTimeout);
      setError(err?.message ?? 'Error generando el dashboard. Verifica tu conexión e intenta de nuevo.');
    } finally {
      setLoadStep(-1);
    }
  }, [user, projectId, profile, activeProject, autoGenerate, searchParams, setSearchParams]);

  // ── On mount: load files + dashboards, but DON'T auto-generate ──────────
  useEffect(() => {
    const init = async () => {
      if (!user || !projectId) return;
      setLoadingInit(true);

      // Load files + dashboards in parallel
      const [filesRes, dashRes] = await Promise.all([
        supabase.from('files').select('*')
          .eq('user_id', user.id).eq('project_id', projectId).eq('is_active', true)
          .order('created_at', { ascending: false }),
        supabase.from('dashboards').select('*')
          .eq('user_id', user.id).eq('project_id', projectId)
          .order('created_at', { ascending: false }).limit(10),
      ]);

      const files = (filesRes.data ?? []) as V3File[];
      const dashes = (dashRes.data ?? []) as V3SavedDashboard[];
      setProjectFiles(files);
      setSavedDashboards(dashes);

      // If fileId in URL → set as active file
      if (fileIdParam) {
        const file = files.find(f => f.id === fileIdParam);
        if (file) {
          setActiveFile(file);
          // Check for existing dashboard
          const existing = dashes.find(d => d.file_id === fileIdParam);
          if (existing?.charts_json?.length) {
            restoreDashboard(existing);
          } else if (autoGenerate) {
            // Only auto-generate if ?auto=1 is in URL (from DataPage CTA)
            setLoadingInit(false);
            await generate(file);
            return;
          }
        }
      } else if (files.length > 0) {
        // Set the latest file as active
        setActiveFile(files[0]);
        // Check for any existing dashboard
        const existing = dashes[0];
        if (existing?.charts_json?.length) {
          restoreDashboard(existing);
          // Load associated file
          if (existing.file_id) {
            const f = files.find(f => f.id === existing.file_id);
            if (f) setActiveFile(f);
          }
        }
      }

      setLoadingInit(false);
    };
    init();
  }, [user, projectId, fileIdParam]);

  const handleRefresh = useCallback(async () => {
    if (activeFile) {
      setRegenerateCount(c => c + 1);
      await generate(activeFile);
    }
  }, [activeFile, generate]);

  const handleRateRegenerate = async (rating: 'good' | 'bad', feedback?: string) => {
    if (!savedDashboard || !user) return;
    try {
      await supabase.from('analysis_history').insert({
        user_id: user.id,
        dashboard_id: savedDashboard.id,
        file_id: activeFile?.id,
        mode: 'dashboard_rating',
        result_json: { rating, feedback, timestamp: new Date().toISOString() },
      });
    } catch (e) {
      console.warn('Rating save error (non-fatal):', e);
    }
  };

  const handleToggleFavorite = async () => {
    if (!savedDashboard) return;
    const next = !isFavorite;
    setIsFavorite(next);
    await supabase.from('dashboards').update({ is_favorite: next }).eq('id', savedDashboard.id);
  };

  const handleSelectSavedDashboard = async (d: V3SavedDashboard) => {
    restoreDashboard(d);
    if (d.file_id) {
      const f = projectFiles.find(f => f.id === d.file_id);
      if (f) setActiveFile(f);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  // Loading initial data
  if (loadingInit) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={22} className="animate-spin text-vizme-greyblue" />
      </div>
    );
  }

  // Generating
  if (loadStep >= 0) {
    return <ProgressLoader step={loadStep} fileName={activeFile?.file_name} />;
  }

  // Error
  if (error) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-4">
        <div className="h-14 w-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto">
          <AlertTriangle size={24} className="text-vizme-red" />
        </div>
        <p className="text-sm font-semibold text-vizme-navy">Algo salió mal</p>
        <p className="text-xs text-vizme-greyblue leading-relaxed max-w-sm mx-auto">{error}</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => navigate(`/dashboard/projects/${projectId}/data`)}
            className="inline-flex items-center gap-2 rounded-xl border border-vizme-navy/15 px-4 py-2 text-sm text-vizme-navy hover:bg-vizme-bg transition-colors"
          >
            <ArrowRight size={13} /> Ir a Mis Datos
          </button>
          {activeFile && (
            <button
              onClick={() => { setError(null); generate(activeFile); }}
              className="inline-flex items-center gap-2 rounded-xl bg-vizme-red px-4 py-2 text-sm font-semibold text-white hover:bg-vizme-orange transition-all"
            >
              <RefreshCw size={13} /> Reintentar
            </button>
          )}
        </div>
      </div>
    );
  }

  // No files at all → go upload
  if (projectFiles.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <div className="h-16 w-16 rounded-3xl bg-vizme-navy/5 flex items-center justify-center mx-auto mb-5">
          <Upload size={28} className="text-vizme-navy/30" />
        </div>
        <h2 className="text-xl font-bold text-vizme-navy mb-2">Aún no hay datos en este proyecto</h2>
        <p className="text-sm text-vizme-greyblue mb-6">Sube tu primer archivo para que Vizme genere el dashboard.</p>
        <button
          onClick={() => navigate(`/dashboard/projects/${projectId}/data`)}
          className="inline-flex items-center gap-2 rounded-xl bg-vizme-red px-5 py-2.5 text-sm font-semibold text-white hover:bg-vizme-orange transition-all hover:-translate-y-0.5"
          style={{ boxShadow: '0 4px 16px rgba(245,74,67,0.3)' }}
        >
          <Upload size={14} /> Subir archivo
        </button>
      </div>
    );
  }

  // Has file but no dashboard yet → show file summary + generate CTA
  if (!dashboard && activeFile) {
    return (
      <div className="space-y-8">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-vizme-greyblue mb-0.5">
            {activeProject?.name ?? 'Proyecto'}
          </p>
          <h1 className="text-2xl font-bold text-vizme-navy">Dashboard</h1>
        </div>

        <FileSummaryCard
          file={activeFile}
          onGenerate={() => generate(activeFile)}
          generating={loadStep >= 0}
        />

        {/* Show saved dashboards if any */}
        <SavedDashboardsList
          dashboards={savedDashboards}
          onSelect={handleSelectSavedDashboard}
        />
      </div>
    );
  }

  // Dashboard rendered
  return (
    <div>
      {/* File selector when multiple files */}
      {projectFiles.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <span className="text-[10px] font-bold text-vizme-greyblue uppercase tracking-wider flex items-center gap-1">
            <FileSpreadsheet size={10} /> Archivos:
          </span>
          {projectFiles.map(f => (
            <button
              key={f.id}
              onClick={() => {
                setActiveFile(f);
                const existing = savedDashboards.find(d => d.file_id === f.id);
                if (existing?.charts_json?.length) {
                  restoreDashboard(existing);
                } else {
                  setDashboard(null);
                  setSavedDashboard(null);
                }
              }}
              className={`text-[11px] font-medium px-3 py-1.5 rounded-full border transition-all ${
                f.id === activeFile?.id
                  ? 'bg-vizme-navy text-white border-vizme-navy'
                  : 'bg-white text-vizme-greyblue border-vizme-navy/10 hover:border-vizme-red/40'
              }`}
            >
              {f.file_name}
            </button>
          ))}
          <button
            onClick={() => navigate(`/dashboard/projects/${projectId}/data`)}
            className="text-[11px] font-medium px-3 py-1.5 rounded-full border border-dashed border-vizme-navy/15 text-vizme-greyblue hover:border-vizme-red/40 hover:text-vizme-red transition-all flex items-center gap-1"
          >
            <Plus size={10} /> Agregar datos
          </button>
        </div>
      )}

      {dashboard && (
        <V3Dashboard
          dashboard={dashboard}
          rawData={(activeFile?.parsed_data ?? []) as Record<string, unknown>[]}
          fileName={activeFile?.file_name ?? 'Archivo'}
          projectName={activeProject?.name}
          projectId={projectId}
          onRefresh={handleRefresh}
          onAddData={() => navigate(`/dashboard/projects/${projectId}/data`)}
          isFavorite={isFavorite}
          onToggleFavorite={handleToggleFavorite}
          regenerateCount={regenerateCount}
          onRateRegenerate={handleRateRegenerate}
        />
      )}
    </div>
  );
};

export default OverviewPage;
