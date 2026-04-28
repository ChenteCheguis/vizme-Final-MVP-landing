// ============================================================
// VIZME V5 — CORS headers compartidos
//
// Edge Functions invocadas desde el browser (wizard, ingesta,
// dashboards) deben incluir estos headers en TODA respuesta —
// incluyendo el preflight OPTIONS — o el navegador bloquea la
// llamada con "blocked by CORS policy".
//
// En producción, reemplazar '*' por la lista explícita de
// orígenes permitidos (ej. https://app.vizme.mx).
// ============================================================

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
