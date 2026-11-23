// Gate-host preflight and re-check (#18; Jonathan's gate conditions and his
// review of PR #85).
//
// Identity. A job is aimed at the gate runner when its workflow passes the
// repository variable through, `env: SIGNAL_TREE_GATES_RUNNER:
// ${{ vars.SIGNAL_TREE_GATES_RUNNER }}`: the same value its runs-on reads, so
// it is set exactly when runs-on names the self-hosted labels. Such a job must
// name the dedicated label `signal-tree-gates`, and the host must carry the
// provisioning marker /etc/signal-tree/gate-runner: a regular file owned by
// root, writable by nobody else, containing exactly this runner's RUNNER_NAME.
// A missing, foreign-owned or mismatched marker fails the job. The agent VM is
// never given the marker and its users cannot write /etc, and runner names are
// unique within the repository, so no other machine passes as the gate runner.
// A host that carries a marker is held to the gate conditions whatever the job
// says. Any other job (the GitHub-hosted fallback while the variable is unset)
// only reports.
//
// Gate conditions on the gate runner:
//   - every CPU on the performance governor;
//   - boost readable and uniform: per-policy cpufreq/policy*/boost (amd-pstate;
//     the AX42 is AMD), else cpufreq/boost, else intel_pstate/no_turbo. Unknown
//     boost, or policies that disagree, fail;
//   - no swap enabled and none in use;
//   - quiet host, before the gates only: no Runner.Worker process other than
//     this job's own (so no other runner on the machine is running a job), and
//     the 1-minute load average below 0.5 × logical CPUs. The job's own install
//     and self-test steps raise the load, so --pre waits up to --settle seconds
//     for it to fall before failing. Runner.Worker only shows jobs of runners in
//     this PID namespace; anything else shows only in the load average.
//
//   node ci/gate-host.mjs --pre  [--dir bench/out] [--settle 180]
//     Writes <dir>/gate-host.json; exits 1 when the gate runner fails a condition.
//   node ci/gate-host.mjs --post [--dir bench/out]
//     Runs with if: always(), after the gates and before the upload. Re-reads
//     the host and writes <dir>/gate-host-post.json with the start and end load.
//     When the pre-run record is missing or failed, this check fails, or the
//     runner, governor, boost, amd-pstate mode or swap changed, it records
//     `invalid: { reason, at }` there and in every results file in <dir>, and
//     exits 1. ci/done-check.mjs counts such results unmet, and
//     ci/gate-baseline.mjs never compares with them.
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const MARKER = 'etc/signal-tree/gate-runner';
export const GATE_LABEL = 'signal-tree-gates';
export const PRE_FILE = 'gate-host.json';
export const POST_FILE = 'gate-host-post.json';
/** The quiet-host bound: the 1-minute load average must be below this × logical CPUs. */
export const LOAD_FACTOR = 0.5;
const WORKER = 'Runner.Worker';

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
  return { gateJob: variable !== '', variable, labels: labelsOf(variable), runnerName: (env.RUNNER_NAME ?? '').trim() || null, marker, rootUid };
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

/** Whether this host is the provisioned gate runner: a valid marker naming this runner. */
export const isOnGateRunner = (identity) => identity.marker !== null && identityProblems(identity).length === 0;

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

function readWorkers(procDir, selfPid) {
  const own = ancestry(procDir, selfPid);
  if (!own) return { processTreeReadable: false, otherWorkers: [] };
  const pids = existsSync(procDir) ? readdirSync(procDir).filter((d) => /^\d+$/.test(d)).map(Number) : [];
  const workers = pids.filter((pid) => read(join(procDir, String(pid), 'comm')) === WORKER);
  return { processTreeReadable: true, ownWorker: workers.find((pid) => own.has(pid)) ?? null, otherWorkers: workers.filter((pid) => !own.has(pid)).sort((a, b) => a - b) };
}

/** What the host reports, read under `root` (a fake tree in tests). */
export function readHost(root = '/', { selfPid = process.pid } = {}) {
  const cpuDir = join(root, 'sys/devices/system/cpu');
  const cpus = existsSync(cpuDir) ? readdirSync(cpuDir).filter((d) => /^cpu\d+$/.test(d)) : [];
  const governors = cpus.map((cpu) => read(join(cpuDir, cpu, 'cpufreq/scaling_governor')));
  const swapsText = read(join(root, 'proc/swaps')) ?? '';
  const swapDevices = swapsText.split('\n').slice(1).map((l) => l.trim()).filter(Boolean).map((l) => l.split(/\s+/)[0]);
  const meminfo = read(join(root, 'proc/meminfo')) ?? '';
  const kb = (key) => Number(meminfo.match(new RegExp(`^${key}:\\s+(\\d+)`, 'm'))?.[1] ?? NaN);
  const loadavg = (read(join(root, 'proc/loadavg')) ?? '').split(/\s+/).slice(0, 3).map(Number);
  return {
    cpus: cpus.length,
    governors,
    swapDevices,
    swapTotalKb: kb('SwapTotal'),
    swapFreeKb: kb('SwapFree'),
    ...readBoost(cpuDir),
    load: loadavg.length === 3 && loadavg.every(Number.isFinite) ? { one: loadavg[0], five: loadavg[1], fifteen: loadavg[2] } : null,
    ...readWorkers(join(root, 'proc'), selfPid),
  };
}

/** Why this host must not run gates (governor, boost, swap); empty when it may. */
export function hostProblems(host) {
  const problems = [];
  if (host.cpus === 0 || host.governors.length === 0) problems.push('no CPUs found under /sys/devices/system/cpu');
  const unreadable = host.governors.filter((g) => g === null).length;
  if (unreadable) problems.push(`the frequency governor can't be read on ${unreadable} of ${host.governors.length} CPU(s)`);
  const off = host.governors.filter((g) => g !== null && g !== 'performance');
  if (off.length) problems.push(`${off.length} CPU(s) are not on the performance governor (${[...new Set(off)].join(', ')})`);
  if (host.boost === 'unknown') {
    const amd = host.amdPstate ? `; amd_pstate is ${host.amdPstate}` : '';
    problems.push(`boost can't be read (no cpufreq/policy*/boost, cpufreq/boost or intel_pstate/no_turbo${amd}), so it can't be held fixed or recorded with the baseline`);
  } else if (host.boost === 'mixed') {
    const values = Object.entries(host.boostPolicies ?? {}).map(([p, v]) => `${p}=${v ?? 'unreadable'}`);
    if (host.boostGlobal != null) values.push(`cpufreq/boost=${host.boostGlobal}`);
    problems.push(`boost is not the same on every CPU policy (${values.join(', ')})`);
  }
  if (!Number.isFinite(host.swapTotalKb) || !Number.isFinite(host.swapFreeKb)) problems.push('swap use can\'t be read from /proc/meminfo');
  else if (host.swapTotalKb - host.swapFreeKb > 0) problems.push(`${host.swapTotalKb - host.swapFreeKb} kB of swap is in use`);
  if (host.swapDevices.length) problems.push(`swap is enabled (${host.swapDevices.join(', ')}); run swapoff -a and remove it from /etc/fstab`);
  return problems;
}

/** Why this host is not quiet: another job running, and (before the gates) the load average. */
export function quietProblems(host, { load = true } = {}) {
  const others = [];
  if (!host.processTreeReadable) others.push('this job\'s process tree can\'t be read from /proc, so other jobs can\'t be ruled out');
  if (host.otherWorkers.length) others.push(`another job is running on this host (${WORKER} pid ${host.otherWorkers.join(', ')})`);
  let busy = null;
  if (load) {
    const limit = LOAD_FACTOR * host.cpus;
    if (!host.load) busy = 'the load average can\'t be read from /proc/loadavg';
    else if (!(host.load.one < limit)) busy = `the 1-minute load average is ${host.load.one}, not below ${LOAD_FACTOR} × ${host.cpus} CPUs = ${limit}`;
  }
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

// ------------------------------------------------------------- pre and post

/** One pass of the preflight. */
export function checkPre({ root = '/', env = process.env, selfPid = process.pid, rootUid = 0, now = Date.now } = {}) {
  const identity = readIdentity({ root, env, rootUid });
  const host = readHost(root, { selfPid });
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

/** Synchronous sleep, so the CLI stays a plain script. */
const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/**
 * The preflight: checks once, and while the load average is the only problem,
 * checks again every `intervalMs` for up to `settleMs`. The loads it saw are
 * recorded.
 */
export function preflight({ settleMs = 0, intervalMs = 10_000, sleep = sleepSync, log = () => {}, now = Date.now, ...options } = {}) {
  const start = now();
  const loads = [];
  for (;;) {
    const { waitingOnLoad, ...record } = checkPre({ ...options, now });
    loads.push(record.host.load?.one ?? null);
    const waited = now() - start;
    if (!waitingOnLoad || waited >= settleMs) return { ...record, settle: { waitedMs: waited, loads } };
    log(`waiting for the host to settle: ${record.problems[0]} (${Math.ceil((settleMs - waited) / 1000)} s left)`);
    sleep(Math.min(intervalMs, settleMs - waited));
  }
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

/** Adds `invalid` to every results file in `dir` (every *.json but the two gate-host records). */
export function markResultsInvalid(dir, invalid) {
  const marked = [];
  const unmarked = [];
  for (const name of existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json') && f !== PRE_FILE && f !== POST_FILE).sort() : []) {
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
 * The re-check after the gates. Writes <dir>/gate-host-post.json and, when the
 * run is invalid, marks every results file in <dir>. Returns the record.
 */
export function recheck({ dir, root = '/', env = process.env, selfPid = process.pid, rootUid = 0, now = Date.now } = {}) {
  const pre = readJson(join(dir, PRE_FILE));
  const identity = readIdentity({ root, env, rootUid });
  const host = readHost(root, { selfPid });
  const enforced = pre?.enforced === true || isEnforced(identity);
  const problems = enforced ? [...identityProblems(identity, true), ...hostProblems(host), ...quietProblems(host, { load: false }).others] : [];
  const after = { identity, host: summarize(host) };
  const reasons = [];
  if (!pre) reasons.push(`there is no pre-run record (${PRE_FILE}), so the host was not checked before the gates`);
  else if (pre.error) reasons.push(`the pre-run record can't be read (${pre.error})`);
  else {
    if (pre.problems?.length) reasons.push(`the preflight failed: ${pre.problems.join('; ')}`);
    reasons.push(...hostChanges(pre, after));
  }
  if (problems.length) reasons.push(`the post-run check failed: ${problems.join('; ')}`);
  const at = new Date(now()).toISOString();
  const invalid = enforced && reasons.length ? { reason: reasons.join('; '), at, by: 'ci/gate-host.mjs --post' } : null;
  const record = {
    phase: 'post',
    at,
    enforced,
    onGateRunner: isOnGateRunner(identity),
    ...after,
    load: { start: pre?.host?.load ?? null, end: after.host.load },
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
  const mode = argv.includes('--pre') ? 'pre' : argv.includes('--post') ? 'post' : null;
  if (!mode) {
    console.error('usage: node ci/gate-host.mjs --pre [--dir bench/out] [--settle 180] | --post [--dir bench/out]');
    process.exit(2);
  }
  const dir = option('--dir', 'bench/out');
  const describe = (r) =>
    `${r.host.cpus} CPU(s), governor ${r.host.governors.join('/') || 'unknown'}, boost ${r.host.boost}${r.host.boostSource ? ` (${r.host.boostSource})` : ''}` +
    `${r.host.amdPstate ? `, amd_pstate ${r.host.amdPstate}` : ''}, swap ${r.host.swapDevices.length ? r.host.swapDevices.join(', ') : 'off'}, load ${r.host.load?.one ?? 'unknown'}`;

  if (mode === 'pre') {
    const record = preflight({ settleMs: Number(option('--settle', '180')) * 1000, log: console.log });
    mkdirSync(dir, { recursive: true });
    writeJson(join(dir, PRE_FILE), record);
    console.log(`gate host: ${describe(record)}`);
    if (!record.enforced) {
      console.log('not a gate-runner job and no gate-runner marker: reported only');
      return 0;
    }
    for (const p of record.problems) console.log(`FAIL ${p}`);
    if (record.problems.length) {
      console.log('This run must not record or judge gates (#18).');
      return 1;
    }
    console.log(`ok: gate runner ${record.identity.runnerName} may record and judge gates`);
    return 0;
  }

  const record = recheck({ dir });
  console.log(`gate host after the gates: ${describe(record)}; load ${record.load.start?.one ?? 'unknown'} at the start, ${record.load.end?.one ?? 'unknown'} at the end`);
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
