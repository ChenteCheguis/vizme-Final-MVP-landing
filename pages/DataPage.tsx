import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Upload, FileSpreadsheet, Trash2, Calendar, Play,
  Loader2, AlertCircle, CheckCircle2, BarChart2,
  ChevronDown, ChevronUp, RefreshCw, Layers, X,
  ArrowRight, Sparkles, Clock, FileQuestion,
  BookOpen, Heart, Zap, MessageCircle,
  Search, Brain, Eye, AlertOctagon,
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { supabase, invokeFunction } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { parseFile, parseAllSheets, rawExtract, extractAllFromPattern } from '../lib/fileParser';
import type { RawExtraction } from '../lib/fileParser';
import { inferDataProfile, buildEnrichedProfile } from '../lib/inferDataProfile';
import type { TransformedData } from '../lib/inferDataProfile';
import type { V3File } from '../lib/v3types';
import type { SheetInfo } from '../lib/fileParser';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtBytes = (b: number) =>
  b < 1_048_576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1_048_576).toFixed(1)} MB`;

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

// ─── Upload wizard state machine ──────────────────────────────────────────────

interface DataPreview {
  totalRows: number;
  totalColumns: number;
  numericColumns: string[];
  categoryColumns: string[];
  dateColumns: string[];
  qualityScore: number;
  issues: string[];
  recommendations: string[];
  suggestedAnalysis: string[];
}

type WizardState =
  | { phase: 'idle' }
  | { phase: 'parsing'; fileName: string; step: number }
  | { phase: 'sheets'; file: File; sheets: SheetInfo[] }
  | { phase: 'saving'; fileName: string }
  | { phase: 'preview'; file: File; preview: DataPreview; parsedFile: any; profile: any; enriched: any; rawExtraction?: RawExtraction }
  | { phase: 'transforming'; file: File; parsedFile: any; profile: any; enriched: any; rawExtraction: RawExtraction; step: number }
  | { phase: 'transform_result'; file: File; parsedFile: any; profile: any; enriched: any; rawExtraction: RawExtraction; transformed: TransformedData; savedFileId: string }
  | { phase: 'done'; file: V3File }
  | { phase: 'discovery_loading'; file: V3File }
  | { phase: 'discovery'; file: V3File; discovery: DiscoveryResult }
  | { phase: 'error'; message: string; canRetry: boolean; originalFile?: File };

interface DiscoveryResult {
  narrativa: string;
  hallazgos_clave: string[];
  dato_sorpresa: string;
  pregunta_gancho: string;
  health_score_inicial: number;
  health_justification: string;
}

// TransformedData is imported from inferDataProfile

const PARSE_STEPS = [
  'Leyendo el archivo…',
  'Detectando columnas y tipos de datos…',
  'Calculando estadísticas…',
  'Preparando perfil inteligente…',
];

// ─── Upload Wizard ────────────────────────────────────────────────────────────

const UploadWizard: React.FC<{
  state: WizardState;
  onDrop: (files: File[]) => void;
  onSheetSelect: (file: File, sheet: string) => void;
  onReset: () => void;
  onGoToDashboard: (file: V3File) => void;
  onStartDiscovery: (file: V3File) => void;
  onRetry: (file: File) => void;
  onConfirmUpload: () => void;
  onConfirmInterpretation?: () => void;
  projectId: string;
  userId: string;
}> = ({ state, onDrop, onSheetSelect, onReset, onGoToDashboard, onStartDiscovery, onRetry, onConfirmUpload, onConfirmInterpretation }) => {

  const [periodInput, setPeriodInput] = useState('');

  useEffect(() => {
    if (state.phase === 'done') setPeriodInput(state.file.period_label ?? '');
  }, [state]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
      'application/csv': ['.csv'],
    },
    maxSize: 50 * 1024 * 1024,
    maxFiles: 1,
    onDropRejected: () => alert('Solo acepto archivos .xlsx, .xls o .csv de máx 50 MB'),
  });

  // ── Idle ──────────────────────────────────────────────────────────────────
  if (state.phase === 'idle') {
    return (
      <div
        {...getRootProps()}
        className={`relative rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer group ${
          isDragActive
            ? 'border-vizme-red bg-vizme-red/4 scale-[1.01]'
            : 'border-vizme-navy/15 bg-white hover:border-vizme-red/50 hover:bg-vizme-red/3'
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center gap-5 py-16 px-8 text-center">
          <div className={`h-16 w-16 rounded-2xl flex items-center justify-center transition-all ${
            isDragActive ? 'bg-vizme-red text-white scale-110' : 'bg-vizme-bg text-vizme-greyblue group-hover:bg-vizme-navy/8'
          }`}>
            <Upload size={26} />
          </div>
          <div>
            <p className="text-base font-semibold text-vizme-navy">
              {isDragActive ? '¡Suéltalo aquí!' : 'Arrastra tu archivo aquí'}
            </p>
            <p className="text-sm text-vizme-greyblue mt-1">
              o <span className="text-vizme-red font-medium">haz clic para elegirlo</span>
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-vizme-greyblue">
            <span className="flex items-center gap-1.5"><FileSpreadsheet size={12} /> Excel (.xlsx, .xls)</span>
            <span className="w-px h-3 bg-vizme-navy/15" />
            <span className="flex items-center gap-1.5"><FileQuestion size={12} /> CSV</span>
            <span className="w-px h-3 bg-vizme-navy/15" />
            <span>Máx 50 MB</span>
          </div>
          <p className="text-xs text-vizme-greyblue/60 mt-1">
            Tus datos están protegidos y nunca se comparten con terceros
          </p>
        </div>
      </div>
    );
  }

  // ── Parsing ───────────────────────────────────────────────────────────────
  if (state.phase === 'parsing') {
    const progress = ((state.step + 1) / PARSE_STEPS.length) * 100;
    return (
      <div className="rounded-2xl border border-vizme-navy/8 bg-white p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-12 w-12 rounded-xl bg-vizme-bg border border-vizme-navy/8 flex items-center justify-center flex-shrink-0">
            <FileSpreadsheet size={20} className="text-vizme-navy" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-vizme-navy truncate">{state.fileName}</p>
            <p className="text-xs text-vizme-greyblue mt-0.5">Analizando con inteligencia artificial…</p>
          </div>
          <Loader2 size={18} className="animate-spin text-vizme-greyblue flex-shrink-0" />
        </div>

        <div className="space-y-2">
          {PARSE_STEPS.map((step, i) => (
            <div key={i} className={`flex items-center gap-2.5 text-sm transition-all ${
              i < state.step ? 'text-emerald-600' : i === state.step ? 'text-vizme-navy font-medium' : 'text-vizme-navy/25'
            }`}>
              {i < state.step ? (
                <CheckCircle2 size={14} className="flex-shrink-0 text-emerald-500" />
              ) : i === state.step ? (
                <Loader2 size={14} className="animate-spin flex-shrink-0 text-vizme-red" />
              ) : (
                <div className="h-3.5 w-3.5 rounded-full border-2 border-current flex-shrink-0" />
              )}
              {step}
            </div>
          ))}
        </div>

        <div className="mt-5 h-1.5 bg-vizme-bg rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #F54A43, #F26A3D)' }}
          />
        </div>
      </div>
    );
  }

  // ── Sheet select ──────────────────────────────────────────────────────────
  if (state.phase === 'sheets') {
    return (
      <div className="rounded-2xl border border-vizme-navy/8 bg-white p-6">
        <div className="flex items-start gap-3 mb-5">
          <div className="h-10 w-10 rounded-xl bg-vizme-orange/10 flex items-center justify-center flex-shrink-0">
            <Layers size={18} className="text-vizme-orange" />
          </div>
          <div>
            <p className="text-sm font-semibold text-vizme-navy">Tu archivo tiene {state.sheets.length} hojas</p>
            <p className="text-xs text-vizme-greyblue mt-0.5">Puedes usar todas juntas o elegir una.</p>
          </div>
        </div>

        <div className="space-y-2">
          {/* Use all sheets option */}
          <button
            onClick={() => onSheetSelect(state.file, '__ALL_SHEETS__')}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 border-vizme-red/30 bg-vizme-red/5 hover:bg-vizme-red/10 text-left transition-all group"
          >
            <div className="flex items-center gap-2.5">
              <Layers size={14} className="text-vizme-red" />
              <div>
                <span className="text-sm font-bold text-vizme-navy">Usar todas las hojas ({state.sheets.length})</span>
                <p className="text-[10px] text-vizme-greyblue">Combina todas las hojas en un solo analisis — ideal si cada hoja es un periodo</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-vizme-red">Recomendado</span>
          </button>

          <p className="text-[10px] text-vizme-greyblue uppercase tracking-wider font-semibold pt-2">O elige una hoja:</p>

          {state.sheets.map((sh) => (
            <button
              key={sh.name}
              onClick={() => onSheetSelect(state.file, sh.name)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-vizme-navy/8 hover:border-vizme-red/40 hover:bg-vizme-red/3 text-left transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet size={14} className="text-vizme-greyblue group-hover:text-vizme-red" />
                <span className="text-sm font-medium text-vizme-navy">{sh.name}</span>
              </div>
              <span className="text-xs text-vizme-greyblue">
                {sh.estimatedRows.toLocaleString('es-MX')} filas aprox.
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={onReset}
          className="mt-4 text-xs text-vizme-greyblue hover:text-vizme-navy flex items-center gap-1 transition-colors"
        >
          <X size={12} /> Elegir otro archivo
        </button>
      </div>
    );
  }

  // ── Preview (AI data review + recommendations) ────────────────────────────
  if (state.phase === 'preview') {
    const { preview } = state;
    const qColor = preview.qualityScore >= 80 ? 'text-emerald-600' : preview.qualityScore >= 60 ? 'text-vizme-orange' : 'text-vizme-red';
    const qBg = preview.qualityScore >= 80 ? 'bg-emerald-50' : preview.qualityScore >= 60 ? 'bg-orange-50' : 'bg-red-50';

    return (
      <div className="rounded-2xl border border-vizme-navy/8 bg-white overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-vizme-navy/6">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-vizme-bg border border-vizme-navy/8 flex items-center justify-center flex-shrink-0">
              <Sparkles size={18} className="text-vizme-red" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-vizme-navy">Vizme analizo tus datos</p>
              <p className="text-xs text-vizme-greyblue mt-0.5">Revisa el resumen y confirma para guardar.</p>
            </div>
            <div className={`text-center px-3 py-1.5 rounded-xl ${qBg}`}>
              <p className={`text-lg font-black ${qColor}`}>{preview.qualityScore}%</p>
              <p className="text-[8px] text-vizme-greyblue">Calidad</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 p-5 pb-0">
          {[
            { label: 'Filas', value: preview.totalRows.toLocaleString('es-MX') },
            { label: 'Columnas', value: preview.totalColumns },
            { label: 'Metricas', value: preview.numericColumns.length },
            { label: 'Categorias', value: preview.categoryColumns.length },
          ].map(({ label, value }) => (
            <div key={label} className="bg-vizme-bg rounded-xl border border-vizme-navy/5 p-2.5 text-center">
              <p className="text-base font-black text-vizme-navy">{value}</p>
              <p className="text-[9px] uppercase tracking-wide text-vizme-greyblue">{label}</p>
            </div>
          ))}
        </div>

        {/* Issues found */}
        {preview.issues.length > 0 && (
          <div className="px-5 pt-4">
            <p className="text-[10px] font-bold text-vizme-greyblue uppercase tracking-wider mb-2">Problemas detectados</p>
            <div className="space-y-1.5">
              {preview.issues.map((issue, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-vizme-navy bg-orange-50 rounded-lg px-3 py-2">
                  <AlertCircle size={11} className="text-vizme-orange flex-shrink-0 mt-0.5" />
                  {issue}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Recommendations */}
        {preview.recommendations.length > 0 && (
          <div className="px-5 pt-4">
            <p className="text-[10px] font-bold text-vizme-greyblue uppercase tracking-wider mb-2">Recomendaciones de limpieza</p>
            <div className="space-y-1.5">
              {preview.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-vizme-navy bg-blue-50 rounded-lg px-3 py-2">
                  <Sparkles size={11} className="text-blue-500 flex-shrink-0 mt-0.5" />
                  {rec}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* What can be analyzed */}
        <div className="px-5 pt-4">
          <p className="text-[10px] font-bold text-vizme-greyblue uppercase tracking-wider mb-2">Lo que Vizme puede analizar</p>
          <div className="space-y-1.5">
            {preview.suggestedAnalysis.map((sug, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-vizme-navy bg-emerald-50 rounded-lg px-3 py-2">
                <CheckCircle2 size={11} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                {sug}
              </div>
            ))}
          </div>
        </div>

        {/* Column detail */}
        <div className="px-5 pt-4">
          <p className="text-[10px] font-bold text-vizme-greyblue uppercase tracking-wider mb-2">Columnas detectadas</p>
          <div className="flex flex-wrap gap-1.5">
            {preview.numericColumns.map(c => (
              <span key={c} className="text-[10px] font-medium px-2 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">{c}</span>
            ))}
            {preview.categoryColumns.map(c => (
              <span key={c} className="text-[10px] font-medium px-2 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200">{c}</span>
            ))}
            {preview.dateColumns.map(c => (
              <span key={c} className="text-[10px] font-medium px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">{c}</span>
            ))}
          </div>
          <div className="flex items-center gap-3 mt-2 text-[9px] text-vizme-greyblue">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-400" /> Metricas</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-purple-400" /> Categorias</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Fechas</span>
          </div>
        </div>

        {/* Actions */}
        <div className="p-5 flex items-center gap-3">
          <button
            onClick={onConfirmUpload}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg, #F54A43, #F26A3D)', boxShadow: '0 4px 16px rgba(245,74,67,0.3)' }}
          >
            <CheckCircle2 size={15} />
            Guardar y continuar
          </button>
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-vizme-navy/12 text-sm text-vizme-greyblue hover:text-vizme-navy hover:bg-vizme-bg transition-all"
          >
            <X size={13} />
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  // ── Saving ────────────────────────────────────────────────────────────────
  if (state.phase === 'saving') {
    return (
      <div className="rounded-2xl border border-vizme-navy/8 bg-white p-8 text-center">
        <Loader2 size={28} className="animate-spin text-vizme-greyblue mx-auto mb-3" />
        <p className="text-sm font-semibold text-vizme-navy">Guardando {state.fileName}…</p>
        <p className="text-xs text-vizme-greyblue mt-1">Ya mero…</p>
      </div>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  // ── Transforming (AI parsing & cleaning) ────────────────────────────────────
  if (state.phase === 'transforming') {
    const TRANSFORM_STEPS = [
      'Enviando muestra a Vizme AI…',
      'Entendiendo la estructura…',
      'Limpiando y normalizando datos…',
      'Preparando tabla final…',
    ];
    const progress = ((state.step + 1) / TRANSFORM_STEPS.length) * 100;
    return (
      <div className="rounded-2xl border border-vizme-navy/8 bg-white p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-vizme-red to-vizme-orange flex items-center justify-center flex-shrink-0">
            <Brain size={22} className="text-white animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-vizme-navy">Vizme está limpiando tus datos...</p>
            <p className="text-xs text-vizme-greyblue mt-0.5">Convirtiendo tu archivo en una tabla lista para análisis</p>
          </div>
        </div>

        <div className="space-y-2">
          {TRANSFORM_STEPS.map((step, i) => (
            <div key={i} className={`flex items-center gap-2.5 text-sm transition-all ${
              i < state.step ? 'text-emerald-600' : i === state.step ? 'text-vizme-navy font-medium' : 'text-vizme-navy/25'
            }`}>
              {i < state.step ? (
                <CheckCircle2 size={14} className="flex-shrink-0 text-emerald-500" />
              ) : i === state.step ? (
                <Loader2 size={14} className="animate-spin flex-shrink-0 text-vizme-red" />
              ) : (
                <div className="h-3.5 w-3.5 rounded-full border-2 border-current flex-shrink-0" />
              )}
              {step}
            </div>
          ))}
        </div>

        <div className="mt-5 h-1.5 bg-vizme-bg rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #F54A43, #F26A3D)' }}
          />
        </div>
      </div>
    );
  }

  // ── Transform result (what Vizme understood + cleaned) ────────────────────
  if (state.phase === 'transform_result') {
    const { transformed } = state;
    const numCols = transformed.columns.filter(c => ['number', 'currency', 'percentage'].includes(c.type));
    const dataCols = transformed.columns.filter(c => c.type === 'date');
    const catCols = transformed.columns.filter(c => ['text', 'category'].includes(c.type));

    return (
      <div className="rounded-2xl border border-vizme-navy/8 bg-white overflow-hidden">
        <div className="p-5 border-b border-vizme-navy/6 bg-gradient-to-r from-vizme-navy to-[#0a3a4f]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <Eye size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Datos listos para análisis</p>
              <p className="text-[11px] text-white/50 mt-0.5">Verifica que sea correcto antes de continuar</p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-3">
          {/* Understanding */}
          <div className="flex items-start gap-3 bg-vizme-bg rounded-xl p-3.5">
            <Search size={14} className="text-vizme-red flex-shrink-0 mt-0.5" />
            <p className="text-sm text-vizme-navy leading-relaxed">{transformed.understanding}</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-vizme-bg rounded-xl border border-vizme-navy/5 p-2.5 text-center">
              <p className="text-base font-black text-vizme-navy">{transformed.data.length}</p>
              <p className="text-[9px] uppercase tracking-wide text-vizme-greyblue">Registros</p>
            </div>
            <div className="bg-vizme-bg rounded-xl border border-vizme-navy/5 p-2.5 text-center">
              <p className="text-base font-black text-vizme-navy">{transformed.columns.length}</p>
              <p className="text-[9px] uppercase tracking-wide text-vizme-greyblue">Columnas</p>
            </div>
            <div className="bg-vizme-bg rounded-xl border border-vizme-navy/5 p-2.5 text-center">
              <p className="text-base font-black text-vizme-navy">{numCols.length}</p>
              <p className="text-[9px] uppercase tracking-wide text-vizme-greyblue">Métricas</p>
            </div>
          </div>

          {/* Columns */}
          <div>
            <p className="text-[10px] font-bold text-vizme-greyblue uppercase tracking-wider mb-2">Columnas detectadas</p>
            <div className="flex flex-wrap gap-1.5">
              {numCols.map(c => (
                <span key={c.name} className="text-[10px] font-medium px-2 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200" title={c.description}>{c.original_name}</span>
              ))}
              {catCols.map(c => (
                <span key={c.name} className="text-[10px] font-medium px-2 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200" title={c.description}>{c.original_name}</span>
              ))}
              {dataCols.map(c => (
                <span key={c.name} className="text-[10px] font-medium px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200" title={c.description}>{c.original_name}</span>
              ))}
            </div>
          </div>

          {/* Warnings */}
          {transformed.warnings && transformed.warnings.length > 0 && (
            <div className="space-y-1.5">
              {transformed.warnings.slice(0, 3).map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-vizme-orange bg-orange-50 rounded-lg px-3 py-2">
                  <AlertCircle size={11} className="flex-shrink-0 mt-0.5" />
                  {w}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-5 pt-0 flex items-center gap-3">
          <button
            onClick={() => onConfirmInterpretation?.()}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg, #F54A43, #F26A3D)', boxShadow: '0 4px 16px rgba(245,74,67,0.3)' }}
          >
            <CheckCircle2 size={15} />
            Guardar y continuar
          </button>
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-vizme-navy/12 text-sm text-vizme-greyblue hover:text-vizme-navy hover:bg-vizme-bg transition-all"
          >
            <X size={13} />
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  if (state.phase === 'done') {
    const ep = state.file.enriched_profile;
    const qs = ep?.qualityScore ?? 0;
    const qualityColor = qs >= 80 ? 'text-emerald-600 bg-emerald-50' : qs >= 60 ? 'text-orange-600 bg-orange-50' : 'text-vizme-red bg-red-50';

    const handleSavePeriod = async () => {
      if (!periodInput.trim()) return;
      await supabase.from('files').update({ period_label: periodInput.trim() }).eq('id', state.file.id);
    };

    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-6 space-y-5">
        {/* Success header */}
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 size={20} className="text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-vizme-navy truncate">{state.file.file_name}</p>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-xs text-vizme-greyblue">
                {(state.file.row_count ?? 0).toLocaleString('es-MX')} filas
              </span>
              <span className="text-vizme-navy/20 text-xs">·</span>
              <span className="text-xs text-vizme-greyblue">{state.file.column_count} columnas</span>
              {ep && (
                <>
                  <span className="text-vizme-navy/20 text-xs">·</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${qualityColor}`}>
                    Calidad {qs}%
                  </span>
                </>
              )}
            </div>
          </div>
          <button onClick={onReset} className="text-vizme-greyblue hover:text-vizme-navy flex-shrink-0">
            <X size={14} />
          </button>
        </div>

        {/* Period label */}
        <div>
          <label className="text-xs font-medium text-vizme-navy mb-1.5 flex items-center gap-1.5">
            <Calendar size={12} />
            ¿A qué período corresponden estos datos? <span className="text-vizme-greyblue font-normal">(opcional)</span>
          </label>
          <input
            type="text"
            value={periodInput}
            onChange={e => setPeriodInput(e.target.value)}
            onBlur={handleSavePeriod}
            placeholder="Ej: Enero 2026, Q1 2026, Semana 14…"
            className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-vizme-navy/12 bg-white text-vizme-navy placeholder-vizme-greyblue/40 focus:outline-none focus:ring-2 focus:ring-vizme-red/20 focus:border-vizme-red transition-all"
          />
        </div>

        {/* CTA */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onStartDiscovery(state.file)}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg, #F54A43, #F26A3D)', boxShadow: '0 4px 16px rgba(245,74,67,0.3)' }}
          >
            <BookOpen size={15} />
            Descubrir mis datos
            <ArrowRight size={14} />
          </button>
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-vizme-navy/12 text-sm text-vizme-greyblue hover:text-vizme-navy hover:bg-vizme-bg transition-all"
          >
            <Upload size={13} />
            Subir otro
          </button>
        </div>
      </div>
    );
  }

  // ── Discovery loading ─────────────────────────────────────────────────────
  if (state.phase === 'discovery_loading') {
    return (
      <div className="rounded-2xl border border-vizme-navy/8 bg-white p-8 text-center">
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-vizme-red to-vizme-orange flex items-center justify-center mx-auto mb-4">
          <BookOpen size={24} className="text-white animate-pulse" />
        </div>
        <p className="text-base font-bold text-vizme-navy">Vizme está descubriendo tu historia…</p>
        <p className="text-xs text-vizme-greyblue mt-1.5">Analizando patrones, sorpresas y oportunidades en tus datos</p>
        <div className="mt-5 flex items-center justify-center gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-2 w-2 rounded-full bg-vizme-red animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }

  // ── Discovery result ─────────────────────────────────────────────────────
  if (state.phase === 'discovery') {
    const { discovery, file } = state;
    const scoreColor = discovery.health_score_inicial >= 70 ? 'text-emerald-600' : discovery.health_score_inicial >= 50 ? 'text-vizme-orange' : 'text-vizme-red';
    const scoreBg = discovery.health_score_inicial >= 70 ? 'from-emerald-400 to-emerald-600' : discovery.health_score_inicial >= 50 ? 'from-orange-400 to-orange-600' : 'from-red-400 to-red-600';

    return (
      <div className="rounded-2xl border border-vizme-navy/8 bg-white overflow-hidden">
        {/* Header with health score */}
        <div className="relative p-6 pb-5 bg-gradient-to-br from-vizme-navy to-vizme-navy/90 text-white overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen size={16} className="text-white/70" />
                <span className="text-xs text-white/60 uppercase tracking-wider font-semibold">Discovery</span>
              </div>
              <p className="text-lg font-bold leading-snug">La historia de tus datos</p>
              <p className="text-xs text-white/50 mt-1">{file.file_name}</p>
            </div>
            <div className="flex flex-col items-center">
              <div className={`h-16 w-16 rounded-full bg-gradient-to-br ${scoreBg} flex items-center justify-center shadow-lg`}>
                <span className="text-xl font-black text-white">{discovery.health_score_inicial}</span>
              </div>
              <span className="text-[9px] text-white/50 mt-1.5 uppercase tracking-wider">Health Score</span>
            </div>
          </div>
        </div>

        {/* Narrative */}
        <div className="p-5 border-b border-vizme-navy/6">
          {discovery.narrativa.split('\n').filter(Boolean).map((p, i) => (
            <p key={i} className="text-sm text-vizme-navy/80 leading-relaxed mb-3 last:mb-0">{p}</p>
          ))}
        </div>

        {/* Key findings */}
        <div className="p-5 border-b border-vizme-navy/6">
          <p className="text-[10px] font-bold text-vizme-greyblue uppercase tracking-wider mb-3">Hallazgos clave</p>
          <div className="space-y-2">
            {discovery.hallazgos_clave.map((h, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="h-5 w-5 rounded-lg bg-vizme-red/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Zap size={10} className="text-vizme-red" />
                </div>
                <p className="text-sm text-vizme-navy leading-snug">{h}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Surprise datum */}
        <div className="p-5 border-b border-vizme-navy/6 bg-amber-50/50">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Sparkles size={14} className="text-amber-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1">Dato sorpresa</p>
              <p className="text-sm text-vizme-navy font-medium">{discovery.dato_sorpresa}</p>
            </div>
          </div>
        </div>

        {/* Hook question */}
        <div className="p-5 border-b border-vizme-navy/6 bg-blue-50/50">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <MessageCircle size={14} className="text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-1">Para explorar</p>
              <p className="text-sm text-vizme-navy font-medium italic">{discovery.pregunta_gancho}</p>
            </div>
          </div>
        </div>

        {/* Health justification */}
        <div className="px-5 pt-4 pb-2">
          <div className="flex items-center gap-2 mb-1.5">
            <Heart size={12} className={scoreColor} />
            <p className="text-[10px] font-bold text-vizme-greyblue uppercase tracking-wider">¿Por qué {discovery.health_score_inicial} puntos?</p>
          </div>
          <p className="text-xs text-vizme-greyblue leading-relaxed">{discovery.health_justification}</p>
        </div>

        {/* CTA */}
        <div className="p-5 flex items-center gap-3">
          <button
            onClick={() => onGoToDashboard(file)}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg, #F54A43, #F26A3D)', boxShadow: '0 4px 16px rgba(245,74,67,0.3)' }}
          >
            <BarChart2 size={15} />
            Generar mi Dashboard
            <ArrowRight size={14} />
          </button>
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-vizme-navy/12 text-sm text-vizme-greyblue hover:text-vizme-navy hover:bg-vizme-bg transition-all"
          >
            <Upload size={13} />
            Subir otro
          </button>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (state.phase === 'error') {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50/50 p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertCircle size={18} className="text-vizme-red" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-vizme-navy">Algo salió mal</p>
            <p className="text-xs text-vizme-greyblue mt-1 leading-relaxed">{state.message}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {state.canRetry && state.originalFile && (
            <button
              onClick={() => onRetry(state.originalFile!)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-vizme-red text-white text-xs font-semibold hover:bg-vizme-orange transition-colors"
            >
              <RefreshCw size={12} /> Reintentar
            </button>
          )}
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-vizme-navy/12 text-xs text-vizme-greyblue hover:text-vizme-navy transition-colors"
          >
            <X size={12} /> Cancelar
          </button>
        </div>
      </div>
    );
  }

  return null;
};

// ─── File card ────────────────────────────────────────────────────────────────

const FileCard: React.FC<{
  file: V3File;
  onDelete: (id: string) => void;
  onGenerate: (file: V3File) => void;
  onPeriodSave: (id: string, label: string) => void;
  isGenerating: boolean;
}> = ({ file, onDelete, onGenerate, onPeriodSave, isGenerating }) => {
  const [showProfile, setShowProfile] = useState(false);
  const [editPeriod, setEditPeriod] = useState(false);
  const [period, setPeriod] = useState(file.period_label ?? '');

  const hasDashboard = !!file.dashboard_id;
  const ep = file.enriched_profile;

  return (
    <div className="bg-white rounded-2xl border border-vizme-navy/6 hover:border-vizme-navy/15 transition-all duration-200 hover:shadow-md overflow-hidden">
      <div className="p-5">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="h-10 w-10 rounded-xl bg-vizme-bg border border-vizme-navy/6 flex items-center justify-center flex-shrink-0">
            <FileSpreadsheet size={18} className="text-vizme-navy" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-vizme-navy leading-tight truncate" title={file.file_name}>
              {file.file_name}
            </p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {file.row_count && (
                <span className="text-xs text-vizme-greyblue">
                  {file.row_count.toLocaleString('es-MX')} filas
                </span>
              )}
              {file.column_count && (
                <>
                  <span className="text-vizme-navy/20 text-xs">·</span>
                  <span className="text-xs text-vizme-greyblue">{file.column_count} columnas</span>
                </>
              )}
              {file.file_size_bytes && (
                <>
                  <span className="text-vizme-navy/20 text-xs">·</span>
                  <span className="text-xs text-vizme-greyblue">{fmtBytes(file.file_size_bytes)}</span>
                </>
              )}
            </div>
          </div>

          {/* Status badge */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {hasDashboard ? (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                <CheckCircle2 size={9} /> Listo
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-vizme-greyblue bg-vizme-bg border border-vizme-navy/8 px-2 py-0.5 rounded-full">
                <Clock size={9} /> Sin analizar
              </span>
            )}
          </div>
        </div>

        {/* Period + date row */}
        <div className="mt-3 flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1 text-xs text-vizme-greyblue">
            <Calendar size={10} /> {fmtDate(file.created_at)}
          </span>

          {editPeriod ? (
            <div className="flex items-center gap-1.5">
              <input
                value={period}
                onChange={e => setPeriod(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { onPeriodSave(file.id, period); setEditPeriod(false); }
                  if (e.key === 'Escape') setEditPeriod(false);
                }}
                autoFocus
                placeholder="Ej: Enero 2026"
                className="text-xs px-2.5 py-1 border border-vizme-red/30 rounded-lg focus:outline-none focus:ring-1 focus:ring-vizme-red/20 w-32"
              />
              <button
                onClick={() => { onPeriodSave(file.id, period); setEditPeriod(false); }}
                className="text-vizme-red text-xs font-bold px-2 py-0.5 rounded hover:bg-vizme-red/10"
              >✓</button>
              <button onClick={() => setEditPeriod(false)} className="text-vizme-greyblue text-xs">✕</button>
            </div>
          ) : (
            <button
              onClick={() => setEditPeriod(true)}
              className="flex items-center gap-1 text-xs text-vizme-greyblue hover:text-vizme-red transition-colors"
            >
              {file.period_label
                ? <span className="text-vizme-navy font-medium">{file.period_label}</span>
                : <span className="italic">+ Etiquetar período</span>
              }
            </button>
          )}

          {ep?.detectedBusinessType && ep.detectedBusinessType !== 'desconocido' && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-vizme-navy/5 text-vizme-navy capitalize">
              {ep.detectedBusinessType}
            </span>
          )}
        </div>

        {/* Data profile toggle */}
        {ep && (
          <button
            onClick={() => setShowProfile(v => !v)}
            className="mt-3 flex items-center gap-1.5 text-xs text-vizme-greyblue hover:text-vizme-navy transition-colors"
          >
            {showProfile ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {showProfile ? 'Ocultar perfil de datos' : 'Ver perfil de datos'}
          </button>
        )}
      </div>

      {/* Data profile panel */}
      {showProfile && ep && (
        <div className="border-t border-vizme-navy/5 bg-vizme-bg/40 px-5 py-4">
          <div className="grid grid-cols-4 gap-2 mb-3">
            {[
              { label: 'Filas',       value: ep.totalRows.toLocaleString('es-MX') },
              { label: 'Métricas',    value: ep.numericColumns.length },
              { label: 'Dimensiones', value: ep.categoryColumns.length },
              { label: 'Calidad',     value: `${ep.qualityScore}%` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white rounded-xl border border-vizme-navy/6 p-2.5 text-center">
                <p className="text-base font-black text-vizme-navy">{value}</p>
                <p className="text-[9px] uppercase tracking-wide text-vizme-greyblue mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            {ep.columnDetails?.slice(0, 6).map((col, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <span className="text-xs text-vizme-navy w-32 truncate font-medium">{col.name}</span>
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                  col.type === 'numeric' ? 'bg-blue-50 text-blue-600'
                  : col.type === 'categorical' ? 'bg-purple-50 text-purple-600'
                  : col.type === 'date' ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-vizme-bg text-vizme-greyblue'
                }`}>{col.type}</span>
                {col.nullPct > 0 && (
                  <span className="text-[10px] text-orange-500 ml-auto">{Math.round(col.nullPct * 100)}% vacíos</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action footer */}
      <div className="px-5 pb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {hasDashboard ? (
            <>
              <button
                onClick={() => onGenerate(file)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-vizme-navy text-white text-xs font-semibold hover:bg-vizme-navy/80 transition-colors"
              >
                <BarChart2 size={12} /> Ver Dashboard
              </button>
              <button
                onClick={() => onGenerate(file)}
                disabled={isGenerating}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-vizme-navy/10 text-xs text-vizme-greyblue hover:text-vizme-navy hover:border-vizme-navy/25 transition-all disabled:opacity-40"
              >
                {isGenerating ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                Regenerar
              </button>
            </>
          ) : (
            <button
              onClick={() => onGenerate(file)}
              disabled={isGenerating}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #F54A43, #F26A3D)' }}
            >
              {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              Generar Dashboard IA
            </button>
          )}
        </div>
        <button
          onClick={() => onDelete(file.id)}
          className="h-8 w-8 rounded-xl border border-vizme-navy/8 flex items-center justify-center text-vizme-greyblue hover:text-vizme-red hover:border-vizme-red/25 hover:bg-red-50 transition-all"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const DataPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const { activeProject } = useProject();
  const navigate = useNavigate();

  const [wizardState, setWizardState] = useState<WizardState>({ phase: 'idle' });
  const [files, setFiles] = useState<V3File[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [forceShowUploader, setForceShowUploader] = useState(false);

  const loadFiles = useCallback(async () => {
    if (!user || !projectId) return;
    const { data } = await supabase
      .from('files')
      .select('*')
      .eq('user_id', user.id)
      .eq('project_id', projectId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    setFiles((data ?? []) as V3File[]);
    setLoadingFiles(false);
  }, [user, projectId]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  // ── Build preview from parsed data ─────────────────────────────────────────
  const buildPreview = (parsed: any, dp: any, enriched: any): DataPreview => {
    const issues: string[] = [];
    const recommendations: string[] = [];
    const suggestedAnalysis: string[] = [];

    // Quality issues
    if (enriched.qualityScore < 60) issues.push('La calidad general de los datos es baja. Puede afectar la precision del analisis.');
    const emptyColPct = (enriched.columnDetails ?? []).filter((c: any) => c.nullPct > 0.3);
    if (emptyColPct.length > 0) {
      issues.push(`${emptyColPct.length} columna(s) tienen mas de 30% de valores vacios: ${emptyColPct.map((c: any) => c.name).join(', ')}`);
      recommendations.push('Considera llenar los valores faltantes o eliminar esas columnas si no son relevantes.');
    }

    // Type mismatches
    const numCols = enriched.numericColumns ?? [];
    const catCols = enriched.categoryColumns ?? [];
    const dateCols = (enriched.columnDetails ?? []).filter((c: any) => c.type === 'date').map((c: any) => c.name);

    if (numCols.length === 0) {
      issues.push('No se detectaron columnas numericas. El dashboard necesita al menos una metrica para generar graficas.');
      recommendations.push('Verifica que tus datos tengan columnas con numeros (ventas, cantidades, precios, etc.).');
    }
    if (catCols.length === 0) {
      recommendations.push('No hay columnas categoricas claras. Considera agregar columnas como producto, sucursal, o categoria.');
    }

    // Suggested analysis based on data profile
    if (numCols.length >= 2 && catCols.length >= 1) {
      suggestedAnalysis.push(`Comparar ${numCols.slice(0, 2).join(' y ')} por ${catCols[0]}`);
    }
    if (numCols.length >= 1 && catCols.length >= 1) {
      suggestedAnalysis.push(`Ranking de ${catCols[0]} por ${numCols[0]}`);
    }
    if (dateCols.length > 0 && numCols.length >= 1) {
      suggestedAnalysis.push(`Tendencia temporal de ${numCols[0]} a lo largo del tiempo`);
    }
    if (numCols.length >= 2) {
      suggestedAnalysis.push(`Correlacion entre ${numCols[0]} y ${numCols[1]}`);
    }
    if (catCols.length >= 1 && numCols.length >= 1) {
      suggestedAnalysis.push(`Distribucion porcentual de ${numCols[0]} por ${catCols[0]}`);
    }
    if (parsed.rowCount > 100) {
      suggestedAnalysis.push('Detectar anomalias y outliers en las metricas principales');
    }

    // General recommendations
    if (parsed.rowCount < 20) {
      recommendations.push('Con tan pocas filas el analisis sera limitado. Si tienes mas datos, considera agregar mas periodos.');
    }
    if (dateCols.length === 0) {
      recommendations.push('Agregar una columna de fecha permitiria generar graficas temporales y predicciones.');
    }

    return {
      totalRows: parsed.rowCount,
      totalColumns: parsed.headers.length,
      numericColumns: numCols,
      categoryColumns: catCols,
      dateColumns: dateCols,
      qualityScore: enriched.qualityScore ?? 0,
      issues,
      recommendations,
      suggestedAnalysis,
    };
  };

  // ── Process a file → preview phase ────────────────────────────────────────
  const processFile = useCallback(async (file: File, sheetName?: string) => {
    setWizardState({ phase: 'parsing', fileName: file.name, step: 2 });
    try {
      // Run legacy parse + raw extraction in parallel
      const [parsed, rawExtr] = await Promise.all([
        parseFile(file, sheetName),
        rawExtract(file).catch(() => null), // non-fatal
      ]);
      if (!parsed.rows.length) throw new Error('El archivo esta vacio o no tiene filas de datos.');

      const dp       = inferDataProfile(parsed.rows, parsed.headers);
      const enriched = buildEnrichedProfile(parsed.rows, parsed.headers, dp);
      const preview  = buildPreview(parsed, dp, enriched);

      setWizardState({
        phase: 'preview',
        file,
        preview,
        parsedFile: { ...parsed, sheetName },
        profile: dp,
        enriched,
        rawExtraction: rawExtr ?? undefined,
      });
    } catch (err: any) {
      setWizardState({
        phase: 'error',
        message: err?.message ?? 'Hubo un error al leer el archivo.',
        canRetry: true,
        originalFile: file,
      });
    }
  }, []);

  // ── Confirm upload (from preview → save to DB → transform or done) ────────
  const confirmUpload = useCallback(async () => {
    if (wizardState.phase !== 'preview') return;
    const { file, parsedFile, profile: dp, enriched, rawExtraction } = wizardState;

    setWizardState({ phase: 'saving', fileName: file.name });
    try {
      const safeName    = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${user!.id}/${Date.now()}_${safeName}`;

      // Storage upload (non-fatal)
      const { error: storageError } = await supabase.storage
        .from('uploads')
        .upload(storagePath, file, { upsert: false });
      if (storageError && !storageError.message?.includes('already exists')) {
        console.warn('Storage warning:', storageError.message);
      }

      const { data: inserted, error: dbError } = await supabase
        .from('files')
        .insert({
          user_id:               user!.id,
          project_id:            projectId,
          file_name:             file.name,
          file_type:             file.name.split('.').pop()?.toLowerCase() ?? 'xlsx',
          file_size_bytes:       file.size,
          storage_path:          storagePath,
          sheet_names:           parsedFile.sheets?.map((s: any) => s.name) ?? null,
          selected_sheet:        parsedFile.sheetName ?? parsedFile.selectedSheet ?? null,
          parsed_data:           parsedFile.rows.slice(0, 1000),
          data_profile:          dp,
          enriched_profile:      enriched,
          row_count:             parsedFile.rowCount,
          column_count:          parsedFile.headers.length,
          quality_score:         enriched.qualityScore,
          detected_business_type: dp.dataType,
          is_active:             true,
        })
        .select()
        .single();

      if (dbError) {
        if (dbError.message?.includes('does not exist') || (dbError as any).code === '42P01') {
          throw new Error('La tabla "files" no existe. Ve a Supabase Dashboard y ejecuta las migraciones.');
        }
        throw new Error(dbError.message);
      }

      loadFiles();

      // If we have rawExtraction and file is NOT simple, send to Claude for transformation
      if (rawExtraction && !rawExtraction.isSimpleFile) {
        setWizardState({
          phase: 'transforming',
          file,
          parsedFile,
          profile: dp,
          enriched,
          rawExtraction,
          step: 0,
        });
        handleTransformData((inserted as V3File).id, file, parsedFile, dp, enriched, rawExtraction);
      } else {
        // Simple file (1 sheet, clean headers) — skip AI, go straight to done
        setWizardState({ phase: 'done', file: inserted as V3File });
        setForceShowUploader(false);
      }
    } catch (err: any) {
      setWizardState({
        phase: 'error',
        message: err?.message ?? 'Hubo un error al subir el archivo.',
        canRetry: true,
        originalFile: file,
      });
    }
  }, [wizardState, user, projectId, loadFiles]);

  // ── Transform data (Claude parses & cleans the raw file) ─────────────────
  const handleTransformData = useCallback(async (
    savedFileId: string,
    originalFile: File,
    parsedFile: any,
    dp: any,
    enriched: any,
    rawExtr: RawExtraction,
  ) => {
    // Animate steps
    let stepIdx = 0;
    const stepInterval = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, 3);
      setWizardState(prev =>
        prev.phase === 'transforming' ? { ...prev, step: stepIdx } : prev
      );
    }, 1200);

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_name, industry')
        .eq('id', user!.id)
        .maybeSingle();

      // Get project context for the prompt
      const { data: project } = await supabase
        .from('projects')
        .select('main_question, analysis_area')
        .eq('id', projectId)
        .maybeSingle();

      const res = await invokeFunction('analyze-data', {
        body: {
          mode: 'transform_data',
          sample: rawExtr.sample,
          sheetCount: rawExtr.sheetCount,
          sheetNames: rawExtr.sheetNames.slice(0, 30),
          notableRows: rawExtr.notableRows.slice(0, 30),
          profileContext: profile ? { company_name: profile.company_name, industry: profile.industry } : null,
          mainQuestion: project?.main_question ?? '',
          analysisArea: project?.analysis_area ?? '',
          projectId,
        },
      });

      clearInterval(stepInterval);

      if (res.error || !res.data?.transformed?.understanding) {
        // Extract real error message
        let errMsg = 'Error transformando datos';
        try {
          if (res.error?.context && typeof res.error.context.json === 'function') {
            const b = await res.error.context.json();
            errMsg = b?.error ?? errMsg;
          } else if (res.error?.message) {
            errMsg = res.error.message;
          }
        } catch {}
        console.warn('Transform failed:', errMsg);
        // Fallback — show the file as done without transformation
        const { data: fallback } = await supabase.from('files').select('*').eq('id', savedFileId).single();
        setWizardState({ phase: 'done', file: (fallback ?? { id: savedFileId }) as V3File });
        setForceShowUploader(false);
        return;
      }

      const transformed = res.data.transformed as TransformedData;

      setWizardState({
        phase: 'transform_result',
        file: originalFile,
        parsedFile,
        profile: dp,
        enriched,
        rawExtraction: rawExtr,
        transformed,
        savedFileId,
      });
    } catch (err: any) {
      clearInterval(stepInterval);
      console.warn('Transform error, falling back:', err);
      const { data: fallback } = await supabase.from('files').select('*').eq('id', savedFileId).single();
      setWizardState({ phase: 'done', file: (fallback ?? { id: savedFileId }) as V3File });
      setForceShowUploader(false);
    }
  }, [user, projectId]);

  // ── Confirm transform (save extracted_data + structural_map to DB) ──────
  const handleConfirmInterpretation = useCallback(async () => {
    if (wizardState.phase !== 'transform_result') return;
    const { file: originalFile, parsedFile, profile: dp, rawExtraction, transformed, savedFileId } = wizardState;

    try {
      // For multi-sheet files with many similar sheets, extract ALL data using Claude's pattern
      let finalData = transformed.data;
      if (rawExtraction.sheetCount > 5 && transformed.sheet_pattern === 'one_per_period') {
        try {
          const fullExtraction = await extractAllFromPattern(originalFile, {
            columns: transformed.columns,
            sheet_pattern: transformed.sheet_pattern,
            period_column: transformed.period_column ?? null,
          });
          if (fullExtraction.data.length > finalData.length) {
            finalData = fullExtraction.data;
          }
        } catch (e) {
          console.warn('extractAllFromPattern failed, using sample data:', e);
        }
      }

      // Build the structural_map (columns + pattern info for reuse)
      const structuralMap = {
        columns: transformed.columns,
        sheet_pattern: transformed.sheet_pattern,
        period_column: transformed.period_column,
        metrics_for_weekly_entry: transformed.metrics_for_weekly_entry,
        understanding: transformed.understanding,
      };

      // Build extracted_data (the clean table)
      const extractedData: TransformedData = {
        ...transformed,
        data: finalData,
      };

      // Rebuild enriched profile with the clean extracted data
      const newEnriched = buildEnrichedProfile(
        parsedFile.rows,
        parsedFile.headers,
        dp,
        extractedData,
      );

      // Update the file in DB
      const { data: updated, error: updateError } = await supabase
        .from('files')
        .update({
          structural_map: structuralMap,
          extracted_data: extractedData,
          enriched_profile: newEnriched,
          quality_score: newEnriched.qualityScore,
          row_count: finalData.length || parsedFile.rowCount,
          column_count: transformed.columns.length || parsedFile.headers.length,
        })
        .eq('id', savedFileId)
        .select()
        .single();

      if (updateError) throw new Error(updateError.message);

      setWizardState({ phase: 'done', file: updated as V3File });
      setForceShowUploader(false);
      loadFiles();
    } catch (err: any) {
      console.warn('Error saving transform, continuing with basic profile:', err);
      const { data: fallback } = await supabase.from('files').select('*').eq('id', savedFileId).single();
      if (fallback) {
        setWizardState({ phase: 'done', file: fallback as V3File });
      } else {
        setWizardState({ phase: 'error', message: err?.message ?? 'Error guardando datos.', canRetry: false });
      }
      setForceShowUploader(false);
    }
  }, [wizardState, user, projectId, loadFiles]);

  // ── Drop handler ────────────────────────────────────────────────────────────
  const handleDrop = useCallback(async (accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;

    setWizardState({ phase: 'parsing', fileName: file.name, step: 0 });

    // Simulate step progression while parsing
    let stepIdx = 0;
    const stepInterval = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, PARSE_STEPS.length - 1);
      setWizardState(prev =>
        prev.phase === 'parsing' ? { ...prev, step: stepIdx } : prev
      );
    }, 600);

    try {
      const parsed = await parseFile(file);
      clearInterval(stepInterval);

      if (parsed.sheets && parsed.sheets.length > 1) {
        setWizardState({ phase: 'sheets', file, sheets: parsed.sheets });
      } else {
        await processFile(file, parsed.selectedSheet ?? undefined);
      }
    } catch (err: any) {
      clearInterval(stepInterval);
      setWizardState({
        phase: 'error',
        message: err?.message ?? 'No se pudo leer el archivo.',
        canRetry: true,
        originalFile: file,
      });
    }
  }, [processFile]);

  // Process all sheets combined → preview phase
  const processAllSheetsCb = useCallback(async (file: File) => {
    setWizardState({ phase: 'parsing', fileName: file.name, step: 2 });
    try {
      // Run legacy parse + raw extraction in parallel
      const [parsed, rawExtr] = await Promise.all([
        parseAllSheets(file),
        rawExtract(file).catch(() => null), // non-fatal
      ]);
      if (!parsed.rows.length) throw new Error('El archivo esta vacio.');

      const dp       = inferDataProfile(parsed.rows, parsed.headers);
      const enriched = buildEnrichedProfile(parsed.rows, parsed.headers, dp);
      const preview  = buildPreview(parsed, dp, enriched);

      setWizardState({
        phase: 'preview',
        file,
        preview,
        parsedFile: parsed,
        profile: dp,
        enriched,
        rawExtraction: rawExtr ?? undefined,
      });
    } catch (err: any) {
      setWizardState({ phase: 'error', message: err?.message ?? 'Error procesando todas las hojas.', canRetry: true, originalFile: file });
    }
  }, []);

  const handleSheetSelect = useCallback(async (file: File, sheet: string) => {
    if (sheet === '__ALL_SHEETS__') {
      await processAllSheetsCb(file);
    } else {
      await processFile(file, sheet);
    }
  }, [processFile, processAllSheetsCb]);

  const handleReset = () => { setWizardState({ phase: 'idle' }); setForceShowUploader(false); };

  const handleRetry = async (file: File) => {
    await handleDrop([file]);
  };

  const handleGoToDashboard = (file: V3File) => {
    navigate(`/dashboard/projects/${projectId}/overview?fileId=${file.id}&auto=1`);
  };

  // ── Discovery narrated step ───────────────────────────────────────────
  const handleStartDiscovery = useCallback(async (file: V3File) => {
    setWizardState({ phase: 'discovery_loading', file });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const enriched = file.enriched_profile ?? file.data_profile ?? {};
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_name, industry')
        .eq('id', user!.id)
        .maybeSingle();

      const res = await invokeFunction('analyze-data', {
        body: {
          mode: 'discovery',
          enrichedProfile: enriched,
          profileContext: profile ? { company_name: profile.company_name, industry: profile.industry } : null,
          projectId,
        },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });

      if (res.error) throw new Error(res.error.message ?? 'Error en discovery');
      const discovery = res.data?.discovery as DiscoveryResult | undefined;
      if (!discovery?.narrativa) throw new Error('No se generó el discovery');

      // Save discovery result to the file
      await supabase.from('files').update({ discovery_result: discovery }).eq('id', file.id);

      // Update health score on project
      if (discovery.health_score_inicial != null) {
        await supabase.from('projects').update({
          health_score_current: discovery.health_score_inicial,
          health_score_trend: 'stable',
        }).eq('id', projectId);
      }

      setWizardState({ phase: 'discovery', file, discovery });
    } catch (err: any) {
      console.error('Discovery error:', err);
      // On failure, skip discovery and go straight to dashboard
      handleGoToDashboard(file);
    }
  }, [user, projectId, handleGoToDashboard]);

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este archivo y su dashboard?')) return;
    await supabase.from('files').update({ is_active: false }).eq('id', id);
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handlePeriodSave = async (id: string, label: string) => {
    await supabase.from('files').update({ period_label: label }).eq('id', id);
    setFiles(prev => prev.map(f => f.id === id ? { ...f, period_label: label } : f));
  };

  const handleGenerate = (file: V3File) => {
    setGeneratingId(file.id);
    navigate(`/dashboard/projects/${projectId}/overview?fileId=${file.id}`);
  };

  const showWizard = wizardState.phase !== 'idle' || files.length === 0 || forceShowUploader;
  const periodFiles = files.filter(f => f.period_label);

  return (
    <div className="max-w-3xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <p className="text-xs text-vizme-greyblue font-medium mb-0.5">
          {activeProject?.name ?? 'Proyecto'}
        </p>
        <h1 className="text-2xl font-bold text-vizme-navy">Mis Datos</h1>
        <p className="text-sm text-vizme-greyblue mt-1">
          Sube tus archivos para que Vizme los analice y genere dashboards inteligentes.
        </p>
      </div>

      {/* Upload wizard */}
      {showWizard ? (
        <UploadWizard
          state={wizardState}
          onDrop={handleDrop}
          onSheetSelect={handleSheetSelect}
          onReset={handleReset}
          onGoToDashboard={handleGoToDashboard}
          onStartDiscovery={handleStartDiscovery}
          onRetry={handleRetry}
          onConfirmUpload={confirmUpload}
          onConfirmInterpretation={handleConfirmInterpretation}
          projectId={projectId ?? ''}
          userId={user?.id ?? ''}
        />
      ) : (
        /* Add more data — prominent CTA */
        <button
          onClick={() => { setForceShowUploader(true); setWizardState({ phase: 'idle' }); }}
          className="w-full flex items-center gap-4 py-4 px-5 rounded-2xl border-2 border-dashed border-vizme-navy/12 hover:border-vizme-red/40 hover:bg-vizme-red/3 transition-all group"
        >
          <div className="h-10 w-10 rounded-xl bg-vizme-bg group-hover:bg-vizme-red/10 flex items-center justify-center flex-shrink-0 transition-colors">
            <Upload size={18} className="text-vizme-greyblue group-hover:text-vizme-red transition-colors" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-vizme-navy group-hover:text-vizme-red transition-colors">
              Agregar mas datos
            </p>
            <p className="text-xs text-vizme-greyblue mt-0.5">
              Sube archivos de otros meses para comparar periodos y ver tendencias
            </p>
          </div>
        </button>
      )}

      {/* Period timeline (when 2+ files have period labels) */}
      {periodFiles.length >= 2 && (
        <div className="rounded-2xl border border-vizme-navy/6 bg-white p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-vizme-greyblue" />
            <p className="text-xs font-semibold text-vizme-navy uppercase tracking-wider">Timeline de datos</p>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {periodFiles.map((f, i) => (
              <React.Fragment key={f.id}>
                {i > 0 && <ArrowRight size={12} className="text-vizme-navy/20 flex-shrink-0" />}
                <div className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-medium border ${
                  f.dashboard_id
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-vizme-bg border-vizme-navy/8 text-vizme-navy'
                }`}>
                  {f.period_label}
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* File list */}
      {!loadingFiles && files.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-vizme-navy">
              {files.length} {files.length === 1 ? 'archivo' : 'archivos'}
            </p>
            <button
              onClick={loadFiles}
              className="flex items-center gap-1 text-xs text-vizme-greyblue hover:text-vizme-navy transition-colors"
            >
              <RefreshCw size={11} /> Actualizar
            </button>
          </div>

          {files.map(f => (
            <FileCard
              key={f.id}
              file={f}
              onDelete={handleDelete}
              onGenerate={handleGenerate}
              onPeriodSave={handlePeriodSave}
              isGenerating={generatingId === f.id}
            />
          ))}
        </div>
      )}

      {/* Empty state when no files and wizard is idle */}
      {!loadingFiles && files.length === 0 && wizardState.phase === 'idle' && (
        <div className="text-center py-4">
          <p className="text-xs text-vizme-greyblue">
            Soportamos archivos de hasta 50,000 filas · Excel y CSV
          </p>
        </div>
      )}
    </div>
  );
};

export default DataPage;
