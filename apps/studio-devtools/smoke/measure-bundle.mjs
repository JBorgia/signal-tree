/**
 * S1 production bundle delta (spec §8.5 point 6).
 *
 *   git worktree add /tmp/st-base <baseline-sha>
 *   node apps/studio-devtools/smoke/measure-bundle.mjs
 */
import { build } from 'esbuild';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ENTRIES = {
  'bare signalTree': `
    import { signalTree } from '@signal-tree/kernel';
    const t = signalTree({ a: 1, b: { c: 2 } });
    globalThis.x = () => { t.$.a(Math.random()); return t.$.a(); };`,
  'signalTree + transactions()': `
    import { signalTree, transactions } from '@signal-tree/kernel';
    const t = signalTree({ a: 1, b: { c: 2 } }, { enhancers: [transactions()] });
    globalThis.x = () => { t.transaction(() => { t.$.a(Math.random()); }).confirm(); return t.$.a(); };`,
};

/** Studio must contribute NONE of these to a production bundle. */
const STUDIO_SYMBOLS = [
  'attachStudio', 'studioTreeId', 'StudioTreeDestroyed', 'installStudioBridge',
  'SIGNALTREE_STUDIO_CONNECT', 'committed-transactions', 'listTrees',
  'readConfirmedTurns', 'STUDIO_CAPABILITY_UNAVAILABLE', 'peekRegistry',
];

async function measure(root) {
  const out = {};
  for (const [name, source] of Object.entries(ENTRIES)) {
    const dir = mkdtempSync(join(tmpdir(), 'stsize-'));
    const entry = join(dir, 'e.ts');
    writeFileSync(entry, source);
    const built = await build({
      entryPoints: [entry], bundle: true, minify: true, format: 'esm',
      write: false, logLevel: 'silent',
      alias: { '@signal-tree/kernel': `${root}/packages/kernel/src/index.ts` },
    });
    const code = built.outputFiles[0].contents;
    out[name] = {
      min: code.length,
      gzip: gzipSync(code).length,
      brotli: brotliCompressSync(code).length,
      text: Buffer.from(code).toString('utf8'),
    };
  }
  return out;
}

const base = await measure(process.env['BASE_ROOT'] ?? '/tmp/st-base');
const head = await measure(process.cwd());

console.log('| build | metric | baseline | S1 | delta |');
console.log('|---|---|---|---|---|');
for (const name of Object.keys(ENTRIES)) {
  for (const m of ['min', 'gzip', 'brotli']) {
    const b = base[name][m], h = head[name][m];
    console.log(`| ${name} | ${m} | ${b} | ${h} | ${h - b >= 0 ? '+' : ''}${h - b} B |`);
  }
}
console.log('\n=== Studio symbols in production bundles ===');
for (const name of Object.keys(ENTRIES)) {
  const found = STUDIO_SYMBOLS.filter((s) => head[name].text.includes(s));
  console.log(`${name}: ${found.length ? 'LEAKED -> ' + found.join(', ') : 'none'}`);
}
