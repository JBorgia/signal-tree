import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { JONATHAN, approvedByJonathan, decide, existingEntryChanges, main, parseEntries } from './spec-test-entries.mjs';

// Jonathan's ruling of 2026-11-24 on test tags: adding entries to
// tests/spec-tests.json passes; changing or removing an existing one needs
// JBorgia's approval of the head commit.

type Entry = { file: string; title: string; ids: string[]; sha256: string; [k: string]: unknown };
type Review = { id: number; user: { login: string; id: number }; state: string; commit_id: string };

const entry = (title: string, sha256 = `hash-${title}`, ids = ['T3']): Entry => ({ file: 'packages/core/src/turns.spec.ts', title, ids, sha256 });
const json = (tests: Entry[]) => `${JSON.stringify({ tests }, null, 2)}\n`;
const HEAD = 'a'.repeat(40);
const OLDER = 'b'.repeat(40);
let nextId = 1;
const review = (state: string, commit = HEAD, user = { login: JONATHAN.login, id: JONATHAN.id }): Review => ({ id: nextId++, user, state, commit_id: commit });
const A = entry('[T3] refuses the older one');
const B = entry('[T4] later confirmed write');

describe('existing entry changes', () => {
  it('lists nothing when entries are only added or reordered', () => {
    expect(existingEntryChanges([A], [entry('[T9] new'), A])).toEqual([]);
    expect(existingEntryChanges([A, B], [B, A])).toEqual([]);
    expect(existingEntryChanges([], [A, B])).toEqual([]);
  });

  it('lists a changed hash, changed IDs and any other changed field', () => {
    expect(existingEntryChanges([A], [{ ...A, sha256: 'other' }])).toEqual([`changed: ${A.file} :: ${A.title}`]);
    expect(existingEntryChanges([A], [{ ...A, ids: ['T3', 'T9'] }])).toEqual([`changed: ${A.file} :: ${A.title}`]);
    expect(existingEntryChanges([A], [{ ...A, skip: true }])).toEqual([`changed: ${A.file} :: ${A.title}`]);
  });

  it('ignores the order of an entry\'s keys', () => {
    const reordered = { sha256: A.sha256, ids: A.ids, title: A.title, file: A.file };
    expect(existingEntryChanges([A], [reordered])).toEqual([]);
  });

  it('lists a removed entry, including a renamed or moved test', () => {
    expect(existingEntryChanges([A, B], [B])).toEqual([`removed: ${A.file} :: ${A.title}`]);
    expect(existingEntryChanges([A], [{ ...A, title: `${A.title} again` }])).toEqual([`removed: ${A.file} :: ${A.title}`]);
    expect(existingEntryChanges([A], [{ ...A, file: 'packages/core/src/other.spec.ts' }])).toEqual([`removed: ${A.file} :: ${A.title}`]);
  });

  it('lists a key the head holds twice, even when one copy is unchanged', () => {
    expect(existingEntryChanges([A], [A, { ...A, sha256: 'other' }])).toContain(`duplicate: ${A.file} :: ${A.title}`);
    expect(existingEntryChanges([A], [{ ...A, sha256: 'other' }, A])).toContain(`duplicate: ${A.file} :: ${A.title}`);
  });
});

describe('parsing tests/spec-tests.json', () => {
  it('reads an absent file as no entries, and refuses a malformed one', () => {
    expect(parseEntries(null, 'the base')).toEqual([]);
    expect(parseEntries(json([A]), 'the base')).toEqual([A]);
    expect(() => parseEntries('{', 'the merge commit')).toThrow(/on the merge commit is not JSON/);
    expect(() => parseEntries('{"entries": []}', 'the merge commit')).toThrow(/has no "tests" array/);
    expect(() => parseEntries('{"tests": [{"title": "x"}]}', 'the merge commit')).toThrow(/entry 0 has no file and title/);
  });
});

describe("JBorgia's approval", () => {
  it('counts only his latest deciding review, and only on the head commit', () => {
    expect(approvedByJonathan([], HEAD)).toBe(false);
    expect(approvedByJonathan([review('APPROVED')], HEAD)).toBe(true);
    expect(approvedByJonathan([review('APPROVED', OLDER)], HEAD)).toBe(false);
    expect(approvedByJonathan([review('DISMISSED')], HEAD)).toBe(false);
    expect(approvedByJonathan([review('APPROVED'), review('CHANGES_REQUESTED')], HEAD)).toBe(false);
    expect(approvedByJonathan([review('CHANGES_REQUESTED'), review('APPROVED')], HEAD)).toBe(true);
    expect(approvedByJonathan([review('APPROVED'), review('COMMENTED')], HEAD)).toBe(true);
    expect(approvedByJonathan([review('APPROVED'), review('PENDING')], HEAD)).toBe(true);
  });

  it('orders reviews by id, not by where the API lists them', () => {
    const approved = review('APPROVED');
    const requested = review('CHANGES_REQUESTED');
    expect(approvedByJonathan([requested, approved], HEAD)).toBe(false);
  });

  it("ignores everyone else's reviews, including a renamed account with his old login", () => {
    expect(approvedByJonathan([review('APPROVED', HEAD, { login: 'github-actions[bot]', id: 41898282 })], HEAD)).toBe(false);
    expect(approvedByJonathan([review('APPROVED', HEAD, { login: JONATHAN.login, id: 1 })], HEAD)).toBe(false);
    expect(approvedByJonathan([review('APPROVED'), review('CHANGES_REQUESTED', HEAD, { login: 'someone', id: 2 })], HEAD)).toBe(true);
  });
});

describe('the verdict', () => {
  const calls: number[] = [];
  const reviews = (list: Review[]) => () => {
    calls.push(1);
    return list;
  };
  afterEach(() => void calls.splice(0));

  it('passes added entries without reading any review', () => {
    const verdict = decide({ baseText: json([A]), headText: json([A, B]), headSha: HEAD, reviews: reviews([]) });
    expect(verdict).toEqual({ ok: true, lines: ['ok: no existing entry of tests/spec-tests.json changed or removed.'] });
    expect(calls).toEqual([]);
  });

  it('fails a changed or removed entry without his approval, naming each', () => {
    const verdict = decide({ baseText: json([A, B]), headText: json([{ ...A, sha256: 'other' }]), headSha: HEAD, reviews: reviews([review('APPROVED', OLDER)]) });
    expect(verdict.ok).toBe(false);
    expect(verdict.lines).toEqual([
      `FAIL changed: ${A.file} :: ${A.title}`,
      `FAIL removed: ${B.file} :: ${B.title}`,
      `2 existing entries of tests/spec-tests.json changed or removed. This needs JBorgia's approving review of ${HEAD.slice(0, 12)} (ruling of 2026-11-24); adding entries does not.`,
    ]);
  });

  it('passes them with his approval of the head commit', () => {
    const verdict = decide({ baseText: json([A]), headText: null, headSha: HEAD, reviews: reviews([review('APPROVED')]) });
    expect(verdict).toEqual({ ok: true, lines: [`removed: ${A.file} :: ${A.title}`, `ok: 1 existing entry changed or removed, approved by JBorgia on ${HEAD.slice(0, 12)}.`] });
  });

  it('fails a malformed file, even with his approval', () => {
    const verdict = decide({ baseText: json([A]), headText: '{"tests": ', headSha: HEAD, reviews: reviews([review('APPROVED')]) });
    expect(verdict.ok).toBe(false);
    expect(verdict.lines[0]).toMatch(/^FAIL tests\/spec-tests\.json on the merge commit is not JSON/);
  });
});

describe('in CI', { timeout: 60_000 }, () => {
  const roots: string[] = [];
  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });
  const git = (root: string, ...args: string[]) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd: root, encoding: 'utf8' }).trim();
  const commit = (root: string, tests: Entry[] | null, message: string) => {
    if (tests) writeFileSync(join(root, 'tests', 'spec-tests.json'), json(tests));
    else rmSync(join(root, 'tests', 'spec-tests.json'), { force: true });
    git(root, 'add', '-A');
    git(root, 'commit', '-q', '--allow-empty', '-m', message);
    return git(root, 'rev-parse', 'HEAD');
  };

  /**
   * A repository whose HEAD is the merge commit of `head` into `base`, as
   * actions/checkout leaves a pull request, holding `merged` (by default the head's entries).
   */
  const pullRequest = (start: Entry[], base: Entry[], head: Entry[] | null, merged: Entry[] | null = head) => {
    const root = mkdtempSync(join(tmpdir(), 'signal-tree-entries-'));
    roots.push(root);
    mkdirSync(join(root, 'tests'));
    git(root, 'init', '-q', '-b', 'main');
    git(root, 'remote', 'add', 'origin', 'https://github.com/JBorgia/signal-tree.git');
    commit(root, start, 'start');
    git(root, 'checkout', '-q', '-b', 'pr');
    const headSha = commit(root, head, 'head');
    git(root, 'checkout', '-q', 'main');
    commit(root, base, 'base');
    git(root, 'merge', '-q', '--no-ff', '--no-commit', '-s', 'ours', 'pr');
    commit(root, merged, 'merge');
    const event = join(root, 'event.json');
    writeFileSync(event, JSON.stringify({ pull_request: { number: 7, head: { sha: headSha } } }));
    return { root, headSha, env: { GITHUB_EVENT_PATH: event } };
  };
  const api = (list: Review[], paths: string[] = []) => (path: string) => {
    paths.push(path);
    return list;
  };

  it('compares the base with the merge commit, so entries main gained since are not removals', () => {
    const C = entry('[T9] added on main meanwhile');
    const { root, env } = pullRequest([A], [A, C], [A, B], [A, C, B]);
    expect(main({ env, root, api: api([]) })).toEqual({ ok: true, lines: ['ok: no existing entry of tests/spec-tests.json changed or removed.'] });
  });

  it("fails a changed entry until JBorgia approves the head, reading this pull request's reviews", () => {
    const { root, headSha, env } = pullRequest([A], [A], [{ ...A, sha256: 'other' }]);
    const paths: string[] = [];
    expect(main({ env, root, api: api([], paths) }).ok).toBe(false);
    expect(main({ env, root, api: api([review('APPROVED', headSha)], paths) }).ok).toBe(true);
    expect(paths).toEqual(['repos/JBorgia/signal-tree/pulls/7/reviews?per_page=100', 'repos/JBorgia/signal-tree/pulls/7/reviews?per_page=100']);
  });

  it('fails a deleted file without approval', () => {
    const { root, env } = pullRequest([A], [A], null);
    expect(main({ env, root, api: api([]) }).lines[0]).toBe(`FAIL removed: ${A.file} :: ${A.title}`);
  });

  it('refuses a checkout that is not the merge commit of the head', () => {
    const { root, env } = pullRequest([A], [A], [A, B]);
    git(root, 'checkout', '-q', 'HEAD^1');
    expect(main({ env, root, api: api([]) }).lines[0]).toMatch(/^FAIL the checkout is not the merge commit of head/);
  });

  it('refuses an event without a pull request', () => {
    const { root } = pullRequest([A], [A], [A]);
    const event = join(root, 'push.json');
    writeFileSync(event, JSON.stringify({ ref: 'refs/heads/main' }));
    expect(main({ env: { GITHUB_EVENT_PATH: event }, root, api: api([]) }).lines).toEqual(['FAIL not a pull request event: run on pull_request or pull_request_review']);
    expect(main({ env: {}, root, api: api([]) }).ok).toBe(false);
  });
});
