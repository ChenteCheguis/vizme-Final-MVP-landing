# Sprint 3 — Wizard de Onboarding + Ingesta Recurrente + Anomalías

Closes the loop from "Edge Function builds schemas" (Sprint 2.5) to **"a real user can sign up, complete onboarding, see their schema, and feed recurring data with Haiku-detected anomaly alerts."**

This is the first PR where Vizme is genuinely **usable** end-to-end.

---

## What's in here

### 🧭 Foundations (FASE 1)
- **Real Tailwind pipeline** — migrated from CDN script + inline config to PostCSS + autoprefixer + `index.css` with `@tailwind` directives. Custom design tokens (vizme palette, Fraunces variable axes, mesh gradients, grain noise overlay, breathe/shimmer/scaleIn/slideUp/slideRight animations) live in `tailwind.config.js`.
- **Routing** — `react-router-dom` v7 with `BrowserRouter`, `ProtectedRoute`, `Outlet`, catch-all redirect.
- **AuthContext** — `supabase.auth.onAuthStateChange` listener wrapped in a context provider with `signIn` / `signUp` / `signOut`.
- **AppLayout** — glass header, asymmetric sidebar (NavLinks: Mis proyectos / Nuevo proyecto), sidebar **hidden on `/onboarding`** to give the wizard full breathing room. Mesh + grain backgrounds throughout.

### 🔐 Auth pages (FASE 2)
- **AuthLayout** — editorial split: dark `mesh-night` left side with concentric ring decoration + Fraunces quote (last 2 words in coral, underlined). Form right side.
- **LoginPage** — smart post-login routing: checks projects count → `/onboarding` (first time) or `/projects` (returning). Honors `state.from.pathname` override. Errors mapped to Mexican Spanish.
- **SignupPage** — full name + email + password (live ≥8 char indicator) + confirm + terms checkbox.

### 🪄 Wizard (FASE 3 — the heart)
4-step `useReducer` state machine with progress bar, navigation, and Mexican Spanish copy:

| Step | Component | What it does |
|---|---|---|
| 1 | `Step1Welcome` | Personalized greeting (`Hola {firstName}, listo para que Vizme entienda tu negocio.`) + 3 staggered preview cards |
| 2 | `Step2Context` | Project name + business hint (10-300 char counter) + optional question. Click-to-fill examples panel (Retail / Logística / Farmacia / Servicios) |
| 3 | `Step3Upload` | react-dropzone with auto-parse via `buildFileDigest`. DigestStats grid (hojas / notable_rows / token estimate). 25MB warning, 50MB hard reject |
| 4 | `Step4Review` | 3 sub-states: analyzing (breathing orb + shimmer progress bar + elapsed timer), success (`SummaryCard`), failure (Reintentar) |

Calls `analyze-data` Edge Function with `mode: 'build_schema'`. Stage simulation timers schedule local progress transitions matching the chunked pipeline (classify @ 2s → extract @ 22s → rules @ 48s) so the UX is honest while the backend runs sequentially.

**The wow moment**: `SummaryCard` — a hero card with a decorative coral arc, identity grid, top 3 metrics with rotating icons, and severity-aware alert/clean-state band.

### 📁 Projects (FASE 4)
- **ProjectsListPage** — empty state for first-time users, then a grid of project cards (FolderKanban icon, schema-listo / sin-analizar pill, Fraunces name, industry eyebrow, hover-reveal Abrir affordance). Add-new dashed tile.
- **ProjectDashboardPage** — editorial header with project name + original question in coral box. Reuses `SummaryCard` from the wizard. 4 stat cards (Métricas / Entidades / Dimensiones / Reglas). Files history list. Dashboard blocks placeholder for next sprint.

### 📡 Ingesta recurrente + Haiku anomalies (FASE 5)
- **`lib/ingestEngine.ts`** — pure-JS extraction. Token-overlap matches schema metrics to file columns, finds date column by keywords, buckets rows by date, aggregates per `metric.aggregation`. Returns confidence scores + warnings.
- **Edge Function modes added**:
  - `mode: 'ingest_data'` — bulk insert into `time_series_data` (chunked at 500), marks file as processed.
  - `mode: 'detect_anomalies'` — loads recent + historic series, calls Haiku 4.5 with structured prompt comparing `[NUEVO]` points vs historic, persists anomalies to `insights` table with `priority` mapped from severity.
- **`IngestModal`** — full upload flow: drop → parse → preview (with confidence badges) → confirm → upload + insert + Haiku analysis → done view (anomaly cards or "todo dentro de lo esperado").

### 🧪 Tests + validation (FASE 6)
- **24/24 tests passing** (`npm test`):
  - `fileDigest.test.ts` — 7 tests
  - `ingestEngine.test.ts` — **12 NEW tests** covering happy path, agg modes (sum/avg/count/min/max/ratio), dd/mm/yyyy date format, currency string cleanup, confidence scoring, no-match degradation, empty workbook, accent-insensitive matching
  - `repos/timeSeries.test.ts` + `repos/businessSchemas.test.ts` — 5 tests
- **`debug/sprint3_manual_test.md`** — end-to-end QA checklist
- **`debug/sprint3_validation.md`** — scope, architecture deltas, design language notes, known gaps, risk register

---

## Architecture diagram — ingestion flow

```
Browser (IngestModal)
  │
  ├─ runIngestExtraction(file, schema)         [pure JS, no AI calls]
  │
  ├─ Storage: upload to user-files/<uid>/<ts>_<name>
  │
  ├─ DB: insert files row (project_id, storage_path, size)
  │
  ├─ Edge Function: mode='ingest_data'
  │     └─ time_series_data ← bulk insert (chunked at 500)
  │     └─ files.processed_at ← now()
  │
  ├─ Edge Function: mode='detect_anomalies'
  │     ├─ Load latest 200 time_series_data points
  │     ├─ Load latest business_schema (for metric metadata)
  │     ├─ Build per-metric series w/ [NUEVO] markers
  │     ├─ Haiku 4.5 → structured JSON anomalies
  │     └─ insights ← persist with type='anomaly', priority by severity
  │
  └─ Render anomaly cards or "all clean" state
```

---

## Design language notes

Per the embedded frontend-design SKILL:
- **Fraunces** display (variable opsz / wght / SOFT / WONK) + **Inter** body + **JetBrains Mono** for numbers/code.
- Asymmetric grids (`lg:grid-cols-[1.05fr_0.95fr]` etc.) — never centered cards.
- Mesh gradients + grain SVG noise overlays — never solid colors.
- Coral italic accent on the *last 1-2 words* of editorial headlines (Stripe Press style).
- Micro-interactions: scale-in, staggered slide-up, breathe pulse, shimmer.

---

## Test plan

- [x] `npm run typecheck` → 0 errors
- [x] `npm test` → 24/24 passing
- [ ] Live: signup → wizard → schema build → projects list → project dashboard → ingest modal → Haiku anomaly detection (see `debug/sprint3_manual_test.md`)
- [ ] Visual sanity check on Chrome + Safari + Firefox

---

## Out of scope (deferred to Sprint 4+)

- Schema editing modal (currently shows alert placeholder)
- Detailed schema viewer page
- Real dashboard blocks (KPI / charts) from `dashboard_blueprints`
- Insights timeline UI (anomalies persist but aren't browsable yet)
- Connectors (Drive / Sheets / Gmail / WhatsApp) — V6

---

## Commits

```
9d6a116 test(ingest): 12 unit tests for ingestEngine + manual QA + validation report
b0ad610 feat(ingest): recurring upload flow with Haiku 4.5 anomaly detection
234fe8d feat(projects): list page + dashboard with reusable summary card
81442aa feat(onboarding): 4-step wizard with wow moment summary card
115878f feat(auth): login and signup pages with editorial split layout
0faff5d feat(frontend): routing, auth context, and base layout for Sprint 3
```

🤖 Generated with [Claude Code](https://claude.com/claude-code)
