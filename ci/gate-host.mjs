// Gate-host preflight and re-check (#18; Jonathan's gate conditions, his
// review of PR #85, and the independent review of #85).
//
// Identity. A job is aimed at the gate runner when its workflow passes the
// repository variable through, `env: SIGNAL_TREE_GATES_RUNNER:
// ${{ vars.SIGNAL_TREE_GATES_RUNNER }}`: the same value its runs-on reads, so
// it is set exactly when runs-on names the self-hosted labels. Such a job must
// name the dedicated label `gates`, and three names must agree:
//   - the repository variable SIGNAL_TREE_GATE_RUNNER_NAME, passed in as env
//     (pins which runner is the gate runner);
//   - RUNNER_NAME, the runner GitHub ran the job on;
//   - the provisioning marker /etc/signal-tree/gate-runner: a regular file
//     owned by root, writable by nobody else, containing the runner's name.
// A missing, foreign-owned or mismatched marker or name fails the job. The host
// must also be the AX42's bare metal: every CPU AuthenticAMD, no `hypervisor`
// CPU flag, and `systemd-detect-virt` printing `none` (unavailable fails).
// A host that carries a marker is held to the gate conditions whatever the job
// says. Any other job (the GitHub-hosted fallback while the variable is unset)
// only reports. Consumers do not trust these records alone: ci/gate-baseline.mjs
// and ci/done-check.mjs also check, through the Jobs API, that GitHub ran the
// gates job on the runner the records name.
//
// Toolchain and user (Jonathan, November 23): the gate runner is one persistent
// runner, registered once by Jonathan, running as a dedicated unprivileged user,
// with Node, pnpm and the Playwright Chromium installed once by root. Its
// job-started hook (ci/gate-runner/job-started.sh, listed in the manifest)
// empties the workspace before every job. The root-owned manifest
// /etc/signal-tree/toolchain.sha256 (sha256sum format, absolute paths) lists
// them; --pre requires the manifest and every listed file, and every directory
// holding one, to be root-owned and writable by nobody else, every file to
// match its hash, the node and pnpm on PATH (real paths) and the node running
// this script to be listed files, PLAYWRIGHT_BROWSERS_PATH to be a root-owned
// directory holding listed files, and the job's user not to be root, not in
// sudo, admin or wheel, and refused by `sudo -n true`. Anything unreadable
// fails. The versions are recorded.
//
// Gate conditions on the gate runner, before the gates (--pre):
//   - every CPU on the performance governor;
//   - boost readable and uniform: per-policy cpufreq/policy*/boost (amd-pstate),
//     else cpufreq/boost. Unknown boost, policies that disagree, or boost known
//     only from intel_pstate/no_turbo (read for reporting) fail;
//   - no swap enabled and none in use;
//   - one runner: /proc/1/stat readable (no hidepid or PID namespace hiding the
//     host), exactly one Runner.Listener process (one actions.runner.* service),
//     and this process running under a Runner.Worker;
//   - quiet: no Runner.Worker other than this job's, and the 1-minute load
//     average below 0.5 × logical CPUs. A job that just ended raises the load,
//     so --pre waits up to --settle seconds for it to fall.
// --pre runs first in the job, right after checkout and before pnpm install.
// It then starts a background sampler that every 5 s, until --post stops it,
// records the peak 1-minute load and any other Runner.Worker, runner count or
// unreadable /proc/1/stat it sees.
//
// After the gates (--post), the run is invalid when the preflight or the
// browser check (--browsers) failed or did not run, the
// identity or host checks above (but the load) fail again, the sampler record is
// missing, empty or stale, the sampler saw another job, a runner count other
// than one or an unreadable /proc/1/stat, or the runner, marker, governor,
// boost, amd-pstate mode or swap changed. The load at the start, its peak and
// the load at the end are recorded, not judged: the job's own install, tests
// and benchmarks raise it.
//
// What these checks cannot see: processes outside this PID namespace (a
// container or VM next to the runner shows only as load); a job that starts and
// ends between two samples; load from anything other than another runner job
// once the gates have started; toolchain files the manifest does not list
// (only their directories' ownership covers them); and whatever this job's own
// steps (pull request code included) do within the job.
//
//   node ci/gate-host.mjs --pre  [--dir bench/out] [--settle 180]
//     First appends SIGNAL_TREE_GATE_HOST= (empty) to $GITHUB_ENV, so an earlier
//     step cannot have set it. Writes <dir>/gate-host.json; exits 1 when the gate
//     runner fails a condition. When it passes on the gate runner, it starts the
//     sampler and appends SIGNAL_TREE_GATE_HOST=<runner name>: the only signal
//     the bench harness gates S8 on (bench/runner/harness.ts isGateRunner).
//   node ci/gate-host.mjs --browsers [--dir bench/out]
//     Runs right after pnpm install, before any harness or bench step (--pre
//     runs before the lock's packages exist). Reads the revision of the browser
//     the harness launches (`chromium`: bench/runner/browser.ts launches channel
//     'chromium', which `playwright install --no-shell chromium` installs) from
//     the playwright-core browsers.json the bench package resolves
//     (bench → @playwright/test → playwright → playwright-core), and on the gate
//     runner requires PLAYWRIGHT_BROWSERS_PATH to hold chromium-<that revision>,
//     with files the toolchain manifest lists. A mismatch, a missing build or an
//     unreadable browsers.json fails, naming both revisions. Writes
//     <dir>/gate-host-browsers.json; off the gate runner it only reports.
//   node ci/gate-host.mjs --post [--dir bench/out]
//     Runs with if: always(), after the gates and before the upload. Stops the
//     sampler, re-reads the host and writes <dir>/gate-host-post.json. When the
//     run is invalid it records `invalid: { reason, at }` there and in every
//     results file in <dir>, and exits 1. ci/done-check.mjs counts such results
//     unmet, and ci/gate-baseline.mjs never compares with them.
import { spawn, spawnSync } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import {
  appendFileSync,
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  realpathSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { userInfo } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const MARKER = 'etc/signal-tree/gate-runner';
export const TOOLCHAIN = 'etc/signal-tree/toolchain.sha256';
export const GATE_LABEL = 'gates';
export const PRE_FILE = 'gate-host.json';
export const POST_FILE = 'gate-host-post.json';
export const SAMPLES_FILE = 'gate-host-samples.json';
export const BROWSERS_FILE = 'gate-host-browsers.json';
/**
 * The browser the harness launches: bench/runner/browser.ts calls
 * chromium.launch({ channel: 'chromium' }), the full Chromium that
 * `playwright install --no-shell chromium` installs, not chromium-headless-shell.
 */
export const HARNESS_BROWSER = 'chromium';
const BENCH_DIR = fileURLToPath(new URL('../bench/', import.meta.url));
/** Set through $GITHUB_ENV by a passing preflight on the gate runner; read by bench/runner/harness.ts. */
export const GATE_HOST_ENV = 'SIGNAL_TREE_GATE_HOST';
/** The quiet-host bound before the gates: the 1-minute load average must be below this × logical CPUs. */
export const LOAD_FACTOR = 0.5;
export const SAMPLE_INTERVAL_MS = 5_000;
const WORKER = 'Runner.Worker';
const LISTENER = 'Runner.Listener';
const AMD = 'AuthenticAMD';
const PRIVILEGED_GROUPS = ['sudo', 'admin', 'wheel'];

/** A file's trimmed text, or null when it is missing or unreadable (a /proc entry can vanish mid-scan). */
const read = (path) => {
  try {
    return readFileSync(path, 'utf8').trim();
  } catch {
    return null;
  }
};
const byNumber = (a, b) => Number(a.match(/\d+$/)[0]) - Number(b.match(/\d+$/)[0]);
const onOff = (value) => (value === '1' ? 'on' : value === '0' ? 'off' : null);
const realOrNull = (path) => {
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
};
/** Owner and mode of a path, not following a final symlink. */
function ownership(path) {
  try {
    const stat = lstatSync(path);
    return { exists: true, file: stat.isFile(), dir: stat.isDirectory(), ownerUid: stat.uid, mode: stat.mode & 0o7777 };
  } catch (error) {
    return error.code === 'ENOENT' ? { exists: false } : { exists: true, error: error.code ?? error.message };
  }
}
/** Why `own` is not root-owned and closed to group and others, or null. */
const looseness = (own, rootUid) =>
  !own.exists ? 'missing' : own.error ? `unreadable (${own.error})` : own.ownerUid !== rootUid ? `owned by uid ${own.ownerUid}, not root` : own.mode & 0o022 ? `writable by group or others (mode ${own.mode.toString(8)})` : null;

// ---------------------------------------------------------- live system probes

/** `systemd-detect-virt`'s answer ('none' on bare metal), or null when it can't be run. */
export function systemdDetectVirt() {
  const result = spawnSync('systemd-detect-virt', [], { encoding: 'utf8', timeout: 10_000 });
  if (result.error) return null;
  return (result.stdout ?? '').trim() || null;
}

/** Whether `sudo -n true` lets this user become root: 'refused', 'allowed' or 'unknown (…)'. */
export function probeSudo() {
  const result = spawnSync('sudo', ['-n', 'true'], { stdio: 'ignore', timeout: 10_000 });
  if (result.error?.code === 'ENOENT') return 'refused';
  if (result.error) return `unknown (${result.error.code ?? result.error.message})`;
  return result.status === 0 ? 'allowed' : 'refused';
}

/** The first line `<path> --version` prints, or null. */
function runVersion(path) {
  const result = spawnSync(path, ['--version'], { encoding: 'utf8', timeout: 30_000 });
  return result.status === 0 ? (result.stdout ?? '').trim().split('\n')[0] || null : null;
}

/** The live system; tests replace any of these. */
const LIVE = {
  detectVirt: systemdDetectVirt,
  sudo: probeSudo,
  version: runVersion,
  execPath: () => process.execPath,
  uid: () => process.getuid?.() ?? null,
  gids: () => process.getgroups?.() ?? [],
  user: () => {
    try {
      return userInfo().username;
    } catch {
      return null;
    }
  },
};
const systemOf = (system) => ({ ...LIVE, ...system });

// ------------------------------------------------------------------ identity

function labelsOf(variable) {
  try {
    const parsed = JSON.parse(variable);
    return (Array.isArray(parsed) ? parsed : [parsed]).filter((l) => typeof l === 'string');
  } catch {
    return [];
  }
}

/**
 * Who this job and host claim to be, read under `root` (a fake tree in tests).
 * `rootUid` is the owner the marker must have: 0 on a real host.
 */
export function readIdentity({ root = '/', env = process.env, rootUid = 0 } = {}) {
  const variable = (env.SIGNAL_TREE_GATES_RUNNER ?? '').trim();
  const path = join(root, MARKER);
  let marker = null;
  try {
    const stat = lstatSync(path);
    marker = { file: stat.isFile(), ownerUid: stat.uid, mode: stat.mode & 0o777, name: null };
    if (marker.file) marker.name = readFileSync(path, 'utf8').trim();
  } catch (error) {
    if (error.code !== 'ENOENT') marker = { ...(marker ?? { file: true, ownerUid: null, mode: null }), name: null, error: error.code ?? error.message };
  }
  return {
    gateJob: variable !== '',
    variable,
    labels: labelsOf(variable),
    runnerName: (env.RUNNER_NAME ?? '').trim() || null,
    pinnedName: (env.SIGNAL_TREE_GATE_RUNNER_NAME ?? '').trim() || null,
    marker,
    rootUid,
  };
}

/** A job aimed at the gate runner, or any job on a host with a marker, is held to the gate conditions. */
export const isEnforced = (identity) => identity.gateJob || identity.marker !== null;

/** Why this job or host is not the gate runner it must be; empty when it is (or need not be). */
export function identityProblems(identity, enforced = isEnforced(identity)) {
  if (!enforced) return [];
  const problems = [];
  if (identity.gateJob && !identity.labels.includes(GATE_LABEL)) {
    problems.push(`SIGNAL_TREE_GATES_RUNNER (${identity.variable}) does not name the dedicated label ${GATE_LABEL}, so a gate job could land on any self-hosted runner`);
  }
  if (!identity.pinnedName) problems.push('SIGNAL_TREE_GATE_RUNNER_NAME is not set: the repository variable must pin the gate runner\'s name');
  else if (identity.runnerName && identity.runnerName !== identity.pinnedName) {
    problems.push(`this job runs on "${identity.runnerName}", not on the pinned gate runner "${identity.pinnedName}"`);
  }
  const marker = identity.marker;
  if (!marker) return [...problems, `no gate-runner marker at /${MARKER}: this host was not provisioned as the gate runner`];
  if (!marker.file) problems.push(`/${MARKER} is not a regular file`);
  else if (marker.error) problems.push(`/${MARKER} can't be read (${marker.error})`);
  else {
    if (marker.ownerUid !== identity.rootUid) problems.push(`/${MARKER} is owned by uid ${marker.ownerUid}, not root`);
    if (marker.mode & 0o022) problems.push(`/${MARKER} is writable by group or others (mode ${marker.mode.toString(8)})`);
  }
  if (!identity.runnerName) problems.push('RUNNER_NAME is not set, so the marker can\'t be matched');
  else if (marker.file && !marker.error && marker.name !== identity.runnerName) {
    problems.push(`/${MARKER} names runner "${marker.name}", but this job runs on "${identity.runnerName}"`);
  }
  return problems;
}

/** Whether this host is the provisioned gate runner: a valid marker naming this runner, which is the pinned one. */
export const isOnGateRunner = (identity) => identity.marker !== null && identityProblems(identity).length === 0;

// ----------------------------------------------------------------- toolchain

function sha256File(path) {
  const fd = openSync(path, 'r');
  const hash = createHash('sha256');
  const buffer = Buffer.alloc(1 << 20);
  try {
    for (let n; (n = readSync(fd, buffer, 0, buffer.length, null)) > 0; ) hash.update(buffer.subarray(0, n));
  } finally {
    closeSync(fd);
  }
  return hash.digest('hex');
}

/** The first `name` on `pathVariable` (each entry read under `root`) that is an executable file, or null. */
function which(root, name, pathVariable) {
  for (const dir of String(pathVariable ?? '').split(':').filter(Boolean)) {
    const candidate = join(root, dir, name);
    try {
      const stat = statSync(candidate);
      if (stat.isFile() && stat.mode & 0o111) return candidate;
    } catch {
      // Not in this PATH entry.
    }
  }
  return null;
}

/**
 * The toolchain the job will use, against the root-owned manifest: every
 * listed file's owner, mode and hash, the directories holding them, the node
 * and pnpm on PATH, PLAYWRIGHT_BROWSERS_PATH, and the job's user. Paths in the
 * manifest and the environment are read under `root` (a fake tree in tests).
 */
/** The toolchain manifest's entries ({ path, expected }) and why it can't be parsed, if it can't. */
function readManifest(root) {
  const entries = [];
  try {
    for (const line of readFileSync(join(root, TOOLCHAIN), 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))) {
      const match = line.match(/^([0-9a-f]{64})\s+\*?(\/\S.*)$/);
      if (!match) return { entries, error: `unparseable line "${line.slice(0, 80)}"` };
      entries.push({ path: match[2], expected: match[1] });
    }
  } catch (error) {
    return { entries, error: error.code ?? error.message };
  }
  return { entries, error: null };
}

export function readToolchain({ root = '/', env = process.env, rootUid = 0, system = {} } = {}) {
  const sys = systemOf(system);
  const top = resolve(root);
  const manifestPath = join(root, TOOLCHAIN);
  const manifest = { ...ownership(manifestPath), entries: [], parseError: null };
  if (manifest.exists && !manifest.error && manifest.file) {
    const parsed = readManifest(root);
    manifest.entries = parsed.entries;
    manifest.parseError = parsed.error;
  }

  const dirCache = new Map();
  const looseDirs = new Set();
  const files = manifest.entries.map(({ path, expected }) => {
    const full = join(root, path);
    const own = ownership(full);
    let actual = null;
    let error = own.error ?? null;
    if (own.exists && own.file && !error) {
      try {
        actual = sha256File(full);
      } catch (e) {
        error = e.code ?? e.message;
      }
    }
    for (let dir = dirname(full); ; dir = dirname(dir)) {
      if (!dirCache.has(dir)) dirCache.set(dir, looseness(ownership(dir), rootUid));
      if (dirCache.get(dir)) looseDirs.add(`${dir} is ${dirCache.get(dir)}`);
      if (dir === top || dir === dirname(dir)) break;
    }
    return { path, expected, actual, exists: own.exists, file: own.file === true, loose: own.exists && !own.error ? looseness(own, rootUid) : null, error };
  });
  const listed = new Set(files.map((f) => realOrNull(join(root, f.path))).filter(Boolean));

  const tool = (name) => {
    const found = which(root, name, env.PATH);
    const real = found && realOrNull(found);
    return { found, real, listed: Boolean(real && listed.has(real)), version: found ? sys.version(found) : null };
  };
  const node = tool('node');
  const execReal = realOrNull(join(root, sys.execPath()));
  const pnpm = tool('pnpm');

  const browsersVariable = (env.PLAYWRIGHT_BROWSERS_PATH ?? '').trim().replace(/\/+$/, '');
  const browsersFiles = browsersVariable ? files.filter((f) => f.path.startsWith(`${browsersVariable}/`)) : [];
  const browsers = {
    path: browsersVariable || null,
    loose: browsersVariable ? looseness(ownership(join(root, browsersVariable)), rootUid) : null,
    files: browsersFiles.length,
    builds: [...new Set(browsersFiles.map((f) => f.path.slice(browsersVariable.length + 1).split('/')[0]))].sort(),
  };

  const groupText = read(join(root, 'etc/group'));
  const uid = sys.uid();
  const name = sys.user();
  let groups = null;
  if (groupText !== null) {
    const gids = new Set(sys.gids());
    groups = groupText
      .split('\n')
      .map((line) => line.split(':'))
      .filter(([group, , gid, members]) => group && (gids.has(Number(gid)) || (name && (members ?? '').split(',').includes(name))))
      .map(([group]) => group)
      .sort();
  }

  return {
    manifest: { exists: manifest.exists, error: manifest.error ?? manifest.parseError ?? null, file: manifest.file === true, loose: manifest.exists ? looseness(manifest, rootUid) : null, entries: files.length },
    files,
    looseDirs: [...looseDirs].sort(),
    node: { ...node, runsThisScript: Boolean(execReal && listed.has(execReal)) },
    pnpm,
    browsers,
    user: { uid, name, groups },
    sudo: sys.sudo(),
  };
}

/** Why the toolchain or the job's user is not the provisioned one; empty when it is. */
export function toolchainProblems(t) {
  const problems = [];
  const m = t.manifest;
  if (!m.exists) problems.push(`no toolchain manifest at /${TOOLCHAIN}`);
  else if (m.error) problems.push(`/${TOOLCHAIN} can't be read (${m.error})`);
  else if (!m.file) problems.push(`/${TOOLCHAIN} is not a regular file`);
  else {
    if (m.loose) problems.push(`/${TOOLCHAIN} is ${m.loose}`);
    if (m.entries === 0) problems.push(`/${TOOLCHAIN} lists no files`);
  }
  for (const f of t.files) {
    if (!f.exists) problems.push(`${f.path} is listed in the toolchain manifest but missing`);
    else if (f.error) problems.push(`${f.path} can't be read (${f.error})`);
    else if (!f.file) problems.push(`${f.path} is not a regular file`);
    else {
      if (f.loose) problems.push(`${f.path} is ${f.loose}`);
      if (f.actual !== f.expected) problems.push(`${f.path} does not match its sha256 in the toolchain manifest`);
    }
  }
  for (const d of t.looseDirs) problems.push(`a directory holding listed toolchain files: ${d}`);
  for (const [name, tool] of [['node', t.node], ['pnpm', t.pnpm]]) {
    if (!tool.found) problems.push(`${name} is not on PATH`);
    else if (!tool.listed) problems.push(`the ${name} on PATH (${tool.real ?? tool.found}) is not a listed toolchain file`);
  }
  if (!t.node.runsThisScript) problems.push('the node running this check is not a listed toolchain file');
  if (!t.browsers.path) problems.push('PLAYWRIGHT_BROWSERS_PATH is not set, so the Playwright Chromium can\'t be checked');
  else {
    if (t.browsers.loose) problems.push(`PLAYWRIGHT_BROWSERS_PATH (${t.browsers.path}) is ${t.browsers.loose}`);
    if (t.browsers.files === 0) problems.push(`the toolchain manifest lists no file under PLAYWRIGHT_BROWSERS_PATH (${t.browsers.path})`);
  }
  if (t.user.uid === null) problems.push('the job\'s user id can\'t be read');
  else if (t.user.uid === 0) problems.push('the job runs as root');
  if (t.user.groups === null) problems.push('/etc/group can\'t be read, so the job\'s groups can\'t be checked');
  else {
    const privileged = t.user.groups.filter((g) => PRIVILEGED_GROUPS.includes(g));
    if (privileged.length) problems.push(`the job's user ${t.user.name ?? `uid ${t.user.uid}`} is in ${privileged.join(', ')}`);
  }
  if (t.sudo === 'allowed') problems.push('sudo -n true succeeds: the job\'s user can become root');
  else if (t.sudo !== 'refused') problems.push(`can't tell whether the job's user can use sudo: ${t.sudo}`);
  return problems;
}

/** The toolchain as recorded: versions, counts and what is wrong, not every file. */
const summarizeToolchain = (t) => ({
  manifestEntries: t.manifest.entries,
  node: { path: t.node.real ?? t.node.found, version: t.node.version },
  pnpm: { path: t.pnpm.real ?? t.pnpm.found, version: t.pnpm.version },
  chromium: { browsersPath: t.browsers.path, builds: t.browsers.builds, files: t.browsers.files },
  user: t.user,
  sudo: t.sudo,
});

// ------------------------------------------------------------------ browsers

/**
 * `name`'s package.json as Node finds it from `fromDir`: node_modules/<name> in
 * that directory or an ancestor, real path. Unlike require.resolve, never
 * NODE_PATH or a global folder, so only what this package can see counts.
 */
function findPackage(fromDir, name) {
  for (let dir = fromDir; ; dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', name, 'package.json');
    if (existsSync(candidate)) return realpathSync(candidate);
    if (dir === dirname(dir)) return null;
  }
}

/**
 * The revision of `browser` the Playwright lock pins: playwright-core's
 * browsers.json, found from the bench package along the chain Playwright
 * loads (bench → @playwright/test → playwright → playwright-core). { error }
 * when it can't be read.
 */
export function pinnedBrowser({ benchDir = BENCH_DIR, browser = HARNESS_BROWSER } = {}) {
  try {
    let from = resolve(benchDir);
    let found = null;
    for (const name of ['@playwright/test', 'playwright', 'playwright-core']) {
      found = findPackage(from, name);
      if (!found) return { error: `${name} is not installed where ${from} can load it` };
      from = dirname(found);
    }
    const core = JSON.parse(readFileSync(found, 'utf8'));
    const browsersJson = join(from, 'browsers.json');
    const descriptor = JSON.parse(readFileSync(browsersJson, 'utf8')).browsers?.find((b) => b.name === browser);
    if (!descriptor) return { error: `${browsersJson} lists no ${browser}` };
    if (!/^\d+$/.test(String(descriptor.revision))) return { error: `${browsersJson} gives ${browser} no numeric revision` };
    const linuxOverrides = Object.keys(descriptor.revisionOverrides ?? {}).filter((platform) => /^(?:ubuntu|debian)/.test(platform));
    if (linuxOverrides.length) return { error: `${browsersJson} overrides the ${browser} revision on ${linuxOverrides.join(', ')}, which this check does not resolve` };
    return { browser, revision: String(descriptor.revision), browserVersion: descriptor.browserVersion ?? null, playwrightCore: core.version ?? null, browsersJson };
  } catch (error) {
    return { error: String(error.message ?? error).split('\n')[0] };
  }
}

/**
 * The browser check (--browsers): on the gate runner, PLAYWRIGHT_BROWSERS_PATH
 * must hold <browser>-<the revision the lock pins>, with files the toolchain
 * manifest lists. Off it, it only reports.
 */
export function checkBrowsers({ root = '/', env = process.env, rootUid = 0, benchDir = BENCH_DIR, now = Date.now } = {}) {
  const identity = readIdentity({ root, env, rootUid });
  const enforced = isEnforced(identity);
  const pinned = pinnedBrowser({ benchDir });
  const name = HARNESS_BROWSER;
  const browsersPath = (env.PLAYWRIGHT_BROWSERS_PATH ?? '').trim().replace(/\/+$/, '') || null;
  let installed = [];
  let listError = null;
  if (browsersPath) {
    try {
      installed = readdirSync(join(root, browsersPath))
        .map((d) => d.match(new RegExp(`^${name}-(\\d+)$`))?.[1])
        .filter(Boolean)
        .sort((a, b) => Number(a) - Number(b));
    } catch (error) {
      listError = error.code ?? error.message;
    }
  }
  const problems = [];
  const pins = pinned.error ? null : `the Playwright lock pins ${name} ${pinned.revision} (playwright-core ${pinned.playwrightCore})`;
  if (pinned.error) problems.push(`the ${name} revision the Playwright lock pins can't be read: ${pinned.error}`);
  if (!browsersPath) problems.push('PLAYWRIGHT_BROWSERS_PATH is not set, so the preinstalled Chromium can\'t be found');
  else if (listError) problems.push(`${browsersPath} can't be read (${listError})`);
  else if (pins && !installed.includes(pinned.revision)) {
    problems.push(`${pins}, but ${browsersPath} holds ${installed.length ? `${name} ${installed.join(', ')}` : `no ${name} build`}`);
  } else if (pins) {
    const manifest = readManifest(root);
    const prefix = `${browsersPath}/${name}-${pinned.revision}/`;
    if (manifest.error) problems.push(`the toolchain manifest can't be read (${manifest.error})`);
    else if (!manifest.entries.some((e) => e.path.startsWith(prefix))) problems.push(`the toolchain manifest lists no file under ${prefix}`);
  }
  return {
    phase: 'browsers',
    at: new Date(now()).toISOString(),
    enforced,
    onGateRunner: isOnGateRunner(identity),
    browser: name,
    pinned,
    browsersPath,
    installed,
    problems: enforced ? problems : [],
    findings: problems,
  };
}

// ---------------------------------------------------------------------- host

function readBoost(cpuDir) {
  const policyDir = join(cpuDir, 'cpufreq');
  const policies = existsSync(policyDir) ? readdirSync(policyDir).filter((d) => /^policy\d+$/.test(d)).sort(byNumber) : [];
  const perPolicy = Object.fromEntries(policies.map((p) => [p, read(join(policyDir, p, 'boost'))]));
  const global = read(join(policyDir, 'boost'));
  const noTurbo = read(join(cpuDir, 'intel_pstate/no_turbo'));
  const amdPstate = read(join(cpuDir, 'amd_pstate/status'));
  const base = { boostPolicies: null, amdPstate };
  const readable = Object.values(perPolicy).filter((v) => v !== null);
  if (readable.length) {
    const values = [...Object.values(perPolicy), ...(global !== null ? [global] : [])];
    const uniform = new Set(values).size === 1 && onOff(values[0]) !== null;
    return { ...base, boost: uniform ? onOff(values[0]) : 'mixed', boostSource: 'cpufreq/policy*/boost', boostPolicies: perPolicy, boostGlobal: global };
  }
  if (global !== null) return { ...base, boost: onOff(global) ?? 'unknown', boostSource: 'cpufreq/boost' };
  if (noTurbo !== null) return { ...base, boost: noTurbo === '1' ? 'off' : noTurbo === '0' ? 'on' : 'unknown', boostSource: 'intel_pstate/no_turbo' };
  return { ...base, boost: 'unknown', boostSource: null };
}

function readCpuinfo(root) {
  const text = read(join(root, 'proc/cpuinfo')) ?? '';
  const values = (key) => [...text.matchAll(new RegExp(`^${key}\\s*:\\s*(.*)$`, 'gm'))].map((m) => m[1].trim());
  return {
    cpuVendors: [...new Set(values('vendor_id'))].sort(),
    hypervisorFlag: values('flags').some((flags) => flags.split(/\s+/).includes('hypervisor')),
  };
}

/** The process's ancestors (itself included), from /proc/<pid>/stat, or null when they can't be read. */
function ancestry(procDir, selfPid) {
  const chain = new Set();
  for (let pid = selfPid; pid > 0 && !chain.has(pid); ) {
    const stat = read(join(procDir, String(pid), 'stat'));
    if (stat === null) return chain.size ? chain : null;
    chain.add(pid);
    pid = Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1]);
  }
  return chain;
}

/**
 * What runs on the host: the load average, the runner processes, and whether
 * /proc shows the whole host. `ownWorker` names this job's Runner.Worker when
 * the caller is not under it (the sampler, which outlives the --pre step).
 */
export function readActivity(root = '/', { selfPid = process.pid, ownWorker = null } = {}) {
  const procDir = join(root, 'proc');
  const loadavg = (read(join(procDir, 'loadavg')) ?? '').split(/\s+/).slice(0, 3).map(Number);
  const own = ancestry(procDir, selfPid);
  const pids = existsSync(procDir) ? readdirSync(procDir).filter((d) => /^\d+$/.test(d)).map(Number).sort((a, b) => a - b) : [];
  const named = (comm) => pids.filter((pid) => read(join(procDir, String(pid), 'comm')) === comm);
  const workers = named(WORKER);
  const mine = (pid) => pid === ownWorker || Boolean(own?.has(pid));
  return {
    load: loadavg.length === 3 && loadavg.every(Number.isFinite) ? { one: loadavg[0], five: loadavg[1], fifteen: loadavg[2] } : null,
    initReadable: read(join(procDir, '1/stat')) !== null,
    processTreeReadable: own !== null,
    ownWorker: workers.find(mine) ?? null,
    otherWorkers: workers.filter((pid) => !mine(pid)),
    listeners: named(LISTENER),
  };
}

/** What the host reports, read under `root` (a fake tree in tests). */
export function readHost(root = '/', { selfPid = process.pid, system = {} } = {}) {
  const cpuDir = join(root, 'sys/devices/system/cpu');
  const cpus = existsSync(cpuDir) ? readdirSync(cpuDir).filter((d) => /^cpu\d+$/.test(d)) : [];
  const governors = cpus.map((cpu) => read(join(cpuDir, cpu, 'cpufreq/scaling_governor')));
  const swapsText = read(join(root, 'proc/swaps')) ?? '';
  const swapDevices = swapsText.split('\n').slice(1).map((l) => l.trim()).filter(Boolean).map((l) => l.split(/\s+/)[0]);
  const meminfo = read(join(root, 'proc/meminfo')) ?? '';
  const kb = (key) => Number(meminfo.match(new RegExp(`^${key}:\\s+(\\d+)`, 'm'))?.[1] ?? NaN);
  return {
    cpus: cpus.length,
    governors,
    swapDevices,
    swapTotalKb: kb('SwapTotal'),
    swapFreeKb: kb('SwapFree'),
    ...readBoost(cpuDir),
    ...readCpuinfo(root),
    virt: systemOf(system).detectVirt(),
    ...readActivity(root, { selfPid }),
  };
}

/** Why this host must not run gates (bare metal, governor, boost, swap); empty when it may. */
export function hostProblems(host) {
  const problems = [];
  if (host.cpuVendors.length === 0) problems.push('the CPU vendor can\'t be read from /proc/cpuinfo');
  else if (host.cpuVendors.some((v) => v !== AMD)) problems.push(`the CPU vendor is ${host.cpuVendors.join(', ')}, not ${AMD} (the gate runner is an AMD AX42)`);
  if (host.hypervisorFlag) problems.push('the CPU reports the hypervisor flag: this is a virtual machine, not the gate runner\'s bare metal');
  if (host.virt === null) problems.push('systemd-detect-virt can\'t be run, so virtualization can\'t be ruled out');
  else if (host.virt !== 'none') problems.push(`systemd-detect-virt reports ${host.virt}, not none: this is not the gate runner's bare metal`);
  if (host.cpus === 0 || host.governors.length === 0) problems.push('no CPUs found under /sys/devices/system/cpu');
  const unreadable = host.governors.filter((g) => g === null).length;
  if (unreadable) problems.push(`the frequency governor can't be read on ${unreadable} of ${host.governors.length} CPU(s)`);
  const off = host.governors.filter((g) => g !== null && g !== 'performance');
  if (off.length) problems.push(`${off.length} CPU(s) are not on the performance governor (${[...new Set(off)].join(', ')})`);
  if (host.boost === 'unknown') {
    const amd = host.amdPstate ? `; amd_pstate is ${host.amdPstate}` : '';
    problems.push(`boost can't be read (no cpufreq/policy*/boost or cpufreq/boost${amd}), so it can't be held fixed or recorded with the baseline`);
  } else if (host.boost === 'mixed') {
    const values = Object.entries(host.boostPolicies ?? {}).map(([p, v]) => `${p}=${v ?? 'unreadable'}`);
    if (host.boostGlobal != null) values.push(`cpufreq/boost=${host.boostGlobal}`);
    problems.push(`boost is not the same on every CPU policy (${values.join(', ')})`);
  } else if (host.boostSource === 'intel_pstate/no_turbo') {
    problems.push('boost is known only from intel_pstate/no_turbo; the AMD gate runner must expose cpufreq/policy*/boost or cpufreq/boost');
  }
  if (!Number.isFinite(host.swapTotalKb) || !Number.isFinite(host.swapFreeKb)) problems.push('swap use can\'t be read from /proc/meminfo');
  else if (host.swapTotalKb - host.swapFreeKb > 0) problems.push(`${host.swapTotalKb - host.swapFreeKb} kB of swap is in use`);
  if (host.swapDevices.length) problems.push(`swap is enabled (${host.swapDevices.join(', ')}); run swapoff -a and remove it from /etc/fstab`);
  return problems;
}

/** Why this host is not one quiet runner: what /proc can't show, other runners and jobs, and (before the gates) the load average. */
export function quietProblems(host) {
  const others = [];
  if (!host.initReadable) others.push('/proc/1/stat can\'t be read (hidepid or a PID namespace), so the host\'s processes can\'t be seen');
  if (!host.processTreeReadable) others.push('this job\'s process tree can\'t be read from /proc, so other jobs can\'t be ruled out');
  else if (host.ownWorker === null) others.push(`this process does not run under a ${WORKER}`);
  if (host.listeners.length !== 1) others.push(`expected exactly one runner on this host, found ${host.listeners.length} ${LISTENER} process(es)${host.listeners.length ? ` (pid ${host.listeners.join(', ')})` : ''}`);
  if (host.otherWorkers.length) others.push(`another job is running on this host (${WORKER} pid ${host.otherWorkers.join(', ')})`);
  const limit = LOAD_FACTOR * host.cpus;
  const busy = !host.load
    ? 'the load average can\'t be read from /proc/loadavg'
    : host.load.one < limit
      ? null
      : `the 1-minute load average is ${host.load.one}, not below ${LOAD_FACTOR} × ${host.cpus} CPUs = ${limit}`;
  return { others, busy };
}

/** The host as recorded: one entry per distinct governor, and swap in use. */
function summarize(host) {
  const { governors, swapTotalKb, swapFreeKb, ...rest } = host;
  return {
    ...rest,
    governors: [...new Set(governors.map((g) => g ?? 'unreadable'))].sort(),
    swapTotalKb: Number.isFinite(swapTotalKb) ? swapTotalKb : null,
    swapUsedKb: Number.isFinite(swapTotalKb) && Number.isFinite(swapFreeKb) ? swapTotalKb - swapFreeKb : null,
  };
}

// ------------------------------------------------------------------- sampler

/** The sampler's record before its first sample. */
export const newSamples = ({ pid, ownWorker, at }) => ({
  pid,
  ownWorker,
  intervalMs: SAMPLE_INTERVAL_MS,
  startedAt: at,
  lastAt: null,
  samples: 0,
  maxLoad: null,
  otherWorkers: [],
  listenerCounts: [],
  initUnreadable: 0,
});

/** Folds one readActivity() reading into the sampler's record. The load is recorded, never judged. */
export function addSample(state, activity, at) {
  const next = { ...state, samples: state.samples + 1, lastAt: at };
  if (activity.load && (!state.maxLoad || activity.load.one > state.maxLoad.one)) next.maxLoad = { one: activity.load.one, at };
  const seen = new Set(state.otherWorkers.map((w) => w.pid));
  next.otherWorkers = [...state.otherWorkers, ...activity.otherWorkers.filter((pid) => !seen.has(pid)).map((pid) => ({ pid, at }))];
  if (!state.listenerCounts.includes(activity.listeners.length)) next.listenerCounts = [...state.listenerCounts, activity.listeners.length].sort((a, b) => a - b);
  if (!activity.initReadable) next.initUnreadable = state.initUnreadable + 1;
  return next;
}

/** Why the sampler's record shows the host was not one runner running only this job for the whole run; empty when it was. */
export function samplerProblems(samples, { at }) {
  if (!samples) return [`there is no sampler record (${SAMPLES_FILE}), so the host was not watched during the run`];
  if (samples.error) return [`the sampler record can't be read (${samples.error})`];
  if (!(samples.samples > 0) || !samples.lastAt) return ['the sampler took no samples during the run'];
  const problems = [];
  const gapMs = Date.parse(at) - Date.parse(samples.lastAt);
  if (!(gapMs <= 3 * samples.intervalMs + 5_000)) problems.push(`the sampler's last sample was ${Math.round(gapMs / 1000)} s before the re-check, so the end of the run was not watched`);
  if (samples.otherWorkers.length) problems.push(`another job ran on this host during the run (${WORKER} pid ${samples.otherWorkers.map((w) => `${w.pid} at ${w.at}`).join(', ')})`);
  if (samples.listenerCounts.some((n) => n !== 1)) problems.push(`the host did not have exactly one runner throughout the run (${LISTENER} counts seen: ${samples.listenerCounts.join(', ')})`);
  if (samples.initUnreadable) problems.push(`/proc/1/stat could not be read in ${samples.initUnreadable} sample(s)`);
  return problems;
}

/** Synchronous sleep, so the CLI stays a plain script. */
const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/** Written whole or not at all, so --post never reads a half-written sample. */
function writeAtomic(path, value) {
  writeFileSync(`${path}.tmp`, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(`${path}.tmp`, path);
}

/** The sampler's loop (`--sample`): runs until --post stops it, or the job ends. */
function sampleForever(dir, ownWorker) {
  let state = newSamples({ pid: process.pid, ownWorker, at: new Date().toISOString() });
  for (;;) {
    state = addSample(state, readActivity('/', { ownWorker }), new Date().toISOString());
    writeAtomic(join(dir, SAMPLES_FILE), state);
    sleepSync(SAMPLE_INTERVAL_MS);
  }
}

function startSampler(dir, ownWorker) {
  const script = fileURLToPath(import.meta.url);
  const child = spawn(process.execPath, [script, '--sample', '--dir', dir, '--own-worker', String(ownWorker)], { detached: true, stdio: 'ignore' });
  child.unref();
  return child.pid ?? null;
}

/** Stops the sampler --pre started, if /proc still shows it as that sampler. */
function stopSampler(pid) {
  if (!pid) return;
  const cmdline = read(join('/proc', String(pid), 'cmdline')) ?? '';
  if (!cmdline.includes('gate-host.mjs') || !cmdline.includes('--sample')) return;
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    // Already gone: its record's last sample shows when it stopped.
  }
}

// ------------------------------------------------------------- pre and post

/** One pass of the identity and host checks (no toolchain); the preflight repeats it while the load settles. */
export function checkPre({ root = '/', env = process.env, selfPid = process.pid, rootUid = 0, system = {}, now = Date.now } = {}) {
  const identity = readIdentity({ root, env, rootUid });
  const host = readHost(root, { selfPid, system });
  const enforced = isEnforced(identity);
  const quiet = quietProblems(host);
  const problems = enforced ? [...identityProblems(identity), ...hostProblems(host), ...quiet.others, ...(quiet.busy ? [quiet.busy] : [])] : [];
  return {
    phase: 'pre',
    at: new Date(now()).toISOString(),
    enforced,
    onGateRunner: isOnGateRunner(identity),
    identity,
    host: summarize(host),
    problems,
    waitingOnLoad: enforced && quiet.busy !== null && problems.length === 1,
  };
}

/**
 * The $GITHUB_ENV line that tells the bench harness this job is on the gate
 * runner: the runner's name only for a preflight that held every gate
 * condition on the provisioned gate runner, and empty otherwise, so a value an
 * earlier step set never survives the preflight.
 */
export function gateHostEnvLine(record) {
  const name = record?.identity?.runnerName;
  const passed = record?.enforced && record.onGateRunner && record.problems.length === 0 && name && !/[\r\n=]/.test(name);
  return `${GATE_HOST_ENV}=${passed ? name : ''}\n`;
}

/**
 * The preflight: checks identity and host once, and while the load average is
 * the only problem, again every `intervalMs` for up to `settleMs`; then checks
 * the toolchain and the job's user once. The loads it saw are recorded.
 */
export function preflight({ settleMs = 0, intervalMs = 10_000, sleep = sleepSync, log = () => {}, now = Date.now, ...options } = {}) {
  const start = now();
  const loads = [];
  let record;
  for (;;) {
    const { waitingOnLoad, ...checked } = checkPre({ ...options, now });
    record = checked;
    loads.push(record.host.load?.one ?? null);
    const waited = now() - start;
    if (!waitingOnLoad || waited >= settleMs) {
      record.settle = { waitedMs: waited, loads };
      break;
    }
    log(`waiting for the host to settle: ${record.problems[0]} (${Math.ceil((settleMs - waited) / 1000)} s left)`);
    sleep(Math.min(intervalMs, settleMs - waited));
  }
  const toolchain = readToolchain({ root: options.root, env: options.env, rootUid: options.rootUid, system: options.system });
  record.toolchain = summarizeToolchain(toolchain);
  if (record.enforced) record.problems.push(...toolchainProblems(toolchain));
  return record;
}

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    return { error: error.message };
  }
}

const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);

const swapText = (h) => `${h.swapDevices?.length ? h.swapDevices.join(', ') : 'no swap device'}, ${h.swapUsedKb ?? 'unknown'} kB in use`;

/** What changed on the host between the pre-run record and now. */
export function hostChanges(before, after) {
  const changes = [];
  const compare = (what, a, b) => {
    if (a !== b) changes.push(`${what} changed during the run: ${a} → ${b}`);
  };
  compare('the runner', before.identity?.runnerName ?? 'none', after.identity.runnerName ?? 'none');
  compare('the gate-runner marker', before.identity?.marker?.name ?? 'none', after.identity.marker?.name ?? 'none');
  compare('the governor', (before.host?.governors ?? []).join('/') || 'none', after.host.governors.join('/') || 'none');
  compare('boost', before.host?.boost ?? 'unrecorded', after.host.boost);
  compare('the amd-pstate mode', before.host?.amdPstate ?? 'none', after.host.amdPstate ?? 'none');
  compare('swap', swapText(before.host ?? {}), swapText(after.host));
  return changes;
}

const NOT_RESULTS = new Set([PRE_FILE, POST_FILE, SAMPLES_FILE, BROWSERS_FILE]);

/** Adds `invalid` to every results file in `dir` (every *.json but the gate-host records). */
export function markResultsInvalid(dir, invalid) {
  const marked = [];
  const unmarked = [];
  for (const name of existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json') && !NOT_RESULTS.has(f)).sort() : []) {
    const path = join(dir, name);
    let value;
    try {
      value = JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      value = null;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      writeJson(path, { ...value, invalid });
      marked.push(name);
    } else unmarked.push(name);
  }
  return { marked, unmarked };
}

/**
 * The re-check after the gates. Stops the sampler, writes
 * <dir>/gate-host-post.json and, when the run is invalid, marks every results
 * file in <dir>. Returns the record. Loads are recorded, not judged.
 */
export function recheck({ dir, root = '/', env = process.env, selfPid = process.pid, rootUid = 0, system = {}, now = Date.now, stop = stopSampler } = {}) {
  const pre = readJson(join(dir, PRE_FILE));
  const browsers = readJson(join(dir, BROWSERS_FILE));
  if (pre && !pre.error) stop(pre.sampler?.pid);
  const samples = readJson(join(dir, SAMPLES_FILE));
  const identity = readIdentity({ root, env, rootUid });
  const host = readHost(root, { selfPid, system });
  const at = new Date(now()).toISOString();
  const enforced = pre?.enforced === true || isEnforced(identity);
  const problems = enforced ? [...identityProblems(identity, true), ...hostProblems(host), ...quietProblems(host).others] : [];
  const during = enforced ? samplerProblems(samples, { at }) : [];
  const after = { identity, host: summarize(host) };
  const reasons = [];
  if (!pre) reasons.push(`there is no pre-run record (${PRE_FILE}), so the host was not checked before the gates`);
  else if (pre.error) reasons.push(`the pre-run record can't be read (${pre.error})`);
  else {
    if (pre.problems?.length) reasons.push(`the preflight failed: ${pre.problems.join('; ')}`);
    reasons.push(...hostChanges(pre, after));
  }
  if (enforced) {
    if (!browsers) reasons.push(`the browser check (--browsers) did not run (${BROWSERS_FILE}), so the Chromium build was not checked against the Playwright lock`);
    else if (browsers.error) reasons.push(`the browser check record can't be read (${browsers.error})`);
    else if (browsers.enforced !== true || browsers.problems?.length !== 0) reasons.push(`the browser check failed: ${(browsers.problems ?? ['it was only reported']).join('; ') || 'it was only reported'}`);
  }
  if (problems.length) reasons.push(`the post-run check failed: ${problems.join('; ')}`);
  if (during.length) reasons.push(`the sampler saw: ${during.join('; ')}`);
  const invalid = enforced && reasons.length ? { reason: reasons.join('; '), at, by: 'ci/gate-host.mjs --post' } : null;
  const record = {
    phase: 'post',
    at,
    enforced,
    onGateRunner: isOnGateRunner(identity),
    ...after,
    load: { start: pre?.host?.load ?? null, peak: samples?.maxLoad ?? null, end: after.host.load },
    browser: browsers && !browsers.error ? { name: browsers.browser, revision: browsers.pinned?.revision ?? null, installed: browsers.installed } : null,
    sampler: samples && !samples.error ? { samples: samples.samples, lastAt: samples.lastAt, otherWorkers: samples.otherWorkers, listenerCounts: samples.listenerCounts } : null,
    problems,
    findings: reasons,
    invalid,
  };
  mkdirSync(dir, { recursive: true });
  if (invalid) record.results = markResultsInvalid(dir, invalid);
  writeJson(join(dir, POST_FILE), record);
  return record;
}

// ---------------------------------------------------------------------- main

function main(argv) {
  const option = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
  const mode = ['--pre', '--browsers', '--post', '--sample'].find((m) => argv.includes(m))?.slice(2) ?? null;
  if (!mode) {
    console.error('usage: node ci/gate-host.mjs --pre [--dir bench/out] [--settle 180] | --browsers [--dir bench/out] | --post [--dir bench/out]');
    process.exit(2);
  }
  const dir = option('--dir', 'bench/out');
  if (mode === 'sample') return sampleForever(dir, Number(option('--own-worker', '0')) || null);

  const describe = (r) =>
    `${r.host.cpus} CPU(s) (${r.host.cpuVendors.join('/') || 'vendor unknown'}${r.host.hypervisorFlag ? ', hypervisor' : ''}, virt ${r.host.virt ?? 'unknown'}), ` +
    `governor ${r.host.governors.join('/') || 'unknown'}, boost ${r.host.boost}${r.host.boostSource ? ` (${r.host.boostSource})` : ''}` +
    `${r.host.amdPstate ? `, amd_pstate ${r.host.amdPstate}` : ''}, swap ${r.host.swapDevices.length ? r.host.swapDevices.join(', ') : 'off'}, load ${r.host.load?.one ?? 'unknown'}`;

  if (mode === 'pre') {
    // Before anything else: whatever an earlier step put in SIGNAL_TREE_GATE_HOST is cleared.
    if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, gateHostEnvLine(null));
    const record = preflight({ settleMs: Number(option('--settle', '180')) * 1000, log: console.log });
    mkdirSync(dir, { recursive: true });
    const passed = record.enforced && record.problems.length === 0;
    if (passed) record.sampler = { pid: startSampler(dir, record.host.ownWorker), intervalMs: SAMPLE_INTERVAL_MS };
    writeJson(join(dir, PRE_FILE), record);
    const t = record.toolchain;
    console.log(`gate host: ${describe(record)}`);
    console.log(`toolchain: node ${t.node.version ?? 'unknown'} (${t.node.path ?? 'not on PATH'}), pnpm ${t.pnpm.version ?? 'unknown'}, chromium ${t.chromium.builds.join(', ') || 'unlisted'}; user ${t.user.name ?? t.user.uid}, sudo ${t.sudo}`);
    if (!record.enforced) {
      console.log('not a gate-runner job and no gate-runner marker: reported only');
      return 0;
    }
    for (const p of record.problems) console.log(`FAIL ${p}`);
    if (!passed) {
      console.log('This run must not record or judge gates (#18).');
      return 1;
    }
    if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, gateHostEnvLine(record));
    console.log(`ok: gate runner ${record.identity.runnerName} may record and judge gates; ${GATE_HOST_ENV} set for the harness; sampler pid ${record.sampler.pid}`);
    return 0;
  }

  if (mode === 'browsers') {
    const record = checkBrowsers();
    mkdirSync(dir, { recursive: true });
    writeJson(join(dir, BROWSERS_FILE), record);
    const pinned = record.pinned.error ? `unreadable (${record.pinned.error})` : `${record.browser} ${record.pinned.revision} (${record.pinned.browserVersion}, playwright-core ${record.pinned.playwrightCore})`;
    console.log(`Playwright lock pins ${pinned}; ${record.browsersPath ?? 'PLAYWRIGHT_BROWSERS_PATH unset'} holds ${record.browser} ${record.installed.join(', ') || 'none'}`);
    if (!record.enforced) {
      for (const f of record.findings) console.log(`note: ${f}`);
      console.log('not a gate-runner job and no gate-runner marker: reported only');
      return 0;
    }
    for (const p of record.problems) console.log(`FAIL ${p}`);
    if (record.problems.length) {
      console.log('The gate runner\'s Chromium must be the build the Playwright lock pins (#85).');
      return 1;
    }
    console.log(`ok: the preinstalled ${record.browser} ${record.pinned.revision} is the one the lock pins`);
    return 0;
  }

  const record = recheck({ dir });
  const loads = record.load;
  console.log(`gate host after the gates: ${describe(record)}; load ${loads.start?.one ?? 'unknown'} at the start, peak ${loads.peak?.one ?? 'unknown'}, ${loads.end?.one ?? 'unknown'} at the end (recorded, not judged)`);
  if (!record.enforced) {
    for (const f of record.findings) console.log(`note: ${f}`);
    console.log('not a gate-runner job and no gate-runner marker: reported only');
    return 0;
  }
  if (!record.invalid) {
    console.log('ok: the host held the gate conditions for the whole run');
    return 0;
  }
  for (const f of record.findings) console.log(`INVALID ${f}`);
  console.log(`Marked invalid: ${record.results.marked.join(', ') || 'no results files'}${record.results.unmarked.length ? `; could not mark ${record.results.unmarked.join(', ')}` : ''}.`);
  console.log('These results count as unmet and never become a baseline.');
  return 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv.slice(2)));
