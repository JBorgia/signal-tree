// Mints a GitHub App installation token for the unattended runner, as the
// st-mint user, the only one that can read the App's private key. Jonathan's
// ruling: "the VM uses a separate Unix user that owns the key. The agent may
// run only the token-minting command through sudo and receives 1-hour tokens."
//
//   sudo -n -u st-mint /opt/signal-tree/mint-token
//
// prints {"token":"ghs_...","expires_at":"..."} and nothing else on stdout. The
// token is limited to the signal-tree repository and the permissions in
// TOKEN_REQUEST, whatever the caller wants. Settings come only from the
// root-owned /etc/signal-tree/app.json, never from arguments (any are refused)
// or the environment (which sudo resets, and the wrapper below clears):
//
//   {"appId": 123456, "installationId": 7890123, "keyFile": "/var/lib/st-mint/app.pem"}
//
// The key must be readable by st-mint alone: a key file with any group or
// other permission bit is refused. No message ever contains the key or the
// token. Exit status: 0 printed a token; 1 any failure, with a one-line
// message on stderr; 2 called with arguments.
//
// This file must stay self-contained (Node builtins only): the operator
// installs a root-owned copy of it.
//
// Install (as root on the agent VM, from a checkout of main; the agent's Unix
// user is `agent`, NODE is a root-owned node binary such as /usr/bin/node, never
// one the agent can write, like an nvm install in its home):
//
//   NODE=/usr/bin/node
//   useradd --system --home-dir /var/lib/st-mint --create-home --shell /usr/sbin/nologin st-mint
//   chmod 0700 /var/lib/st-mint
//   install -o st-mint -g st-mint -m 0400 /path/to/signal-tree-ci.private-key.pem /var/lib/st-mint/app.pem
//   shred -u /path/to/signal-tree-ci.private-key.pem        # and delete every other copy
//   install -d -o root -g root -m 0755 /opt/signal-tree /etc/signal-tree
//   install -o root -g root -m 0644 ci/unattended/mint-token.mjs /opt/signal-tree/mint-token.mjs
//   printf '#!/bin/sh\ncd / && exec /usr/bin/env -i %s /opt/signal-tree/mint-token.mjs\n' "$NODE" > /opt/signal-tree/mint-token
//   chown root:root /opt/signal-tree/mint-token && chmod 0755 /opt/signal-tree/mint-token
//   printf '{"appId": %s, "installationId": %s, "keyFile": "/var/lib/st-mint/app.pem"}\n' APP_ID INSTALLATION_ID > /etc/signal-tree/app.json
//   chown root:root /etc/signal-tree/app.json && chmod 0644 /etc/signal-tree/app.json
//   echo 'agent ALL=(st-mint) NOPASSWD: /opt/signal-tree/mint-token ""' > /etc/sudoers.d/signal-tree-mint
//   chmod 0440 /etc/sudoers.d/signal-tree-mint && visudo -cf /etc/sudoers.d/signal-tree-mint
//
// Keep sudo's default env_reset. The "" in the sudoers line lets the agent run
// the command only without arguments; mint-token.mjs refuses arguments too.
// The wrapper passes no arguments, clears the environment (so no NODE_OPTIONS
// can load code into the process that reads the key) and starts in /. The
// config file stays readable by everyone: the supervisor reads keyFile from it
// to check that the agent cannot read the key. Then, as the agent user:
//
//   sudo -n -u st-mint /opt/signal-tree/mint-token | jq -r .expires_at   # an hour from now
//   cat /var/lib/st-mint/app.pem                                         # must fail: Permission denied
//
// To update it, repeat the install line for mint-token.mjs from a newer main.
import { Buffer } from 'node:buffer';
import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

export const CONFIG_FILE = '/etc/signal-tree/app.json';
export const API = 'https://api.github.com';
/**
 * The token's scope: this repository only, with the permissions the agent
 * needs. Jonathan approved workflows write and actions read.
 */
export const TOKEN_REQUEST = {
  repositories: ['signal-tree'],
  permissions: { contents: 'write', pull_requests: 'write', issues: 'write', checks: 'write', workflows: 'write', actions: 'read' },
};
const ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 30_000;

const base64url = (text) => Buffer.from(text).toString('base64url');
/** An installation token: ghs_ and word characters, so it is always one line. */
export const isInstallationToken = (token) => typeof token === 'string' && /^ghs_\w+$/.test(token);

/** The App's JWT: RS256, issued 60 s back to allow for clock drift, expiring 9 minutes from now. */
export function appJwt({ appId, privateKey, now = Date.now() }) {
  const seconds = Math.floor(now / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({ iat: seconds - 60, exp: seconds + 540, iss: appId }));
  const signature = sign('sha256', Buffer.from(`${header}.${payload}`), privateKey).toString('base64url');
  return `${header}.${payload}.${signature}`;
}

/** The settings in `configFile`; throws naming what is missing or malformed. */
export function readConfig(configFile = CONFIG_FILE) {
  let config;
  try {
    config = JSON.parse(readFileSync(configFile, 'utf8'));
  } catch (error) {
    throw new Error(`cannot read ${configFile}: ${error.code ?? 'not JSON'}`, { cause: error });
  }
  const id = (name) => {
    const value = config?.[name];
    if (!(Number.isSafeInteger(value) && value > 0) && !(typeof value === 'string' && /^[1-9]\d{0,15}$/.test(value))) throw new Error(`${configFile}: ${name} must be a positive integer`);
    return String(value);
  };
  const keyFile = config?.keyFile;
  if (typeof keyFile !== 'string' || !keyFile.startsWith('/')) throw new Error(`${configFile}: keyFile must be an absolute path`);
  return { appId: Number(id('appId')), installationId: id('installationId'), keyFile };
}

/** The App's private key, which only its owner may read. Errors name the file, never its contents. */
export function readPrivateKey(keyFile) {
  let pem;
  try {
    const { mode } = statSync(keyFile);
    if (mode & 0o077) throw Object.assign(new Error('group or other permissions'), { code: `mode ${(mode & 0o777).toString(8)}, readable beyond its owner; chmod 0400 it` });
    pem = readFileSync(keyFile);
  } catch (error) {
    throw new Error(`cannot use the App's private key ${keyFile}: ${error.code ?? 'read failed'}`, { cause: error });
  }
  let key;
  try {
    key = createPrivateKey(pem);
  } catch (error) {
    throw new Error(`${keyFile} is not a PEM private key: ${error.code ?? 'unreadable'}`, { cause: error });
  }
  if (key.asymmetricKeyType !== 'rsa') throw new Error(`${keyFile} holds a key of type ${key.asymmetricKeyType}; GitHub App keys are RSA`);
  return key;
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
  401: ' Check appId and the key in the config file, and the VM clock.',
  404: ' Check installationId in the config file: the App has no such installation.',
  422: ' The App may lack a permission in TOKEN_REQUEST, or not be installed on signal-tree.',
};

/**
 * Mints an installation token for TOKEN_REQUEST: { token, expires_at }.
 * Network errors and 5xx answers are retried (three attempts in all); any
 * other answer fails at once.
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
      return { token: body.token, expires_at: body.expires_at };
    }
    problem = `GitHub answered ${response.status}${await githubMessage(response)}.`;
    if (response.status < 500) throw new Error(`could not mint an installation token: ${problem}${HINTS[response.status] ?? ''}`);
  }
  throw new Error(`could not mint an installation token after ${ATTEMPTS} attempts: ${problem}`);
}

/** Reads `configFile` and the key, and mints a token: { token, expires_at }. */
export async function mint({ configFile = CONFIG_FILE, now, fetch, sleep } = {}) {
  const { appId, installationId, keyFile } = readConfig(configFile);
  return mintToken({ appId, installationId, privateKey: readPrivateKey(keyFile), now, fetch, sleep });
}

// Pipes are written asynchronously on macOS: exit only once the text is out.
const write = (stream, text) => new Promise((resolve) => stream.write(text, resolve));

/** The command: refuses arguments, mints from CONFIG_FILE, prints the JSON line. Returns the exit status. */
export async function run(args, { configFile = CONFIG_FILE, fetch, sleep, stdout = process.stdout, stderr = process.stderr } = {}) {
  if (args.length) {
    await write(stderr, 'mint-token: takes no arguments; its settings come only from /etc/signal-tree/app.json\n');
    return 2;
  }
  try {
    const { token, expires_at } = await mint({ configFile, fetch, sleep });
    await write(stdout, `${JSON.stringify({ token, expires_at })}\n`);
    return 0;
  } catch (error) {
    await write(stderr, `mint-token: ${error.message}\n`);
    return 1;
  }
}

// Node runs the main module from its real path; compare with that, or a path through a
// symlink would skip this and exit 0 having done nothing.
if (import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  run(process.argv.slice(2)).then((code) => process.exit(code));
}
