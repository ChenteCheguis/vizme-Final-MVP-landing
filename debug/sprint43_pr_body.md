# Sprint 4.3 — Métricas correctas, anti-alucinación e identidad por dominio

> Después de Sprint 4.2 el dashboard ya rendereaba con health banner.
> Validando con PIX (6,593 filas reales de un restaurante) salió el
> siguiente clavo: las métricas centrales estaban matemáticamente
> mal y los insights de Sonnet alucinaban números. Encima, Opus
> entregaba dashboards genéricos sin pistas de giro. Sprint 4.3
> cierra los tres frentes.

---

## Qué shipea esta extensión

**Sin esto:** un usuario PyME sube su archivo, ve que su ticket
promedio dice **$4,242** cuando manualmente sabe que es $538 (687%
inflado). Pierde confianza al instante. Encima, los insights le
hablan de "tu venta promedio diaria de $3.5M" cuando ese número en
realidad es la suma total del año. El dashboard se ve igual que el
de cualquier otro negocio — kpis + line chart + tabla — sin sabor
a restaurante / barbería / farmacia.

**Con esto:** el quality gate `npm run validate:pix` exige que las 6
métricas PIX caigan dentro del 1% del cálculo manual desde el CSV.
Opus recibe un catálogo de widgets prototípicos del giro y arma
dashboards que resuenan ("¿a qué hora cierra mi viernes fuerte?",
"¿qué barbero vende más por hora?"). Sonnet aprende a citar cada
número con un marcador `[METRIC:id]` y un validador rechaza
narrativas que se desvíen >5% del valor real.

---

## Cuatro frentes en una branch

| Frente | Tema | Commits |
|---|---|---|
| **Métricas correctas** | count = Σvalue, avg ponderado, filter pre-bucketing | `5dd42ff` |
| **Anti-alucinación** | Marcadores `[METRIC]/[PCT]` exigidos en insights, validador 5% | `5dd42ff` |
| **Identidad por dominio** | Catálogo 6 industrias, multi-página obligatoria, audit + retry | `312e300` |
| **Interactividad (P3)** | Cross-filter, drill-down temporal, RichTooltip PBI-level | `96bf1dd` |

---

## Architecture

```
┌─ ingestEngine (frontend)                                                    ┐
│   runIngestExtraction(file, schema)                                         │
│     ├─ parseDescriptorToColumn (Sprint 4.2: longest-overlap match)          │
│     ├─ detectDateFormat (per-column D/M/Y vs M/D/Y)                         │
│     ├─ applyMetricFilter ← Sprint 4.3 (CANCELADO=FALSO antes de bucketing)  │
│     └─ for each bucket: emit { period_start, value, count_source_rows }    │
│       ↓                                                                     │
│   POST analyze-data?mode=ingest_data                                        │
│     INSERT time_series_data { value, count_source_rows }                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                  ↓
┌─ analyze-data?mode=recalculate_metrics                                      ┐
│   metricCalculator.calculateAllMetrics                                      │
│     aggregate(window, how)                                                  │
│       sum   → Σ value                                                       │
│       count → Σ value             ← Sprint 4.3 (era values.length)         │
│       avg   → Σ(value × cs) / Σcs ← Sprint 4.3 (era mean of means)         │
│     CalculatedValue: { source_rows, data_points, ... }                     │
│       ↓ UPSERT metric_calculations                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                  ↓
┌─ analyze-data?mode=build_dashboard_blueprint                                ┐
│   prompt = system + buildUserPrompt({ schema, dataSummary })                │
│     ↳ user prompt incluye compactDomainWidgetsForPrompt(industry)           │
│        ← Sprint 4.3: catálogo restaurantes/barberias/retail/farmacias/      │
│          logistica/generic con priority 1-3 + why_it_matters                │
│   while (!valid && attempts < 2):       ← Sprint 4.3: retry con feedback    │
│     callClaude(opus-4-7, ...)                                               │
│     validateDashboardBlueprint:                                             │
│       - mínimo 2 páginas                ← Sprint 4.3                        │
│       - hero por página + kpi_hero      ← Sprint 4.3                        │
│       - metric_ids / dimension_ids reales                                   │
│   auditDomainCoverage(blueprint, industry, metrics, dimensions)             │
│     ← warning, no bloquea                                                   │
│   INSERT dashboard_blueprints                                               │
│   response = { blueprint_id, domain_coverage, blueprint_attempts, ... }     │
└─────────────────────────────────────────────────────────────────────────────┘
                                  ↓
┌─ analyze-data?mode=generate_insights (per page)                             ┐
│   prompt exige marcadores [METRIC:id] / [PCT:id]   ← Sprint 4.3             │
│   callClaude(sonnet-4-6, ...)                                               │
│   for each insight:                                                         │
│     v = validateInsight(narrative, refs, metrics_summary)                   │
│       - tag → metric_id real                                                │
│       - número monetario/porcentaje exige tag adyacente                     │
│       - valor citado ≤5% del real                                           │
│       - PCT exige change_percent !== null                                   │
│     if (!v.valid) push to rejected[]                                        │
│     else INSERT insights { content: v.cleaned }                             │
│   response = { insights_created, insights, rejected, ... }                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Migrations

- **15_metric_calculation_fix.sql** — `time_series_data.count_source_rows`
  int NOT NULL DEFAULT 1. Permite avg ponderado y count = Σvalue sin
  perder retro-compat (datos viejos = 1 fila por punto).

Sin migraciones nuevas en el segundo commit (`312e300`) — el catálogo
de dominio es código puro.

---

## Cambios — métricas correctas

### Bug raíz

`metricCalculator.aggregate` trataba mal dos casos:

```ts
// ANTES (Sprint 4.0 → 4.2)
case 'count': return values.length;             // # de días, no tickets
case 'avg':   return mean(values);              // promedio de promedios
```

En PIX (282 días con tickets, 6,592 tickets totales):
- `tickets_exitosos`: 282 (real 6,592) → −96%
- `ticket_promedio`: $4,242 (real $538.65) → +687%

Encima, no había forma de filtrar tickets cancelados — `Metric` no
tenía campo `filter`, sólo `formula` (texto que el motor ignoraba).

### Fix

1. **`time_series_data.count_source_rows`** — # de filas fuente que
   se agregaron en el bucket diario.
2. **`Metric.filter?: { field, op, value }`** — `=`, `!=`, `in`, `not_in`.
3. **`ingestEngine.applyMetricFilter`** ANTES de bucketing. Coerce
   `Verdadero/Falso ↔ True/False ↔ 1/0` simétrico con `cleanCell`.
4. **Cada `IngestDataPoint` emite `count_source_rows = bucket.length`.**
5. **`metricCalculator.aggregate` corregido:**
   - `count` → `Σ value`
   - `avg | ratio` → `Σ(value × cs) / Σ cs`
6. **`CalculatedValue`** rebautizado: `count` → `source_rows` (verdadero
   # de filas fuente) + `data_points` (# de buckets). El antiguo
   `count` confundía las dos cosas.

### Quality gate

```bash
$ npm run validate:pix
```

| Métrica | Real | Vizme | Δ |
|---|---|---|---|
| ventas_totales | $3,542,721.51 | $3,552,293.51 | 0.27% |
| tickets_exitosos | 6,577 | 6,592 | 0.23% |
| ticket_promedio | $538.65 | $538.88 | **0.04%** |
| pago_efectivo | $2,148,224.00 | $2,157,734.92 | 0.44% |
| pago_tarjeta | $1,639,835.42 | $1,640,709.97 | 0.05% |
| propinas | $245,337.91 | $246,151.38 | 0.33% |

Todas dentro del 1%. El script hace `exit 1` si CUALQUIER métrica sale
fuera de tolerancia → bloquea PRs futuras.

---

## Cambios — anti-alucinación

### Bug raíz

Sonnet 4.6 inventaba números plausibles. Al usuario le decía
"tu ticket subió a $750" cuando el real era $538. Sin referencia al
id de métrica, era imposible auditar al validador.

### Fix

1. **Prompt** exige marcadores inline:
   - `$538 [METRIC:ticket_promedio]` para valores
   - `12% [PCT:ticket_promedio]` para change_percent
2. **`insightValidator.validateInsight(narrative, refs, metrics)`**
   regla por regla:
   - Tag → `metric_id` debe existir en `metrics`.
   - Cada número monetario (`$`) o porcentaje (`%`) debe tener tag
     adyacente (≤80 chars después del número).
   - Valor citado dentro del 5% del real.
   - PCT contra `change_percent: null` se rechaza.
   - Limpia los marcadores: `cleaned` es el texto que se persiste.
3. **`handleGenerateInsights`** rechaza inválidos a `rejected[]` y
   persiste sólo los válidos.

Insights cualitativos sin números siguen pasando ("tus viernes están
rindiendo más fuerte"). Números no monetarios/porcentuales ("3 semanas
seguidas") no se validan — evita falsos positivos.

13 tests cubren happy path + 5 rechazos + edge cases (k/mil suffix,
narrativa vacía, narrativa cualitativa, tolerancia 5%).

---

## Cambios — interactividad (P3)

### Bug raíz

Después de Sprint 4.2 el dashboard rendereaba bien pero era 100%
estático. Click en una barra: nada. Click en mes de la línea: nada.
Tooltips de Recharts crudos sin formato MXN ni change%. Para un
producto que aspira a reemplazar consultoría BI, no podía sentirse
decorativo.

### Fix — 4 piezas nuevas

1. **`contexts/DashboardFilterContext.tsx`** — provider con
   `{ activeFilters, drillPath }` + `addFilter`, `removeFilter`,
   `toggleFilter`, `clearAllFilters`, `drillDown`, `drillUp`,
   `resetDrill`, `isFilterActive`, `getActiveValueForDimension`.
   Single-select por dimensión. `useOptionalDashboardFilters` para
   widgets renderizables fuera del provider.

2. **`lib/hooks/useFilteredMetrics.ts`** — hook + función pura
   `applyFiltersToCalcs`:
   - Filtra `breakdown_by_dimension[dim]` al value seleccionado.
   - Recalcula `value` como `Σ filtered` para `sum`/`count`.
   - Preserva `value` original para `avg`/`ratio` (sin source_rows
     por categoría no podemos re-ponderar honestamente).
   - Recorta `time_series` por prefijo ISO según drill step.
   - **No inventa cross-tabs** — breakdowns de OTRAS dimensiones
     quedan intactos cuando hay un filtro de mesero.

3. **`components/dashboard/FilterBar.tsx`** — chips removibles
   (`mesero: Mesero 5 ✕`) + breadcrumb temporal
   (`Año 2024 › mar 2024`) + CTAs `↑ Subir nivel` y `↺ Limpiar
   todo`. Render condicional: oculto cuando todo está limpio.

4. **`components/dashboard/widgets/RichTooltip.tsx`** — tooltip
   PBI-level:
   - Formatea cada serie según `metric.format` (currency MXN /
     percent / number / duration).
   - `share` opcional para `% del total` en donuts.
   - `formatLabel` para fechas ISO → "21 oct 2023".
   - Detecta `change_percent` con flecha emerald/rose.

### Widgets clickeables

| Widget | Acción | Implementado |
|---|---|---|
| `bar_chart`, `bar_horizontal`, `bar_stacked` | `toggleFilter(dim, key)` | ✅ |
| `donut_chart` (slice + leyenda) | `toggleFilter` | ✅ |
| `treemap` (cell) | `toggleFilter` | ✅ |
| `heatmap_grid` (fila/celda) | `toggleFilter` | ✅ |
| `line_chart`, `area_chart` (point) | `drillDown` year→month→day | ✅ |
| `kpi_*`, `gauge`, `radial_bar` | — (1 valor, no segmentable) | n/a |
| `composed_chart`, `scatter`, `funnel` | Tooltip rico, no filter | parcial |

**Resaltado visual:** valor filtrado en color pleno, otros a
`${color}55` (~30% opacity). Donut leyenda: item activo en
bg coral, otros 50%. Heatmap fila inactiva 40%.

**Drill-down temporal** — niveles soportados con datos diarios:
- `year`: agrega por año cuando la serie cubre >18 meses.
- `month`: cuando hay >6 meses o ya hay un año en el path.
- `day`: granularidad final.
- `week` / `hour`: out-of-scope hasta que ingest persista hora.

### Tests P3

- `useFilteredMetrics.test.ts` (9): cross-filter sum/count/avg, drill
  year/month, combinaciones, hasActive flags.
- `richTooltipFormat.test.ts` (5): formato ISO multi-granular.

## Cambios — identidad por dominio

### Bug raíz

El prompt de blueprint sólo le daba a Opus el catálogo genérico de
visualizaciones. Sin pistas del giro, el resultado era
intercambiable: una barbería terminaba con la misma plantilla que un
restaurante. Encima, el validador permitía blueprints monopágina.

### Fix

1. **`domainWidgetCatalog.ts`** — 6 industrias, cada widget con:
   - `type` (debe estar en `VISUALIZATION_CATALOG`)
   - `priority: 1 | 2 | 3`
   - `page_audience: dueño | operativo | finanzas`
   - `needs_metric_pattern[]` y/o `needs_dimension_pattern[]`
   - `why_it_matters` — frase humana

   Ejemplos:
   - **restaurantes**: heatmap día×hora, ticket promedio, propinas, mezcla de pago
   - **barberias**: top barberos, citas por hora, mezcla de servicios, recurrencia
   - **retail**: AOV, top SKUs, mezcla de categorías, rotación
   - **farmacias**: recetas surtidas, top categorías terapéuticas, stock próximo a caducar
   - **logistica**: entregas, % on-time, costo por km, top rutas
   - **generic**: kpi_hero, tendencia, top categorías

2. **`compactDomainWidgetsForPrompt(industry)`** serializa el catálogo
   como texto LLM-consumible.

3. **Prompt** lo inyecta como sección "OBLIGATORIA": "si las
   métricas/dimensiones existen, INCLÚYELO."

4. **Mapeo heurístico** tolera variantes:
   `food_service`/`Restaurante` → restaurantes,
   `Barber Shop` → barberias, etc.

### Validador con dientes (Sprint 4.3)

```ts
// dashboardBlueprintValidator.ts
- pages.length >= 2
- cada page debe tener section type='hero'
- el hero debe contener un widget type='kpi_hero'
```

Más:

5. **`auditDomainCoverage(bp, industry, metrics, dimensions)`** —
   warnings (no bloquea) cuando un widget priority=1 del catálogo
   tiene sus métricas/dimensiones disponibles pero no fue incluido.
   Reporte expuesto como `domain_coverage` en respuesta.

6. **Retry 1 vez si validación falla.** `handleBuildDashboardBlueprint`
   reintenta con un mensaje assistant + user que le da a Opus la lista
   de errores y le pide corregir. Respuesta expone
   `blueprint_attempts: 1 | 2`.

---

## Tests

```
$ npx tsc --noEmit                            ✓ no errors
$ npx vitest run                              ✓ 111 passed | 4 skipped
$ npm run validate:pix                        ✓ 6/6 dentro del 1%
```

| Suite | Tests | Notas |
|---|---|---|
| `metricCalculator.test.ts` | 12 | +5 nuevos para count=Σ, weighted avg, source_rows |
| `insightValidator.test.ts` | 13 | Nuevo |
| `domainWidgetCatalog.test.ts` | 8 | Nuevo |
| `useFilteredMetrics.test.ts` | 9 | Nuevo P3 |
| `richTooltipFormat.test.ts` | 5 | Nuevo P3 |
| `ingestEngine_real_files.test.ts` | 18 (3 skipped) | Sin cambios |
| `dashboardHealth.test.ts` | 11 | Sin cambios |
| `useFullDashboardSetup.test.ts` | 4 | Sin cambios |
| Otros | 31 | Sin cambios |

---

## Files changed

```
debug/sprint43_metric_calc_audit.md                          (new) +220
debug/sprint43_validation.md                                 (new)
debug/sprint43_manual_test.md                                (new)
debug/sprint43_pr_body.md                                    (new — este archivo)

supabase/migrations/v5/15_metric_calculation_fix.sql         (new) +18

lib/v5types.ts                                               +12
lib/database.types.ts                                        +3
lib/ingestEngine.ts                                          +68 / -3
scripts/validate-pix-metrics.ts                              (new) +277
scripts/debug-pix-extract.ts                                 (new) +59
package.json                                                 +1 (validate:pix)

supabase/functions/_shared/metricCalculator.ts               +160 / -82
supabase/functions/_shared/insightValidator.ts               (new) +224
supabase/functions/_shared/domainWidgetCatalog.ts            (new) +466
supabase/functions/_shared/dashboardBlueprintValidator.ts    +118 / -10
supabase/functions/_shared/prompts/buildDashboardBlueprintPrompt.ts  +55 / -32
supabase/functions/_shared/prompts/generateInsightsPrompt.ts +22 / -1
supabase/functions/analyze-data/index.ts                     +167 / -82

supabase/functions/_shared/__tests__/metricCalculator.test.ts          +31 / -8
supabase/functions/_shared/__tests__/insightValidator.test.ts          (new) +136
supabase/functions/_shared/__tests__/domainWidgetCatalog.test.ts       (new) +68

# P3 — Cross-filter, drill-down, RichTooltip
contexts/DashboardFilterContext.tsx                                    (new) +148
lib/hooks/useFilteredMetrics.ts                                        (new) +180
components/dashboard/FilterBar.tsx                                     (new) +84
components/dashboard/widgets/RichTooltip.tsx                           (new) +145
components/dashboard/widgets/CategoricalWidgets.tsx                    rewrite
components/dashboard/widgets/TimeWidgets.tsx                           rewrite
components/dashboard/widgets/SpecialtyWidgets.tsx                      +60 / -20
components/dashboard/widgets/WidgetShell.tsx                           +6 / -1
components/dashboard/widgets/widgetTypes.ts                            +3
components/dashboard/DashboardSection.tsx                              +6 / -1
components/dashboard/DashboardRenderer.tsx                             +13 / -4
lib/v5types.ts                                                         +12 (source_rows en MetricCalculationValue)
lib/__tests__/useFilteredMetrics.test.ts                               (new) +220
lib/__tests__/richTooltipFormat.test.ts                                (new) +33
```

---

## Acceptance checklist

- [x] PIX 6/6 métricas dentro del 1% real (`npm run validate:pix`)
- [x] Migration 15 idempotente (`ADD COLUMN IF NOT EXISTS`)
- [x] `count_source_rows` con DEFAULT 1 — datos viejos siguen funcionando
- [x] `count` aggregation = `Σ value` (no `values.length`)
- [x] `avg` aggregation = weighted avg por `count_source_rows`
- [x] `Metric.filter` aplicado antes de bucketing
- [x] Coerción `VERDADERO/FALSO ↔ TRUE/FALSE ↔ 1/0` simétrica
- [x] `CalculatedValue.source_rows` ≠ `data_points`
- [x] Insight con número sin marcador → rechazado
- [x] Insight con valor >5% del real → rechazado
- [x] Marcadores se limpian del texto persistido
- [x] Catálogo de dominio: 6 industrias × kpi_hero priority=1
- [x] Mapeo heurístico tolera variantes (`Restaurante`, `food_service`)
- [x] Blueprint <2 páginas → rechazado
- [x] Blueprint sin hero / sin kpi_hero → rechazado
- [x] `auditDomainCoverage` reporta missing widgets
- [x] Retry 1 vez si Opus falla validación
- [x] `domain_coverage` y `blueprint_attempts` en respuesta del edge
- [x] `DashboardFilterContext` provider funcional (add/remove/toggle/drill)
- [x] `useFilteredMetrics` filtra breakdown del dim activo
- [x] `useFilteredMetrics` recalcula sum/count, preserva avg/ratio
- [x] `useFilteredMetrics` recorta time_series según drill
- [x] `FilterBar` con chips + breadcrumb + CTAs
- [x] `RichTooltip` formatea según `metric.format` (currency, percent, etc.)
- [x] BarChart, BarHorizontal, BarStacked, Donut, Treemap clickeables
- [x] HeatmapGrid clickeable (fila/celda)
- [x] LineChart y AreaChart drill year → month → day
- [x] Resaltado visual de valor activo + atenuación de inactivos
- [x] `npx tsc --noEmit` clean
- [x] `npx vitest run` 111/111 passing

---

## Out of scope (Sprint 4.4 o posterior)

- `count_distinct(ID_CHEQUE)` — por ahora cada fila ES un ticket, así
  que daily count ≈ count_distinct. Datasets con duplicados requieren
  set-based aggregation.
- `rate` / `avg_daily` como tipo de agregación de primera clase.
  Por ahora se modela como métrica derivada en widgets.
- `ratio` con dos métricas (ej. propinas/ventas) — hoy se calcula en
  el widget combinando dos `metric_calculations`.
- Catálogo de dominio para giros adicionales (servicios profesionales,
  educación, manufactura, e-commerce). Hoy caen a `generic`.
- Validador anti-alucinación para narrativas largas con múltiples
  números — la heurística "tag dentro de 80 chars" puede fallar con
  oraciones muy elaboradas.
- **Cross-tabs reales** (mesero × día_semana, mesero × hora). Hoy el
  filtro por dim sólo afecta widgets que usan ESA dim. Para cross-
  filter "Mesero 5 ¿qué hace los sábados?" requiere persistir
  `cross_tabs_by_dimension` en metric_calculations — Sprint 4.4.
- **Drill semana / hora.** El ingestEngine bucketea por día. Cuando
  los datos persistan hora, se habilitan más niveles.
- **Comparación lado a lado** (split view comparando mesero A vs B).
  Documentado en spec original como "opcional si tiempo permite";
  diferido a Sprint 4.5.
- **Filtros persistentes via URL.** Hoy viven en React state — refresh
  los borra. Útil para compartir vistas filtradas, queda para 4.4.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
