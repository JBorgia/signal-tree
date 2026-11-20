import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collect, compare, taggedUnits } from './spec-tests.mjs';

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
