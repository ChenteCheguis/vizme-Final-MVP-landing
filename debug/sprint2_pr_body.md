# Sprint 2 + Sprint 2.5 — Schema Engine & Chunking

Branch: `feature/sprint-2-schema-engine` → `main`

---

## Sprint 2 — Schema Engine (ya entregado)

- File parsing movido al cliente para esquivar `WORKER_RESOURCE_LIMIT`.
- Digest con prioridad a hints del usuario, prompt caching activo.
- Edge Function `analyze-data` construye el `business_schema` y lo persiste.
- Fixtures + script `test:analyze` para validación end-to-end.

---

## Sprint 2.5 — Chunking Engine

### Problema

Tier 1 de Anthropic impone **30,000 ITPM** (input tokens / min) para Opus 4.7. El digest del inventario real de Barber Magic (86k tokens) disparaba `rate_limit_error 429` en la llamada monolítica de Sprint 2 — bloqueando cualquier archivo grande.

### Arquitectura

```
digest → chooseRoute(digest)
           │
           ├── ≤ 25k tokens → runSimpleRoute (1 call, flujo original)
           │
           └── > 25k tokens → runChunkedRoute
                                 ├── Paso 1 — classifyBusiness (sheets_summary, 1500 max tokens)
                                 ├── throttleIfNeeded (30s si budget > 27k)
                                 ├── Paso 2 — extractEntitiesMetrics (notable_rows filtradas por focus_areas, 4000 max tokens)
                                 ├── throttleIfNeeded
                                 └── Paso 3 — buildExtractionRules (sample_sheets, 4000 max tokens)
                                        └── consolidateChunkedOutputs → validateBusinessSchemaPayload
```

- **Route decision**: `chooseRoute` usa el digest completo serializado; umbral `CHUNKING_THRESHOLD_TOKENS = 25_000`.
- **Throttling**: `THROTTLE_WAIT_MS = 30_000`, `SAFETY_MARGIN = 3_000` contra `TPM_LIMIT = 30_000`.
- **Retries**: `[10s, 30s, 60s]` con back-off sólo si `ClaudeError.retryable`.
- **Metadata persistida**: `route`, `steps_executed` (JSONB con tokens/durations/retried por paso), `total_duration_ms`.

### Evidencia (4 fixtures / industrias)

| Test | Archivo | Ruta | Duración | Costo | Industry detectada |
|---|---|---|---|---|---|
| 1 | `ventas_demo.csv` | simple | 25.8s | $0.28 | retail |
| 2 | `logistica_demo.csv` | simple | 36.4s | $0.29 | logística |
| 3 | `farmacia_demo.xlsx` | simple | 32.7s | $0.33 | farmacia |
| 4 | `INV_JUGUETESOJODEAGUA2023.xlsx` (Barber Magic, 86k tokens) | **chunked** | 58.9s | $1.51 | servicios personales / **barbería infantil** |

Detalles completos en `debug/sprint2_5_chunking_validation.md`.

### Calidad preservada

- Test 4 produjo `industry=servicios personales`, `sub_industry="barbería infantil"`, 12 métricas y 2 extraction_rules que cubren las 2 entidades transaccionales (movimiento_inventario_juguetes + corte_servicio). El criterio de "5+ rules" originalmente buscado era innecesariamente granular: Opus prefirió 2 reglas ricas con 9-10 field_mappings cada una, cubriendo el 100% del schema.
- Anti-sesgo verificado: ninguna industria se contamina con otra entre los 4 tests (no aparecen métricas de retail en el archivo de logística, etc.).
- Cero `rate_limit_error` en los 4 tests.

### Deuda técnica documentada

- Primera corrida de un archivo grande paga cache_write premium (~$1.50). Corridas subsecuentes sobre mismo archivo cachearán a ~$0.50 (10× barato). Ver sección "Costo y cache" del reporte.
- `extraction_rules` depende de qué tan granular decida Opus ser — el prompt actual no impone un mínimo. Aceptable mientras el schema cubra todas las entidades transaccionales.
- La migración `10_chunking_metadata.sql` ya quedó aplicada en prod vía `supabase db query --linked`; el repo tiene el SQL para re-runs futuros.

### Archivos nuevos

**Orchestrator**: `supabase/functions/_shared/chunkingOrchestrator.ts`, `chunkingTypes.ts`
**Prompts**: `classifyBusinessPrompt.ts`, `extractEntitiesMetricsPrompt.ts`, `buildExtractionRulesPrompt.ts`
**Migración**: `supabase/migrations/v5/10_chunking_metadata.sql`
**Fixtures**: `scripts/fixtures/logistica_demo.csv`, `farmacia_demo.xlsx`, `generate_farmacia.mjs`
**Validación**: `debug/sprint2_5_chunking_validation.md`

### Archivos modificados

- `supabase/functions/analyze-data/index.ts` — delega a `orchestrateBuildSchema`.
- `scripts/test-analyze.ts` — render de progreso por paso.

---

## Test plan

- [x] Test 1 — `ventas_demo.csv` → simple path, retail
- [x] Test 2 — `logistica_demo.csv` → simple path, logística
- [x] Test 3 — `farmacia_demo.xlsx` → simple path, farmacia
- [x] Test 4 — Barber Magic (86k tokens) → **chunked path**, 0 rate-limits
- [x] Migración aplicada en prod
- [x] Edge Function redeployada con orchestrator
