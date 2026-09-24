#!/usr/bin/env node
import { build } from 'esbuild';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const [mode, outputDirectory] = process.argv.slice(2);
if (!['baseline', 'current'].includes(mode) || !outputDirectory)
  throw new Error('Usage: baseline|current NEW_OUTPUT_DIRECTORY');
const output = resolve(outputDirectory);
if (existsSync(output))
  throw new Error('Preserve prior evidence: output exists');
mkdirSync(output, { recursive: true });
const hash = (value) => createHash('sha256').update(value).digest('hex');
const frozenPath =
  'docs/audits/2026-09-23-l15-retention/TEARDOWN-GC-FROZEN-v3.json';
const frozen = JSON.parse(readFileSync(resolve(root, frozenPath), 'utf8'));
const inputs = {};
for (const [path, expected] of Object.entries(frozen.sources)) {
  const actual = hash(readFileSync(resolve(root, path)));
  if (actual !== expected) throw new Error(`Frozen probe changed: ${path}`);
  inputs[path] = { source: 'working-tree', sha256: actual };
}
inputs[frozenPath] = {
  source: 'working-tree',
  sha256: hash(readFileSync(resolve(root, frozenPath))),
};
const bundle = await build({
  entryPoints: [
    resolve(root, 'tools/experiments/l15-retention/teardown-gc.ts'),
  ],
  absWorkingDir: root,
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  plugins: [
    {
      name: 'exact-unmodified-production',
      setup(builder) {
        builder.onLoad(
          { filter: /\/packages\/kernel\/src\/.*\.ts$/ },
          ({ path }) => {
            const name = relative(root, path);
            const contents =
              mode === 'baseline'
                ? execFileSync(
                    'git',
                    ['show', `${frozen.immutableHead}:${name}`],
                    { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
                  )
                : readFileSync(path, 'utf8');
            inputs[name] = {
              source:
                mode === 'baseline' ? frozen.immutableHead : 'working-tree',
              sha256: hash(contents),
            };
            return { contents, loader: 'ts', resolveDir: dirname(path) };
          }
        );
      },
    },
  ],
});
writeFileSync(resolve(output, 'candidate.mjs'), bundle.outputFiles[0].text);
writeFileSync(
  resolve(output, 'child.mjs'),
  `import {gcCase} from './candidate.mjs';import {writeFileSync} from 'node:fs';const [mode,path]=process.argv.slice(2);try{writeFileSync(path,JSON.stringify({...await gcCase(mode),pid:process.pid},null,2));}catch(error){writeFileSync(path,JSON.stringify({mode,status:'error',error:String(error),stack:error?.stack,pid:process.pid},null,2));process.exitCode=1;}`
);
const rows = [];
for (const scenario of frozen.scenarios) {
  const resultPath = resolve(output, `${scenario}.json`);
  const started = Date.now();
  const result = await new Promise((resolveResult) => {
    const child = spawn(
      process.execPath,
      [
        '--expose-gc',
        '--max-old-space-size=256',
        resolve(output, 'child.mjs'),
        scenario,
        resultPath,
      ],
      { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let log = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
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
      resolveResult({ scenario, status: 'error', error: String(error) });
    });
    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      writeFileSync(resolve(output, `${scenario}.log`), log);
      resolveResult({
        ...(existsSync(resultPath)
          ? JSON.parse(readFileSync(resultPath, 'utf8'))
          : { scenario, status: timedOut ? 'unable-to-complete' : 'error' }),
        exit: code,
        signal,
        elapsedMs: Date.now() - started,
      });
    });
  });
  rows.push(result);
  console.log(JSON.stringify(result));
}
const changedInputs = Object.entries(inputs)
  .filter(
    ([path, entry]) =>
      entry.source === 'working-tree' &&
      hash(readFileSync(resolve(root, path))) !== entry.sha256
  )
  .map(([path]) => path);
writeFileSync(
  resolve(output, 'RESULTS.json'),
  JSON.stringify(
    {
      mode,
      revision: frozen.immutableHead,
      inputs,
      bundleSha256: hash(bundle.outputFiles[0].text),
      productionInstrumentation: 'none',
      changedInputs,
      rows,
    },
    null,
    2
  )
);
process.exitCode = changedInputs.length
  ? 2
  : rows.some((row) => row.status !== 'held')
  ? 1
  : 0;
