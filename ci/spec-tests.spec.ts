import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collect, compare, importProblems, taggedUnits } from './spec-tests.mjs';

// Fixture sources are built from parts, so this file's own titles carry no behavior IDs.
const tag = (id: string) => `[${id}]`;
const file = (body: string) => `import { describe, expect, it } from 'vitest';\n${body}\n`;
const rollback = file(`
describe('${tag('T3')} rollback order', () => {
  it('refuses the older transaction first', () => { expect(1).toBe(1); });
});
it('${tag('T9')}${tag('T1')} inspect reports current', () => { expect(2).toBe(2); });
it.each([1, 2])('${tag('W2')} holds %i', (n) => { expect(n).toBeGreaterThan(0); });
it('an untagged helper test', () => { expect(3).toBe(3); });
`);

describe('tagged test units', () => {
  it('finds tagged it, test and describe calls, including .each forms, and ignores untagged ones', () => {
    const units = taggedUnits(rollback);
    expect(units.map((u: { title: string; ids: string[] }) => [u.title, u.ids])).toEqual([
      [`${tag('T3')} rollback order`, ['T3']],
      [`${tag('T9')}${tag('T1')} inspect reports current`, ['T9', 'T1']],
      [`${tag('W2')} holds %i`, ['W2']],
    ]);
  });

  it('ignores IDs that only appear inside strings in a test body', () => {
    expect(taggedUnits(file(`it('plain', () => { const s = '${tag('T3')} not a title'; });`))).toEqual([]);
  });

  it('gives each tagged unit a hash of its exact source', () => {
    const [before] = taggedUnits(rollback);
    const [after] = taggedUnits(rollback.replace('toBe(1)', 'toBe(0)'));
    expect(after!.sha256).not.toBe(before!.sha256);
  });
});

describe('file context in tagged unit hashes (option 1 on #27)', () => {
  const contextFile = (helper: string, hook: string, mock: string, untagged: string, other: string) =>
    file(`vi.mock('vitest', async () => ({ ...(await vi.importActual('vitest')), ${mock} }));
const check = (n: number) => ${helper};
describe('rollback', () => {
  beforeEach(() => { ${hook} });
  it('${tag('T3')} refuses the older one', () => { check(1); });
  it('an untagged sibling', () => { ${untagged} });
});
it('${tag('T4')} later confirmed write', () => { ${other} });
describe('untagged group', () => { beforeEach(() => {}); it('plain', () => { ${untagged} }); });`);
  const base = ['expect(n).toBe(1)', 'reset()', 'extra: 1', 'expect(1).toBe(1)', 'expect(2).toBe(2)'] as const;
  const hashes = (...parts: string[]) => Object.fromEntries(taggedUnits(contextFile(...(parts as [string, string, string, string, string]))).map((u: { title: string; sha256: string }) => [u.title, u.sha256]));
  const before = hashes(...base);
  const withPart = (i: number, value: string) => hashes(...base.map((p, j) => (j === i ? value : p)));
  const titles = Object.keys(before);

  it('finds both tagged units', () => {
    expect(titles).toEqual([`rollback > ${tag('T3')} refuses the older one`, `${tag('T4')} later confirmed write`]);
  });

  it.each([
    ['a file-level helper', 0, 'expect(n).toBeTruthy()'],
    ['a hook in an untagged describe that holds a tagged test', 1, 'reset(); skip()'],
    ['a file-level vi.mock', 2, 'extra: 2'],
  ])('changes every tagged unit in the file when %s changes', (_what, i, value) => {
    const after = withPart(i as number, value as string);
    for (const t of titles) expect(after[t]).not.toBe(before[t]);
  });

  it('ignores untagged tests, including those beside tagged ones', () => {
    expect(withPart(3, 'expect(1).toBe(0)')).toEqual(before);
  });

  it('keeps one tagged unit unchanged when another changes', () => {
    const after = withPart(4, 'expect(2).toBe(0)');
    expect(after[titles[0]!]).toBe(before[titles[0]!]);
    expect(after[titles[1]!]).not.toBe(before[titles[1]!]);
  });
});

describe('spec-tests check', () => {
  const repo = (source: string) => {
    const root = mkdtempSync(join(tmpdir(), 'signal-tree-spec-'));
    mkdirSync(join(root, 'packages', 'core', 'src'), { recursive: true });
    writeFileSync(join(root, 'packages', 'core', 'src', 'turns.spec.ts'), source);
    return root;
  };

  it('passes when nothing changed', () => {
    const root = repo(rollback);
    try {
      expect(compare(collect(root), collect(root))).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails on a changed tagged test, a new one and a removed one', () => {
    const root = repo(rollback);
    try {
      const recorded = collect(root);
      writeFileSync(
        join(root, 'packages', 'core', 'src', 'turns.spec.ts'),
        rollback
          .replace("expect(2).toBe(2)", "expect(2).toBeTruthy()")
          .replace(`it.each([1, 2])('${tag('W2')} holds %i', (n) => { expect(n).toBeGreaterThan(0); });`, `it('${tag('R1')} undo needs restoration', () => {});`),
      );
      const problems = compare(recorded, collect(root));
      expect(problems).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^changed: .*inspect reports current/),
          expect.stringMatching(/^added, not recorded: .*undo needs restoration \[R1\]/),
          expect.stringMatching(/^removed: .*holds %i/),
        ]),
      );
      expect(problems).toHaveLength(3);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('lets an untagged test change freely', () => {
    const root = repo(rollback);
    try {
      const recorded = collect(root);
      writeFileSync(join(root, 'packages', 'core', 'src', 'turns.spec.ts'), rollback.replace('expect(3).toBe(3)', 'expect(3).toBe(4)'));
      expect(compare(recorded, collect(root))).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('catches a change to a test inside a tagged describe', () => {
    const root = repo(rollback);
    try {
      const recorded = collect(root);
      writeFileSync(join(root, 'packages', 'core', 'src', 'turns.spec.ts'), rollback.replace('toBe(1)', 'toBe(1) || true'));
      expect(compare(recorded, collect(root))).toEqual([expect.stringMatching(/^changed: .*rollback order/)]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('spec-test imports (review of #19)', () => {
  const pkg = (root: string) => {
    mkdirSync(join(root, 'packages', 'core', 'src', 'transactions'), { recursive: true });
    writeFileSync(join(root, 'packages', 'core', 'package.json'), JSON.stringify({ name: '@signal-tree/core', exports: { '.': './src/index.ts', './transactions': './src/transactions/index.ts' } }));
    writeFileSync(join(root, 'packages', 'core', 'src', 'index.ts'), 'export {};\n');
    writeFileSync(join(root, 'packages', 'core', 'src', 'transactions', 'index.ts'), 'export {};\n');
  };
  const scan = (imports: string, title = `${tag('T3')} rollback order`) => {
    const root = mkdtempSync(join(tmpdir(), 'signal-tree-imp-'));
    try {
      pkg(root);
      writeFileSync(join(root, 'packages', 'core', 'src', 'rollback.spec.ts'), `${imports}\nimport { it } from 'vitest';\nit('${title}', () => {});\n`);
      return importProblems(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  };

  it('allows public entry points, tests/support, node builtins and third-party modules', () => {
    expect(scan(`import { signalTree } from '@signal-tree/core';\nimport { transactions } from '@signal-tree/core/transactions';\nimport { rows } from '../../../tests/support/rows';\nimport { readFileSync } from 'node:fs';\nimport fc from 'fast-check';`)).toEqual([]);
  });

  it.each([
    ["import { seam } from './seam';", 'not in tests/support'],
    ["import { seam } from '@signal-tree/core/src/seam';", 'not a package'],
    ["export { helper } from '../../../tests/helpers';", 'not in tests/support'],
    ["const m = await import('./internals/turns');", 'not in tests/support'],
    ["const m = require('../index');", 'not in tests/support'],
    ["vi.mock('./clock', () => ({ now: () => 0 }));", 'not in tests/support'],
    ["const real = await vi.importActual('./turns');", 'not in tests/support'],
    ["vi.mock('@signal-tree/core/src/writers');", 'not a package'],
  ])('rejects %s in a file with tagged tests', (imports, message) => {
    const problems = scan(imports);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(message);
  });

  it('leaves files without tagged tests alone', () => {
    expect(scan("import { seam } from './seam';", 'an untagged test')).toEqual([]);
  });

  it('treats suite() like describe()', () => {
    const units = taggedUnits(file(`suite('${tag('R2')} undo refuses over newer writes', () => { it('whole', () => {}); });`));
    expect(units.map((u: { title: string; ids: string[] }) => u.ids)).toEqual([['R2']]);
  });
});
