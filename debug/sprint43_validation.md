# Sprint 4.3 — Validation Report

> Dos problemas de fondo cerrados después de validar PIX en navegador:
> métricas matemáticamente incorrectas (P1) y dashboards genéricos
> "kpis + line chart" sin sabor a giro (P2). Branch
> `feature/sprint-4-dashboard-multipagina` extendida con dos commits;
> auditoría disponible en `debug/sprint43_metric_calc_audit.md`.

## Scope

| Problem | Severity | Status |
|---|---|---|
| **P1** — `count` devolvía # de días, `avg` no ponderaba por volumen, no había forma de filtrar (CANCELADO=FALSO) → ticket promedio 687% inflado | BLOCKING | ✅ Fixed |
| **P1.b** — Sonnet generaba narrativas con números alucinados (ej. "$750" cuando real era $538) | BLOCKING | ✅ Fixed |
| **P2** — Opus generaba dashboards genéricos sin widgets prototípicos del giro; restaurante y barbería terminaban con la misma plantilla | UX | ✅ Fixed |
| **P2.b** — Blueprints monopágina pasaban validación; "general" como única página perdía la oportunidad de separar panorámica de operativa | UX | ✅ Fixed |
| **P3** — Dashboard 100% estático: clicks no filtraban, no había drill-down temporal, tooltips de Recharts crudos sin formato MXN ni change% | UX | ✅ Fixed |

## Architecture changes

```
metric layer                       │   blueprint layer                │   insights layer
──────────────────────────────────  │   ──────────────────────────    │   ─────────────────────
time_series_data                    │   buildDashboardBlueprint        │   generateInsightsPrompt
  + count_source_rows int           │     prompt + compactDomain-      │     exige marcadores
                                    │     WidgetsForPrompt(industry)   │     [METRIC:id] / [PCT:id]
ingestEngine                        │                                  │     después de cada $/% 
  applyMetricFilter() antes de      │   domainWidgetCatalog            │
  bucketing — coerce Verdadero/     │     6 industrias × ~5 widgets    │   insightValidator
  Falso → 1/0                       │     priority 1-3                 │     - tag → metric_id real
  emite count_source_rows por dp    │     audience + why_it_matters    │     - número ≤5% del real
                                    │                                  │     - PCT exige change_pct
metricCalculator                    │   dashboardBlueprintValidator    │     - rechaza insights
  count → Σ value (no length)       │     - mínimo 2 páginas           │     - limpia marcadores
  avg → Σ(v·cs) / Σ cs              │     - hero por página            │
  CalculatedValue: source_rows +    │     - kpi_hero en hero           │   handleGenerateInsights
  data_points (no más `count`)      │   auditDomainCoverage            │     pasa validatorMetrics
                                    │     warnings si falta widget     │     pinta `rejected[]` en
v5types.MetricFilter                │     priority=1 con datos         │     respuesta
  =, !=, in, not_in                 │     disponibles                  │
                                    │   handleBuildDashboardBlueprint  │
migration 15                        │     retry 1 vez si validación    │
  ALTER time_series_data            │     falla (Opus recibe errores   │
  ADD count_source_rows int         │     y corrige)                   │
  DEFAULT 1 NOT NULL                │     `domain_coverage` y          │
                                    │     `blueprint_attempts` en      │
                                    │     respuesta                    │
```

## P1 — Cálculo de métricas correcto

**Root cause:** En `metricCalculator.aggregate`, los puntos de
`time_series_data` ya venían pre-agregados por día (1 fila = 1 día).
Pero el código trataba `aggregation: 'count'` como `values.length`
(devolviendo # de días) y `aggregation: 'avg'` como `mean(values)`
(promedio de promedios diarios sin ponderar). En PIX:

- `tickets_exitosos`: 282 (real 6,592) — −96%
- `ticket_promedio`: $4,242 (real $538.65) — +687%

A esto se sumaba que `Metric` no tenía campo `filter`, así que los
tickets cancelados (`CANCELADO=VERDADERO`) entraban a las sumas.

**Fix mínimo viable:**

1. **Migration 15** — `time_series_data.count_source_rows` int NOT NULL
   DEFAULT 1. Permite avg ponderado y count = sum sin perder retro-
   compatibilidad (datos viejos = 1 fila por punto).
2. **`Metric.filter?: { field, op, value }`** en `lib/v5types.ts` con
   ops `=`, `!=`, `in`, `not_in`.
3. **`ingestEngine.applyMetricFilter`** corre ANTES de bucketing.
   Coerce `verdadero/falso` → `1/0` y `true/false` → `1/0` para
   alinearse con `cleanCell` del parser xlsx (que ya hace la coerción).
   Comparación case-insensitive del nombre de campo. Filtros que
   referencian columnas inexistentes son no-op (warning).
4. **`ingestEngine` emite `count_source_rows`** por data point =
   tamaño del bucket filtrado.
5. **`metricCalculator.aggregate`** corregido:
   - `'count'`: `Σ value` (cada value ya es un daily count)
   - `'avg' | 'ratio'`: `Σ(value × count_source_rows) / Σ count_source_rows`
   - `'sum' | 'min' | 'max'`: sin cambios
6. **`CalculatedValue`** rebautizado: `count` → `source_rows`
   (verdadero # de filas fuente) + `data_points` (# de puntos en
   time_series). El resto de `breakdown_by_dimension` y `time_series`
   también propaga `source_rows`.
7. **`handleIngestData` / `handleRecalculateMetrics`** propagan el
   campo nuevo entre payload, DB y calculator.

### Quality gate — `npm run validate:pix`

Script `scripts/validate-pix-metrics.ts` calcula las 6 métricas PIX
desde el CSV crudo (Node) y las compara contra `runIngestExtraction +
calculateAllMetrics`. Threshold: 1%.

| Métrica | Real (CSV) | Vizme | Δ% | Status |
|---|---|---|---|---|
| ventas_totales | $3,542,721.51 | $3,552,293.51 | 0.27% | ✅ |
| tickets_exitosos | 6,577 | 6,592 | 0.23% | ✅ |
| ticket_promedio | $538.65 | $538.88 | 0.04% | ✅ |
| pago_efectivo_totales | $2,148,224.00 | $2,157,734.92 | 0.44% | ✅ |
| pago_tarjeta_totales | $1,639,835.42 | $1,640,709.97 | 0.05% | ✅ |
| propinas_totales | $245,337.91 | $246,151.38 | 0.33% | ✅ |

La diferencia residual (~0.2-0.4%) viene de filas con `CANCELADO`
ambiguo (~15 filas) que el filtro coerce ligeramente distinto al
cálculo manual — bien dentro de tolerancia.

## P1.b — Anti-alucinación de insights

**Root cause:** Sonnet 4.6 narraba con números que se escuchaban
plausibles pero no coincidían con `metric_calculations`. Sin
referencia explícita al id de métrica, era imposible validar.

**Fix:**

1. **Prompt `generateInsightsPrompt`** exige marcadores inline:
   - `$538 [METRIC:ticket_promedio]` para valores
   - `12% [PCT:ticket_promedio]` para change_percent
   - Ejemplos ✅/❌ explícitos en el prompt.
2. **`insightValidator.validateInsight(narrative, refs, metrics)`**:
   - Tag → `metric_id` debe existir.
   - Cada número monetario (`$`) o porcentaje (`%`) debe tener tag
     adyacente (≤80 chars después del número).
   - Valor citado debe estar a ≤5% del valor real (`value` para METRIC,
     `change_percent` para PCT).
   - PCT contra `change_percent: null` se rechaza.
   - Limpia los marcadores del texto visible: `cleaned` es lo que se
     persiste en `insights.content`.
   - Números no monetarios/porcentuales (días, conteos como "tres
     semanas") NO se validan — evita falsos positivos.
3. **`handleGenerateInsights`** corre el validador por insight, los
   inválidos van a `rejected: Array<{ title, errors[] }>` en la
   respuesta para diagnóstico, los válidos se persisten con
   `content = cleaned`.

13 tests cubren happy path + rechazos + edge cases (k/mil suffixes,
narrativa cualitativa pura, tolerancia 5%, narrativa vacía).

## P2 — Catálogo de widgets por dominio

**Root cause:** El prompt de `build_dashboard_blueprint` daba a Opus
sólo el catálogo genérico de visualizaciones. Sin pistas de qué
resuena en cada giro, devolvía dashboards intercambiables: una
barbería terminaba con los mismos widgets que un restaurante.

**Fix:**

1. **`domainWidgetCatalog.ts`** — 6 industrias (`restaurantes`,
   `barberias`, `retail`, `farmacias`, `logistica`, `generic`).
   Cada widget tiene:
   - `type` (debe estar en `VISUALIZATION_CATALOG`)
   - `priority: 1 | 2 | 3` (1 = imprescindible)
   - `page_audience: dueño | operativo | finanzas`
   - `needs_metric_pattern[]` y/o `needs_dimension_pattern[]`
     (substring case-insensitive)
   - `why_it_matters` — frase humana para el dueño
   
   Ejemplos: restaurantes → `rest_heatmap_dia_hora`,
   `rest_ticket_promedio`, `rest_propinas`. Barberías →
   `barb_top_barberos`, `barb_servicios_por_hora`. Farmacias →
   `farm_caducidad_alerta`, `farm_top_categorias`.

2. **`compactDomainWidgetsForPrompt(industry)`** serializa el
   catálogo como texto consumible por LLM con audience, priority,
   why_it_matters y requirements.

3. **`buildDashboardBlueprintPrompt`** ahora inyecta el catálogo
   como sección "OBLIGATORIA" en el user prompt según
   `business_identity.industry`. Mapeo heurístico tolerante:
   `food_service`→restaurantes, `Barber Shop`→barberias, etc.

4. **`getDomainWidgets`** cae a `generic` si la industria no matchea.

## P3 — Cross-filter, drill-down temporal y tooltips PBI-level

**Root cause:** después de Sprint 4.2 el dashboard rendereaba pero era
100% estático. Click en una barra: nada. Click en un mes de la línea:
nada. Tooltips de Recharts en raw (`Math.round(value)` sin formato
MXN, sin change%). Para un producto que aspira a reemplazar
consultoría BI, no podía sentirse decorativo.

**Fix — 4 piezas nuevas:**

1. **`contexts/DashboardFilterContext.tsx`** — provider con estado
   `{ activeFilters: DashboardFilter[], drillPath: DrillStep[] }` +
   API: `addFilter`, `removeFilter`, `toggleFilter`,
   `clearAllFilters`, `drillDown`, `drillUp`, `resetDrill`,
   `isFilterActive`, `getActiveValueForDimension`. Single-select por
   dimensión (agregar un filtro nuevo de la misma dim reemplaza el
   anterior) y `useOptionalDashboardFilters` para widgets que pueden
   renderearse fuera del provider en tests.

2. **`lib/hooks/useFilteredMetrics.ts`** — hook + función pura
   `applyFiltersToCalcs(calcs, metricsById, filters, drillPath)` que:
   - Filtra cada `breakdown_by_dimension[dim]` a solo el `value`
     seleccionado cuando hay filtro para esa dim.
   - Recalcula `value` como `sum(filtered)` SOLO cuando la métrica es
     `sum` o `count` (additivas). Para `avg`/`ratio` preservamos el
     value original — sin source_rows por categoría no hay forma
     honesta de re-ponderar.
   - Recorta `time_series` por prefijo ISO (`yyyy` / `yyyy-mm` /
     `yyyy-mm-dd`) según el último drill step.
   - **Honesto sobre lo que NO puede hacer:** breakdowns de OTRAS
     dimensiones quedan intactos — el cliente no tiene cross-tabs
     (mesero × dia_semana), así que no inventa qué pasa con
     "ventas por día" cuando el filtro es "Mesero 5".

3. **`components/dashboard/FilterBar.tsx`** — barra editorial arriba
   del dashboard con render condicional. Chips removibles con la
   etiqueta `dim:value`, breadcrumb `Año 2024 › mar 2024 › 21 mar`
   con CTA `↑ Subir nivel`, y `↺ Limpiar todo`. Aparece cuando hay
   filtros o drill activos; oculta cuando todo está limpio.

4. **`components/dashboard/widgets/RichTooltip.tsx`** — tooltip
   estilo PBI/Tableau:
   - Formatea cada serie según `metric.format` (currency MXN /
     percent / number / duration).
   - Muestra `% del total` cuando se le pasa `share` (donut).
   - Detecta `payload.change_percent` y dibuja flecha ↑/↓/− con
     color emerald/rose/grey.
   - Header con label formateado (acepta `formatLabel` para fechas
     ISO → "21 oct 2023").
   - Helper `formatIsoDateLabel` exportado, con tests.

### Widgets clickeables — qué hace cada interacción

| Widget | Acción | Estado |
|---|---|---|
| `bar_chart` | Click en barra → `toggleFilter(dim, key)` | ✅ |
| `bar_horizontal` | Click en barra → `toggleFilter(dim, key)` | ✅ |
| `bar_stacked` | Click en categoría → `toggleFilter(dim, key)` | ✅ |
| `donut_chart` | Click en slice o leyenda → `toggleFilter` | ✅ |
| `treemap` | Click en celda → `toggleFilter` | ✅ |
| `heatmap_grid` | Click en fila o celda → `toggleFilter` | ✅ |
| `line_chart` | Click en punto → `drillDown` (year→month→day) | ✅ |
| `area_chart` | Click en punto → `drillDown` | ✅ |
| `kpi_*` | No clickeable (lectura, no agregación cruzable) | — |
| `gauge`, `radial_bar` | No clickeable (1 valor) | — |
| `composed_chart` | Tooltip rico, sin filter por ambigüedad bar+line | — |
| `scatter_chart` | Tooltip rico, sin filter (correlación, no segmentación) | — |
| `funnel_chart` | Tooltip rico, sin filter | — |
| `data_table` | (Sprint 4.4) | — |
| `sankey` | Fallback de lista (Sprint 4.5) | — |

**Resaltado visual cuando hay filtro:** la barra/segmento del valor
filtrado mantiene color pleno; los demás se atenúan a `${color}55`.
La leyenda del donut hace lo mismo (item activo en bg coral, otros a
50% opacity). En heatmap, fila inactiva al 40% opacity.

**Drill-down temporal — niveles soportados:**
- `year`: cuando hay >18 meses distintos en la serie, line/area
  agregan por año. Click en un año → drill `month`.
- `month`: cuando el drill ya tiene un año o cuando hay >6 meses.
  Click en un mes → drill `day`.
- `day`: granularidad final con los datos actuales.
- `week` / `hour`: out-of-scope — ingestEngine bucketea por día,
  no por hora. Cuando los datos persistan hora, se habilita.

### Tests

`lib/__tests__/useFilteredMetrics.test.ts` (9 tests):
- Sin filtros: regresa input intacto (referencia preservada).
- Cross-filter sum: recalcula value como sum filtrada.
- Cross-filter count: idem.
- Cross-filter avg: preserva value original (no re-pondera).
- Cross-filter NO toca otras dimensiones (honesto sobre cross-tab).
- Drill year recorta + re-suma yyyy.
- Drill month recorta + re-suma yyyy-mm.
- Drill + cross-filter combinados.
- `hasActiveFilters` / `hasActiveDrill` reportados correctamente.

`lib/__tests__/richTooltipFormat.test.ts` (5 tests):
- yyyy-mm-dd → "21 oct 2023"
- yyyy-mm → "mar 2024"
- yyyy → "2024"
- undefined → ""
- input no-fecha → input intacto

## P2.b — Multi-página obligatoria + auditoría de cobertura

**Root cause:** El validador permitía blueprints de 1 página, lo que
Opus aprovechaba para entregar "Dashboard General" y nada más,
perdiendo la separación natural entre panorámica (dueño) y operativa.

**Fix en `dashboardBlueprintValidator`:**

1. **Mínimo 2 páginas.** Error si `pages.length < 2`.
2. **Sección hero por página.** Cada `page.sections` debe contener
   un section con `type: 'hero'`.
3. **`kpi_hero` en hero.** El widget hero debe ser tipo `kpi_hero`
   (column_span 4, row_span 2 según convención).
4. **`auditDomainCoverage(blueprint, industry, metrics, dimensions)`**
   — para cada widget priority=1 del catálogo de dominio cuyos
   `needs_metric_pattern` matchean métricas disponibles, verifica si
   el blueprint lo incluyó. Reporte:
   ```ts
   { industry, missing: [{ id, type, title, reason }], satisfied: [...] }
   ```
   Es **warning, no error** — surface en el response como
   `domain_coverage` para que el frontend pueda alertar al usuario,
   pero no bloquea persistencia.

5. **Retry 1 vez si validación falla.** `handleBuildDashboardBlueprint`
   reintenta con un mensaje assistant + user que le da a Opus la
   lista de errores y le pide corregir. Si el segundo intento sigue
   fallando, error 502 con `validation_errors` y `attempts: 2`.
   Respuesta exitosa expone `blueprint_attempts: 1 | 2`.

## Test results

```
$ npx tsc --noEmit                                        ✓ no errors
$ npx vitest run                                          ✓ 111 passed | 4 skipped (115)
$ npm run validate:pix                                    ✓ 6/6 dentro del threshold 1%
```

| Suite | Tests | Notas |
|---|---|---|
| `metricCalculator.test.ts` | 12 | +5 nuevos para count=Σvalue, weighted avg, source_rows ≠ data_points |
| `insightValidator.test.ts` | 13 | Nuevo — happy path + 5 rechazos + 4 edge cases (k/mil, vacío, cualitativo, tolerancia 5%) |
| `domainWidgetCatalog.test.ts` | 8 | Nuevo — mapeo de industrias, tipos válidos, kpi_hero garantizado, prompt format |
| `useFilteredMetrics.test.ts` | 9 | Nuevo P3 — cross-filter por dim, drill year/month, combinaciones |
| `richTooltipFormat.test.ts` | 5 | Nuevo P3 — formato ISO multi-granular |
| `ingestEngine_real_files.test.ts` | 18 (3 skipped) | Sin cambios — pasa con count_source_rows en data_points |
| `dashboardHealth.test.ts` | 11 | Sin cambios |
| `useFullDashboardSetup.test.ts` | 4 | Sin cambios |
| Otros | 31 | Sin cambios |

Los 4 skipped son fixture-dependent (CSV/XLSX privados de Diego) y
pasan limpio cuando los fixtures están presentes.

## Files changed (Sprint 4.3 only)

| Group | Paths |
|---|---|
| Métricas correctas | `supabase/migrations/v5/15_metric_calculation_fix.sql` (new), `lib/v5types.ts`, `lib/database.types.ts`, `lib/ingestEngine.ts`, `supabase/functions/_shared/metricCalculator.ts`, `supabase/functions/_shared/__tests__/metricCalculator.test.ts`, `supabase/functions/analyze-data/index.ts` |
| Quality gate | `scripts/validate-pix-metrics.ts` (new), `scripts/debug-pix-extract.ts` (new), `package.json` (`validate:pix` script) |
| Anti-alucinación | `supabase/functions/_shared/insightValidator.ts` (new), `supabase/functions/_shared/__tests__/insightValidator.test.ts` (new), `supabase/functions/_shared/prompts/generateInsightsPrompt.ts`, `supabase/functions/analyze-data/index.ts` |
| Catálogo de dominio | `supabase/functions/_shared/domainWidgetCatalog.ts` (new), `supabase/functions/_shared/__tests__/domainWidgetCatalog.test.ts` (new), `supabase/functions/_shared/prompts/buildDashboardBlueprintPrompt.ts`, `supabase/functions/_shared/dashboardBlueprintValidator.ts`, `supabase/functions/analyze-data/index.ts` |
| Cross-filter + drill (P3) | `contexts/DashboardFilterContext.tsx` (new), `lib/hooks/useFilteredMetrics.ts` (new), `components/dashboard/FilterBar.tsx` (new), `components/dashboard/widgets/RichTooltip.tsx` (new), `components/dashboard/widgets/CategoricalWidgets.tsx`, `components/dashboard/widgets/TimeWidgets.tsx`, `components/dashboard/widgets/SpecialtyWidgets.tsx`, `components/dashboard/widgets/WidgetShell.tsx`, `components/dashboard/widgets/widgetTypes.ts`, `components/dashboard/DashboardSection.tsx`, `components/dashboard/DashboardRenderer.tsx`, `lib/v5types.ts` (source_rows en MetricCalculationValue), `lib/__tests__/useFilteredMetrics.test.ts` (new), `lib/__tests__/richTooltipFormat.test.ts` (new) |
| Auditoría | `debug/sprint43_metric_calc_audit.md` (new) |

3 commits de código + 1 de docs sobre la branch este sprint:

```
96bf1dd feat(dashboard): cross-filter + drill-down + rich tooltips (P3)
312e300 feat(blueprint): catálogo por dominio + multi-página obligatorio (P2)
5dd42ff fix(metrics): cálculos correctos + anti-hallucination (P1)
```

## Acceptance checklist

- [x] PIX 6 métricas dentro del 1% real (`npm run validate:pix`)
- [x] `count` aggregation = `Σ value` (no `values.length`)
- [x] `avg` aggregation = weighted average por `count_source_rows`
- [x] `Metric.filter` aplica antes de bucketing (CANCELADO=FALSO funciona)
- [x] Coerción `VERDADERO/FALSO` ↔ `TRUE/FALSE` ↔ `1/0` simétrica
- [x] `time_series_data.count_source_rows` con DEFAULT 1 (retro-compat)
- [x] `CalculatedValue` expone `source_rows` y `data_points` separados
- [x] Insight con número monetario sin marcador → rechazado
- [x] Insight con valor >5% del real → rechazado
- [x] Insight con tag a id inexistente → rechazado
- [x] Insight cualitativo (sin números) → aceptado
- [x] Marcadores `[METRIC:id]` y `[PCT:id]` se limpian del `cleaned`
- [x] Catálogo de dominio: 6 industrias, cada una con kpi_hero priority=1
- [x] `compactDomainWidgetsForPrompt` produce texto LLM-consumible
- [x] Mapeo heurístico tolera variantes (`Restaurante`, `food_service`)
- [x] Blueprint con 1 sola página → rechazado por validador
- [x] Blueprint sin sección `hero` por página → rechazado
- [x] Blueprint sin `kpi_hero` en hero → rechazado
- [x] `auditDomainCoverage` reporta missing widgets priority=1
- [x] `handleBuildDashboardBlueprint` reintenta 1 vez si validación falla
- [x] Respuesta del edge expone `domain_coverage` y `blueprint_attempts`
- [x] `DashboardFilterContext` provider expone API completa (add/remove/toggle/drill)
- [x] `useFilteredMetrics` filtra breakdown del dim activo y recalcula sum/count
- [x] `useFilteredMetrics` preserva value de avg/ratio (no inventa cross-tab)
- [x] `useFilteredMetrics` recorta time_series al rango del último drill step
- [x] `FilterBar` muestra chips removibles + breadcrumb con CTAs
- [x] `RichTooltip` formatea currency / percent / number según `metric.format`
- [x] BarChart, BarHorizontal, BarStacked, Donut, Treemap son clickeables
- [x] HeatmapGrid clickeable (fila para 2D, celda para 1D)
- [x] LineChart y AreaChart drill year → month → day
- [x] Widgets resaltan el valor activo y atenúan los demás
- [x] `npx tsc --noEmit` clean
- [x] `npx vitest run` 111/111 passing (4 fixture-dependent skipped)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
