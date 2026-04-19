// ============================================================
// VIZME V5 — Vitest setup
// Stubbea import.meta.env para tests que importan lib/supabase.ts.
// ============================================================

process.env.VITE_SUPABASE_URL ??= 'http://localhost:54321';
process.env.VITE_SUPABASE_ANON_KEY ??= 'test-anon-key';

// Vite expone env via import.meta.env; Vitest lo hace disponible con define/stub.
(globalThis as unknown as { import: { meta: { env: Record<string, string> } } }).import = {
  meta: {
    env: {
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
    },
  },
};
