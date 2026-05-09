# Sprint 4.3 — Manual Test Plan

> Browser smoke test de los 4 fixes principales del Sprint 4.3.
> Ejecutar contra Supabase con migraciones `11`–`15` aplicadas.

## Pre-flight

```bash
$ npx tsc --noEmit                # clean
$ npx vitest run                  # 97 passed | 4 skipped
$ npm run validate:pix            # ✅ 6/6 dentro del 1%
$ npm run dev                     # http://localhost:5173
```

Verificar que la migración 15 se aplicó:

```sql
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'time_series_data'
  AND column_name = 'count_source_rows';
-- Debe regresar: count_source_rows | integer | 1 | NO
```

Iniciar sesión con un usuario de prueba (o sign up fresh).

Archivos sugeridos para los 3 escenarios:

| Escenario | Archivo | Industry hint | Health esperado |
|---|---|---|---|
| **A — PIX restaurantes** | `Ventas_PIX_nov22_feb24_pruebavizme.csv` (6593 filas) | restaurantes | `complete` |
| **B — Barbería** | CSV/XLSX con columnas `fecha, barbero, servicio, monto` (≥30 filas) | barberias | `complete` o `partial` |
| **C — Industria desconocida** | CSV con datos transaccionales sin matchear ningún catálogo | astrología / esoterismo | `partial` o `complete` |

---

## Escenario A — PIX (validación métricas + dashboard restaurante)

### Wizard

1. **Nuevo proyecto** → name: "Sprint 4.3 — A".
2. Step 1: question = "¿Cómo van mis ventas y mis viernes?",
   industry hint = "restaurantes" (o dejar que Opus lo detecte),
   upload `Ventas_PIX_nov22_feb24_pruebavizme.csv`. → **Continuar**.
3. Step 2: esperar a Opus diseñar el schema (~30 s). Verificar en DB
   que `business_schemas.metrics` incluye:
   ```sql
   SELECT id, name, aggregation, filter
   FROM (SELECT jsonb_array_elements(metrics) AS m FROM business_schemas WHERE project_id = '<id>') x,
        jsonb_to_record(x.m) AS (id text, name text, aggregation text, filter jsonb);
   -- ticket_promedio debe tener filter = {"field":"CANCELADO","op":"=","value":"FALSO"}
   -- (o equivalente) en al menos las métricas que dependen de cancelación.
   ```
4. Step 3 (contexto opcional): skip → **Continuar**.
5. Step 4: click **"Construir mi dashboard"**. Las 4 etapas tickean:
   `ingesting` → `calculating` → `designing` → `writing_insights`.
6. Auto-redirect a `/projects/<id>/dashboard`.

### Validación de métricas (la que se rompió antes del Sprint 4.3)

7. En el hero del dashboard, **Ticket promedio** debe estar entre
   **$535 y $545**. Si lee >$1,000 → bug regresó.
8. **Tickets exitosos** debe ser **~6,500-6,600** (no 282, no 359).
9. **Ventas totales** debe ser **~$3.5M** (~$3,552,000).
10. Abrir DevTools → Network → buscar última llamada a
    `analyze-data?mode=recalculate_metrics`. La respuesta incluye
    `health_status` y `health_percent`. La query a
    `metric_calculations` (vía Supabase JS) debe traer
    `value.source_rows ≈ 6577` para `ticket_promedio` (NO `data_points`,
    que sería ~282-360).

### Validación de dashboard restaurante (catálogo de dominio)

11. El blueprint debe tener **mínimo 2 páginas**. Sidebar muestra
    "Dashboard General" + al menos una segunda (ej. "Operaciones",
    "Ventas", "Equipo").
12. Cada página debe abrir con un widget grande tipo `kpi_hero` y 3
    `kpi_card` adyacentes.
13. Para industria restaurantes, deberían aparecer al menos 2 de:
    - `bar_chart` por día de la semana
    - `heatmap_grid` día × hora
    - `kpi_card` ticket promedio
    - `kpi_card` propinas
    - `donut_chart` mezcla de pago
14. En DevTools → Network → última `build_dashboard_blueprint`,
    el body de respuesta incluye:
    ```json
    {
      "domain_coverage": {
        "industry": "restaurantes",
        "missing": [...],
        "satisfied": ["rest_ventas_hero", "rest_ticket_promedio", ...]
      },
      "blueprint_attempts": 1
    }
    ```
    `missing` debería estar idealmente vacío. `attempts: 2` significa
    que Opus falló validación al primer intento y el retry corrigió.

### Validación anti-alucinación de insights

15. Click en una página con insights (panel `InsightCard`). Cada
    insight debe:
    - Estar limpio (sin marcadores `[METRIC:...]` ni `[PCT:...]`
      visibles).
    - Tener números coherentes con los KPIs del dashboard. Si dice
      "tu ticket subió 12%", el `change_percent` real debe estar
      cerca.
16. En DevTools → Network → buscar
    `analyze-data?mode=generate_insights`. La respuesta incluye:
    ```json
    {
      "insights_created": N,
      "insights": [...],
      "rejected": []  // o pocos elementos con sus errores
    }
    ```
    Si `rejected` viene con muchos items → Sonnet sigue alucinando,
    revisar prompt.

---

## Escenario B — Barbería (validar catálogo `barberias`)

### Setup

Crear o usar un CSV con headers como:
`fecha,barbero,servicio,duracion,monto,propina,metodo_pago` y ≥30
filas con valores realistas.

### Wizard

1. **Nuevo proyecto** → name: "Sprint 4.3 — B".
2. Industry hint: "barbería" o "barber shop" (probar al menos uno
   de los aliases para confirmar el mapeo heurístico).
3. Upload el archivo, completar wizard.

### Expected dashboard

- `business_identity.industry` en DB debe contener "barber" o
  "salon" (case-insensitive).
- En la respuesta de `build_dashboard_blueprint`,
  `domain_coverage.industry === "barberias"`.
- El dashboard debe mostrar idealmente:
  - Top barberos por servicios (`bar_horizontal`)
  - Mezcla de servicios (`donut_chart`)
  - Citas por día y hora (`heatmap_grid`) si hay columna de hora
  - Ticket promedio por servicio (`kpi_card`)
- Widgets típicos de restaurante (propinas como tasa, mezcla de
  pago) NO deben dominar la página.

---

## Escenario C — Industria desconocida (fallback `generic`)

### Setup

Crear un CSV minimalista que no matchee ningún catálogo:
`fecha,categoria,monto`. Industry hint: "consultoría espiritual"
o "venta de cristales" (algo que no caiga en ninguna heurística).

### Wizard

1. **Nuevo proyecto** → name: "Sprint 4.3 — C".
2. Upload, completar wizard.

### Expected dashboard

- `domain_coverage.industry === "generic"`.
- Mínimo 2 páginas (validador exige).
- Cada página con hero + kpi_hero.
- Widgets son los `gen_*` (kpi_hero, line_chart, bar_horizontal).

---

## Edge cases — qué probar a propósito

### E1. Blueprint inválido al primer intento (retry)

Para forzar el retry, editar temporalmente
`buildDashboardBlueprintPrompt.ts` y agregar al system prompt:
"DEVUELVE SÓLO 1 PÁGINA". Re-deploy edge function. Correr el
wizard.

- En DevTools → respuesta debe traer `blueprint_attempts: 2`.
- Después del retry, sí valida (Opus respeta el feedback).
- **Revertir** el cambio del prompt antes de seguir.

### E2. Insight con número fuera de tolerancia

Editar temporalmente `insightValidator.ts` cambiando
`NUMERIC_TOLERANCE_PCT = 0.05` a `0.001`. Correr `generate_insights`.

- Muchos insights se rechazan, `rejected` está poblado en respuesta.
- En la UI, menos insights aparecen.
- **Revertir** antes de seguir.

### E3. Filter referenciando columna inexistente

En el schema generado, editar manualmente una métrica para que
tenga `filter: { field: 'COLUMNA_QUE_NO_EXISTE', op: '=', value: 'X' }`.
Correr `recalculate_metrics`.

- ingestEngine debería emitir warning pero NO fallar.
- La métrica se calcula sin el filtro (no-op).
- En `metric_calculations`, `value.value` es razonable
  (no NaN, no null).

### E4. Datos sin columna de cancelación (negocio sin filter)

Subir un CSV simple `fecha, monto` sin columna `CANCELADO`. Schema
generado no debe incluir `filter` en las métricas. Cálculo procede
normal. PIX validation NO aplica aquí (no hay tickets cancelados).

---

## CLI smoke test (PIX end-to-end)

```bash
$ npm run validate:pix
```

Salida esperada:

```
→ Validando .../Ventas_PIX_nov22_feb24_pruebavizme.csv

Cálculo manual desde CSV (excluye CANCELADO=VERDADERO):
  Filas totales:           6592
  Filas válidas:           6577
  Ventas totales:          $3542721.51
  Ticket promedio:         $538.65
  ...

→ Corriendo runIngestExtraction…
  Métricas extraídas: 6/6
  Total data points:  ~2154

│ ventas_totales    │  3542721.51 │  3552293.51 │ 0.27% │ ✅ │
│ tickets_exitosos  │     6577.00 │     6592.00 │ 0.23% │ ✅ │
│ ticket_promedio   │      538.65 │      538.88 │ 0.04% │ ✅ │
│ ...               │             │             │       │    │

✓ Todas las métricas dentro del threshold.
```

Si CUALQUIER métrica sale fuera del 1%, el script `exit 1` y debe
investigarse antes de mergear.

---

## Pass criteria

- [ ] PIX wizard end-to-end completa con `health=complete`
- [ ] Ticket promedio en hero ~$538 (NO >$1,000)
- [ ] Tickets exitosos ~6,500-6,600 (NO ~280-360)
- [ ] Dashboard restaurante incluye ≥2 widgets prototípicos del giro
- [ ] Mínimo 2 páginas en cualquier blueprint nuevo
- [ ] Cada página abre con `kpi_hero`
- [ ] Insights visibles sin marcadores `[METRIC]` / `[PCT]`
- [ ] `domain_coverage.industry` correcto para restaurantes / barberías / desconocida
- [ ] `blueprint_attempts` reportado en respuesta (1 normalmente, 2 si Opus auto-corrigió)
- [ ] Filter referenciando columna inexistente NO rompe ingest
- [ ] `npm run validate:pix` exit 0 con las 6 métricas verdes
- [ ] `npx tsc --noEmit` clean en local antes del PR

🤖 Generated with [Claude Code](https://claude.com/claude-code)
