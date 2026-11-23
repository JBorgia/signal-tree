import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  MARKER,
  POST_FILE,
  PRE_FILE,
  SAMPLES_FILE,
  TOOLCHAIN,
  addSample,
  checkPre,
  gateHostEnvLine,
  hostProblems,
  newSamples,
  preflight,
  readActivity,
  readHost,
  readToolchain,
  recheck,
  samplerProblems,
  toolchainProblems,
} from './gate-host.mjs';

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((r) => rmSync(r, { recursive: true, force: true })));
const tempDir = (prefix: string) => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  roots.push(dir);
  return dir;
};

/** The test process owns the fake tree's files, so it stands in for root. */
const ROOT_UID = process.getuid!();
const RUNNER = 'ax42-gates';
const TOOLCHAIN_ENV = { PATH: '/opt/node/bin:/opt/pnpm/bin:/usr/bin', PLAYWRIGHT_BROWSERS_PATH: '/opt/ms-playwright' };
const GATE_JOB = { SIGNAL_TREE_GATES_RUNNER: '["self-hosted","linux","x64","signal-tree-gates"]', SIGNAL_TREE_GATE_RUNNER_NAME: RUNNER, RUNNER_NAME: RUNNER, ...TOOLCHAIN_ENV };
const HOSTED_JOB = { SIGNAL_TREE_GATES_RUNNER: '', SIGNAL_TREE_GATE_RUNNER_NAME: '', RUNNER_NAME: 'GitHub Actions 12', PATH: '/usr/bin' };
/** The fresh, unprivileged job user on bare metal, running the listed node. */
const SYSTEM = {
  detectVirt: () => 'none' as string | null,
  sudo: () => 'refused',
  version: (path: string) => (path.endsWith('/node') ? 'v22.23.4' : '10.17.0'),
  execPath: () => '/opt/node/bin/node',
  uid: () => 1001 as number | null,
  gids: () => [1001],
  user: () => 'gates-1',
};
type System = typeof SYSTEM;
/** Runner.Listener → Runner.Worker → the step's shell → node: this job's own process tree. */
const SELF = 400;
const JOB_TREE = [
  { pid: 1, ppid: 0, comm: 'systemd' },
  { pid: 100, ppid: 1, comm: 'Runner.Listener' },
  { pid: 200, ppid: 100, comm: 'Runner.Worker' },
  { pid: 300, ppid: 200, comm: 'bash' },
  { pid: SELF, ppid: 300, comm: 'node' },
];
const cpuinfo = (vendor: string, flags = 'fpu vme de pse tsc msr sse sse2') =>
  [0, 1].map((i) => `processor\t: ${i}\nvendor_id\t: ${vendor}\nmodel name\t: AMD Ryzen 7 PRO 8700GE\nflags\t\t: ${flags}\n`).join('\n');
/** The root-installed toolchain: host path → contents. */
const TOOLS: Record<string, string> = {
  '/opt/node/bin/node': 'node 22.23.4 binary',
  '/opt/pnpm/bin/pnpm': '#!/opt/node/bin/node\n// pnpm 10.17.0',
  '/opt/ms-playwright/chromium-1169/chrome-linux/chrome': 'chromium binary',
};
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

type Fake = {
  governors?: (string | null)[];
  swaps?: string[];
  swapTotal?: number;
  swapFree?: number;
  /** Global cpufreq/boost. */
  boost?: string;
  /** Per-policy cpufreq/policyN/boost (amd-pstate); null makes the policy without a boost file. */
  policyBoost?: (string | null)[];
  noTurbo?: string;
  amdPstate?: string;
  cpuinfo?: string;
  load?: number;
  /** Contents of /etc/signal-tree/gate-runner; absent when undefined. */
  marker?: string;
  markerMode?: number;
  procs?: { pid: number; ppid: number; comm: string }[];
  /** false: no toolchain or manifest at all. */
  toolchain?: boolean;
  /** Changes a tool's contents after the manifest was written. */
  tampered?: string;
  modes?: Record<string, number>;
  /** /etc/group; null leaves it out. */
  groups?: string | null;
};

/** The provisioned gate runner: 4 AMD CPUs on performance, amd-pstate with boost off on every policy, no swap, quiet, toolchain intact. */
const GATE_RUNNER: Fake = {
  governors: ['performance', 'performance', 'performance', 'performance'],
  policyBoost: ['0', '0', '0', '0'],
  amdPstate: 'active',
  load: 0.4,
  marker: RUNNER,
};

function writeFake(root: string, fake: Fake) {
  const cpu = join(root, 'sys/devices/system/cpu');
  for (const dir of ['sys', 'proc', 'etc', 'opt']) rmSync(join(root, dir), { recursive: true, force: true });
  (fake.governors ?? []).forEach((g, i) => {
    const dir = join(cpu, `cpu${i}`, 'cpufreq');
    mkdirSync(dir, { recursive: true });
    if (g !== null) writeFileSync(join(dir, 'scaling_governor'), `${g}\n`);
  });
  (fake.policyBoost ?? []).forEach((b, i) => {
    const dir = join(cpu, 'cpufreq', `policy${i}`);
    mkdirSync(dir, { recursive: true });
    if (b !== null) writeFileSync(join(dir, 'boost'), `${b}\n`);
  });
  if (fake.boost !== undefined) {
    mkdirSync(join(cpu, 'cpufreq'), { recursive: true });
    writeFileSync(join(cpu, 'cpufreq/boost'), `${fake.boost}\n`);
  }
  if (fake.noTurbo !== undefined) {
    mkdirSync(join(cpu, 'intel_pstate'), { recursive: true });
    writeFileSync(join(cpu, 'intel_pstate/no_turbo'), `${fake.noTurbo}\n`);
  }
  if (fake.amdPstate !== undefined) {
    mkdirSync(join(cpu, 'amd_pstate'), { recursive: true });
    writeFileSync(join(cpu, 'amd_pstate/status'), `${fake.amdPstate}\n`);
  }
  mkdirSync(join(root, 'proc'), { recursive: true });
  writeFileSync(join(root, 'proc/cpuinfo'), fake.cpuinfo ?? cpuinfo('AuthenticAMD'));
  writeFileSync(join(root, 'proc/swaps'), ['Filename Type Size Used Priority', ...(fake.swaps ?? [])].join('\n'));
  writeFileSync(join(root, 'proc/meminfo'), `MemTotal: 65000000 kB\nSwapTotal: ${fake.swapTotal ?? 0} kB\nSwapFree: ${fake.swapFree ?? 0} kB\n`);
  writeFileSync(join(root, 'proc/loadavg'), `${fake.load ?? 0.1} 0.30 0.20 1/812 4321\n`);
  for (const p of fake.procs ?? JOB_TREE) {
    mkdirSync(join(root, 'proc', String(p.pid)), { recursive: true });
    writeFileSync(join(root, 'proc', String(p.pid), 'comm'), `${p.comm}\n`);
    writeFileSync(join(root, 'proc', String(p.pid), 'stat'), `${p.pid} (${p.comm}) S ${p.ppid} ${p.pid} ${p.pid} 0 -1 4194304\n`);
  }
  mkdirSync(join(root, 'etc/signal-tree'), { recursive: true });
  chmodSync(join(root, 'etc'), 0o755);
  chmodSync(join(root, 'etc/signal-tree'), 0o755);
  if (fake.groups !== null) writeFileSync(join(root, 'etc/group'), fake.groups ?? 'root:x:0:\nwheel:x:10:\nsudo:x:27:\ngates-1:x:1001:\n');
  if (fake.marker !== undefined) {
    writeFileSync(join(root, MARKER), `${fake.marker}\n`);
    chmodSync(join(root, MARKER), fake.markerMode ?? 0o644);
  }
  if (fake.toolchain !== false) {
    for (const [path, contents] of Object.entries(TOOLS)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), contents);
      chmodSync(join(root, path), 0o755);
    }
    for (const dir of ['opt', 'opt/node', 'opt/node/bin', 'opt/pnpm', 'opt/pnpm/bin', 'opt/ms-playwright', 'opt/ms-playwright/chromium-1169', 'opt/ms-playwright/chromium-1169/chrome-linux']) {
      chmodSync(join(root, dir), 0o755);
    }
    writeFileSync(join(root, TOOLCHAIN), Object.entries(TOOLS).map(([path, contents]) => `${sha256(contents)}  ${path}\n`).join(''));
    chmodSync(join(root, TOOLCHAIN), 0o644);
    if (fake.tampered) writeFileSync(join(root, fake.tampered), 'something else');
  }
  for (const [path, mode] of Object.entries(fake.modes ?? {})) chmodSync(join(root, path), mode);
  chmodSync(root, 0o755);
  return root;
}

const fakeHost = (fake: Fake) => writeFake(tempDir('gate-host-'), fake);
const host = (fake: Fake) => readHost(fakeHost(fake), { selfPid: SELF, system: SYSTEM });
type Options = { rootUid?: number; system?: Partial<System> };
const pre = (root: string, env: Record<string, string> = GATE_JOB, { rootUid = ROOT_UID, system = {} }: Options = {}) =>
  checkPre({ root, env, selfPid: SELF, rootUid, system: { ...SYSTEM, ...system } });
const toolchain = (root: string, env: Record<string, string> = GATE_JOB, { rootUid = ROOT_UID, system = {} }: Options = {}) =>
  toolchainProblems(readToolchain({ root, env, rootUid, system: { ...SYSTEM, ...system } }));

describe('gate-host preflight (#18)', () => {
  it('passes a host with every core on performance, boost readable, no swap, and records boost', () => {
    const read = host({ governors: ['performance', 'performance'], boost: '0' });
    expect(hostProblems(read)).toEqual([]);
    expect(read.boost).toBe('off');
  });

  it('fails when any core is not on the performance governor', () => {
    expect(hostProblems(host({ governors: ['performance', 'schedutil'], boost: '0' }))).toEqual([expect.stringContaining('1 CPU(s) are not on the performance governor (schedutil)')]);
  });

  it('fails closed when a governor cannot be read (no cpufreq, as on many VMs)', () => {
    expect(hostProblems(host({ governors: [null, null], boost: '0' }))).toEqual([expect.stringContaining("can't be read on 2 of 2")]);
  });

  it('fails when swap is enabled, and when swap is in use', () => {
    const enabled = hostProblems(host({ governors: ['performance'], boost: '0', swaps: ['/swapfile file 2097148 0 -2'], swapTotal: 2097148, swapFree: 2097148 }));
    expect(enabled).toEqual([expect.stringContaining('swap is enabled (/swapfile)')]);
    const used = hostProblems(host({ governors: ['performance'], boost: '0', swaps: ['/swapfile file 2097148 512 -2'], swapTotal: 2097148, swapFree: 2096636 }));
    expect(used).toEqual(expect.arrayContaining([expect.stringContaining('512 kB of swap is in use')]));
  });

  it('fails when no CPUs are visible', () => {
    expect(hostProblems(host({ governors: [], boost: '0' }))).toEqual([expect.stringContaining('no CPUs found')]);
  });
});

describe('gate-runner identity', () => {
  it('passes the provisioned gate runner: marker, RUNNER_NAME and the pinned name agree, on a job aimed at signal-tree-gates', () => {
    const record = pre(fakeHost(GATE_RUNNER));
    expect(record.problems).toEqual([]);
    expect(record).toMatchObject({ enforced: true, onGateRunner: true, identity: { runnerName: RUNNER, pinnedName: RUNNER, marker: { name: RUNNER } } });
  });

  it('fails a gate job on a host without the marker, such as the agent VM, whatever else it reports', () => {
    const record = pre(fakeHost({ ...GATE_RUNNER, marker: undefined }), { ...GATE_JOB, RUNNER_NAME: 'agent-vm' });
    expect(record.problems).toEqual([
      'this job runs on "agent-vm", not on the pinned gate runner "ax42-gates"',
      expect.stringMatching(/^no gate-runner marker at \/etc\/signal-tree\/gate-runner/),
    ]);
    expect(record.onGateRunner).toBe(false);
  });

  it('fails when the marker names another runner (a copied marker)', () => {
    const record = pre(fakeHost({ ...GATE_RUNNER, marker: 'ax42-gates' }), { ...GATE_JOB, RUNNER_NAME: 'agent-vm' });
    expect(record.problems).toEqual([
      'this job runs on "agent-vm", not on the pinned gate runner "ax42-gates"',
      '/etc/signal-tree/gate-runner names runner "ax42-gates", but this job runs on "agent-vm"',
    ]);
  });

  it('fails when the pinned name is missing, or differs from the runner and its marker', () => {
    expect(pre(fakeHost(GATE_RUNNER), { ...GATE_JOB, SIGNAL_TREE_GATE_RUNNER_NAME: '' }).problems).toEqual([expect.stringMatching(/^SIGNAL_TREE_GATE_RUNNER_NAME is not set/)]);
    const other = pre(fakeHost({ ...GATE_RUNNER, marker: 'rogue' }), { ...GATE_JOB, RUNNER_NAME: 'rogue' });
    expect(other.problems).toEqual(['this job runs on "rogue", not on the pinned gate runner "ax42-gates"']);
    expect(other.onGateRunner).toBe(false);
  });

  it('fails when the marker is not owned by root, or is writable by others', () => {
    const notRoot = pre(fakeHost(GATE_RUNNER), GATE_JOB, { rootUid: ROOT_UID + 1 });
    expect(notRoot.problems).toEqual([`/etc/signal-tree/gate-runner is owned by uid ${ROOT_UID}, not root`]);
    const writable = pre(fakeHost({ ...GATE_RUNNER, markerMode: 0o666 }));
    expect(writable.problems).toEqual(['/etc/signal-tree/gate-runner is writable by group or others (mode 666)']);
  });

  it('fails a gate job whose runner labels leave out the dedicated label', () => {
    const record = pre(fakeHost(GATE_RUNNER), { ...GATE_JOB, SIGNAL_TREE_GATES_RUNNER: '["self-hosted","linux","x64"]' });
    expect(record.problems).toEqual([expect.stringContaining('does not name the dedicated label signal-tree-gates')]);
  });

  it('only reports on the hosted fallback: no marker and not aimed at the gate runner', () => {
    const root = fakeHost({ governors: ['schedutil'], load: 9, cpuinfo: cpuinfo('GenuineIntel', 'fpu hypervisor'), toolchain: false });
    const record = preflight({ root, env: HOSTED_JOB, selfPid: SELF, rootUid: ROOT_UID, system: { ...SYSTEM, detectVirt: () => 'microsoft', sudo: () => 'allowed', uid: () => 1001 } });
    expect(record).toMatchObject({ enforced: false, onGateRunner: false, problems: [] });
    expect(record.host).toMatchObject({ boost: 'unknown', cpuVendors: ['GenuineIntel'], hypervisorFlag: true, virt: 'microsoft' });
    expect(record.toolchain).toMatchObject({ manifestEntries: 0, sudo: 'allowed' });
  });

  it('holds a host with a marker to the gate conditions even when the job does not say it is a gate job', () => {
    const record = pre(fakeHost({ ...GATE_RUNNER, governors: ['performance', 'schedutil'] }), { RUNNER_NAME: RUNNER, SIGNAL_TREE_GATE_RUNNER_NAME: RUNNER });
    expect(record.enforced).toBe(true);
    expect(record.problems).toEqual([expect.stringContaining('not on the performance governor (schedutil)')]);
  });
});

describe("the gate runner's bare metal", () => {
  it('fails a CPU that is not AMD', () => {
    expect(pre(fakeHost({ ...GATE_RUNNER, cpuinfo: cpuinfo('GenuineIntel') })).problems).toEqual(['the CPU vendor is GenuineIntel, not AuthenticAMD (the gate runner is an AMD AX42)']);
  });

  it('fails a CPU that reports the hypervisor flag', () => {
    expect(pre(fakeHost({ ...GATE_RUNNER, cpuinfo: cpuinfo('AuthenticAMD', 'fpu sse2 hypervisor') })).problems).toEqual([expect.stringMatching(/^the CPU reports the hypervisor flag/)]);
  });

  it('fails when systemd-detect-virt reports virtualization, and when it cannot be run', () => {
    expect(pre(fakeHost(GATE_RUNNER), GATE_JOB, { system: { detectVirt: () => 'kvm' } }).problems).toEqual([expect.stringMatching(/^systemd-detect-virt reports kvm, not none/)]);
    expect(pre(fakeHost(GATE_RUNNER), GATE_JOB, { system: { detectVirt: () => null } }).problems).toEqual(["systemd-detect-virt can't be run, so virtualization can't be ruled out"]);
  });

  it('fails when /proc/cpuinfo shows no vendor', () => {
    expect(pre(fakeHost({ ...GATE_RUNNER, cpuinfo: '' })).problems).toEqual(["the CPU vendor can't be read from /proc/cpuinfo"]);
  });
});

describe('the root-installed toolchain and the job user', () => {
  it('passes the listed node, pnpm and Chromium for an unprivileged user that sudo refuses, and records the versions', () => {
    const root = fakeHost(GATE_RUNNER);
    expect(toolchain(root)).toEqual([]);
    const record = preflight({ root, env: GATE_JOB, selfPid: SELF, rootUid: ROOT_UID, system: SYSTEM });
    expect(record.problems).toEqual([]);
    expect(record.toolchain).toMatchObject({
      manifestEntries: 3,
      node: { version: 'v22.23.4' },
      pnpm: { version: '10.17.0' },
      chromium: { browsersPath: '/opt/ms-playwright', builds: ['chromium-1169'], files: 1 },
      user: { uid: 1001, name: 'gates-1', groups: ['gates-1'] },
      sudo: 'refused',
    });
  });

  it('fails without the manifest, or with one others can write', () => {
    expect(toolchain(fakeHost({ ...GATE_RUNNER, toolchain: false }))).toEqual(expect.arrayContaining([`no toolchain manifest at /${TOOLCHAIN}`, 'node is not on PATH']));
    expect(toolchain(fakeHost({ ...GATE_RUNNER, modes: { [TOOLCHAIN]: 0o666 } }))).toEqual([`/${TOOLCHAIN} is writable by group or others (mode 666)`]);
  });

  it('fails a listed file that does not match its hash, or that others can write', () => {
    expect(toolchain(fakeHost({ ...GATE_RUNNER, tampered: 'opt/pnpm/bin/pnpm' }))).toEqual(['/opt/pnpm/bin/pnpm does not match its sha256 in the toolchain manifest']);
    expect(toolchain(fakeHost({ ...GATE_RUNNER, modes: { 'opt/node/bin/node': 0o777 } }))).toEqual(['/opt/node/bin/node is writable by group or others (mode 777)']);
  });

  it('fails when a directory holding listed files is writable by others, so an unlisted sibling could be swapped', () => {
    expect(toolchain(fakeHost({ ...GATE_RUNNER, modes: { 'opt/ms-playwright/chromium-1169': 0o777 } }))).toEqual([
      expect.stringMatching(/^a directory holding listed toolchain files: .*\/opt\/ms-playwright\/chromium-1169 is writable by group or others \(mode 777\)$/),
    ]);
  });

  it('fails when the node or pnpm on PATH, or the node running the check, is not a listed file', () => {
    const root = fakeHost(GATE_RUNNER);
    mkdirSync(join(root, 'home/gates-1/bin'), { recursive: true });
    writeFileSync(join(root, 'home/gates-1/bin/node'), 'planted node');
    chmodSync(join(root, 'home/gates-1/bin/node'), 0o755);
    const planted = toolchain(root, { ...GATE_JOB, PATH: `/home/gates-1/bin:${TOOLCHAIN_ENV.PATH}` }, { system: { execPath: () => '/home/gates-1/bin/node' } });
    expect(planted).toEqual([expect.stringMatching(/^the node on PATH \(.*\/home\/gates-1\/bin\/node\) is not a listed toolchain file$/), 'the node running this check is not a listed toolchain file']);
    expect(toolchain(root, { ...GATE_JOB, PATH: '/opt/node/bin' })).toEqual(['pnpm is not on PATH']);
  });

  it('fails without a root-owned PLAYWRIGHT_BROWSERS_PATH holding listed files', () => {
    expect(toolchain(fakeHost(GATE_RUNNER), { ...GATE_JOB, PLAYWRIGHT_BROWSERS_PATH: '' })).toEqual([expect.stringMatching(/^PLAYWRIGHT_BROWSERS_PATH is not set/)]);
    const root = fakeHost(GATE_RUNNER);
    mkdirSync(join(root, 'home/gates-1/.cache/ms-playwright'), { recursive: true });
    chmodSync(join(root, 'home/gates-1/.cache/ms-playwright'), 0o755);
    expect(toolchain(root, { ...GATE_JOB, PLAYWRIGHT_BROWSERS_PATH: '/home/gates-1/.cache/ms-playwright' })).toEqual([
      'the toolchain manifest lists no file under PLAYWRIGHT_BROWSERS_PATH (/home/gates-1/.cache/ms-playwright)',
    ]);
    expect(toolchain(fakeHost({ ...GATE_RUNNER, modes: { 'opt/ms-playwright': 0o777 } }))).toEqual(expect.arrayContaining(['PLAYWRIGHT_BROWSERS_PATH (/opt/ms-playwright) is writable by group or others (mode 777)']));
  });

  it('fails a job user that is root, in sudo, admin or wheel, or that sudo lets in', () => {
    const root = fakeHost(GATE_RUNNER);
    expect(toolchain(root, GATE_JOB, { system: { uid: () => 0 } })).toEqual(['the job runs as root']);
    expect(toolchain(root, GATE_JOB, { system: { gids: () => [1001, 27] } })).toEqual(["the job's user gates-1 is in sudo"]);
    expect(toolchain(fakeHost({ ...GATE_RUNNER, groups: 'wheel:x:10:gates-1\ngates-1:x:1001:\n' }))).toEqual(["the job's user gates-1 is in wheel"]);
    expect(toolchain(root, GATE_JOB, { system: { sudo: () => 'allowed' } })).toEqual(["sudo -n true succeeds: the job's user can become root"]);
    expect(toolchain(root, GATE_JOB, { system: { sudo: () => 'unknown (ETIMEDOUT)' } })).toEqual(["can't tell whether the job's user can use sudo: unknown (ETIMEDOUT)"]);
  });

  it('fails closed when the user id or /etc/group cannot be read', () => {
    expect(toolchain(fakeHost({ ...GATE_RUNNER, groups: null }))).toEqual(["/etc/group can't be read, so the job's groups can't be checked"]);
    expect(toolchain(fakeHost(GATE_RUNNER), GATE_JOB, { system: { uid: () => null } })).toEqual(["the job's user id can't be read"]);
  });

  it('makes a toolchain problem fail the preflight on the gate runner', () => {
    const record = preflight({ root: fakeHost({ ...GATE_RUNNER, tampered: 'opt/node/bin/node' }), env: GATE_JOB, selfPid: SELF, rootUid: ROOT_UID, system: SYSTEM });
    expect(record.problems).toEqual(['/opt/node/bin/node does not match its sha256 in the toolchain manifest']);
    expect(gateHostEnvLine(record)).toBe('SIGNAL_TREE_GATE_HOST=\n');
  });
});

describe('the gate-host signal to the bench harness ($GITHUB_ENV)', () => {
  it('names this runner only when the preflight passed on the gate runner', () => {
    expect(gateHostEnvLine(pre(fakeHost(GATE_RUNNER)))).toBe('SIGNAL_TREE_GATE_HOST=ax42-gates\n');
  });

  it('is cleared, never left as an earlier step set it, when the preflight failed, on another host, or on the hosted fallback', () => {
    expect(gateHostEnvLine(null)).toBe('SIGNAL_TREE_GATE_HOST=\n');
    expect(gateHostEnvLine(pre(fakeHost({ ...GATE_RUNNER, load: 3 })))).toBe('SIGNAL_TREE_GATE_HOST=\n');
    expect(gateHostEnvLine(pre(fakeHost({ ...GATE_RUNNER, marker: undefined }), { ...GATE_JOB, RUNNER_NAME: 'agent-vm' }))).toBe('SIGNAL_TREE_GATE_HOST=\n');
    expect(gateHostEnvLine(pre(fakeHost({ governors: ['performance'], boost: '0' }), HOSTED_JOB))).toBe('SIGNAL_TREE_GATE_HOST=\n');
  });
});

describe('boost', () => {
  it('reads amd-pstate per-policy boost and records the amd-pstate mode', () => {
    const record = pre(fakeHost(GATE_RUNNER));
    expect(record.host).toMatchObject({ boost: 'off', boostSource: 'cpufreq/policy*/boost', amdPstate: 'active' });
    expect(pre(fakeHost({ ...GATE_RUNNER, policyBoost: ['1', '1', '1', '1'] })).host.boost).toBe('on');
  });

  it('fails when per-policy boost values disagree, or a policy has none', () => {
    const disagree = pre(fakeHost({ ...GATE_RUNNER, policyBoost: ['0', '1', '0', '0'] }));
    expect(disagree.host.boost).toBe('mixed');
    expect(disagree.problems).toEqual(['boost is not the same on every CPU policy (policy0=0, policy1=1, policy2=0, policy3=0)']);
    const missing = pre(fakeHost({ ...GATE_RUNNER, policyBoost: ['0', '0', null, '0'] }));
    expect(missing.problems).toEqual([expect.stringContaining('policy2=unreadable')]);
  });

  it('fails when per-policy boost disagrees with the global cpufreq/boost', () => {
    expect(pre(fakeHost({ ...GATE_RUNNER, boost: '1' })).problems).toEqual([expect.stringContaining('cpufreq/boost=1')]);
  });

  it('fails on the gate runner when boost is unknown on the AMD paths (amd-pstate without a boost file)', () => {
    const record = pre(fakeHost({ ...GATE_RUNNER, policyBoost: [null, null, null, null] }));
    expect(record.host.boost).toBe('unknown');
    expect(record.problems).toEqual([expect.stringMatching(/^boost can't be read \(no cpufreq\/policy\*\/boost or cpufreq\/boost; amd_pstate is active\)/)]);
  });

  it('accepts the global cpufreq/boost, and reads intel_pstate/no_turbo for reporting only', () => {
    const global = pre(fakeHost({ ...GATE_RUNNER, policyBoost: [], amdPstate: undefined, boost: '1' }));
    expect(global.host).toMatchObject({ boost: 'on', boostSource: 'cpufreq/boost' });
    expect(global.problems).toEqual([]);
    const intel = pre(fakeHost({ ...GATE_RUNNER, policyBoost: [], amdPstate: undefined, noTurbo: '1' }));
    expect(intel.host).toMatchObject({ boost: 'off', boostSource: 'intel_pstate/no_turbo' });
    expect(intel.problems).toEqual([expect.stringMatching(/^boost is known only from intel_pstate\/no_turbo/)]);
  });
});

describe('one quiet runner, before the gates', () => {
  it("ignores this job's own Runner.Worker and fails when another runner's job is running", () => {
    expect(pre(fakeHost(GATE_RUNNER)).host).toMatchObject({ ownWorker: 200, otherWorkers: [], listeners: [100], initReadable: true });
    const busy = pre(fakeHost({ ...GATE_RUNNER, procs: [...JOB_TREE, { pid: 900, ppid: 1, comm: 'Runner.Listener' }, { pid: 901, ppid: 900, comm: 'Runner.Worker' }] }));
    expect(busy.problems).toEqual(['expected exactly one runner on this host, found 2 Runner.Listener process(es) (pid 100, 900)', 'another job is running on this host (Runner.Worker pid 901)']);
  });

  it('fails a second runner on the host even while it is idle', () => {
    const idle = pre(fakeHost({ ...GATE_RUNNER, procs: [...JOB_TREE, { pid: 900, ppid: 1, comm: 'Runner.Listener' }] }));
    expect(idle.problems).toEqual([expect.stringMatching(/^expected exactly one runner on this host, found 2/)]);
  });

  it('fails closed when /proc/1/stat, or its own process tree, cannot be read, or it runs under no Runner.Worker', () => {
    const hidden = pre(fakeHost({ ...GATE_RUNNER, procs: JOB_TREE.filter((p) => p.pid !== 1) }));
    expect(hidden.problems).toEqual(["/proc/1/stat can't be read (hidepid or a PID namespace), so the host's processes can't be seen"]);
    expect(pre(fakeHost({ ...GATE_RUNNER, procs: [] })).problems).toEqual(expect.arrayContaining([expect.stringContaining("process tree can't be read")]));
    const manual = pre(fakeHost({ ...GATE_RUNNER, procs: [JOB_TREE[0]!, JOB_TREE[1]!, { pid: 300, ppid: 1, comm: 'bash' }, JOB_TREE[4]!] }));
    expect(manual.problems).toEqual(['this process does not run under a Runner.Worker']);
  });

  it('fails a busy host: the 1-minute load average not below 0.5 × CPUs; and records the load', () => {
    const busy = pre(fakeHost({ ...GATE_RUNNER, load: 2 }));
    expect(busy.problems).toEqual(['the 1-minute load average is 2, not below 0.5 × 4 CPUs = 2']);
    expect(busy.host.load).toEqual({ one: 2, five: 0.3, fifteen: 0.2 });
  });

  it('waits for the load to settle, and records the loads it saw', () => {
    const root = fakeHost({ ...GATE_RUNNER, load: 3.5 });
    let clock = 0;
    const settle = [2.5, 1.2];
    const record = preflight({
      root,
      env: GATE_JOB,
      selfPid: SELF,
      rootUid: ROOT_UID,
      system: SYSTEM,
      settleMs: 60_000,
      intervalMs: 10_000,
      now: () => clock,
      sleep: (ms: number) => {
        clock += ms;
        writeFake(root, { ...GATE_RUNNER, load: settle.shift() });
      },
    });
    expect(record.problems).toEqual([]);
    expect(record.settle).toEqual({ waitedMs: 20_000, loads: [3.5, 2.5, 1.2] });
  });

  it('fails a load that does not settle in time, and does not wait on any other problem', () => {
    let clock = 0;
    const sleep = (ms: number) => void (clock += ms);
    const options = { env: GATE_JOB, selfPid: SELF, rootUid: ROOT_UID, system: SYSTEM, settleMs: 30_000, now: () => clock, sleep };
    const stuck = preflight({ ...options, root: fakeHost({ ...GATE_RUNNER, load: 3 }) });
    expect(stuck.problems).toEqual([expect.stringContaining('1-minute load average is 3')]);
    expect(stuck.settle.waitedMs).toBe(30_000);
    clock = 0;
    const governor = preflight({ ...options, root: fakeHost({ ...GATE_RUNNER, load: 3, governors: ['schedutil', 'performance', 'performance', 'performance'] }) });
    expect(governor.problems).toHaveLength(2);
    expect(governor.settle.waitedMs).toBe(0);
  });
});

describe('the sampler', () => {
  const at = (s: number) => new Date(Date.UTC(2026, 10, 23, 12, 0, s)).toISOString();
  const activity = (fake: Fake) => readActivity(fakeHost(fake), { selfPid: 77_777, ownWorker: 200 });
  const fresh = () => newSamples({ pid: 9, ownWorker: 200, at: at(0) });

  it("records the peak load, and fails every other Runner.Worker it saw, excluding this job's own", () => {
    let state = fresh();
    state = addSample(state, activity({ ...GATE_RUNNER, load: 0.5 }), at(5));
    state = addSample(state, activity({ ...GATE_RUNNER, load: 1.5, procs: [...JOB_TREE, { pid: 901, ppid: 1, comm: 'Runner.Worker' }] }), at(10));
    state = addSample(state, activity({ ...GATE_RUNNER, load: 0.7 }), at(15));
    expect(state).toMatchObject({ samples: 3, lastAt: at(15), maxLoad: { one: 1.5, at: at(10) }, otherWorkers: [{ pid: 901, at: at(10) }], listenerCounts: [1] });
    expect(samplerProblems(state, { at: at(16) })).toEqual([`another job ran on this host during the run (Runner.Worker pid 901 at ${at(10)})`]);
  });

  it("records a high peak load from this job's own work without judging it", () => {
    const state = addSample(fresh(), activity({ ...GATE_RUNNER, load: 12 }), at(5));
    expect(state.maxLoad).toEqual({ one: 12, at: at(5) });
    expect(samplerProblems(state, { at: at(6) })).toEqual([]);
  });

  it('fails a second runner, or an unreadable /proc/1/stat, seen during the run', () => {
    let state = addSample(fresh(), activity({ ...GATE_RUNNER, procs: [...JOB_TREE, { pid: 900, ppid: 1, comm: 'Runner.Listener' }] }), at(5));
    state = addSample(state, activity({ ...GATE_RUNNER, procs: JOB_TREE.filter((p) => p.pid !== 1) }), at(10));
    expect(samplerProblems(state, { at: at(11) })).toEqual([
      'the host did not have exactly one runner throughout the run (Runner.Listener counts seen: 1, 2)',
      '/proc/1/stat could not be read in 1 sample(s)',
    ]);
  });

  it('fails a missing, empty or stopped sampler', () => {
    expect(samplerProblems(null, { at: at(0) })).toEqual([expect.stringMatching(/^there is no sampler record/)]);
    expect(samplerProblems(fresh(), { at: at(1) })).toEqual(['the sampler took no samples during the run']);
    const state = addSample(fresh(), activity(GATE_RUNNER), at(5));
    expect(samplerProblems(state, { at: at(40) })).toEqual(["the sampler's last sample was 35 s before the re-check, so the end of the run was not watched"]);
  });
});

describe('post-run re-check', () => {
  type RunOptions = { before?: Fake; env?: Record<string, string>; samples?: (root: string) => unknown };
  /** A healthy sampler record for this host, last sampled just now. */
  const goodSamples = (root: string) =>
    addSample(newSamples({ pid: 9, ownWorker: 200, at: new Date().toISOString() }), readActivity(root, { selfPid: SELF }), new Date().toISOString());

  /** A gate run: the preflight on the gate runner, results and the sampler's record written, then `during` changes the host. */
  function gateRun(during: Fake, { before = GATE_RUNNER, env = GATE_JOB, samples = goodSamples }: RunOptions = {}) {
    const root = fakeHost(before);
    const dir = tempDir('gate-out-');
    const options = { root, env, selfPid: SELF, rootUid: ROOT_UID, system: SYSTEM };
    writeFileSync(join(dir, PRE_FILE), JSON.stringify({ ...preflight(options), sampler: { pid: 9 } }));
    const sampled = samples(root);
    if (sampled !== undefined) writeFileSync(join(dir, SAMPLES_FILE), JSON.stringify(sampled));
    writeFileSync(join(dir, 'results-v15-shim-latest.json'), JSON.stringify({ recordOnly: true, scenarios: {} }));
    writeFileSync(join(dir, 'aa-latest.json'), JSON.stringify({ kind: 'aa', scenarios: {} }));
    writeFake(root, during);
    const stopped: unknown[] = [];
    const record = recheck({ dir, ...options, stop: (pid: unknown) => void stopped.push(pid) });
    const json = (name: string) => JSON.parse(readFileSync(join(dir, name), 'utf8'));
    return { record, dir, json, stopped };
  }

  it('keeps a run valid when the host held, stops the sampler, and records the load at the start, peak and end', () => {
    const { record, json, stopped } = gateRun({ ...GATE_RUNNER, load: 1.9 });
    expect(stopped).toEqual([9]);
    expect(record).toMatchObject({ enforced: true, invalid: null, findings: [], load: { start: { one: 0.4 }, peak: { one: 0.4 }, end: { one: 1.9 } } });
    expect(json(POST_FILE).invalid).toBeNull();
    expect(json('results-v15-shim-latest.json').invalid).toBeUndefined();
  });

  it("keeps a run valid when this job's own work drove the load high, and records it", () => {
    const { record } = gateRun({ ...GATE_RUNNER, load: 7.5 }, { samples: (root) => ({ ...goodSamples(root), maxLoad: { one: 11, at: new Date().toISOString() } }) });
    expect(record).toMatchObject({ invalid: null, findings: [], load: { peak: { one: 11 }, end: { one: 7.5 } } });
  });

  it('invalidates the run when another job appeared: still running at the end, or seen by the sampler', () => {
    const joined = gateRun({ ...GATE_RUNNER, procs: [...JOB_TREE, { pid: 901, ppid: 1, comm: 'Runner.Worker' }] });
    expect(joined.record.findings).toEqual(['the post-run check failed: another job is running on this host (Runner.Worker pid 901)']);
    const passed = gateRun(GATE_RUNNER, { samples: (root) => ({ ...goodSamples(root), otherWorkers: [{ pid: 777, at: new Date().toISOString() }] }) });
    expect(passed.record.invalid?.reason).toMatch(/^the sampler saw: another job ran on this host during the run \(Runner\.Worker pid 777 at /);
  });

  it('invalidates the run, and every results file, when the governor changed mid-run', () => {
    const { record, json } = gateRun({ ...GATE_RUNNER, governors: ['performance', 'schedutil', 'performance', 'performance'] });
    expect(record.findings).toEqual([
      'the governor changed during the run: performance → performance/schedutil',
      expect.stringContaining('the post-run check failed: 1 CPU(s) are not on the performance governor'),
    ]);
    expect(record.results).toEqual({ marked: ['aa-latest.json', 'results-v15-shim-latest.json'], unmarked: [] });
    for (const name of ['results-v15-shim-latest.json', 'aa-latest.json', POST_FILE]) {
      expect(json(name).invalid).toMatchObject({ reason: expect.stringContaining('the governor changed during the run'), by: 'ci/gate-host.mjs --post' });
    }
    expect(json('results-v15-shim-latest.json').recordOnly).toBe(true);
    expect(json(PRE_FILE).invalid).toBeUndefined();
    expect(json(SAMPLES_FILE).invalid).toBeUndefined();
  });

  it('invalidates the run when boost changed mid-run', () => {
    const { record } = gateRun({ ...GATE_RUNNER, policyBoost: ['1', '1', '1', '1'] });
    expect(record.findings).toEqual(['boost changed during the run: off → on']);
    expect(record.invalid?.reason).toBe('boost changed during the run: off → on');
  });

  it('invalidates the run when swap changed mid-run', () => {
    const { record } = gateRun({ ...GATE_RUNNER, swaps: ['/swapfile file 2097148 512 -2'], swapTotal: 2097148, swapFree: 2096636 });
    expect(record.findings[0]).toBe('swap changed during the run: no swap device, 0 kB in use → /swapfile, 512 kB in use');
  });

  it('invalidates the run when the sampler left no record', () => {
    const { record } = gateRun(GATE_RUNNER, { samples: () => undefined });
    expect(record.invalid?.reason).toMatch(/^the sampler saw: there is no sampler record \(gate-host-samples\.json\)/);
  });

  it('invalidates the run when the preflight failed', () => {
    const { record, json } = gateRun(GATE_RUNNER, { before: { ...GATE_RUNNER, marker: undefined } });
    expect(record.findings).toEqual([
      expect.stringMatching(/^the preflight failed: no gate-runner marker/),
      'the gate-runner marker changed during the run: none → ax42-gates',
    ]);
    expect(json('aa-latest.json').invalid).toBeTruthy();
  });

  it('invalidates the run when the marker went away', () => {
    const { record } = gateRun({ ...GATE_RUNNER, marker: undefined });
    expect(record.invalid?.reason).toMatch(/the gate-runner marker changed during the run: ax42-gates → none; the post-run check failed: no gate-runner marker/);
  });

  it('invalidates a gate run that has no pre-run record', () => {
    const root = fakeHost(GATE_RUNNER);
    const dir = tempDir('gate-out-');
    writeFileSync(join(dir, 'results-v15-shim-latest.json'), '{}');
    const record = recheck({ dir, root, env: GATE_JOB, selfPid: SELF, rootUid: ROOT_UID, system: SYSTEM, stop: () => {} });
    expect(record.invalid?.reason).toMatch(/^there is no pre-run record \(gate-host\.json\)/);
    expect(JSON.parse(readFileSync(join(dir, 'results-v15-shim-latest.json'), 'utf8')).invalid).toBeTruthy();
  });

  it('only reports on the hosted fallback, even when the host changed', () => {
    const hosted = { governors: ['schedutil'], load: 0.2, procs: JOB_TREE, toolchain: false };
    const { record, dir } = gateRun({ ...hosted, governors: ['ondemand'] }, { before: hosted, env: HOSTED_JOB, samples: () => undefined });
    expect(record).toMatchObject({ enforced: false, invalid: null, findings: ['the governor changed during the run: schedutil → ondemand'] });
    expect(existsSync(join(dir, POST_FILE))).toBe(true);
    expect(JSON.parse(readFileSync(join(dir, 'aa-latest.json'), 'utf8')).invalid).toBeUndefined();
  });
});
