#!/usr/bin/env node
/**
 * Cross-library gzip cost for the SAME capability, measured the same way.
 *
 * SignalTree and NgRx Signals both build on Angular signals. `@angular/*`, RxJS,
 * and tslib are external because this tool measures each state library's own
 * contributed code inside an Angular application.
 *
 * The rows cover shared public capabilities: field state and keyed entities.
 * History is deliberately absent because NgRx Signals has no first-party
 * integrated history primitive matching `restoration()`; adding a snapshot
 * stack would measure harness code rather than equal library capability.
 *
 * Usage: node tools/size-compare.mjs [--json]
 */
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const REPO_NODE_MODULES = join(process.cwd(), 'node_modules');
const CORE = join(process.cwd(), 'dist/packages/kernel/dist/index.js');
const directory = mkdtempSync(join(tmpdir(), 'st-size-compare-'));

const SCENARIOS = [
  {
    capability: 'Store + a few fields, read and write',
    signaltree: `
      import { signalTree } from ${JSON.stringify(CORE)};
      const tree = signalTree({ count: 0, user: { name: 'a' } });
      tree.$.count(1);
      globalThis.__sink = [tree.$.count(), tree.$.user.name()];
    `,
    ngrxSignals: `
      import { signalState, patchState } from '@ngrx/signals';
      const store = signalState({ count: 0, user: { name: 'a' } });
      patchState(store, { count: 1 });
      globalThis.__sink = [store.count(), store.user.name()];
    `,
  },
  {
    capability: 'Entity collection: add + update + read all + read one',
    signaltree: `
      import { signalTree, entityMap } from ${JSON.stringify(CORE)};
      const tree = signalTree({ users: entityMap() });
      tree.$.users.addOne({ id: 1, name: 'a' });
      tree.$.users.updateOne(1, { name: 'b' });
      globalThis.__sink = [tree.$.users.all(), tree.$.users.byId(1)?.()];
    `,
    ngrxSignals: `
      import { signalState, patchState } from '@ngrx/signals';
      import { addEntity, updateEntity } from '@ngrx/signals/entities';
      const store = signalState({ entityMap: {}, ids: [] });
      patchState(store, addEntity({ id: 1, name: 'a' }));
      patchState(store, updateEntity({ id: 1, changes: { name: 'b' } }));
      globalThis.__sink = [store.ids(), store.entityMap()[1]];
    `,
  },
];

async function measure(code) {
  const entry = join(directory, `entry-${Math.abs(hash(code))}.js`);
  writeFileSync(entry, code);
  try {
    const output = await build({
      entryPoints: [entry],
      bundle: true,
      minify: true,
      format: 'esm',
      platform: 'browser',
      treeShaking: true,
      external: ['@angular/*', 'rxjs', 'rxjs/*', 'tslib'],
      nodePaths: [REPO_NODE_MODULES],
      write: false,
      legalComments: 'none',
      logLevel: 'silent',
      define: { ngDevMode: 'false' },
    });
    return (
      gzipSync(Buffer.from(output.outputFiles[0].contents), { level: 9 })
        .length / 1024
    );
  } catch (error) {
    return { error: String(error.message).split('\n')[0].slice(0, 90) };
  }
}

function hash(value) {
  let result = 0;
  for (let index = 0; index < value.length; index++) {
    result = (Math.imul(31, result) + value.charCodeAt(index)) | 0;
  }
  return result;
}

const rows = [];
for (const scenario of SCENARIOS) {
  rows.push({
    capability: scenario.capability,
    signaltree: await measure(scenario.signaltree),
    ngrxSignals: await measure(scenario.ngrxSignals),
  });
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  const format = (value) =>
    typeof value === 'number' ? `${value.toFixed(2)} KB` : 'ERROR';
  console.log(
    '\ngzip, minified, tree-shaken, own code only (@angular, rxjs, tslib external)\n'
  );
  console.log(
    '  capability'.padEnd(57) +
      'SignalTree'.padStart(12) +
      '@ngrx/signals'.padStart(15) +
      '  ratio'
  );
  console.log('  ' + '─'.repeat(88));
  for (const row of rows) {
    const ratio =
      typeof row.signaltree === 'number' && typeof row.ngrxSignals === 'number'
        ? row.ngrxSignals > row.signaltree
          ? `${(row.ngrxSignals / row.signaltree).toFixed(2)}x ngrx`
          : `${(row.signaltree / row.ngrxSignals).toFixed(2)}x us`
        : '—';
    console.log(
      '  ' +
        row.capability.slice(0, 53).padEnd(55) +
        format(row.signaltree).padStart(12) +
        format(row.ngrxSignals).padStart(15) +
        `  ${ratio}`
    );
  }
  console.log(
    '\n  "ratio" names whichever package contribution is larger. Framework\n' +
      '  rendering, subscriptions, and unmatched history features are excluded.'
  );
}

const failedMeasurements = rows.flatMap((row) =>
  Object.entries(row)
    .filter(([key, value]) => key !== 'capability' && typeof value !== 'number')
    .map(
      ([key, value]) =>
        `${row.capability} / ${key}: ${value?.error ?? 'not measured'}`
    )
);
if (failedMeasurements.length > 0) {
  console.error(`\n${failedMeasurements.length} measurement(s) FAILED:`);
  for (const failure of failedMeasurements) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
