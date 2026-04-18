import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltan variables de entorno de Supabase. Copia .env.local.example a .env.local y rellena los valores.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Invoke an edge function via supabase-js (handles CORS + auth).
 * IMPORTANT: Deploy edge functions with --no-verify-jwt so Supabase
 * doesn't reject tokens at the infra level.
 */
export async function invokeFunction(functionName: string, opts: { body: Record<string, unknown>; headers?: Record<string, string> }) {
  return supabase.functions.invoke(functionName, opts);
}
