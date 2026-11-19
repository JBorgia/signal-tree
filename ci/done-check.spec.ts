import { describe, expect, it } from 'vitest';
import { BEHAVIORS, ITEMS, NIGHTLY_JOBS, behaviorIdsIn, evaluate, gateIdsIn, processWordsIn } from './done-check.mjs';

const greenRun = (id: number) => ({ id, conclusion: 'success', jobs: Object.fromEntries(NIGHTLY_JOBS.map((n: string) => [n, 'success'])) });

const done = () => ({
  nightly: { runs: [greenRun(2), greenRun(1)] },
  coveredBehaviors: new Set(BEHAVIORS),
  manifestProblems: [] as string[],
  budgetGates: { ids: new Set(['M1', 'M2', 'M3', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'Q1']) },
  rule7: [] as string[],
  docs: { missing: [] as string[], processWords: [] as string[] },
  first production adopter: { validated: true },
  branches: { list: [{ name: 'main', ageDays: 400 }, { name: 'release/15.x', ageDays: 400 }, { name: 'fix/typo', ageDays: 1 }] },
  mainTree: { paths: ['BRIEF.md', 'packages/core/src/index.ts'] },
  release: { major: 17, tagged: true },
  openQuestions: { list: [] as string[] },
});
type Facts = ReturnType<typeof done>;

describe('done check', () => {
  it('passes only when every section 9 item holds', () => {
    expect(evaluate(done())).toEqual([]);
  });

  // Each case breaks exactly one item; it must be reported, and be the first unmet one.
  const cases: Array<[number, string, (f: Facts) => void]> = [
    [0, 'one green nightly run', (f) => void (f.nightly.runs = [greenRun(1)])],
    [0, 'a red nightly run', (f) => void (f.nightly.runs[1]!.conclusion = 'failure')],
    [0, 'a nightly run without the react gates', (f) => void delete (f.nightly.runs[0]!.jobs as Record<string, string>)['gates (react)']],
    [0, 'nightly runs that could not be read', (f) => void (f.nightly = { error: 'gh: not logged in' } as never)],
    [1, 'a behavior no test covers', (f) => void f.coveredBehaviors.delete('W3')],
    [2, 'a pending manifest entry', (f) => void (f.manifestProblems = ['entry 3: still pending'])],
    [3, 'no gate proving C4', (f) => void f.budgetGates.ids.delete('S7')],
    [4, 'a reachable experimental module', (f) => void (f.rule7 = ['@signal-tree/core: rule 7: reaches packages/core/src/spike.ts'])],
    [5, 'a missing migration guide', (f) => void (f.docs.missing = ['docs/migration/from-14.md'])],
    [5, 'process language in the changelog', (f) => void (f.docs.processWords = ['CHANGELOG.md:12'])],
    [6, 'no first production adopter validation', (f) => void (f.first production adopter.validated = false)],
    [7, 'a long-lived branch', (f) => void f.branches.list.push({ name: 'codex/old', ageDays: 30 })],
    [7, 'a tarball on main', (f) => void f.mainTree.paths.push('docs/evidence.tar.gz')],
    [8, 'no version number for the new major', (f) => void (f.release = { major: null } as never)],
    [8, 'an untagged main', (f) => void (f.release.tagged = false)],
  ];

  it.each(cases)('reports item %i for %s', (index, _name, breakIt) => {
    const facts = done();
    breakIt(facts);
    const unmet = evaluate(facts);
    expect(unmet).toHaveLength(1);
    expect(unmet[0]!.title).toBe(ITEMS[index]!.title);
    expect(unmet[0]!.missing).toEqual(expect.any(String));
  });

  it('lists every unmet item in section 9 order', () => {
    const facts = done();
    facts.release.tagged = false;
    facts.coveredBehaviors.delete('T1');
    expect(evaluate(facts).map((u: { title: string }) => ITEMS.findIndex((i: { title: string }) => i.title === u.title))).toEqual([1, 8]);
  });
});

describe('behavior IDs in test titles', () => {
  it('reads bracketed IDs from it, test and describe titles only', () => {
    const source = `
      describe('[T3] rollback order', () => {
        it("[T10] a throwing observer never strands transact()", () => {});
        test.each([1])(\`[W2][W4] holds and chunks\`, () => {});
        // [R1] in a comment does not count
        const label = '[E1] in a string does not count';
      });`;
    expect([...behaviorIdsIn(source)].sort()).toEqual(['T10', 'T3', 'W2', 'W4']);
  });

  it('does not read T1 out of T10', () => {
    expect([...behaviorIdsIn(`it('[T10] only', () => {})`)]).toEqual(['T10']);
  });
});

describe('process language in docs', () => {
  it('flags rule 9 words in prose and ignores code', () => {
    const md = [
      'Call `hold()` while the user edits.',
      'A refusal is reported as a HOLD.',
      'Read the `PublicationReceipt` for delivery.',
      'Keep your receipts.',
      '```ts',
      'const qualification = HOLD;',
      '```',
      'No falsifier here? There is.',
    ].join('\n');
    expect(processWordsIn(md)).toEqual([2, 4, 8]);
  });
});

describe('gate IDs in budgets.json', () => {
  it('finds IDs as keys and as id or gate values, folding sub-gates into their gate', () => {
    const budgets = { gates: { M1: {}, S4a: {} }, scenarios: [{ id: 'S6c' }, { gate: 'S7' }, { id: 'not-a-gate' }] };
    expect([...gateIdsIn(budgets)].sort()).toEqual(['M1', 'S4', 'S6', 'S7']);
  });
});
