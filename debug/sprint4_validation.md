# Sprint 4 — Validation log

**Branch:** `feature/sprint-4-dashboard-multipagina`
**Date:** 2026-05-01

## Build / typecheck

```
$ npx tsc --noEmit
(no errors)

$ npx vite build
✓ 2492 modules transformed.
dist/index.html                     2.53 kB │ gzip:   1.03 kB
dist/assets/index-Yt3cPS9a.css     59.63 kB │ gzip:  10.44 kB
dist/assets/index-ad6sRZzO.js   2,230.52 kB │ gzip: 568.47 kB
✓ built in 32.51s
```

Bundle warning ≥500 kB es esperado: recharts + react-gauge-component +
react-calendar-heatmap suman ~700 kB. Pendiente para Sprint 4.5: code-splitting
del dashboard (lazy import).

## Tests automáticos

```
$ npx vitest run --reporter=basic
Test Files  7 passed (7)
     Tests  45 passed | 1 skipped (46)
   Duration 4.83s
```

| Suite | Tests | Notas |
|---|---|---|
| `lib/__tests__/fileDigest.test.ts` | 9 | Sprint 1-3, todavía verde |
| `lib/__tests__/fileDigest_pix.test.ts` | 2 (1 skip) | Skip si fixture PIX ausente |
| `lib/__tests__/ingestEngine.test.ts` | 12 | Sprint 3 |
| `lib/repos/__tests__/businessSchemas.test.ts` | 2 | Sprint 1 |
| `lib/repos/__tests__/timeSeries.test.ts` | 3 | Sprint 3 |
| `supabase/functions/_shared/__tests__/metricCalculator.test.ts` | 11 | NUEVO |
| `supabase/functions/_shared/__tests__/visualizationCatalog.test.ts` | 7 | NUEVO |

## Migraciones aplicadas

- `11_dashboard_blueprints_v2.sql` — pages JSONB + metadata Opus.
- `12_metric_calculations.sql` — tabla nueva con UNIQUE(project_id, metric_id, period).
- `13_insights_v2.sql` — page_id + metric_references + CHECK constraint extendido.

```sql
-- Sanity check después de aplicar
select column_name from information_schema.columns
  where table_name = 'dashboard_blueprints' and column_name in
  ('pages','sophistication_level','total_widgets','model_used');

select column_name from information_schema.columns
  where table_name = 'insights' and column_name in
  ('page_id','metric_references');

select count(*) from metric_calculations;
```

## Edge Function — modos disponibles

```ts
type Mode =
  | 'build_schema'                 // Sprint 1
  | 'ingest_data'                  // Sprint 3
  | 'detect_anomalies'             // Sprint 3
  | 'build_dashboard_blueprint'    // Sprint 4 — Opus 4.7
  | 'recalculate_metrics'          // Sprint 4 — pure JS
  | 'generate_insights';           // Sprint 4 — Sonnet 4.6
```

Deploy:
```
$ npx supabase functions deploy analyze-data
Deployed Functions on project zzqvwyvgfpjecaorahrn: analyze-data
```

## Componentes UI nuevos

```
components/dashboard/
├── DashboardRenderer.tsx       — orchestra páginas + secciones + grid
├── DashboardSection.tsx        — wrapper con loaders/CTA por estado
├── DashboardSkeleton.tsx       — placeholder editorial mientras carga
├── InsightCard.tsx             — tarjeta narrativa por tipo (4 estilos)
├── PageNav.tsx                 — tabs entre páginas
├── PeriodPicker.tsx            — filtro temporal global
├── format.ts                   — formatters MXN / % / compact
├── useDashboardData.ts         — hook que carga blueprint + calcs + insights
└── widgets/
    ├── WidgetShell.tsx          — cápsula común editorial
    ├── KpiWidgets.tsx           — kpi_hero, kpi_card, sparkline
    ├── TimeWidgets.tsx          — line, area, composed, heatmap_calendar
    ├── CategoricalWidgets.tsx   — bar, bar_horizontal, bar_stacked, donut, treemap
    ├── SpecialtyWidgets.tsx     — scatter, gauge, radial_bar, funnel, heatmap_grid, sankey
    ├── TableWidget.tsx          — data_table
    ├── widgetTypes.ts           — tipos compartidos
    └── index.tsx                — dispatcher por widget.type
```

19 widgets totales. Los que requieren breakdown bidimensional
(`bar_stacked`, `heatmap_grid`, `sankey`) renderean fallbacks elegantes
hasta Sprint 4.5 (cross-filtering / breakdown 2D).

## Riesgos asumidos / deuda conocida

1. **Bundle inflado a 2.2 MB** — code-splitting del dashboard pendiente.
2. **`bar_stacked`/`heatmap_grid`/`sankey` rendrean fallback simple** — ok para Sprint 4, completo en 4.5.
3. **No hay cross-filtering entre widgets** — diferido a Sprint 4.5 por decisión de scope.
4. **Insights se generan a demanda** (botón) — no auto-trigger en blueprint nuevo. UX intencional para no quemar costos sin consentimiento.
5. **Period picker no persiste** — al recargar vuelve a `last_month`. Suficiente para MVP.

## Costos esperados por proyecto (PIX-like, 6593 rows, 12 métricas)

| Operación | Modelo | Tokens in/out aprox | Costo |
|---|---|---|---|
| build_schema | Opus 4.7 | 80k / 8k | ~$1.50 |
| build_dashboard_blueprint | Opus 4.7 (cache hit) | 5k / 4k | ~$0.20 |
| recalculate_metrics | sin LLM | — | $0.00 |
| generate_insights × 3 páginas | Sonnet 4.6 | 3k / 1k cada uno | ~$0.06 |
| **Total proyecto inicial** | | | **~$1.76** |

Para Plan Pro $999 MXN/mes (≈$58 USD), margen >97 %.
