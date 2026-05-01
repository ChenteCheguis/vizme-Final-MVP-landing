# Sprint 4 — Dashboard Multi-Página Foundation (Camino C)

> Editorial multi-page dashboard generation, narrative insights with Sonnet 4.6,
> and a 19-widget catalog rendered without ever touching a Tableau-style grid.

## What this ships

**Sin esto:** un usuario que termina el wizard se queda con un schema y unos
archivos cargados — pero no hay dashboard. La pantalla del proyecto solo dice
"tu dashboard llega en el siguiente sprint".

**Con esto:** Opus 4.7 lee el schema, decide en cuántas páginas dividir el
dashboard, y emite un blueprint v2 con secciones (`hero`, `chart_grid`,
`insight_card`) y widgets (de 19 tipos). Un cálculo puro-JS produce los
totales por período y los persiste en `metric_calculations`. Sonnet 4.6
escribe 3-5 insights narrativos por página, en español mexicano accesible.
El usuario aterriza en una experiencia editorial — display serif, números
grandes, insights tipo magazine.

## Architecture overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  ProjectDashboardPage                                               │
│   └─ DashboardSection                                               │
│       ├─ useDashboardData (loads bp + calcs + insights)             │
│       ├─ State machine: blueprint? → calcs? → render                │
│       └─ DashboardRenderer                                          │
│           ├─ PageNav (tabs)                                         │
│           ├─ PageBody                                               │
│           │   ├─ Section (hero/kpi_row/chart_grid)                  │
│           │   │   └─ DashboardWidgetView dispatch                   │
│           │   │       ↓                                             │
│           │   │     19 widget impls → recharts / heatmap / gauge    │
│           │   └─ InsightCard × N (per page)                         │
│           └─ PeriodPicker                                           │
└─────────────────────────────────────────────────────────────────────┘
                          ↑
                          │  Edge Function: analyze-data (Deno)
                          │
   ┌──────────────────────┴───────────────────────────────────────┐
   │  build_dashboard_blueprint  → Opus 4.7  → blueprint v2       │
   │  recalculate_metrics        → pure JS   → metric_calculations│
   │  generate_insights          → Sonnet 4.6→ insights × page    │
   └──────────────────────────────────────────────────────────────┘
```

## Migrations

- **11_dashboard_blueprints_v2.sql** — adds `pages JSONB`,
  `sophistication_level CHECK`, `total_widgets`, model + token metadata.
  Legacy `blocks` + `layout` columns kept for back-compat.
- **12_metric_calculations.sql** — new cache table with
  `UNIQUE(project_id, metric_id, period)`, RLS scoped to project owner.
- **13_insights_v2.sql** — adds `page_id`, `metric_references JSONB`, and
  expands `insights_type_check` to allow `opportunity`/`risk`/`trend`.

## Edge Function: 3 new modes

```ts
type Mode =
  | 'build_dashboard_blueprint'  // Opus 4.7 with prompt cache
  | 'recalculate_metrics'        // pure-JS aggregator, no LLM cost
  | 'generate_insights';         // Sonnet 4.6 with temperature 0.3
```

Highlights:
- `build_dashboard_blueprint` validates Opus output against the visualization
  catalog + known metric/dimension IDs before persisting. Fails 502 with
  structured `validation_errors` instead of silently saving garbage.
- `recalculate_metrics` anchors the reference date at `max(period_start)` of
  the time series — so a project with 2023 fixtures still produces a
  populated `last_month` window.
- `generate_insights` walks the page's widgets to collect
  `metric_ids` and only loads the calcs for those metrics — keeps Sonnet
  prompts compact.

## Widgets (19)

| Family | Components |
|---|---|
| KPIs | `kpi_hero`, `kpi_card`, `sparkline` |
| Time | `line_chart`, `area_chart`, `composed_chart`, `heatmap_calendar` |
| Categorical | `bar_chart`, `bar_horizontal`, `bar_stacked`, `donut_chart`, `treemap` |
| Specialty | `scatter_chart`, `gauge`, `radial_bar`, `funnel_chart`, `heatmap_grid`, `sankey` |
| Tabular | `data_table` |

`bar_stacked`, `heatmap_grid`, and `sankey` render fallback views (single-dim
bars / list) until Sprint 4.5 introduces bidimensional breakdown calculation.
The dispatcher (`components/dashboard/widgets/index.tsx`) is the single
source of truth for widget.type → component mapping.

## Editorial design adherence

- **No Tableau-grid.** Hero section is 1 large KPI + 3 supporting cards, then
  chart grids with insight footers.
- **Display serif (Fraunces) for titles, JetBrains Mono for numbers,
  Inter body.** All present already in the design system; the dashboard uses
  the existing tokens.
- **Mexican Spanish copy throughout.** "Cómo va tu negocio", "Tus viernes",
  "Tu pregunta original" — never "Sales Performance KPIs".
- **Skeleton loader is editorial** — placeholder blocks evoke the final
  layout (hero + 3 cards + chart grid + insights).

## Tests

```
$ npx vitest run
Test Files  7 passed (7)
     Tests  45 passed | 1 skipped (46)
```

New suites:
- `metricCalculator.test.ts` — 11 tests: aggregations, change_pct,
  good_direction, time_series gating, breakdown ordering.
- `visualizationCatalog.test.ts` — 7 tests: 19 entries, unique ids,
  prompt format includes every type.

## Test plan

- [ ] Open `/projects/<id>` for a project that already has a schema.
- [ ] Click **"Generar dashboard con Opus"**, wait ~30 s. Editorial dashboard
      renders with multi-page nav and KPI hero.
- [ ] Click **"Calcular métricas"** if banner shows. Numbers populate.
- [ ] Switch periods (`PeriodPicker`); KPIs/cards update without reload.
- [ ] Switch pages (`PageNav`) on a `medium`/`complex` blueprint.
- [ ] Click **"Regenerar insights"** on a page; 3-5 narrative cards appear.
- [ ] Confirm `bar_stacked`/`heatmap_grid`/`sankey` show graceful fallback
      (no JS errors).
- [ ] Hard reload — skeleton appears for ~1 s before render.

## Known debt

1. Bundle is 2.2 MB (gzipped 568 kB) — code-splitting the dashboard route is
   pending for Sprint 4.5.
2. Bidimensional breakdown (dim × time) not yet computed — three widget types
   render fallbacks. Tracked for Sprint 4.5.
3. Cross-filtering between widgets is not implemented (deferred per scope).
4. PeriodPicker selection does not persist across reloads.

## Cost envelope (PIX, 6593 rows, 12 metrics)

| Op | Model | Approx cost |
|---|---|---|
| `build_schema` | Opus 4.7 | $1.50 |
| `build_dashboard_blueprint` | Opus 4.7 (cached) | $0.20 |
| `recalculate_metrics` | none | $0.00 |
| `generate_insights × 3 pages` | Sonnet 4.6 | $0.06 |
| **Total per fresh project** | | **~$1.76** |

Plan Pro at $999 MXN/mes (~$58 USD): margin >97 %.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
