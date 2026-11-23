import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, chmodSync, closeSync, constants, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MINT_COMMAND, REFRESH_MARGIN_MS, configFromEnv, getToken, gitCredential } from './app-token.mjs';

// Tests for the GitHub App identity of the unattended runner on the agent's
// side: app-token.mjs, the gh wrapper (bin/gh) and the supervisor's setup and
// startup checks. Tokens come from a fake mint command (the minting side has
// its own tests in mint-token.spec.ts). Nothing here reaches the network:
// GitHub is a fake gh, and every supervisor run stops at a check before its
// first network call (git ls-remote).

const appToken = new URL('./app-token.mjs', import.meta.url).pathname;
const wrapper = new URL('./bin/gh', import.meta.url).pathname;
const codeownersMatcher = new URL('../codeowners.mjs', import.meta.url).pathname;
const CODEOWNERS = readFileSync(new URL('../../.github/CODEOWNERS', import.meta.url), 'utf8');
const unattended = new URL('.', import.meta.url).pathname.replace(/\/$/, '');
const supervisor = new URL('./supervise.sh', import.meta.url).pathname;

const dirs: string[] = [];
const scratch = () => {
  const dir = mkdtempSync(join(tmpdir(), 'signal-tree-app-'));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const mode = (path: string) => statSync(path).mode & 0o777;
const T0 = Date.UTC(2026, 10, 20, 12, 0, 0);
const MINUTE = 60_000;
const ORIGIN = 'https://github.com/JBorgia/signal-tree.git';
const minted = (token: string, expiresAt = Date.now() + 60 * MINUTE) => JSON.stringify({ token, expires_at: new Date(expiresAt).toISOString() });

function writeScript(path: string, body: string) {
  writeFileSync(path, `#!/usr/bin/env bash\n${body}\n`);
  chmodSync(path, 0o755);
}

/**
 * The agent's setup: a state directory; a fake mint command, which logs each
 * run and prints what setMint gave it (by default `token`, valid for an hour);
 * and a mint config naming a key file this user cannot read (it does not exist).
 */
function appFixture(token = 'ghs_minted') {
  const root = scratch();
  const state = join(root, 'state');
  mkdirSync(state, { mode: 0o755 });
  const cache = join(state, 'app-token.json');
  const at = (name: string) => join(root, `mint-${name}`);
  const mint = join(root, 'fake-mint');
  writeScript(mint, [`echo run >> "${at('log')}"`, `[[ -f "${at('stderr')}" ]] && cat "${at('stderr')}" >&2`, `cat "${at('output')}"`, `exit "$(cat "${at('status')}" 2> /dev/null || echo 0)"`].join('\n'));
  const setMint = ({ output, status = 0, stderr }: { output: string; status?: number; stderr?: string }) => {
    writeFileSync(at('output'), output);
    writeFileSync(at('status'), String(status));
    if (stderr === undefined) rmSync(at('stderr'), { force: true });
    else writeFileSync(at('stderr'), stderr);
  };
  setMint({ output: minted(token) });
  const mints = () => (existsSync(at('log')) ? readFileSync(at('log'), 'utf8').trim().split('\n').length : 0);
  const appConfig = join(root, 'app.json');
  writeFileSync(appConfig, JSON.stringify({ appId: 12345, installationId: 678, keyFile: join(root, 'st-mint', 'app.pem') }));
  const env = { SIGNAL_TREE_STATE_DIR: state, SIGNAL_TREE_MINT_COMMAND: mint, SIGNAL_TREE_APP_CONFIG: appConfig };
  return { root, state, cache, mint, setMint, mints, appConfig, env };
}

/** process.env without anything that would leak the developer's own setup into a run. */
function cleanEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
  const env: Record<string, string | undefined> = { ...process.env, ...extra };
  for (const name of Object.keys(env)) {
    if (/^(GH_|GITHUB_|GIT_|SSH_ASKPASS|SIGNAL_TREE_|CLAUDE_)/.test(name) && !(name in extra)) delete env[name];
  }
  return env as NodeJS.ProcessEnv;
}

const isolatedGit = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
const git = (cwd: string, ...args: string[]) => {
  const r = spawnSync('git', args, { cwd, env: cleanEnv(isolatedGit), encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};

// An empty repository made once, which checkout() copies rather than running git each time.
let emptyRepository = '';
afterAll(() => {
  if (emptyRepository) rmSync(join(emptyRepository, '..'), { recursive: true, force: true });
});

/** An empty repository whose origin is `url` (none for null), copied from a template; nothing is fetched. */
function checkout(url: string | null) {
  if (!emptyRepository) {
    emptyRepository = join(mkdtempSync(join(tmpdir(), 'signal-tree-checkout-template-')), 'work');
    mkdirSync(emptyRepository);
    git(emptyRepository, 'init', '-q');
  }
  const dir = join(scratch(), 'work');
  cpSync(emptyRepository, dir, { recursive: true });
  if (url !== null) appendFileSync(join(dir, '.git', 'config'), `[remote "origin"]\n\turl = ${url}\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n`);
  return dir;
}

/** Bash that defines the supervisor's constants and the named functions, as the script does. */
const shellFunctions = (...names: string[]) => `eval "$(sed -n '/^readonly /p;${names.map((name) => `/^${name}()/,/^}/p`).join(';')}' '${supervisor}')"`;
const bash = (script: string, env: Record<string, string>, cwd?: string) => spawnSync('/bin/bash', ['-c', script], { cwd, env: cleanEnv(env), encoding: 'utf8' });
/** Like bash, without blocking: resolves when the script ends and its output closes. */
const bashAsync = (script: string, env: Record<string, string>, cwd?: string) =>
  new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn('/bin/bash', ['-c', script], { cwd, env: cleanEnv(env), stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });

describe('App token on the agent side', () => {
  it('runs the mint command as st-mint through sudo by default, or SIGNAL_TREE_MINT_COMMAND, caching in the state directory', () => {
    expect(MINT_COMMAND).toBe('sudo -n -u st-mint /opt/signal-tree/mint-token');
    expect(configFromEnv({ SIGNAL_TREE_STATE_DIR: '/state' })).toEqual({ command: MINT_COMMAND, cacheFile: '/state/app-token.json' });
    expect(configFromEnv({ SIGNAL_TREE_STATE_DIR: '/state', SIGNAL_TREE_MINT_COMMAND: '/test/mint' })).toEqual({ command: '/test/mint', cacheFile: '/state/app-token.json' });
  });

  it('never reads a key: no key file, App ID, JWT or GitHub API call on this side', () => {
    const source = readFileSync(appToken, 'utf8');
    for (const word of ['SIGNAL_TREE_APP_KEY_FILE', 'SIGNAL_TREE_APP_ID', 'keyFile', 'createPrivateKey', 'api.github.com', 'fetch(']) expect(source).not.toContain(word);
  });

  it('gets a token from the mint command, caches it owner-only, and reuses it until 10 minutes before it expires', async () => {
    const { env, cache, setMint, mints } = appFixture();
    const config = configFromEnv(env);
    setMint({ output: minted('ghs_first', T0 + 60 * MINUTE) });
    expect(await getToken(config, { now: T0 })).toBe('ghs_first');
    expect(mints()).toBe(1);
    expect(mode(cache)).toBe(0o600);
    expect(JSON.parse(readFileSync(cache, 'utf8'))).toEqual({ command: config.command, token: 'ghs_first', expiresAt: new Date(T0 + 60 * MINUTE).toISOString() });

    // 11 minutes left: reused. Exactly 10 left: minted again.
    expect(await getToken(config, { now: T0 + 49 * MINUTE })).toBe('ghs_first');
    expect(mints()).toBe(1);
    setMint({ output: minted('ghs_second', T0 + 120 * MINUTE) });
    expect(await getToken(config, { now: T0 + 60 * MINUTE - REFRESH_MARGIN_MS })).toBe('ghs_second');
    expect(mints()).toBe(2);
    expect(JSON.parse(readFileSync(cache, 'utf8')).token).toBe('ghs_second');
    expect(mode(cache)).toBe(0o600);
  });

  /** The agent's setup with `record` in the token cache, and the mint command ready with ghs_fresh. */
  const withCache = (record: (command: string) => object | string) => {
    const { env, cache, setMint, mints } = appFixture();
    const config = configFromEnv(env);
    setMint({ output: minted('ghs_fresh', T0 + 60 * MINUTE) });
    const value = record(config.command);
    writeFileSync(cache, typeof value === 'string' ? value : JSON.stringify(value));
    return { config, mints };
  };
  const good = (command: string) => ({ command, token: 'ghs_cached', expiresAt: new Date(T0 + 60 * MINUTE).toISOString() });

  it('takes the token from the cache when it is an installation token from the same mint command', async () => {
    const { config, mints } = withCache(good);
    expect(await getToken(config, { now: T0 })).toBe('ghs_cached');
    expect(mints()).toBe(0);
  });

  for (const [what, record] of [
    ['not JSON', () => 'not json'],
    ['from another mint command', (command: string) => ({ ...good(command), command: 'another mint command' })],
    ['not an installation token', (command: string) => ({ ...good(command), token: 'gho_personal' })],
    ['a token of more than one line', (command: string) => ({ ...good(command), token: 'ghs_x\nusername=someone' })],
    ['without a readable expiry', (command: string) => ({ ...good(command), expiresAt: 'soon' })],
  ] as const) {
    it(`mints afresh when the cache holds something ${what}`, async () => {
      const { config, mints } = withCache(record);
      expect(await getToken(config, { now: T0 })).toBe('ghs_fresh');
      expect(mints()).toBe(1);
    });
  }

  for (const [what, output] of [
    ['nothing', ''],
    ['something other than JSON', 'not json'],
    ['a token that is not an installation token', minted('gho_personal', T0 + 60 * MINUTE)],
    ['a token of more than one line', minted('ghs_x\nusername=someone', T0 + 60 * MINUTE)],
    ['a token without its expiry', '{"token":"ghs_x"}'],
  ] as const) {
    it(`refuses a mint command that prints ${what}`, async () => {
      const { env, setMint } = appFixture();
      const config = configFromEnv(env);
      setMint({ output });
      await expect(getToken(config, { now: T0 })).rejects.toThrow(`the mint command (${config.command}) did not print an installation token (ghs_...) and its expiry`);
    });
  }

  it('refuses a token that has already expired', async () => {
    const { env, setMint } = appFixture();
    setMint({ output: minted('ghs_old', T0 - 1000) });
    await expect(getToken(configFromEnv(env), { now: T0 })).rejects.toThrow('printed a token that expired at');
  });

  it("quotes only the mint command's stderr when it fails, and caches nothing", async () => {
    const { env, cache, setMint } = appFixture();
    const config = configFromEnv(env);
    setMint({ output: minted('ghs_leaked'), status: 1, stderr: 'sudo: a password is required\n' });
    const error: Error = await getToken(config, { now: T0 }).catch((e: Error) => e);
    expect(error.message).toBe(`the mint command (${config.command}) failed (1): sudo: a password is required`);
    expect(error.message).not.toContain('ghs_leaked');
    expect(existsSync(cache)).toBe(false);
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

  const helper = (operation: string, input: string, env: Record<string, string>) => spawnSync('node', [appToken, 'git-credential', operation], { input, env: cleanEnv(env), encoding: 'utf8' });
  /** The agent's setup with a token from the mint command already in the cache. */
  const cached = () => {
    const fixture = appFixture('ghs_cached');
    writeFileSync(fixture.cache, JSON.stringify({ command: fixture.mint, token: 'ghs_cached', expiresAt: new Date(Date.now() + 60 * MINUTE).toISOString() }));
    return fixture;
  };

  it('speaks the protocol to git itself, with a token from the mint command', () => {
    const { env, cache, mints } = appFixture('ghs_for_git');
    const fill = spawnSync('git', ['-c', 'credential.https://github.com.helper=', '-c', `credential.https://github.com.helper=!node ${appToken} git-credential`, 'credential', 'fill'], {
      input: request,
      env: cleanEnv({ ...env, ...isolatedGit, GIT_TERMINAL_PROMPT: '0' }),
      encoding: 'utf8',
    });
    expect(fill.status).toBe(0);
    expect(fill.stdout).toContain('username=x-access-token\npassword=ghs_for_git\n');
    expect([mints(), existsSync(cache)]).toEqual([1, true]);
  });

  it('deletes the cached token on erase for https://github.com', () => {
    const { env, cache } = cached();
    const erase = helper('erase', request, env);
    expect([erase.status, erase.stdout, existsSync(cache)]).toEqual([0, '', false]);
  });

  it('keeps the cached token on erase for another host', () => {
    const { env, cache } = cached();
    const elsewhere = helper('erase', 'protocol=https\nhost=gitlab.com\n\n', env);
    expect([elsewhere.status, elsewhere.stdout, existsSync(cache)]).toEqual([0, '', true]);
  });

  it('prints the token for `token`', () => {
    const { env } = appFixture('ghs_printed');
    const ok = spawnSync('node', [appToken, 'token'], { env: cleanEnv(env), encoding: 'utf8' });
    expect([ok.status, ok.stdout, ok.stderr]).toEqual([0, 'ghs_printed\n', '']);
  });

  it('fails clearly, with no output, when the mint command fails', () => {
    const { env, setMint } = appFixture();
    setMint({ output: '', status: 1, stderr: 'sudo: unknown user st-mint\n' });
    const failing = spawnSync('node', [appToken, 'token'], { env: cleanEnv(env), encoding: 'utf8' });
    expect([failing.status, failing.stdout]).toEqual([1, '']);
    expect(failing.stderr).toBe(`app-token: the mint command (${env.SIGNAL_TREE_MINT_COMMAND}) failed (1): sudo: unknown user st-mint\n`);
  });

  it('exits 2 when called without a mode', () => {
    const usage = spawnSync('node', [appToken], { env: cleanEnv(appFixture().env), encoding: 'utf8' });
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
  // The helpers as install_helpers lays them out, installed once and copied for each run.
  let helpers = '';
  beforeAll(() => {
    helpers = join(mkdtempSync(join(tmpdir(), 'signal-tree-helpers-template-')), 'github-app');
    const install = bash(`${shellFunctions('install_helpers', 'install_file')}; install_helpers '${unattended}' '${helpers}'`, {});
    if (install.status !== 0) throw new Error(`install_helpers: ${install.stderr}`);
  });
  afterAll(() => rmSync(join(helpers, '..'), { recursive: true, force: true }));

  const run = (args: string[], extra: Record<string, string> | ((installed: string) => Record<string, string>) = {}) => {
    const { root, env, state } = appFixture('ghs_app');
    const app = join(state, 'github-app');
    cpSync(helpers, app, { recursive: true });
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

  for (const [what, args] of [
    ['a -R flag before the subcommand', ['pr', '-R', 'JBorgia/signal-tree', 'create', '--fill']],
    ['pr new and a --repo= flag', ['pr', '--repo=JBorgia/signal-tree', 'new', '--fill']],
  ] as const) {
    it(`recognises ${what}`, () => {
      expect(run([...args]).calls[4]).toBe(merged);
    });
  }

  for (const [what, extra, paths] of [
    ['several files, two of them code-owned', { PR_VIEW: view({ changedFiles: 3 }), PR_FILES: files('README.md', 'ci/done-check.mjs', 'bench/budgets.json') }, ['ci/done-check.mjs', 'bench/budgets.json']],
    // A rename away from a code-owned path still touches it.
    ['a rename away from a code-owned path', { PR_FILES: files({ filename: 'docs/gate.mjs', previous_filename: 'ci/gate-baseline.mjs' }) }, ['ci/gate-baseline.mjs']],
    // A CODEOWNERS line the matcher cannot parse makes every file code-owned.
    ['a CODEOWNERS line the matcher cannot parse', { CODEOWNERS: `${CODEOWNERS}!/docs/ @JBorgia\n` }, ['packages/core/src/index.ts']],
  ] as const) {
    it(`leaves auto-merge off for a PR touching a code-owned path, naming the paths and Jonathan's review: ${what}`, () => {
      const r = run(['pr', 'create', '--fill'], extra);
      expect(r.status).toBe(0);
      expect(r.stdout).toBe(`${PR}\n`);
      expect(r.calls).toEqual([created, viewed, listed, owners]);
      expect(r.stderr).toContain(`${PR} touches code-owned paths, so it needs Jonathan's review and auto-merge was not turned on:\n${paths.map((p) => `  ${p}\n`).join('')}`);
    });
  }

  for (const [what, extra, calls] of [
    ["the PR's files cannot be listed", { FAIL_FILES: '1' }, [created, viewed, listed]],
    ["main's CODEOWNERS cannot be read", { FAIL_CODEOWNERS: '1' }, [created, viewed, listed, owners]],
    ['gh pr view counts more files than the listing has', { PR_VIEW: view({ changedFiles: 2 }) }, [created, viewed, listed, owners]],
    ["the PR is past GitHub's 3000-file listing limit", { PR_VIEW: view({ changedFiles: 3001 }) }, [created, viewed, listed, owners]],
    ['gh pr view gives no file count', { PR_VIEW: view({ changedFiles: undefined }) }, [created, viewed, listed, owners]],
    ['the listing is not a list of files', { PR_FILES: '{"message":"Not Found"}' }, [created, viewed, listed, owners]],
  ] as const) {
    it(`fails closed, leaving auto-merge off: ${what}`, () => {
      const r = run(['pr', 'create', '--fill'], extra);
      expect(r.status).toBe(0);
      expect(r.calls).toEqual(calls);
      expect(r.stderr).toContain(`warning: could not check ${PR}'s changed files against main's CODEOWNERS, so auto-merge was not turned on.`);
      expect(r.stderr).not.toContain("needs Jonathan's review");
    });
  }

  it('leaves auto-merge off when the matcher is missing beside the installed wrapper', () => {
    const r = run(['pr', 'create', '--fill'], (installed) => {
      rmSync(join(installed, '..', '..', 'codeowners.mjs'));
      return {};
    });
    expect(r.calls).toEqual([created, viewed, listed, owners]);
    expect(r.stderr).toContain(`warning: could not check ${PR}'s changed files`);
  });

  for (const [what, extra, detail] of [
    ["from a fork", { PR_VIEW: view({ isCrossRepository: true }) }, 'cross-repository: true, base: main'],
    ['into another branch', { PR_VIEW: view({ baseRefName: 'release/15.x' }) }, 'cross-repository: false, base: release/15.x'],
    ['in another repository', { PR_VIEW: view({ url: 'https://github.com/someone/signal-tree/pull/77' }) }, 'cross-repository: false, base: main'],
    ['whose details cannot be read', { PR_VIEW: 'not json' }, 'cross-repository: ?'],
  ] as const) {
    it(`leaves auto-merge off, with a warning, for a PR ${what}`, () => {
      const r = run(['pr', 'create', '--fill'], extra);
      expect(r.status).toBe(0);
      expect(r.calls).toEqual([created, viewed]);
      expect(r.stderr).toContain(`warning: ${PR} is not a pull request from a JBorgia/signal-tree branch into main (${detail}`);
    });
  }

  it('leaves auto-merge off, with a warning, when the new PR cannot be looked up', () => {
    const r = run(['pr', 'create', '--fill'], { FAIL_VIEW: '1' });
    expect(r.calls).toEqual([created, viewed]);
    expect(r.stderr).toContain(`warning: could not look up ${PR}`);
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
  });

  it('passes another pr subcommand straight through, even with create among its arguments', () => {
    expect(run(['pr', 'comment', '5', '--body', 'create']).calls).toEqual(['ghs_app unset pr comment 5 --body create']);
  });

  it('runs nothing without an App token', () => {
    const r = run(['issue', 'list'], { SIGNAL_TREE_MINT_COMMAND: 'false' });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('app-token: the mint command (false) failed (1)');
    expect(r.calls).toEqual([]);
  });

  for (const [what, real] of [
    ['unset', ''],
    ['a bare name', 'gh'],
    ['a relative path', 'real-gh/gh'],
    ['the wrapper itself', 'self'],
  ] as const) {
    it(`runs nothing, and never searches PATH, when SIGNAL_TREE_REAL_GH is ${what}`, () => {
      const r = run(['issue', 'list'], (installed) => ({ SIGNAL_TREE_REAL_GH: real === 'self' ? installed : real }));
      expect(r.status).toBe(127);
      expect(r.stderr).toContain('SIGNAL_TREE_REAL_GH must be the absolute path of the real gh');
      expect(r.calls).toEqual([]);
    });
  }
});

describe('supervisor startup checks', () => {
  const pullRequest = (parameters: object = {}) => ({ type: 'pull_request', parameters: { required_approving_review_count: 1, require_code_owner_review: true, dismiss_stale_reviews_on_push: false, ...parameters } });
  const statusChecks = { type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'tests' }], strict_required_status_checks_policy: false } };
  const RULES = JSON.stringify([pullRequest(), statusChecks, { type: 'deletion' }]);
  /** The agent's setup (appFixture), a checkout with origin `url`, and a fake gh (no login; main's rules from $FAKE_RULES) first on PATH. */
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
    const env = { ...app.env, PATH: `${fake}:${process.env.PATH}`, FAKE_RULES: RULES };
    return { ...app, work, fake, ghLog, env };
  };
  const start = (extra: Record<string, string>, cwd?: string) =>
    spawnSync('bash', [supervisor], { cwd, env: cleanEnv({ SIGNAL_TREE_ISOLATED: '1', ANTHROPIC_API_KEY: 'test-key', ...extra }), encoding: 'utf8' });

  it('sets a private umask before anything else runs', () => {
    expect(readFileSync(supervisor, 'utf8')).toMatch(/^set -uo pipefail\n(#.*\n)*umask 077\n/m);
  });

  it('refuses to start if this user can read the App key named in the mint config (exit 13), before creating or minting anything', () => {
    const { env, work, root, appConfig, state, mints } = fixture();
    const key = join(root, 'readable.pem');
    writeFileSync(key, 'not really a key', { mode: 0o400 });
    writeFileSync(appConfig, JSON.stringify({ appId: 12345, installationId: 678, keyFile: key }));
    const readable = start(env, work);
    expect(readable.status).toBe(13);
    expect(readable.stderr).toContain(`can read the App's private key ${key}; only the mint user may`);
    expect(readable.stderr).not.toContain('not really a key');
    expect([existsSync(join(state, 'github-app')), mints()]).toEqual([false, 0]);
  });

  for (const [what, config] of [
    ['is not JSON', 'not json'],
    ['names no key', '{}'],
    ['names a relative key path', '{"keyFile":"app.pem"}'],
    ['is missing', null],
  ] as const) {
    it(`refuses to start when the mint config ${what} (exit 13)`, () => {
      const { env, work, appConfig } = fixture();
      if (config === null) rmSync(appConfig);
      else writeFileSync(appConfig, config);
      const run = start(env, work);
      expect(run.status).toBe(13);
      expect(run.stderr).toContain(`cannot read the key path (keyFile) from ${appConfig}`);
    });
  }

  /** The agent's setup with the mint config naming a key in a directory of its own, as on the VM. */
  const keyInDirectory = () => {
    const fixture = appFixture();
    const locked = join(fixture.root, 'st-mint');
    mkdirSync(locked);
    writeFileSync(join(locked, 'app.pem'), 'not really a key', { mode: 0o400 });
    writeFileSync(fixture.appConfig, JSON.stringify({ appId: 12345, installationId: 678, keyFile: join(locked, 'app.pem') }));
    return { ...fixture, locked };
  };
  const checkKey = (env: Record<string, string>) => bash(`${shellFunctions('check_key_unreadable')}; check_key_unreadable`, env);

  it('passes the key check when the key cannot be read', () => {
    const { env, locked } = keyInDirectory();
    chmodSync(locked, 0o000);
    try {
      expect(checkKey(env).status).toBe(0);
    } finally {
      chmodSync(locked, 0o700);
    }
  });

  it('fails the key check when the same key can be read', () => {
    expect(checkKey(keyInDirectory().env).status).toBe(1);
  });

  it('ignores App settings left in the environment', () => {
    const text = readFileSync(supervisor, 'utf8');
    expect(text).toContain('unset SIGNAL_TREE_APP_ID SIGNAL_TREE_APP_INSTALLATION_ID SIGNAL_TREE_APP_KEY_FILE');
    expect(text).not.toMatch(/export[^\n]*SIGNAL_TREE_APP_(ID|KEY_FILE)/);
  });

  it('refuses a state directory inside the checkout (exit 2), creating nothing', () => {
    const { env, work } = fixture();
    const run = start({ ...env, SIGNAL_TREE_STATE_DIR: join(work, '.state') }, work);
    expect(run.status).toBe(2);
    expect(run.stderr).toContain("is inside the agent's checkout or the verifier");
    expect(existsSync(join(work, '.state'))).toBe(false);
  });

  it('refuses a state directory inside the verifier (exit 2), creating nothing', () => {
    const { env, work, root } = fixture();
    const run = start({ ...env, SIGNAL_TREE_VERIFY_DIR: join(root, 'verify'), SIGNAL_TREE_STATE_DIR: join(root, 'verify', 'state') }, work);
    expect(run.status).toBe(2);
    expect(run.stderr).toContain("is inside the agent's checkout or the verifier");
    expect(existsSync(join(root, 'verify'))).toBe(false);
  });

  it('refuses to start when the mint command fails (exit 9), even with a valid token cached', () => {
    const { env, cache, mint, work, setMint, mints } = fixture();
    writeFileSync(cache, JSON.stringify({ command: mint, token: 'ghs_cached', expiresAt: new Date(Date.now() + 60 * MINUTE).toISOString() }));
    setMint({ output: '', status: 1, stderr: 'sudo: a password is required\n' });
    const run = start(env, work);
    expect(run.status).toBe(9);
    expect(run.stderr).toContain(`app-token: the mint command (${mint}) failed (1): sudo: a password is required`);
    expect(run.stderr).toContain('the mint command gave no GitHub App installation token');
    expect(mints()).toBe(1);
  });

  it('refuses to start when the mint command prints no installation token (exit 9)', () => {
    const { env, work, setMint } = fixture();
    setMint({ output: minted('gho_personal') });
    const run = start(env, work);
    expect(run.status).toBe(9);
    expect(run.stderr).toContain('did not print an installation token (ghs_...)');
  });

  it('refuses an SSH origin (exit 10), after minting afresh, and leaves a private state directory', () => {
    const ssh = fixture('git@github.com:JBorgia/signal-tree.git');
    // A valid cached token does not spare the startup mint.
    writeFileSync(ssh.cache, JSON.stringify({ command: ssh.mint, token: 'ghs_cached', expiresAt: new Date(Date.now() + 60 * MINUTE).toISOString() }));
    const run = start(ssh.env, ssh.work);
    expect(run.status).toBe(10);
    expect(ssh.mints()).toBe(1);
    expect(JSON.parse(readFileSync(ssh.cache, 'utf8')).token).toBe('ghs_supervisor');
    expect(run.stderr).toContain('origin fetches or pushes through git@github.com:JBorgia/signal-tree.git');
    expect(mode(ssh.state)).toBe(0o700);
    expect(mode(join(ssh.state, 'github-app'))).toBe(0o700);
    expect(mode(join(ssh.state, 'github-app', 'gitconfig'))).toBe(0o600);
    expect(mode(join(ssh.state, 'github-app', 'app-token.mjs'))).toBe(0o600);
    expect(mode(join(ssh.state, 'github-app', 'codeowners.mjs'))).toBe(0o600);
    expect(mode(join(ssh.state, 'github-app', 'bin', 'gh'))).toBe(0o700);
  });

  it('refuses an origin with a token in it (exit 10), without echoing the token', () => {
    const token = fixture('https://x-access-token:ghp_SECRET@github.com/JBorgia/signal-tree.git');
    const run = start(token.env, token.work);
    expect(run.status).toBe(10);
    expect(run.stderr).toContain('https://***@github.com/JBorgia/signal-tree.git');
    expect(run.stderr).not.toContain('ghp_SECRET');
  });

  it('refuses to start when gh has a stored login (exit 11)', () => {
    const { env, work } = fixture();
    const run = start({ ...env, FAKE_AUTH_STATUS: '0' }, work);
    expect(run.status).toBe(11);
    expect(run.stderr).toContain('gh has a stored login');
  });

  it('refuses to start unless main requires an approving review, code-owner review and status checks (exit 12), read as the App', () => {
    const { env, work, ghLog } = fixture();
    const run = start({ ...env, FAKE_RULES: JSON.stringify([pullRequest({ require_code_owner_review: false }), statusChecks]) }, work);
    expect(run.status).toBe(12);
    expect(run.stderr).toContain('lacks what a PR the App auto-merges must wait for:\n  a pull_request rule requiring code-owner review (require_code_owner_review: true)\n');
    expect(readFileSync(ghLog, 'utf8').trim().split('\n')).toEqual(['unset auth status', 'ghs_supervisor api repos/JBorgia/signal-tree/rules/branches/main']);
  });

  /** check_origin on a checkout whose origin is `url`, after the given `git config` calls. */
  const checkOrigin = (url: string | null, ...config: string[][]) => {
    const work = checkout(url);
    for (const args of config) git(work, ...args);
    return bash(`${shellFunctions('check_origin', 'redact_url')}; check_origin "$PWD"`, isolatedGit, work);
  };

  for (const url of [ORIGIN, 'https://github.com/JBorgia/signal-tree']) {
    it(`accepts origin ${url}`, () => {
      const r = checkOrigin(url);
      expect(r.status, r.stderr).toBe(0);
    });
  }

  for (const [what, url, config, shown] of [
    ['a token in the URL', 'https://x-access-token:ghp_SECRET@github.com/JBorgia/signal-tree.git', [], 'https://***@github.com/'],
    ['SSH', 'ssh://git@github.com/JBorgia/signal-tree.git', [], 'ssh://***@github.com/'],
    ['another repository', 'https://github.com/someone/signal-tree.git', [], 'someone/signal-tree'],
    ['plain HTTP', 'http://github.com/JBorgia/signal-tree.git', [], 'http://github.com/'],
    ['a push URL to another repository', ORIGIN, [['config', 'remote.origin.pushurl', 'https://github.com/someone/signal-tree.git']], 'someone/signal-tree'],
    ['an insteadOf rule to SSH', ORIGIN, [['config', 'url.git@github.com:.insteadOf', 'https://github.com/']], 'git@github.com:JBorgia'],
    ['a pushInsteadOf rule to SSH', ORIGIN, [['config', 'url.git@github.com:.pushInsteadOf', 'https://github.com/']], 'git@github.com:JBorgia'],
    ['a second URL with a token', ORIGIN, [['remote', 'set-url', '--add', 'origin', 'https://x:ghp_SECRET@github.com/JBorgia/signal-tree.git']], 'https://***@github.com/'],
    ['an extra header for github.com', ORIGIN, [['config', 'http.https://github.com/.extraheader', 'AUTHORIZATION: basic SECRET']], 'http.https://github.com/.extraheader'],
    ['an extra header for every host', ORIGIN, [['config', 'http.extraheader', 'AUTHORIZATION: bearer SECRET']], 'http.extraheader'],
  ] as const) {
    it(`refuses an origin with ${what}, without echoing secrets`, () => {
      const r = checkOrigin(url, ...config.map((args) => [...args]));
      expect(r.status).toBe(1);
      expect(r.stderr).toContain(shown);
      expect(r.stderr).not.toContain('SECRET');
    });
  }

  it('refuses a checkout without an origin', () => {
    expect(checkOrigin(null).stderr).toContain('has no origin remote');
  });

  /**
   * use_github_app in a checkout of ORIGIN, with the machine's own git config
   * (as in the review: HTTPS rewritten to SSH, a personal helper and an extra
   * header) and the checkout's (a personal helper and another identity), then
   * `probe`, all in one shell; `before` runs first, before use_github_app.
   */
  const asTheApp = (probe: string[], before: string[] = []) => {
    const { env, root, state } = appFixture('ghs_env');
    const appDir = join(state, 'github-app');
    const machine = join(root, 'machine-gitconfig');
    const personal = '!f() { echo username=someone; echo password=personal-token; }; f';
    writeFileSync(machine, `[url "git@github.com:"]\n\tinsteadOf = https://github.com/\n[credential]\n\thelper = "${personal}"\n[http]\n\textraheader = AUTHORIZATION: basic SECRET\n`);
    const work = checkout(ORIGIN);
    appendFileSync(join(work, '.git', 'config'), `[credential]\n\thelper = "${personal}"\n[user]\n\tname = Someone Else\n\temail = someone@example.com\n`);
    const script = [shellFunctions('use_github_app', 'install_helpers', 'install_file', 'write_git_config'), ...before, `use_github_app '${unattended}' '${appDir}' || exit 9`, ...probe].join('\n');
    const r = bash(script, { ...env, GIT_CONFIG_GLOBAL: machine, GIT_ASKPASS: '/bin/echo', SSH_ASKPASS: '/bin/echo', GIT_SSH_COMMAND: 'false' }, work);
    expect(r.status, r.stderr).toBe(0);
    return { lines: r.stdout.trim().split('\n'), appDir };
  };

  it("leaves the machine's git config out, and gives git only the App's credentials", () => {
    const { lines, appDir } = asTheApp([
      'echo "global=$GIT_CONFIG_GLOBAL nosystem=$GIT_CONFIG_NOSYSTEM protocols=$GIT_ALLOW_PROTOCOL askpass=[${GIT_ASKPASS-unset}] ssh_askpass=${SSH_ASKPASS-unset} prompt=$GIT_TERMINAL_PROMPT"',
      'echo "gh=$(command -v gh)"',
      'echo "url=$(git ls-remote --get-url https://github.com/JBorgia/signal-tree.git)"',
      'echo "headers=$(git config --get-regexp extraheader)"',
      "printf 'protocol=https\\nhost=github.com\\n\\n' | git credential fill | grep -E '^(username|password)='",
    ], ['echo "before=$(git ls-remote --get-url https://github.com/JBorgia/signal-tree.git)"']);
    expect(lines).toEqual([
      'before=git@github.com:JBorgia/signal-tree.git',
      `global=${appDir}/gitconfig nosystem=1 protocols=https:file askpass=[] ssh_askpass=unset prompt=0`,
      `gh=${appDir}/bin/gh`,
      `url=${ORIGIN}`,
      'headers=',
      'username=x-access-token',
      'password=ghs_env',
    ]);
    expect(readFileSync(join(appDir, 'gitconfig'), 'utf8')).not.toMatch(/^\s*[^#\s]/m);
  });

  it('allows no SSH at all', () => {
    const { lines } = asTheApp(['for url in git@github.com:JBorgia/signal-tree.git ssh://git@github.com/JBorgia/signal-tree.git; do git ls-remote "$url" 2>&1 | grep -o "transport .ssh. not allowed"; done']);
    expect(lines).toEqual(["transport 'ssh' not allowed", "transport 'ssh' not allowed"]);
  });

  it("commits as Jonathan whatever the checkout's config says, and installs the helpers privately", () => {
    const { lines, appDir } = asTheApp(['git commit -q --allow-empty -m probe && git log -1 --format="commit=%an <%ae> / %cn <%ce>"']);
    const jonathan = 'Jonathan Borgia <jonathanborgia@gmail.com>';
    expect(lines).toEqual([`commit=${jonathan} / ${jonathan}`]);
    expect(readFileSync(join(appDir, 'app-token.mjs'), 'utf8')).toBe(readFileSync(appToken, 'utf8'));
    expect(readFileSync(join(appDir, 'codeowners.mjs'), 'utf8')).toBe(readFileSync(codeownersMatcher, 'utf8'));
    expect(readFileSync(join(appDir, 'bin', 'gh'), 'utf8')).toBe(readFileSync(wrapper, 'utf8'));
    expect([mode(join(appDir, 'gitconfig')), mode(join(appDir, 'app-token.mjs')), mode(join(appDir, 'codeowners.mjs')), mode(join(appDir, 'bin', 'gh'))]).toEqual([0o600, 0o600, 0o600, 0o700]);
  });

  /**
   * PATH entries for use_real_gh: '.' and a relative directory holding a decoy
   * gh, the wrapper's directory, a directory with a link to the wrapper, and two
   * real ones, a and b (each gh exits $FAKE_AUTH_STATUS for auth status).
   */
  const ghPaths = () => {
    const root = scratch();
    const cwd = join(root, 'cwd');
    const wrapperDir = join(root, 'github-app', 'bin');
    const linked = join(root, 'linked');
    const [a, b] = [join(root, 'a'), join(root, 'b')];
    for (const dir of [join(cwd, 'rel'), wrapperDir, linked, a, b]) mkdirSync(dir, { recursive: true });
    const decoyLog = join(root, 'decoy.log');
    for (const dir of [cwd, join(cwd, 'rel'), wrapperDir]) writeScript(join(dir, 'gh'), `echo "$*" >> "${decoyLog}"; exit 0`);
    symlinkSync(join(wrapperDir, 'gh'), join(linked, 'gh'));
    for (const dir of [a, b]) writeScript(join(dir, 'gh'), 'exit "${FAKE_AUTH_STATUS:-1}"');
    const config = join(root, 'gh-config');
    const resolve = (path: string, extra: Record<string, string> = {}) =>
      bash(`${shellFunctions('use_real_gh')}; PATH=$TEST_PATH; use_real_gh "$CONFIG" "${wrapperDir}/gh" || exit 11; echo "real=$SIGNAL_TREE_REAL_GH"; echo "config=$GH_CONFIG_DIR"; echo "path=$PATH"`, { TEST_PATH: path, CONFIG: config, ...extra }, cwd);
    return { a, config, decoyLog, resolve, tail: `${wrapperDir}:${linked}:${a}:${b}:/usr/bin:/bin`, wrappers: `${wrapperDir}:${linked}` };
  };

  it('resolves the real gh once from absolute PATH entries other than the wrapper, and drops relative ones', () => {
    const { a, config, decoyLog, resolve, tail } = ghPaths();
    const ok = resolve(`:.:rel:${tail}`);
    expect(ok.status, ok.stderr).toBe(0);
    expect(ok.stdout.trim().split('\n')).toEqual([`real=${realpathSync(a)}/gh`, `config=${config}`, `path=${tail}`]);
    expect(mode(config)).toBe(0o700);
    expect(existsSync(decoyLog)).toBe(false);
  });

  it('refuses a gh with a stored login', () => {
    const { resolve, tail } = ghPaths();
    const login = resolve(tail, { FAKE_AUTH_STATUS: '0' });
    expect(login.status).toBe(11);
    expect(login.stderr).toContain('gh has a stored login');
  });

  it('refuses a gh config directory that holds a login', () => {
    const { config, resolve, tail } = ghPaths();
    mkdirSync(config);
    writeFileSync(join(config, 'hosts.yml'), 'github.com:\n  user: someone\n');
    expect(resolve(tail).status).toBe(11);
  });

  it('refuses when the only gh is the wrapper or in a relative directory', () => {
    const { decoyLog, resolve, wrappers } = ghPaths();
    const none = resolve(`.:rel:${wrappers}`);
    expect(none.status).toBe(11);
    expect(none.stderr).toContain('no gh in an absolute PATH directory');
    expect(existsSync(decoyLog)).toBe(false);
  });

  /** check_main_rules, reading `rules` from the fake gh. */
  const checkRules = (rules: string, extra: Record<string, string> = {}) => bash(`${shellFunctions('check_main_rules')}; check_main_rules`, { ...fixture().env, FAKE_RULES: rules, ...extra });
  const approvals = 'a pull_request rule requiring at least one approving review (required_approving_review_count >= 1)';
  const reviews = 'a pull_request rule requiring code-owner review (require_code_owner_review: true)';
  const checks = 'a required_status_checks rule';
  const missing = (...requirements: string[]) => `lacks what a PR the App auto-merges must wait for:\n${requirements.map((r) => `  ${r}\n`).join('')}`;

  for (const [what, rules] of [
    ['the required rules among others', [{ type: 'deletion' }, statusChecks, pullRequest()]],
    ['two approving reviews', [pullRequest({ required_approving_review_count: 2 }), statusChecks]],
    // Each requirement may come from a different ruleset's rule.
    ['the requirements spread over two rulesets', [pullRequest({ require_code_owner_review: false }), pullRequest({ required_approving_review_count: 0 }), statusChecks]],
  ] as const) {
    it(`accepts main's rules with ${what}`, () => {
      expect(checkRules(JSON.stringify(rules)).status).toBe(0);
    });
  }

  for (const [what, rules, requirements] of [
    ['no rules', [], [approvals, reviews, checks]],
    ['no status checks', [pullRequest()], [checks]],
    ['a pull_request rule without parameters', [statusChecks, { type: 'pull_request' }], [approvals, reviews]],
    ['no approving review', [pullRequest({ required_approving_review_count: 0 }), statusChecks], [approvals]],
    ['a review count that is not a number', [pullRequest({ required_approving_review_count: '1' }), statusChecks], [approvals]],
    ['no code-owner review', [pullRequest({ require_code_owner_review: false }), statusChecks], [reviews]],
    ['code-owner review given as a string', [pullRequest({ require_code_owner_review: 'true' }), statusChecks], [reviews]],
  ] as const) {
    it(`refuses main's rules with ${what}, naming what is missing`, () => {
      const r = checkRules(JSON.stringify(rules));
      expect(r.status).toBe(1);
      expect(r.stderr).toContain(missing(...requirements));
    });
  }

  it('refuses when the rules cannot be read', () => {
    const r = checkRules('{"message":"Not Found"}', { FAKE_API_STATUS: '1' });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('could not read the rules for main of JBorgia/signal-tree');
  });

  it("refuses an answer that is not a list of rules", () => {
    const r = checkRules('{"message":"Not Found"}');
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("GitHub's answer is not a list of rules");
  });
});

describe('workflow self-test', () => {
  // No outcome here depends on the clock. Every self-test step gets a FIFO as
  // its deadline (with_timeout), which only a test that wants a timeout ever
  // writes, and the slow remote blocks on a FIFO the test controls.
  const ZERO = '0000000000000000000000000000000000000000';
  const identity = { GIT_AUTHOR_NAME: 'Jonathan Borgia', GIT_AUTHOR_EMAIL: 'jonathanborgia@gmail.com', GIT_COMMITTER_NAME: 'Jonathan Borgia', GIT_COMMITTER_EMAIL: 'jonathanborgia@gmail.com' };
  /** GitHub's message for an App push of a workflow file without the workflows permission. */
  const refusal = (path: string) => `refusing to allow a GitHub App to create or update workflow \`${path}\` without \`workflows\` permission`;
  // pre-receive hooks for the fake remote. Each logs "<old> <new> <ref>" for every ref it is offered.
  const log = 'while read -r old new ref; do echo "$old $new $ref" >> "$HOOK_LOG"; ';
  const hooks = {
    // Like GitHub for an App without the workflows permission: refuse a push that adds or changes a workflow file.
    github: `${log}[[ $new == ${ZERO} ]] && continue; for f in $(git diff --name-only refs/heads/main "$new" -- .github/workflows/); do echo "${refusal('$f')}" >&2; exit 1; done; done`,
    // Like GitHub for an App that has the permission.
    accept: `${log}done`,
    protected: `${log}done; echo "error: GH006: Protected branch update failed for refs/heads/selftest." >&2; exit 1`,
    disabled: `${log}done; echo "workflow runs are disabled for this repository" >&2; exit 1`,
    denied: `${log}done; echo "Permission to JBorgia/signal-tree.git denied to signal-tree-ci[bot]." >&2; exit 1`,
    // Refuses with GitHub's message, but the branch appears anyway.
    sneaky: `${log}[[ $new == ${ZERO} ]] && continue; env -u GIT_QUARANTINE_PATH git update-ref "$ref" refs/heads/main; echo "${refusal('.github/workflows/x.yml')}" >&2; exit 1; done`,
    // Says it is running, then holds the push until the test lets it go.
    held: `${log}done; printf 'in\\n' > "$HOOK_ENTERED"; read -r < "$HOOK_RELEASE"; exit 1`,
  };

  const fifo = (path: string) => {
    const made = spawnSync('mkfifo', [path], { encoding: 'utf8' });
    if (made.status !== 0) throw new Error(`mkfifo ${path}: ${made.stderr}`);
    return path;
  };
  /** Opens FIFO `path` for writing without waiting for a reader, and closes it: wakes a reader if there is one. */
  const release = (path: string) => {
    try {
      closeSync(openSync(path, constants.O_WRONLY | constants.O_NONBLOCK));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENXIO') throw error;
    }
  };

  // One fake remote with main (holding a workflow already) and the agent's clone of it, built once and copied for each test.
  let template = '';
  beforeAll(() => {
    template = mkdtempSync(join(tmpdir(), 'signal-tree-selftest-template-'));
    const remote = join(template, 'remote.git');
    git(template, 'init', '-q', '--bare', '-b', 'main', remote);
    const seed = join(template, 'seed');
    git(template, 'clone', '-q', remote, seed);
    mkdirSync(join(seed, '.github', 'workflows'), { recursive: true });
    writeFileSync(join(seed, '.github', 'workflows', 'tests.yml'), 'name: tests\n');
    writeFileSync(join(seed, 'README.md'), 'signal-tree\n');
    git(seed, 'add', '.');
    git(seed, '-c', 'user.name=Seed', '-c', 'user.email=seed@example.com', 'commit', '-qm', 'seed');
    git(seed, 'push', '-q', 'origin', 'HEAD:main');
    git(template, 'clone', '-q', remote, join(template, 'work'));
  });
  afterAll(() => rmSync(template, { recursive: true, force: true }));

  /** A copy of the template with `hook` as the remote's pre-receive hook, and the FIFOs a test may drive. */
  const remoteFixture = (hook: string) => {
    const root = scratch();
    const remote = join(root, 'remote.git');
    const work = join(root, 'work');
    cpSync(join(template, 'remote.git'), remote, { recursive: true });
    cpSync(join(template, 'work'), work, { recursive: true });
    const config = join(work, '.git', 'config');
    writeFileSync(config, readFileSync(config, 'utf8').replaceAll(join(template, 'remote.git'), remote));
    writeScript(join(remote, 'hooks', 'pre-receive'), hook);
    const tmp = join(root, 'tmp');
    mkdirSync(tmp);
    const hookLog = join(root, 'hook.log');
    const offered = () => (existsSync(hookLog) ? readFileSync(hookLog, 'utf8').trim().split('\n') : []);
    const selftestRefs = () => git(remote, 'for-each-ref', '--format=%(refname)', 'refs/heads/selftest');
    return { root, remote, work, tmp, hookLog, offered, selftestRefs, deadline: fifo(join(root, 'deadline')), entered: fifo(join(root, 'entered')), held: fifo(join(root, 'held')) };
  };
  type Fixture = ReturnType<typeof remoteFixture>;
  const selftestScript = `${shellFunctions('workflow_selftest', 'workflow_push', 'is_workflow_refusal', 'with_timeout', 'deadline_text')}; workflow_selftest "$PWD" "$DEADLINE"`;
  const selftestEnv = (f: Fixture, extra: Record<string, string>) => ({ ...isolatedGit, ...identity, GIT_ALLOW_PROTOCOL: 'https:file', TMPDIR: f.tmp, HOOK_LOG: f.hookLog, HOOK_ENTERED: f.entered, HOOK_RELEASE: f.held, DEADLINE: f.deadline, ...extra });
  const selftest = (f: Fixture, extra: Record<string, string> = {}) => bash(selftestScript, selftestEnv(f, extra), f.work);
  /** The self-test, started without waiting for it. */
  const startSelftest = (f: Fixture) => bashAsync(selftestScript, selftestEnv(f, {}), f.work);
  /**
   * Every path in the checkout, its .git included, with its mode, and a file's
   * size and modification time: any change to files, index, refs or objects
   * shows. FETCH_HEAD is left out, since the self-test's fetch writes it.
   */
  const snapshot = (work: string) => {
    const entries: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir).sort()) {
        const path = join(dir, name);
        if (path === join(work, '.git', 'FETCH_HEAD')) continue;
        const stat = lstatSync(path);
        entries.push(stat.isDirectory() ? `${path} ${stat.mode.toString(8)}` : `${path} ${stat.mode.toString(8)} ${stat.size} ${stat.mtimeMs}`);
        if (stat.isDirectory()) walk(path);
      }
    };
    walk(work);
    return entries.join('\n');
  };

  it('passes when the push is refused for the missing workflows permission, leaving no branch and no trace in the checkout', () => {
    const f = remoteFixture(hooks.github);
    const before = snapshot(f.work);
    const r = selftest(f);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toBe("Workflow self-test passed: GitHub refused the App's push of a workflow file, and left no branch.\n");
    expect(f.selftestRefs()).toBe('');
    expect(snapshot(f.work)).toBe(before);
    expect(readdirSync(f.tmp)).toEqual([]);
    const [offer] = f.offered();
    expect(offer).toMatch(new RegExp(`^${ZERO} [0-9a-f]{40} refs/heads/selftest/workflow-push-[0-9a-f]{12}$`));
  });

  it('pushes, as Jonathan, a commit of main plus only .github/workflows/selftest-<id>.yml to selftest/workflow-push-<id>', () => {
    const f = remoteFixture(hooks.accept);
    selftest(f);
    const [created, deleted] = f.offered();
    const [, commit, ref] = created.split(' ');
    const id = ref.replace('refs/heads/selftest/workflow-push-', '');
    expect(id).toMatch(/^[0-9a-f]{12}$/);
    // Parents, author, committer, and the change from main: one new file.
    const [head, ...patch] = git(f.remote, 'log', '-1', '--format=%P|%an <%ae>|%cn <%ce>', '--patch', commit).split('\n');
    const main = readFileSync(join(f.remote, 'refs', 'heads', 'main'), 'utf8').trim();
    expect(head).toBe(`${main}|Jonathan Borgia <jonathanborgia@gmail.com>|Jonathan Borgia <jonathanborgia@gmail.com>`);
    expect(patch.filter((line) => line.startsWith('diff --git'))).toEqual([`diff --git a/.github/workflows/selftest-${id}.yml b/.github/workflows/selftest-${id}.yml`]);
    expect(patch).toContain('new file mode 100644');
    expect(patch).toContain('+on: workflow_dispatch');
    expect(deleted).toBe(`${commit} ${ZERO} ${ref}`);
  });

  it('fails when the push is accepted (exit 14 in the supervisor), deleting the branch at once', () => {
    const f = remoteFixture(hooks.accept);
    const r = selftest(f);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('Refusing to start: the workflow self-test failed (it pushed .github/workflows/selftest-');
    expect(r.stderr).toContain('GitHub accepted it, so the App can change workflows: remove its Workflows permission (workflow changes come only from Jonathan). The branch has been deleted.');
    expect(f.selftestRefs()).toBe('');
    expect(f.offered()).toHaveLength(2);
  });

  // Each other reason for refusing the push is its own case, so no test does more than one self-test run.
  for (const [reason, hook] of [
    ['a protected branch', hooks.protected],
    ['a workflow message without permission or refusing', hooks.disabled],
    ['a permission message without workflow', hooks.denied],
  ] as const) {
    it(`fails when the push is refused for another reason, without mistaking it for the workflows refusal: ${reason}`, () => {
      const f = remoteFixture(hook);
      const r = selftest(f);
      expect(r.status, r.stderr).toBe(1);
      expect(r.stderr).toContain('GitHub refused it, but not for the missing workflows permission, so this proves nothing.');
      expect(f.selftestRefs()).toBe('');
      expect(f.offered()).toHaveLength(1);
    });
  }

  it('fails at once when the push cannot reach the remote, without mistaking it for the workflows refusal', () => {
    const f = remoteFixture(hooks.github);
    // A local path that does not exist: git gives up at once, with no network and no connect timeout.
    git(f.work, 'config', 'remote.origin.pushurl', `file://${join(f.root, 'missing.git')}`);
    const r = selftest(f);
    expect(r.status, r.stderr).toBe(1);
    expect(r.stderr).toContain('GitHub refused it, but not for the missing workflows permission, so this proves nothing.');
    expect(f.offered()).toEqual([]);
  });

  it('fails, deleting the branch, when the push is refused with the right message but the branch exists anyway', () => {
    const f = remoteFixture(hooks.sneaky);
    const r = selftest(f);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('GitHub refused the push, yet the branch exists. The branch has been deleted.');
    expect(f.selftestRefs()).toBe('');
  });

  it('fails when the push does not finish by its deadline, which the test sets off while the remote holds the push', async () => {
    const f = remoteFixture(hooks.held);
    try {
      const run = startSelftest(f);
      // The remote's hook is running, so the push is under way and waiting on it.
      await readFile(f.entered, 'utf8');
      await writeFile(f.deadline, 'now\n');
      const r = await run;
      expect(r.status, r.stderr).toBe(1);
      expect(r.stderr).toContain('The push did not finish before its deadline.');
      expect(f.selftestRefs()).toBe('');
    } finally {
      release(f.held);
    }
  });

  it('fails when main cannot be fetched', () => {
    const f = remoteFixture(hooks.github);
    git(f.work, 'remote', 'set-url', 'origin', `file://${join(f.root, 'missing.git')}`);
    const r = selftest(f);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('the workflow self-test could not fetch main');
  });

  it('is skipped, loudly, with SIGNAL_TREE_SKIP_WORKFLOW_SELFTEST=1 and a fake remote', () => {
    const f = remoteFixture(hooks.accept);
    const skipped = selftest(f, { SIGNAL_TREE_SKIP_WORKFLOW_SELFTEST: '1' });
    expect(skipped.status).toBe(0);
    expect(skipped.stderr).toContain('WARNING: SKIPPING THE WORKFLOW SELF-TEST (SIGNAL_TREE_SKIP_WORKFLOW_SELFTEST=1, fake remote)');
    expect(f.offered()).toEqual([]);
  });

  it('runs despite SIGNAL_TREE_SKIP_WORKFLOW_SELFTEST=1 when origin is on github.com', () => {
    const f = remoteFixture(hooks.accept);
    git(f.work, 'remote', 'set-url', 'origin', ORIGIN);
    // https is not allowed here, so it fails at once without the network.
    const github = selftest(f, { SIGNAL_TREE_SKIP_WORKFLOW_SELFTEST: '1', GIT_ALLOW_PROTOCOL: 'file' });
    expect(github.status).toBe(1);
    expect(github.stderr).toContain('is only for tests against a fake remote; origin is on github.com, so the workflow self-test runs.');
    expect(github.stderr).toContain('could not fetch main');
  });

  /** is_workflow_refusal on push output `text`. */
  const matches = (text: string) => {
    const file = join(scratch(), 'push.out');
    writeFileSync(file, text);
    return bash(`${shellFunctions('is_workflow_refusal')}; is_workflow_refusal "${file}"`, {}).status === 0;
  };
  const selftestPath = '.github/workflows/selftest-0123456789ab.yml';
  for (const [what, text] of [
    ["GitHub's ref status line", `To https://github.com/JBorgia/signal-tree.git\n ! [remote rejected] 1a2b3c4 -> selftest/workflow-push-0123456789ab (${refusal(selftestPath)})\nerror: failed to push some refs\n`],
    ['the same message in capitals', `remote: ${refusal(selftestPath).toUpperCase()}\n`],
    ['workflow and refusing without permission', 'remote: refusing to update workflow files\n'],
  ] as const) {
    it(`recognises GitHub's refusal: ${what}`, () => {
      expect(matches(text)).toBe(true);
    });
  }
  for (const [what, text] of [
    ['a protected branch', 'remote: error: GH006: Protected branch update failed.\n'],
    ['workflow alone', 'remote: workflow runs are disabled\n'],
    ['permission alone', 'remote: Permission to JBorgia/signal-tree.git denied.\nfatal: unable to access: The requested URL returned error: 403\n'],
    ['workflow and permission on different lines', 'remote: a workflow\nremote: permission\n'],
    ['a network failure', 'fatal: unable to access: Could not resolve host: github.com\n'],
    ['no output', ''],
  ] as const) {
    it(`does not take ${what} for GitHub's refusal`, () => {
      expect(matches(text)).toBe(false);
    });
  }

  /** with_timeout running `command`, then its status. */
  const timed = (command: string) => `${shellFunctions('with_timeout')}; ${command}; echo "status=$?"`;

  it('kills the command when its deadline is set off, returning 124', async () => {
    const dir = scratch();
    const deadline = fifo(join(dir, 'deadline'));
    const blocked = fifo(join(dir, 'blocked'));
    // The command waits on a FIFO nobody writes, so only the deadline can end it.
    const run = bashAsync(timed(`with_timeout "${deadline}" cat "${blocked}"`), {});
    await writeFile(deadline, 'now\n');
    expect((await run).stdout).toBe('status=124\n');
  });

  for (const [command, status] of [
    ["sh -c 'exit 3'", 3],
    ['true', 0],
  ] as const) {
    it(`passes the status of \`${command}\` through when the deadline is never set off, leaving no watchdog holding the output`, () => {
      const deadline = fifo(join(scratch(), 'deadline'));
      expect(bash(timed(`with_timeout "${deadline}" ${command}`), {}).stdout).toBe(`status=${status}\n`);
    });
  }

  it('takes the production deadline as a number of seconds', () => {
    // Never reached here: true ends first.
    expect(bash(timed('with_timeout 30 true'), {}).stdout).toBe('status=0\n');
    expect(bash(`${shellFunctions('deadline_text')}; deadline_text 30; deadline_text /some/fifo`, {}).stdout).toBe('within 30 s\nbefore its deadline\n');
  });

  it('runs in the supervisor after the token, origin, gh, rules and ls-remote checks, before the lock (exit 14), with a 30 s deadline', () => {
    const text = readFileSync(supervisor, 'utf8');
    const main = text.slice(text.indexOf('main() {'), text.indexOf('\n}\n', text.indexOf('main() {')));
    const at = (snippet: string) => {
      expect(main).toContain(snippet);
      return main.indexOf(snippet);
    };
    const selftestAt = at('workflow_selftest "$WORK_DIR" 30 || exit 14');
    for (const before of ['|| exit 9', 'check_origin "$WORK_DIR" || exit 10', '|| exit 11', 'check_main_rules || exit 12', 'ls-remote -q origin HEAD']) expect(at(before)).toBeLessThan(selftestAt);
    for (const after of ['git clone -q', 'acquire --session']) expect(at(after)).toBeGreaterThan(selftestAt);
  });
});
