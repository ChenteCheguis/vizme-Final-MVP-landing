# Sprint 4 + 4.1 — Editorial Multi-Page Dashboard, End-to-End

> Wizard → schema → ingest → metrics → blueprint → insights, in one
> orchestrated chain. Editorial multi-page rendering with 19 widget types,
> sub-route navigation per project, cascade delete on files. No "próximo
> sprint" placeholders left in the user-facing UI.

---

## What this branch ships

**Sin esto:** un usuario que termina el wizard se queda con un schema y un
archivo cargado — pero el dashboard sale vacío. La UI muestra mensajes
técnicos ("requiere breakdown bidimensional") en widgets que no tienen
implementación. El proyecto entero vive en una sola página de scroll.

**Con esto:** el wizard mismo dispara la cadena completa
(`ingest_data → recalculate_metrics → build_dashboard_blueprint → generate_insights`)
con UX progresiva en español. El proyecto se navega como app — sub-rutas
`/dashboard`, `/schema`, `/files` con sidebar permanente. Los widgets
muestran datos reales o mensajes editoriales — nunca jerga de implementación.

## Two sprints, one branch

| Sprint | Theme | Scope |
|---|---|---|
| **4.0** | Editorial multi-page dashboard foundation | Opus 4.7 blueprint generation, 19 widgets, 3 edge function modes, metric_calculations cache, Sonnet 4.6 insights |
| **4.1** | Critical post-validation fixes | Auto-ingest chain, sub-routes, real bar_stacked + heatmap_grid, editorial fallbacks |

This consolidated PR ships both. They share the same migrations and edge
function — splitting would create churn for no benefit.

---

## Architecture

```
┌─ Wizard (Step4Review)                                                       ┐
│   └─ runFullDashboardSetup({ projectId, fileId, schemaId, file, schema })   │
│        ├─ 1. ingest_data        (runIngestExtraction local + edge)          │
│        ├─ 2. recalculate_metrics                                            │
│        ├─ 3. build_dashboard_blueprint                                      │
│        └─ 4. generate_insights × N pages (parallel, non-blocking)           │
│   → navigate('/projects/<id>/dashboard')                                    │
└─────────────────────────────────────────────────────────────────────────────┘

┌─ /projects/:id (ProjectLayout, 240px sidebar)                               ┐
│   ├─ /dashboard → ProjectDashboardPage                                      │
│   │     └─ DashboardSection                                                 │
│   │         ├─ useDashboardData (loads bp + calcs + insights)               │
│   │         ├─ State machine: blueprint? → calcs? → render                  │
│   │         └─ DashboardRenderer                                            │
│   │             ├─ PageNav (tabs)                                           │
│   │             ├─ PageBody                                                 │
│   │             │   ├─ Section (hero/kpi_row/chart_grid)                    │
│   │             │   │   └─ DashboardWidgetView dispatch                     │
│   │             │   │       ↓                                               │
│   │             │   │     19 widget impls → recharts / heatmap / gauge      │
│   │             │   └─ InsightCard × N (per page)                           │
│   │             └─ PeriodPicker                                             │
│   ├─ /schema    → ProjectSchemaPage   (entities, metrics, dimensions)       │
│   └─ /files     → ProjectFilesPage    (history + cascade delete)            │
└─────────────────────────────────────────────────────────────────────────────┘
                          ↑
                          │  Edge Function: analyze-data (Deno)
                          │
   ┌──────────────────────┴───────────────────────────────────────┐
   │  build_schema               → Opus 4.7  → business_schemas   │
   │  ingest_data                → pure JS   → time_series_data   │
   │  build_dashboard_blueprint  → Opus 4.7  → blueprint v2       │
   │  recalculate_metrics        → pure JS   → metric_calculations│
   │  generate_insights          → Sonnet 4.6→ insights × page    │
   └──────────────────────────────────────────────────────────────┘
```

---

## Migrations (Sprint 4)

- **11_dashboard_blueprints_v2.sql** — adds `pages JSONB`,
  `sophistication_level CHECK`, `total_widgets`, model + token metadata.
  Legacy `blocks` + `layout` columns kept for back-compat.
- **12_metric_calculations.sql** — new cache table with
  `UNIQUE(project_id, metric_id, period)`, RLS scoped to project owner.
- **13_insights_v2.sql** — adds `page_id`, `metric_references JSONB`, and
  expands `insights_type_check` to allow `opportunity`/`risk`/`trend`.

No new migrations in 4.1 — the cascade delete relies on existing
`ON DELETE CASCADE` between `files → time_series_data`.

---

## Edge Function — 5 modes

```ts
type Mode =
  | 'build_schema'                // Opus 4.7 (existing)
  | 'ingest_data'                 // pure-JS, accepts extractions[] from client
  | 'build_dashboard_blueprint'   // Opus 4.7 with prompt cache (Sprint 4)
  | 'recalculate_metrics'         // pure-JS aggregator, no LLM cost (Sprint 4)
  | 'generate_insights';          // Sonnet 4.6, temperature 0.3 (Sprint 4)
```

Highlights:
- `ingest_data` accepts `extractions` (built locally by `runIngestExtraction`)
  — keeps the LLM cost on `build_schema` and lets ingestion be deterministic.
- `build_dashboard_blueprint` validates Opus output against the visualization
  catalog + known metric/dimension IDs before persisting. Fails 502 with
  structured `validation_errors` instead of silently saving garbage.
- `recalculate_metrics` anchors the reference date at `max(period_start)` of
  the time series — so a project with 2023 fixtures still produces a
  populated `last_month` window.
- `generate_insights` walks the page's widgets to collect `metric_ids` and
  only loads the calcs for those metrics — keeps Sonnet prompts compact.

---

## Orchestration hook (Sprint 4.1 keystone)

`lib/hooks/useFullDashboardSetup.ts` — the post-wizard chain.

```ts
runFullDashboardSetup(options): Promise<FullSetupResult>

Stages: ingesting → calculating → designing → writing_insights → done
        (or → error with failedStep)
```

- **No arbitrary timeouts.** Each step awaits the edge function's natural
  completion.
- **Insights are non-blocking.** Failures on 1+ pages do not block the
  dashboard render — `insightsFailed` count surfaces in `stats`.
- **Failure modes are typed.** `failedStep: SetupStage` lets the UI show a
  stage-specific Spanish error and a retry button.

---

## Widgets — 19 (now real)

| Family | Components |
|---|---|
| KPIs | `kpi_hero`, `kpi_card`, `sparkline` |
| Time | `line_chart`, `area_chart`, `composed_chart`, `heatmap_calendar` |
| Categorical | `bar_chart`, `bar_horizontal`, **`bar_stacked`**, `donut_chart`, `treemap` |
| Specialty | `scatter_chart`, `gauge`, `radial_bar`, `funnel_chart`, **`heatmap_grid`**, `sankey` |
| Tabular | `data_table` |

**Sprint 4.1 upgrades:**
- **`bar_stacked`** now renders real Recharts stacked bars, one `<Bar>`
  per metric in `widget.metric_ids`, all sharing `stackId="vizme-stack"`.
- **`heatmap_grid`** with 2+ metrics renders a true matrix
  (rows = top categories, columns = metrics, color intensity per metric).
  With 1 metric, falls back to the existing color-coded grid.
- **All "próximo sprint" / "breakdown bidimensional" copy removed.**

`sankey` still renders a list-of-flows fallback because it requires true
flow_data not yet emitted by the calculator. Its empty state copy is
editorial.

The dispatcher (`components/dashboard/widgets/index.tsx`) is the single
source of truth for `widget.type → component` mapping.

---

## Sub-route navigation (Sprint 4.1)

```tsx
<Route path="/projects/:id" element={<ProjectLayout />}>
  <Route index element={<Navigate to="dashboard" replace />} />
  <Route path="dashboard" element={<ProjectDashboardPage />} />
  <Route path="schema" element={<ProjectSchemaPage />} />
  <Route path="files" element={<ProjectFilesPage />} />
</Route>
```

- `ProjectLayout` owns a 240 px permanent sidebar with active route
  highlighted by a coral border-left.
- `AppLayout` detects `/projects/[^/]+` and hides its global sidebar so
  the project sidebar owns the left rail without doubling up.
- Browser back/forward works naturally.
- `ProjectFilesPage` wires cascade delete:
  `storage.remove → files.delete (DB cascade) → invoke recalculate_metrics`.

---

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
- **Zero technical jargon in widget empty states** (Sprint 4.1).

---

## Tests

```
$ npx tsc --noEmit          ✓ no errors
$ npx vitest run
  Test Files  8 passed (8)
       Tests  48 passed | 1 skipped (49)
```

Suites:
- `metricCalculator.test.ts` — 11 tests: aggregations, change_pct,
  good_direction, time_series gating, breakdown ordering. _(Sprint 4)_
- `visualizationCatalog.test.ts` — 7 tests: 19 entries, unique ids,
  prompt format includes every type. _(Sprint 4)_
- `useFullDashboardSetup.test.ts` — 3 tests: happy path, failure at
  `calculating`, partial insights failure (still success). _(Sprint 4.1)_
- All Sprint 1–3 suites still passing untouched.

---

## Tooling

```bash
npm run test:analyze -- --mode full-setup --file ./your.csv --hint "..."
```

Runs the entire chain end-to-end (schema → ingest → metrics → blueprint →
insights), printing per-stage timings and counts. Cleans up afterwards
on prompt.

---

## Test plan

### P1 — Wizard chain
- [ ] Complete the wizard with a real CSV. After Step 4 → click "Construir mi dashboard". 4 stage messages appear in Spanish, then `/projects/<id>/dashboard` loads with real numbers.
- [ ] Force an `ingest_data` failure (e.g. revoke token) → stage-specific error + Reintentar.
- [ ] Force a single insight failure → dashboard renders, banner notes the missing insight.

### P2 — Sub-routes
- [ ] Click into a project → 240 px sidebar appears, default route is `/dashboard`.
- [ ] Navigate to `/schema` → entities/metrics/dimensions/rules render editorially.
- [ ] Navigate to `/files` → table with rows_extracted column. Delete a file → confirmation modal in Spanish, then row + storage + time_series gone, metrics recalculated, toast "Archivo eliminado".
- [ ] Browser back/forward navigates between sub-routes correctly.
- [ ] Direct deep-link `/projects/<id>/schema` works on hard reload.

### P3 — Widgets
- [ ] Find a `bar_stacked` widget on the rendered dashboard → real stacked bars, hover tooltip shows all metric values.
- [ ] Find a `heatmap_grid` with 2+ metrics → matrix table renders.
- [ ] Force an empty state on any widget → message is editorial Spanish, never mentions sprints/jargon.

### Sprint 4 baseline (still valid)
- [ ] Open `/projects/<id>/dashboard` for a project with a schema. Click "Generar dashboard con Opus" if banner shows. Editorial dashboard renders with multi-page nav and KPI hero.
- [ ] Click "Calcular métricas" if banner shows. Numbers populate.
- [ ] Switch periods (`PeriodPicker`); KPIs/cards update without reload.
- [ ] Switch pages (`PageNav`) on a `medium`/`complex` blueprint.
- [ ] Click "Regenerar insights" on a page; 3-5 narrative cards appear.
- [ ] Hard reload — skeleton appears for ~1 s before render.

---

## Known debt (deferred)

1. Bundle is 2.2 MB (gzipped 568 kB) — code-splitting the dashboard route is
   pending for Sprint 4.5.
2. `sankey` widget still renders a list-of-flows fallback (true flow_data
   not yet computed).
3. Cross-filtering between widgets is not implemented (deferred per scope).
4. PeriodPicker selection does not persist across reloads.

---

## Cost envelope (PIX, 6593 rows, 12 metrics)

| Op | Model | Approx cost |
|---|---|---|
| `build_schema` | Opus 4.7 | $1.50 |
| `ingest_data` | none | $0.00 |
| `recalculate_metrics` | none | $0.00 |
| `build_dashboard_blueprint` | Opus 4.7 (cached) | $0.20 |
| `generate_insights × 3 pages` | Sonnet 4.6 | $0.06 |
| **Total per fresh project** | | **~$1.76** |

Plan Pro at $999 MXN/mes (~$58 USD): margin >97 %.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
