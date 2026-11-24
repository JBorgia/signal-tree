import { spawnSync } from 'node:child_process';
import { generateKeyPairSync, verify } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { CONFIG_FILE, TOKEN_REQUEST, appJwt, checkInstallation, mint, mintToken, readConfig, readPrivateKey, run } from './mint-token.mjs';

// Tests for the minting side, which runs as st-mint on the VM: here it runs as
// the current user, with a fake config and key in a temporary directory and a
// fake fetch, so nothing reaches the network.

const mintScript = new URL('./mint-token.mjs', import.meta.url).pathname;

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
});
const keyLine = privateKey.split('\n')[1];

const dirs: string[] = [];
const scratch = () => {
  const dir = mkdtempSync(join(tmpdir(), 'signal-tree-mint-'));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const decode = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
const T0 = Date.UTC(2026, 10, 20, 12, 0, 0);
const HOUR = 3_600_000;
const noSleep = async () => {};
const APPROVED_REQUEST = {
  repositories: ['signal-tree'],
  permissions: { contents: 'write', pull_requests: 'write', issues: 'write', checks: 'write', actions: 'read' },
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
/** A made-up token in GitHub's current installation-token shape: ghs_, 390 characters, with . and -. */
const CURRENT_TOKEN = `ghs_${'Ab1_'.repeat(30)}.${'x-Y9'.repeat(40)}.${'Zq_8'.repeat(16)}-${'k'.repeat(39)}`;
const issued = (token: string, expiresAt = T0 + HOUR) => () => new Response(JSON.stringify({ token, expires_at: new Date(expiresAt).toISOString(), permissions: {}, repository_selection: 'selected' }), { status: 201 });
const failed = (status: number, message: string) => () => new Response(JSON.stringify({ message }), { status });
/** GET /app/installations/{id}: by default installed on selected repositories, with the approved permissions. */
const installation =
  (fields: Record<string, unknown> = {}, permissions: Record<string, unknown> = {}) =>
  () =>
    new Response(
      JSON.stringify({
        id: 678,
        app_id: 12345,
        app_slug: 'signal-tree-ci',
        target_type: 'User',
        repository_selection: 'selected',
        permissions: { metadata: 'read', contents: 'write', pull_requests: 'write', issues: 'write', checks: 'write', actions: 'read', ...permissions },
        ...fields,
      }),
      { status: 200 },
    );

/** A config file and an owner-only key in a temporary directory, as /etc/signal-tree/app.json and st-mint's key would be. */
function mintFixture(config: Record<string, unknown> = {}) {
  const root = scratch();
  const keyFile = join(root, 'app.pem');
  writeFileSync(keyFile, privateKey, { mode: 0o400 });
  const configFile = join(root, 'app.json');
  writeFileSync(configFile, JSON.stringify({ appId: 12345, installationId: 678, keyFile, ...config }));
  return { root, keyFile, configFile };
}

/** A stream that collects what is written to it. */
function sink() {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, done) {
      chunks.push(String(chunk));
      done();
    },
  });
  return { stream, text: () => chunks.join('') };
}

describe('mint command: the App JWT', () => {
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
});

describe('mint command: config and key', () => {
  it('reads the App ID, installation ID and key path from /etc/signal-tree/app.json by default', () => {
    expect(CONFIG_FILE).toBe('/etc/signal-tree/app.json');
    const { configFile, keyFile } = mintFixture();
    expect(readConfig(configFile)).toEqual({ appId: 12345, installationId: '678', keyFile });
    expect(readConfig(mintFixture({ appId: '12345', installationId: '678' }).configFile)).toMatchObject({ appId: 12345, installationId: '678' });
  });

  it('refuses a missing or malformed config, naming the field', () => {
    const root = scratch();
    expect(() => readConfig(join(root, 'none.json'))).toThrow(`cannot read ${join(root, 'none.json')}: ENOENT`);
    writeFileSync(join(root, 'bad.json'), 'not json');
    expect(() => readConfig(join(root, 'bad.json'))).toThrow('not JSON');
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ appId: 0 }, 'appId must be a positive integer'],
      [{ appId: 'signal-tree-ci' }, 'appId must be a positive integer'],
      [{ installationId: '678/../../user' }, 'installationId must be a positive integer'],
      [{ installationId: 1.5 }, 'installationId must be a positive integer'],
      [{ keyFile: 'app.pem' }, 'keyFile must be an absolute path'],
      [{ keyFile: undefined }, 'keyFile must be an absolute path'],
    ];
    for (const [fields, message] of cases) expect(() => readConfig(mintFixture(fields).configFile)).toThrow(message);
  });

  it('refuses a key that anyone but its owner can read, or that is not an RSA PEM key, never echoing it', () => {
    const { keyFile } = mintFixture();
    expect(readPrivateKey(keyFile).asymmetricKeyType).toBe('rsa');
    for (const mode of [0o440, 0o404, 0o644]) {
      rmSync(keyFile);
      writeFileSync(keyFile, privateKey, { mode });
      expect(() => readPrivateKey(keyFile)).toThrow(`mode ${mode.toString(8)}, readable beyond its owner; chmod 0400 it`);
    }
    rmSync(keyFile);
    writeFileSync(keyFile, '-----BEGIN RSA PRIVATE KEY-----\nSENTINEL-NOT-A-KEY\n-----END RSA PRIVATE KEY-----\n', { mode: 0o400 });
    const garbled = (() => {
      try {
        readPrivateKey(keyFile);
      } catch (error) {
        return (error as Error).message;
      }
    })();
    expect(garbled).toContain(`${keyFile} is not a PEM private key`);
    expect(garbled).not.toContain('SENTINEL');
    rmSync(keyFile);
    writeFileSync(keyFile, generateKeyPairSync('ec', { namedCurve: 'P-256', privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } }).privateKey, { mode: 0o400 });
    expect(() => readPrivateKey(keyFile)).toThrow('holds a key of type ec; GitHub App keys are RSA');
    rmSync(keyFile);
    expect(() => readPrivateKey(keyFile)).toThrow(`cannot use the App's private key ${keyFile}: ENOENT`);
  });
});

describe('mint command: minting', () => {
  it('asks for signal-tree only, with the approved permissions and never Workflows, signed with the App JWT', async () => {
    const github = fakeGitHub([installation(), issued('ghs_first')]);
    expect(await mint({ configFile: mintFixture().configFile, now: T0, fetch: github.fetch })).toEqual({ token: 'ghs_first', expires_at: new Date(T0 + HOUR).toISOString() });
    expect(github.calls).toHaveLength(2);
    const [, { url, init }] = github.calls;
    expect(url).toBe('https://api.github.com/app/installations/678/access_tokens');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual(APPROVED_REQUEST);
    expect(TOKEN_REQUEST).toEqual(APPROVED_REQUEST);
    // Jonathan: the App does not get Workflows permission.
    expect(JSON.parse(init.body as string).permissions).not.toHaveProperty('workflows');
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers.Accept).toBe('application/vnd.github+json');
    expect(decode(headers.Authorization.replace(/^Bearer /, '').split('.')[1])).toEqual({ iat: T0 / 1000 - 60, exp: T0 / 1000 + 540, iss: 12345 });
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
      issued('ghs_ok'),
    ]);
    expect(await mintToken({ appId: 12345, installationId: '678', privateKey, now: T0, fetch: flaky.fetch, sleep })).toEqual({ token: 'ghs_ok', expires_at: new Date(T0 + HOUR).toISOString() });
    expect(sleeps).toEqual([1000, 2000]);

    const down = fakeGitHub([failed(503, 'Unavailable'), failed(503, 'Unavailable'), failed(503, 'Unavailable')]);
    await expect(mintToken({ appId: 12345, installationId: '678', privateKey, now: T0, fetch: down.fetch, sleep: noSleep })).rejects.toThrow('after 3 attempts: GitHub answered 503: Unavailable.');
    expect(down.calls).toHaveLength(3);
  });

  it("fails at once on a 4xx answer with GitHub's message and a hint, and never shows the JWT or the key", async () => {
    const denied = fakeGitHub([failed(401, 'A JSON web token could not be decoded')]);
    const error: Error = await mintToken({ appId: 12345, installationId: '678', privateKey, now: T0, fetch: denied.fetch, sleep: noSleep }).catch((e: Error) => e);
    expect(error.message).toContain('GitHub answered 401: A JSON web token could not be decoded.');
    expect(error.message).toContain('Check appId and the key');
    expect(denied.calls).toHaveLength(1);
    const jwt = (denied.calls[0].init.headers as Record<string, string>).Authorization.replace(/^Bearer /, '');
    expect(error.message).not.toContain(jwt.split('.')[2]);
    expect(error.message).not.toContain(keyLine);

    for (const [status, hint] of [
      [404, 'Check installationId'],
      [422, 'may lack a permission'],
    ] as const) {
      await expect(mintToken({ appId: 12345, installationId: '678', privateKey, now: T0, fetch: fakeGitHub([failed(status, 'No')]).fetch, sleep: noSleep })).rejects.toThrow(hint);
    }
  });

  it("accepts GitHub's current installation tokens: about 390 characters, with . and -", async () => {
    expect(CURRENT_TOKEN).toHaveLength(390);
    expect(await mintToken({ appId: 12345, installationId: '678', privateKey, now: T0, fetch: fakeGitHub([issued(CURRENT_TOKEN)]).fetch, sleep: noSleep })).toEqual({ token: CURRENT_TOKEN, expires_at: new Date(T0 + HOUR).toISOString() });
  });

  it('refuses an answer without an installation token (ghs_) and its expiry', async () => {
    for (const answer of [() => new Response('{}', { status: 201 }), issued('gho_personal'), issued('ghs_x\nusername=someone'), issued('ghs_x\r'), issued('ghs_x y'), issued('ghs_x=y'), issued('ghs_'), () => new Response('{"token":"ghs_x"}', { status: 201 })]) {
      await expect(mintToken({ appId: 12345, installationId: '678', privateKey, now: T0, fetch: fakeGitHub([answer]).fetch, sleep: noSleep })).rejects.toThrow('without an installation token (ghs_...)');
    }
  });
});

describe("mint command: the App's installation", () => {
  const check = (answer: () => Response) => {
    const github = fakeGitHub([answer]);
    return { github, result: checkInstallation({ appId: 12345, installationId: '678', privateKey, now: T0, fetch: github.fetch, sleep: noSleep }) };
  };
  const workflows = "the App has Workflows permission (\"write\"); Jonathan's ruling says it must not";
  const administration = "the App has Administration permission (\"read\"); Jonathan's ruling says it must not";
  const everything = 'the App is installed on all of the account\'s repositories (repository_selection "all"); it must be installed on signal-tree only';

  it('reads GET /app/installations/{id} with the App JWT, and accepts selected repositories without Workflows or Administration', async () => {
    const { github, result } = check(installation());
    await expect(result).resolves.toBeUndefined();
    const [{ url, init }] = github.calls;
    expect(url).toBe('https://api.github.com/app/installations/678');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    const headers = init.headers as Record<string, string>;
    expect(headers).not.toHaveProperty('Content-Type');
    expect(decode(headers.Authorization.replace(/^Bearer /, '').split('.')[1])).toEqual({ iat: T0 / 1000 - 60, exp: T0 / 1000 + 540, iss: 12345 });
  });

  it('refuses an App with the Workflows permission at any level', async () => {
    await expect(check(installation({}, { workflows: 'write' })).result).rejects.toThrow(`refusing to mint a token: ${workflows}. Fix the App's settings on GitHub.`);
    await expect(check(installation({}, { workflows: 'read' })).result).rejects.toThrow('the App has Workflows permission ("read")');
    await expect(check(installation({}, { workflows: null })).result).rejects.toThrow('the App has Workflows permission (null)');
  });

  it('refuses an App with the Administration permission at any level', async () => {
    await expect(check(installation({}, { administration: 'read' })).result).rejects.toThrow(`refusing to mint a token: ${administration}.`);
    await expect(check(installation({}, { administration: 'write' })).result).rejects.toThrow('the App has Administration permission ("write")');
  });

  it("refuses an App installed on all of the account's repositories", async () => {
    await expect(check(installation({ repository_selection: 'all' })).result).rejects.toThrow(`refusing to mint a token: ${everything}.`);
  });

  it('names every problem at once', async () => {
    await expect(check(installation({ repository_selection: 'all' }, { workflows: 'write', administration: 'read' })).result).rejects.toThrow(`refusing to mint a token: ${workflows}; ${administration}; ${everything}. Fix the App's settings on GitHub.`);
  });

  it('refuses an answer without permissions or a repository selection, and fails on an unknown installation', async () => {
    for (const answer of [installation({ permissions: undefined }), installation({ permissions: null }), installation({ repository_selection: undefined }), () => new Response('not json', { status: 200 })]) {
      await expect(check(answer).result).rejects.toThrow("without the installation's permissions and repository selection");
    }
    await expect(check(failed(404, 'Not Found')).result).rejects.toThrow("could not read the App's installation: GitHub answered 404: Not Found. Check installationId");
  });

  it('mints nothing when the installation is refused', async () => {
    for (const answer of [installation({}, { workflows: 'write' }), installation({}, { administration: 'write' }), installation({ repository_selection: 'all' })]) {
      const github = fakeGitHub([answer, issued('ghs_never')]);
      await expect(mint({ configFile: mintFixture().configFile, now: T0, fetch: github.fetch, sleep: noSleep })).rejects.toThrow('refusing to mint a token: ');
      expect(github.calls.map((call) => call.init.method)).toEqual(['GET']);
    }
  });
});

describe('mint command: what it prints', () => {
  it('prints only {"token","expires_at"} on one line, and nothing on stderr', async () => {
    const out = sink();
    const err = sink();
    const status = await run([], { configFile: mintFixture().configFile, fetch: fakeGitHub([installation(), issued('ghs_printed')]).fetch, stdout: out.stream, stderr: err.stream });
    expect(status).toBe(0);
    expect(out.text()).toMatch(/^\{"token":"ghs_printed","expires_at":"[^"]+"\}\n$/);
    expect(Object.keys(JSON.parse(out.text()))).toEqual(['token', 'expires_at']);
    expect(err.text()).toBe('');
  });

  it('exits 1 with one short line on stderr, printing nothing on stdout, when it fails', async () => {
    const { configFile, keyFile } = mintFixture();
    const cases: Array<[Array<() => Response>, string]> = [
      [[failed(401, 'Bad credentials')], "could not read the App's installation: GitHub answered 401: Bad credentials."],
      [[installation(), failed(401, 'Bad credentials')], 'could not mint an installation token: GitHub answered 401: Bad credentials.'],
      [[installation(), issued('gho_personal')], 'without an installation token'],
      [[installation({}, { workflows: 'write' })], "refusing to mint a token: the App has Workflows permission (\"write\"); Jonathan's ruling says it must not."],
    ];
    for (const [answers, message] of cases) {
      const out = sink();
      const err = sink();
      expect(await run([], { configFile, fetch: fakeGitHub(answers).fetch, sleep: noSleep, stdout: out.stream, stderr: err.stream })).toBe(1);
      expect(out.text()).toBe('');
      expect(err.text()).toMatch(new RegExp(`^mint-token: .*${message.replace(/[.()]/g, '\\$&')}.*\\n$`));
      expect(err.text()).not.toContain(keyLine);
    }
    rmSync(keyFile);
    writeFileSync(keyFile, privateKey, { mode: 0o644 });
    const err = sink();
    expect(await run([], { configFile, fetch: fakeGitHub([]).fetch, stdout: sink().stream, stderr: err.stream })).toBe(1);
    expect(err.text()).toBe(`mint-token: cannot use the App's private key ${keyFile}: mode 644, readable beyond its owner; chmod 0400 it\n`);
  });

  /** The installed form: node on mint-token.mjs, with a config of the test's own in the environment. */
  const command = (args: string[]) => {
    const { configFile } = mintFixture();
    const env = { ...process.env, SIGNAL_TREE_APP_CONFIG: configFile, SIGNAL_TREE_MINT_CONFIG: configFile };
    return { configFile, run: spawnSync('node', [mintScript, ...args], { env, encoding: 'utf8' }) };
  };

  it('as a command, refuses arguments', () => {
    const { configFile, run } = command(['/some/config.json']);
    expect([run.status, run.stdout]).toEqual([2, '']);
    expect(run.stderr).toContain('takes no arguments');
    expect(run.stderr).not.toContain(configFile);
  });

  it('as a command, takes no setting from the environment', () => {
    // With no arguments it reads only /etc/signal-tree/app.json. Without that file it fails;
    // on the VM, as the agent, it cannot read the key. Either way it never reads the config above.
    const { configFile, run } = command([]);
    expect(run.status).toBe(1);
    expect(run.stdout).toBe('');
    expect(run.stderr).toMatch(/^mint-token: /);
    expect(run.stderr).not.toContain(configFile);
    expect(readFileSync(mintScript, 'utf8')).not.toMatch(/process\.env/);
  });
});
