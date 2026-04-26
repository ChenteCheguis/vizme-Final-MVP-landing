# Sprint 3 — Validation Report

**Branch**: `feature/sprint-3-wizard-ingestion`
**Date**: 2026-04-26
**Author**: Diego + Claude Opus 4.7

---

## What shipped

Sprint 3 delivers the first real UI for Vizme — moving from "Edge Function works" (Sprint 2.5) to "user can sign up, upload data, see their schema, and ingest recurring data with anomaly alerts."

### Scope

| Phase | Module | Status |
|---|---|---|
| 1 | Foundations: router, auth context, app layout, Tailwind real pipeline | ✅ |
| 2 | Auth pages: /login, /signup with editorial split layout | ✅ |
| 3 | 4-step wizard: Welcome → Context → Upload → Review (with summary card wow moment) | ✅ |
| 4 | Projects list + project dashboard with reusable summary card | ✅ |
| 5 | Ingest modal (recurring upload) + Haiku 4.5 anomaly detection | ✅ |
| 6 | Unit tests + manual test plan + validation doc | ✅ |
| 7 | Atomic commits + PR body | ✅ |

---

## Automated test evidence

```
$ npm test
✓ lib/repos/__tests__/timeSeries.test.ts        (3 tests)
✓ lib/repos/__tests__/businessSchemas.test.ts   (2 tests)
✓ lib/__tests__/fileDigest.test.ts              (7 tests)
✓ lib/__tests__/ingestEngine.test.ts           (12 tests)

Test Files  4 passed (4)
     Tests  24 passed (24)
```

```
$ npx tsc --noEmit
(0 errors)
```

### ingestEngine test coverage

| # | Test | Why it matters |
|---|---|---|
| 1 | extrae métrica simple con sum agg sobre columna fechada | Baseline happy path |
| 2 | agrega múltiples filas en el mismo período | Bucket dedup |
| 3 | aplica avg cuando metric.aggregation = avg | Aggregation switch |
| 4 | skip métrica que no matchea ninguna columna | Graceful degradation |
| 5 | infiere granularidad mensual | Grain inference |
| 6 | infiere granularidad semanal | Grain inference |
| 7 | parsea fechas en formato dd/mm/yyyy | Mexican date format |
| 8 | limpia números con $ y comas | Currency parsing |
| 9 | confidence high cuando match fuerte + suficientes puntos | Confidence scoring |
| 10 | reporta period_range en summary | UI consumption |
| 11 | maneja workbook sin sheets legibles | Edge case (corrupt/empty) |
| 12 | ignora tildes para matching (Inglés ≈ Ingles) | Spanish header tolerance |

---

## Architecture deltas

### New routes
```
/                  → Landing (public)
/login             → LoginPage (public)
/signup            → SignupPage (public)
/onboarding        → OnboardingPage (protected, sidebar hidden)
/projects          → ProjectsListPage (protected, sidebar visible)
/projects/:id      → ProjectDashboardPage (protected, sidebar visible)
*                  → Navigate to /
```

### New Edge Function modes
`POST /functions/v1/analyze-data` now supports:
- `mode: 'build_schema'` — Sprint 2 + 2.5 (chunking orchestrator)
- **NEW** `mode: 'ingest_data'` — bulk insert into `time_series_data` from client extractions
- **NEW** `mode: 'detect_anomalies'` — Haiku 4.5 reads recent + historic series, returns + persists `insights` rows of `type='anomaly'`

### Data flow — ingestion
```
Browser (IngestModal)
  └── runIngestExtraction(file, schema)   [pure JS, no AI]
  └── Storage upload (user-files bucket)
  └── Insert files row
  └── invoke('analyze-data', mode='ingest_data')   → bulk insert time_series_data
  └── invoke('analyze-data', mode='detect_anomalies') → Haiku 4.5 → persist insights
  └── Render anomaly cards or "all clean" state
```

### Pure-JS extraction heuristic (ingestEngine)
Token-overlap match between metric.name and sheet column headers. Picks best column per metric, finds date column by keyword (fecha/date/period/semana/mes/etc.), buckets rows by date, aggregates with metric.aggregation. Confidence scored on overlap strength + number of points. Returns warnings inline so UI can flag low-confidence extractions.

---

## Design language applied

Per the embedded frontend-design SKILL guidance:
- **Display font**: Fraunces (variable opsz/wght/SOFT/WONK axes), pairs with Inter body + JetBrains Mono.
- **Spatial composition**: asymmetric grids `lg:grid-cols-[1.05fr_0.95fr]` etc., NEVER centered cards.
- **Backgrounds**: `bg-mesh-vizme` (light) or `bg-mesh-night` (dark navy) + grain SVG overlay, NEVER solid colors.
- **Color accent**: `text-vizme-coral` italic on the *last 1-2 words* of editorial headlines (Stripe Press style).
- **Micro-interactions**: scale-in for cards, slide-up staggered for grids (60ms apart), breathe pulse for loading orbs, shimmer for progress bars.

---

## Known gaps & technical debt

- **Schema editing**: SummaryCard "Corregir algo de lo que entendimos" button currently shows alert placeholder. Full edit modal arrives in Sprint 4.
- **Detailed schema view**: ProjectDashboardPage "Ver el schema completo" CTA is placeholder.
- **Dashboard blocks**: dashed placeholder section. Real KPI/chart blocks come from `dashboard_blueprints` rendering — Sprint 4.
- **Insights timeline**: anomalies persist to `insights` table but the dashboard doesn't render historical insights yet. Sprint 4.
- **Connectors (Drive/Sheets/etc.)**: not in scope — V6.
- **ingestEngine confidence**: pure heuristic. Future iteration could use a small Haiku call to map ambiguous columns to metrics with semantic awareness.

---

## Risk notes

| Risk | Mitigation |
|---|---|
| User uploads file with no matching columns | UI shows "Sin match" badges + disables Confirmar; explicit warning copy. |
| Haiku anomaly detection returns malformed JSON | Edge Function strips ```json fences before parse, returns 502 with raw snippet on failure. |
| time_series_data bulk insert exceeds limits | Chunked at 500 rows per batch. |
| User abandons mid-analysis | Stage simulation timers cleaned up on unmount + on error. |
| Network drop during ingest | Modal preserves error state with Retry option. |

---

## Manual test status

See `debug/sprint3_manual_test.md` for the full QA checklist.

| Section | Status |
|---|---|
| Auth flows | Pending live test |
| Wizard | Pending live test |
| Projects | Pending live test |
| Ingest + anomalies | Pending live test |
| Visual sanity | Pending live test |

> Live testing requires deployed Edge Function with `ANTHROPIC_API_KEY` and a real Supabase project. Tests above pass against unit fixtures.

---

## Commits in this branch

```
b0ad610 feat(ingest): recurring upload flow with Haiku 4.5 anomaly detection
234fe8d feat(projects): list page + dashboard with reusable summary card
81442aa feat(onboarding): 4-step wizard with wow moment summary card
115878f feat(auth): login and signup pages with editorial split layout
0faff5d feat(frontend): routing, auth context, and base layout for Sprint 3
```
