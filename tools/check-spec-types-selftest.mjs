import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const sourceError =
  'example.spec.ts(1,1): error TS2322: incompatible\n  Type continuation\n';
const cases = [
  ['clean', '', 0, 0],
  ['acknowledged source diagnostic', sourceError, 2, 0],
  [
    'located unused diagnostic is type debt',
    'example.spec.ts(1,1): error TS6133: unused variable\n',
    2,
    0,
  ],
  ['diagnostics exit one', sourceError, 1, 0],
  ['new source error', sourceError.repeat(2), 2, 1],
  [
    'missing project',
    'error TS5058: The specified path does not exist.\n',
    2,
    2,
  ],
  ['no inputs', 'error TS18003: No inputs were found.\n', 2, 2],
  [
    'mixed global and source errors',
    sourceError + 'error TS6053: File not found.\n',
    2,
    2,
  ],
  [
    'located config error',
    'tsconfig.json(2,3): error TS5023: Unknown compiler option.\n',
    2,
    2,
  ],
  ['empty failure', '', 2, 2],
  ['unexpected status', sourceError, 127, 2],
  [
    'crash after diagnostics',
    sourceError + 'FATAL ERROR: out of memory\n',
    2,
    2,
  ],
  ['output on successful exit', sourceError, 0, 2],
  ['signal', '', 'SIGTERM', 2],
  ['missing compiler', '', 'missing', 2],
];
for (const [name, output, status, expected] of cases) {
  test(name, () => {
    const root = mkdtempSync(join(tmpdir(), 'spec-type-regression-'));
    try {
      mkdirSync(join(root, 'tools'));
      mkdirSync(join(root, 'node_modules/typescript/bin'), { recursive: true });
      copyFileSync(
        new URL('./check-spec-types.mjs', import.meta.url),
        join(root, 'tools/check-spec-types.mjs')
      );
      writeFileSync(join(root, 'example.spec.ts'), '');
      const baseline = JSON.stringify({
        total: 1,
        files: { 'example.spec.ts': 1 },
      });
      const baselinePath = join(root, 'tools/spec-type-baseline.json');
      writeFileSync(baselinePath, baseline);
      if (status !== 'missing')
        writeFileSync(
          join(root, 'node_modules/typescript/bin/tsc'),
          `process.stdout.write(${JSON.stringify(output)});\n` +
            (typeof status === 'string'
              ? `process.kill(process.pid, '${status}');`
              : `process.exit(${status});`)
        );
      for (const flags of expected === 2 ? [[], ['--update']] : [[]]) {
        const result = spawnSync(
          process.execPath,
          [join(root, 'tools/check-spec-types.mjs'), ...flags],
          { encoding: 'utf8' }
        );
        assert.equal(result.status, expected, result.stdout + result.stderr);
        assert.equal(readFileSync(baselinePath, 'utf8'), baseline);
        if (expected === 2) {
          assert.match(result.stderr, /compiler execution failed/);
          assert.doesNotMatch(result.stdout, /improved|baseline written|OK/);
        }
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}
