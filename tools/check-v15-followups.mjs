#!/usr/bin/env node
/**
 * Installed-artifact proof: two initial fixes + nine composition cases must pass.
 * Baseline is immutable npm 15.3.1. Never builds, mutates source, or accepts a
 * candidate failure as an expected release pass. Evidence survives failures.
 *
 * node tools/check-v15-followups.mjs [--candidate path.tgz] [--baseline path.tgz]
 * node tools/check-v15-followups.mjs --self-test
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = realpathSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '..')
);
const BASELINE = '@signal-tree/kernel@15.3.1';
const BASELINE_SHA512 =
  'sha512-JqnkXpTZVvmuzQLBjskfst9wn87mOfjLweikKazkiO8OULCzMsPuhCLVfsWbUwn5DJcrI3HmZyY/p/zGSJ+6uQ==';
const INITIAL = [
  'Link settled waits for asynchronous endpoint',
  'setAll duplicate empty key warns and retains last value',
];
const COMPOSITION = [
  'literal dotted branch field remains distinct through Link',
  'entity rollback preserves exact keys (string:jo.doe@example.com)',
  'entity rollback preserves exact keys (string:1.2.3)',
  'entity rollback preserves exact keys (number:1)',
  'entity rollback preserves exact keys (string:1)',
  'outer coalesce retains transaction settlement authority',
  'external classification survives deferred undo designation',
  'undo and redo reach a linked collection with correct membership',
  'whole-branch omission rollback restores presence and value',
];
// These are baseline-only diagnostics. They never authorize a candidate failure.
const BASELINE_FAILURES = COMPOSITION.map((_, i) =>
  i >= 1 && i <= 4
    ? /^SignalTreeRollbackError: SignalTree could not rollback the pending transaction: compensating turn 2 failed validation — Transaction rollback refused: structural-drift \[effect-validation-failed\]$/
    : /^AssertionError \[ERR_ASSERTION\]: Expected values to be strictly (?:deep-)?equal:/
);
const FIXTURES = ['v15-followup-consumer.mjs', 'v15-composition-consumer.mjs'];
const json = (path, value) =>
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
const sha512 = (path) =>
  'sha512-' + createHash('sha512').update(readFileSync(path)).digest('base64');
function baselineIntegrity(integrity) {
  assert.equal(
    integrity,
    BASELINE_SHA512,
    'Baseline tarball integrity mismatch'
  );
}
function inspect(run, exitCode, label) {
  assert.equal(run.signal, null, `${label}: process signal`);
  assert.equal(run.error, null, `${label}: process error/timeout`);
  assert.equal(run.exitCode, exitCode, `${label}: unexpected fixture exit`);
  assert.equal(run.stderr, '', `${label}: unexpected stderr`);
  return JSON.parse(run.stdout);
}
function classify(baseline, candidate) {
  for (const [label, arm, expected] of [
    ['baseline', baseline, 'published'],
    ['candidate', candidate, 'fixed'],
  ]) {
    const initial = inspect(arm.initial, 0, `${label} initial`);
    // The unchanged initial fixture asserts both cases before emitting this exact
    // aggregate. Do not infer passes from absent output or a successful exit alone.
    assert.deepEqual(
      initial,
      {
        arm: expected,
        settledBeforeEndpointFinished: expected === 'published',
        duplicateWarnings: expected === 'published' ? 0 : 1,
        lastValueWins: true,
      },
      `${label}: two initial case evidence fields`
    );
    const composition = inspect(
      arm.composition,
      label === 'baseline' ? 1 : 0,
      `${label} composition`
    );
    assert.equal(
      composition.entry,
      arm.entry,
      `${label}: fixture must load the installed entry`
    );
    assert.ok(Array.isArray(composition.cases), `${label}: missing cases`);
    assert.deepEqual(
      composition.cases.map((row) => row.name).sort(),
      [...COMPOSITION].sort(),
      `${label}: missing, duplicate or extra composition case`
    );
    assert.equal(
      composition.passed,
      label === 'baseline' ? 0 : 9,
      `${label}: exact pass count`
    );
    assert.equal(
      composition.failed,
      label === 'baseline' ? 9 : 0,
      `${label}: exact failure count`
    );
    for (const name of COMPOSITION) {
      const row = composition.cases.find((row) => row.name === name);
      if (label === 'candidate')
        assert.deepEqual(
          row,
          { name, status: 'passed' },
          `candidate: regression ${name}`
        );
      else {
        assert.equal(
          row.status,
          'failed',
          `baseline: expected reproduction ${name}`
        );
        assert.equal(
          typeof row.error,
          'string',
          `baseline: missing failure evidence ${name}`
        );
        assert.match(
          row.error,
          BASELINE_FAILURES[COMPOSITION.indexOf(name)],
          `baseline: unexpected failure ${name}`
        );
      }
    }
  }
  return {
    accepted: true,
    candidatePassed: 11,
    candidateFailed: 0,
    initial: INITIAL,
    composition: COMPOSITION,
    baseline: { initialDefectsReproduced: 2, compositionFailed: 9 },
    summary:
      '11/11 candidate passes (2 initial fixes + 9 composition); pinned 15.3.1 reproduces all 11 defects',
  };
}
function selfTest() {
  const run = (data, exitCode = 0) => ({
    exitCode,
    signal: null,
    error: null,
    stderr: '',
    stdout: JSON.stringify(data),
  });
  const arm = (baseline) => ({
    entry: '/isolated/node_modules/@signal-tree/kernel/dist/index.js',
    initial: run({
      arm: baseline ? 'published' : 'fixed',
      settledBeforeEndpointFinished: baseline,
      duplicateWarnings: baseline ? 0 : 1,
      lastValueWins: true,
    }),
    composition: run(
      {
        entry: '/isolated/node_modules/@signal-tree/kernel/dist/index.js',
        passed: baseline ? 0 : 9,
        failed: baseline ? 9 : 0,
        cases: COMPOSITION.map((name, i) =>
          baseline
            ? {
                name,
                status: 'failed',
                error:
                  i >= 1 && i <= 4
                    ? 'SignalTreeRollbackError: SignalTree could not rollback the pending transaction: compensating turn 2 failed validation — Transaction rollback refused: structural-drift [effect-validation-failed]'
                    : 'AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal: synthetic mismatch',
              }
            : { name, status: 'passed' }
        ),
      },
      baseline ? 1 : 0
    ),
  });
  const baseline = arm(true),
    candidate = arm(false),
    rejected = [];
  assert.equal(classify(baseline, candidate).candidatePassed, 11);
  const rejects = (name, mutate) => {
    const b = structuredClone(baseline),
      c = structuredClone(candidate);
    mutate(b, c);
    assert.throws(() => classify(b, c), undefined, `accepted ${name}`);
    rejected.push(name);
  };
  const edit = (run, mutate) => {
    const data = JSON.parse(run.stdout);
    mutate(data);
    run.stdout = JSON.stringify(data);
  };
  for (const label of ['baseline', 'candidate'])
    for (const fixture of ['initial', 'composition']) {
      const target = (b, c) => (label === 'baseline' ? b : c)[fixture];
      for (const [field, value] of [
        ['signal', 'SIGKILL'],
        ['error', 'ETIMEDOUT'],
        ['stderr', 'unhandled error'],
        ['stdout', ''],
        ['exitCode', 23],
      ])
        rejects(`${label} ${fixture} ${field}`, (b, c) => {
          target(b, c)[field] = value;
        });
    }
  for (const label of ['baseline', 'candidate']) {
    const result = (b, c) => (label === 'baseline' ? b : c).composition;
    rejects(`${label} missing case`, (b, c) =>
      edit(result(b, c), (d) => d.cases.pop())
    );
    rejects(`${label} duplicate case`, (b, c) =>
      edit(result(b, c), (d) => {
        d.cases[1] = d.cases[0];
      })
    );
    rejects(`${label} extra case`, (b, c) =>
      edit(result(b, c), (d) => d.cases.push(d.cases[0]))
    );
    rejects(`${label} falsified count`, (b, c) =>
      edit(result(b, c), (d) => d.passed++)
    );
    rejects(`${label} foreign source entry`, (b, c) =>
      edit(result(b, c), (d) => {
        d.entry = '/workspace/source/index.js';
      })
    );
  }
  for (let i = 0; i < COMPOSITION.length; i++)
    rejects(`candidate regression ${i + 1}`, (_b, c) =>
      edit(c.composition, (d) => {
        d.cases[i] = {
          name: COMPOSITION[i],
          status: 'failed',
          error: 'AssertionError [ERR_ASSERTION]: expected failure',
        };
      })
    );
  rejects('expected-failure exit masking', (_b, c) => {
    c.composition = structuredClone(baseline.composition);
  });
  rejects('unexpected baseline failure', (b) =>
    edit(b.composition, (d) => {
      d.cases[0].error = 'TypeError: import broke';
    })
  );
  rejects('first initial regression', (_b, c) =>
    edit(c.initial, (d) => {
      d.settledBeforeEndpointFinished = true;
    })
  );
  rejects('second initial regression', (_b, c) =>
    edit(c.initial, (d) => {
      d.duplicateWarnings = 0;
    })
  );
  rejects('last value regression', (_b, c) =>
    edit(c.initial, (d) => {
      d.lastValueWins = false;
    })
  );
  rejects('missing initial evidence', (_b, c) =>
    edit(c.initial, (d) => {
      delete d.duplicateWarnings;
    })
  );
  rejects('extra initial evidence', (_b, c) =>
    edit(c.initial, (d) => {
      d.ignoredFailure = true;
    })
  );
  rejects('candidate error hidden behind pass', (_b, c) =>
    edit(c.composition, (d) => {
      d.cases[0].error = 'cleanup failed';
    })
  );
  baselineIntegrity(BASELINE_SHA512);
  assert.throws(() => baselineIntegrity('sha512-tampered'));
  rejected.push('wrong baseline checksum');
  console.log(JSON.stringify({ selfTest: 'pass', rejected }, null, 2));
}
function options() {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    const flag = process.argv[i];
    assert.ok(
      ['--candidate', '--baseline', '--self-test'].includes(flag),
      `Unknown option ${flag}`
    );
    assert.equal(args[flag], undefined, `Duplicate option ${flag}`);
    if (flag === '--self-test') args[flag] = true;
    else {
      const path = process.argv[++i];
      assert.ok(
        path && !path.startsWith('--') && path.endsWith('.tgz'),
        `${flag} requires path.tgz`
      );
      args[flag] = realpathSync(resolve(path));
    }
  }
  if (args['--self-test'])
    assert.equal(
      Object.keys(args).length,
      1,
      '--self-test runs without artifacts'
    );
  return args;
}
function main(args) {
  const tempRoot = realpathSync(tmpdir()),
    rel = relative(ROOT, tempRoot);
  assert.ok(
    rel.startsWith('..') || isAbsolute(rel),
    'Temporary consumers must be outside the repository'
  );
  const output = mkdtempSync(join(tempRoot, 'st-v15-followups-'));
  console.log(`Raw logs: ${output}`);
  // Duplicate-ID diagnostics are a development contract; fixtures use the same
  // explicit environment for the published and candidate arms.
  const env = { ...process.env, NODE_ENV: 'development' };
  delete env.NODE_OPTIONS;
  delete env.NODE_PATH;
  const command = (label, executable, argv, cwd, timeout = 45000) => {
    const run = spawnSync(executable, argv, {
      cwd,
      env,
      encoding: 'utf8',
      timeout,
      killSignal: 'SIGKILL',
      maxBuffer: 8 * 1024 * 1024,
    });
    const result = {
      exitCode: run.status,
      signal: run.signal,
      error: run.error ? String(run.error) : null,
      stdout: run.stdout ?? '',
      stderr: run.stderr ?? '',
    };
    writeFileSync(join(output, `${label}.stdout.log`), result.stdout);
    writeFileSync(join(output, `${label}.stderr.log`), result.stderr);
    json(join(output, `${label}.process.json`), {
      executable,
      argv,
      cwd,
      exitCode: result.exitCode,
      signal: result.signal,
      error: result.error,
    });
    return result;
  };
  const requireSuccess = (run, label) => {
    assert.ok(
      run.exitCode === 0 && run.signal === null && run.error === null,
      `${label} failed; inspect ${output}`
    );
    return run.stdout;
  };
  const metadata = {
    baselineSpec: BASELINE,
    baselineIntegrity: BASELINE_SHA512,
    node: process.version,
    environment: env.NODE_ENV,
    output,
    startedAt: new Date().toISOString(),
    artifacts: {},
    fixtures: {},
  };
  try {
    metadata.sourceHEAD = requireSuccess(
      command('source-head', 'git', ['rev-parse', 'HEAD'], ROOT),
      'source HEAD'
    ).trim();
    metadata.sourceStatus = requireSuccess(
      command('source-status', 'git', ['status', '--porcelain'], ROOT),
      'source status'
    );
    metadata.provenanceNote =
      'Checkout metadata does not prove existing dist or supplied tarballs were built from this source. No builds performed.';
    for (const fixture of FIXTURES) {
      copyFileSync(
        join(ROOT, 'tools/fixtures', fixture),
        join(output, fixture)
      );
      metadata.fixtures[fixture] = sha512(join(output, fixture));
    }
    json(join(output, 'metadata.json'), metadata);
    const artifact = (label, supplied, spec) => {
      const destination = join(output, `${label}-artifact`);
      mkdirSync(destination);
      let tarball;
      if (supplied) {
        tarball = join(destination, `${label}.tgz`);
        copyFileSync(supplied, tarball);
      } else {
        const packed = JSON.parse(
          requireSuccess(
            command(
              `${label}-pack`,
              'npm',
              [
                'pack',
                spec,
                '--ignore-scripts',
                '--json',
                '--pack-destination',
                destination,
                '--fetch-retries=0',
                '--fetch-timeout=20000',
              ],
              output
            ),
            `${label} pack`
          )
        );
        assert.equal(packed.length, 1);
        tarball = join(destination, packed[0].filename);
      }
      const integrity = sha512(tarball);
      metadata.artifacts[label] = {
        input: supplied ?? spec,
        tarball,
        sha512: integrity,
      };
      json(join(output, 'metadata.json'), metadata);
      if (label === 'baseline') baselineIntegrity(integrity);
      return tarball;
    };
    const baseline = artifact('baseline', args['--baseline'], BASELINE);
    const candidate = artifact(
      'candidate',
      args['--candidate'],
      join(ROOT, 'dist/packages/kernel')
    );
    const consumer = (label, tarball) => {
      const cwd = join(output, `${label}-consumer`);
      mkdirSync(cwd);
      json(join(cwd, 'package.json'), {
        name: `v15-followups-${label}`,
        version: '0.0.0',
        private: true,
        type: 'module',
        dependencies: {
          '@signal-tree/kernel': `file:${tarball}`,
          tslib: '2.8.1',
        },
      });
      for (const fixture of FIXTURES)
        copyFileSync(join(output, fixture), join(cwd, fixture));
      requireSuccess(
        command(
          `${label}-install`,
          'npm',
          [
            'install',
            '--ignore-scripts',
            '--no-audit',
            '--no-fund',
            '--prefer-offline',
            '--fetch-retries=0',
            '--fetch-timeout=20000',
          ],
          cwd
        ),
        `${label} install`
      );
      const installedRoot = join(cwd, 'node_modules/@signal-tree/kernel');
      assert.equal(
        realpathSync(installedRoot),
        installedRoot,
        `${label}: installed kernel must not be a workspace symlink`
      );
      const installed = JSON.parse(
        readFileSync(join(installedRoot, 'package.json'), 'utf8')
      );
      assert.equal(installed.name, '@signal-tree/kernel');
      if (label === 'baseline') assert.equal(installed.version, '15.3.1');
      const lock = JSON.parse(
        readFileSync(join(cwd, 'package-lock.json'), 'utf8')
      );
      assert.deepEqual(
        Object.keys(lock.packages).filter((path) =>
          path.endsWith('node_modules/@signal-tree/kernel')
        ),
        ['node_modules/@signal-tree/kernel'],
        `${label}: exactly one installed kernel`
      );
      assert.equal(
        lock.packages['node_modules/@signal-tree/kernel'].integrity,
        metadata.artifacts[label].sha512,
        `${label}: installed tarball integrity`
      );
      const resolved = requireSuccess(
        command(
          `${label}-resolve`,
          process.execPath,
          [
            '--input-type=module',
            '-e',
            "console.log(import.meta.resolve('@signal-tree/kernel'))",
          ],
          cwd
        ),
        `${label} resolve`
      ).trim();
      const entry = realpathSync(fileURLToPath(resolved));
      const inside = relative(installedRoot, entry);
      assert.ok(
        inside && !inside.startsWith('..') && !isAbsolute(inside),
        `${label}: entry must resolve inside installed kernel`
      );
      metadata.artifacts[label].version = installed.version;
      metadata.artifacts[label].entry = entry;
      json(join(output, 'metadata.json'), metadata);
      const initial = command(
        `${label}-initial`,
        process.execPath,
        [FIXTURES[0], entry, label === 'baseline' ? 'published' : 'fixed'],
        cwd,
        15000
      );
      const composition = command(
        `${label}-composition`,
        process.execPath,
        [FIXTURES[1], entry],
        cwd,
        15000
      );
      return { entry, initial, composition };
    };
    const baselineRun = consumer('baseline', baseline),
      candidateRun = consumer('candidate', candidate);
    const report = classify(baselineRun, candidateRun);
    json(join(output, 'comparison.json'), report);
    console.log(report.summary);
  } catch (error) {
    json(join(output, 'comparison.json'), {
      accepted: false,
      error: String(error),
    });
    console.error(String(error));
    process.exitCode = 1;
  } finally {
    metadata.finishedAt = new Date().toISOString();
    json(join(output, 'metadata.json'), metadata);
  }
}
try {
  const args = options();
  if (args['--self-test']) selfTest();
  else main(args);
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
}
