// Self-tests for the CI checks: each must pass on the repository as it is and
// must fire on a deliberate violation, so a green run is never vacuous.
import { describe, expect, it } from 'vitest';
import { isRestrictedPath } from './entry-graph.mjs';
import { checkBoundaries, violationsFor } from './boundaries.mjs';
import { CORE_ONLY_APP, scanApp } from './core-bundle-scan.mjs';

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
  it('finds no plugin code in a core-only app', async () => {
    expect(await scanApp(CORE_ONLY_APP)).toEqual({ pluginInputs: [], pluginSymbols: [] });
  });

  it('fires when an app pulls in a plugin', async () => {
    const result = await scanApp(`${CORE_ONLY_APP}import '@signal-tree/core/transactions';\n`);
    expect(result.pluginInputs).toEqual(['packages/core/src/transactions/index.ts']);
  });
});
