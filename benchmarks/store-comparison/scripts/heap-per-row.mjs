#!/usr/bin/env node
/**
 * Attribute an arm's memory per row: heap snapshots before and after loading N rows, the
 * difference grouped by object kind (constructor name, or the first property names of a plain
 * object), divided by N. Compiled code and V8 system objects are excluded.
 *
 * Usage: node scripts/heap-per-row.mjs [--root dist/browser] [--rows 20000] [--top 14] arm...
 * Use an unmangled build (NG_BUILD_MANGLE=0) to read library class names.
 */
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { collectEvidence, diffHeapCategories } from './lib/evidence.mjs';
import { verifyBuildProvenance } from './lib/build-provenance.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const value = args[i + 1];
  args.splice(i, 2);
  return value;
};
const root = opt('root', 'dist/browser');
const rows = Number(opt('rows', 20000));
const top = Number(opt('top', 14));
const arms = args.length ? args : ['signals', 'ngrx', 'st14', 'st15-released'];
if (
  !Number.isSafeInteger(rows) ||
  rows < 1 ||
  !Number.isSafeInteger(top) ||
  top < 1
)
  throw new Error('--rows and --top must be positive integers');
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const record = {
  startedAt: new Date().toISOString(),
  development: true,
  rows,
  root: resolve(root),
  evidence: collectEvidence(appRoot, root),
  arms: {},
  scope:
    'Single-N signed change in snapshot self_size, excluding code, hidden, synthetic and system / categories; includes grid/harness; not a retained-size ownership analysis or a whole-heap slope.',
};

if (
  resolve(root) === resolve(appRoot, 'dist/browser') &&
  record.evidence.buildProvenance?.status !== 'match'
)
  throw new Error(
    'Missing production build provenance; run node scripts/build-with-provenance.mjs'
  );

async function summary(cdp) {
  for (let i = 0; i < 3; i++) await cdp.send('HeapProfiler.collectGarbage');
  const chunks = [];
  const on = (e) => chunks.push(e.chunk);
  cdp.on('HeapProfiler.addHeapSnapshotChunk', on);
  await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
  cdp.off('HeapProfiler.addHeapSnapshotChunk', on);
  const s = JSON.parse(chunks.join(''));
  const m = s.snapshot.meta;
  const nf = m.node_fields.length,
    ef = m.edge_fields.length;
  const types = m.node_types[0],
    edgeTypes = m.edge_types[0];
  const out = new Map();
  for (let i = 0, e = 0; i < s.nodes.length; i += nf) {
    const type = types[s.nodes[i]];
    let name = String(s.strings[s.nodes[i + 1]]);
    const edges = s.nodes[i + 4];
    if (type === 'object' && name === 'Object') {
      const keys = [];
      for (let j = e; j < e + edges * ef; j += ef)
        if (edgeTypes[s.edges[j]] === 'property')
          keys.push(s.strings[s.edges[j + 1]]);
      name = `{${keys
        .filter((k) => k !== '__proto__')
        .slice(0, 4)
        .join(',')}}`;
    }
    e += edges * ef;
    if (
      type === 'code' ||
      type === 'hidden' ||
      type === 'synthetic' ||
      name.startsWith('system /')
    )
      continue;
    const key = type.includes('string')
      ? '(strings)'
      : `${type}:${name.slice(0, 60)}`;
    const v = out.get(key) ?? [0, 0];
    v[0] += s.nodes[i + 3];
    v[1]++;
    out.set(key, v);
  }
  return out;
}

const server = await startServer({ root, port: 0 });
try {
  for (const arm of arms) {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await (await browser.newContext()).newPage();
      const cdp = await page.context().newCDPSession(page);
      await page.goto(`${server.url}/${arm}`);
      await page.waitForFunction(() => window.__bench);
      const actualArm = await page.evaluate(() => window.__bench.arm?.id);
      if (actualArm !== arm)
        throw new Error(`requested ${arm}, loaded ${actualArm}`);
      await page.evaluate(() => window.__bench.ready());
      const before = await summary(cdp);
      await page.evaluate((n) => window.__bench.load(n, 20260930, 0), rows);
      const after = await summary(cdp);
      const {
        categories: diff,
        netBytes,
        positiveBytes,
      } = diffHeapCategories(before, after);
      record.arms[arm] = {
        chromium: browser.version(),
        netBytes,
        positiveBytes,
        categories: diff,
      };
      console.log(
        `${arm}: ${(netBytes / rows).toFixed(
          1
        )} B/row net filtered snapshot delta; ` +
          `${(positiveBytes / rows).toFixed(
            1
          )} B/row positive categories only, at ${rows} rows`
      );
      for (const [k, size, count] of diff.slice(0, top))
        console.log(
          `  ${(size / rows).toFixed(1).padStart(7)} B/row  ${(count / rows)
            .toFixed(2)
            .padStart(6)} objs/row  ${k}`
        );
    } finally {
      await browser.close();
    }
  }
} finally {
  await server.close();
}

const finalProvenance = verifyBuildProvenance(appRoot, resolve(root));
if (
  record.evidence.buildProvenance?.status === 'match' &&
  finalProvenance.status !== 'match'
)
  throw new Error('Build provenance disappeared during attribution');
record.finalBuildProvenanceStatus = finalProvenance.status;
const outDir = resolve(appRoot, 'results');
mkdirSync(outDir, { recursive: true });
const outFile = resolve(
  outDir,
  `heap-per-row-${record.startedAt.replace(/[:.]/g, '-')}.json`
);
writeFileSync(outFile, JSON.stringify(record, null, 2), { flag: 'wx' });
console.log(`raw attribution: ${outFile}`);
