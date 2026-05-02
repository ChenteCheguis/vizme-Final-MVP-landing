# Sprint 4.1 — Manual Test Plan

> Browser-based smoke test for the three Sprint 4.1 fixes. Run on local dev
> (`npm run dev`) against a Supabase project with the Sprint 4 migrations
> applied (`11_dashboard_blueprints_v2`, `12_metric_calculations`,
> `13_insights_v2`).

## Pre-flight

```bash
$ npx tsc --noEmit                # must be clean
$ npx vitest run                  # 48 passed
$ npm run dev                     # http://localhost:5173
```

Sign in as a real test user (or sign up fresh). Have a CSV/XLSX with at
least 6 months of dated transactions ready (e.g.
`scripts/fixtures/Ventas_PIX_nov22_feb24_pruebavizme.csv`).

---

## P1 — Wizard → full dashboard chain

### Happy path

1. Click **Nuevo proyecto** in the sidebar.
2. **Step 1 (Identidad):** name = "Test Sprint 4.1", question = "¿Cómo van mis ventas?", upload the CSV. → **Continuar**.
3. **Step 2 (Schema preview):** wait ~30 s for Opus to design the schema. → **Continuar**.
4. **Step 3 (Refinement, optional):** skip → **Continuar**.
5. **Step 4 (Review):** verify summary cards. Click **"Construir mi dashboard"**.
6. Observe progress copy in order:
   - "Procesando tu archivo histórico…"
   - "Calculando tus métricas reales…"
   - "Diseñando tu dashboard personalizado…"
   - "Escribiendo insights para ti…"
7. Auto-redirect to `/projects/<id>/dashboard`. **The dashboard renders with real numbers, no manual buttons.**

### Failure path (recoverable)

1. Same as above through Step 3.
2. Step 4: temporarily kill the edge function (e.g. revoke token) and click **"Construir mi dashboard"**.
3. Expect a stage-specific Spanish error card with a **Reintentar** button.
4. Restore the edge function and click **Reintentar** → succeeds.

### Insights failure (non-blocking)

1. Same as happy path but mid-way (during `writing_insights` stage), throttle network or kill the function.
2. Expect: dashboard still renders. Page banner shows "X insights no se pudieron generar — reintenta desde la página".

---

## P2 — Sub-routes navigation

### Sub-route entry

1. From `/projects` list, click any project. → URL becomes `/projects/<id>` and immediately redirects to `/projects/<id>/dashboard`.
2. The 240 px sidebar appears on the left with three items:
   - **Dashboard** (active, coral border-left)
   - **Schema**
   - **Archivos**
3. The global "Mi espacio" sidebar from AppLayout is **hidden** on this view.

### Schema page

4. Click **Schema** in the sidebar. URL → `/projects/<id>/schema`.
5. Verify rendered sections:
   - Identity cards (industria, modelo, ubicación, etc.)
   - Metrics cards with formula/aggregation/format
   - Entities accordion (click to expand fields)
   - Dimensions list
   - Extraction Rules cards
   - External Sources

### Files page

6. Click **Archivos**. URL → `/projects/<id>/files`.
7. Verify the table shows uploaded files with: name, uploaded_at, rows_extracted, size, action.
8. Click the trash icon on a file → confirmation modal appears in Spanish.
9. Confirm the deletion. Expect:
   - Toast notification "Archivo eliminado"
   - Row disappears from the table
   - Storage object gone (verify in Supabase dashboard if desired)
   - `time_series_data` rows for that file's metrics dropped (cascade)
   - Metrics auto-recalculated in background (check `metric_calculations.calculated_at`)

### Browser navigation

10. After visiting all 3 sub-routes, press browser **Back** twice → lands on dashboard.
11. Press **Forward** twice → returns to files. URL updates correctly each time.

---

## P3 — Widgets without technical placeholders

### bar_stacked with 2+ metrics

1. Open a dashboard whose blueprint includes a `bar_stacked` widget with 2+ `metric_ids`.
2. Expect: real stacked bars (one color segment per metric, shared `stackId`).
3. Hover any bar → tooltip shows all metric values.
4. **No copy mentioning "próximo sprint" or "breakdown bidimensional".**

### heatmap_grid with 2+ metrics

5. Open a dashboard with a `heatmap_grid` widget with 2+ `metric_ids`.
6. Expect: a true matrix table — rows = top categories, columns = metrics, cells colored by per-metric intensity.
7. Empty cells render as `—`.

### heatmap_grid with 1 metric

8. Find a `heatmap_grid` with 1 metric. Expect: linear color-coded grid (existing behavior).

### Empty states

9. Force an empty state (delete the underlying file's data and reload).
10. Verify the message reads editorially, e.g. _"Necesitamos al menos una categoría con datos para componer las barras."_ — never "próximo sprint".

---

## Tooling smoke test

```bash
# End-to-end CLI run, including all 4 post-schema stages
npm run test:analyze -- --mode full-setup --file ./scripts/fixtures/Ventas_PIX_nov22_feb24_pruebavizme.csv --hint "ventas e-commerce México"
```

Expected output:

```
[1/5] 🧬 Construyendo schema... ✅ schema_id=...
[2/5] 📥 Extrayendo y enviando time_series... ✅ inserted=N
[3/5] 📊 Recalculando métricas... ✅ metrics_calculated=M
[4/5] 🎨 Diseñando dashboard... ✅ blueprint=... | pages=P
[5/5] ✨ Escribiendo insights... ✅ insights_ok=P insights_fail=0

🎉 FULL-SETUP COMPLETO
```

---

## Pass criteria

- [ ] All P1 paths complete without manual button clicks
- [ ] P2 sub-routes deep-link, refresh, and browser-navigate cleanly
- [ ] Cascade delete drops storage + DB rows + recalcs metrics
- [ ] Zero technical placeholder copy visible in widgets
- [ ] CLI `full-setup` smoke test succeeds end-to-end

🤖 Generated with [Claude Code](https://claude.com/claude-code)
