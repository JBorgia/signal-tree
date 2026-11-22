// Approves, as github-actions[bot], a pull request into main that touches no
// code-owned path (.github/workflows/approve-non-owned.yml).
//
// Jonathan's ruling: the ruleset on main requires one approving review and
// code-owner review, with no bypass. This workflow supplies that one approval
// for a pull request no code owner has to see; one that touches a code-owned
// path still waits for Jonathan, and a fork's pull request is never approved.
//
// The workflow runs on pull_request_target, so this file is always main's
// version and the pull request's code is never checked out: everything about
// the pull request comes from the REST API, and CODEOWNERS is read from the
// base commit.
//
// Decisions, in order; the first that applies wins:
//   the pull request is not open                          skip
//   its base is not main of this repository               skip
//   its head is not a branch of this repository (a fork)  skip
//   it is a draft                                         skip (ready_for_review runs this again)
//   more than 3000 files changed                          skip (GitHub lists at most 3000)
//   github-actions[bot] approved this head SHA already    skip
//   the listing is not every changed file                 error, nothing approved
//   no .github/CODEOWNERS at the base commit              skip
//   a changed path, or a renamed file's old path, is
//     code-owned, or CODEOWNERS has a line ci/codeowners.mjs
//     cannot parse (every file then counts as owned)      skip, naming the paths
//   the head moved while this ran                         skip (that push's run decides)
//   otherwise                                             approve the head SHA
// A push later dismisses the approval (the ruleset's stale-review dismissal)
// and runs this again for the new head.
//
// Environment (from Actions): GITHUB_REPOSITORY, GITHUB_EVENT_PATH,
// GITHUB_API_URL, and GH_TOKEN, the workflow's GITHUB_TOKEN.
// Exit status: 0 approved or skipped; 1 any error (nothing approved).
import { readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { FILE_LIMIT, changedPaths, ownedPaths, parseCodeowners } from './codeowners.mjs';

export const BOT = 'github-actions[bot]';
export const BASE = 'main';
export const CODEOWNERS = '.github/CODEOWNERS';
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_PAGES = 100;
const SHA = /^[0-9a-f]{40}$/;

/** A small REST client for `apiUrl` that sends `token` nowhere else. */
export function githubClient({ token, apiUrl = 'https://api.github.com', fetch = globalThis.fetch }) {
  const root = apiUrl.replace(/\/+$/, '');
  async function request(target, { method = 'GET', body, accept = 'application/vnd.github+json', missing = false } = {}) {
    const url = target.startsWith('/') ? `${root}${target}` : target;
    if (!url.startsWith(`${root}/`)) throw new Error(`refusing to send the token to ${url}, outside ${root}`);
    const headers = { Accept: accept, Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'approve-non-owned' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: globalThis.AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (missing && response.status === 404) return null;
    if (!response.ok) {
      let message = '';
      try {
        message = JSON.parse(await response.text()).message ?? '';
      } catch {
        // Not JSON: the status alone says enough.
      }
      throw new Error(`${method} ${url.slice(root.length).split('?')[0]}: GitHub answered ${response.status}${message ? `: ${message}` : ''}`);
    }
    return response;
  }
  return {
    get: async (path) => (await request(path)).json(),
    /** The raw file at `path` (a contents URL), or null when there is none. */
    raw: async (path) => {
      const response = await request(path, { accept: 'application/vnd.github.raw+json', missing: true });
      return response === null ? null : response.text();
    },
    /** Every item of a paginated list, following Link: rel="next". */
    all: async (path) => {
      const items = [];
      let next = path;
      for (let page = 0; next; page++) {
        if (page === MAX_PAGES) throw new Error(`GET ${path.split('?')[0]}: more than ${MAX_PAGES} pages`);
        const response = await request(next);
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error(`GET ${path.split('?')[0]}: not a list`);
        items.push(...data);
        next = /<([^>]+)>;\s*rel="next"/.exec(response.headers.get('link') ?? '')?.[1];
      }
      return items;
    },
    post: async (path, body) => (await request(path, { method: 'POST', body })).json(),
  };
}

/**
 * Decides on pull request `number` of `repo` and approves it when it touches
 * no code-owned path. Returns { approved, reason }; throws, approving nothing,
 * on any API error or malformed answer.
 */
export async function approveNonOwned({ client, repo, number }) {
  const prPath = `/repos/${repo}/pulls/${number}`;
  const skip = (reason) => ({ approved: false, reason });
  const pr = await client.get(prPath);

  if (pr.state !== 'open') return skip(`#${number} is ${pr.state}, not open`);
  if (pr.base?.repo?.full_name !== repo || pr.base?.ref !== BASE) return skip(`#${number} is into ${pr.base?.repo?.full_name}:${pr.base?.ref}, not ${repo}:${BASE}`);
  if (pr.head?.repo?.full_name !== repo) return skip(`#${number} comes from ${pr.head?.repo?.full_name ?? 'a deleted repository'}, not a branch of ${repo}; a fork's pull request is never approved`);
  if (pr.draft !== false) return skip(`#${number} is a draft`);
  const head = pr.head.sha;
  const base = pr.base.sha;
  if (!SHA.test(head) || !SHA.test(base)) throw new Error(`#${number} has a malformed head or base SHA`);
  if (!Number.isSafeInteger(pr.changed_files)) throw new Error(`#${number} has no changed_files count`);
  if (pr.changed_files > FILE_LIMIT) return skip(`#${number} changes ${pr.changed_files} files; GitHub lists at most ${FILE_LIMIT}, so they cannot all be checked`);

  const reviews = await client.all(`${prPath}/reviews?per_page=100`);
  if (reviews.some((review) => review.user?.login === BOT && review.state === 'APPROVED' && review.commit_id === head)) return skip(`${BOT} already approved ${head}`);

  const paths = changedPaths(await client.all(`${prPath}/files?per_page=100`), pr.changed_files);
  const codeowners = await client.raw(`/repos/${repo}/contents/${CODEOWNERS}?ref=${base}`);
  if (codeowners === null) return skip(`there is no ${CODEOWNERS} at the base commit ${base}, so code ownership cannot be checked`);
  const { problems } = parseCodeowners(codeowners);
  const owned = ownedPaths(codeowners, paths);
  if (owned.length > 0) {
    const why = problems.length > 0 ? ` (${CODEOWNERS} at ${base} has a line that cannot be parsed, so every file counts as owned: ${problems.join('; ')})` : '';
    return skip(`#${number} changes code-owned paths, so it needs Jonathan's review${why}: ${owned.map((path) => JSON.stringify(path)).join(', ')}`);
  }

  const now = await client.get(prPath);
  if (now.head?.sha !== head) return skip(`the head moved from ${head} to ${now.head?.sha} while this ran; the run for that push decides`);

  const body = `No code-owned path changed: none of the ${paths.length} paths this pull request touches at ${head} matches ${CODEOWNERS} at ${base}. Approved by .github/workflows/approve-non-owned.yml.`;
  await client.post(`${prPath}/reviews`, { commit_id: head, event: 'APPROVE', body });
  return { approved: true, reason: `approved ${head}: no code-owned path among ${paths.length} touched` };
}

/** Runs from the Actions environment; returns the exit status. */
export async function main({ env = process.env, fetch = globalThis.fetch, log = console.log, readFile = readFileSync } = {}) {
  try {
    const repo = env.GITHUB_REPOSITORY ?? '';
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('GITHUB_REPOSITORY is not owner/name');
    if (!env.GH_TOKEN) throw new Error('GH_TOKEN is not set');
    const number = JSON.parse(readFile(env.GITHUB_EVENT_PATH ?? '', 'utf8')).pull_request?.number;
    if (!Number.isSafeInteger(number) || number < 1) throw new Error('the event has no pull request number');
    const client = githubClient({ token: env.GH_TOKEN, apiUrl: env.GITHUB_API_URL || undefined, fetch });
    const { approved, reason } = await approveNonOwned({ client, repo, number });
    log(`approve-non-owned: ${approved ? '' : 'not approved: '}${reason}`);
    return 0;
  } catch (error) {
    log(`approve-non-owned: not approved: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  process.exitCode = await main();
}
