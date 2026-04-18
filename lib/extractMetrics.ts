// ─────────────────────────────────────────────
// extractMetrics.ts — DEPRECATED
// The new Stage 1 pipeline uses extractAllFromPattern
// from fileParser.ts. This file re-exports for
// backward compatibility during migration.
// ─────────────────────────────────────────────

export { extractAllFromPattern } from './fileParser';
export type { ExtractAllResult } from './fileParser';
