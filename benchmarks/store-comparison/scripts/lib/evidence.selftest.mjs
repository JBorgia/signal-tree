import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  diffHeapCategories,
  fileManifest,
  candidateEvidence,
  developmentReasons,
} from './evidence.mjs';

test('heap delta includes shrinking and disappearing categories', () => {
  const d = diffHeapCategories(
    new Map([
      ['gone', [80, 2]],
      ['smaller', [50, 3]],
    ]),
    new Map([
      ['new', [100, 1]],
      ['smaller', [30, 2]],
    ])
  );
  assert.equal(d.netBytes, 0);
  assert.equal(d.positiveBytes, 100);
  assert.deepEqual(
    d.categories.find(([key]) => key === 'gone'),
    ['gone', -80, -2]
  );
});

test('manifests identify file content, including same-version edits', () => {
  const dir = mkdtempSync(join(import.meta.dirname, '.evidence-test-'));
  try {
    writeFileSync(join(dir, 'chunk.js'), 'old');
    const before = fileManifest(dir);
    assert.deepEqual(fileManifest(dir), before);
    writeFileSync(join(dir, 'chunk.js'), 'new');
    assert.notEqual(fileManifest(dir).sha256, before.sha256);
    assert.equal(fileManifest(join(dir, 'missing')), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('candidate claims stay distinct from observed files and unavailable tarballs', () => {
  const dir = mkdtempSync(join(import.meta.dirname, '.evidence-test-'));
  try {
    const pkg = join(dir, 'node_modules/st15-candidate');
    mkdirSync(pkg, { recursive: true });
    assert.equal(
      candidateEvidence(dir, 'st15-candidate').manifestStatus,
      'missing'
    );
    writeFileSync(join(pkg, '.candidate.json'), '{bad');
    assert.equal(
      candidateEvidence(dir, 'st15-candidate').manifestStatus,
      'invalid'
    );
    writeFileSync(
      join(pkg, '.candidate.json'),
      JSON.stringify({
        angular: { tarball: join(dir, 'missing.tgz'), sha256: 'a'.repeat(64) },
      })
    );
    const evidence = candidateEvidence(dir, 'st15-candidate');
    assert.equal(evidence.tarballs.angular.status, 'unavailable');
    assert.equal(evidence.installedMatchesTarballs, 'unknown');
    writeFileSync(join(dir, 'missing.tgz'), 'different');
    assert.equal(
      candidateEvidence(dir, 'st15-candidate').tarballs.angular.status,
      'mismatch'
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('full runs are development when busy at either endpoint, short or custom', () => {
  const opts = { rounds: 5, quick: false };
  assert.deepEqual(developmentReasons(opts, {}), []);
  assert.ok(
    developmentReasons(opts, { endBusy: true }).includes('busy at end')
  );
  assert.ok(developmentReasons(opts, { busy: true }).includes('busy at start'));
  assert.ok(
    developmentReasons({ rounds: 1 }, {}).includes('fewer than five rounds')
  );
  assert.ok(
    developmentReasons(opts, { customRoot: '/experiment' }).includes(
      'custom build root'
    )
  );
});

test('report labels busy full runs accurately and tolerates incomplete candidate claims', async () => {
  const { printReport } = await import('./report.mjs');
  const lines = [];
  printReport({
    raw: {
      labels: [],
      development: true,
      developmentReasons: ['busy at end'],
      config: { rounds: 5, rows: [], counts: {} },
      environment: {
        libraries: {},
        candidate: {},
        cpu: { model: 'test', cores: 2 },
        git: {},
        loadAverage1m: 0,
      },
    },
    summary: {},
    bands: null,
    invalid: {},
    log: (line) => lines.push(line),
  });
  assert.ok(
    lines.some((line) => line.includes('DEVELOPMENT RUN (busy at end)'))
  );
  assert.ok(
    lines.some((line) =>
      line.includes('claimed tarball sha256 angular unknown')
    )
  );
});
