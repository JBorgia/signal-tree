// GitHub App installation tokens for the unattended runner (BRIEF.md 12.3,
// "Agent identity"). The App, signal-tree-ci, only authenticates pushes and
// gh calls; commits keep Jonathan's identity as author and committer (see
// supervise.sh).
//
//   node app-token.mjs token                  print an installation token
//   node app-token.mjs git-credential <op>    git credential helper for https://github.com:
//                                             answers `get`, drops the cached token on
//                                             `erase`, ignores `store`
//
// Environment:
//   SIGNAL_TREE_APP_ID               the App's ID
//   SIGNAL_TREE_APP_INSTALLATION_ID  the App's installation ID on the repository
//   SIGNAL_TREE_APP_KEY_FILE         path to the App's private key (.pem)
//   SIGNAL_TREE_STATE_DIR            default ~/.signal-tree-unattended; holds the token cache
//
// Each token is limited to the signal-tree repository and the permissions in
// TOKEN_REQUEST. It is cached in $SIGNAL_TREE_STATE_DIR/app-token.json (mode
// 0600) and reused until 10 minutes before it expires; GitHub issues them for an
// hour. Only installation tokens (ghs_...) are accepted, from GitHub or the cache.
// Neither the key nor the token appears in any message; the token is written
// only to stdout, by `token` and to git by the helper.
//
// Exit status: 0 done; 1 any failure; 2 usage.
import { Buffer } from 'node:buffer';
import { createPrivateKey, randomBytes, sign } from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

export const API = 'https://api.github.com';
/**
 * The token's scope: this repository only, with the permissions the agent
 * needs. Jonathan approved workflows write and actions read.
 */
export const TOKEN_REQUEST = {
  repositories: ['signal-tree'],
  permissions: { contents: 'write', pull_requests: 'write', issues: 'write', checks: 'write', workflows: 'write', actions: 'read' },
};
export const REFRESH_MARGIN_MS = 10 * 60 * 1000;
const ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 30_000;

const base64url = (text) => Buffer.from(text).toString('base64url');
// Also keeps the credential helper's answer to git one line per attribute.
const isInstallationToken = (token) => typeof token === 'string' && /^ghs_\w+$/.test(token);

/** The App's JWT: RS256, issued 60 s back to allow for clock drift, expiring 9 minutes from now. */
export function appJwt({ appId, privateKey, now = Date.now() }) {
  const seconds = Math.floor(now / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({ iat: seconds - 60, exp: seconds + 540, iss: appId }));
  const signature = sign('sha256', Buffer.from(`${header}.${payload}`), privateKey).toString('base64url');
  return `${header}.${payload}.${signature}`;
}

/** The settings from the environment; throws naming what is missing or malformed. */
export function configFromEnv(env = process.env) {
  const missing = ['SIGNAL_TREE_APP_ID', 'SIGNAL_TREE_APP_INSTALLATION_ID', 'SIGNAL_TREE_APP_KEY_FILE'].filter((name) => !env[name]);
  if (missing.length) throw new Error(`${missing.join(', ')} not set; the supervisor takes them from the VM's secret store`);
  for (const name of ['SIGNAL_TREE_APP_ID', 'SIGNAL_TREE_APP_INSTALLATION_ID']) {
    if (!/^[1-9]\d*$/.test(env[name])) throw new Error(`${name} must be the App's numeric ID`);
  }
  const stateDir = env.SIGNAL_TREE_STATE_DIR || join(homedir(), '.signal-tree-unattended');
  return {
    appId: Number(env.SIGNAL_TREE_APP_ID),
    installationId: env.SIGNAL_TREE_APP_INSTALLATION_ID,
    keyFile: env.SIGNAL_TREE_APP_KEY_FILE,
    cacheFile: join(stateDir, 'app-token.json'),
  };
}

/** The App's private key. Errors name the file, never its contents. */
export function readPrivateKey(keyFile) {
  let pem;
  try {
    pem = readFileSync(keyFile);
  } catch (error) {
    throw new Error(`cannot read the App's private key ${keyFile} (SIGNAL_TREE_APP_KEY_FILE): ${error.code ?? 'read failed'}`, { cause: error });
  }
  let key;
  try {
    key = createPrivateKey(pem);
  } catch (error) {
    throw new Error(`${keyFile} (SIGNAL_TREE_APP_KEY_FILE) is not a PEM private key: ${error.code ?? 'unreadable'}`, { cause: error });
  }
  if (key.asymmetricKeyType !== 'rsa') throw new Error(`${keyFile} (SIGNAL_TREE_APP_KEY_FILE) holds a key of type ${key.asymmetricKeyType}; GitHub App keys are RSA`);
  return key;
}

/** The cached token, if it is an installation token for this App installation and TOKEN_REQUEST with more than 10 minutes left. */
export function cachedToken({ appId, installationId, cacheFile }, now = Date.now()) {
  let cached;
  try {
    cached = JSON.parse(readFileSync(cacheFile, 'utf8'));
  } catch {
    return null;
  }
  if (cached?.appId !== appId || cached.installationId !== installationId || !isInstallationToken(cached.token)) return null;
  if (JSON.stringify(cached.request) !== JSON.stringify(TOKEN_REQUEST)) return null;
  return Date.parse(cached.expiresAt) - now > REFRESH_MARGIN_MS ? cached.token : null;
}

/** Writes the cache readable by its owner only, replacing the old file in one step. */
function writeCache(cacheFile, record) {
  const temp = `${cacheFile}.${process.pid}.${randomBytes(4).toString('hex')}`;
  try {
    mkdirSync(dirname(cacheFile), { recursive: true, mode: 0o700 });
    writeFileSync(temp, `${JSON.stringify(record)}\n`, { mode: 0o600, flag: 'wx' });
    chmodSync(temp, 0o600);
    renameSync(temp, cacheFile);
  } catch (error) {
    rmSync(temp, { force: true });
    throw new Error(`cannot write the token cache ${cacheFile}: ${error.code ?? error.message}`, { cause: error });
  }
}

async function githubMessage(response) {
  try {
    const body = JSON.parse(await response.text());
    return typeof body?.message === 'string' ? `: ${body.message}` : '';
  } catch {
    return '';
  }
}

const HINTS = {
  401: ' Check SIGNAL_TREE_APP_ID, the private key, and the VM clock.',
  404: ' Check SIGNAL_TREE_APP_INSTALLATION_ID: the App has no such installation.',
};

/**
 * Mints an installation token: { token, expiresAt }. Network errors and 5xx
 * answers are retried (three attempts in all); any other answer fails at once.
 */
export async function mintToken({ appId, installationId, privateKey, now = Date.now(), fetch = globalThis.fetch, sleep = delay }) {
  const url = `${API}/app/installations/${installationId}/access_tokens`;
  let problem;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    if (attempt > 1) await sleep(1000 * 2 ** (attempt - 2));
    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${appJwt({ appId, privateKey, now })}`,
          'Content-Type': 'application/json',
          'User-Agent': 'signal-tree-ci',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify(TOKEN_REQUEST),
        signal: globalThis.AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      problem = `the request failed: ${error.cause?.message ?? error.message}.`;
      continue;
    }
    if (response.ok) {
      let body = null;
      try {
        body = await response.json();
      } catch {
        // Reported below as a response without a token.
      }
      if (!isInstallationToken(body?.token) || Number.isNaN(Date.parse(body.expires_at))) {
        throw new Error(`GitHub answered ${response.status} without an installation token (ghs_...) and its expiry`);
      }
      return { token: body.token, expiresAt: body.expires_at };
    }
    problem = `GitHub answered ${response.status}${await githubMessage(response)}.`;
    if (response.status < 500) throw new Error(`could not mint an installation token: ${problem}${HINTS[response.status] ?? ''}`);
  }
  throw new Error(`could not mint an installation token after ${ATTEMPTS} attempts: ${problem}`);
}

/** A token with more than 10 minutes left: the cached one, or a newly minted one, which is then cached. */
export async function getToken(config, { now = Date.now(), fetch, sleep } = {}) {
  const cached = cachedToken(config, now);
  if (cached) return cached;
  const privateKey = readPrivateKey(config.keyFile);
  const { token, expiresAt } = await mintToken({ appId: config.appId, installationId: config.installationId, privateKey, now, fetch, sleep });
  writeCache(config.cacheFile, { appId: config.appId, installationId: config.installationId, request: TOKEN_REQUEST, token, expiresAt });
  return token;
}

/** git's credential attributes: key=value lines up to the first blank line. */
export function parseCredentialRequest(text) {
  const attributes = {};
  for (const line of text.split('\n')) {
    if (line === '') break;
    const i = line.indexOf('=');
    if (i > 0) attributes[line.slice(0, i)] = line.slice(i + 1);
  }
  return attributes;
}

/**
 * The helper's answer to git for `operation` and the request on stdin. For
 * https://github.com: credentials for `get`; on `erase` (git does that when
 * the server rejected them) `forget` drops the cached token, so the next `get`
 * mints a new one. Nothing for other hosts or `store`.
 */
export async function gitCredential(operation, request, { token, forget }) {
  const { protocol, host } = parseCredentialRequest(request);
  if (protocol !== 'https' || host !== 'github.com') return '';
  if (operation === 'get') return `username=x-access-token\npassword=${await token()}\n`;
  if (operation === 'erase') await forget();
  return '';
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

// Pipes are written asynchronously on macOS: exit only once the text is out.
const write = (stream, text) => new Promise((resolve) => (text ? stream.write(text, resolve) : resolve()));

async function main() {
  const [mode, operation] = process.argv.slice(2);
  if (mode === 'token') {
    await write(process.stdout, `${await getToken(configFromEnv())}\n`);
    return 0;
  }
  if (mode === 'git-credential' && operation) {
    const request = await readStdin();
    const forget = async () => rmSync(configFromEnv().cacheFile, { force: true });
    await write(process.stdout, await gitCredential(operation, request, { token: () => getToken(configFromEnv()), forget }));
    return 0;
  }
  await write(process.stderr, 'usage: node app-token.mjs token | git-credential <get|store|erase>\n');
  return 2;
}

// Node runs the main module from its real path; compare with that, or a path through a
// symlink (macOS /var, a linked home) would skip main and exit 0 having done nothing.
if (import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main().then(
    (code) => process.exit(code),
    (error) => write(process.stderr, `app-token: ${error.message}\n`).then(() => process.exit(1)),
  );
}
