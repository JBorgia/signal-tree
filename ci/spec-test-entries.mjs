// Existing entries of tests/spec-tests.json change only with Jonathan's
// approval (his ruling of 2026-11-24 on test tags, BRIEF.md 12.1.3 and 12.1.6:
// https://github.com/JBorgia/signal-tree/pull/94#issuecomment-7143537523).
//
// A pull request may add entries and merge once CI is green, so
// tests/spec-tests.json is no longer code-owned. Instead this check, a required
// check of the main ruleset, fails when a pull request changes or removes an
// entry its base has, unless JBorgia's latest review approves the pull
// request's head commit. ci/spec-tests.mjs check still makes every tagged test
// match its entry, so a changed spec test is a changed entry.
//
// .github/workflows/spec-test-entries.yml runs it on pull_request and on
// pull_request_review, so an approval or its dismissal runs it again. It
// compares the base (the merge commit's first parent) with the merge commit:
// what main would hold after the merge. This script, its workflow and the rest
// of ci/ and .github/ stay code-owned, so a pull request cannot weaken the
// check without Jonathan's review.
//
//   node ci/spec-test-entries.mjs     in CI: reads GITHUB_EVENT_PATH, and the reviews through gh api
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { ghApi, repoSlug } from './github.mjs';

// Node builtins only, so the workflow needs no pnpm install (entry-graph.mjs's repoRoot loads esbuild).
const repoRoot = realpathSync(new URL('..', import.meta.url).pathname);

export const SPEC_TESTS_FILE = 'tests/spec-tests.json';
/** Jonathan's GitHub account. The id is what counts: a login can be renamed and reused. */
export const JONATHAN = { login: 'JBorgia', id: 22381905 };
/** The job's name, which the main ruleset requires. */
export const SPEC_TEST_ENTRIES_JOB = "Existing spec-test entries change only with JBorgia's approval";

const key = (entry) => `${entry.file} :: ${entry.title}`;
/** An entry with its keys sorted, so any change to any field counts and key order does not. */
const canonical = (entry) => JSON.stringify(Object.fromEntries(Object.entries(entry).sort(([a], [b]) => (a < b ? -1 : 1))));

/** The entries in one version of tests/spec-tests.json; `text` is null where the file is absent. Throws on a malformed file. */
export function parseEntries(text, where) {
  if (text === null) return [];
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error(`${SPEC_TESTS_FILE} on ${where} is not JSON: ${error.message}`, { cause: error });
  }
  if (!Array.isArray(data?.tests)) throw new Error(`${SPEC_TESTS_FILE} on ${where} has no "tests" array`);
  for (const [i, entry] of data.tests.entries()) {
    if (typeof entry?.file !== 'string' || typeof entry.title !== 'string') throw new Error(`${SPEC_TESTS_FILE} on ${where}: entry ${i} has no file and title`);
  }
  return data.tests;
}

/**
 * The base's entries that the head changes or removes, one line each. Added
 * entries are not listed. A key the head holds twice is listed too, since it
 * would leave which entry counts ambiguous.
 */
export function existingEntryChanges(base, head) {
  const after = new Map();
  const problems = [];
  for (const entry of head) {
    if (after.has(key(entry))) problems.push(`duplicate: ${key(entry)}`);
    after.set(key(entry), entry);
  }
  for (const entry of base) {
    const now = after.get(key(entry));
    if (!now) problems.push(`removed: ${key(entry)}`);
    else if (canonical(now) !== canonical(entry)) problems.push(`changed: ${key(entry)}`);
  }
  return problems;
}

/**
 * Whether Jonathan's latest deciding review approves `headSha`. Comments do
 * not decide. A request for changes, or a dismissal (the ruleset dismisses
 * approvals on every push), does, as does an approval of an older commit.
 */
export function approvedByJonathan(reviews, headSha) {
  const deciding = reviews
    .filter((r) => r?.user?.id === JONATHAN.id && ['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(r.state))
    .sort((a, b) => a.id - b.id);
  const last = deciding.at(-1);
  return last?.state === 'APPROVED' && last.commit_id === headSha;
}

/** The verdict for one pull request: { ok, lines }. `reviews` is called only when an existing entry changed. */
export function decide({ baseText, headText, headSha, reviews }) {
  let problems;
  try {
    problems = existingEntryChanges(parseEntries(baseText, 'the base'), parseEntries(headText, 'the merge commit'));
  } catch (error) {
    return { ok: false, lines: [`FAIL ${error.message}`] };
  }
  if (problems.length === 0) return { ok: true, lines: [`ok: no existing entry of ${SPEC_TESTS_FILE} changed or removed.`] };
  const short = headSha.slice(0, 12);
  if (approvedByJonathan(reviews(), headSha)) {
    return { ok: true, lines: [...problems, `ok: ${problems.length} existing entr${problems.length === 1 ? 'y' : 'ies'} changed or removed, approved by ${JONATHAN.login} on ${short}.`] };
  }
  return {
    ok: false,
    lines: [
      ...problems.map((p) => `FAIL ${p}`),
      `${problems.length} existing entr${problems.length === 1 ? 'y' : 'ies'} of ${SPEC_TESTS_FILE} changed or removed. This needs ${JONATHAN.login}'s approving review of ${short} (ruling of 2026-11-24); adding entries does not.`,
    ],
  };
}

/** The file at `rev`, or null where it is absent. */
function fileAt(rev, root) {
  if (spawnSync('git', ['cat-file', '-e', `${rev}:${SPEC_TESTS_FILE}`], { cwd: root }).status !== 0) return null;
  return execFileSync('git', ['show', `${rev}:${SPEC_TESTS_FILE}`], { cwd: root, encoding: 'utf8', maxBuffer: 256 << 20 });
}

/** In CI: the pull request from the event, the base and merge commit from the checkout, and the reviews from the API. */
export function main({ env = process.env, root = repoRoot, api = ghApi } = {}) {
  const pr = env.GITHUB_EVENT_PATH ? JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8')).pull_request : undefined;
  if (!pr?.number || !pr.head?.sha) return { ok: false, lines: ['FAIL not a pull request event: run on pull_request or pull_request_review'] };
  const parents = execFileSync('git', ['rev-list', '--parents', '-n', '1', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim().split(' ');
  if (parents.length !== 3 || parents[2] !== pr.head.sha) {
    return { ok: false, lines: [`FAIL the checkout is not the merge commit of head ${pr.head.sha.slice(0, 12)} into its base; check out the pull request's merge ref with fetch-depth: 2`] };
  }
  return decide({
    baseText: fileAt('HEAD^1', root),
    headText: fileAt('HEAD', root),
    headSha: pr.head.sha,
    reviews: () => api(`repos/${repoSlug(root)}/pulls/${pr.number}/reviews?per_page=100`),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let result;
  try {
    result = main();
  } catch (error) {
    result = { ok: false, lines: [`FAIL ${error.message}`] };
  }
  for (const line of result.lines) console.log(line);
  process.exit(result.ok ? 0 : 1);
}
