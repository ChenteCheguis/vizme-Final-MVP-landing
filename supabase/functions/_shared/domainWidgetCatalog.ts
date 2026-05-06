// ============================================================
// VIZME V5 — Sprint 4.3 domain widget catalog
//
// Cada industria tiene widgets PROTOTÍPICOS que un dueño espera
// ver. Sin este catálogo, Opus inventa dashboards genéricos
// "kpis + line chart + tabla". Con él, recomienda análisis que
// resuenan ("¿a qué hora cierra mi viernes fuerte?", "¿qué barbero
// rinde más por hora?", "¿qué SKU rota más rápido?").
//
// Uso:
//   const widgets = getDomainWidgets('restaurantes');
//   // Pasa esto a build_dashboard_blueprint como "considera
//   // siempre estos widgets si los datos lo permiten".
// ============================================================

export type Industry =
  | 'restaurantes'
  | 'barberias'
  | 'retail'
  | 'farmacias'
  | 'logistica'
  | 'generic';

export interface DomainWidgetTemplate {
  id: string; // único dentro del catálogo de la industria
  type: string; // debe existir en VISUALIZATION_CATALOG
  title: string;
  description: string;
  page_audience: string; // 'dueño' | 'operativo' | 'finanzas'
  // Pistas para inferir si el widget es viable con los datos disponibles:
  needs_metric_pattern?: string[]; // alguno debe matchear (substring case-insensitive)
  needs_dimension_pattern?: string[];
  needs_time_series?: boolean;
  priority: 1 | 2 | 3; // 1=imprescindible, 3=opcional
  // Razón humana para mostrar al dueño (tooltip):
  why_it_matters: string;
}

const RESTAURANTES: DomainWidgetTemplate[] = [
  {
    id: 'rest_ventas_hero',
    type: 'kpi_hero',
    title: 'Ventas del período',
    description: 'Total facturado en tickets no cancelados.',
    page_audience: 'dueño',
    needs_metric_pattern: ['ventas', 'venta_total', 'facturacion'],
    priority: 1,
    why_it_matters: 'La métrica que el dueño revisa primero cada mañana.',
  },
  {
    id: 'rest_ticket_promedio',
    type: 'kpi_card',
    title: 'Ticket promedio',
    description: 'Promedio por cuenta. Subir 10% = +10% ingresos sin más clientes.',
    page_audience: 'dueño',
    needs_metric_pattern: ['ticket_promedio', 'avg_ticket', 'cuenta_promedio'],
    priority: 1,
    why_it_matters: 'El KPI más maleable del negocio. Combos, sugerencias y maridajes lo mueven.',
  },
  {
    id: 'rest_tickets_count',
    type: 'kpi_card',
    title: 'Tickets servidos',
    description: 'Cuentas no canceladas en el período.',
    page_audience: 'dueño',
    needs_metric_pattern: ['tickets', 'transacciones', 'ordenes'],
    priority: 1,
    why_it_matters: 'Junto al ticket promedio, te dice si subes por más clientes o más gasto.',
  },
  {
    id: 'rest_ventas_por_dia',
    type: 'bar_chart',
    title: 'Ventas por día de la semana',
    description: 'Identifica los días fuertes para reforzar staff.',
    page_audience: 'operativo',
    needs_metric_pattern: ['ventas'],
    needs_dimension_pattern: ['dia_semana', 'weekday', 'dia'],
    priority: 1,
    why_it_matters: 'El patrón semanal no cambia. Saber qué viernes vale como tres lunes guía staffing.',
  },
  {
    id: 'rest_heatmap_dia_hora',
    type: 'heatmap_grid',
    title: 'Mapa de calor día x hora',
    description: 'Detecta horas pico por día de la semana.',
    page_audience: 'operativo',
    needs_metric_pattern: ['ventas', 'tickets'],
    needs_dimension_pattern: ['hora', 'hour'],
    priority: 1,
    why_it_matters: 'La diferencia entre staffing genérico y staffing exacto: $$ ahorrados o ingresos perdidos.',
  },
  {
    id: 'rest_propinas',
    type: 'kpi_card',
    title: 'Tasa de propina',
    description: 'Propinas / ventas — proxy de satisfacción.',
    page_audience: 'operativo',
    needs_metric_pattern: ['propina', 'tip'],
    priority: 2,
    why_it_matters: 'Sube cuando el servicio mejora. Buen termómetro mensual.',
  },
  {
    id: 'rest_pago_mix',
    type: 'donut_chart',
    title: 'Mezcla de métodos de pago',
    description: 'Efectivo vs tarjeta vs transferencia.',
    page_audience: 'finanzas',
    needs_metric_pattern: ['pago', 'efectivo', 'tarjeta'],
    priority: 2,
    why_it_matters: 'Define necesidad de cambio en caja, comisiones bancarias y conciliación.',
  },
  {
    id: 'rest_tendencia_ventas',
    type: 'line_chart',
    title: 'Tendencia de ventas',
    description: 'Curva diaria del período visible.',
    page_audience: 'dueño',
    needs_metric_pattern: ['ventas'],
    needs_time_series: true,
    priority: 1,
    why_it_matters: 'Ver si vas para arriba o para abajo, sin abrir Excel.',
  },
  {
    id: 'rest_top_meseros',
    type: 'bar_horizontal',
    title: 'Top meseros por ventas',
    description: 'Ranking del período.',
    page_audience: 'operativo',
    needs_metric_pattern: ['ventas', 'tickets'],
    needs_dimension_pattern: ['mesero', 'waiter', 'empleado'],
    priority: 2,
    why_it_matters: 'Identifica al staff que vende más para replicar su técnica con el resto.',
  },
];

const BARBERIAS: DomainWidgetTemplate[] = [
  {
    id: 'barb_ingresos_hero',
    type: 'kpi_hero',
    title: 'Ingresos del período',
    description: 'Total cobrado en servicios.',
    page_audience: 'dueño',
    needs_metric_pattern: ['ingresos', 'ventas', 'cobrado'],
    priority: 1,
    why_it_matters: 'Línea base del negocio.',
  },
  {
    id: 'barb_servicios_count',
    type: 'kpi_card',
    title: 'Servicios realizados',
    description: 'Total de cortes/servicios en el período.',
    page_audience: 'dueño',
    needs_metric_pattern: ['servicios', 'citas', 'cortes', 'appointments'],
    priority: 1,
    why_it_matters: 'Volumen base de operación — no medible solo por ingresos.',
  },
  {
    id: 'barb_ticket_promedio',
    type: 'kpi_card',
    title: 'Ticket promedio por servicio',
    description: 'Cuánto deja en promedio cada cliente.',
    page_audience: 'dueño',
    needs_metric_pattern: ['ticket_promedio', 'avg_servicio'],
    priority: 1,
    why_it_matters: 'Subir esto = vender productos extras (cera, beard oil, paquetes).',
  },
  {
    id: 'barb_top_barberos',
    type: 'bar_horizontal',
    title: 'Top barberos por servicios',
    description: 'Ranking de productividad por barbero.',
    page_audience: 'operativo',
    needs_metric_pattern: ['servicios', 'cortes'],
    needs_dimension_pattern: ['barbero', 'estilista', 'empleado'],
    priority: 1,
    why_it_matters: 'Decide turnos, comisiones y ascensos.',
  },
  {
    id: 'barb_servicios_por_hora',
    type: 'heatmap_grid',
    title: 'Citas por día y hora',
    description: 'Detecta horas saturadas y muertas.',
    page_audience: 'operativo',
    needs_metric_pattern: ['servicios', 'citas'],
    needs_dimension_pattern: ['hora'],
    priority: 1,
    why_it_matters: 'Optimiza horarios y abre/cierra slots con datos en mano.',
  },
  {
    id: 'barb_mix_servicios',
    type: 'donut_chart',
    title: 'Mezcla de servicios',
    description: 'Corte, barba, paquete, color.',
    page_audience: 'dueño',
    needs_metric_pattern: ['servicios', 'ingresos'],
    needs_dimension_pattern: ['tipo_servicio', 'servicio', 'producto'],
    priority: 2,
    why_it_matters: 'Identifica qué servicios pueden empujarse en paquetes.',
  },
  {
    id: 'barb_recurrencia',
    type: 'kpi_card',
    title: 'Tasa de clientes recurrentes',
    description: 'Clientes que regresaron en el período.',
    page_audience: 'dueño',
    needs_metric_pattern: ['recurrente', 'returning', 'repeat'],
    priority: 2,
    why_it_matters: 'Negocio sano = >60% recurrencia. Alerta temprana de fuga de clientes.',
  },
];

const RETAIL: DomainWidgetTemplate[] = [
  {
    id: 'ret_ventas_hero',
    type: 'kpi_hero',
    title: 'Ventas del período',
    description: 'Facturación total.',
    page_audience: 'dueño',
    needs_metric_pattern: ['ventas'],
    priority: 1,
    why_it_matters: 'La métrica de cierre de mes.',
  },
  {
    id: 'ret_aov',
    type: 'kpi_card',
    title: 'Ticket promedio (AOV)',
    description: 'Valor promedio de carrito.',
    page_audience: 'dueño',
    needs_metric_pattern: ['ticket_promedio', 'aov', 'carrito_promedio'],
    priority: 1,
    why_it_matters: 'Cross-sell y upsell mueven esta aguja directamente.',
  },
  {
    id: 'ret_top_skus',
    type: 'bar_horizontal',
    title: 'Top SKUs por ventas',
    description: 'Productos que más venden.',
    page_audience: 'operativo',
    needs_metric_pattern: ['ventas', 'unidades'],
    needs_dimension_pattern: ['sku', 'producto', 'articulo'],
    priority: 1,
    why_it_matters: 'Decide reposición y espacio en anaquel.',
  },
  {
    id: 'ret_categoria_mix',
    type: 'donut_chart',
    title: 'Ventas por categoría',
    description: 'Mix de categorías de producto.',
    page_audience: 'dueño',
    needs_metric_pattern: ['ventas'],
    needs_dimension_pattern: ['categoria', 'category'],
    priority: 2,
    why_it_matters: 'Identifica categorías sub-explotadas.',
  },
  {
    id: 'ret_inventario_rotacion',
    type: 'kpi_card',
    title: 'Rotación de inventario',
    description: 'Veces que se vendió el inventario en el período.',
    page_audience: 'operativo',
    needs_metric_pattern: ['rotacion', 'turnover', 'inventario'],
    priority: 2,
    why_it_matters: 'Stock parado = capital muerto. Rotación alta = eficiencia operativa.',
  },
];

const FARMACIAS: DomainWidgetTemplate[] = [
  {
    id: 'farm_ventas_hero',
    type: 'kpi_hero',
    title: 'Ventas del período',
    description: 'Facturación total.',
    page_audience: 'dueño',
    needs_metric_pattern: ['ventas'],
    priority: 1,
    why_it_matters: 'KPI matriz del negocio.',
  },
  {
    id: 'farm_recetas_count',
    type: 'kpi_card',
    title: 'Recetas surtidas',
    description: 'Total de prescripciones procesadas.',
    page_audience: 'operativo',
    needs_metric_pattern: ['recetas', 'prescripciones'],
    priority: 1,
    why_it_matters: 'Volumen real de operación clínica.',
  },
  {
    id: 'farm_top_categorias',
    type: 'bar_horizontal',
    title: 'Top categorías terapéuticas',
    description: 'Cuáles mueven más ingreso.',
    page_audience: 'dueño',
    needs_metric_pattern: ['ventas'],
    needs_dimension_pattern: ['categoria', 'terapeutic', 'familia'],
    priority: 1,
    why_it_matters: 'Decide compras al laboratorio y promociones estacionales.',
  },
  {
    id: 'farm_caducidad_alerta',
    type: 'data_table',
    title: 'Stock próximo a caducar',
    description: 'Lotes que vencen en los próximos 30-60 días.',
    page_audience: 'operativo',
    needs_metric_pattern: ['stock', 'inventario', 'caducidad'],
    priority: 1,
    why_it_matters: 'Pérdidas por merma son evitables si se sacan a promoción a tiempo.',
  },
  {
    id: 'farm_ventas_dia_hora',
    type: 'heatmap_grid',
    title: 'Ventas por día y hora',
    description: 'Detecta picos para reforzar staff.',
    page_audience: 'operativo',
    needs_metric_pattern: ['ventas', 'recetas'],
    needs_dimension_pattern: ['hora'],
    priority: 2,
    why_it_matters: 'Las farmacias 24h tienen patrones nocturnos muy específicos.',
  },
];

const LOGISTICA: DomainWidgetTemplate[] = [
  {
    id: 'log_entregas_hero',
    type: 'kpi_hero',
    title: 'Entregas completadas',
    description: 'Total del período.',
    page_audience: 'dueño',
    needs_metric_pattern: ['entregas', 'deliveries', 'rutas_completadas'],
    priority: 1,
    why_it_matters: 'Volumen base que sostiene la facturación.',
  },
  {
    id: 'log_on_time_pct',
    type: 'kpi_card',
    title: '% Entregas a tiempo',
    description: 'On-time delivery rate.',
    page_audience: 'operativo',
    needs_metric_pattern: ['on_time', 'puntualidad', 'a_tiempo'],
    priority: 1,
    why_it_matters: 'KPI estrella del cliente B2B. <95% = pérdida de cuenta.',
  },
  {
    id: 'log_costo_por_km',
    type: 'kpi_card',
    title: 'Costo por kilómetro',
    description: 'Costo operativo / km recorrido.',
    page_audience: 'finanzas',
    needs_metric_pattern: ['costo', 'cost_per_km'],
    priority: 1,
    why_it_matters: 'Margen operativo se gana o pierde aquí.',
  },
  {
    id: 'log_top_rutas',
    type: 'bar_horizontal',
    title: 'Top rutas por volumen',
    description: 'Las que mueven más entregas.',
    page_audience: 'operativo',
    needs_metric_pattern: ['entregas', 'volumen'],
    needs_dimension_pattern: ['ruta', 'route', 'zona'],
    priority: 2,
    why_it_matters: 'Optimización de flota se concentra en las rutas troncales.',
  },
  {
    id: 'log_utilizacion_flota',
    type: 'gauge',
    title: 'Utilización de flota',
    description: '% de unidades activas vs disponibles.',
    page_audience: 'operativo',
    needs_metric_pattern: ['utilizacion', 'flota'],
    priority: 2,
    why_it_matters: 'Flota subutilizada = capital ocioso.',
  },
];

const GENERIC: DomainWidgetTemplate[] = [
  {
    id: 'gen_main_hero',
    type: 'kpi_hero',
    title: 'Métrica principal',
    description: 'KPI matriz del negocio.',
    page_audience: 'dueño',
    needs_metric_pattern: [],
    priority: 1,
    why_it_matters: 'Toda página debería abrir con el número que importa.',
  },
  {
    id: 'gen_trend',
    type: 'line_chart',
    title: 'Tendencia',
    description: 'Evolución temporal del KPI.',
    page_audience: 'dueño',
    needs_time_series: true,
    needs_metric_pattern: [],
    priority: 1,
    why_it_matters: 'Ver si vas para arriba o abajo.',
  },
  {
    id: 'gen_breakdown',
    type: 'bar_horizontal',
    title: 'Top categorías',
    description: 'Ranking de la dimensión más informativa.',
    page_audience: 'dueño',
    needs_metric_pattern: [],
    needs_dimension_pattern: [],
    priority: 2,
    why_it_matters: 'Identifica qué segmento mueve la aguja.',
  },
];

const CATALOG: Record<Industry, DomainWidgetTemplate[]> = {
  restaurantes: RESTAURANTES,
  barberias: BARBERIAS,
  retail: RETAIL,
  farmacias: FARMACIAS,
  logistica: LOGISTICA,
  generic: GENERIC,
};

export function getDomainWidgets(industry: string | undefined | null): DomainWidgetTemplate[] {
  if (!industry) return CATALOG.generic;
  const norm = String(industry).toLowerCase().trim();
  // Mapeos heurísticos comunes:
  if (norm.includes('restaurant') || norm.includes('comida') || norm.includes('food')) {
    return CATALOG.restaurantes;
  }
  if (norm.includes('barber') || norm.includes('estetica') || norm.includes('salon')) {
    return CATALOG.barberias;
  }
  if (norm.includes('retail') || norm.includes('tienda') || norm.includes('boutique')) {
    return CATALOG.retail;
  }
  if (norm.includes('farmacia') || norm.includes('pharmacy') || norm.includes('botica')) {
    return CATALOG.farmacias;
  }
  if (norm.includes('logistic') || norm.includes('transport') || norm.includes('delivery')) {
    return CATALOG.logistica;
  }
  return CATALOG.generic;
}

export function compactDomainWidgetsForPrompt(industry: string | undefined | null): string {
  const widgets = getDomainWidgets(industry);
  return widgets
    .map((w) => {
      const m = w.needs_metric_pattern?.length
        ? `metrics~[${w.needs_metric_pattern.join('|')}]`
        : '';
      const d = w.needs_dimension_pattern?.length
        ? `dim~[${w.needs_dimension_pattern.join('|')}]`
        : '';
      const t = w.needs_time_series ? 'time_series=true' : '';
      const reqs = [m, d, t].filter(Boolean).join(', ');
      return `- "${w.id}" → ${w.type} | "${w.title}" | audience=${w.page_audience} | priority=${w.priority}\n    cuándo: ${w.why_it_matters}\n    requiere: ${reqs || 'sin restricciones'}`;
    })
    .join('\n');
}

export const ALL_INDUSTRIES: Industry[] = [
  'restaurantes',
  'barberias',
  'retail',
  'farmacias',
  'logistica',
  'generic',
];
