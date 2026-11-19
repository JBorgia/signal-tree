// Self-tests for the CI checks: each must pass on the repository as it is and
// must fire on a deliberate violation, so a green run is never vacuous.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isRestrictedPath } from './entry-graph.mjs';
import { checkBoundaries, violationsFor } from './boundaries.mjs';
import { BENCH_FLAG, CORE_ONLY_APP, MARK_PREFIX, pluginFolderIdentity, scanApp } from './core-bundle-scan.mjs';

const coreEntry = { packageDir: 'core', subpath: '.', specifier: '@signal-tree/core' };
const transactionsEntry = { packageDir: 'core', subpath: './transactions', specifier: '@signal-tree/core/transactions' };
const angularEntry = { packageDir: 'angular', subpath: '.', specifier: '@signal-tree/angular' };

describe('rule 7 path matching', () => {
  it.each([
    'packages/core/src/experimental/seam.ts',
    'packages/core/src/experimental-publication/lifecycle.ts',
    'packages/core/src/lib/research_notes.ts',
    'packages/core/src/spike.ts',
    'packages/core/src/Prototype/x.ts',
  ])('flags %s', (path) => expect(isRestrictedPath(path)).toBe(true));

  it.each(['packages/core/src/seam.ts', 'packages/core/src/spiked-value.ts', 'packages/core/src/researcher.ts'])(
    'allows %s',
    (path) => expect(isRestrictedPath(path)).toBe(false),
  );
});

describe('4.1 import boundaries', () => {
  it('passes on the repository', async () => {
    const report = await checkBoundaries();
    expect(report.length).toBe(11);
    expect(report.flatMap((r: { problems: string[] }) => r.problems)).toEqual([]);
  });

  it('flags core reaching a plugin', () => {
    const problems = violationsFor(coreEntry, { inputs: ['packages/core/src/index.ts', 'packages/core/src/writers/index.ts'], externals: [] });
    expect(problems).toEqual(['4.1: @signal-tree/core reaches packages/core/src/writers/index.ts (writers is not core)']);
  });

  it('flags a plugin reaching another plugin', () => {
    const problems = violationsFor(transactionsEntry, { inputs: ['packages/core/src/transactions/index.ts', 'packages/core/src/restoration/index.ts'], externals: [] });
    expect(problems).toHaveLength(1);
  });

  it('flags core importing a third-party module', () => {
    expect(violationsFor(coreEntry, { inputs: [], externals: ['lodash'] })).toHaveLength(1);
  });

  it('lets an adapter import its own framework but not another', () => {
    expect(violationsFor(angularEntry, { inputs: [], externals: ['@angular/core'] })).toEqual([]);
    expect(violationsFor(angularEntry, { inputs: [], externals: ['vue'] })).toHaveLength(1);
  });

  it('flags an adapter reaching a plugin', () => {
    expect(violationsFor(angularEntry, { inputs: ['packages/core/src/devtools/index.ts'], externals: [] })).toHaveLength(1);
  });

  it('flags a restricted module reachable from an entry', () => {
    expect(violationsFor(coreEntry, { inputs: ['packages/core/src/experimental/x.ts'], externals: [] })).toContain(
      'rule 7: reaches packages/core/src/experimental/x.ts',
    );
  });
});

describe('S6(a) core-only bundle scan', () => {
  it('finds no plugin code and no bench-only code in a core-only app', async () => {
    expect(await scanApp(CORE_ONLY_APP)).toEqual({ pluginInputs: [], pluginSymbols: [], benchLeaks: [] });
  });

  it('fires when an app pulls in a plugin', async () => {
    const result = await scanApp(`${CORE_ONLY_APP}import '@signal-tree/core/transactions';\n`);
    expect(result.pluginInputs).toEqual(['packages/core/src/transactions/index.ts']);
  });
});

describe('ruling 11: bench-only marks stay out of production', () => {
  it('lets a mark guarded by the bench flag through, because production drops it', async () => {
    const guarded = `${CORE_ONLY_APP}declare const ${BENCH_FLAG}: boolean;\nif (${BENCH_FLAG}) performance.mark('${MARK_PREFIX}turn');\n`;
    expect((await scanApp(guarded)).benchLeaks).toEqual([]);
  });

  it('fires on an unguarded mark', async () => {
    const unguarded = `${CORE_ONLY_APP}performance.mark('${MARK_PREFIX}turn');\n`;
    expect((await scanApp(unguarded)).benchLeaks).toEqual([MARK_PREFIX]);
  });

  it('fires when the flag is read in a way production cannot drop', async () => {
    const leaky = `${CORE_ONLY_APP}(globalThis as Record<string, unknown>).flag = '${BENCH_FLAG}';\n`;
    expect((await scanApp(leaky)).benchLeaks).toEqual([BENCH_FLAG]);
  });
});

describe('S6(c) byte identity without the plugin folders', () => {
  it('holds for the repository', async () => {
    expect(await pluginFolderIdentity()).toEqual({ identical: true, differences: [] });
  });

  it('fires when core reaches into a plugin folder', async () => {
    const coreDir = mkdtempSync(join(tmpdir(), 'signal-tree-core-fixture-'));
    try {
      mkdirSync(join(coreDir, 'src', 'transactions'), { recursive: true });
      writeFileSync(join(coreDir, 'package.json'), JSON.stringify({ exports: { '.': './src/index.ts' } }));
      writeFileSync(join(coreDir, 'src', 'index.ts'), `import { pending } from './transactions/index.ts';\nexport const turns = () => pending;\n`);
      writeFileSync(join(coreDir, 'src', 'transactions', 'index.ts'), 'export const pending = [] as unknown[];\n');
      const result = await pluginFolderIdentity({ coreDir });
      expect(result.identical).toBe(false);
      expect(result.differences).toHaveLength(2);
    } finally {
      rmSync(coreDir, { recursive: true, force: true });
    }
  });
});
