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
import { buildFileDigest, type FileDigest } from '../lib/fileDigest';

type Args = {
  file?: string;
  hint?: string;
  question?: string;
  cleanup?: boolean;
  deleteUser?: boolean;
};

function parseArgs(argv: string[]): Args {
  const out: Args = {};
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
    } else if (flag === '--cleanup') {
      out.cleanup = true;
    } else if (flag === '--delete-user') {
      out.deleteUser = true;
    }
  }
  if (!out.cleanup && !out.file) {
    console.error('❌ Falta --file <path> (o usa --cleanup). Ejemplos:');
    console.error('   npm run test:analyze -- --file ./data/ventas.xlsx');
    console.error('   npm run test:analyze -- --cleanup');
    console.error('   npm run test:analyze -- --cleanup --delete-user');
    process.exit(1);
  }
  return out;
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

function dumpError(label: string, err: unknown): void {
  const e = err as Record<string, unknown> | null | undefined;
  console.error(`\n${label}:`);
  console.error(`  message: ${e?.message ?? '(sin message)'}`);
  console.error(`  status:  ${e?.status ?? '(sin status)'}`);
  console.error(`  code:    ${e?.code ?? '(sin code)'}`);
  console.error(`  name:    ${e?.name ?? '(sin name)'}`);
  try {
    const props = e ? Object.getOwnPropertyNames(e) : [];
    console.error(`  full:    ${JSON.stringify(e, props, 2)}`);
  } catch {
    console.error(`  full:    (no stringificable) ${String(err)}`);
  }
}

async function ensureTestUser(
  admin: SupabaseClient,
  email: string,
  password: string
): Promise<string> {
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) {
    dumpError('admin.listUsers falló', listErr);
    throw new Error(`No pude listar usuarios: ${listErr.message}`);
  }
  const existing = list?.users?.find((u) => u.email === email);
  if (existing) return existing.id;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Test User Vizme' },
  });
  if (createErr || !created?.user) {
    dumpError('admin.createUser falló', createErr);
    throw new Error(
      `No pude crear usuario de prueba: ${createErr?.message ?? 'sin error pero tampoco user'}`
    );
  }
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
  args: { projectId: string; storagePath: string; fileName: string; fileSize: number }
): Promise<string> {
  // Columnas reales de migration 02_files.sql:
  //   id, project_id, file_name, file_size_bytes, mime_type, storage_path,
  //   structural_map, extracted_data, uploaded_at, processed_at
  // (NO existe user_id ni file_type — la pertenencia se infiere vía projects.user_id)
  const { data, error } = await admin
    .from('files')
    .insert({
      project_id: args.projectId,
      storage_path: args.storagePath,
      file_name: args.fileName,
      mime_type: guessContentType(args.fileName),
      file_size_bytes: args.fileSize,
    })
    .select('id')
    .single();
  if (error || !data) {
    dumpError('files.insert falló', error);
    throw new Error(`No pude insertar files: ${error?.message}`);
  }
  console.log(`✅ files row creado: ${data.id}`);
  return data.id;
}

async function invokeEdgeFunction(args: {
  supabaseUrl: string;
  jwt: string;
  projectId: string;
  fileId: string;
  digest: FileDigest;
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
      digest: args.digest,
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

async function listAllStorageObjects(
  admin: SupabaseClient,
  bucket: string,
  prefix: string
): Promise<string[]> {
  const acc: string[] = [];
  // Folders se listan por nivel; recorremos recursivamente.
  const walk = async (dir: string): Promise<void> => {
    const { data, error } = await admin.storage.from(bucket).list(dir, { limit: 1000 });
    if (error) {
      console.warn(`  ⚠ list(${dir}) falló: ${error.message}`);
      return;
    }
    for (const entry of data ?? []) {
      const path = dir ? `${dir}/${entry.name}` : entry.name;
      // Folders no tienen id; los archivos sí.
      if (entry.id) acc.push(path);
      else await walk(path);
    }
  };
  await walk(prefix);
  return acc;
}

async function runCleanup(
  admin: SupabaseClient,
  email: string,
  deleteUser: boolean
): Promise<void> {
  console.log(`\n🧹 Cleanup completo para usuario ${email}`);

  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) {
    dumpError('admin.listUsers falló', listErr);
    process.exit(1);
  }
  const user = list?.users?.find((u) => u.email === email);
  if (!user) {
    console.log(`ℹ️  No existe usuario ${email}. Nada que limpiar.`);
    return;
  }
  console.log(`👤 Usuario: ${user.id}`);

  const { data: projects, error: projErr } = await admin
    .from('projects')
    .select('id, name')
    .eq('user_id', user.id);
  if (projErr) {
    dumpError('projects.select falló', projErr);
    process.exit(1);
  }
  const projectIds = (projects ?? []).map((p) => p.id);
  console.log(`📁 Proyectos a borrar: ${projectIds.length}`);

  if (projectIds.length > 0) {
    // Orden de FKs: hijos antes que padres. projects es el padre raíz.
    const cascadeTables = [
      'time_series_data',
      'insights',
      'dashboard_blueprints',
      'business_schemas',
      'external_data_cache',
      'schema_evolution_log',
      'data_connectors',
      'files',
    ];
    for (const table of cascadeTables) {
      const { error, count } = await admin
        .from(table)
        .delete({ count: 'exact' })
        .in('project_id', projectIds);
      if (error) console.warn(`  ⚠ delete ${table}: ${error.message}`);
      else console.log(`  🗑  ${table}: ${count ?? 0} filas`);
    }
  }

  // Storage: lista y borra todo bajo user-files/<user_id>/
  const objects = await listAllStorageObjects(admin, 'user-files', user.id);
  if (objects.length > 0) {
    const { error: rmErr } = await admin.storage.from('user-files').remove(objects);
    if (rmErr) console.warn(`  ⚠ storage remove: ${rmErr.message}`);
    else console.log(`  🗑  storage: ${objects.length} archivos`);
  } else {
    console.log('  ℹ️  storage: nada que borrar');
  }

  if (projectIds.length > 0) {
    const { error, count } = await admin
      .from('projects')
      .delete({ count: 'exact' })
      .eq('user_id', user.id);
    if (error) console.warn(`  ⚠ delete projects: ${error.message}`);
    else console.log(`  🗑  projects: ${count ?? 0} filas`);
  }

  if (deleteUser) {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      dumpError('admin.deleteUser falló', error);
    } else {
      console.log(`  🗑  usuario ${email} eliminado`);
    }
  } else {
    console.log(`  ℹ️  usuario conservado (usa --delete-user para borrarlo también)`);
  }

  console.log('\n✅ Cleanup completado.');
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

  const admin0 = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (args.cleanup) {
    await runCleanup(admin0, email, args.deleteUser ?? false);
    return;
  }

  const filePath = resolve(process.cwd(), args.file!);
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

  const admin = admin0;

  const userId = await ensureTestUser(admin, email, password);
  console.log(`👤 Test user: ${email} (${userId})`);

  const jwt = await signInUser(url, anonKey, email, password);
  console.log('🔑 JWT obtenido');

  const projectId = await ensureTestProject(admin, userId);

  const uploaded = await uploadFile(admin, userId, filePath, fileBytes);
  const fileId = await insertFileRecord(admin, {
    projectId,
    storagePath: uploaded.storagePath,
    fileName: uploaded.fileName,
    fileSize: fileBytes.length,
  });

  console.log('\n📦 Construyendo digest en cliente (parseo local, no Edge Function)...');
  const t0Digest = performance.now();
  const digest = buildFileDigest({ buffer: fileBytes, file_name: uploaded.fileName });
  const digestJson = JSON.stringify(digest);
  const digestKb = (digestJson.length / 1024).toFixed(1);
  const approxTokens = Math.ceil(digestJson.length / 4);
  const digestMs = Math.round(performance.now() - t0Digest);
  console.log(
    `   hojas: ${digest.total_sheets} | sample_sheets: ${digest.sample_sheets.length} | notable_rows: ${digest.notable_rows.length}`
  );
  console.log(`   tamaño: ${digestKb} KB | ~${approxTokens} tokens | parseo: ${digestMs}ms`);

  console.log('\n⏳ Invocando Edge Function analyze-data...');
  const resp = await invokeEdgeFunction({
    supabaseUrl: url,
    jwt,
    projectId,
    fileId,
    digest,
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
    route?: 'simple' | 'chunked';
    summary: Record<string, unknown>;
    usage: {
      model: string;
      tokens_input: number;
      tokens_output: number;
      tokens_cached_read?: number;
      tokens_cached_write?: number;
      total_duration_ms?: number;
      prompt_version?: string;
    };
    steps_executed?: Array<{
      step_number: number;
      stage: string;
      tokens_input: number;
      tokens_output: number;
      cache_read: number;
      cache_write: number;
      duration_ms: number;
      retried: number;
    }>;
    progress_events?: Array<{
      step: number;
      total_steps: number;
      stage: string;
      human_message: string;
    }>;
  };

  if (body.route) {
    const label = body.route === 'chunked' ? 'CHUNKED (digest > 25k tokens)' : 'SIMPLE (digest ≤ 25k tokens)';
    console.log(`\n🧭 Ruta detectada: ${label}`);
  }

  if (body.progress_events && body.progress_events.length > 0 && body.steps_executed) {
    console.log('');
    body.progress_events.forEach((evt, i) => {
      console.log(`⏳ Paso ${evt.step}/${evt.total_steps}: ${evt.human_message}`);
      const step = body.steps_executed?.[i];
      if (step) {
        console.log(
          `✅ Paso ${evt.step}/${evt.total_steps} completado (${(step.duration_ms / 1000).toFixed(1)}s, ${step.tokens_input} in / ${step.tokens_output} out${step.cache_read ? ` | cache_r=${step.cache_read}` : ''}${step.retried ? ` | retries=${step.retried}` : ''})`
        );
      }
    });
  }

  const totalDur = body.usage.total_duration_ms ?? 0;
  console.log(`\n⏱  Tiempo del orchestrator: ${(totalDur / 1000).toFixed(1)}s`);
  console.log('\n📊 Tokens totales:');
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
  if (body.usage.prompt_version) console.log(`🏷  prompt_version: ${body.usage.prompt_version}`);

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
