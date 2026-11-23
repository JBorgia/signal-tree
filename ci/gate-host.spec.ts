import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { MARKER, POST_FILE, PRE_FILE, checkPre, hostProblems, preflight, readHost, recheck } from './gate-host.mjs';

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
const GATE_JOB = { SIGNAL_TREE_GATES_RUNNER: '["self-hosted","linux","x64","signal-tree-gates"]', RUNNER_NAME: RUNNER };
const HOSTED_JOB = { SIGNAL_TREE_GATES_RUNNER: '', RUNNER_NAME: 'GitHub Actions 12' };
/** Runner.Listener → Runner.Worker → the step's shell → node: this job's own process tree. */
const SELF = 400;
const JOB_TREE = [
  { pid: 1, ppid: 0, comm: 'systemd' },
  { pid: 100, ppid: 1, comm: 'Runner.Listener' },
  { pid: 200, ppid: 100, comm: 'Runner.Worker' },
  { pid: 300, ppid: 200, comm: 'bash' },
  { pid: SELF, ppid: 300, comm: 'node' },
];

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
  load?: number;
  /** Contents of /etc/signal-tree/gate-runner; absent when undefined. */
  marker?: string;
  markerMode?: number;
  procs?: { pid: number; ppid: number; comm: string }[];
};

/** The provisioned gate runner: 4 CPUs on performance, amd-pstate with boost off on every policy, no swap, quiet. */
const GATE_RUNNER: Fake = {
  governors: ['performance', 'performance', 'performance', 'performance'],
  policyBoost: ['0', '0', '0', '0'],
  amdPstate: 'active',
  load: 0.4,
  marker: RUNNER,
};

function writeFake(root: string, fake: Fake) {
  const cpu = join(root, 'sys/devices/system/cpu');
  rmSync(join(root, 'sys'), { recursive: true, force: true });
  rmSync(join(root, 'proc'), { recursive: true, force: true });
  rmSync(join(root, 'etc'), { recursive: true, force: true });
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
  writeFileSync(join(root, 'proc/swaps'), ['Filename Type Size Used Priority', ...(fake.swaps ?? [])].join('\n'));
  writeFileSync(join(root, 'proc/meminfo'), `MemTotal: 65000000 kB\nSwapTotal: ${fake.swapTotal ?? 0} kB\nSwapFree: ${fake.swapFree ?? 0} kB\n`);
  writeFileSync(join(root, 'proc/loadavg'), `${fake.load ?? 0.1} 0.30 0.20 1/812 4321\n`);
  for (const p of fake.procs ?? JOB_TREE) {
    mkdirSync(join(root, 'proc', String(p.pid)), { recursive: true });
    writeFileSync(join(root, 'proc', String(p.pid), 'comm'), `${p.comm}\n`);
    writeFileSync(join(root, 'proc', String(p.pid), 'stat'), `${p.pid} (${p.comm}) S ${p.ppid} ${p.pid} ${p.pid} 0 -1 4194304\n`);
  }
  if (fake.marker !== undefined) {
    const path = join(root, MARKER);
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, `${fake.marker}\n`);
    chmodSync(path, fake.markerMode ?? 0o644);
  }
  return root;
}

const fakeHost = (fake: Fake) => writeFake(tempDir('gate-host-'), fake);
const pre = (root: string, env: Record<string, string> = GATE_JOB, rootUid = ROOT_UID) => checkPre({ root, env, selfPid: SELF, rootUid });

describe('gate-host preflight (#18)', () => {
  it('passes a host with every core on performance, boost readable, no swap, and records boost', () => {
    const host = readHost(fakeHost({ governors: ['performance', 'performance'], boost: '0' }), { selfPid: SELF });
    expect(hostProblems(host)).toEqual([]);
    expect(host.boost).toBe('off');
  });

  it('fails when any core is not on the performance governor', () => {
    const problems = hostProblems(readHost(fakeHost({ governors: ['performance', 'schedutil'], boost: '0' })));
    expect(problems).toEqual([expect.stringContaining('1 CPU(s) are not on the performance governor (schedutil)')]);
  });

  it('fails closed when a governor cannot be read (no cpufreq, as on many VMs)', () => {
    expect(hostProblems(readHost(fakeHost({ governors: [null, null], boost: '0' })))).toEqual([expect.stringContaining("can't be read on 2 of 2")]);
  });

  it('fails when swap is enabled, and when swap is in use', () => {
    const enabled = hostProblems(readHost(fakeHost({ governors: ['performance'], boost: '0', swaps: ['/swapfile file 2097148 0 -2'], swapTotal: 2097148, swapFree: 2097148 })));
    expect(enabled).toEqual([expect.stringContaining('swap is enabled (/swapfile)')]);
    const used = hostProblems(readHost(fakeHost({ governors: ['performance'], boost: '0', swaps: ['/swapfile file 2097148 512 -2'], swapTotal: 2097148, swapFree: 2096636 })));
    expect(used).toEqual(expect.arrayContaining([expect.stringContaining('512 kB of swap is in use')]));
  });

  it('fails when no CPUs are visible', () => {
    expect(hostProblems(readHost(fakeHost({ governors: [], boost: '0' })))).toEqual([expect.stringContaining('no CPUs found')]);
  });
});

describe('gate-runner identity', () => {
  it('passes the provisioned gate runner: a root-owned marker naming this runner, on a job aimed at signal-tree-gates', () => {
    const record = pre(fakeHost(GATE_RUNNER));
    expect(record.problems).toEqual([]);
    expect(record).toMatchObject({ enforced: true, onGateRunner: true, identity: { runnerName: RUNNER, marker: { name: RUNNER } } });
  });

  it('fails a gate job on a host without the marker, such as the agent VM, whatever else it reports', () => {
    const record = pre(fakeHost({ ...GATE_RUNNER, marker: undefined }), { ...GATE_JOB, RUNNER_NAME: 'agent-vm' });
    expect(record.problems).toEqual([expect.stringMatching(/^no gate-runner marker at \/etc\/signal-tree\/gate-runner/)]);
    expect(record.onGateRunner).toBe(false);
  });

  it('fails when the marker names another runner (a copied marker)', () => {
    const record = pre(fakeHost({ ...GATE_RUNNER, marker: 'ax42-gates' }), { ...GATE_JOB, RUNNER_NAME: 'agent-vm' });
    expect(record.problems).toEqual(['/etc/signal-tree/gate-runner names runner "ax42-gates", but this job runs on "agent-vm"']);
  });

  it('fails when the marker is not owned by root, or is writable by others', () => {
    const notRoot = pre(fakeHost(GATE_RUNNER), GATE_JOB, ROOT_UID + 1);
    expect(notRoot.problems).toEqual([`/etc/signal-tree/gate-runner is owned by uid ${ROOT_UID}, not root`]);
    const writable = pre(fakeHost({ ...GATE_RUNNER, markerMode: 0o666 }));
    expect(writable.problems).toEqual(['/etc/signal-tree/gate-runner is writable by group or others (mode 666)']);
  });

  it('fails a gate job whose runner labels leave out the dedicated label', () => {
    const record = pre(fakeHost(GATE_RUNNER), { ...GATE_JOB, SIGNAL_TREE_GATES_RUNNER: '["self-hosted","linux","x64"]' });
    expect(record.problems).toEqual([expect.stringContaining('does not name the dedicated label signal-tree-gates')]);
  });

  it('only reports on the hosted fallback: no marker and not aimed at the gate runner', () => {
    const record = pre(fakeHost({ governors: ['schedutil'], load: 9 }), HOSTED_JOB);
    expect(record).toMatchObject({ enforced: false, onGateRunner: false, problems: [] });
    expect(record.host.boost).toBe('unknown');
  });

  it('holds a host with a marker to the gate conditions even when the job does not say it is a gate job', () => {
    const record = pre(fakeHost({ ...GATE_RUNNER, governors: ['performance', 'schedutil'] }), { RUNNER_NAME: RUNNER });
    expect(record.enforced).toBe(true);
    expect(record.problems).toEqual([expect.stringContaining('not on the performance governor (schedutil)')]);
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
    const record = pre(fakeHost({ ...GATE_RUNNER, boost: '1' }));
    expect(record.problems).toEqual([expect.stringContaining('cpufreq/boost=1')]);
  });

  it('fails on the gate runner when boost is unknown on the AMD paths (amd-pstate without a boost file)', () => {
    const record = pre(fakeHost({ ...GATE_RUNNER, policyBoost: [null, null, null, null] }));
    expect(record.host.boost).toBe('unknown');
    expect(record.problems).toEqual([expect.stringMatching(/^boost can't be read \(no cpufreq\/policy\*\/boost, cpufreq\/boost or intel_pstate\/no_turbo; amd_pstate is active\)/)]);
  });

  it('falls back to the global cpufreq/boost, then intel_pstate/no_turbo', () => {
    const global = pre(fakeHost({ ...GATE_RUNNER, policyBoost: [], amdPstate: undefined, boost: '1' }));
    expect(global.host).toMatchObject({ boost: 'on', boostSource: 'cpufreq/boost' });
    expect(global.problems).toEqual([]);
    const intel = pre(fakeHost({ ...GATE_RUNNER, policyBoost: [], amdPstate: undefined, noTurbo: '1' }));
    expect(intel.host).toMatchObject({ boost: 'off', boostSource: 'intel_pstate/no_turbo' });
  });
});

describe('quiet host', () => {
  it("ignores this job's own Runner.Worker and fails when another job's is running", () => {
    expect(pre(fakeHost(GATE_RUNNER)).host).toMatchObject({ ownWorker: 200, otherWorkers: [] });
    const busy = pre(fakeHost({ ...GATE_RUNNER, procs: [...JOB_TREE, { pid: 900, ppid: 1, comm: 'Runner.Listener' }, { pid: 901, ppid: 900, comm: 'Runner.Worker' }] }));
    expect(busy.problems).toEqual(['another job is running on this host (Runner.Worker pid 901)']);
  });

  it('fails closed when its own process tree cannot be read', () => {
    expect(pre(fakeHost({ ...GATE_RUNNER, procs: [] })).problems).toEqual([expect.stringContaining("process tree can't be read")]);
  });

  it('fails when the 1-minute load average is not below 0.5 × CPUs, and records the load', () => {
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
    const stuck = preflight({ root: fakeHost({ ...GATE_RUNNER, load: 3 }), env: GATE_JOB, selfPid: SELF, rootUid: ROOT_UID, settleMs: 30_000, now: () => clock, sleep });
    expect(stuck.problems).toEqual([expect.stringContaining('1-minute load average is 3')]);
    expect(stuck.settle.waitedMs).toBe(30_000);
    clock = 0;
    const governor = preflight({ root: fakeHost({ ...GATE_RUNNER, load: 3, governors: ['schedutil', 'performance', 'performance', 'performance'] }), env: GATE_JOB, selfPid: SELF, rootUid: ROOT_UID, settleMs: 30_000, now: () => clock, sleep });
    expect(governor.problems).toHaveLength(2);
    expect(governor.settle.waitedMs).toBe(0);
  });
});

describe('post-run re-check', () => {
  /** A gate run: the preflight on the gate runner, results written, then `during` changes the host. */
  function gateRun(during: Fake, { before = GATE_RUNNER, env = GATE_JOB }: { before?: Fake; env?: Record<string, string> } = {}) {
    const root = fakeHost(before);
    const dir = tempDir('gate-out-');
    writeFileSync(join(dir, PRE_FILE), JSON.stringify(preflight({ root, env, selfPid: SELF, rootUid: ROOT_UID })));
    writeFileSync(join(dir, 'results-v15-shim-latest.json'), JSON.stringify({ recordOnly: true, scenarios: {} }));
    writeFileSync(join(dir, 'aa-latest.json'), JSON.stringify({ kind: 'aa', scenarios: {} }));
    writeFake(root, during);
    const record = recheck({ dir, root, env, selfPid: SELF, rootUid: ROOT_UID });
    const json = (name: string) => JSON.parse(readFileSync(join(dir, name), 'utf8'));
    return { record, dir, json };
  }

  it('keeps a run valid when the host held, and records the load at the start and the end', () => {
    const { record, json } = gateRun({ ...GATE_RUNNER, load: 3.9 });
    expect(record).toMatchObject({ enforced: true, invalid: null, findings: [], load: { start: { one: 0.4 }, end: { one: 3.9 } } });
    expect(json(POST_FILE).invalid).toBeNull();
    expect(json('results-v15-shim-latest.json').invalid).toBeUndefined();
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

  it('invalidates the run when the preflight failed', () => {
    const { record, json } = gateRun(GATE_RUNNER, { before: { ...GATE_RUNNER, marker: undefined } });
    expect(record.findings).toEqual([
      expect.stringMatching(/^the preflight failed: no gate-runner marker/),
      'the gate-runner marker changed during the run: none → ax42-gates',
    ]);
    expect(json('aa-latest.json').invalid).toBeTruthy();
  });

  it('invalidates the run when the post-run check fails: another job started, or the marker went away', () => {
    const joined = gateRun({ ...GATE_RUNNER, procs: [...JOB_TREE, { pid: 901, ppid: 1, comm: 'Runner.Worker' }] });
    expect(joined.record.findings).toEqual(['the post-run check failed: another job is running on this host (Runner.Worker pid 901)']);
    const unmarked = gateRun({ ...GATE_RUNNER, marker: undefined });
    expect(unmarked.record.invalid?.reason).toMatch(/the gate-runner marker changed during the run: ax42-gates → none; the post-run check failed: no gate-runner marker/);
  });

  it('invalidates a gate run that has no pre-run record', () => {
    const root = fakeHost(GATE_RUNNER);
    const dir = tempDir('gate-out-');
    writeFileSync(join(dir, 'results-v15-shim-latest.json'), '{}');
    const record = recheck({ dir, root, env: GATE_JOB, selfPid: SELF, rootUid: ROOT_UID });
    expect(record.invalid?.reason).toMatch(/^there is no pre-run record \(gate-host\.json\)/);
    expect(JSON.parse(readFileSync(join(dir, 'results-v15-shim-latest.json'), 'utf8')).invalid).toBeTruthy();
  });

  it('only reports on the hosted fallback, even when the host changed', () => {
    const hosted = { governors: ['schedutil'], load: 0.2, procs: JOB_TREE };
    const { record, dir } = gateRun({ ...hosted, governors: ['ondemand'] }, { before: hosted, env: HOSTED_JOB });
    expect(record).toMatchObject({ enforced: false, invalid: null, findings: ['the governor changed during the run: schedutil → ondemand'] });
    expect(existsSync(join(dir, POST_FILE))).toBe(true);
    expect(JSON.parse(readFileSync(join(dir, 'aa-latest.json'), 'utf8')).invalid).toBeUndefined();
  });
});
