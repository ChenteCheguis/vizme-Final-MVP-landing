// ──────────────────────────────────────────────────────────────────────────────
// Vizme V3 — Type definitions for the AI-powered dashboard system
// All types correspond to the DashboardResponse from the Edge Function
// ──────────────────────────────────────────────────────────────────────────────

// ── Enriched profile sent TO Claude ──────────────────────────────────────────

export interface CrossTabRow {
  name: string;
  value: number;
  pct?: number;
}

export interface CrossTab {
  catColumn: string;
  numColumn: string;
  aggregation: 'sum' | 'avg' | 'count';
  data: CrossTabRow[];
}

export interface TimeSeriesRow {
  period: string;
  value: number;
}

export interface TimeSeries {
  dateColumn: string;
  numColumn: string;
  aggregation: 'sum' | 'avg';
  granularity: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  data: TimeSeriesRow[];
}

export interface EnrichedProfile {
  // Core profile fields (from DataProfile)
  totalRows: number;
  totalColumns: number;
  columnNames: string[];
  numericColumns: string[];
  categoryColumns: string[];
  dateColumn: string | null;
  geoColumn: string | null;
  duplicateRows: number;
  detectedBusinessType: string;
  qualityScore: number;

  // Per-column detail
  columnDetails: {
    name: string;
    type: 'numeric' | 'categorical' | 'date' | 'text' | 'unknown';
    nullPct: number;
    uniqueValues: number;
    sampleValues: unknown[];
    // Numeric
    min?: number;
    max?: number;
    mean?: number;
    sum?: number;
    // Categorical top values
    topValues?: { value: string; count: number; pct: number }[];
    // Date range
    dateRange?: { min: string; max: string };
  }[];

  // Pre-computed aggregations
  crossTabs: CrossTab[];
  timeSeries: TimeSeries[];

  // Correlations between numeric columns
  correlations: { col1: string; col2: string; r: number }[];

  // New pipeline fields (Phase B/C)
  source?: 'extracted' | 'raw';
  structural_understanding?: string | null;
  key_metrics_summary?: { name: string; total: number; periods: number }[];
}

// ── Dashboard response FROM Claude ───────────────────────────────────────────

export interface V3KPI {
  id: string;
  label: string;
  value: string;           // Formatted: "$1.3M", "4,218", "87%"
  rawValue: number;
  format: 'currency' | 'number' | 'percentage';
  delta?: {
    value: string;         // "+12.4%"
    direction: 'up' | 'down' | 'neutral';
    context: string;       // "vs trimestre anterior"
  };
  icon: string;            // Lucide icon name
  priority: number;
}

export type V3ChartType =
  | 'bar_horizontal'
  | 'bar_vertical'
  | 'bar_grouped'
  | 'bar_stacked'
  | 'line'
  | 'area'
  | 'donut'
  | 'scatter'
  | 'bubble'
  | 'heatmap'
  | 'treemap'
  | 'funnel'
  | 'waterfall'
  | 'radar'
  | 'gauge';

export interface V3Chart {
  id: string;
  type: V3ChartType;
  title: string;
  subtitle: string;
  question: string;        // Business question this answers
  insight: string;         // Non-obvious insight
  insightType: 'action' | 'opportunity' | 'risk' | 'trend' | 'info';
  data: Record<string, unknown>[];   // Pre-processed, ready to render
  xKey: string;
  yKey: string;
  groupKey?: string;
  sizeKey?: string;
  colorKey?: string;
  gridSpan: 4 | 6 | 8 | 12;
  priority: number;
}

export interface V3Alert {
  id: string;
  type: 'warning' | 'danger' | 'success' | 'info';
  title: string;
  message: string;
  action?: string;
  priority: number;
}

export interface V3Filter {
  id: string;
  label: string;
  columnKey: string;
  type: 'select' | 'multiselect' | 'daterange' | 'range';
  options?: string[];
}

export interface V3ExecutiveSummary {
  headline: string;
  topInsights: string[];
  mainRisk: string;
  mainOpportunity: string;
  recommendedAction: string;
}

export interface V3HealthScore {
  overall: number;         // 0-10
  dimensions: {
    name: string;
    score: number;
    color: 'green' | 'yellow' | 'red';
    insight: string;
  }[];
  improvementPlan: {
    action: string;
    impact: string;
    effort: 'low' | 'medium' | 'high';
  }[];
  trend: 'improving' | 'stable' | 'declining';
}

export interface V3DataQuality {
  overallScore: number;
  issues: string[];
  suggestions: string[];
}

export interface V3DashboardResponse {
  kpis: V3KPI[];
  charts: V3Chart[];
  alerts: V3Alert[];
  executiveSummary: V3ExecutiveSummary;
  healthScore: V3HealthScore;
  dataQuality: V3DataQuality;
  suggestedFilters: V3Filter[];
}

// ── Persisted dashboard in Supabase ──────────────────────────────────────────

export interface V3SavedDashboard {
  id: string;
  user_id: string;
  file_id: string | null;
  project_id: string | null;
  name: string;
  charts_json: V3Chart[];
  kpis_json: V3KPI[];
  alerts_json: V3Alert[];
  summary_json: V3ExecutiveSummary;
  filters_json: V3Filter[];
  health_score: V3HealthScore;
  ai_model_used: string;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

// ── File record in Supabase ───────────────────────────────────────────────────

export interface V3File {
  id: string;
  user_id: string;
  project_id: string | null;
  file_name: string;
  file_type: string;
  file_size_bytes: number | null;
  storage_path: string | null;
  sheet_names: string[] | null;
  selected_sheet: string | null;
  parsed_data: Record<string, unknown>[] | null;
  data_profile: unknown;
  enriched_profile: EnrichedProfile | null;
  row_count: number | null;
  column_count: number | null;
  quality_score: number | null;
  detected_business_type: string | null;
  period_label: string | null;
  tags: string[] | null;
  dashboard_id: string | null;
  structural_map: Record<string, unknown> | null;
  extracted_data: Record<string, unknown> | null;
  discovery_result?: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
