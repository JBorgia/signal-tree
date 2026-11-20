/**
 * The CLI's comparison paths end to end: not applicable, A/A noise, a
 * regression against a baseline, noise widening the threshold, and red gates
 * failing the exit status unless recording. M2 on the fake subject is the
 * cheapest scenario that runs; slowRead makes its reads slower.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import type { ResultsFile } from '../runner/harness.ts';
import { tempOut } from './helpers.ts';

const CLI = fileURLToPath(new URL('../runner/cli.ts', import.meta.url));

function bench(args: string[], faults = ''): { status: number | null; file: ResultsFile; out: string } {
  const out = tempOut();
  const result = spawnSync(process.execPath, [CLI, ...args, '--out', out], {
    encoding: 'utf8',
    env: { ...process.env, BENCH_FAKE_FAULTS: faults },
  });
  const subject = args[args.indexOf('--subject') + 1]!;
  // File names are part of the contract: <kind>-<subject>-latest.json.
  const kind = args.includes('--aa') ? 'aa' : 'results';
  const file = JSON.parse(readFileSync(join(out, `${kind}-${subject}-latest.json`), 'utf8')) as ResultsFile;
  return { status: result.status, file, out: result.stdout + result.stderr };
}

let aaPath = '';

before(() => {
  const aa = bench(['M2', '--subject', 'test-fake', '--aa', '--record-only']);
  assert.equal(aa.status, 0, aa.out);
  aaPath = join(tempOut(), 'aa.json');
  writeFileSync(aaPath, JSON.stringify(aa.file));
});

test('a subject without the capabilities reports not applicable and runs nothing', () => {
  const { status, file } = bench(['S3', 'S4', 'S5', 'S6', 'S7', '--subject', 'v15-shim']);
  assert.equal(status, 0);
  for (const id of ['S3', 'S4a', 'S4b', 'S4c', 'S5', 'S6b', 'S7']) {
    assert.equal(file.scenarios[id]!.status, 'not-applicable', id);
    assert.ok(file.scenarios[id]!.missingCapabilities!.length > 0);
  }
  assert.equal(file.scenarios['S6a']!.status, 'external');
  assert.equal(file.scenarios['S6c']!.status, 'external');
});

test('A/A mode records two sets of five runs and the noise of every metric', () => {
  const file = JSON.parse(readFileSync(aaPath, 'utf8')) as ResultsFile;
  const m2 = file.scenarios['M2']!;
  assert.equal(m2.runs!.length, 10);
  assert.deepEqual(new Set(m2.runs!.map((r) => r.set)), new Set(['A', 'B']));
  assert.ok(Number.isFinite(m2.aa!.noise.relative['readRatioVsNative']));
  assert.ok(m2.median!['readRatioVsNative']! > 0);
});

test('a median worse than the baseline by more than max(3%, noise) is a regression and fails the run', () => {
  const { status, file } = bench(['M2', '--subject', 'test-fake', '--baseline', aaPath, '--record-only'], 'slowRead');
  const regression = file.scenarios['M2']!.regressions!.find((r) => r.metric === 'readRatioVsNative')!;
  assert.equal(regression.regressed, true);
  assert.ok(regression.threshold >= 0.03);
  assert.equal(status, 1, 'a regression fails the run even when recording');
});

test('A/A noise above the change widens the threshold, so the same change is not a regression', () => {
  const wide = JSON.parse(readFileSync(aaPath, 'utf8')) as ResultsFile;
  wide.scenarios['M2']!.aa!.noise = { relative: { readRatioVsNative: 1000, subjectReadNs: 1000 }, absolute: {}, zero: [] };
  const noisePath = join(tempOut(), 'noise.json');
  writeFileSync(noisePath, JSON.stringify(wide));
  const { status, file } = bench(['M2', '--subject', 'test-fake', '--baseline', aaPath, '--noise', noisePath, '--record-only'], 'slowRead');
  for (const regression of file.scenarios['M2']!.regressions!) assert.equal(regression.regressed, false, regression.metric);
  assert.equal(status, 0);
});

test('a red gate fails the run unless --record-only', () => {
  const red = bench(['M2', '--subject', 'test-fake'], 'slowRead');
  assert.equal(red.file.scenarios['M2']!.pass, false);
  assert.equal(red.file.recordOnly, false);
  assert.equal(red.status, 1);
});

test('results files keep the contract ci/done-check.mjs reads', () => {
  const { file } = bench(['M2', 'S3', 'S6a', 'S6c', 'S7', '--subject', 'v15-shim', '--record-only']);
  assert.equal(typeof file.budgets.approved, 'boolean');
  assert.equal(file.recordOnly, !file.budgets.approved, 'record-only is in effect only while unapproved');
  assert.equal(file.subject.id, 'v15-shim');
  for (const result of Object.values(file.scenarios)) {
    assert.ok(['ran', 'not-applicable', 'external', 'error'].includes(result.status), result.id);
    assert.ok(Array.isArray(result.conditions) && Array.isArray(result.regressions), result.id);
    if (result.status === 'ran' || result.status === 'error') assert.equal(typeof result.pass, 'boolean', result.id);
  }
  assert.equal(file.scenarios['M2']!.status, 'ran');
  assert.equal(file.scenarios['S3']!.status, 'not-applicable');
  assert.equal(file.scenarios['S6a']!.status, 'external');
});
