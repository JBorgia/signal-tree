#!/usr/bin/env node
/**
 * Benchmark runner. Protocol: METHODOLOGY.md. Drives window.__bench (src/app/contract.ts).
 *   node scripts/run.mjs [--rounds 5] [--rows 1000,10000,50000] [--cpu 4]
 *        [--arms signals,ngrx,st14,st15-released,st15-candidate] [--no-aa] [--out results/]
 *        [--quick] [--root <dir to serve; default dist/browser>] [--timeout <ms per __bench call>]
 * Exit 0 only if every arm in every round was valid. INVALID/FAILED arms exit 1, never dropped.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';
import { parseArgs } from './lib/args.mjs';
import { collectEnvironment } from './lib/env.mjs';
import { verifyBuildProvenance } from './lib/build-provenance.mjs';
import { collectEvidence, developmentReasons } from './lib/evidence.mjs';
import {
  chromiumVersion,
  runEditors,
  runGrid,
  runStartup,
  warmUp,
} from './lib/session.mjs';
import { aaBands, printReport, summarize } from './lib/report.mjs';
import os from 'node:os';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let opts;
try {
  opts = parseArgs(process.argv.slice(2));
} catch (e) {
  console.error(`error: ${e.message}`);
  process.exit(2);
}
if (opts.help) {
  console.log('see header of scripts/run.mjs');
  process.exit(0);
}

const customRoot = opts.root ? resolve(opts.root) : null;
const root = customRoot ?? join(appRoot, 'dist', 'browser');
if (!existsSync(join(root, 'index.html'))) {
  console.error(
    `error: ${join(
      root,
      'index.html'
    )} not found. Build the app first: node scripts/build-with-provenance.mjs`
  );
  process.exit(2);
}
if (
  !customRoot &&
  opts.arms.some((a) => a === 'st15-candidate' || a === 'st15-undo') &&
  !existsSync(
    join(appRoot, 'node_modules', 'st15-candidate', '.candidate.json')
  )
) {
  console.error(
    'error: node_modules/st15-candidate/.candidate.json not found. Install the candidate: node scripts/install-candidate.mjs <dir with signal-tree-{angular,kernel}-*.tgz>'
  );
  process.exit(2);
}

const RELEASED = 'st15-released';
const AA = `${RELEASED} (A/A)`;
const entries = opts.arms.map((id) => ({ label: id, route: id }));
if (opts.aa) {
  if (opts.arms.includes(RELEASED))
    entries.push({ label: AA, route: RELEASED });
  else
    console.warn(
      `warning: A/A control needs the ${RELEASED} arm; running without a noise band`
    );
}
const labels = entries.map((e) => e.label);
const hasAA = labels.includes(AA);

const environment = collectEnvironment({
  appRoot,
  cpu: opts.cpu,
  customRoot,
  candidateSelected: opts.arms.some(
    (a) => a === 'st15-candidate' || a === 'st15-undo'
  ),
});
environment.evidence = collectEvidence(appRoot, root);
if (!customRoot && environment.evidence.buildProvenance?.status !== 'match')
  throw new Error(
    'Missing production build provenance; run node scripts/build-with-provenance.mjs'
  );
environment.chromium = await chromiumVersion(chromium);
const server = await startServer({ root, port: 0 });

const raw = {
  startedAt: new Date().toISOString(),
  development: opts.quick,
  config: {
    footer: opts.footer,
    rounds: opts.rounds,
    rows: opts.rows,
    cpu: opts.cpu,
    arms: opts.arms,
    aa: hasAA,
    counts: opts.counts,
    timeoutMs: opts.timeoutMs,
  },
  labels,
  environment,
  rounds: [],
  failures: {},
  digests: [],
};
const failures = new Map(); // label -> reasons[]
const fail = (label, reason) => {
  if (!failures.has(label)) failures.set(label, []);
  failures.get(label).push(reason);
  console.error(`\n!!! ${label} INVALID/FAILED: ${reason}\n`);
};

const rotate = (list, by) => list.map((_, i) => list[(i + by) % list.length]);
const log = (msg) =>
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);

try {
  // Discarded warm-up: the first browser launch of a run pays cold OS/disk costs that would land
  // on whichever arm is first (first integration run: startup ScriptDuration 10.7 ms vs ~3 ms).
  // It loads only the blank route, so it warms no arm's chunk.
  await warmUp(chromium, server.url);
  for (let r = 0; r < opts.rounds; r++) {
    const order = rotate(entries, r);
    const round = {};
    const digests = {}; // key -> label -> digest
    const note = (key, label, digest) =>
      ((digests[key] ??= {})[label] = digest);
    log(
      `round ${r + 1}/${opts.rounds}: ${order.map((e) => e.label).join(' > ')}`
    );
    for (const { label, route } of order) {
      if (failures.has(label)) {
        round[label] = { skipped: 'arm failed earlier in this run' };
        continue;
      }
      const data = (round[label] = {});
      const base = {
        url: server.url,
        route,
        query: opts.footer === 'off' ? '?footer=0' : '',
        cpu: opts.cpu,
        timeoutMs: opts.timeoutMs,
      };
      const groups = [
        [
          'startup',
          async () => {
            data.startup = await runStartup(chromium, base);
          },
        ],
        [
          'grid',
          async () => {
            data.grid = await runGrid(chromium, {
              ...base,
              rows: opts.rows,
              counts: opts.counts,
            });
            for (const n of opts.rows)
              note(`grid:${n}`, label, data.grid[n].digest);
          },
        ],
        [
          'editors',
          async () => {
            data.editors = await runEditors(chromium, {
              ...base,
              counts: opts.counts,
            });
            note('editors', label, data.editors.digest);
          },
        ],
      ];
      for (const [name, run] of groups) {
        log(`  ${label} / ${name}`);
        try {
          await run();
        } catch (e) {
          data[`${name}Error`] = String(e?.message ?? e);
          fail(label, `round ${r + 1} ${name}: ${e?.message ?? e}`);
          break;
        }
      }
    }
    // Correctness: digests must be identical across all arms for this round.
    for (const [key, byArm] of Object.entries(digests)) {
      const live = labels.filter(
        (l) => byArm[l] !== undefined && !failures.has(l)
      );
      const counts = new Map();
      for (const l of live)
        counts.set(byArm[l], (counts.get(byArm[l]) ?? 0) + 1);
      if (counts.size <= 1) continue;
      // Reference: most common digest; ties go to the first arm in canonical order.
      const ref = [...counts.entries()].sort(
        (a, b) =>
          b[1] - a[1] ||
          live.findIndex((l) => byArm[l] === a[0]) -
            live.findIndex((l) => byArm[l] === b[0])
      )[0][0];
      for (const l of live)
        if (byArm[l] !== ref)
          fail(
            l,
            `round ${r + 1} digest mismatch at ${key}: ${
              byArm[l]
            } vs reference ${ref} (shared by ${live
              .filter((x) => byArm[x] === ref)
              .join(', ')})`
          );
    }
    raw.digests.push(digests);
    raw.rounds.push(round);
  }
} finally {
  await server.close();
}

try {
  const finalProvenance = verifyBuildProvenance(appRoot, root);
  if (
    environment.evidence.buildProvenance?.status === 'match' &&
    finalProvenance.status !== 'match'
  )
    throw new Error('Build provenance disappeared during comparison');
  environment.finalBuildProvenanceStatus = finalProvenance.status;
} catch (error) {
  for (const label of labels) fail(label, String(error.message));
}

environment.endLoadAverage1m = os.loadavg()[0];
environment.endBusy = environment.endLoadAverage1m > environment.cpu.cores / 2;
raw.developmentReasons = developmentReasons(opts, environment);
raw.development = raw.developmentReasons.length > 0;
raw.finishedAt = new Date().toISOString();
raw.failures = Object.fromEntries(failures);

const invalid = Object.fromEntries(
  labels.filter((l) => failures.has(l)).map((l) => [l, true])
);
const summary = summarize(raw);
// Failed controls cannot establish a noise band from partial rounds.
const bands =
  hasAA && !failures.has(RELEASED) && !failures.has(AA)
    ? aaBands(summary, RELEASED, AA)
    : null;
raw.summary = summary;
raw.aaBands = bands;

const outDir = opts.out ? resolve(opts.out) : join(appRoot, 'results');
mkdirSync(outDir, { recursive: true });
const outFile = join(
  outDir,
  `${raw.startedAt.replace(/[:.]/g, '-')}${
    raw.development ? '.DEVELOPMENT' : ''
  }.json`
);
writeFileSync(outFile, JSON.stringify(raw, null, 2), { flag: 'wx' });

console.log('');
printReport({ raw, summary, bands, invalid });
console.log(`\nraw results: ${outFile}`);
if (failures.size) {
  console.error(`\nFAILED: ${[...failures.keys()].join(', ')}`);
  for (const [l, reasons] of failures)
    for (const reason of reasons) console.error(`  ${l}: ${reason}`);
  process.exit(1);
}
