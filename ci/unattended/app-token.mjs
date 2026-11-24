// GitHub App installation tokens for the unattended runner, on the agent's
// side (BRIEF.md 12.3, "Agent identity"). The App, signal-tree-ci, only
// authenticates pushes and gh calls; commits keep Jonathan's identity as author
// and committer (see supervise.sh).
//
//   node app-token.mjs token                  print an installation token
//   node app-token.mjs git-credential <op>    git credential helper for https://github.com:
//                                             answers `get`, drops the cached token on
//                                             `erase`, ignores `store`
//
// The agent never reads the App's private key (Jonathan's ruling: a separate
// Unix user owns it). Tokens come from the mint command, which runs as that
// user and prints {"token":"ghs_...","expires_at":"..."} (see mint-token.mjs).
//
// Environment:
//   SIGNAL_TREE_MINT_COMMAND  default "sudo -n -u st-mint /opt/signal-tree/mint-token";
//                             run with /bin/sh -c
//   SIGNAL_TREE_STATE_DIR     default ~/.signal-tree-unattended; holds the token cache
//
// Only installation tokens (ghs_...) that have not expired are accepted. A
// token is cached in $SIGNAL_TREE_STATE_DIR/app-token.json (mode 0600) and
// reused until 10 minutes before it expires; GitHub issues them for an hour.
// The token never appears in a message; it is written only to stdout, by
// `token` and to git by the helper.
//
// Exit status: 0 done; 1 any failure; 2 usage.
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const MINT_COMMAND = 'sudo -n -u st-mint /opt/signal-tree/mint-token';
export const REFRESH_MARGIN_MS = 10 * 60 * 1000;
// Three attempts with 30 s timeouts and backoff fit well inside this.
const MINT_TIMEOUT_MS = 120_000;

// The same check as mint-token.mjs (ghs_, then letters, digits, _, . and -):
// it also keeps the credential helper's answer to git one line per attribute.
const isInstallationToken = (token) => typeof token === 'string' && /^ghs_[\w.-]+$/.test(token);

/** The settings from the environment. */
export function configFromEnv(env = process.env) {
  const stateDir = env.SIGNAL_TREE_STATE_DIR || join(homedir(), '.signal-tree-unattended');
  return { command: env.SIGNAL_TREE_MINT_COMMAND || MINT_COMMAND, cacheFile: join(stateDir, 'app-token.json') };
}

/** The cached token, if the same mint command gave it, it is an installation token, and it has more than 10 minutes left. */
export function cachedToken({ command, cacheFile }, now = Date.now()) {
  let cached;
  try {
    cached = JSON.parse(readFileSync(cacheFile, 'utf8'));
  } catch {
    return null;
  }
  if (cached?.command !== command || !isInstallationToken(cached.token)) return null;
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

/** Runs `command` with /bin/sh: { status, stdout, stderr }. */
function runCommand(command) {
  return new Promise((resolve, reject) => {
    const child = spawn('/bin/sh', ['-c', command], { stdio: ['ignore', 'pipe', 'pipe'], timeout: MINT_TIMEOUT_MS });
    const out = [];
    const err = [];
    child.stdout.on('data', (chunk) => out.push(chunk));
    child.stderr.on('data', (chunk) => err.push(chunk));
    child.on('error', reject);
    child.on('close', (status, signal) => resolve({ status: status ?? signal, stdout: Buffer.concat(out).toString('utf8'), stderr: Buffer.concat(err).toString('utf8') }));
  });
}

/**
 * Runs the mint command and returns its token: { token, expiresAt }. Its
 * stdout must be one JSON object with an installation token and a future
 * expiry. Errors quote the command's stderr, never its stdout.
 */
export async function mintToken(command, now = Date.now()) {
  const { status, stdout, stderr } = await runCommand(command);
  if (status !== 0) {
    const reason = stderr.trim().split('\n').pop();
    throw new Error(`the mint command (${command}) failed (${status})${reason ? `: ${reason}` : ''}`);
  }
  let answer = null;
  try {
    answer = JSON.parse(stdout);
  } catch {
    // Reported below.
  }
  const expires = Date.parse(answer?.expires_at);
  if (!isInstallationToken(answer?.token) || Number.isNaN(expires)) throw new Error(`the mint command (${command}) did not print an installation token (ghs_...) and its expiry`);
  if (expires <= now) throw new Error(`the mint command (${command}) printed a token that expired at ${answer.expires_at}`);
  return { token: answer.token, expiresAt: answer.expires_at };
}

/** A token with more than 10 minutes left: the cached one, or a newly minted one, which is then cached. */
export async function getToken(config, { now = Date.now() } = {}) {
  const cached = cachedToken(config, now);
  if (cached) return cached;
  const { token, expiresAt } = await mintToken(config.command, now);
  writeCache(config.cacheFile, { command: config.command, token, expiresAt });
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
