#!/usr/bin/env node
// Exercise the actual publisher entry point; every subprocess is intercepted in
// an isolated fixture. No registry, network, checkout or shared dist mutation.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  readFileSync,
  rmSync,
  symlinkSync,
  existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { RELEASE_PACKAGES } from './release-plan.mjs';

const require = createRequire(import.meta.url);
const version = '16.0.0';
const ciEnv = {
  GITHUB_ACTIONS: 'true',
  GITHUB_REPOSITORY: 'JBorgia/signal-tree',
  GITHUB_WORKFLOW_REF: `JBorgia/signal-tree/.github/workflows/publish.yml@refs/tags/v${version}`,
  GITHUB_EVENT_NAME: 'workflow_dispatch',
  RELEASE_TAG: `v${version}`,
  GITHUB_SHA: 'source-commit',
  GITHUB_REF: `refs/tags/v${version}`,
};
const mock = `
import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { appendFileSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, symlinkSync } from 'node:fs';
import { join, basename } from 'node:path';
const root = process.cwd();
const scenario = JSON.parse(process.env.SCENARIO);
const actualExecFileSync = cp.execFileSync;
let cleanChecks = 0;
let headChecks = 0;
const buildFixture = () => {
  for (const name of ${JSON.stringify(RELEASE_PACKAGES)}) {
    const dir = join(root, 'dist/packages', name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: '@signal-tree/' + name, version: '${version}' }));
    writeFileSync(join(dir, 'runtime.js'), 'verified-' + name);
  }
};
cp.execFileSync = (command, args) => {
  appendFileSync(join(root, 'calls.jsonl'), JSON.stringify([command, args]) + '\\n');
  if (process.env.MOCK_ROLE === 'gate') {
    if (command === 'npx' && args.includes('build')) buildFixture();
    writeFileSync(join(root, 'gate-ran'), 'yes');
    if (scenario.earlyGateDrift && command === 'npm' && args.includes('typecheck'))
      writeFileSync(join(root, 'dist/packages/kernel/runtime.js'), 'early-drift');
    if ((scenario.earlyGateDrift || scenario.identicalGateRebuild) && args[0] === 'tools/check-bundle-budget.mjs') buildFixture();
    if (scenario.gateRebuildDrift && args[0] === 'tools/check-bundle-budget.mjs')
      writeFileSync(join(root, 'dist/packages/kernel/runtime.js'), 'later-build');
    return '';
  }
  if (command === 'git') {
    if (args[0] === 'status') return scenario.dirty || (++cleanChecks > 1 && scenario.dirtyLater) ? ' M source.ts' : '';
    if (args[1]?.startsWith('refs/tags')) {
      if (scenario.missingTag) throw new Error('missing tag');
      return scenario.wrongTag ? 'other-commit' : 'source-commit';
    }
    return scenario.changedHead && ++headChecks > 2 ? 'changed-commit' : 'source-commit';
  }
  if (command === 'node') {
    if (args[0] === 'tools/verify-gates.mjs' &&
        (scenario.gateFailure || (scenario.mutationFailure && args.includes('--self-test')))) throw new Error('gate failed');
    if (args[0] === 'tools/verify-gates.mjs') {
      if (!args.includes('--self-test')) {
        rmSync(join(root, 'dist/packages/kernel/stale-output.js'), { force: true });
        let gateArgs = [...args];
        if (scenario.sealMode) {
          const seal = args.find((arg) => arg.startsWith('--artifact-integrity='));
          gateArgs = args.filter((arg) => arg !== seal);
          if (scenario.sealMode === 'bare') gateArgs.push('--artifact-integrity');
          if (scenario.sealMode === 'separate') gateArgs.push('--artifact-integrity', seal.split('=')[1]);
          if (scenario.sealMode === 'malformed') gateArgs.push('--artifact-integrity=invalid');
          if (scenario.sealMode === 'mismatch') gateArgs.push('--artifact-integrity=sha256-' + '0'.repeat(64));
          if (scenario.sealMode === 'duplicate') gateArgs.push(seal, seal);
          if (scenario.sealMode === 'mutation') gateArgs.push(seal, '--self-test');
        }
        return actualExecFileSync(process.execPath, ['--import', join(root, 'mock.mjs'), ...gateArgs], {
          cwd: root, encoding: 'utf8', env: { ...process.env, MOCK_ROLE: 'gate' }
        });
      } else if (scenario.mutationContamination) {
        writeFileSync(join(root, 'dist/packages/kernel/runtime.js'), 'mutation');
      }
    }
    if (args[0] === 'tools/verify-tarball-consumer.mjs' && scenario.afterBuildTamper) writeFileSync(join(root, 'dist/packages/kernel/runtime.js'), 'post-build tamper');
    if (args[0] === 'tools/verify-consumer-typecheck.mjs' && scenario.consumerFailure) throw new Error('consumer failed');
    if (args[0] === 'scripts/verify-publish-candidate.mjs' && scenario.tamper) writeFileSync(join(root, '.release/candidates/${version}/tarballs/kernel.tgz'), 'tampered');
    return '';
  }
  if (command === 'pnpm') {
    if (args.includes('--skip-nx-cache') && existsSync(join(root, 'dist/packages/kernel/stale-output.js'))) throw new Error('stale build survived');
    if (scenario.buildFailure) throw new Error('build failed');
    buildFixture();
    const finalBuild = existsSync(join(root, 'gate-ran'));
    if (scenario.gateRebuildDrift && finalBuild)
      writeFileSync(join(root, 'dist/packages/kernel/runtime.js'), 'later-build');
    const dir = join(root, 'dist/packages/kernel');
    if (scenario.differentBuild && finalBuild) writeFileSync(join(dir, 'runtime.js'), 'different build');
    if (scenario.extraBuildFile && finalBuild) writeFileSync(join(dir, 'unexpected.js'), 'extra');
    if (scenario.missingBuildFile && finalBuild) rmSync(join(dir, 'runtime.js'));
    if (scenario.symlinkBuildFile && finalBuild) {
      rmSync(join(dir, 'runtime.js'));
      symlinkSync(join(dir, 'package.json'), join(dir, 'runtime.js'));
    }
    return '';
  }
  if (command === 'npm' && args[0] === 'pack') {
    const name = basename(args[1]);
    const filename = name + '.tgz';
    writeFileSync(join(args.at(-1), filename), readFileSync(join(args[1], 'runtime.js')));
    return JSON.stringify([{ filename }]);
  }
  if (command === 'npm' && args[0] === 'publish') return '';
  throw new Error('Unexpected subprocess: ' + command + ' ' + args.join(' '));
};
cp.spawnSync = (command, args) => {
  appendFileSync(join(root, 'calls.jsonl'), JSON.stringify([command, args]) + '\\n');
  if (command !== 'npm' || args[0] !== 'view') throw new Error('Unexpected spawn');
  if (scenario.tamperDuringLookup) writeFileSync(join(root, '.release/candidates/${version}/tarballs/kernel.tgz'), 'lookup tamper');
  return { status: 1, stdout: '', stderr: scenario.registryFailure ? 'ETIMEDOUT' : 'E404' };
};
syncBuiltinESMExports();
`;
let passed = 0;
let failed = 0;
function check(name, flags, scenario = {}, env = ciEnv, expected = 0) {
  const root = mkdtempSync(join(tmpdir(), 'publish-regression-'));
  try {
    mkdirSync(join(root, 'scripts'));
    mkdirSync(join(root, 'tools'));
    mkdirSync(join(root, 'node_modules'));
    symlinkSync(
      dirname(require.resolve('semver/package.json')),
      join(root, 'node_modules/semver')
    );
    for (const file of [
      'publish-candidate.mjs',
      'release-plan.mjs',
      'publish-artifact-integrity.mjs',
    ])
      copyFileSync(new URL(file, import.meta.url), join(root, 'scripts', file));
    copyFileSync(
      new URL('../tools/verify-gates.mjs', import.meta.url),
      join(root, 'tools/verify-gates.mjs')
    );
    writeFileSync(join(root, 'package.json'), JSON.stringify({ version }));
    for (const pkg of RELEASE_PACKAGES) {
      for (const parent of ['packages', 'dist/packages']) {
        const dir = join(root, parent, pkg);
        mkdirSync(dir, { recursive: true });
        writeFileSync(
          join(dir, 'package.json'),
          JSON.stringify({ name: `@signal-tree/${pkg}`, version })
        );
      }
    }
    for (const name of RELEASE_PACKAGES)
      writeFileSync(
        join(root, 'dist/packages', name, 'runtime.js'),
        'verified-' + name
      );
    writeFileSync(join(root, 'dist/packages/kernel/stale-output.js'), 'stale');
    writeFileSync(join(root, 'mock.mjs'), mock);
    const result = spawnSync(
      process.execPath,
      [
        '--import',
        join(root, 'mock.mjs'),
        'scripts/publish-candidate.mjs',
        ...flags,
      ],
      {
        cwd: root,
        encoding: 'utf8',
        // Deliberately do not inherit credentials, NODE_OPTIONS or GitHub context.
        env: {
          PATH: process.env.PATH,
          ...env,
          SCENARIO: JSON.stringify(scenario),
        },
      }
    );
    assert.equal(
      result.status,
      expected,
      `${name}: ${result.stdout}\n${result.stderr}`
    );
    const calls = existsSync(join(root, 'calls.jsonl'))
      ? readFileSync(join(root, 'calls.jsonl'), 'utf8')
          .trim()
          .split('\n')
          .map(JSON.parse)
      : [];
    const publishes = calls.filter(
      ([cmd, args]) => cmd === 'npm' && args[0] === 'publish'
    );
    if (expected !== 0 || flags.includes('--prepare-only'))
      assert.equal(publishes.length, 0, name);
    else assert.equal(publishes.length, RELEASE_PACKAGES.length, name);
    if (flags.includes('--dry-run')) {
      assert.ok(
        publishes.every(
          ([, args]) =>
            args.includes('--dry-run') &&
            !args.includes('--provenance') &&
            !args.includes('--userconfig')
        ),
        name
      );
      assert.ok(
        !calls.some(
          ([cmd, args]) => cmd === 'npm' && ['view', 'whoami'].includes(args[0])
        ),
        name
      );
    }
    if (
      expected === 0 &&
      !flags.includes('--dry-run') &&
      !flags.includes('--prepare-only')
    ) {
      const gate = calls.findIndex(
        ([, args]) =>
          args[0] === 'tools/verify-gates.mjs' && !args.includes('--self-test')
      );
      const mutation = calls.findIndex(
        ([, args]) =>
          args[0] === 'tools/verify-gates.mjs' &&
          args.includes('--self-test') &&
          args.includes('--release')
      );
      const build = calls.findLastIndex(
        ([cmd, args]) => cmd === 'pnpm' && args.includes('--skip-nx-cache')
      );
      const pack = calls.findIndex(
        ([cmd, args]) => cmd === 'npm' && args[0] === 'pack'
      );
      assert.ok(
        gate >= 0 && mutation > gate && build > mutation && pack > build,
        name
      );
      assert.ok(
        calls[gate][1].some((arg) =>
          arg.startsWith('--artifact-integrity=sha256-')
        ),
        name
      );
      assert.ok(
        calls.findIndex(
          ([cmd, args]) => cmd === 'pnpm' && args.includes('--skip-nx-cache')
        ) < gate,
        name
      );
      assert.ok(
        !calls.some(([cmd, args]) => cmd === 'npx' && args.includes('build')),
        'sealed runner must not rebuild'
      );
      assert.ok(
        publishes.every(([, args]) => args.includes('--provenance')),
        name
      );
    }
    if (scenario.consumerFailure) {
      const journal = JSON.parse(
        readFileSync(
          join(root, '.release/candidates', version, 'candidate.json'),
          'utf8'
        )
      );
      assert.equal(journal.state, 'validating');
    }
    console.log(`✓ ${name}`);
    passed++;
  } catch (error) {
    failed++;
    console.error(`✗ ${name}: ${error.message}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
check('local live rejected before build', [], {}, {}, 1);
check(
  'token cannot bypass CI guard',
  ['--ci'],
  {},
  { NPM_TOKEN: 'fixture-only' },
  1
);
check(
  'wrong repository',
  ['--ci'],
  {},
  { ...ciEnv, GITHUB_REPOSITORY: 'other/repo' },
  1
);
check(
  'wrong workflow',
  ['--ci'],
  {},
  {
    ...ciEnv,
    GITHUB_WORKFLOW_REF:
      'JBorgia/signal-tree/.github/workflows/test.yml@refs/heads/main',
  },
  1
);
check(
  'wrong event',
  ['--ci'],
  {},
  { ...ciEnv, GITHUB_EVENT_NAME: 'pull_request' },
  1
);
check('missing release tag', ['--ci'], {}, { ...ciEnv, RELEASE_TAG: '' }, 1);
check('mismatched tag commit', ['--ci'], { wrongTag: true }, ciEnv, 1);
check('missing git tag', ['--ci'], { missingTag: true }, ciEnv, 1);
check('dirty source', ['--ci'], { dirty: true }, ciEnv, 1);
check('source dirtied by gates', ['--ci'], { dirtyLater: true }, ciEnv, 1);
check('HEAD changed during gates', ['--ci'], { changedHead: true }, ciEnv, 1);
check('tampered tarball refuses publish', ['--ci'], { tamper: true }, ciEnv, 1);
check('prebuilt live rejected', ['--ci', '--prebuilt'], {}, ciEnv, 1);
for (const sealMode of [
  'bare',
  'separate',
  'malformed',
  'mismatch',
  'duplicate',
  'mutation',
])
  check(
    `gate runner rejects ${sealMode} seal invocation`,
    ['--ci'],
    { sealMode },
    ciEnv,
    1
  );
check(
  'later gate rebuild cannot replace earlier validated artifact',
  ['--ci'],
  { gateRebuildDrift: true },
  ciEnv,
  1
);
check(
  'early gate drift refuses before a later gate could restore bytes',
  ['--ci'],
  { earlyGateDrift: true },
  ciEnv,
  1
);
check('identical per-gate rebuild preserves the seal', ['--ci'], {
  identicalGateRebuild: true,
});
check(
  'gate failure prevents publish',
  ['--ci'],
  { gateFailure: true },
  ciEnv,
  1
);
check(
  'mutation failure prevents publish',
  ['--ci'],
  { mutationFailure: true },
  ciEnv,
  1
);
check(
  'build failure prevents publish',
  ['--ci'],
  { buildFailure: true },
  ciEnv,
  1
);
check(
  'consumer failure leaves unvalidated journal',
  ['--ci'],
  { consumerFailure: true },
  ciEnv,
  1
);
check(
  'registry uncertainty prevents publish',
  ['--ci'],
  { registryFailure: true },
  ciEnv,
  1
);
check('verified CI rebuilds before pack (mock registry only)', ['--ci']);
check('local dry run', ['--dry-run'], {}, {});
check(
  'dirty prebuilt dry run ignores token and provenance',
  ['--dry-run', '--prebuilt', '--ci'],
  { dirty: true },
  { NPM_TOKEN: 'fixture-only', NPM_CONFIG_PROVENANCE: 'true' }
);
check(
  'local prebuilt preparation',
  ['--prebuilt', '--prepare-only'],
  { dirty: true },
  {}
);
check('typo cannot accidentally publish', ['--dryrun'], {}, {}, 1);
check(
  'different final build fails before pack',
  ['--ci'],
  { differentBuild: true },
  ciEnv,
  1
);
check(
  'added build file fails closed',
  ['--ci'],
  { extraBuildFile: true },
  ciEnv,
  1
);
check(
  'missing build file fails closed',
  ['--ci'],
  { missingBuildFile: true },
  ciEnv,
  1
);
check(
  'symlink build file fails closed',
  ['--ci'],
  { symlinkBuildFile: true },
  ciEnv,
  1
);
check(
  'post-build validation cannot replace verified bytes',
  ['--ci'],
  { afterBuildTamper: true },
  ciEnv,
  1
);
check('mutation contamination is removed by identical rebuild', ['--ci'], {
  mutationContamination: true,
});
check(
  'mismatched provenance SHA refuses publication',
  ['--ci'],
  {},
  { ...ciEnv, GITHUB_SHA: 'different-event-commit' },
  1
);
check(
  'missing provenance SHA refuses publication',
  ['--ci'],
  {},
  { ...ciEnv, GITHUB_SHA: '' },
  1
);
check(
  'branch dispatch refuses tag provenance',
  ['--ci'],
  {},
  { ...ciEnv, GITHUB_REF: 'refs/heads/main' },
  1
);
check(
  'tarball changed during lookup refuses publication',
  ['--ci'],
  { tamperDuringLookup: true },
  ciEnv,
  1
);

// Execute only the local resolve-tag shell block; no workflow command or action
// beyond this pure input boundary is run. No credentials/startup files inherited.
function checkWorkflow(file, input, expected) {
  const root = mkdtempSync(join(tmpdir(), 'publish-workflow-'));
  const name = `${file}: ${
    expected === 0 ? 'valid tag' : 'reject shell input'
  }`;
  try {
    const text = readFileSync(
      new URL(`../.github/workflows/${file}`, import.meta.url),
      'utf8'
    );
    const body = text
      .slice(text.indexOf('- name: Resolve release tag'))
      .match(/ {8}run: \|\n([\s\S]*?)(?=\n {6}- name:)/)?.[1];
    assert.ok(body, 'resolve-tag script exists');
    const value = input.replaceAll('MARKER', join(root, 'marker'));
    const script = body
      .split('\n')
      .map((line) => line.replace(/^ {10}/, ''))
      .join('\n')
      .replaceAll('${{ github.event.inputs.release_tag }}', value);
    const output = join(root, 'output');
    writeFileSync(output, '');
    const result = spawnSync(
      'bash',
      ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', script],
      {
        encoding: 'utf8',
        env: {
          PATH: process.env.PATH,
          INPUT_TAG: value,
          EVENT_TAG: '',
          GITHUB_REF_NAME: `v${version}`,
          GITHUB_REF: `refs/tags/v${version}`,
          GITHUB_OUTPUT: output,
        },
      }
    );
    assert.equal(result.status, expected, `${result.stdout}\n${result.stderr}`);
    assert.equal(
      existsSync(join(root, 'marker')),
      false,
      'input executed a command'
    );
    assert.equal(
      readFileSync(output, 'utf8'),
      expected === 0 ? `tag_name=v${version}\n` : ''
    );
    console.log(`✓ ${name}`);
    passed++;
  } catch (error) {
    failed++;
    console.error(`✗ ${name}: ${error.message}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
for (const file of ['publish.yml', 'release.yml']) {
  checkWorkflow(file, `v${version}`, 0);
  checkWorkflow(file, `v${version}$(printf injected > MARKER)`, 1);
}

// Exercise the actual mutation self-test's resource cleanup, not its API law.
// Only inventory child commands are stubbed; all declaration writes are real
// and confined to a disposable fixture.
function checkCallableCleanup(mode, layout = 'single') {
  const root = mkdtempSync(join(tmpdir(), 'callable-cleanup-'));
  const name = `callable mutation cleanup: ${layout}/${mode}`;
  try {
    mkdirSync(join(root, 'dist/packages/kernel/dist'), { recursive: true });
    const dts = join(root, 'dist/packages/kernel/dist/index.d.ts');
    mkdirSync(join(root, 'node_modules'));
    symlinkSync(
      dirname(require.resolve('typescript/package.json')),
      join(root, 'node_modules/typescript')
    );
    const transaction = `type PendingTransaction = { pending: true };
export interface TransactionMethods {
    transact(fn: () => void): PendingTransaction;
}`;
    const members = `type ReadonlyOf<T, C> = () => T;
interface AddOptions<E, K> { key?: K }
export interface EntitySignal<E, K, C> {
    clear(): void;
    readonly empty: ReadonlyOf<boolean, C>;
    addOne(entity: E, opts?: AddOptions<E, K>): K;
}
export interface NodeAccessor<T> {
    /** Read: unwraps this node and everything under it. */
    (): T;
    (value: T): void;
}
export declare class SignalTreeRollbackError extends Error {
    constructor(message?: string, options?: { cause?: unknown });
}`;
    const files =
      layout === 'chunk'
        ? {
            'index.d.ts':
              transaction +
              "\nexport { EntitySignal, NodeAccessor, SignalTreeRollbackError } from './_moved-fixture.js';",
            '_moved-fixture.d.ts': members,
            'unused-decoy.d.ts': members,
          }
        : { 'index.d.ts': transaction + '\n' + members };
    if (mode === 'ambiguous-owner') {
      const owner = layout === 'chunk' ? '_moved-fixture.d.ts' : 'index.d.ts';
      files[owner] = files[owner].replace(
        'clear(): void;',
        'clear(): void; clear(value: number): void;'
      );
    }
    if (mode === 'missing-owner') {
      for (const file of Object.keys(files))
        files[file] = files[file].replaceAll('EntitySignal', 'MissingSignal');
    }
    for (const [file, text] of Object.entries(files))
      writeFileSync(join(dirname(dts), file), text);
    copyFileSync(
      new URL('../tools/api-callable-inventory-selftest.mjs', import.meta.url),
      join(root, 'selftest.mjs')
    );
    mkdirSync(join(root, 'tools'));
    for (const file of [
      'api-callable-inventory.mjs',
      'check-callable-inventory.mjs',
    ]) {
      if (
        file === 'check-callable-inventory.mjs' &&
        mode === 'missing-regression'
      )
        continue;
      copyFileSync(
        new URL(`../tools/${file}`, import.meta.url),
        join(root, 'tools', file)
      );
    }
    if (mode === 'failing-regression')
      writeFileSync(
        join(root, 'tools/check-callable-inventory.mjs'),
        "throw new Error('fixture regression rejection');\n"
      );
    writeFileSync(
      join(root, 'mock.mjs'),
      `
      import cp from 'node:child_process';
      import fs from 'node:fs';
      import { syncBuiltinESMExports } from 'node:module';
      const write = fs.writeFileSync;
      const actualExecFileSync = cp.execFileSync;
      const dts = ${JSON.stringify(dts)};
      const originals = ${JSON.stringify(files)};
      const layout = ${JSON.stringify(layout)};
      const mode = ${JSON.stringify(mode)};
      let calls = 0;
      let injected = false;
      cp.execFileSync = (command, args, options) => {
        if (String(args[0]).endsWith('/tools/check-callable-inventory.mjs'))
          return actualExecFileSync(command, args, options);
        if (args[0] !== 'tools/api-callable-inventory.mjs' || args[1] !== '--check')
          throw new Error('Unexpected callable subprocess: ' + args.join(' '));
        write(${JSON.stringify(join(root, 'reader-called'))}, 'yes');
        calls++;
        if (mode === 'baseline-failure') throw new Error('unclean baseline');
        if (calls === 1 || Object.keys(originals).some((file) => fs.readFileSync(dts.replace('index.d.ts', file), 'utf8').includes('__NotExported'))) return '';
        const error = new Error('mock inventory rejects fixture mutant');
        error.stdout = 'ADDED __fakeAdded REMOVED TransactionMethods.transact ADDED transactRenamed KIND CHANGED clear method -> callable-property KIND CHANGED empty callable-property -> method ADDED root.__fakeTopLevel function SIGNATURE CHANGED TransactionMethods.transact NodeAccessor addOne SignalTreeRollbackError.new';
        throw error;
      };
      fs.writeFileSync = (path, data, ...args) => {
        write(path, data, ...args);
        const file = String(path).split('/').at(-1);
        const target = layout === 'chunk' ? '_moved-fixture.d.ts' : 'index.d.ts';
        if (file === target && String(data) !== originals[file] && !injected && mode === 'exception-after-mutation') {
          injected = true;
          write(${JSON.stringify(join(root, 'mutated'))}, 'yes');
          throw new Error('injected failure after a real mutant write');
        }
      };
      syncBuiltinESMExports();
    `
    );
    const result = spawnSync(
      process.execPath,
      ['--import', join(root, 'mock.mjs'), join(root, 'selftest.mjs')],
      {
        cwd: root,
        encoding: 'utf8',
        env: { PATH: process.env.PATH },
      }
    );
    assert.equal(
      result.status,
      mode === 'success' ? 0 : 1,
      result.stdout + result.stderr
    );
    if (mode === 'success') {
      assert.match(result.stdout, /13\/13 mutations behaved correctly/);
      assert.match(
        result.stdout,
        /Callable inventory controls: 4 passed, 0 failed/
      );
    }
    if (mode === 'missing-regression' || mode === 'failing-regression') {
      assert.equal(
        existsSync(join(root, 'reader-called')),
        false,
        'regression failure must stop before mutation checker'
      );
      assert.match(
        result.stderr,
        mode === 'missing-regression'
          ? /Cannot find module/
          : /fixture regression rejection/
      );
    }
    if (mode === 'exception-after-mutation')
      assert.equal(existsSync(join(root, 'mutated')), true);
    for (const [file, original] of Object.entries(files)) {
      const path = join(dirname(dts), file);
      assert.equal(
        readFileSync(path, 'utf8'),
        original,
        `${file} original bytes restored`
      );
      assert.equal(
        existsSync(`${path}.selftest-backup`),
        false,
        'self-test must not add a packaged backup'
      );
    }
    console.log(`✓ ${name}`);
    passed++;
  } catch (error) {
    failed++;
    console.error(`✗ ${name}: ${error.message}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
for (const layout of ['single', 'chunk'])
  for (const mode of [
    'success',
    'baseline-failure',
    'exception-after-mutation',
    'ambiguous-owner',
    'missing-owner',
    'missing-regression',
    'failing-regression',
  ])
    checkCallableCleanup(mode, layout);
console.log(
  `Publisher regression checks: ${passed} passed, ${failed} failed; publisher subprocesses mocked.`
);
if (failed) process.exitCode = 1;
