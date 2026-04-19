#!/usr/bin/env tsx
// ============================================================
// VIZME V5 — scripts/test-analyze.ts
// Runner reproducible del Edge Function analyze-data (modo build_schema).
//
// Uso:
//   npm run test:analyze -- --file <path> [--hint "<string>"] [--question "<string>"]
//
// Requiere en .env.local:
//   VITE_SUPABASE_URL
//   VITE_SUPABASE_ANON_KEY
//   SUPABASE_SERVICE_ROLE_KEY   (NUNCA commitear)
//   VIZME_TEST_USER_EMAIL
//   VIZME_TEST_USER_PASSWORD
// ============================================================

import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { performance } from 'node:perf_hooks';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

type Args = {
  file: string;
  hint?: string;
  question?: string;
};

function parseArgs(argv: string[]): Args {
  const out: Partial<Args> = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const next = argv[i + 1];
    if (flag === '--file') {
      out.file = next;
      i++;
    } else if (flag === '--hint') {
      out.hint = next;
      i++;
    } else if (flag === '--question') {
      out.question = next;
      i++;
    }
  }
  if (!out.file) {
    console.error('❌ Falta --file <path>. Ejemplo:');
    console.error('   npm run test:analyze -- --file ./data/ventas.xlsx');
    process.exit(1);
  }
  return out as Args;
}

async function loadEnv(): Promise<Record<string, string>> {
  const envPath = resolve(process.cwd(), '.env.local');
  try {
    const raw = await readFile(envPath, 'utf8');
    const env: Record<string, string> = {};
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) {
        const val = m[2].replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
        env[m[1]] = val;
      }
    }
    return env;
  } catch {
    console.error('❌ No encontré .env.local. Copia .env.local.example y rellena las claves.');
    process.exit(1);
  }
}

function requireEnv(env: Record<string, string>, key: string): string {
  const v = env[key] ?? process.env[key];
  if (!v) {
    console.error(`❌ Falta variable ${key} en .env.local`);
    process.exit(1);
  }
  return v;
}

async function ensureTestUser(
  admin: SupabaseClient,
  email: string,
  password: string
): Promise<string> {
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) throw new Error(`No pude listar usuarios: ${listErr.message}`);
  const existing = list.users.find((u) => u.email === email);
  if (existing) return existing.id;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created.user) throw new Error(`No pude crear usuario de prueba: ${createErr?.message}`);
  return created.user.id;
}

async function signInUser(url: string, anonKey: string, email: string, password: string): Promise<string> {
  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`No pude iniciar sesión del test user: ${error?.message}`);
  return data.session.access_token;
}

async function ensureTestProject(admin: SupabaseClient, userId: string): Promise<string> {
  const { data: projects, error } = await admin
    .from('projects')
    .select('id, name')
    .eq('user_id', userId)
    .like('name', 'TEST_%')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw new Error(`No pude consultar projects: ${error.message}`);
  if (projects && projects.length > 0) {
    console.log(`ℹ️  Reusando project TEST existente: ${projects[0].id} (${projects[0].name})`);
    return projects[0].id;
  }
  const name = `TEST_${Date.now()}`;
  const { data: inserted, error: insErr } = await admin
    .from('projects')
    .insert({ user_id: userId, name, description: 'Proyecto de prueba para test-analyze' })
    .select('id')
    .single();
  if (insErr || !inserted) throw new Error(`No pude crear project: ${insErr?.message}`);
  console.log(`✅ Project creado: ${inserted.id} (${name})`);
  return inserted.id;
}

async function uploadFile(
  admin: SupabaseClient,
  userId: string,
  filePath: string,
  fileBytes: Buffer
): Promise<{ storagePath: string; fileName: string }> {
  const fileName = basename(filePath);
  const storagePath = `${userId}/${Date.now()}_${fileName}`;
  const { error } = await admin.storage.from('user-files').upload(storagePath, fileBytes, {
    upsert: false,
    contentType: guessContentType(fileName),
  });
  if (error) throw new Error(`No pude subir a Storage: ${error.message}`);
  console.log(`✅ Archivo en storage: user-files/${storagePath}`);
  return { storagePath, fileName };
}

function guessContentType(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop();
  if (ext === 'csv') return 'text/csv';
  if (ext === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (ext === 'xls') return 'application/vnd.ms-excel';
  return 'application/octet-stream';
}

async function insertFileRecord(
  admin: SupabaseClient,
  args: { projectId: string; userId: string; storagePath: string; fileName: string; fileSize: number }
): Promise<string> {
  const ext = args.fileName.toLowerCase().split('.').pop() ?? '';
  const { data, error } = await admin
    .from('files')
    .insert({
      project_id: args.projectId,
      user_id: args.userId,
      storage_path: args.storagePath,
      file_name: args.fileName,
      file_type: ext,
      file_size: args.fileSize,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`No pude insertar files: ${error?.message}`);
  console.log(`✅ files row creado: ${data.id}`);
  return data.id;
}

async function invokeEdgeFunction(args: {
  supabaseUrl: string;
  jwt: string;
  projectId: string;
  fileId: string;
  hint?: string;
  question?: string;
}): Promise<{ status: number; body: unknown; elapsedMs: number }> {
  const url = `${args.supabaseUrl}/functions/v1/analyze-data`;
  const t0 = performance.now();
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${args.jwt}`,
    },
    body: JSON.stringify({
      mode: 'build_schema',
      project_id: args.projectId,
      file_id: args.fileId,
      business_hint: args.hint,
      question: args.question,
    }),
  });
  const elapsedMs = Math.round(performance.now() - t0);
  const text = await resp.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* deja como string */
  }
  return { status: resp.status, body, elapsedMs };
}

async function fetchPersistedSchema(admin: SupabaseClient, schemaId: string): Promise<unknown> {
  const { data, error } = await admin.from('business_schemas').select('*').eq('id', schemaId).maybeSingle();
  if (error) throw new Error(`No pude leer schema persistido: ${error.message}`);
  return data;
}

async function cleanupIfConfirmed(
  admin: SupabaseClient,
  args: { projectId: string; fileId: string; storagePath: string }
): Promise<void> {
  const rl = createInterface({ input, output });
  const answer = (await rl.question('\n¿Limpiar project y file de prueba? [y/N]: ')).trim().toLowerCase();
  rl.close();
  if (answer !== 'y' && answer !== 's') {
    console.log('ℹ️  Conservando datos de prueba.');
    return;
  }
  await admin.storage.from('user-files').remove([args.storagePath]);
  await admin.from('files').delete().eq('id', args.fileId);
  await admin.from('business_schemas').delete().eq('project_id', args.projectId);
  await admin.from('projects').delete().eq('id', args.projectId);
  console.log('🧹 Cleanup completado.');
}

function cost(tokensIn: number, tokensOut: number, cachedRead: number, cachedWrite: number): string {
  // Opus 4.7 pricing aprox (USD por 1M tokens): in 15, out 75, cache_read 1.5, cache_write 18.75.
  const usd =
    (tokensIn / 1_000_000) * 15 +
    (tokensOut / 1_000_000) * 75 +
    (cachedRead / 1_000_000) * 1.5 +
    (cachedWrite / 1_000_000) * 18.75;
  return `$${usd.toFixed(4)} USD`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = await loadEnv();

  const url = requireEnv(env, 'VITE_SUPABASE_URL');
  const anonKey = requireEnv(env, 'VITE_SUPABASE_ANON_KEY');
  const serviceKey = requireEnv(env, 'SUPABASE_SERVICE_ROLE_KEY');
  const email = requireEnv(env, 'VIZME_TEST_USER_EMAIL');
  const password = requireEnv(env, 'VIZME_TEST_USER_PASSWORD');

  const filePath = resolve(process.cwd(), args.file);
  let fileBytes: Buffer;
  try {
    fileBytes = await readFile(filePath);
  } catch (err) {
    console.error(`❌ No pude leer el archivo: ${filePath}`);
    console.error((err as Error).message);
    process.exit(1);
  }

  console.log('\n🚀 Vizme — test-analyze');
  console.log(`📄 Archivo: ${filePath} (${(fileBytes.length / 1024).toFixed(1)} KB)`);
  if (args.hint) console.log(`💡 Hint: ${args.hint}`);
  if (args.question) console.log(`❓ Question: ${args.question}`);
  console.log('');

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const userId = await ensureTestUser(admin, email, password);
  console.log(`👤 Test user: ${email} (${userId})`);

  const jwt = await signInUser(url, anonKey, email, password);
  console.log('🔑 JWT obtenido');

  const projectId = await ensureTestProject(admin, userId);

  const uploaded = await uploadFile(admin, userId, filePath, fileBytes);
  const fileId = await insertFileRecord(admin, {
    projectId,
    userId,
    storagePath: uploaded.storagePath,
    fileName: uploaded.fileName,
    fileSize: fileBytes.length,
  });

  console.log('\n⏳ Invocando Edge Function analyze-data...');
  const resp = await invokeEdgeFunction({
    supabaseUrl: url,
    jwt,
    projectId,
    fileId,
    hint: args.hint,
    question: args.question,
  });

  console.log(`\n⏱  Tiempo total: ${(resp.elapsedMs / 1000).toFixed(1)}s`);
  console.log(`📡 Status: ${resp.status}`);

  if (resp.status !== 200) {
    console.error('\n❌ La Edge Function falló:');
    console.error(JSON.stringify(resp.body, null, 2));
    await cleanupIfConfirmed(admin, { projectId, fileId, storagePath: uploaded.storagePath });
    process.exit(2);
  }

  const body = resp.body as {
    schema_id: string;
    version: number;
    summary: Record<string, unknown>;
    usage: {
      model: string;
      tokens_input: number;
      tokens_output: number;
      tokens_cached_read?: number;
      tokens_cached_write?: number;
      prompt_version: string;
    };
  };

  console.log('\n📊 Tokens:');
  console.log(`   input:        ${body.usage.tokens_input}`);
  console.log(`   output:       ${body.usage.tokens_output}`);
  console.log(`   cached read:  ${body.usage.tokens_cached_read ?? 0}`);
  console.log(`   cached write: ${body.usage.tokens_cached_write ?? 0}`);
  console.log(
    `   💰 costo aprox: ${cost(
      body.usage.tokens_input,
      body.usage.tokens_output,
      body.usage.tokens_cached_read ?? 0,
      body.usage.tokens_cached_write ?? 0
    )}`
  );

  console.log('\n📋 Summary:');
  console.log(JSON.stringify(body.summary, null, 2));
  console.log(`\n🆔 schema_id: ${body.schema_id} (version ${body.version})`);
  console.log(`🏷  prompt_version: ${body.usage.prompt_version}`);

  console.log('\n📄 Schema completo (desde DB):');
  const persisted = await fetchPersistedSchema(admin, body.schema_id);
  console.log(JSON.stringify(persisted, null, 2));

  console.log('\n✅ Validación: el schema pasó los checks del validator (servidor no lo habría guardado de otro modo).');

  await cleanupIfConfirmed(admin, { projectId, fileId, storagePath: uploaded.storagePath });
}

main().catch((err) => {
  console.error('\n💥 Error inesperado:');
  console.error((err as Error).message);
  console.error((err as Error).stack);
  process.exit(1);
});
