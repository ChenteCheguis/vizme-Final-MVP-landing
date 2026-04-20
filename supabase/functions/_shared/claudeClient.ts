// ============================================================
// VIZME V5 — Cliente tipado de Anthropic Messages API
// Deno / Supabase Edge Functions.
// - Retries con backoff exponencial (3 intentos)
// - Timeout 5 min para archivos grandes
// - Prompt caching opcional sobre el system block
// - Errores en español mexicano
// ============================================================

import type { ClaudeCallArgs, ClaudeCallResult, ClaudeModelAlias } from './types.ts';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MAX_ATTEMPTS = 3;
const TIMEOUT_MS = 5 * 60 * 1000;

const MODEL_MAP: Record<ClaudeModelAlias, string> = {
  'opus-4-7': 'claude-opus-4-7',
  'sonnet-4-6': 'claude-sonnet-4-6',
  'haiku-4-5': 'claude-haiku-4-5-20251001',
};

export class ClaudeError extends Error {
  readonly status?: number;
  readonly retryable: boolean;
  constructor(message: string, opts?: { status?: number; retryable?: boolean }) {
    super(message);
    this.name = 'ClaudeError';
    this.status = opts?.status;
    this.retryable = opts?.retryable ?? false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function translateStatus(status: number): { message: string; retryable: boolean } {
  if (status === 401)
    return { message: 'Error de autenticación con Anthropic. Revisar ANTHROPIC_API_KEY.', retryable: false };
  if (status === 400) return { message: 'Solicitud inválida al modelo. Revisar prompts.', retryable: false };
  if (status === 403) return { message: 'API key sin permisos para este modelo.', retryable: false };
  if (status === 404) return { message: 'Modelo no encontrado en Anthropic.', retryable: false };
  if (status === 429) return { message: 'Rate limit alcanzado en Anthropic. Reintentando...', retryable: true };
  if (status === 529) return { message: 'Claude API saturada. Reintentar en 1 minuto.', retryable: true };
  if (status >= 500 && status < 600)
    return { message: 'Problema temporal con Claude. Reintentando...', retryable: true };
  return { message: `Error HTTP ${status} de Anthropic.`, retryable: false };
}

interface AnthropicResponseBody {
  id: string;
  model: string;
  content: Array<{ type: string; text?: string }>;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function callClaude(args: ClaudeCallArgs): Promise<ClaudeCallResult> {
  const apiKey = (globalThis as { Deno?: { env: { get: (k: string) => string | undefined } } }).Deno?.env.get(
    'ANTHROPIC_API_KEY'
  );
  if (!apiKey) {
    throw new ClaudeError('Falta ANTHROPIC_API_KEY en el entorno de la Edge Function.');
  }

  const model = MODEL_MAP[args.model];
  if (!model) {
    throw new ClaudeError(`Alias de modelo desconocido: ${args.model}. Usa opus-4-7, sonnet-4-6 o haiku-4-5.`);
  }

  const systemBlocks = args.cache_control
    ? [{ type: 'text', text: args.system, cache_control: { type: 'ephemeral' } }]
    : [{ type: 'text', text: args.system }];

  // Opus 4.7 deprecó temperature, top_p, top_k → la API responde 400 si se mandan.
  // Sonnet 4.6 y Haiku 4.5 todavía los aceptan. Para opus-4-7-* omitimos los keys
  // por completo (no basta con poner null). El argumento args.temperature sigue
  // aceptándose en la firma pero se ignora silenciosamente para opus-4-7.
  const isOpus47 = model.startsWith('claude-opus-4-7');

  const body: Record<string, unknown> = {
    model,
    max_tokens: args.max_tokens ?? 8192,
    system: systemBlocks,
    messages: args.messages.map((m) => ({ role: m.role, content: m.content })),
  };
  if (!isOpus47) {
    body.temperature = args.temperature ?? 0;
  }

  let lastError: ClaudeError | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let resp: Response;
    try {
      resp = await fetchWithTimeout(
        ANTHROPIC_URL,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
          },
          body: JSON.stringify(body),
        },
        TIMEOUT_MS
      );
    } catch (err) {
      const isAbort = (err as { name?: string })?.name === 'AbortError';
      lastError = new ClaudeError(
        isAbort ? 'Claude tardó más de lo esperado (timeout 5 min).' : `Fallo de red al llamar a Claude: ${(err as Error).message}`,
        { retryable: true }
      );
      if (attempt < MAX_ATTEMPTS) await sleep(2 ** attempt * 1000);
      continue;
    }

    if (resp.ok) {
      const json = (await resp.json()) as AnthropicResponseBody;
      const text = json.content
        .filter((b) => b.type === 'text' && typeof b.text === 'string')
        .map((b) => b.text as string)
        .join('');
      return {
        text,
        tokens_input: json.usage.input_tokens,
        tokens_output: json.usage.output_tokens,
        tokens_cached_read: json.usage.cache_read_input_tokens,
        tokens_cached_write: json.usage.cache_creation_input_tokens,
        model_used: json.model,
      };
    }

    const errBody = await resp.text().catch(() => '');
    const translated = translateStatus(resp.status);
    lastError = new ClaudeError(translated.message + (errBody ? ` — ${errBody.slice(0, 200)}` : ''), {
      status: resp.status,
      retryable: translated.retryable,
    });
    if (!translated.retryable || attempt === MAX_ATTEMPTS) break;
    await sleep(2 ** attempt * 1000);
  }

  throw lastError ?? new ClaudeError('Error desconocido llamando a Claude.');
}
