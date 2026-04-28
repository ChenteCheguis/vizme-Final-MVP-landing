// ============================================================
// VIZME V5 — Catálogo de visualizaciones (Sprint 4)
//
// Fuente única de verdad de los tipos de viz disponibles. Lo
// usan dos sistemas:
//   1. El prompt de Opus (le dice CUÁNDO usar cada tipo).
//   2. El validador de blueprint (rechaza widgets cuyo type no
//      esté en el catálogo).
//
// Es extensible: agregar un tipo aquí + crear el componente
// React equivalente en components/dashboard/widgets/ basta para
// que Opus lo empiece a recomendar.
// ============================================================

export type VisualizationCatalogEntry = {
  id: string;
  name: string;
  description: string;
  when_to_use: string;
  requires: {
    metrics?: number;
    dimensions?: number;
    has_time_series?: boolean;
    categorical_dim?: boolean;
    two_categorical_dims?: boolean;
    has_daily_data?: boolean;
    metric_has_range?: boolean;
    metric_has_target?: boolean;
    sequential_data?: boolean;
    hierarchical_data?: boolean;
    flow_data?: boolean;
    tabular_data?: boolean;
    max_categories?: number;
  };
  sample_layout?: string;
  chart_library: 'recharts' | 'react-calendar-heatmap' | 'react-gauge-component' | 'custom';
};

export const VISUALIZATION_CATALOG: VisualizationCatalogEntry[] = [
  {
    id: 'kpi_hero',
    name: 'KPI Hero (gigante)',
    description: 'Métrica principal como número grande con tendencia y sparkline embebido.',
    when_to_use: 'Para LA métrica más importante del dashboard. Usar máximo 1 por página, en la sección hero.',
    requires: { metrics: 1, has_time_series: true },
    sample_layout: 'column_span: 4, row_span: 2',
    chart_library: 'recharts',
  },
  {
    id: 'kpi_card',
    name: 'KPI Card secundaria',
    description: 'Métrica importante como número con cambio % vs período anterior.',
    when_to_use: 'Métricas que acompañan al KPI hero. Idealmente 3 por página, en una fila.',
    requires: { metrics: 1 },
    sample_layout: 'column_span: 1, row_span: 1',
    chart_library: 'recharts',
  },
  {
    id: 'line_chart',
    name: 'Gráfica de líneas',
    description: 'Tendencia de 1-3 métricas sobre el tiempo.',
    when_to_use: 'Mostrar evolución temporal cuando interesa el patrón continuo.',
    requires: { has_time_series: true },
    chart_library: 'recharts',
  },
  {
    id: 'area_chart',
    name: 'Gráfica de área',
    description: 'Acumulados o rangos sobre el tiempo, con relleno.',
    when_to_use: 'Acumulados YTD, ranges, totales en el tiempo donde interesa el volumen.',
    requires: { has_time_series: true },
    chart_library: 'recharts',
  },
  {
    id: 'bar_chart',
    name: 'Barras verticales',
    description: 'Comparar categorías con barras verticales.',
    when_to_use: 'Top N rankings cortos, comparaciones por categoría con labels breves.',
    requires: { categorical_dim: true },
    chart_library: 'recharts',
  },
  {
    id: 'bar_horizontal',
    name: 'Barras horizontales',
    description: 'Rankings con labels largos en eje Y.',
    when_to_use: 'Top 10 con nombres extensos (productos, sucursales, vendedores).',
    requires: { categorical_dim: true },
    chart_library: 'recharts',
  },
  {
    id: 'bar_stacked',
    name: 'Barras apiladas',
    description: 'Composición de un total dividido por categoría sobre el tiempo.',
    when_to_use: 'Niños vs adultos por mes, métodos de pago por semana, categorías que suman al total.',
    requires: { has_time_series: true, categorical_dim: true },
    chart_library: 'recharts',
  },
  {
    id: 'donut_chart',
    name: 'Dona',
    description: 'Proporciones (3-7 categorías) con total al centro.',
    when_to_use: 'Mix de categorías que suman 100%. Evitar si hay más de 7 categorías.',
    requires: { categorical_dim: true, max_categories: 7 },
    chart_library: 'recharts',
  },
  {
    id: 'heatmap_grid',
    name: 'Heatmap bidimensional',
    description: 'Patrones por dos dimensiones (ej. día x hora).',
    when_to_use: 'Detectar horas pico, días fuertes, combinaciones óptimas.',
    requires: { two_categorical_dims: true },
    chart_library: 'custom',
  },
  {
    id: 'heatmap_calendar',
    name: 'Heatmap calendario',
    description: 'Intensidad por día tipo GitHub contributions.',
    when_to_use: 'Ver actividad diaria a lo largo del año.',
    requires: { has_daily_data: true },
    chart_library: 'react-calendar-heatmap',
  },
  {
    id: 'scatter_chart',
    name: 'Dispersión',
    description: 'Correlación entre 2 métricas continuas.',
    when_to_use: 'Ver si propina correlaciona con ticket total, precio con cantidad, etc.',
    requires: { metrics: 2 },
    chart_library: 'recharts',
  },
  {
    id: 'composed_chart',
    name: 'Compuesta (barras + líneas)',
    description: 'Combinar barras y líneas en mismo eje.',
    when_to_use: 'Ventas (barras) + ticket promedio (línea) en el mismo período.',
    requires: { metrics: 2, has_time_series: true },
    chart_library: 'recharts',
  },
  {
    id: 'sparkline',
    name: 'Sparkline',
    description: 'Mini-tendencia compacta sin ejes ni grid.',
    when_to_use: 'Embebida dentro de KPI cards. NO usar como widget standalone.',
    requires: { has_time_series: true },
    chart_library: 'recharts',
  },
  {
    id: 'gauge',
    name: 'Medidor / Gauge',
    description: 'Métrica vs rango target, estilo velocímetro.',
    when_to_use: 'Tasa de propina vs rango esperado, ocupación vs capacidad.',
    requires: { metric_has_range: true },
    chart_library: 'react-gauge-component',
  },
  {
    id: 'radial_bar',
    name: 'Barras radiales',
    description: 'Progreso vs meta o ranking visual elegante.',
    when_to_use: 'Cumplimiento de objetivos por sucursal/vendedor.',
    requires: { metric_has_target: true },
    chart_library: 'recharts',
  },
  {
    id: 'funnel_chart',
    name: 'Embudo',
    description: 'Conversión paso a paso.',
    when_to_use: 'Pipeline de ventas, conversión web, embudo de inventario.',
    requires: { sequential_data: true },
    chart_library: 'recharts',
  },
  {
    id: 'treemap',
    name: 'Mapa de árbol',
    description: 'Jerarquía con tamaño proporcional.',
    when_to_use: 'Categorías con sub-categorías y tamaños relativos.',
    requires: { hierarchical_data: true },
    chart_library: 'recharts',
  },
  {
    id: 'sankey',
    name: 'Diagrama de flujo (Sankey)',
    description: 'Flujos entre estados con grosor proporcional al volumen.',
    when_to_use: 'Inventario entradas/salidas, conversiones de estado.',
    requires: { flow_data: true },
    chart_library: 'recharts',
  },
  {
    id: 'data_table',
    name: 'Tabla de datos',
    description: 'Listado tabular con columnas y filas.',
    when_to_use: 'Detalles granulares (top 20 platillos, transacciones recientes).',
    requires: { tabular_data: true },
    chart_library: 'recharts',
  },
];

export const VALID_VISUALIZATION_TYPES = new Set(VISUALIZATION_CATALOG.map((v) => v.id));

export function compactCatalogForPrompt(): string {
  return VISUALIZATION_CATALOG.map((v) => {
    const reqs = Object.entries(v.requires)
      .map(([k, val]) => `${k}=${val}`)
      .join(', ');
    return `- "${v.id}" — ${v.name}\n    cuándo: ${v.when_to_use}\n    requiere: ${reqs || 'sin restricciones'}`;
  }).join('\n');
}
