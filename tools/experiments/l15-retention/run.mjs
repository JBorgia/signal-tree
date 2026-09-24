#!/usr/bin/env node
/** Non-shipping measurement runner. No checkout, dist writes, retention mutation or cap. */
import { build } from 'esbuild';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const [mode, outputDirectory] = process.argv.slice(2);
if (!['baseline', 'current'].includes(mode) || !outputDirectory)
  throw new Error(
    'Usage: node tools/experiments/l15-retention/run.mjs baseline|current NEW_OUTPUT_DIRECTORY'
  );
const output = resolve(outputDirectory);
if (existsSync(output))
  throw new Error('Output exists: preserve prior evidence.');
mkdirSync(output, { recursive: true });
const hash = (input) => createHash('sha256').update(input).digest('hex');
const frozenPath = 'docs/audits/2026-09-23-l15-retention/FROZEN.json';
const frozen = JSON.parse(readFileSync(resolve(root, frozenPath), 'utf8'));
const revision = frozen.immutableHead;
const inputs = {};
for (const [path, expected] of Object.entries(frozen.sources)) {
  const actual = hash(readFileSync(resolve(root, path)));
  if (actual !== expected)
    throw new Error(`Frozen instrument changed: ${path}`);
  inputs[path] = { source: 'working-tree', sha256: actual };
}
inputs[frozenPath] = {
  source: 'working-tree',
  sha256: hash(readFileSync(resolve(root, frozenPath))),
};
const instrumentation = [];
function once(source, anchor, replacement) {
  if (source.split(anchor).length !== 2)
    throw new Error(`Instrumentation anchor not unique: ${anchor}`);
  return source.replace(anchor, replacement);
}
function instrument(source) {
  const hasQueued = source.includes('private queuedEvidence =');
  const hasInspection = source.includes('const inspectionWrites =');
  const method = `
  __l15AuthorityCounts() {
    return {
      confirmedTurns: this.confirmedTurns.length,
      confirmedEffectSlots: this.confirmedTurns.reduce((n,t)=>n+(t.__effects?.length??0),0),
      confirmedBaselineEntries: this.confirmedTurns.reduce((n,t)=>n+(t.__baselineValues?.size??0),0),
      pendingTurns: this.pendingTurns.size,
      pendingOpened: this.pendingOpenedAtSeq.size,
      dependencyEffects: this.dependencyLedger.length,
      queuedBuckets: ${hasQueued ? 'this.queuedEvidence.size' : 'null'},
      queuedEffects: ${
        hasQueued
          ? '[...this.queuedEvidence.values()].reduce((n,m)=>n+m.size,0)'
          : 'null'
      }
    };
  }
`;
  const lens = `__l15Counts: () => ({
      ...authority.__l15AuthorityCounts(),
      pendingCaptureBuckets: pendingTransactions.size,
      pendingOrders: pendingOrderDeltas.size,
      captureEffects: pendingCapture.effects.size,
      captureBaselines: pendingCapture.baselineValues.size,
      descriptors: realizationDescriptors.size,
      lifecycleListeners: pendingCreatedListeners.size + pendingConfirmedListeners.size + pendingDiscardedListeners.size,
      inspectionWriters: ${hasInspection ? 'inspectionWrites.size' : 'null'},
      inspectionFootprints: ${
        hasInspection
          ? '[...inspectionWrites.values()].reduce((n,m)=>n+m.size,0)'
          : 'null'
      },
    }),
    `;
  const result = once(
    once(
      source,
      '  getConfirmedTurnCount(): number {',
      method + '  getConfirmedTurnCount(): number {'
    ),
    'getConfirmedTurnRecords: () => authority.getConfirmedTurnRecords(),',
    lens + 'getConfirmedTurnRecords: () => authority.getConfirmedTurnRecords(),'
  );
  instrumentation.push({
    path: 'packages/kernel/src/enhancers/transactions/transactions.ts',
    originalSha256: hash(source),
    instrumentedSha256: hash(result),
    operations:
      'Add two count-only methods; no retention writes, replacement or cap',
    unavailableCounts: {
      queuedEvidence: !hasQueued,
      inspection: !hasInspection,
    },
  });
  return result;
}
const bundle = await build({
  entryPoints: [resolve(root, 'tools/experiments/l15-retention/probe.ts')],
  absWorkingDir: root,
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  plugins: [
    {
      name: 'immutable-source-and-count-only-instrumentation',
      setup(builder) {
        builder.onLoad(
          { filter: /\/packages\/kernel\/src\/.*\.ts$/ },
          ({ path }) => {
            const name = relative(root, path);
            const original =
              mode === 'baseline'
                ? execFileSync('git', ['show', `${revision}:${name}`], {
                    cwd: root,
                    encoding: 'utf8',
                    maxBuffer: 32 * 1024 * 1024,
                  })
                : readFileSync(path, 'utf8');
            inputs[name] = {
              source: mode === 'baseline' ? revision : 'working-tree',
              sha256: hash(original),
            };
            const contents =
              name ===
              'packages/kernel/src/enhancers/transactions/transactions.ts'
                ? instrument(original)
                : original;
            return { contents, loader: 'ts', resolveDir: dirname(path) };
          }
        );
      },
    },
  ],
});
const bundlePath = resolve(output, 'candidate.mjs');
writeFileSync(bundlePath, bundle.outputFiles[0].text);
const childPath = resolve(output, 'child.mjs');
writeFileSync(
  childPath,
  `import {runCase} from './candidate.mjs';
const [id,diagnostics,result]=process.argv.slice(2);
const start=Date.now();
try { const row=await runCase(id,diagnostics==='true'); (await import('node:fs')).writeFileSync(result,JSON.stringify({...row,pid:process.pid,elapsedMs:Date.now()-start},null,2)); }
catch(error){ (await import('node:fs')).writeFileSync(result,JSON.stringify({id,diagnostics:diagnostics==='true',status:'error',message:String(error),stack:error?.stack,pid:process.pid,elapsedMs:Date.now()-start},null,2)); process.exitCode=1; }
`
);
const rows = [];
// One fresh child at a time, never a worker pool. A timeout is not a pass.
for (const id of frozen.cases) {
  for (const diagnostics of id === 'R06' ? [false, true] : [false]) {
    const name = `${id}-${diagnostics ? 'diagnostics' : 'plain'}`;
    const resultPath = resolve(output, `${name}.json`);
    const logPath = resolve(output, `${name}.log`);
    const started = Date.now();
    const result = await new Promise((resolveResult) => {
      const child = spawn(
        process.execPath,
        [
          '--expose-gc',
          '--max-old-space-size=1024',
          childPath,
          id,
          String(diagnostics),
          resultPath,
        ],
        { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] }
      );
      let log = '';
      let timeout = false;
      const timer = setTimeout(() => {
        timeout = true;
        child.kill('SIGKILL');
      }, frozen.timeoutMs);
      child.stdout.on('data', (data) => {
        log += data;
      });
      child.stderr.on('data', (data) => {
        log += data;
      });
      child.on('error', (error) => {
        clearTimeout(timer);
        resolveResult({
          id,
          diagnostics,
          status: 'error',
          message: String(error),
        });
      });
      child.on('exit', (code, signal) => {
        clearTimeout(timer);
        writeFileSync(logPath, log);
        const row = existsSync(resultPath)
          ? JSON.parse(readFileSync(resultPath, 'utf8'))
          : {
              id,
              diagnostics,
              status: timeout ? 'unable-to-complete' : 'error',
              message: timeout
                ? `Hard timeout ${frozen.timeoutMs}ms`
                : 'No complete child evidence',
            };
        resolveResult({
          ...row,
          childExit: code,
          signal,
          elapsedMs: Date.now() - started,
        });
      });
    });
    rows.push(result);
    console.log(
      JSON.stringify({
        mode,
        id,
        diagnostics,
        status: result.status,
        elapsedMs: result.elapsedMs,
        findings: result.findings,
        message: result.message,
      })
    );
  }
}
const comparison = rows.filter((row) => row.id === 'R06');
const diagnosticParity =
  comparison.length === 2 && comparison.every((row) => row.status === 'held')
    ? JSON.stringify(comparison[0].outcomes) ===
      JSON.stringify(comparison[1].outcomes)
    : null;
const changedInputs = Object.entries(inputs)
  .filter(
    ([path, record]) =>
      record.source === 'working-tree' &&
      hash(readFileSync(resolve(root, path))) !== record.sha256
  )
  .map(([path]) => path);
const report = {
  mode,
  revision,
  timestamp: new Date().toISOString(),
  frozen: frozenPath,
  inputs,
  instrumentation,
  bundleSha256: hash(bundle.outputFiles[0].text),
  changedInputs,
  diagnosticParity,
  rows,
  scope:
    'Bounded characterization, not a retention policy or whole-law proof. null counters mean unavailable, never zero. Heap is fresh-process measured with a live tree/runtime, not attributable bytes per subsystem.',
};
writeFileSync(resolve(output, 'RESULTS.json'), JSON.stringify(report, null, 2));
process.exitCode = changedInputs.length
  ? 2
  : rows.some((row) => row.status !== 'held') || diagnosticParity !== true
  ? 1
  : 0;
