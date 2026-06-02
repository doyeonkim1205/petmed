// 두 Supabase DB (prod / dev) 의 스키마를 받아서 차이를 보고.
// 실행: node scripts/diff-schemas.mjs
//
// SUPABASE_ACCESS_TOKEN 을 .env.local 또는 환경에서 읽음.

import fs from 'fs';
import path from 'path';

function readToken() {
  // .env.local 에서 SUPABASE_ACCESS_TOKEN 추출
  try {
    const env = fs.readFileSync(path.resolve('.env.local'), 'utf8');
    const m = env.match(/^SUPABASE_ACCESS_TOKEN\s*=\s*['"]?([^'"\r\n]+)['"]?/m);
    if (m) return m[1];
  } catch {}
  return process.env.SUPABASE_ACCESS_TOKEN;
}

const TOKEN = readToken();
const PROD = 'ylbxtzwbwbnlmfxqgmoz';
const DEV = 'lzmmiksdvioidcldrnvh';

async function q(ref, sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  return r.json();
}

const section = (name) => console.log('\n' + '='.repeat(70) + '\n' + name + '\n' + '='.repeat(70));

// 1. Tables
section('TABLES');
const tProd = new Set((await q(PROD, "SELECT table_name FROM information_schema.tables WHERE table_schema='public'")).map(r => r.table_name));
const tDev = new Set((await q(DEV, "SELECT table_name FROM information_schema.tables WHERE table_schema='public'")).map(r => r.table_name));
const tProdOnly = [...tProd].filter(x => !tDev.has(x)).sort();
const tDevOnly = [...tDev].filter(x => !tProd.has(x)).sort();
console.log(`PROD only (${tProdOnly.length}):`, tProdOnly);
console.log(`DEV only  (${tDevOnly.length}):`, tDevOnly);

// 2. Columns
section('COLUMNS');
const colsQ = "SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, ordinal_position";
const cProd = await q(PROD, colsQ);
const cDev = await q(DEV, colsQ);
const cProdMap = new Map(cProd.map(c => [`${c.table_name}.${c.column_name}`, c]));
const cDevMap = new Map(cDev.map(c => [`${c.table_name}.${c.column_name}`, c]));
const cProdOnly = [...cProdMap.keys()].filter(k => !cDevMap.has(k));
const cDevOnly = [...cDevMap.keys()].filter(k => !cProdMap.has(k));
console.log(`PROD only columns (${cProdOnly.length}):`);
for (const k of cProdOnly) {
  const c = cProdMap.get(k);
  console.log(`  ${k.padEnd(50)} ${c.data_type.padEnd(20)} null=${c.is_nullable} default=${c.column_default ?? 'NULL'}`);
}
console.log(`DEV only columns (${cDevOnly.length}):`);
for (const k of cDevOnly) {
  const c = cDevMap.get(k);
  console.log(`  ${k.padEnd(50)} ${c.data_type.padEnd(20)} null=${c.is_nullable}`);
}
const mismatches = [];
for (const k of cProdMap.keys()) {
  if (!cDevMap.has(k)) continue;
  const p = cProdMap.get(k), d = cDevMap.get(k);
  if (p.data_type !== d.data_type || p.is_nullable !== d.is_nullable || (p.column_default ?? '') !== (d.column_default ?? '')) {
    mismatches.push({k, p, d});
  }
}
console.log(`Type/null/default mismatches (${mismatches.length}):`);
for (const {k, p, d} of mismatches) {
  console.log(`  ${k}`);
  console.log(`    PROD: ${p.data_type} null=${p.is_nullable} default=${p.column_default ?? 'NULL'}`);
  console.log(`    DEV:  ${d.data_type} null=${d.is_nullable} default=${d.column_default ?? 'NULL'}`);
}

// 3. Indexes
section('INDEXES');
const idxQ = "SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename, indexname";
const iProd = await q(PROD, idxQ);
const iDev = await q(DEV, idxQ);
const iProdMap = new Map(iProd.map(r => [r.indexname, r]));
const iDevMap = new Map(iDev.map(r => [r.indexname, r]));
const iProdOnly = [...iProdMap.keys()].filter(k => !iDevMap.has(k));
const iDevOnly = [...iDevMap.keys()].filter(k => !iProdMap.has(k));
console.log(`PROD only indexes (${iProdOnly.length}):`);
for (const k of iProdOnly) {
  const i = iProdMap.get(k);
  console.log(`  ${k}: ${i.indexdef}`);
}
console.log(`DEV only indexes (${iDevOnly.length}):`);
for (const k of iDevOnly) console.log(`  ${k}`);

// 4. Constraints (CHECK)
section('CHECK CONSTRAINTS');
const ccQ = "SELECT conrelid::regclass::text AS tbl, conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname='public') AND contype='c' ORDER BY tbl, conname";
const ccProd = await q(PROD, ccQ);
const ccDev = await q(DEV, ccQ);
const ccProdMap = new Map(ccProd.map(r => [`${r.tbl}.${r.conname}`, r]));
const ccDevMap = new Map(ccDev.map(r => [`${r.tbl}.${r.conname}`, r]));
const ccProdOnly = [...ccProdMap.keys()].filter(k => !ccDevMap.has(k));
const ccDevOnly = [...ccDevMap.keys()].filter(k => !ccProdMap.has(k));
console.log(`PROD only checks (${ccProdOnly.length}):`);
for (const k of ccProdOnly) {
  const c = ccProdMap.get(k);
  console.log(`  ${k}: ${c.def}`);
}
console.log(`DEV only checks (${ccDevOnly.length}):`);
for (const k of ccDevOnly) console.log(`  ${k}`);
const ccMismatch = [];
for (const k of ccProdMap.keys()) {
  if (!ccDevMap.has(k)) continue;
  if (ccProdMap.get(k).def !== ccDevMap.get(k).def) ccMismatch.push(k);
}
console.log(`Check def mismatches (${ccMismatch.length}):`);
for (const k of ccMismatch) {
  console.log(`  ${k}`);
  console.log(`    PROD: ${ccProdMap.get(k).def}`);
  console.log(`    DEV:  ${ccDevMap.get(k).def}`);
}

// 5. RLS policies
section('RLS POLICIES');
const polQ = "SELECT tablename, policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname='public' ORDER BY tablename, policyname";
const pProd = await q(PROD, polQ);
const pDev = await q(DEV, polQ);
const pProdMap = new Map(pProd.map(r => [`${r.tablename}.${r.policyname}`, r]));
const pDevMap = new Map(pDev.map(r => [`${r.tablename}.${r.policyname}`, r]));
const pProdOnly = [...pProdMap.keys()].filter(k => !pDevMap.has(k));
const pDevOnly = [...pDevMap.keys()].filter(k => !pProdMap.has(k));
console.log(`PROD only policies (${pProdOnly.length}):`);
for (const k of pProdOnly) {
  const p = pProdMap.get(k);
  console.log(`  ${k} [${p.cmd}]`);
  console.log(`    USING: ${p.qual}`);
  console.log(`    WITH CHECK: ${p.with_check}`);
}
console.log(`DEV only policies (${pDevOnly.length}):`);
for (const k of pDevOnly) console.log(`  ${k}`);
const pMismatch = [];
for (const k of pProdMap.keys()) {
  if (!pDevMap.has(k)) continue;
  const a = pProdMap.get(k), b = pDevMap.get(k);
  if (a.cmd !== b.cmd || a.qual !== b.qual || a.with_check !== b.with_check) pMismatch.push(k);
}
console.log(`Policy def mismatches (${pMismatch.length}):`);
for (const k of pMismatch) {
  console.log(`  ${k}`);
  console.log(`    PROD: cmd=${pProdMap.get(k).cmd}  USING=${pProdMap.get(k).qual}  CHECK=${pProdMap.get(k).with_check}`);
  console.log(`    DEV:  cmd=${pDevMap.get(k).cmd}  USING=${pDevMap.get(k).qual}  CHECK=${pDevMap.get(k).with_check}`);
}

// 6. Functions
section('FUNCTIONS (public schema)');
const fnQ = "SELECT proname FROM pg_proc WHERE pronamespace=(SELECT oid FROM pg_namespace WHERE nspname='public') ORDER BY proname";
const fProd = new Set((await q(PROD, fnQ)).map(r => r.proname));
const fDev = new Set((await q(DEV, fnQ)).map(r => r.proname));
console.log(`PROD only:`, [...fProd].filter(x => !fDev.has(x)).sort());
console.log(`DEV only :`, [...fDev].filter(x => !fProd.has(x)).sort());
