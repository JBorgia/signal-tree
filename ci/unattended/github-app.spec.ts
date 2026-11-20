import { spawnSync } from 'node:child_process';
import { generateKeyPairSync, verify } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { REFRESH_MARGIN_MS, appJwt, configFromEnv, getToken, gitCredential, mintToken } from './app-token.mjs';

// Tests for the GitHub App identity of the unattended runner: app-token.mjs,
// the gh wrapper (bin/gh) and the supervisor's setup. Nothing here reaches the
// network: GitHub is a fake fetch, and the command-line runs find a valid token
// in the cache.

const appToken = new URL('./app-token.mjs', import.meta.url).pathname;
const wrapper = new URL('./bin/gh', import.meta.url).pathname;
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
const T0 = Date.UTC(2026, 10, 20, 12, 0, 0);
const MINUTE = 60_000;
const noSleep = async () => {};

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
  mkdirSync(state);
  writeFileSync(join(state, 'app-token.json'), JSON.stringify({ appId: 12345, installationId: '678', token, expiresAt: new Date(Date.now() + 60 * MINUTE).toISOString() }), { mode: 0o600 });
  const keyFile = join(root, 'app.pem');
  writeFileSync(keyFile, privateKey, { mode: 0o600 });
  const env = { SIGNAL_TREE_APP_ID: '12345', SIGNAL_TREE_APP_INSTALLATION_ID: '678', SIGNAL_TREE_APP_KEY_FILE: keyFile, SIGNAL_TREE_STATE_DIR: state };
  return { root, state, keyFile, env };
}

/** process.env without anything that would leak the developer's own setup into a run. */
function cleanEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
  const env: Record<string, string | undefined> = { ...process.env, ...extra };
  for (const name of Object.keys(env)) {
    if (/^(GH_|GITHUB_|GIT_|SIGNAL_TREE_|CLAUDE_)/.test(name) && !(name in extra)) delete env[name];
  }
  return env as NodeJS.ProcessEnv;
}

function writeScript(path: string, body: string) {
  writeFileSync(path, `#!/usr/bin/env bash\n${body}\n`);
  chmodSync(path, 0o755);
}

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

  it('mints with the App JWT, caches the token owner-only, and reuses it until 10 minutes before it expires', async () => {
    const c = config();
    const github = fakeGitHub([issued('ghs_first', T0 + 60 * MINUTE), issued('ghs_second', T0 + 120 * MINUTE)]);
    expect(await getToken(c, { now: T0, fetch: github.fetch })).toBe('ghs_first');
    expect(github.calls).toHaveLength(1);
    const [{ url, init }] = github.calls;
    expect(url).toBe('https://api.github.com/app/installations/678/access_tokens');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.Accept).toBe('application/vnd.github+json');
    expect(decode(headers.Authorization.replace(/^Bearer /, '').split('.')[1])).toEqual({ iat: T0 / 1000 - 60, exp: T0 / 1000 + 540, iss: 12345 });
    expect(statSync(c.cacheFile).mode & 0o777).toBe(0o600);
    expect(JSON.parse(readFileSync(c.cacheFile, 'utf8'))).toEqual({ appId: 12345, installationId: '678', token: 'ghs_first', expiresAt: new Date(T0 + 60 * MINUTE).toISOString() });

    // 11 minutes left: reused. Exactly 10 left: refreshed.
    expect(await getToken(c, { now: T0 + 49 * MINUTE, fetch: github.fetch })).toBe('ghs_first');
    expect(github.calls).toHaveLength(1);
    expect(await getToken(c, { now: T0 + 60 * MINUTE - REFRESH_MARGIN_MS, fetch: github.fetch })).toBe('ghs_second');
    expect(github.calls).toHaveLength(2);
    expect(JSON.parse(readFileSync(c.cacheFile, 'utf8')).token).toBe('ghs_second');
    expect(statSync(c.cacheFile).mode & 0o777).toBe(0o600);
  });

  it('mints afresh when the cache is unreadable or belongs to another installation', async () => {
    const c = config();
    mkdirSync(join(c.cacheFile, '..'), { recursive: true });
    const github = fakeGitHub([issued('ghs_a', T0 + 60 * MINUTE), issued('ghs_b', T0 + 60 * MINUTE)]);
    writeFileSync(c.cacheFile, 'not json');
    expect(await getToken(c, { now: T0, fetch: github.fetch })).toBe('ghs_a');
    writeFileSync(c.cacheFile, JSON.stringify({ appId: 12345, installationId: '999', token: 'ghs_other', expiresAt: new Date(T0 + 60 * MINUTE).toISOString() }));
    expect(await getToken(c, { now: T0, fetch: github.fetch })).toBe('ghs_b');
    expect(github.calls).toHaveLength(2);
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

    const empty = fakeGitHub([() => new Response('{}', { status: 201 })]);
    await expect(mintToken({ appId: 12345, installationId: '678', privateKey, now: T0, fetch: empty.fetch, sleep: noSleep })).rejects.toThrow('without a token');
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

  it('answers get for https://github.com with x-access-token and the App token', async () => {
    expect(await gitCredential('get', request, async () => 'ghs_x')).toBe('username=x-access-token\npassword=ghs_x\n');
  });

  it('answers nothing for other hosts, plain http, store or erase, without minting', async () => {
    const token = async (): Promise<string> => {
      throw new Error('minted');
    };
    expect(await gitCredential('get', 'protocol=https\nhost=gitlab.com\n\n', token)).toBe('');
    expect(await gitCredential('get', 'protocol=http\nhost=github.com\n\n', token)).toBe('');
    expect(await gitCredential('get', 'protocol=https\nhost=github.com.evil.example\n\n', token)).toBe('');
    expect(await gitCredential('store', `${request.trim()}\nusername=x-access-token\npassword=ghs_x\n\n`, token)).toBe('');
    expect(await gitCredential('erase', request, token)).toBe('');
  });

  it('speaks the protocol to git itself, from the cached token', () => {
    const { env } = appFixture('ghs_cached');
    const fill = spawnSync('git', ['-c', 'credential.https://github.com.helper=', '-c', `credential.https://github.com.helper=!node ${appToken} git-credential`, 'credential', 'fill'], {
      input: request,
      env: cleanEnv({ ...env, GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' }),
      encoding: 'utf8',
    });
    expect(fill.status).toBe(0);
    expect(fill.stdout).toContain('username=x-access-token\npassword=ghs_cached\n');

    const erase = spawnSync('node', [appToken, 'git-credential', 'erase'], { input: request, env: cleanEnv(env), encoding: 'utf8' });
    expect([erase.status, erase.stdout]).toEqual([0, '']);
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
  const run = (args: string[], extra: Record<string, string> = {}) => {
    const { root, env } = appFixture('ghs_app');
    const fake = join(root, 'fake-bin');
    mkdirSync(fake);
    const log = join(root, 'gh.log');
    // The real gh: logs its token and arguments, and prints a PR URL whenever an argument is create or new.
    writeScript(
      join(fake, 'gh'),
      [
        'printf \'%s %s %s\\n\' "${GH_TOKEN-unset}" "${GITHUB_TOKEN-unset}" "$*" >> "$GH_LOG"',
        'if [[ $1 == pr && ( " $* " == *" create "* || " $* " == *" new "* ) ]]; then [[ -n ${FAIL_CREATE-} ]] && exit 1; echo https://github.com/JBorgia/signal-tree/pull/77; fi',
        'if [[ $1 == pr && $2 == merge ]]; then [[ -n ${FAIL_MERGE-} ]] && { echo "auto-merge is not allowed" >&2; exit 1; }; echo "auto-merge enabled"; fi',
        'exit "${FAKE_STATUS:-0}"',
      ].join('\n'),
    );
    const result = spawnSync(wrapper, args, {
      env: cleanEnv({ ...env, GH_LOG: log, GH_TOKEN: 'personal-token', GITHUB_TOKEN: 'personal-token-2', PATH: `${join(wrapper, '..')}:${fake}:${process.env.PATH}`, ...extra }),
      encoding: 'utf8',
    });
    return { ...result, calls: existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : [] };
  };

  it('runs gh pr create with the App token, then turns on auto-merge (merge commit) for the new PR', () => {
    const r = run(['pr', 'create', '--title', 'S8', '--body', 'Gate S8.']);
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('https://github.com/JBorgia/signal-tree/pull/77\n');
    expect(r.calls).toEqual(['ghs_app unset pr create --title S8 --body Gate S8.', 'ghs_app unset pr merge https://github.com/JBorgia/signal-tree/pull/77 --auto --merge']);
  });

  it('recognises pr new and a --repo flag before the subcommand', () => {
    expect(run(['pr', '-R', 'JBorgia/signal-tree', 'create', '--fill']).calls[1]).toBe('ghs_app unset pr merge https://github.com/JBorgia/signal-tree/pull/77 --auto --merge');
    expect(run(['pr', '--repo=JBorgia/signal-tree', 'new', '--fill']).calls).toHaveLength(2);
  });

  it("only warns when auto-merge cannot be turned on, keeping pr create's exit status", () => {
    const r = run(['pr', 'create', '--fill'], { FAIL_MERGE: '1' });
    expect(r.status).toBe(0);
    expect(r.calls).toHaveLength(2);
    expect(r.stderr).toContain('warning: could not turn on auto-merge for https://github.com/JBorgia/signal-tree/pull/77');
  });

  it('turns nothing on when pr create fails, and exits as it did', () => {
    const r = run(['pr', 'create', '--fill'], { FAIL_CREATE: '1' });
    expect(r.status).toBe(1);
    expect(r.calls).toEqual(['ghs_app unset pr create --fill']);
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
});

describe('supervisor GitHub App setup', () => {
  const start = (extra: Record<string, string>, cwd?: string) =>
    spawnSync('bash', [supervisor], { cwd, env: cleanEnv({ SIGNAL_TREE_ISOLATED: '1', ANTHROPIC_API_KEY: 'test-key', ...extra }), encoding: 'utf8' });

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

  it('refuses to start when no token can be minted (exit 9), without showing the key', () => {
    const { env, state, keyFile } = appFixture();
    rmSync(join(state, 'app-token.json'));
    writeFileSync(keyFile, '-----BEGIN RSA PRIVATE KEY-----\nSENTINEL-NOT-A-KEY\n-----END RSA PRIVATE KEY-----\n');
    const run = start(env);
    expect(run.status).toBe(9);
    expect(run.stderr).toContain('is not a PEM private key');
    expect(run.stderr).toContain('could not mint a GitHub App installation token');
    expect(run.stderr).not.toContain('SENTINEL');
  });

  it(
    "runs the session as the App, with Jonathan's identity and no personal token or credential helper",
    () => {
      const { root, state, env } = appFixture('ghs_session');
      // The machine's own git config: a personal credential helper and another identity.
      const personal = '!f() { echo username=someone; echo password=personal-token; }; f';
      const globalConfig = join(root, 'gitconfig');
      writeFileSync(globalConfig, `[credential]\n\thelper = "${personal}"\n[credential "https://github.com"]\n\thelper = "${personal}"\n[user]\n\tname = Someone Else\n\temail = someone@example.com\n`);
      const git = (cwd: string, ...args: string[]) => {
        const r = spawnSync('git', args, { cwd, env: cleanEnv({ GIT_CONFIG_GLOBAL: globalConfig, GIT_CONFIG_NOSYSTEM: '1' }), encoding: 'utf8' });
        if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
        return r.stdout.trim();
      };

      // origin/main: a done check that passes once done.txt exists, and main's lock and Stop hook.
      const origin = join(root, 'origin.git');
      git(root, 'init', '-q', '--bare', '-b', 'main', origin);
      const seed = join(root, 'seed');
      git(root, 'clone', '-q', origin, seed);
      mkdirSync(join(seed, 'ci', 'unattended'), { recursive: true });
      writeFileSync(join(seed, 'ci', 'done-check.mjs'), "import { existsSync } from 'node:fs';\nprocess.exit(existsSync('done.txt') ? 0 : 1);\n");
      for (const file of ['lock.mjs', 'stop-hook.mjs']) writeFileSync(join(seed, 'ci', 'unattended', file), readFileSync(new URL(`./${file}`, import.meta.url)));
      git(seed, 'add', '.');
      git(seed, 'commit', '-qm', 'seed');
      git(seed, 'push', '-q', 'origin', 'HEAD:main');
      const work = join(root, 'work');
      git(root, 'clone', '-q', origin, work);

      // Stand-ins: claude records what the session sees and finishes the rebuild; gh is the real gh.
      const fake = join(root, 'fake-bin');
      mkdirSync(fake);
      const report = join(root, 'report.txt');
      const ghLog = join(root, 'gh.log');
      writeScript(
        join(fake, 'claude'),
        [
          'if [[ ${1:-} == --version ]]; then echo "2.1.300 (Claude Code)"; exit 0; fi',
          '{',
          '  echo "author=$GIT_AUTHOR_NAME <$GIT_AUTHOR_EMAIL>"',
          '  echo "committer=$GIT_COMMITTER_NAME <$GIT_COMMITTER_EMAIL>"',
          '  echo "GH_TOKEN=${GH_TOKEN-unset} GITHUB_TOKEN=${GITHUB_TOKEN-unset}"',
          '  echo "gh=$(command -v gh)"',
          "  printf 'protocol=https\\nhost=github.com\\n\\n' | git credential fill | grep -E '^(username|password)='",
          '  echo "ssh=$(git ls-remote --get-url git@github.com:JBorgia/signal-tree.git)"',
          '  git fetch -q origin refs/agent/lock && echo "lock=$(git log -1 --format="%an <%ae> / %cn <%ce>" FETCH_HEAD)"',
          '  gh issue list --label needs-jonathan',
          '  echo done > done.txt && git add done.txt && git commit -qm "Finish the rebuild" && git push -q origin HEAD:main',
          `} > "${report}" 2>&1`,
        ].join('\n'),
      );
      writeScript(join(fake, 'gh'), `printf '%s %s\\n' "\${GH_TOKEN-unset}" "$*" >> "${ghLog}"`);
      writeScript(join(fake, 'pnpm'), 'exit 0');
      writeScript(join(fake, 'sleep'), 'exit 0');

      const run = spawnSync('bash', [supervisor], {
        cwd: work,
        env: cleanEnv({
          ...env,
          PATH: `${fake}:${process.env.PATH}`,
          SIGNAL_TREE_ISOLATED: '1',
          ANTHROPIC_API_KEY: 'test-key',
          SIGNAL_TREE_STATUS_ISSUE: '1',
          GH_TOKEN: 'personal-gh-token',
          GITHUB_TOKEN: 'personal-github-token',
          GIT_CONFIG_GLOBAL: globalConfig,
          GIT_CONFIG_NOSYSTEM: '1',
        }),
        encoding: 'utf8',
        timeout: 50_000,
      });
      expect(run.status, `${run.stdout}\n${run.stderr}\n${existsSync(report) ? readFileSync(report, 'utf8') : ''}`).toBe(0);
      expect(run.stdout).toContain('Done: node ci/done-check.mjs passes on origin/main.');

      const jonathan = 'Jonathan Borgia <jonathanborgia@gmail.com>';
      expect(readFileSync(report, 'utf8').trim().split('\n')).toEqual([
        `author=${jonathan}`,
        `committer=${jonathan}`,
        'GH_TOKEN=unset GITHUB_TOKEN=unset',
        `gh=${join(state, 'github-app', 'bin', 'gh')}`,
        'username=x-access-token',
        'password=ghs_session',
        'ssh=https://github.com/JBorgia/signal-tree.git',
        `lock=${jonathan} / ${jonathan}`,
      ]);
      expect(readFileSync(ghLog, 'utf8')).toBe('ghs_session issue list --label needs-jonathan\n');
      expect(git(origin, 'log', '-1', '--format=%an <%ae> / %cn <%ce>', 'main')).toBe(`${jonathan} / ${jonathan}`);
      expect(git(work, 'ls-remote', 'origin', 'refs/agent/lock')).toBe('');
      expect(readFileSync(join(state, 'github-app', 'app-token.mjs'), 'utf8')).toBe(readFileSync(appToken, 'utf8'));
      expect(statSync(join(state, 'github-app', 'bin', 'gh')).mode & 0o777).toBe(0o755);
    },
    60_000,
  );
});
