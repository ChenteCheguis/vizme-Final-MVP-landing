# Sprint 4.3 — Metric Calculation Audit

> Diego validó el dashboard PIX y descubrió que tres métricas centrales
> son matemáticamente incorrectas. Esta auditoría aísla los bugs en el
> pipeline `ingestEngine → time_series_data → metricCalculator →
> metric_calculations` y propone el fix mínimo.

## Comparativa observada vs realidad (PIX, 6593 filas)

| Métrica | Manual (CSV) | Vizme | Δ | Diagnóstico |
|---|---|---|---|---|
| `ventas_totales` | $3,552,293.51 | $3,552,294 | <1% | ✅ correcto |
| `tickets_exitosos` | 6,592 | 282 | −96% | ❌ devuelve `count(rows)` en lugar de `sum(daily counts)` |
| `ticket_promedio` | $538.88 | $4,242 | +687% | ❌ avg sin pesar por count_source_rows; además se está mostrando un período (no all_time) |
| `venta_promedio_diaria` | ~$7,575 | $3,552,294 | impreso como total | ❌ el widget renderiza `value` cuando debería renderizar `value / días_únicos` |

## Pipeline actual (estado del arte previo a 4.3)

```
CSV (6593 filas, 1 fila = 1 ticket)
  │
  ▼  runIngestExtraction (lib/ingestEngine.ts:200-289)
  │  for each metric:
  │    bucket rows by date → values_per_day: number[]
  │    value_for_day = aggregate(values_per_day, metric.aggregation)
  │  data_points: [{period_start, value, dimension_values}]
  │
  ▼  POST analyze-data ?mode=ingest_data
  │  inserta en time_series_data (1 row por (metric, día))
  │  ⚠️  SÓLO se guarda `value` agregado del día. Se PIERDE el
  │      número de filas-fuente que produjeron ese value.
  │
  ▼  POST analyze-data ?mode=recalculate_metrics
  │  calculateAllMetrics → calculateMetric (per metric, per period)
  │    window = pointsInWindow(points, refDate, periodDays)
  │    value = aggregate(window, metric.aggregation)
  │             ── case 'sum'   → sum(values)            ✅
  │             ── case 'count' → values.length          ❌  cuenta días, no tickets
  │             ── case 'avg'   → mean(values)            ❌  promedio de promedios diarios
  │             ── case 'min'/'max' → min/max(values)    ✅
  │    count = window.length      ❌  número de filas TS, no de tickets fuente
```

## Bug #1 — `aggregation: 'count'` cuenta DÍAS, no tickets

**Archivo:** `supabase/functions/_shared/metricCalculator.ts:60-61`

```ts
case 'count':
  return values.length;
```

`values` es el array de valores del campo `time_series_data.value` para
las filas que caen en el período. Cada fila ya representa un día con
`value = count(tickets ese día)`. La agregación correcta es **sumar
esos counts diarios**, no contar el número de días.

PIX tiene 282 días con tickets en el período "all_time" (~9 meses entre
nov22 y feb24 con cancelaciones intercaladas). Por eso devuelve 282.
La realidad es 6592 tickets.

**Fix:** para `'count'`, calc debe hacer `sum(values)` porque
ingestEngine ya produjo daily counts.

## Bug #2 — `aggregation: 'avg'` no pesa por count_source_rows

**Archivo:** `supabase/functions/_shared/metricCalculator.ts:62-64`

```ts
case 'avg':
case 'ratio':
  return values.reduce((a, b) => a + b, 0) / values.length;
```

`values[i]` = promedio de tickets ese día. Promediar promedios sin
pesos da resultados incorrectos cuando los días tienen cardinalidad
distinta. La fórmula correcta para ticket_promedio es:

```
weighted_avg = Σ(daily_value × daily_count_source_rows)
             / Σ(daily_count_source_rows)
           = Σ(daily_sum) / Σ(daily_count)
           = ventas_totales / tickets_totales
           = 3,552,294 / 6,592 = 538.88 ✓
```

**Fix:** necesitamos `count_source_rows` por punto. Sin ese campo, el
mejor fallback es `mean of means` que es lo que hace hoy y produce
$4,242 (sesgado por días outliers).

## Bug #3 — `count` en `CalculatedValue` mide rows TS, no rows fuente

**Archivo:** `supabase/functions/_shared/metricCalculator.ts:218`

```ts
return { value, count: window.length, ... }
```

`window.length` es el número de puntos en time_series_data, **no** el
número de transacciones de negocio. Hoy se pinta como "tickets exitosos"
en algún widget cuando debería ser un metric explícito.

**Fix:** renombrar `count` a `data_points` y exponer `source_rows` real.

## Bug #4 — `venta_promedio_diaria` no divide por # de días

**Archivo:** widget renderer (DashboardSection o widgets/Hero) muestra
`metric_calculation.value.value` directamente sin dividir.

Para "venta promedio diaria":
- aggregation correcta sería un nuevo tipo `'rate'` que computa
  `sum(values) / count_distinct(period_start)`
- o se modela como métrica derivada `ventas_totales / dias_con_ventas`

**Fix:** agregar agregación `'avg_daily'` al ingestEngine + calc, o
modelar como derivada.

## Bug #5 — sin filtros (CANCELADO=FALSO se ignora)

**Archivo:** `lib/ingestEngine.ts:250` (loop sobre rows)

```ts
for (const row of best.sheet.rows) {
  // No se aplica ningún filter expression
}
```

PIX tiene una columna `CANCELADO` con valores `'FALSO' | 'VERDADERO'`.
Los tickets cancelados se están sumando al revenue. Hoy `Metric` no
tiene campo `filter`, sólo `formula` (texto libre que el motor ignora).

**Fix:** extender `Metric` con `filter?: { field, op, value }` opcional.
Opus debe rellenarlo cuando detecte columnas de tipo cancelación.

## Bug #6 — refDate por defecto no coincide con la latencia de datos

`handleRecalculateMetrics` (analyze-data:766) **sí** tiene un fix
parcial: usa `max(period_start)` como refDate cuando hay puntos. Pero
el frontend (DashboardSection) lee `metric_calculations` para `period =
last_month` directamente, lo que en PIX significa "enero-feb 2024" y
no "todo lo que tengo".

**Fix:** ya está en el backend; verificar que el front no esté
filtrando un período que no aplica al dataset histórico.

## Plan de fix (mínimo viable)

### Migration 15 — `time_series_data.count_source_rows`

```sql
ALTER TABLE time_series_data
  ADD COLUMN count_source_rows integer DEFAULT 1;
COMMENT ON COLUMN time_series_data.count_source_rows IS
  'Número de filas del archivo fuente que produjeron este value
   pre-agregado. Necesario para count(period)=sum, avg(period)=
   weighted avg.';
```

Sin `NOT NULL` y con DEFAULT 1 para retro-compatibilidad — los datos
existentes son tratados como "1 fila por punto".

### `Metric` extendido con filter opcional

```ts
export type MetricFilter = {
  field: string;       // e.g. 'CANCELADO'
  op: '=' | '!=' | 'in' | 'not_in';
  value: string | number | string[] | number[];
};

export type Metric = {
  // ... campos existentes
  filter?: MetricFilter;
};
```

### `ingestEngine` cambios

1. Antes de bucketing, aplicar `metric.filter` si existe.
2. Para cada bucket, además de `value` calcular `count_source_rows =
   filteredValues.length`.
3. Emitir en `IngestDataPoint`: `{period_start, value,
   count_source_rows, dimension_values}`.

### `metricCalculator` cambios

1. `TimeSeriesPoint` añade `count_source_rows: number`.
2. `aggregate(window, how)`:
   - `'sum'`: `Σ value` (sin cambios)
   - `'count'`: `Σ value` ← **FIX**
   - `'avg'` / `'ratio'`: `Σ(value × count_source_rows) / Σ count_source_rows` ← **FIX**
   - `'min'` / `'max'`: sin cambios
3. `CalculatedValue`:
   - `count` rebautizado a `source_rows` y poblado con
     `Σ count_source_rows` en lugar de `window.length`.

### Validador

Script `scripts/validate-pix-metrics.ts` que compara métricas
calculadas por Vizme contra cálculo manual del CSV PIX. Threshold 1%.

## Métricas esperadas tras el fix

| Métrica | Real | Esperado Vizme | Threshold |
|---|---|---|---|
| ventas_totales | $3,552,293.51 | $3,552,294 ±1 | <1% |
| tickets_exitosos | 6,592 | 6,592 ±0 | <1% |
| ticket_promedio | $538.88 | $538.86–$539.00 | <1% |
| % efectivo | calc desde CSV | calc desde Vizme | <1% |
| % propina/venta | calc desde CSV | calc desde Vizme | <1% |

## Out of scope (Sprint 4.4 o posterior)

- `count_distinct(ID_CHEQUE)`: por ahora `count` daily ≈ count_distinct
  porque cada fila ES un ticket. Para datasets con duplicados, requiere
  set-based aggregation.
- `rate` / `avg_daily` como tipo de agregación. Por ahora se modela como
  métrica derivada en widgets.
- `ratio` con dos métricas (ej. propinas/ventas). Por ahora calculado en
  el widget combinando dos `metric_calculations`.
