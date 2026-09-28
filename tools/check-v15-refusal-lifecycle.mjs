#!/usr/bin/env node
/**
 * Compare the same bounded lifecycle fixture in isolated packed consumers.
 * Uses existing dist only; never builds or repairs artifacts. All evidence is
 * retained in the printed external temporary directory, including on failure.
 *
 * node tools/check-v15-refusal-lifecycle.mjs [--candidate path.tgz] [--baseline path.tgz]
 * node tools/check-v15-refusal-lifecycle.mjs --self-test
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
const BASELINE = '@signal-tree/kernel@15.3.0';
const BASELINE_SHA512 =
  'sha512-zkfXzRuEqVL9hezRP5uuZq7rZiT3EULYlz5knBG+jJNAb3sQSz9PVBIKcW57E6juoh60c3KEHdsCc3kMP5E7WA==';
const PRESERVED = [
  'replacement/confirm',
  'replacement/resolve-retry',
  'dependent-add/confirm',
];
const FIXED = [
  'planner-pending-overlap-resolve-retry',
  'two-links-confirm',
  'throwing-observer-handle-and-later-link',
  'confirmed-transaction-undo-redo-link',
  'automatic-refusal-history-before-link',
];
const LIMITATIONS = ['dependent-add/resolve-retry', 'restored-entity-link'];
const NAMES = [...PRESERVED, ...FIXED, ...LIMITATIONS];
const REFUSAL_ERROR =
  'AssertionError [ERR_ASSERTION]: conservative confirmed dependency still refuses after later removal';
const before = {
  x: 1,
  rows: [{ id: 'A', name: 'later' }],
  sent: [],
  confirmedX: 0,
  canUndo: false,
};
const refusal = { kind: 'later-confirmed-dependency', ...before, sent: [1] };
const DEPENDENT_EVIDENCE = {
  before,
  refusals: [refusal, refusal],
  remainingRefusal: {
    kind: 'later-confirmed-dependency',
    safetyVerified: true,
    final: { x: 1, rows: [], sent: [1], confirmedX: 1, canUndo: true },
  },
};
const RESTORED_EVIDENCE = {
  state: [{ id: 'A', name: 'original' }],
  sent: [[]],
};

function inspectRun(run, label) {
  assert.equal(run.signal, null, `${label}: process signal`);
  assert.equal(run.error, null, `${label}: process error/timeout`);
  assert.equal(
    run.exitCode,
    1,
    `${label}: expected fixture failure exit for known limitations`
  );
  assert.equal(run.stderr, '', `${label}: unexpected stderr`);
  const { results, uncaught, reportedErrors } = run.data;
  assert.deepEqual(uncaught, [], `${label}: uncaught exception`);
  assert.ok(
    Number.isInteger(reportedErrors) && reportedErrors >= 0,
    `${label}: malformed reportedErrors`
  );
  assert.ok(Array.isArray(results), `${label}: missing results`);
  assert.deepEqual(
    results.map((r) => r.name).sort(),
    [...NAMES].sort(),
    `${label}: missing, duplicate or extra case`
  );
  for (const row of results) {
    assert.equal(
      typeof row.pass,
      'boolean',
      `${label}: malformed result ${row.name}`
    );
    assert.ok(
      row.evidence && typeof row.evidence === 'object',
      `${label}: missing evidence ${row.name}`
    );
    if (row.pass)
      assert.equal(row.error, undefined, `${label}: passing row has error`);
    else
      assert.ok(
        typeof row.error === 'string' &&
          row.error.startsWith('AssertionError [ERR_ASSERTION]:'),
        `${label}: unexpected failure ${row.name}`
      );
  }
  return new Map(results.map((row) => [row.name, row]));
}

function boundedLimitation(row) {
  assert.equal(row.pass, false, `${row.name}: expected unchanged limitation`);
  if (row.name === LIMITATIONS[0]) {
    assert.equal(
      row.error,
      REFUSAL_ERROR,
      'dependent-add: failure reason changed'
    );
    assert.deepEqual(
      row.evidence,
      DEPENDENT_EVIDENCE,
      'dependent-add: unsafe or changed bounded evidence'
    );
  } else {
    assert.match(
      row.error,
      /^AssertionError \[ERR_ASSERTION\]: Expected values to be strictly deep-equal:/
    );
    assert.deepEqual(
      row.evidence,
      RESTORED_EVIDENCE,
      'restored entity: row state or endpoint mismatch changed'
    );
  }
}

function classify(baseline, candidate) {
  const b = inspectRun(baseline, 'baseline');
  const c = inspectRun(candidate, 'candidate');
  for (const name of PRESERVED)
    assert.equal(b.get(name).pass, true, `baseline: expected pass ${name}`);
  for (const name of FIXED)
    assert.equal(
      b.get(name).pass,
      false,
      `baseline: expected fixed failure ${name}`
    );
  for (const name of [...PRESERVED, ...FIXED])
    assert.equal(c.get(name).pass, true, `candidate: regression ${name}`);
  for (const name of LIMITATIONS) {
    boundedLimitation(b.get(name));
    boundedLimitation(c.get(name));
    assert.deepEqual(
      c.get(name),
      b.get(name),
      `${name}: limitation differs from baseline`
    );
  }
  return {
    accepted: true,
    summary: `${FIXED.length} fixed, ${PRESERVED.length} pass, ${
      LIMITATIONS.length
    } unchanged limitations (${
      FIXED.length + PRESERVED.length
    } candidate passes; not ${NAMES.length}/${NAMES.length} green)`,
    fixed: FIXED,
    pass: PRESERVED,
    unchangedLimitations: LIMITATIONS,
  };
}

function selfTest() {
  const row = (name, pass) => ({
    name,
    pass,
    evidence: {},
    ...(pass
      ? {}
      : { error: 'AssertionError [ERR_ASSERTION]: synthetic failure' }),
  });
  const baseline = {
    exitCode: 1,
    signal: null,
    error: null,
    stderr: '',
    data: {
      results: NAMES.map((name) => row(name, PRESERVED.includes(name))),
      uncaught: [],
      reportedErrors: 0,
    },
  };
  const lookup = (run, name) => run.data.results.find((r) => r.name === name);
  Object.assign(lookup(baseline, LIMITATIONS[0]), {
    error: REFUSAL_ERROR,
    evidence: structuredClone(DEPENDENT_EVIDENCE),
  });
  Object.assign(lookup(baseline, LIMITATIONS[1]), {
    error:
      'AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal: synthetic mismatch',
    evidence: structuredClone(RESTORED_EVIDENCE),
  });
  const candidate = structuredClone(baseline);
  for (const name of FIXED)
    Object.assign(lookup(candidate, name), row(name, true));
  for (const name of FIXED) delete lookup(candidate, name).error;
  assert.equal(classify(baseline, candidate).accepted, true);
  const checks = [];
  const rejects = (name, mutate) => {
    const b = structuredClone(baseline),
      c = structuredClone(candidate);
    mutate(b, c);
    assert.throws(
      () => classify(b, c),
      undefined,
      `classifier accepted ${name}`
    );
    checks.push(name);
  };
  rejects('new regression', (_b, c) =>
    Object.assign(lookup(c, FIXED[0]), row(FIXED[0], false))
  );
  rejects('missing case', (_b, c) => c.data.results.pop());
  rejects('extra cleanup failure', (_b, c) =>
    c.data.results.push(row('case:cleanup', false))
  );
  rejects('duplicate case', (_b, c) => c.data.results.push(c.data.results[0]));
  rejects('uncaught candidate', (_b, c) =>
    c.data.uncaught.push('Error: unexpected')
  );
  rejects('uncaught baseline', (b) =>
    b.data.uncaught.push('Error: unexpected')
  );
  rejects('unsafe known limitation', (_b, c) => {
    lookup(c, LIMITATIONS[0]).evidence.remainingRefusal.safetyVerified = false;
  });
  rejects('missing safety evidence', (_b, c) => {
    delete lookup(c, LIMITATIONS[0]).evidence.remainingRefusal;
  });
  rejects('changed refusal reason', (_b, c) => {
    lookup(c, LIMITATIONS[0]).evidence.remainingRefusal.kind = 'other';
  });
  rejects('changed refusal state', (_b, c) => {
    lookup(c, LIMITATIONS[0]).evidence.remainingRefusal.final.x = 2;
  });
  rejects('changed restored row', (_b, c) => {
    lookup(c, LIMITATIONS[1]).evidence.state = [];
  });
  rejects('changed endpoint mismatch', (_b, c) => {
    lookup(c, LIMITATIONS[1]).evidence.sent.push([{ id: 'B' }]);
  });
  rejects('equally unsafe baseline and candidate', (b, c) => {
    for (const run of [b, c])
      lookup(
        run,
        LIMITATIONS[0]
      ).evidence.remainingRefusal.safetyVerified = false;
  });
  rejects('unexpected baseline pass', (b) =>
    Object.assign(lookup(b, FIXED[0]), row(FIXED[0], true))
  );
  rejects('process crash', (_b, c) => {
    c.signal = 'SIGKILL';
  });
  rejects('process timeout', (_b, c) => {
    c.error = 'ETIMEDOUT';
  });
  rejects('wrong exit', (_b, c) => {
    c.exitCode = 0;
  });
  rejects('unexpected stderr', (_b, c) => {
    c.stderr = 'Unhandled rejection';
  });
  console.log(JSON.stringify({ selfTest: 'pass', rejected: checks }, null, 2));
}

function options() {
  const parsed = {};
  for (let i = 2; i < process.argv.length; i++) {
    const flag = process.argv[i];
    assert.ok(
      ['--candidate', '--baseline', '--self-test'].includes(flag),
      `Unknown option ${flag}`
    );
    assert.equal(parsed[flag], undefined, `Duplicate option ${flag}`);
    if (flag === '--self-test') parsed[flag] = true;
    else {
      const path = process.argv[++i];
      assert.ok(
        path && !path.startsWith('--') && path.endsWith('.tgz'),
        `${flag} requires path.tgz`
      );
      parsed[flag] = realpathSync(resolve(path));
    }
  }
  if (parsed['--self-test'])
    assert.equal(
      Object.keys(parsed).length,
      1,
      '--self-test runs without artifacts'
    );
  return parsed;
}

function main(args) {
  const tempRoot = realpathSync(tmpdir());
  const rel = relative(ROOT, tempRoot);
  assert.ok(
    rel.startsWith('..') || isAbsolute(rel),
    'Temporary consumers must be outside the repository'
  );
  const output = mkdtempSync(join(tempRoot, 'st-v15-refusal-lifecycle-'));
  console.log(`Raw logs: ${output}`);
  const json = (path, value) =>
    writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
  const sha512 = (path) =>
    'sha512-' +
    createHash('sha512').update(readFileSync(path)).digest('base64');
  const env = { ...process.env, NODE_ENV: 'production' };
  // Prevent ambient preload/resolution overrides from contaminating consumers.
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
    writeFileSync(join(output, `${label}.stdout.log`), run.stdout ?? '');
    writeFileSync(join(output, `${label}.stderr.log`), run.stderr ?? '');
    const result = {
      exitCode: run.status,
      signal: run.signal,
      error: run.error ? String(run.error) : null,
    };
    json(join(output, `${label}.process.json`), {
      executable,
      argv,
      cwd,
      ...result,
    });
    return { ...result, stdout: run.stdout ?? '', stderr: run.stderr ?? '' };
  };
  const requireSuccess = (run, label) => {
    assert.ok(
      run.exitCode === 0 && !run.signal && !run.error,
      `${label} failed; inspect ${output}`
    );
    return run.stdout;
  };
  const metadata = {
    baselineSpec: BASELINE,
    baselineIntegrity: BASELINE_SHA512,
    node: process.version,
    output,
    startedAt: new Date().toISOString(),
    artifacts: {},
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
      'sourceHEAD identifies this checkout, not proof that existing dist or supplied tarballs were built from it.';
    const fixture = join(output, 'fixture.mjs');
    copyFileSync(
      join(ROOT, 'tools/fixtures/v15-refusal-lifecycle.mjs'),
      fixture
    );
    metadata.fixtureSHA512 = sha512(fixture);
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
      if (label === 'baseline')
        assert.equal(
          integrity,
          BASELINE_SHA512,
          'Baseline tarball integrity mismatch'
        );
      return tarball;
    };
    const baselineTarball = artifact('baseline', args['--baseline'], BASELINE);
    const candidateTarball = artifact(
      'candidate',
      args['--candidate'],
      join(ROOT, 'dist/packages/kernel')
    );
    const consumer = (label, tarball) => {
      const cwd = join(output, `${label}-consumer`);
      mkdirSync(cwd);
      json(join(cwd, 'package.json'), {
        name: `v15-lifecycle-${label}`,
        version: '0.0.0',
        private: true,
        type: 'module',
        dependencies: {
          '@signal-tree/kernel': `file:${tarball}`,
          tslib: '2.8.1',
        },
      });
      copyFileSync(fixture, join(cwd, 'fixture.mjs'));
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
      const installed = JSON.parse(
        readFileSync(
          join(cwd, 'node_modules/@signal-tree/kernel/package.json'),
          'utf8'
        )
      );
      assert.equal(installed.name, '@signal-tree/kernel');
      if (label === 'baseline') assert.equal(installed.version, '15.3.0');
      const lock = JSON.parse(
        readFileSync(join(cwd, 'package-lock.json'), 'utf8')
      );
      assert.equal(
        lock.packages['node_modules/@signal-tree/kernel'].integrity,
        metadata.artifacts[label].sha512,
        `${label}: installed tarball integrity`
      );
      metadata.artifacts[label].version = installed.version;
      json(join(output, 'metadata.json'), metadata);
      const run = command(
        `${label}-fixture`,
        process.execPath,
        ['fixture.mjs'],
        cwd,
        15000
      );
      // Preserve the exact JSON bytes even when parsing or classification fails.
      writeFileSync(join(output, `${label}.raw.json`), run.stdout);
      return run;
    };
    const baseline = consumer('baseline', baselineTarball);
    const candidate = consumer('candidate', candidateTarball);
    const report = classify(
      { ...baseline, data: JSON.parse(baseline.stdout) },
      { ...candidate, data: JSON.parse(candidate.stdout) }
    );
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
