import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Folder, Brain, AlertCircle, Clock, CheckCircle2, TrendingUp } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import type { Project } from '../context/ProjectContext';

// ─── Status badge ────────────────────────────────────────────────────────────

function StatusBadge({ project }: { project: Project }) {
  const updatedAt = new Date(project.updated_at);
  const daysSince = Math.floor((Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSince > 30) {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-50 text-vizme-orange border border-vizme-orange/20">
        <AlertCircle size={8} />
        Desactualizado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
      <CheckCircle2 size={8} />
      Activo
    </span>
  );
}

// ─── Project Card ────────────────────────────────────────────────────────────

const ProjectCard: React.FC<{ project: Project; onClick: () => void }> = ({ project, onClick }) => {
  const areaEmoji: Record<string, string> = {
    'Ventas y revenue': '💰', 'Costos y gastos': '📉', 'Inventario y productos': '📦',
    'Clientes y retención': '👥', 'Operaciones y procesos': '⚙', 'Recursos humanos': '🧑‍💼',
    'Marketing y campañas': '📣', 'Financiero general': '📊', general: '📁',
  };

  const date = new Date(project.created_at);
  const dateStr = date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <button
      onClick={onClick}
      className="group bg-white rounded-2xl border border-vizme-navy/8 p-5 text-left hover:border-vizme-red/30 hover:shadow-lg hover:shadow-vizme-red/5 transition-all hover:-translate-y-0.5"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="h-10 w-10 rounded-xl bg-vizme-bg border border-vizme-navy/8 flex items-center justify-center text-xl flex-shrink-0">
          {areaEmoji[project.analysis_area ?? 'general'] ?? '📁'}
        </div>
        <StatusBadge project={project} />
      </div>

      {/* Name */}
      <h3 className="text-sm font-bold text-vizme-navy mb-1 group-hover:text-vizme-red transition-colors">
        {project.name}
      </h3>

      {/* Area + period */}
      {(project.analysis_area || project.period) && (
        <p className="text-[11px] text-vizme-greyblue mb-3">
          {[project.analysis_area, project.period].filter(Boolean).join(' · ')}
        </p>
      )}

      {/* Main question preview */}
      {project.main_question && (
        <p className="text-[11px] text-vizme-navy/60 italic line-clamp-2 mb-3">
          "{project.main_question}"
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center gap-1.5 pt-3 border-t border-vizme-navy/5">
        <Clock size={10} className="text-vizme-greyblue" />
        <span className="text-[10px] text-vizme-greyblue">{dateStr}</span>
      </div>
    </button>
  );
};

// ─── Empty state ─────────────────────────────────────────────────────────────

const EmptyState: React.FC<{ onNew: () => void }> = ({ onNew }) => (
  <div className="flex flex-col items-center justify-center py-24 text-center">
    <div className="h-20 w-20 rounded-3xl bg-vizme-navy/5 flex items-center justify-center mb-6">
      <Brain size={32} className="text-vizme-navy/30" />
    </div>
    <h2 className="text-xl font-bold text-vizme-navy mb-2">Crea tu primer proyecto</h2>
    <p className="text-sm text-vizme-greyblue max-w-sm mb-8 leading-relaxed">
      Cada proyecto es un análisis enfocado en una pregunta de negocio. Tarda 2 minutos en configurarlo.
    </p>

    <button
      onClick={onNew}
      className="flex items-center gap-2 rounded-xl bg-vizme-red px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-vizme-red/25 hover:bg-vizme-orange transition-all hover:-translate-y-0.5"
    >
      <Plus size={16} />
      Crear mi primer proyecto
    </button>

    {/* Preview cards */}
    <div className="grid grid-cols-3 gap-3 mt-12 max-w-lg opacity-40 pointer-events-none">
      {[
        { name: 'Análisis de ventas Q1', area: 'Ventas y revenue' },
        { name: 'Revisión de costos', area: 'Costos y gastos' },
        { name: 'Clientes en riesgo', area: 'Clientes y retención' },
      ].map((ex) => (
        <div key={ex.name} className="bg-white rounded-2xl border border-vizme-navy/10 p-4 text-left">
          <div className="h-8 w-8 rounded-lg bg-vizme-bg mb-2.5" />
          <p className="text-xs font-bold text-vizme-navy">{ex.name}</p>
          <p className="text-[10px] text-vizme-greyblue mt-0.5">{ex.area}</p>
        </div>
      ))}
    </div>
  </div>
);

// ─── Page ────────────────────────────────────────────────────────────────────

const ProjectsPage: React.FC = () => {
  const { projects, loading } = useProject();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="space-y-3 text-center">
          <div className="h-10 w-10 rounded-full border-2 border-vizme-red/30 border-t-vizme-red animate-spin mx-auto" />
          <p className="text-sm text-vizme-greyblue">Cargando proyectos...</p>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return <EmptyState onNew={() => navigate('/dashboard/projects/new')} />;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-vizme-navy">Mis Proyectos</h1>
          <p className="text-sm text-vizme-greyblue mt-0.5">{projects.length} proyecto{projects.length !== 1 ? 's' : ''} activo{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => navigate('/dashboard/projects/new')}
          className="flex items-center gap-2 rounded-xl bg-vizme-red px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-vizme-red/20 hover:bg-vizme-orange transition-all hover:-translate-y-0.5"
        >
          <Plus size={15} />
          Nuevo Proyecto
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onClick={() => navigate(`/dashboard/projects/${project.id}/overview`)}
          />
        ))}
      </div>

      {/* Value strip */}
      <div className="mt-8 bg-vizme-navy/5 rounded-2xl border border-vizme-navy/8 p-5 flex items-center gap-4">
        <div className="h-10 w-10 rounded-xl bg-vizme-navy/10 flex items-center justify-center flex-shrink-0">
          <TrendingUp size={18} className="text-vizme-navy" />
        </div>
        <div>
          <p className="text-sm font-semibold text-vizme-navy">Cada proyecto = una decisión con datos</p>
          <p className="text-xs text-vizme-greyblue mt-0.5">Crea un proyecto por cada área del negocio que quieras entender.</p>
        </div>
        <button
          onClick={() => navigate('/dashboard/projects/new')}
          className="ml-auto flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold text-vizme-red hover:text-vizme-orange transition-colors"
        >
          <Plus size={12} />
          Nuevo
        </button>
      </div>
    </div>
  );
};

export default ProjectsPage;
