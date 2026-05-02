# Sprint 4.2 — Manual Test Plan

> Browser-based smoke test for the three Sprint 4.2 fixes. Run on local
> dev (`npm run dev`) against a Supabase project with the Sprint 4 +
> Sprint 4.2 migrations applied (`11`–`14`).

## Pre-flight

```bash
$ npx tsc --noEmit                # must be clean
$ npx vitest run                  # 75 passed | 4 skipped
$ npm run dev                     # http://localhost:5173
```

Sign in as a real test user (or sign up fresh).

You'll need three test files for the three scenarios below:

| Scenario | File | Expected health |
|---|---|---|
| **A — Happy** | `Ventas_PIX_nov22_feb24_pruebavizme.csv` (6593 rows of real PIX data) | `complete` |
| **B — Partial** | A CSV with ~50% of column headers Vizme can recognise (e.g. PIX with the TOTAL column renamed to `MISTERY_COL`) | `partial` |
| **C — No data** | A CSV with no recognisable columns (e.g. a list of names + emails, no dates, no amounts) | `no_data` |

---

## Scenario A — Happy path (PIX, 6593 rows)

### Wizard

1. Click **Nuevo proyecto**.
2. Step 1: name = "Sprint 4.2 — A", question = "¿Cómo van mis ventas?",
   upload `Ventas_PIX_nov22_feb24_pruebavizme.csv`. → **Continuar**.
3. Step 2: wait for Opus to design the schema (~30 s). Verify the schema
   includes `extraction_rules.field_mappings` for at least 4 metrics
   (TOTAL, PROPINA, PAGO_EFECTIVO_TOTAL, etc.). → **Continuar**.
4. Step 3 (optional): skip → **Continuar**.
5. Step 4: click **"Construir mi dashboard"**. Watch the 4 stages tick
   through: `ingesting` → `calculating` → `designing` → `writing_insights`.
6. Auto-redirect to `/projects/<id>/dashboard`.

### Expected dashboard state

- **No banner** at the top — health is `complete`.
- Sidebar dot next to **Dashboard** is **green** (emerald).
- All widgets render with real numbers > 0.
- Total ventas across the file ≈ MX$X,XXX,XXX (matches the spreadsheet
  manually if you sum the TOTAL column).
- ≥300 distinct day-buckets in any time series widget.

### Files page check

7. Click **Archivos** in the sidebar → file is listed with
   `rows_extracted ≥ 5000`.

### Schema page check

8. Click **Schema** → metrics tab shows `match_strategy: rule` for the
   metrics that came from `field_mappings` (this is reflected in the
   ingest summary; verify in DB if not exposed in UI).

---

## Scenario B — Partial dashboard

### Setup

Take any CSV Vizme normally extracts cleanly and **rename one of the
key column headers** to a name Vizme cannot match (e.g. rename `TOTAL`
to `XYZZY_AMT`). Save as `partial_test.csv`.

### Wizard

1. Click **Nuevo proyecto**.
2. Step 1: name = "Sprint 4.2 — B", upload `partial_test.csv`.
3. Steps 2–4: complete as in Scenario A.

### Expected dashboard state

- **Amber banner** at the top: _"Tu dashboard está casi listo, pero
  algunas métricas no se pudieron calcular."_ (or similar wording).
- CTA in banner: **Reintentar** + **Ver detalles**.
- Sidebar dot is **amber**.
- Widgets render for healthy metrics; widgets backed by missing metrics
  show their editorial empty state — never "próximo sprint" copy.

### Diagnostics modal

4. Click **Ver detalles** in the banner. Modal opens with:
   - List of missing metrics, each with:
     - metric name + formula
     - reason text (e.g. "no encontramos la columna XYZZY_AMT en el
       archivo")
     - suggested action
   - Two CTAs: **Reintentar extracción** + **Subir archivo nuevo**.

### Retry from inside

5. Restore the original `TOTAL` header in the source CSV and re-upload
   it through **Subir archivo nuevo** → wizard re-runs.
6. Alternative: click **Reintentar extracción** without changing the
   file → useRetryExtraction re-runs ingest + recalc; banner stays
   amber (because the column is still wrong).

---

## Scenario C — No data

### Setup

Create or grab a CSV with **no recognisable business data** — e.g. a
list of names and emails:

```csv
name,email
Diego,diego@example.com
Maria,maria@example.com
```

Save as `nodata_test.csv`.

### Wizard

1. Click **Nuevo proyecto**.
2. Step 1: name = "Sprint 4.2 — C", upload `nodata_test.csv`.
3. Step 2: schema may still build (Opus will infer something thin).
4. Step 3: skip.
5. Step 4: click **"Construir mi dashboard"**. **Even though every
   metric has zero data, the orchestrator should NOT error out.**
   Watch the 4 stages complete (with internal warnings).
6. Auto-redirect to `/projects/<id>/dashboard`.

### Expected dashboard state

- **Rose banner** at the top: _"No pudimos extraer datos de tu archivo
  todavía."_ (or similar).
- CTA in banner: **Ver qué pasó** → opens diagnostics modal.
- Sidebar dot is **rose** (red).
- **Ghost dashboard** renders behind the banner — blurred placeholder
  cards in the same layout the real dashboard would use, conveying
  "this is what you'll see once we have data".

### Diagnostics modal

7. Click **Ver qué pasó**. Modal shows:
   - All metrics listed as missing.
   - Reason: extraction returned 0 rows.
   - Suggested action: upload a file with date + amount columns.
   - CTA: **Subir archivo nuevo** → returns to file-upload step.

### Recovery

8. Click **Subir archivo nuevo** → upload a real PIX CSV.
9. Wizard re-runs. After completion, dashboard renders with health
   `complete` and sidebar dot turns green.

---

## Browser cross-checks

10. After Scenario A completes, open a second tab to
    `/projects/<id>/dashboard` directly → renders without re-running
    the wizard.
11. Refresh during a `partial` state → banner persists (state comes
    from `dashboard_blueprints.health_status` in DB, not from
    component memory).
12. Browser back/forward navigates between dashboard / schema / files
    cleanly.

---

## CLI smoke test

```bash
# End-to-end with PIX file, exercises ingest + recalc + blueprint + insights
npm run test:analyze -- --mode full-setup \
  --file ./scripts/fixtures/Ventas_PIX_nov22_feb24_pruebavizme.csv \
  --hint "ventas e-commerce México"
```

Expected output for PIX:

```
[1/5] 🧬 Construyendo schema... ✅ schema_id=...
[2/5] 📥 Extrayendo y enviando time_series... ✅ inserted=≥5000
[3/5] 📊 Recalculando métricas... ✅ metrics_calculated=N | health=complete
[4/5] 🎨 Diseñando dashboard... ✅ blueprint=... | pages=P
[5/5] ✨ Escribiendo insights... ✅ insights_ok=P insights_fail=0

🎉 FULL-SETUP COMPLETO
```

---

## Pass criteria

- [ ] Scenario A produces a green dashboard with all real numbers > 0
- [ ] Scenario B produces an amber banner + working in-place retry
- [ ] Scenario C produces a rose ghost dashboard + recovery via wizard
- [ ] Sidebar dot color matches blueprint `health_status` in all 3
- [ ] Diagnostics modal lists missing metrics with reasons + CTAs
- [ ] Browser refresh preserves health state from DB
- [ ] CLI `full-setup` against PIX completes with `health=complete`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
