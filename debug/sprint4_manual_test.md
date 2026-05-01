# Sprint 4 — Manual test plan

**Branch:** `feature/sprint-4-dashboard-multipagina`
**Tester:** dueño de cuenta de pruebas (Diego)
**Pre-reqs:** wizard ya completado, schema activo, time_series_data poblado.

## 1. Construcción del blueprint

Objetivo: probar que Opus 4.7 produce un blueprint v2 válido y se persiste en `dashboard_blueprints`.

1. Inicia sesión como un usuario con un proyecto que tiene schema.
2. Abre `/projects/<id>` — deberías ver la sección "Tu dashboard editorial está a un click".
3. Click en **"Generar dashboard con Opus"**.
4. Espera ~20-40 s (Opus tarda).

**Lo que se espera ver:**
- Loader durante la llamada.
- Aparece la página activa con título grande tipografía display.
- Tabs de navegación si Opus decidió `medium`/`complex`.
- Selector de período arriba a la derecha (Últimos 7 días / 30 / 90 / 12 meses / Histórico).

**Verificación en DB:**
```sql
select id, version, sophistication_level, total_widgets, opus_reasoning
from dashboard_blueprints
where project_id = '<id>' and is_active = true;
```

## 2. Recalcular métricas

1. Si después de generar el blueprint te aparece el banner "Falta calcular tus métricas", click **"Calcular métricas"**.
2. Espera ~3-8 s (es JS puro, sin LLM).

**Lo que se espera ver:**
- El dashboard renderizando con números reales.
- Cambio de período actualiza los KPI hero/cards y los charts.

**Verificación en DB:**
```sql
select count(*) from metric_calculations where project_id = '<id>';
-- Debe ser igual a (#metrics) × 5 (períodos).
```

## 3. Generar insights por página

1. Dentro de la página activa, scrollea hasta "Insights de esta página".
2. Click **"Regenerar insights"**.
3. Espera ~10-20 s (Sonnet 4.6, temperature 0.3).

**Lo que se espera ver:**
- Se renderean 3-5 tarjetas con icono según tipo (oportunidad/riesgo/tendencia/anomalía).
- Tono mexicano accesible ("Tus viernes…", "Cómo va tu equipo…").
- Las tarjetas con priority ≤ 2 muestran badge "Prioritario" coral.

**Verificación en DB:**
```sql
select type, title, content, priority, page_id, metric_references
from insights
where project_id = '<id>' and page_id = '<page-id>'
order by generated_at desc;
```

## 4. Cambio de período

1. Cambia el `PeriodPicker` de "Últimos 30 días" a "Últimos 7 días".
2. Los KPIs deben actualizar instantáneamente (sin reload — los datos ya están en memoria).
3. Las sparklines se mantienen (siempre usan `all_time`).

## 5. Cambio de página

1. Si Opus generó múltiples páginas, click en la siguiente tab.
2. La página completa se reemplaza, incluyendo header e insights.
3. Insights de la página anterior NO aparecen en la nueva.

## 6. Re-generación

1. Click **"Rediseñar"** arriba a la derecha.
2. Opus genera v2 del blueprint, marca el v1 como `is_active=false`.
3. Verifica en DB que existen 2 versiones y solo una activa:
```sql
select version, is_active, total_widgets
from dashboard_blueprints
where project_id = '<id>' order by version;
```

## 7. Empty / error states

- **Sin schema:** abrir un proyecto sin schema. El botón "Generar dashboard" está disabled.
- **Sin datos:** subir schema sin time_series_data. El botón "Calcular métricas" devuelve `metrics_calculated: 0`.
- **Sin métricas referenciadas:** página con widgets que no encajan → `EmptyWidget` se muestra en cada uno.

## 8. Skeleton loader

- Reload duro de la página (Cmd+Shift+R) → debe verse el skeleton editorial (no el spinner viejo).

## Casos negativos a confirmar manualmente

| Caso | Comportamiento esperado |
|---|---|
| Opus devuelve JSON con widget.type fuera del catálogo | Edge Function responde 502 con `validation_errors`. |
| Sonnet inventa metric_id que no existe en el schema | Se filtra antes de INSERT, no rompe. |
| Network drop a mitad de generate_insights | Action error visible en banner rosa. |
| Period picker mientras carga calcs | Pickers responden, widgets muestran "—" en lugar de crashear. |
