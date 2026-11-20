import { describe, expect, it } from 'vitest';
import {
  ADAPTERS,
  BEHAVIORS,
  ITEMS,
  ORACLE_MIN_INSTANCES,
  REQUIRED_GATES,
  behaviorIdsIn,
  evaluate,
  gateIdsIn,
  nightlyRunProblem,
  oracleReportProblem,
  processWordsIn,
} from './done-check.mjs';

type Results = { budgets: { approved: boolean }; recordOnly: boolean; scenarios: Record<string, { status: string; pass: boolean | null; regressions: { regressed: boolean }[] }> };
const greenResults = (): Results => ({
  budgets: { approved: true },
  recordOnly: false,
  scenarios: Object.fromEntries(REQUIRED_GATES.map((g: string) => [g, { status: 'ran', pass: true, regressions: [{ regressed: false }] }])),
});
/** Catalog entries the generator cannot express yet; a report marks them not generatable. */
const NOT_GENERATABLE = new Set(['T8', 'R4', 'L3', 'X2', 'W1', 'W2', 'W3', 'W4']);
type BehaviorReport = { generatable: boolean; holds: Record<string, number>; violates: Record<string, number>; instances: Record<string, number> };
/** A nightly spec-report.json in which the core holds everything, every generatable behavior exactly at the floor. */
const greenOracle = () => ({
  runs: 100_000,
  subjects: [{ name: 'v15' }, { name: 'v16' }, { name: 'core' }],
  violations: [{ behavior: 'T3', subject: 'v16', count: 144 }],
  determinism: { subject: 'v16', runs: 100_000, mismatches: 0 } as { subject: string; runs: number; mismatches: number } | undefined,
  behaviors: Object.fromEntries(
    BEHAVIORS.map((id: string) => {
      const n = NOT_GENERATABLE.has(id) ? 0 : ORACLE_MIN_INSTANCES;
      return [id, { generatable: !NOT_GENERATABLE.has(id), holds: { v16: 3, core: n }, violates: { v16: 1, core: 0 }, instances: { v16: 4, core: n } }];
    })
  ) as Record<string, BehaviorReport>,
});
const greenRun = (id: number) => ({
  id,
  conclusion: 'success',
  results: Object.fromEntries(ADAPTERS.map((a: string) => [a, greenResults()])) as Record<string, Results>,
  oracle: greenOracle(),
});

const done = () => ({
  nightly: { runs: [greenRun(2), greenRun(1)] },
  s6: { findings: [] as string[] },
  coveredBehaviors: new Set(BEHAVIORS),
  manifestProblems: [] as string[],
  budgetGates: { ids: new Set(['M1', 'M2', 'M3', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'Q1']) },
  rule7: [] as string[],
  docs: { missing: [] as string[], processWords: [] as string[] },
  adopter: { validated: true },
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

  // Each case breaks the listed items and nothing else; they must be reported in section 9 order.
  const oracle = (f: Facts, run: number) => f.nightly.runs[run]!.oracle;
  const cases: Array<[number[], string, (f: Facts) => void]> = [
    [[0, 1], 'one green nightly run', (f) => void (f.nightly.runs = [greenRun(1)])],
    [[0], 'a red nightly run', (f) => void (f.nightly.runs[1]!.conclusion = 'failure')],
    [[0], 'a nightly run without react results', (f) => void delete f.nightly.runs[0]!.results['react']],
    [[0], 'record-only results (job green, gates red)', (f) => void (f.nightly.runs[0]!.results['angular'].recordOnly = true)],
    [[0], 'results against unapproved budgets', (f) => void (f.nightly.runs[1]!.results['plain'].budgets.approved = false)],
    [[0], 'a red gate inside a green job', (f) => void (f.nightly.runs[0]!.results['vue'].scenarios['S4c'].pass = false)],
    [[0], 'a gate with no verdict', (f) => void (f.nightly.runs[0]!.results['vue'].scenarios['S2'].pass = null)],
    [[0], 'a gate that did not run', (f) => void (f.nightly.runs[0]!.results['solid'].scenarios['S7'].status = 'not-applicable')],
    [[0], 'a regression', (f) => void (f.nightly.runs[1]!.results['preact'].scenarios['M1'].regressions = [{ regressed: true }])],
    [[0], 'an S6 scan finding', (f) => void (f.s6.findings = ['unminified bundles differ'])],
    [[0, 1], 'nightly runs that could not be read', (f) => void (f.nightly = { error: 'gh: not logged in' } as never)],
    [[1], 'a behavior no test covers', (f) => void f.coveredBehaviors.delete('W3')],
    [[1], 'an oracle short of 100,000 sequences', (f) => void (oracle(f, 0).runs = 99_999)],
    [[1], 'a spec violation by the new core', (f) => void oracle(f, 1).violations.push({ behavior: 'T3', subject: 'core', count: 2 })],
    [[1], 'a generator run without the new core', (f) => void (oracle(f, 0).subjects = [{ name: 'v16' }])],
    [[1], 'nondeterministic replays', (f) => void (oracle(f, 0).determinism!.mismatches = 1)],
    [[1], 'a report with no determinism check', (f) => void (oracle(f, 1).determinism = undefined)],
    [[1], 'one generatable behavior under 1,000 core instances', (f) => void (oracle(f, 0).behaviors['T6']!.instances['core'] = 999)],
    [[1], 'a report that does not list a behavior', (f) => void delete oracle(f, 1).behaviors['R3']],
    [[1], 'no oracle report in a nightly run', (f) => void ((f.nightly.runs[0] as { oracle: unknown }).oracle = { error: 'artifact nightly-oracle missing' })],
    [[2], 'a pending manifest entry', (f) => void (f.manifestProblems = ['entry 3: still pending'])],
    [[3], 'no gate proving C4', (f) => void f.budgetGates.ids.delete('S7')],
    [[4], 'a reachable experimental module', (f) => void (f.rule7 = ['@signal-tree/core: rule 7: reaches packages/core/src/spike.ts'])],
    [[5], 'a missing migration guide', (f) => void (f.docs.missing = ['docs/migration/from-14.md'])],
    [[5], 'process language in the changelog', (f) => void (f.docs.processWords = ['CHANGELOG.md:12'])],
    [[6], 'no adopter validation', (f) => void (f.adopter.validated = false)],
    [[7], 'a long-lived branch', (f) => void f.branches.list.push({ name: 'codex/old', ageDays: 30 })],
    [[7], 'a tarball on main', (f) => void f.mainTree.paths.push('docs/evidence.tar.gz')],
    [[8], 'no version number for the new major', (f) => void (f.release = { major: null } as never)],
    [[8], 'an untagged main', (f) => void (f.release.tagged = false)],
  ];

  it.each(cases)('reports items %j for %s', (indexes, _name, breakIt) => {
    const facts = done();
    breakIt(facts);
    const unmet = evaluate(facts);
    expect(unmet.map((u: { title: string }) => ITEMS.findIndex((i: { title: string }) => i.title === u.title))).toEqual(indexes);
    for (const u of unmet) expect(u.missing).toEqual(expect.any(String));
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

describe('nightly verdicts', () => {
  it('reads a fully green run as green', () => {
    expect(nightlyRunProblem(greenRun(9))).toBeNull();
  });
});

describe('the nightly oracle report', () => {
  it('accepts the core at the floor, with old-package violations and not-generatable entries at zero', () => {
    expect(oracleReportProblem(greenOracle())).toBeNull();
  });

  it('names every behavior below 1,000 core instances with its count, and the excluded entries', () => {
    const report = greenOracle();
    report.behaviors['T6']!.instances['core'] = 999;
    report.behaviors['R3']!.instances['core'] = 12;
    expect(oracleReportProblem(report)).toBe(
      'below the floor of 1000 instances on the new core: T6 (999), R3 (12); excluded as not generatable: T8, R4, L3, X2, W1, W2, W3, W4'
    );
  });

  it('rejects a run of fewer than 100,000 sequences', () => {
    const report = greenOracle();
    report.runs = 10_000;
    expect(oracleReportProblem(report)).toBe('the oracle ran 10000 sequences, fewer than 100000');
  });

  it('counts holds + violates when a report has no instances field', () => {
    const report = greenOracle();
    const t1 = report.behaviors['T1'] as Partial<BehaviorReport>;
    delete t1.instances;
    t1.holds = { core: 600 };
    t1.violates = { core: 0 };
    expect(oracleReportProblem(report)).toMatch(/: T1 \(600\);/);
  });
});
