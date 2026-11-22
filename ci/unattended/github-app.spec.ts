import { spawnSync } from 'node:child_process';
import { generateKeyPairSync, verify } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { REFRESH_MARGIN_MS, TOKEN_REQUEST, appJwt, configFromEnv, getToken, gitCredential, mintToken } from './app-token.mjs';

// Tests for the GitHub App identity of the unattended runner: app-token.mjs,
// the gh wrapper (bin/gh) and the supervisor's setup and startup checks.
// Nothing here reaches the network: GitHub is a fake fetch or a fake gh, the
// command-line runs find a valid token in the cache, and every supervisor run
// stops at a check before its first network call (git ls-remote).

const appToken = new URL('./app-token.mjs', import.meta.url).pathname;
const wrapper = new URL('./bin/gh', import.meta.url).pathname;
const codeownersMatcher = new URL('../codeowners.mjs', import.meta.url).pathname;
const CODEOWNERS = readFileSync(new URL('../../.github/CODEOWNERS', import.meta.url), 'utf8');
const unattended = new URL('.', import.meta.url).pathname.replace(/\/$/, '');
const supervisor = new URL('./supervise.sh', import.meta.url).pathname;

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
});

const dirs: string[] = [];
const scratch = () => {
  const dir = mkdtempSync(join(tmpdir(), 'signal-tree-app-'));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const decode = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
const mode = (path: string) => statSync(path).mode & 0o777;
const T0 = Date.UTC(2026, 10, 20, 12, 0, 0);
const MINUTE = 60_000;
const noSleep = async () => {};
const ORIGIN = 'https://github.com/JBorgia/signal-tree.git';
const APPROVED_REQUEST = {
  repositories: ['signal-tree'],
  permissions: { contents: 'write', pull_requests: 'write', issues: 'write', checks: 'write', workflows: 'write', actions: 'read' },
};

/** A fake api.github.com: each request takes the next answer (a Response, or a thrown network error). */
function fakeGitHub(answers: Array<() => Response>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetch = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = answers.shift();
    if (!next) throw new Error('unexpected request');
    return next();
  };
  return { fetch, calls };
}
const issued = (token: string, expiresAt: number) => () => new Response(JSON.stringify({ token, expires_at: new Date(expiresAt).toISOString() }), { status: 201 });
const failed = (status: number, message: string) => () => new Response(JSON.stringify({ message }), { status });

/** A state directory whose cache holds a token valid for another hour, and the App settings that match it. */
function appFixture(token = 'ghs_cached') {
  const root = scratch();
  const state = join(root, 'state');
  mkdirSync(state, { mode: 0o755 });
  const cache = join(state, 'app-token.json');
  writeFileSync(cache, JSON.stringify({ appId: 12345, installationId: '678', request: TOKEN_REQUEST, token, expiresAt: new Date(Date.now() + 60 * MINUTE).toISOString() }), { mode: 0o600 });
  const keyFile = join(root, 'app.pem');
  writeFileSync(keyFile, privateKey, { mode: 0o600 });
  const env = { SIGNAL_TREE_APP_ID: '12345', SIGNAL_TREE_APP_INSTALLATION_ID: '678', SIGNAL_TREE_APP_KEY_FILE: keyFile, SIGNAL_TREE_STATE_DIR: state };
  return { root, state, cache, keyFile, env };
}

/** process.env without anything that would leak the developer's own setup into a run. */
function cleanEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
  const env: Record<string, string | undefined> = { ...process.env, ...extra };
  for (const name of Object.keys(env)) {
    if (/^(GH_|GITHUB_|GIT_|SSH_ASKPASS|SIGNAL_TREE_|CLAUDE_)/.test(name) && !(name in extra)) delete env[name];
  }
  return env as NodeJS.ProcessEnv;
}

function writeScript(path: string, body: string) {
  writeFileSync(path, `#!/usr/bin/env bash\n${body}\n`);
  chmodSync(path, 0o755);
}

const isolatedGit = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
const git = (cwd: string, ...args: string[]) => {
  const r = spawnSync('git', args, { cwd, env: cleanEnv(isolatedGit), encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};

/** An empty repository whose origin is `url`; nothing is fetched. */
function checkout(url: string) {
  const dir = join(scratch(), 'work');
  mkdirSync(dir);
  git(dir, 'init', '-q');
  git(dir, 'remote', 'add', 'origin', url);
  return dir;
}

/** Bash that defines the supervisor's constants and the named functions, as the script does. */
const shellFunctions = (...names: string[]) => `eval "$(sed -n '/^readonly /p;${names.map((name) => `/^${name}()/,/^}/p`).join(';')}' '${supervisor}')"`;
const bash = (script: string, env: Record<string, string>, cwd?: string) => spawnSync('/bin/bash', ['-c', script], { cwd, env: cleanEnv(env), encoding: 'utf8' });

describe('GitHub App JWT', () => {
  it('is RS256 with iss = the App ID, iat = now - 60 s and exp = now + 540 s, signed with the App key', () => {
    const jwt = appJwt({ appId: 12345, privateKey, now: T0 + 999 });
    expect(jwt).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    const [header, payload, signature] = jwt.split('.');
    expect(decode(header)).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(decode(payload)).toEqual({ iat: T0 / 1000 - 60, exp: T0 / 1000 + 540, iss: 12345 });
    const signed = Buffer.from(`${header}.${payload}`);
    expect(verify('sha256', signed, publicKey, Buffer.from(signature, 'base64url'))).toBe(true);
    const stranger = generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey;
    expect(verify('sha256', signed, stranger, Buffer.from(signature, 'base64url'))).toBe(false);
  });

  it('takes its settings from the environment, refusing missing or non-numeric IDs', () => {
    const env = { SIGNAL_TREE_APP_ID: '12345', SIGNAL_TREE_APP_INSTALLATION_ID: '678', SIGNAL_TREE_APP_KEY_FILE: '/secrets/app.pem', SIGNAL_TREE_STATE_DIR: '/state' };
    expect(configFromEnv(env)).toEqual({ appId: 12345, installationId: '678', keyFile: '/secrets/app.pem', cacheFile: '/state/app-token.json' });
    expect(() => configFromEnv({})).toThrow('SIGNAL_TREE_APP_ID, SIGNAL_TREE_APP_INSTALLATION_ID, SIGNAL_TREE_APP_KEY_FILE not set');
    expect(() => configFromEnv({ ...env, SIGNAL_TREE_APP_INSTALLATION_ID: '678/../../user' })).toThrow('SIGNAL_TREE_APP_INSTALLATION_ID must be');
    expect(() => configFromEnv({ ...env, SIGNAL_TREE_APP_ID: 'signal-tree-ci' })).toThrow('SIGNAL_TREE_APP_ID must be');
  });
});

describe('GitHub App installation token', () => {
  const config = () => {
    const root = scratch();
    const keyFile = join(root, 'app.pem');
    writeFileSync(keyFile, privateKey);
    return { appId: 12345, installationId: '678', keyFile, cacheFile: join(root, 'state', 'app-token.json') };
  };
  const cached = (c: { cacheFile: string }, record: object | string) => {
    mkdirSync(join(c.cacheFile, '..'), { recursive: true });
    writeFileSync(c.cacheFile, typeof record === 'string' ? record : JSON.stringify(record));
  };

  it('asks for signal-tree only, with the approved permissions, signed with the App JWT', async () => {
    const github = fakeGitHub([issued('ghs_first', T0 + 60 * MINUTE)]);
    await getToken(config(), { now: T0, fetch: github.fetch });
    const [{ url, init }] = github.calls;
    expect(url).toBe('https://api.github.com/app/installations/678/access_tokens');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual(APPROVED_REQUEST);
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers.Accept).toBe('application/vnd.github+json');
    expect(decode(headers.Authorization.replace(/^Bearer /, '').split('.')[1])).toEqual({ iat: T0 / 1000 - 60, exp: T0 / 1000 + 540, iss: 12345 });
  });

  it('caches the token owner-only and reuses it until 10 minutes before it expires', async () => {
    const c = config();
    const github = fakeGitHub([issued('ghs_first', T0 + 60 * MINUTE), issued('ghs_second', T0 + 120 * MINUTE)]);
    expect(await getToken(c, { now: T0, fetch: github.fetch })).toBe('ghs_first');
    expect(mode(c.cacheFile)).toBe(0o600);
    expect(JSON.parse(readFileSync(c.cacheFile, 'utf8'))).toEqual({ appId: 12345, installationId: '678', request: APPROVED_REQUEST, token: 'ghs_first', expiresAt: new Date(T0 + 60 * MINUTE).toISOString() });

    // 11 minutes left: reused. Exactly 10 left: refreshed.
    expect(await getToken(c, { now: T0 + 49 * MINUTE, fetch: github.fetch })).toBe('ghs_first');
    expect(github.calls).toHaveLength(1);
    expect(await getToken(c, { now: T0 + 60 * MINUTE - REFRESH_MARGIN_MS, fetch: github.fetch })).toBe('ghs_second');
    expect(github.calls).toHaveLength(2);
    expect(JSON.parse(readFileSync(c.cacheFile, 'utf8')).token).toBe('ghs_second');
    expect(mode(c.cacheFile)).toBe(0o600);
  });

  it('mints afresh unless the cache holds an installation token (ghs_) for this installation and scope', async () => {
    const c = config();
    const good = { appId: 12345, installationId: '678', request: TOKEN_REQUEST, token: 'ghs_cached', expiresAt: new Date(T0 + 60 * MINUTE).toISOString() };
    cached(c, good);
    expect(await getToken(c, { now: T0, fetch: fakeGitHub([]).fetch })).toBe('ghs_cached');

    const rejected = ['not json', { ...good, installationId: '999' }, { ...good, token: 'gho_personal' }, { ...good, token: 'ghs_x\nusername=someone' }, { ...good, request: undefined }, { ...good, request: { repositories: ['signal-tree'], permissions: { contents: 'write' } } }];
    for (const record of rejected) {
      cached(c, record);
      const github = fakeGitHub([issued('ghs_fresh', T0 + 60 * MINUTE)]);
      expect(await getToken(c, { now: T0, fetch: github.fetch })).toBe('ghs_fresh');
      expect(github.calls).toHaveLength(1);
    }
  });

  it('retries network errors and 5xx answers, then gives up with the last problem', async () => {
    const sleeps: number[] = [];
    const sleep = async (ms: number) => {
      sleeps.push(ms);
    };
    const flaky = fakeGitHub([
      () => {
        throw new TypeError('fetch failed', { cause: new Error('getaddrinfo ENOTFOUND api.github.com') });
      },
      failed(502, 'Server Error'),
      issued('ghs_ok', T0 + 60 * MINUTE),
    ]);
    expect(await mintToken({ appId: 12345, installationId: '678', privateKey, now: T0, fetch: flaky.fetch, sleep })).toEqual({ token: 'ghs_ok', expiresAt: new Date(T0 + 60 * MINUTE).toISOString() });
    expect(sleeps).toEqual([1000, 2000]);

    const down = fakeGitHub([failed(503, 'Unavailable'), failed(503, 'Unavailable'), failed(503, 'Unavailable')]);
    await expect(mintToken({ appId: 12345, installationId: '678', privateKey, now: T0, fetch: down.fetch, sleep: noSleep })).rejects.toThrow('after 3 attempts: GitHub answered 503: Unavailable.');
    expect(down.calls).toHaveLength(3);
  });

  it("fails at once on a 4xx answer with GitHub's message and a hint, and never shows the JWT or the key", async () => {
    const denied = fakeGitHub([failed(401, 'A JSON web token could not be decoded')]);
    const error: Error = await mintToken({ appId: 12345, installationId: '678', privateKey, now: T0, fetch: denied.fetch, sleep: noSleep }).catch((e: Error) => e);
    expect(error.message).toContain('GitHub answered 401: A JSON web token could not be decoded.');
    expect(error.message).toContain('Check SIGNAL_TREE_APP_ID');
    expect(denied.calls).toHaveLength(1);
    const jwt = (denied.calls[0].init.headers as Record<string, string>).Authorization.replace(/^Bearer /, '');
    expect(error.message).not.toContain(jwt.split('.')[2]);
    expect(error.message).not.toContain(privateKey.split('\n')[1]);

    const missing = fakeGitHub([failed(404, 'Not Found')]);
    await expect(mintToken({ appId: 12345, installationId: '678', privateKey, now: T0, fetch: missing.fetch, sleep: noSleep })).rejects.toThrow('Check SIGNAL_TREE_APP_INSTALLATION_ID');
  });

  it('refuses an answer without an installation token (ghs_) and its expiry', async () => {
    for (const answer of [() => new Response('{}', { status: 201 }), issued('gho_personal', T0 + 60 * MINUTE), issued('ghs_x\nusername=someone', T0 + 60 * MINUTE)]) {
      await expect(mintToken({ appId: 12345, installationId: '678', privateKey, now: T0, fetch: fakeGitHub([answer]).fetch, sleep: noSleep })).rejects.toThrow('without an installation token (ghs_...)');
    }
  });

  it('refuses a key file it cannot use, naming the file but never echoing its contents', async () => {
    const c = config();
    const github = fakeGitHub([]);
    writeFileSync(c.keyFile, '-----BEGIN RSA PRIVATE KEY-----\nSENTINEL-NOT-A-KEY\n-----END RSA PRIVATE KEY-----\n');
    const garbled: Error = await getToken(c, { now: T0, fetch: github.fetch }).catch((e: Error) => e);
    expect(garbled.message).toContain(`${c.keyFile} (SIGNAL_TREE_APP_KEY_FILE) is not a PEM private key`);
    expect(garbled.message).not.toContain('SENTINEL');

    const ec = generateKeyPairSync('ec', { namedCurve: 'P-256', privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
    writeFileSync(c.keyFile, ec.privateKey);
    await expect(getToken(c, { now: T0, fetch: github.fetch })).rejects.toThrow('holds a key of type ec; GitHub App keys are RSA');

    rmSync(c.keyFile);
    await expect(getToken(c, { now: T0, fetch: github.fetch })).rejects.toThrow(`cannot read the App's private key ${c.keyFile} (SIGNAL_TREE_APP_KEY_FILE): ENOENT`);
    expect(github.calls).toHaveLength(0);
  });
});

describe('git credential helper', () => {
  const request = 'protocol=https\nhost=github.com\npath=JBorgia/signal-tree.git\n\n';
  const never = {
    token: async (): Promise<string> => {
      throw new Error('minted');
    },
    forget: async () => {
      throw new Error('forgot');
    },
  };

  it('answers get for https://github.com with x-access-token and the App token', async () => {
    expect(await gitCredential('get', request, { ...never, token: async () => 'ghs_x' })).toBe('username=x-access-token\npassword=ghs_x\n');
  });

  it('drops the cached token on erase, so the next get mints a new one', async () => {
    let forgotten = 0;
    expect(await gitCredential('erase', `${request.trim()}\nusername=x-access-token\npassword=ghs_x\n\n`, { ...never, forget: async () => void forgotten++ })).toBe('');
    expect(forgotten).toBe(1);
  });

  it('does nothing for other hosts, plain http, or store', async () => {
    expect(await gitCredential('get', 'protocol=https\nhost=gitlab.com\n\n', never)).toBe('');
    expect(await gitCredential('get', 'protocol=http\nhost=github.com\n\n', never)).toBe('');
    expect(await gitCredential('get', 'protocol=https\nhost=github.com.evil.example\n\n', never)).toBe('');
    expect(await gitCredential('erase', 'protocol=https\nhost=gitlab.com\n\n', never)).toBe('');
    expect(await gitCredential('store', `${request.trim()}\nusername=x-access-token\npassword=ghs_x\n\n`, never)).toBe('');
  });

  it('speaks the protocol to git itself, from the cached token, and erase deletes the cache', () => {
    const { env, cache } = appFixture('ghs_cached');
    const fill = spawnSync('git', ['-c', 'credential.https://github.com.helper=', '-c', `credential.https://github.com.helper=!node ${appToken} git-credential`, 'credential', 'fill'], {
      input: request,
      env: cleanEnv({ ...env, ...isolatedGit, GIT_TERMINAL_PROMPT: '0' }),
      encoding: 'utf8',
    });
    expect(fill.status).toBe(0);
    expect(fill.stdout).toContain('username=x-access-token\npassword=ghs_cached\n');

    const elsewhere = spawnSync('node', [appToken, 'git-credential', 'erase'], { input: 'protocol=https\nhost=gitlab.com\n\n', env: cleanEnv(env), encoding: 'utf8' });
    expect([elsewhere.status, elsewhere.stdout, existsSync(cache)]).toEqual([0, '', true]);
    const erase = spawnSync('node', [appToken, 'git-credential', 'erase'], { input: request, env: cleanEnv(env), encoding: 'utf8' });
    expect([erase.status, erase.stdout, existsSync(cache)]).toEqual([0, '', false]);
  });

  it('prints the cached token for `token`, and fails clearly with no output when unconfigured', () => {
    const { env } = appFixture('ghs_cached');
    const ok = spawnSync('node', [appToken, 'token'], { env: cleanEnv(env), encoding: 'utf8' });
    expect([ok.status, ok.stdout, ok.stderr]).toEqual([0, 'ghs_cached\n', '']);

    const unset = spawnSync('node', [appToken, 'token'], { env: cleanEnv({}), encoding: 'utf8' });
    expect(unset.status).toBe(1);
    expect(unset.stdout).toBe('');
    expect(unset.stderr).toContain('SIGNAL_TREE_APP_ID, SIGNAL_TREE_APP_INSTALLATION_ID, SIGNAL_TREE_APP_KEY_FILE not set');

    const usage = spawnSync('node', [appToken], { env: cleanEnv(env), encoding: 'utf8' });
    expect(usage.status).toBe(2);
  });
});

describe('gh wrapper', () => {
  const PR = 'https://github.com/JBorgia/signal-tree/pull/77';
  const view = (fields: object = {}) => JSON.stringify({ isCrossRepository: false, baseRefName: 'main', url: PR, changedFiles: 1, ...fields });
  /** The REST listing of the PR's files as `gh api --paginate --slurp` prints it: one page. */
  const files = (...entries: Array<string | { filename: string; previous_filename?: string }>) => JSON.stringify([entries.map((e) => (typeof e === 'string' ? { filename: e, status: 'modified' } : { status: 'renamed', ...e }))]);
  /**
   * Runs the wrapper as the supervisor installs it (install_helpers): bin/gh
   * beside app-token.mjs and codeowners.mjs. `extra` may depend on the
   * installed wrapper's path.
   */
  const run = (args: string[], extra: Record<string, string> | ((installed: string) => Record<string, string>) = {}) => {
    const { root, env, state } = appFixture('ghs_app');
    const app = join(state, 'github-app');
    const install = bash(`${shellFunctions('install_helpers', 'install_file')}; install_helpers '${unattended}' '${app}'`, {});
    expect(install.status, install.stderr).toBe(0);
    const installed = join(app, 'bin', 'gh');
    const fake = join(root, 'real-gh');
    const decoy = join(root, 'decoy');
    mkdirSync(fake);
    mkdirSync(decoy);
    const log = join(root, 'gh.log');
    const decoyLog = join(root, 'decoy.log');
    // The real gh: logs its token and arguments; prints a PR URL whenever an argument is create or new,
    // $PR_VIEW for pr view, $PR_FILES for the PR's files and $CODEOWNERS for main's CODEOWNERS.
    writeScript(
      join(fake, 'gh'),
      [
        'printf \'%s %s %s\\n\' "${GH_TOKEN-unset}" "${GITHUB_TOKEN-unset}" "$*" >> "$GH_LOG"',
        `if [[ $1 == pr && ( " $* " == *" create "* || " $* " == *" new "* ) ]]; then [[ -n \${FAIL_CREATE-} ]] && exit 1; echo ${PR}; fi`,
        'if [[ $1 == pr && $2 == view ]]; then [[ -n ${FAIL_VIEW-} ]] && exit 1; printf "%s\\n" "$PR_VIEW"; fi',
        'if [[ $1 == api && " $* " == *"/pulls/77/files?"* ]]; then [[ -n ${FAIL_FILES-} ]] && { echo "gh: Server Error (HTTP 502)" >&2; exit 1; }; printf "%s\\n" "$PR_FILES"; fi',
        'if [[ $1 == api && " $* " == *"/contents/.github/CODEOWNERS?"* ]]; then [[ -n ${FAIL_CODEOWNERS-} ]] && { echo "gh: Not Found (HTTP 404)" >&2; exit 1; }; printf "%s" "$CODEOWNERS"; fi',
        'if [[ $1 == pr && $2 == merge ]]; then [[ -n ${FAIL_MERGE-} ]] && { echo "auto-merge is not allowed" >&2; exit 1; }; echo "auto-merge enabled"; fi',
        'exit "${FAKE_STATUS:-0}"',
      ].join('\n'),
    );
    // A gh the wrapper would find on PATH if it searched there.
    writeScript(join(decoy, 'gh'), `echo "$*" >> "${decoyLog}"`);
    const result = spawnSync(installed, args, {
      env: cleanEnv({
        ...env,
        SIGNAL_TREE_REAL_GH: join(fake, 'gh'),
        GH_LOG: log,
        PR_VIEW: view(),
        PR_FILES: files('packages/core/src/index.ts'),
        CODEOWNERS,
        GH_TOKEN: 'personal-token',
        GITHUB_TOKEN: 'personal-token-2',
        PATH: `${join(installed, '..')}:${decoy}:${process.env.PATH}`,
        ...(typeof extra === 'function' ? extra(installed) : extra),
      }),
      encoding: 'utf8',
    });
    expect(existsSync(decoyLog)).toBe(false);
    return { ...result, calls: existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : [] };
  };
  const created = 'ghs_app unset pr create --fill';
  const viewed = `ghs_app unset pr view ${PR} --json isCrossRepository,baseRefName,url,changedFiles`;
  const listed = 'ghs_app unset api --paginate --slurp repos/JBorgia/signal-tree/pulls/77/files?per_page=100';
  const owners = 'ghs_app unset api -H Accept: application/vnd.github.raw+json repos/JBorgia/signal-tree/contents/.github/CODEOWNERS?ref=main';
  const merged = `ghs_app unset pr merge ${PR} --auto --merge`;

  it('runs gh pr create with the App token, checks the new PR and its files, then turns on auto-merge (merge commit)', () => {
    const r = run(['pr', 'create', '--title', 'S8', '--body', 'Gate S8.']);
    expect(r.status).toBe(0);
    expect(r.stdout).toBe(`${PR}\n`);
    expect(r.stderr).toBe('auto-merge enabled\n');
    expect(r.calls).toEqual(['ghs_app unset pr create --title S8 --body Gate S8.', viewed, listed, owners, merged]);
  });

  it('recognises pr new and a --repo flag before the subcommand', () => {
    expect(run(['pr', '-R', 'JBorgia/signal-tree', 'create', '--fill']).calls[4]).toBe(merged);
    expect(run(['pr', '--repo=JBorgia/signal-tree', 'new', '--fill']).calls[4]).toBe(merged);
  });

  it("leaves auto-merge off for a PR touching a code-owned path, naming the paths and Jonathan's review", () => {
    const cases: Array<[Record<string, string>, string[]]> = [
      [{ PR_VIEW: view({ changedFiles: 3 }), PR_FILES: files('README.md', 'ci/done-check.mjs', 'bench/budgets.json') }, ['ci/done-check.mjs', 'bench/budgets.json']],
      // A rename away from a code-owned path still touches it.
      [{ PR_FILES: files({ filename: 'docs/gate.mjs', previous_filename: 'ci/gate-baseline.mjs' }) }, ['ci/gate-baseline.mjs']],
      // A CODEOWNERS line the matcher cannot parse makes every file code-owned.
      [{ CODEOWNERS: `${CODEOWNERS}!/docs/ @JBorgia\n` }, ['packages/core/src/index.ts']],
    ];
    for (const [extra, paths] of cases) {
      const r = run(['pr', 'create', '--fill'], extra);
      expect(r.status).toBe(0);
      expect(r.stdout).toBe(`${PR}\n`);
      expect(r.calls).toEqual([created, viewed, listed, owners]);
      expect(r.stderr).toContain(`${PR} touches code-owned paths, so it needs Jonathan's review and auto-merge was not turned on:\n${paths.map((p) => `  ${p}\n`).join('')}`);
    }
  });

  it("fails closed: leaves auto-merge off when the files or main's CODEOWNERS cannot be read or matched", () => {
    const cases: Array<[Record<string, string>, string[]]> = [
      [{ FAIL_FILES: '1' }, [created, viewed, listed]],
      [{ FAIL_CODEOWNERS: '1' }, [created, viewed, listed, owners]],
      // gh pr view counts two files, the listing has one.
      [{ PR_VIEW: view({ changedFiles: 2 }) }, [created, viewed, listed, owners]],
      // Past GitHub's 3000-file listing limit.
      [{ PR_VIEW: view({ changedFiles: 3001 }) }, [created, viewed, listed, owners]],
      [{ PR_VIEW: view({ changedFiles: undefined }) }, [created, viewed, listed, owners]],
      [{ PR_FILES: '{"message":"Not Found"}' }, [created, viewed, listed, owners]],
    ];
    for (const [extra, calls] of cases) {
      const r = run(['pr', 'create', '--fill'], extra);
      expect(r.status).toBe(0);
      expect(r.calls).toEqual(calls);
      expect(r.stderr).toContain(`warning: could not check ${PR}'s changed files against main's CODEOWNERS, so auto-merge was not turned on.`);
      expect(r.stderr).not.toContain("needs Jonathan's review");
    }
  });

  it('leaves auto-merge off when the matcher is missing beside the installed wrapper', () => {
    const r = run(['pr', 'create', '--fill'], (installed) => {
      rmSync(join(installed, '..', '..', 'codeowners.mjs'));
      return {};
    });
    expect(r.calls).toEqual([created, viewed, listed, owners]);
    expect(r.stderr).toContain(`warning: could not check ${PR}'s changed files`);
  });

  it('leaves auto-merge off, with a warning, unless the PR is from a JBorgia/signal-tree branch into main', () => {
    const cases: Array<[Record<string, string>, string]> = [
      [{ PR_VIEW: view({ isCrossRepository: true }) }, 'cross-repository: true, base: main'],
      [{ PR_VIEW: view({ baseRefName: 'release/15.x' }) }, 'cross-repository: false, base: release/15.x'],
      [{ PR_VIEW: view({ url: 'https://github.com/someone/signal-tree/pull/77' }) }, 'cross-repository: false, base: main'],
      [{ PR_VIEW: 'not json' }, 'cross-repository: ?'],
    ];
    for (const [extra, detail] of cases) {
      const r = run(['pr', 'create', '--fill'], extra);
      expect(r.status).toBe(0);
      expect(r.calls).toEqual([created, viewed]);
      expect(r.stderr).toContain(`warning: ${PR} is not a pull request from a JBorgia/signal-tree branch into main (${detail}`);
    }
    const unknown = run(['pr', 'create', '--fill'], { FAIL_VIEW: '1' });
    expect(unknown.calls).toEqual([created, viewed]);
    expect(unknown.stderr).toContain(`warning: could not look up ${PR}`);
  });

  it("only warns when auto-merge cannot be turned on, keeping pr create's exit status", () => {
    const r = run(['pr', 'create', '--fill'], { FAIL_MERGE: '1' });
    expect(r.status).toBe(0);
    expect(r.calls).toEqual([created, viewed, listed, owners, merged]);
    expect(r.stderr).toContain(`warning: could not turn on auto-merge for ${PR}`);
  });

  it('turns nothing on when pr create fails, and exits as it did', () => {
    const r = run(['pr', 'create', '--fill'], { FAIL_CREATE: '1' });
    expect(r.status).toBe(1);
    expect(r.calls).toEqual([created]);
  });

  it('passes every other command straight through with the App token and its exit status', () => {
    const r = run(['issue', 'list', '--label', 'needs-jonathan'], { FAKE_STATUS: '3' });
    expect(r.status).toBe(3);
    expect(r.calls).toEqual(['ghs_app unset issue list --label needs-jonathan']);
    expect(run(['pr', 'comment', '5', '--body', 'create']).calls).toEqual(['ghs_app unset pr comment 5 --body create']);
  });

  it('runs nothing without an App token', () => {
    const r = run(['issue', 'list'], { SIGNAL_TREE_APP_ID: '' });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('SIGNAL_TREE_APP_ID');
    expect(r.calls).toEqual([]);
  });

  it('runs only the gh in SIGNAL_TREE_REAL_GH, an absolute path other than itself, and never searches PATH', () => {
    for (const real of ['', 'gh', 'real-gh/gh', 'self']) {
      const r = run(['issue', 'list'], (installed) => ({ SIGNAL_TREE_REAL_GH: real === 'self' ? installed : real }));
      expect(r.status).toBe(127);
      expect(r.stderr).toContain('SIGNAL_TREE_REAL_GH must be the absolute path of the real gh');
      expect(r.calls).toEqual([]);
    }
  });
});

describe('supervisor startup checks', () => {
  /** App settings with a cached token, a checkout with origin `url`, and a fake gh (no login; main's rules from $FAKE_RULES) first on PATH. */
  const fixture = (url = ORIGIN) => {
    const app = appFixture('ghs_supervisor');
    const work = checkout(url);
    const fake = join(app.root, 'fake-bin');
    mkdirSync(fake);
    const ghLog = join(app.root, 'gh.log');
    writeScript(
      join(fake, 'gh'),
      [
        `printf '%s %s\\n' "\${GH_TOKEN-unset}" "$*" >> "${ghLog}"`,
        'case "$1 $2" in',
        '  "auth status") exit "${FAKE_AUTH_STATUS:-1}" ;;',
        '  "api repos/JBorgia/signal-tree/rules/branches/main") printf "%s\\n" "$FAKE_RULES"; exit "${FAKE_API_STATUS:-0}" ;;',
        'esac',
      ].join('\n'),
    );
    const env = { ...app.env, PATH: `${fake}:${process.env.PATH}`, FAKE_RULES: '[{"type":"pull_request"},{"type":"required_status_checks"}]' };
    return { ...app, work, fake, ghLog, env };
  };
  const start = (extra: Record<string, string>, cwd?: string) =>
    spawnSync('bash', [supervisor], { cwd, env: cleanEnv({ SIGNAL_TREE_ISOLATED: '1', ANTHROPIC_API_KEY: 'test-key', ...extra }), encoding: 'utf8' });

  it('sets a private umask before anything else runs', () => {
    expect(readFileSync(supervisor, 'utf8')).toMatch(/^set -uo pipefail\n(#.*\n)*umask 077\n/m);
  });

  it('refuses to start without the App settings (exit 8)', () => {
    const run = start({ SIGNAL_TREE_STATE_DIR: scratch() });
    expect(run.status).toBe(8);
    expect(run.stderr).toContain('set SIGNAL_TREE_APP_ID SIGNAL_TREE_APP_INSTALLATION_ID SIGNAL_TREE_APP_KEY_FILE');
  });

  it('refuses to start when the key file is not readable (exit 8)', () => {
    const { env, root } = appFixture();
    const run = start({ ...env, SIGNAL_TREE_APP_KEY_FILE: join(root, 'missing.pem') });
    expect(run.status).toBe(8);
    expect(run.stderr).toContain('SIGNAL_TREE_APP_KEY_FILE');
  });

  it('refuses a state directory inside the checkout or the verifier (exit 2), creating nothing', () => {
    const { env, work, root } = fixture();
    const inWork = start({ ...env, SIGNAL_TREE_STATE_DIR: join(work, '.state') }, work);
    expect(inWork.status).toBe(2);
    expect(inWork.stderr).toContain("is inside the agent's checkout or the verifier");
    expect(existsSync(join(work, '.state'))).toBe(false);

    const inVerifier = start({ ...env, SIGNAL_TREE_VERIFY_DIR: join(root, 'verify'), SIGNAL_TREE_STATE_DIR: join(root, 'verify', 'state') }, work);
    expect(inVerifier.status).toBe(2);
    expect(existsSync(join(root, 'verify'))).toBe(false);
  });

  it('refuses to start when no token can be minted (exit 9), without showing the key', () => {
    const { env, cache, keyFile, work } = fixture();
    rmSync(cache);
    writeFileSync(keyFile, '-----BEGIN RSA PRIVATE KEY-----\nSENTINEL-NOT-A-KEY\n-----END RSA PRIVATE KEY-----\n');
    const run = start(env, work);
    expect(run.status).toBe(9);
    expect(run.stderr).toContain('is not a PEM private key');
    expect(run.stderr).toContain('could not mint a GitHub App installation token');
    expect(run.stderr).not.toContain('SENTINEL');
  });

  it('refuses an origin other than https://github.com/JBorgia/signal-tree (exit 10), without echoing credentials, with a private state directory', () => {
    const ssh = fixture('git@github.com:JBorgia/signal-tree.git');
    const run = start(ssh.env, ssh.work);
    expect(run.status).toBe(10);
    expect(run.stderr).toContain('origin fetches or pushes through git@github.com:JBorgia/signal-tree.git');
    expect(mode(ssh.state)).toBe(0o700);
    expect(mode(join(ssh.state, 'github-app'))).toBe(0o700);
    expect(mode(join(ssh.state, 'github-app', 'gitconfig'))).toBe(0o600);
    expect(mode(join(ssh.state, 'github-app', 'app-token.mjs'))).toBe(0o600);
    expect(mode(join(ssh.state, 'github-app', 'codeowners.mjs'))).toBe(0o600);
    expect(mode(join(ssh.state, 'github-app', 'bin', 'gh'))).toBe(0o700);

    const token = fixture('https://x-access-token:ghp_SECRET@github.com/JBorgia/signal-tree.git');
    const leaky = start(token.env, token.work);
    expect(leaky.status).toBe(10);
    expect(leaky.stderr).toContain('https://***@github.com/JBorgia/signal-tree.git');
    expect(leaky.stderr).not.toContain('ghp_SECRET');
  });

  it('refuses to start when gh has a stored login (exit 11)', () => {
    const { env, work } = fixture();
    const run = start({ ...env, FAKE_AUTH_STATUS: '0' }, work);
    expect(run.status).toBe(11);
    expect(run.stderr).toContain('gh has a stored login');
  });

  it('refuses to start unless main has a pull_request and a required_status_checks rule (exit 12), read as the App', () => {
    const { env, work, ghLog } = fixture();
    const run = start({ ...env, FAKE_RULES: '[{"type":"pull_request"},{"type":"deletion"}]' }, work);
    expect(run.status).toBe(12);
    expect(run.stderr).toContain('has no active required_status_checks rule');
    expect(readFileSync(ghLog, 'utf8').trim().split('\n')).toEqual(['unset auth status', 'ghs_supervisor api repos/JBorgia/signal-tree/rules/branches/main']);
  });

  it('accepts only origin URLs of exactly https://github.com/JBorgia/signal-tree(.git), and no extra HTTP header', () => {
    const check = (url: string, ...config: string[][]) => {
      const work = checkout(url);
      for (const args of config) git(work, ...args);
      return bash(`${shellFunctions('check_origin', 'redact_url')}; check_origin "$PWD"`, isolatedGit, work);
    };
    expect(check(ORIGIN).status).toBe(0);
    expect(check('https://github.com/JBorgia/signal-tree').status).toBe(0);

    const refused: Array<[string, string[][], string]> = [
      ['https://x-access-token:ghp_SECRET@github.com/JBorgia/signal-tree.git', [], 'https://***@github.com/'],
      ['ssh://git@github.com/JBorgia/signal-tree.git', [], 'ssh://***@github.com/'],
      ['https://github.com/someone/signal-tree.git', [], 'someone/signal-tree'],
      ['http://github.com/JBorgia/signal-tree.git', [], 'http://github.com/'],
      [ORIGIN, [['config', 'remote.origin.pushurl', 'https://github.com/someone/signal-tree.git']], 'someone/signal-tree'],
      [ORIGIN, [['config', 'url.git@github.com:.insteadOf', 'https://github.com/']], 'git@github.com:JBorgia'],
      [ORIGIN, [['config', 'url.git@github.com:.pushInsteadOf', 'https://github.com/']], 'git@github.com:JBorgia'],
      [ORIGIN, [['remote', 'set-url', '--add', 'origin', 'https://x:ghp_SECRET@github.com/JBorgia/signal-tree.git']], 'https://***@github.com/'],
      [ORIGIN, [['config', 'http.https://github.com/.extraheader', 'AUTHORIZATION: basic SECRET']], 'http.https://github.com/.extraheader'],
      [ORIGIN, [['config', 'http.extraheader', 'AUTHORIZATION: bearer SECRET']], 'http.extraheader'],
    ];
    for (const [url, config, shown] of refused) {
      const r = check(url, ...config);
      expect(r.status, `${url} ${JSON.stringify(config)}`).toBe(1);
      expect(r.stderr).toContain(shown);
      expect(r.stderr).not.toContain('SECRET');
    }
    const none = join(scratch(), 'none');
    mkdirSync(none);
    git(none, 'init', '-q');
    expect(bash(`${shellFunctions('check_origin', 'redact_url')}; check_origin "$PWD"`, isolatedGit, none).stderr).toContain('has no origin remote');
  });

  it("gives git only the App's credentials and Jonathan's identity: no machine config, other helper, askpass or SSH", () => {
    const { env, root, state } = appFixture('ghs_env');
    const appDir = join(state, 'github-app');
    // The machine's own git config, as in the review: HTTPS rewritten to SSH, and a personal helper.
    const machine = join(root, 'machine-gitconfig');
    const personal = '!f() { echo username=someone; echo password=personal-token; }; f';
    writeFileSync(machine, `[url "git@github.com:"]\n\tinsteadOf = https://github.com/\n[credential]\n\thelper = "${personal}"\n[http]\n\textraheader = AUTHORIZATION: basic SECRET\n`);
    const work = checkout(ORIGIN);
    git(work, 'config', 'credential.helper', personal);
    git(work, 'config', 'user.name', 'Someone Else');
    git(work, 'config', 'user.email', 'someone@example.com');
    const script = [
      shellFunctions('use_github_app', 'install_helpers', 'install_file', 'write_git_config'),
      'echo "before=$(git ls-remote --get-url https://github.com/JBorgia/signal-tree.git)"',
      `use_github_app '${unattended}' '${appDir}' || exit 9`,
      'echo "global=$GIT_CONFIG_GLOBAL nosystem=$GIT_CONFIG_NOSYSTEM protocols=$GIT_ALLOW_PROTOCOL askpass=[${GIT_ASKPASS-unset}] ssh_askpass=${SSH_ASKPASS-unset} prompt=$GIT_TERMINAL_PROMPT"',
      'echo "gh=$(command -v gh)"',
      'echo "after=$(git ls-remote --get-url https://github.com/JBorgia/signal-tree.git)"',
      'echo "headers=$(git config --get-regexp extraheader)"',
      "printf 'protocol=https\\nhost=github.com\\n\\n' | git credential fill | grep -E '^(username|password)='",
      'git ls-remote git@github.com:JBorgia/signal-tree.git 2>&1 | grep -o "transport .ssh. not allowed"',
      'git ls-remote ssh://git@github.com/JBorgia/signal-tree.git 2>&1 | grep -o "transport .ssh. not allowed"',
      'git commit -q --allow-empty -m probe && git log -1 --format="commit=%an <%ae> / %cn <%ce>"',
    ].join('\n');
    const r = bash(script, { ...env, GIT_CONFIG_GLOBAL: machine, GIT_ASKPASS: '/bin/echo', SSH_ASKPASS: '/bin/echo', GIT_SSH_COMMAND: 'false' }, work);
    expect(r.status, r.stderr).toBe(0);
    const jonathan = 'Jonathan Borgia <jonathanborgia@gmail.com>';
    expect(r.stdout.trim().split('\n')).toEqual([
      'before=git@github.com:JBorgia/signal-tree.git',
      `global=${appDir}/gitconfig nosystem=1 protocols=https:file askpass=[] ssh_askpass=unset prompt=0`,
      `gh=${appDir}/bin/gh`,
      `after=${ORIGIN}`,
      'headers=',
      'username=x-access-token',
      'password=ghs_env',
      "transport 'ssh' not allowed",
      "transport 'ssh' not allowed",
      `commit=${jonathan} / ${jonathan}`,
    ]);
    expect(readFileSync(join(appDir, 'gitconfig'), 'utf8')).not.toMatch(/^\s*[^#\s]/m);
    expect(readFileSync(join(appDir, 'app-token.mjs'), 'utf8')).toBe(readFileSync(appToken, 'utf8'));
    expect(readFileSync(join(appDir, 'codeowners.mjs'), 'utf8')).toBe(readFileSync(codeownersMatcher, 'utf8'));
    expect(readFileSync(join(appDir, 'bin', 'gh'), 'utf8')).toBe(readFileSync(wrapper, 'utf8'));
    expect([mode(join(appDir, 'gitconfig')), mode(join(appDir, 'app-token.mjs')), mode(join(appDir, 'codeowners.mjs')), mode(join(appDir, 'bin', 'gh'))]).toEqual([0o600, 0o600, 0o600, 0o700]);
  });

  it('resolves the real gh once from absolute PATH entries other than the wrapper, and drops relative ones', () => {
    const root = scratch();
    const cwd = join(root, 'cwd');
    const wrapperDir = join(root, 'github-app', 'bin');
    const linked = join(root, 'linked');
    const [a, b] = [join(root, 'a'), join(root, 'b')];
    for (const dir of [join(cwd, 'rel'), wrapperDir, linked, a, b]) mkdirSync(dir, { recursive: true });
    const decoyLog = join(root, 'decoy.log');
    for (const dir of [cwd, join(cwd, 'rel')]) writeScript(join(dir, 'gh'), `echo "$*" >> "${decoyLog}"; exit 0`);
    writeScript(join(wrapperDir, 'gh'), `echo "$*" >> "${decoyLog}"; exit 0`);
    symlinkSync(join(wrapperDir, 'gh'), join(linked, 'gh'));
    for (const dir of [a, b]) writeScript(join(dir, 'gh'), 'exit "${FAKE_AUTH_STATUS:-1}"');
    const config = join(root, 'gh-config');
    const resolve = (path: string, extra: Record<string, string> = {}) =>
      bash(`${shellFunctions('use_real_gh')}; PATH=$TEST_PATH; use_real_gh "$CONFIG" "${wrapperDir}/gh" || exit 11; echo "real=$SIGNAL_TREE_REAL_GH"; echo "config=$GH_CONFIG_DIR"; echo "path=$PATH"`, { TEST_PATH: path, CONFIG: config, ...extra }, cwd);

    const tail = `${wrapperDir}:${linked}:${a}:${b}:/usr/bin:/bin`;
    const ok = resolve(`:.:rel:${tail}`);
    expect(ok.status, ok.stderr).toBe(0);
    expect(ok.stdout.trim().split('\n')).toEqual([`real=${realpathSync(a)}/gh`, `config=${config}`, `path=${tail}`]);
    expect(mode(config)).toBe(0o700);
    expect(existsSync(decoyLog)).toBe(false);

    const login = resolve(tail, { FAKE_AUTH_STATUS: '0' });
    expect(login.status).toBe(11);
    expect(login.stderr).toContain('gh has a stored login');

    writeFileSync(join(config, 'hosts.yml'), 'github.com:\n  user: someone\n');
    expect(resolve(tail).status).toBe(11);
    rmSync(join(config, 'hosts.yml'));

    const none = resolve(`.:rel:${wrapperDir}:${linked}`);
    expect(none.status).toBe(11);
    expect(none.stderr).toContain('no gh in an absolute PATH directory');
    expect(existsSync(decoyLog)).toBe(false);
  });

  it('reads the rules on main through gh and requires each of REQUIRED_MAIN_RULES', () => {
    const { env } = fixture();
    const check = (extra: Record<string, string>) => bash(`${shellFunctions('check_main_rules')}; check_main_rules`, { ...env, ...extra });
    expect(check({ FAKE_RULES: '[{"type":"deletion"},{"type":"required_status_checks"},{"type":"pull_request"}]' }).status).toBe(0);
    expect(check({ FAKE_RULES: '[]' }).stderr).toContain('has no active pull_request rule');
    expect(check({ FAKE_RULES: '[{"type":"pull_request"}]' }).stderr).toContain('has no active required_status_checks rule');
    const unreadable = check({ FAKE_RULES: '{"message":"Not Found"}', FAKE_API_STATUS: '1' });
    expect(unreadable.status).toBe(1);
    expect(unreadable.stderr).toContain('could not read the rules for main of JBorgia/signal-tree');
  });
});
