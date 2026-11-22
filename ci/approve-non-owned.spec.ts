import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOT, approveNonOwned, githubClient, main } from './approve-non-owned.mjs';

// The decisions of ci/approve-non-owned.mjs, against a fake api.github.com:
// nothing here reaches the network.

const REPO = 'JBorgia/signal-tree';
const API = 'https://api.github.com';
const HEAD = 'a'.repeat(40);
const BASE_SHA = 'b'.repeat(40);
const CODEOWNERS = readFileSync(new URL('../.github/CODEOWNERS', import.meta.url), 'utf8');
const PR_PATH = `/repos/${REPO}/pulls/80`;

type FileEntry = { filename: string; status?: string; previous_filename?: string };
type Review = { user: { login: string } | null; state: string; commit_id: string };
type Call = { method: string; url: string; headers: Record<string, string>; body?: unknown };

const pull = (fields: Record<string, unknown> = {}) => ({
  number: 80,
  state: 'open',
  draft: false,
  changed_files: 1,
  base: { ref: 'main', sha: BASE_SHA, repo: { full_name: REPO } },
  head: { ref: 'rebuild/s8', sha: HEAD, repo: { full_name: REPO } },
  ...fields,
});
const json = (data: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(data), { status: 200, ...init, headers: { 'Content-Type': 'application/json', ...init.headers } });

/**
 * A fake GitHub for one pull request. Lists are served 100 to a page with
 * Link: rel="next", as GitHub does; `prAfter` is the pull request on its second
 * read (the head may have moved).
 */
function fakeGitHub(options: { pr?: Record<string, unknown>; prAfter?: Record<string, unknown>; files?: FileEntry[]; reviews?: Review[]; codeowners?: string | null; fail?: RegExp; nextLink?: string } = {}) {
  const { pr = pull(), files = [{ filename: 'packages/core/src/index.ts', status: 'modified' }], reviews = [], codeowners = CODEOWNERS } = options;
  const calls: Call[] = [];
  let prReads = 0;
  const page = (items: unknown[], url: URL) => {
    const n = Number(url.searchParams.get('page') ?? '1');
    const next = new URL(url);
    next.searchParams.set('page', String(n + 1));
    const more = items.length > n * 100;
    const link = options.nextLink ?? (more ? `<${next}>; rel="next", <${url.origin}${url.pathname}?page=99>; rel="last"` : undefined);
    return json(items.slice((n - 1) * 100, n * 100), link ? { headers: { Link: link } } : {});
  };
  const fetch = async (input: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    const headers = init.headers as Record<string, string>;
    calls.push({ method, url: input, headers, body: init.body === undefined ? undefined : JSON.parse(init.body as string) });
    const url = new URL(input);
    const route = `${method} ${url.pathname}`;
    if (options.fail?.test(route)) return json({ message: 'Server Error' }, { status: 500 });
    if (route === `GET ${PR_PATH}`) return json(prReads++ === 0 ? pr : (options.prAfter ?? pr));
    if (route === `GET ${PR_PATH}/reviews`) return page(reviews, url);
    if (route === `GET ${PR_PATH}/files`) return page(files, url);
    if (route === `GET /repos/${REPO}/contents/.github/CODEOWNERS`) {
      return codeowners === null ? json({ message: 'Not Found' }, { status: 404 }) : new Response(codeowners, { status: 200 });
    }
    if (route === `POST ${PR_PATH}/reviews`) return json({ id: 1, state: 'APPROVED' });
    throw new Error(`unexpected request ${route}`);
  };
  const decide = () => approveNonOwned({ client: githubClient({ token: 'ghs_workflow', fetch }), repo: REPO, number: 80 });
  const routes = () => calls.map((c) => `${c.method} ${new URL(c.url).pathname}`);
  const approvals = () => calls.filter((c) => c.method === 'POST');
  return { fetch, calls, decide, routes, approvals };
}

describe('approve-non-owned decisions', () => {
  it('approves a clean pull request at its head SHA, saying no code-owned path changed', async () => {
    const github = fakeGitHub();
    expect(await github.decide()).toEqual({ approved: true, reason: `approved ${HEAD}: no code-owned path among 1 touched` });
    const [approval] = github.approvals();
    expect(approval.url).toBe(`${API}${PR_PATH}/reviews`);
    expect(approval.body).toEqual({ commit_id: HEAD, event: 'APPROVE', body: expect.stringMatching(/^No code-owned path changed: .* at aaaa.* matches \.github\/CODEOWNERS at bbbb/) });
    expect(github.routes()).toEqual([
      `GET ${PR_PATH}`,
      `GET ${PR_PATH}/reviews`,
      `GET ${PR_PATH}/files`,
      `GET /repos/${REPO}/contents/.github/CODEOWNERS`,
      `GET ${PR_PATH}`,
      `POST ${PR_PATH}/reviews`,
    ]);
    // CODEOWNERS comes from the base commit, raw; every request carries only the workflow token.
    const codeowners = github.calls.find((c) => c.url.includes('/contents/'));
    expect(new URL(codeowners!.url).searchParams.get('ref')).toBe(BASE_SHA);
    expect(codeowners!.headers.Accept).toBe('application/vnd.github.raw+json');
    expect(github.calls.every((c) => c.headers.Authorization === 'Bearer ghs_workflow' && c.url.startsWith(`${API}/`))).toBe(true);
  });

  it("never approves a fork's pull request, nor reads its files", async () => {
    for (const head of [{ ref: 'main', sha: HEAD, repo: { full_name: 'someone/signal-tree' } }, { ref: 'x', sha: HEAD, repo: null }]) {
      const github = fakeGitHub({ pr: pull({ head }) });
      const result = await github.decide();
      expect(result.approved).toBe(false);
      expect(result.reason).toMatch(/a fork's pull request is never approved/);
      expect(github.routes()).toEqual([`GET ${PR_PATH}`]);
    }
  });

  it('skips a pull request that is closed or not into main of this repository', async () => {
    const cases: Array<[Record<string, unknown>, RegExp]> = [
      [{ state: 'closed' }, /is closed, not open/],
      [{ base: { ref: 'release/15.x', sha: BASE_SHA, repo: { full_name: REPO } } }, /into JBorgia\/signal-tree:release\/15\.x, not JBorgia\/signal-tree:main/],
      [{ base: { ref: 'main', sha: BASE_SHA, repo: { full_name: 'someone/signal-tree' } } }, /not JBorgia\/signal-tree:main/],
    ];
    for (const [fields, reason] of cases) {
      const github = fakeGitHub({ pr: pull(fields) });
      expect((await github.decide()).reason).toMatch(reason);
      expect(github.approvals()).toEqual([]);
    }
  });

  it('never approves a pull request that touches a code-owned path, naming the paths', async () => {
    const github = fakeGitHub({ pr: pull({ changed_files: 3 }), files: [{ filename: 'README.md' }, { filename: 'ci/done-check.mjs' }, { filename: 'bench/budgets.json' }] });
    const result = await github.decide();
    expect(result).toEqual({ approved: false, reason: `#80 changes code-owned paths, so it needs Jonathan's review: "ci/done-check.mjs", "bench/budgets.json"` });
    expect(github.approvals()).toEqual([]);
  });

  it('never approves a rename whose old path is code-owned', async () => {
    const github = fakeGitHub({ files: [{ filename: 'docs/old-gate.mjs', status: 'renamed', previous_filename: 'ci/gate-baseline.mjs' }] });
    expect((await github.decide()).reason).toContain('"ci/gate-baseline.mjs"');
    expect(github.approvals()).toEqual([]);
  });

  it('skips a draft until ready_for_review runs it again', async () => {
    const github = fakeGitHub({ pr: pull({ draft: true }) });
    expect(await github.decide()).toEqual({ approved: false, reason: '#80 is a draft' });
    expect(github.routes()).toEqual([`GET ${PR_PATH}`]);
  });

  it('fails closed past GitHub\'s 3000-file listing limit, without listing anything', async () => {
    const github = fakeGitHub({ pr: pull({ changed_files: 3001 }) });
    expect((await github.decide()).reason).toBe('#80 changes 3001 files; GitHub lists at most 3000, so they cannot all be checked');
    expect(github.routes()).toEqual([`GET ${PR_PATH}`]);
  });

  it('throws, approving nothing, when the listing is not every changed file', async () => {
    const github = fakeGitHub({ pr: pull({ changed_files: 2 }) });
    await expect(github.decide()).rejects.toThrow('GitHub listed 1 changed files of 2');
    expect(github.approvals()).toEqual([]);
  });

  it('does not stack approvals: skips when github-actions[bot] already approved this head', async () => {
    const approvedHere = { user: { login: BOT }, state: 'APPROVED', commit_id: HEAD };
    const github = fakeGitHub({ reviews: [approvedHere] });
    expect(await github.decide()).toEqual({ approved: false, reason: `${BOT} already approved ${HEAD}` });
    expect(github.routes()).toEqual([`GET ${PR_PATH}`, `GET ${PR_PATH}/reviews`]);
  });

  it('approves again for a new head, after a dismissal, or over approvals by others', async () => {
    const reviews: Review[] = [
      { user: { login: BOT }, state: 'APPROVED', commit_id: 'c'.repeat(40) },
      { user: { login: BOT }, state: 'DISMISSED', commit_id: HEAD },
      { user: { login: 'someone' }, state: 'APPROVED', commit_id: HEAD },
      { user: null, state: 'APPROVED', commit_id: HEAD },
    ];
    const github = fakeGitHub({ reviews });
    expect((await github.decide()).approved).toBe(true);
    expect(github.approvals()).toHaveLength(1);
  });

  it('follows every page of reviews and files', async () => {
    const earlier = Array.from({ length: 150 }, (_, i): Review => ({ user: { login: `r${i}` }, state: 'COMMENTED', commit_id: HEAD }));
    const reviewed = fakeGitHub({ reviews: [...earlier, { user: { login: BOT }, state: 'APPROVED', commit_id: HEAD }] });
    expect((await reviewed.decide()).reason).toBe(`${BOT} already approved ${HEAD}`);

    const files = Array.from({ length: 250 }, (_, i): FileEntry => ({ filename: `packages/core/src/f${i}.ts` }));
    files[230] = { filename: '.github/workflows/ci.yml' };
    const github = fakeGitHub({ pr: pull({ changed_files: 250 }), files });
    expect((await github.decide()).reason).toContain('".github/workflows/ci.yml"');
    expect(github.calls.filter((c) => c.url.includes('/files')).map((c) => new URL(c.url).searchParams.get('page'))).toEqual([null, '2', '3']);
    expect(github.approvals()).toEqual([]);
  });

  it('fails closed without a CODEOWNERS at the base commit, or with a line it cannot parse', async () => {
    const missing = fakeGitHub({ codeowners: null });
    expect((await missing.decide()).reason).toBe(`there is no .github/CODEOWNERS at the base commit ${BASE_SHA}, so code ownership cannot be checked`);
    expect(missing.approvals()).toEqual([]);

    const garbled = fakeGitHub({ codeowners: `${CODEOWNERS}\n!/ci/ @JBorgia\n` });
    const result = await garbled.decide();
    expect(result.approved).toBe(false);
    expect(result.reason).toContain('has a line that cannot be parsed, so every file counts as owned');
    expect(result.reason).toContain('"packages/core/src/index.ts"');
    expect(garbled.approvals()).toEqual([]);
  });

  it('skips when the head moves while it runs; the run for that push decides', async () => {
    const github = fakeGitHub({ prAfter: pull({ head: { ref: 'rebuild/s8', sha: 'd'.repeat(40), repo: { full_name: REPO } } }) });
    expect((await github.decide()).reason).toMatch(/^the head moved from a+ to d+ while this ran/);
    expect(github.approvals()).toEqual([]);
  });

  it('throws, approving nothing, on an API error or a malformed pull request', async () => {
    for (const fail of [/files$/, /reviews$/, /CODEOWNERS$/]) {
      const github = fakeGitHub({ fail });
      await expect(github.decide()).rejects.toThrow('GitHub answered 500: Server Error');
      expect(github.approvals()).toEqual([]);
    }
    await expect(fakeGitHub({ pr: pull({ head: { sha: 'HEAD', repo: { full_name: REPO } } }) }).decide()).rejects.toThrow('malformed head or base SHA');
    await expect(fakeGitHub({ pr: pull({ changed_files: undefined }) }).decide()).rejects.toThrow('no changed_files count');
  });

  it('never sends the token outside the API, even when a Link header points elsewhere', async () => {
    const github = fakeGitHub({ nextLink: '<https://evil.example/steal?page=2>; rel="next"' });
    await expect(github.decide()).rejects.toThrow('refusing to send the token to https://evil.example/steal?page=2');
    expect(github.calls.every((c) => c.url.startsWith(`${API}/`))).toBe(true);
    expect(github.approvals()).toEqual([]);
  });
});

describe('approve-non-owned from the Actions environment', () => {
  const env = { GITHUB_REPOSITORY: REPO, GITHUB_EVENT_PATH: '/event.json', GH_TOKEN: 'ghs_workflow' };
  const event = (number: unknown) => () => JSON.stringify({ action: 'synchronize', pull_request: { number } });

  it('takes the pull request number from the event, logs the decision and exits 0', async () => {
    const github = fakeGitHub();
    const lines: string[] = [];
    expect(await main({ env, fetch: github.fetch, log: (line: string) => lines.push(line), readFile: event(80) })).toBe(0);
    expect(lines).toEqual([`approve-non-owned: approved ${HEAD}: no code-owned path among 1 touched`]);

    const owned = fakeGitHub({ files: [{ filename: 'ci/x.mjs' }] });
    lines.length = 0;
    expect(await main({ env, fetch: owned.fetch, log: (line: string) => lines.push(line), readFile: event(80) })).toBe(0);
    expect(lines[0]).toMatch(/^approve-non-owned: not approved: #80 changes code-owned paths/);
  });

  it('exits 1, approving nothing, on bad settings or an API error', async () => {
    const cases: Array<[Record<string, string>, () => string, RegExp]> = [
      [{ ...env, GITHUB_REPOSITORY: 'nope' }, event(80), /GITHUB_REPOSITORY/],
      [{ ...env, GH_TOKEN: '' }, event(80), /GH_TOKEN/],
      [env, event('80; rm'), /no pull request number/],
      [env, () => '{}', /no pull request number/],
    ];
    for (const [settings, readFile, message] of cases) {
      const github = fakeGitHub();
      const lines: string[] = [];
      expect(await main({ env: settings, fetch: github.fetch, log: (line: string) => lines.push(line), readFile })).toBe(1);
      expect(lines.join('\n')).toMatch(message);
      expect(github.calls).toEqual([]);
    }
    const down = fakeGitHub({ fail: /pulls\/80$/ });
    expect(await main({ env, fetch: down.fetch, log: () => {}, readFile: event(80) })).toBe(1);
    expect(down.approvals()).toEqual([]);
  });
});
