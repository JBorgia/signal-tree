#!/usr/bin/env node
// Like-for-like bundle-size matrix. See size/SCENARIOS.md.
// Usage: node scripts/size-matrix.mjs [--json]
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { PRODUCTION_DEFINE, verifyBundle } from './lib/size-verification.mjs';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, brotliCompressSync, constants as z } from 'node:zlib';
import { collectEvidence } from './lib/evidence.mjs';
import { collectEnvironment } from './lib/env.mjs';
import { EXPECTED, SCENARIOS, LIBS } from '../size/expected.mjs';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const JSON_ONLY = process.argv.includes('--json');
const log = (...a) => {
  if (!JSON_ONLY) console.log(...a);
};
const EXTERNAL = ['@angular/*', 'rxjs', 'rxjs/*', 'tslib'];
const ST_LIBS = new Set(['st14', 'st15', 'cand']);

const pkgJson = (name) => {
  try {
    return JSON.parse(
      readFileSync(join(APP, 'node_modules', name, 'package.json'), 'utf8')
    );
  } catch {
    return null;
  }
};
const ver = (name) => {
  const p = pkgJson(name);
  return p ? `${p.name}@${p.version}` : null;
};
const VERSIONS = {
  signals: ver('@angular/core'),
  'ngrx-signals': ver('@ngrx/signals'),
  'ngrx-store':
    [ver('@ngrx/store'), ver('@ngrx/entity')].filter(Boolean).join(' + ') ||
    null,
  st14: ver('@signaltree/core'),
  st15: ver('st15-released'),
  cand: ver('st15-candidate'),
  esbuild: ver('esbuild'),
  node: process.version,
};

const environment = collectEnvironment({
  appRoot: APP,
  cpu: null,
  customRoot: null,
  candidateSelected: true,
});
const evidence = collectEvidence(APP);

// Temp files live inside the app so bare imports (@angular/*, rxjs) resolve from its node_modules.
mkdirSync(join(APP, 'results'), { recursive: true });
const tmp = mkdtempSync(join(APP, 'results', '.size-tmp-'));
process.on('exit', () => {
  try {
    rmSync(tmp, { recursive: true, force: true });
  } catch {}
});

// Resolve a fixture to a file (materialising the __ST15__ substitution for cand/st15).
function resolveFixture(scenario, lib) {
  const dir = join(APP, 'size', 'fixtures', scenario);
  const file = join(dir, lib === 'cand' ? 'st15.mjs' : `${lib}.mjs`);
  if (!existsSync(file)) return null;
  if (lib !== 'st15' && lib !== 'cand') return file;
  const spec = lib === 'cand' ? 'st15-candidate' : 'st15-released';
  const src = readFileSync(file, 'utf8');
  if (!src.includes('__ST15__'))
    throw new Error(`${file}: no __ST15__ specifier`);
  const out = join(tmp, `${scenario}.${lib}.resolved.mjs`);
  writeFileSync(out, src.replaceAll('__ST15__', spec));
  return out;
}

const esbuildBase = {
  bundle: true,
  format: 'esm',
  external: EXTERNAL,
  absWorkingDir: APP,
  logLevel: 'silent',
  define: PRODUCTION_DEFINE,
};

const pkgRel = (p) => {
  const m = p.replace(/\\/g, '/');
  const nm = m.lastIndexOf('node_modules/');
  if (nm < 0) return m.startsWith('size/') ? '(fixture)' : m;
  let rest = m.slice(nm + 'node_modules/'.length);
  const parts = rest.split('/');
  const pkg = parts[0].startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
  const short = pkg.replace(/^@signal-tree\/|^@signaltree\//, '');
  return `${short}/${parts.slice(pkg.split('/').length).join('/')}`;
};

async function measure(file, withAttribution) {
  const r = await build({
    ...esbuildBase,
    entryPoints: [file],
    platform: 'browser',
    minify: true,
    treeShaking: true,
    metafile: true,
    write: false,
  });
  const out = r.outputFiles[0].contents;
  const res = {
    raw: out.length,
    bundleSha256: createHash('sha256').update(out).digest('hex'),
    inputs: Object.keys(r.metafile.inputs)
      .sort()
      .map((path) => ({
        path,
        sha256: createHash('sha256')
          .update(readFileSync(resolve(APP, path)))
          .digest('hex'),
      })),
    gzip: gzipSync(out, { level: 9 }).length,
    brotli: brotliCompressSync(out, {
      params: {
        [z.BROTLI_PARAM_QUALITY]: 11,
        [z.BROTLI_PARAM_SIZE_HINT]: out.length,
      },
    }).length,
  };
  if (withAttribution) {
    const outMeta = Object.values(r.metafile.outputs)[0];
    const by = {};
    for (const [inp, v] of Object.entries(outMeta.inputs)) {
      if (!v.bytesInOutput) continue;
      const k = pkgRel(inp);
      by[k] = (by[k] || 0) + v.bytesInOutput;
    }
    res.attribution = Object.entries(by)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([module, bytes]) => ({ module, bytes }));
  }
  return { metrics: res, bytes: out };
}

const results = {};
const problems = [];
for (const scenario of SCENARIOS) {
  results[scenario] = {};
  for (const lib of LIBS) {
    const cell = (results[scenario][lib] = {});
    let file;
    try {
      file = resolveFixture(scenario, lib);
    } catch (e) {
      cell.status = 'INVALID';
      cell.error = String(e.message);
      problems.push(`${scenario}/${lib}: ${cell.error}`);
      continue;
    }
    if (!file) {
      cell.status = 'MISSING';
      problems.push(`${scenario}/${lib}: MISSING`);
      continue;
    }
    try {
      const measured = await measure(file, ST_LIBS.has(lib));
      verifyBundle(measured.bytes, {
        directory: tmp,
        name: `${scenario}.${lib}`,
        expected: EXPECTED[scenario],
      });
      Object.assign(cell, measured.metrics);
      cell.status = 'ok';
    } catch (e) {
      cell.status = 'INVALID';
      cell.error = String(e.stderr || e.message || e)
        .split('\n')
        .slice(0, 6)
        .join(' | ');
      problems.push(`${scenario}/${lib}: ${cell.error}`);
    }
  }
  log(
    `  ${scenario}: ${LIBS.map(
      (l) =>
        `${l}=${
          results[scenario][l].status === 'ok'
            ? results[scenario][l].gzip
            : results[scenario][l].status
        }`
    ).join(' ')}`
  );
}

const kb = (n) => (n / 1024).toFixed(2);
function table(title, pick, delta) {
  const w = 14;
  const lines = [
    `\n${title}`,
    ['scenario'.padEnd(14), ...LIBS.map((l) => l.padStart(w))].join(''),
  ];
  for (const s of SCENARIOS) {
    const row = [s.padEnd(14)];
    for (const l of LIBS) {
      const c = results[s][l];
      let t;
      if (c.status !== 'ok') t = c.status;
      else if (delta) {
        const f = results.flat[l];
        t = f.status === 'ok' ? kb(pick(c) - pick(f)) : 'n/a';
      } else t = kb(pick(c));
      row.push(t.padStart(w));
    }
    lines.push(row.join(''));
  }
  return lines.join('\n');
}
log(table('gzip KB (level 9)', (c) => c.gzip));
log(table('brotli KB (quality 11)', (c) => c.brotli));
log(
  table(
    "marginal vs flat, gzip KB (scenario minus that lib's flat)",
    (c) => c.gzip,
    true
  )
);
log(table('marginal vs flat, brotli KB', (c) => c.brotli, true));

const ts = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = join(APP, 'results');
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, `size-matrix-${ts}.json`);
const payload = {
  generated: new Date().toISOString(),
  environment,
  evidence,
  measurement: {
    platform: 'browser',
    format: 'esm',
    minify: true,
    treeShaking: true,
    external: EXTERNAL,
    gzipLevel: 9,
    brotliQuality: 11,
    includesFixtureGlue: true,
    define: PRODUCTION_DEFINE,
    verificationRuntime: 'node',
    verifiesExactMeasuredBundle: true,
    dependencyFootprint:
      'Excludes Angular, rxjs and tslib; incremental cost only if the consumer already shares these dependencies.',
  },
  versions: VERSIONS,
  libs: LIBS,
  scenarios: SCENARIOS,
  problems,
  results,
};
writeFileSync(outFile, JSON.stringify(payload, null, 2), { flag: 'wx' });
if (JSON_ONLY) console.log(JSON.stringify(payload, null, 2));
else {
  log(`\nJSON: ${relative(process.cwd(), outFile)}`);
  if (problems.length) {
    log('\nProblems:');
    for (const p of problems) log('  - ' + p);
  }
}
process.exit(problems.length ? 1 : 0);
