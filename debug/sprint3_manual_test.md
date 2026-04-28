# Sprint 3 — Manual Test Plan

> **Goal**: walk every flow a real user would touch, in order, with concrete pass criteria.
> Run after `npm run dev` against a clean Supabase project (or one with throwaway test user).

---

## Pre-flight

- [ ] `npm run typecheck` → 0 errors
- [ ] `npm test` → 24/24 passing (fileDigest 7, ingestEngine 12, repos 5)
- [ ] `.env.local` has `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
- [ ] Edge Function `analyze-data` deployed with `ANTHROPIC_API_KEY` set in Supabase project secrets

---

## 1. Auth flows

### 1.1 Signup happy path
1. Navigate to `/signup`.
2. Fill: full name, email, password (≥8 chars), confirm matches, terms checked.
3. Submit → expect redirect to `/onboarding`.
4. **Pass**: live indicator turns green when password ≥8 chars; submit button disabled until all valid.

### 1.2 Login happy path — first-time user (no projects)
1. Sign out (top-right menu → Cerrar sesión).
2. Navigate to `/login` and sign in.
3. **Pass**: redirected to `/onboarding` (because user has 0 projects).

### 1.3 Login happy path — returning user (≥1 project)
1. After completing wizard once, sign out and sign back in.
2. **Pass**: redirected to `/projects` (not onboarding).

### 1.4 Login error mapping
1. Submit wrong password.
2. **Pass**: error reads "Correo o contraseña incorrectos." (not raw English).

---

## 2. Wizard — onboarding (4 steps)

### 2.1 Step 1 — Welcome
1. Verify greeting reads `Hola {firstName}, listo para que Vizme entienda tu negocio.` with first name in coral.
2. Three preview cards visible on right side (Building2, UploadCloud, Sparkles).
3. **Pass**: continue button advances to Step 2.

### 2.2 Step 2 — Context
1. Type a 1-char project name → Continuar disabled.
2. Type ≥2 chars + ≥10 chars business hint → button enables.
3. Click an example chip → business hint field populates.
4. **Pass**: counter `0/300` updates as you type the hint.

### 2.3 Step 3 — Upload
1. Drag a >50MB file → reject toast appears.
2. Drag a ≤25MB Excel/CSV → file preview + ParsingProgress spinner → "Listo para analizar" green pill.
3. DigestStats grid shows hojas / notable_rows / tokens.
4. **Pass**: "Analizar mi data" button enables only after digest parses.

### 2.4 Step 4 — Review (analyzing → success)
1. Click Analyze → expect Step 4 with breathing orb + "Pipeline en curso" or "Análisis en curso".
2. Linear progress bar advances; elapsed timer ticks `Xs`.
3. Within 30-90s (simple route) or 60-120s (chunked), success state appears.
4. **Pass**: SummaryCard shows industry headline (italic Fraunces accent), 3-column identity grid, top 3 metrics with rotating icons, alert/clean-state band.

### 2.5 Step 4 — Failure path
1. Disconnect wifi mid-analysis (or temporarily break ANTHROPIC_API_KEY).
2. **Pass**: failure card with AlertCircle, Spanish error message, Reintentar button → returns to Step 3.

---

## 3. Projects list & dashboard

### 3.1 Empty state
1. Brand-new account, navigate to `/projects` directly.
2. **Pass**: editorial empty state — "Aún no has subido nada. Empecemos." with CTA → /onboarding.

### 3.2 Populated grid
1. After completing ≥1 wizard, navigate to `/projects`.
2. **Pass**: header reads `Tus negocios, entendidos.` (last word italic coral).
3. Each card shows: FolderKanban icon, schema-listo/sin-analizar badge, project name (Fraunces), industry eyebrow, description, date, hover Abrir affordance.
4. Add-new dashed tile present at end of grid.

### 3.3 Project dashboard (from card click)
1. Click any project card.
2. **Pass**: editorial header with project name (Fraunces), description, "Tu pregunta original" coral box if question existed.
3. SummaryCard reuses wizard styling.
4. 4 stat cards (Métricas / Entidades / Dimensiones / Reglas).
5. Files history list with Procesado/Pendiente badges.

### 3.4 Back navigation
1. From dashboard, click "Mis proyectos" breadcrumb.
2. **Pass**: returns to `/projects`.

---

## 4. Ingest modal (recurring upload + Haiku anomalies)

### 4.1 Open modal
1. From dashboard, click "Subir nueva data" CTA.
2. **Pass**: modal opens with backdrop blur, header reads "Ingesta recurrente".

### 4.2 Drop & extraction preview
1. Drop a new Excel file matching the project's schema columns.
2. **Pass**: spinner → "Leyendo y mapeando" → preview panel with file pill, 3 stats (Métricas / Puntos / Granularidad), period range, list of metrics with confidence badges (Alta/Media/Baja or "Sin match").

### 4.3 Drop a mismatched file
1. Drop a file with no matching column names.
2. **Pass**: each metric card shows "Sin match" badge; coral alert "No detectamos métricas mappeables…"; Confirmar disabled.

### 4.4 Confirm + insert + Haiku
1. Confirm a valid extraction.
2. **Pass**: progressive loaders (Subiendo… → Insertando… → Haiku…). Total ~10-30s.
3. Done view shows green emerald success card with insert count, then either:
   - "Todo dentro de lo esperado" clean state, OR
   - 1+ anomaly cards with metric name eyebrow, severity-tinted border, title, explanation.

### 4.5 Esc/backdrop close
1. While preview shown (not busy), press Esc or click backdrop.
2. **Pass**: modal closes without inserting.
3. While busy (uploading/analyzing), Esc/backdrop are no-op.

---

## 5. Layout & visual sanity

### 5.1 Header / sidebar
- [ ] Glass header sticky, blur backdrop, V logo with coral dot.
- [ ] Sidebar visible on `/projects` and `/projects/:id`.
- [ ] Sidebar HIDDEN on `/onboarding` (full breadth for wizard).
- [ ] Mesh background visible on all authenticated pages.
- [ ] Grain texture detectable on hover.

### 5.2 Animations
- [ ] Wizard step transitions: slide-right entrance.
- [ ] SummaryCard: scale-in entrance.
- [ ] Project cards: staggered slide-up (60ms apart).
- [ ] Loading orb: breathe pulse on Step 4 + IngestModal.
- [ ] Progress bar: shimmer gradient.

### 5.3 Typography
- [ ] H1 uses Fraunces light (300 weight), tracking-editorial.
- [ ] Body uses Inter.
- [ ] Numbers/code use JetBrains Mono.
- [ ] Eyebrows use uppercase Inter with 0.16em letter-spacing.

---

## 6. Sign-off

| Section | Pass | Tester | Notes |
|---|---|---|---|
| Auth flows | ☐ | | |
| Wizard | ☐ | | |
| Projects | ☐ | | |
| Ingest + anomalies | ☐ | | |
| Visual sanity | ☐ | | |
