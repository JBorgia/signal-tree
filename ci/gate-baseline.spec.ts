import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BASELINE_FILE, WORKFLOW_PATH, baselineHost, comparableHost, decide } from './gate-baseline.mjs';
import { BROWSERS_FILE, MARKER, POST_FILE, PRE_FILE, SAMPLES_FILE, addSample, checkPre, newSamples, readActivity, recheck } from './gate-host.mjs';
import { trustedRuns } from './github.mjs';

const gateHost = { onGateRunner: true, runnerName: 'ax42-gates', governor: 'performance', boost: 'off', amdPstate: 'active' };
const current = gateHost;
const offRunner = { onGateRunner: false, runnerName: 'GitHub Actions 3', governor: null, boost: 'unknown', amdPstate: 'none' };
const run = (id: number, conclusion = 'success') => ({ id, conclusion });
type Seen = { artifactId: number | null; path: string | null; host: (typeof gateHost & { invalid: string | null }) | null; gatesRunner: string | null };
const recorded = (host: Partial<typeof gateHost> & { invalid?: string | null } = {}, seen: Partial<Seen> = {}): Seen => ({
  artifactId: 70,
  path: '/tmp/main-gates/7/aa-latest.json',
  host: { ...gateHost, invalid: null, ...host },
  gatesRunner: 'ax42-gates',
  ...seen,
});
/** inspect() for runs by id; an id it doesn't know has no artifact. */
const inspecting =
  (byId: Record<number, Seen | { error: string } | { offMain: true }>) =>
  (r: { id: number }) =>
    byId[r.id] ?? { artifactId: null, path: null, host: null, gatesRunner: null };
const ok = inspecting({ 7: recorded() });
const listing = { runs: [run(7)] };

describe('gate baseline fetch', () => {
  it("uses main's baseline when it downloads", () => {
    expect(decide({ current, approved: true, listing, inspect: ok })).toMatchObject({ action: 'use', path: '/tmp/main-gates/7/aa-latest.json' });
  });

  it('fails when main has a baseline but fetching it fails, approved or not', () => {
    const broken = inspecting({ 7: { error: 'HTTP 403: Resource not accessible by integration' } });
    expect(decide({ current, approved: false, listing, inspect: broken }).action).toBe('fail');
    expect(decide({ current, approved: true, listing, inspect: broken }).action).toBe('fail');
    expect(decide({ current, approved: false, listing, inspect: inspecting({ 7: recorded({}, { path: null }) }) }).reason).toMatch(/aa-latest\.json is not in it/);
  });

  it('fails when the run listing fails, for example without actions: read', () => {
    expect(decide({ current, approved: false, listing: { error: 'HTTP 403' }, inspect: ok }).action).toBe('fail');
  });

  it('allows "no baseline yet" only while budgets.json is not approved', () => {
    expect(decide({ current, approved: false, listing: { runs: [] }, inspect: ok }).action).toBe('none');
    expect(decide({ current, approved: true, listing: { runs: [] }, inspect: ok }).action).toBe('fail');
    const expired = inspecting({ 7: recorded({}, { artifactId: null, path: null }) });
    expect(decide({ current, approved: false, listing, inspect: expired }).action).toBe('none');
    expect(decide({ current, approved: true, listing, inspect: expired }).action).toBe('fail');
  });

  it('compares only a run on the gate runner with a baseline recorded on it', () => {
    const elsewhere = inspecting({ 7: recorded({ onGateRunner: false, runnerName: null }) });
    expect(decide({ current, approved: false, listing, inspect: elsewhere }).action).toBe('none');
    expect(decide({ current, approved: true, listing, inspect: elsewhere })).toEqual({
      action: 'fail',
      reason: "budgets.json is approved but main's newest baseline (run 7, artifact 70) was not recorded on the gate runner",
    });
    expect(decide({ current: offRunner, approved: false, listing, inspect: ok }).action).toBe('none');
    expect(decide({ current: offRunner, approved: true, listing, inspect: ok }).action).toBe('fail');
  });

  it('still fails off the gate runner when the listing fails', () => {
    expect(decide({ current: offRunner, approved: false, listing: { error: 'HTTP 403' }, inspect: ok }).action).toBe('fail');
  });

  it('refuses a baseline whose gates job GitHub ran on another runner than its record names', () => {
    const other = inspecting({ 7: recorded({}, { gatesRunner: 'agent-vm' }) });
    expect(decide({ current, approved: true, listing, inspect: other }).reason).toMatch(/GitHub ran its gates job on runner agent-vm, but its gate-host record names ax42-gates/);
  });

  const differing: Array<[string, Partial<typeof gateHost>, string]> = [
    ['boost', { boost: 'on' }, 'was recorded with boost on and this run has off'],
    ['governor', { governor: 'performance/schedutil' }, 'was recorded with the governor performance/schedutil and this run has performance'],
    ['amd-pstate mode', { amdPstate: 'passive' }, 'was recorded with the amd-pstate mode passive and this run has active'],
    ['runner', { runnerName: 'ax42-old' }, 'was recorded with the runner ax42-old and this run has ax42-gates'],
  ];
  it.each(differing)('refuses a baseline whose %s differs from this run, and says which', (_what, host, why) => {
    const inspect = inspecting({ 7: recorded(host, { gatesRunner: host.runnerName ?? 'ax42-gates' }) });
    expect(decide({ current, approved: false, listing, inspect })).toEqual({
      action: 'none',
      reason: `main's newest baseline (run 7, artifact 70) ${why}; budgets.json is not approved, so this run only records`,
    });
    expect(decide({ current, approved: true, listing, inspect })).toEqual({
      action: 'fail',
      reason: `budgets.json is approved but main's newest baseline (run 7, artifact 70) ${why}`,
    });
  });

  it('never compares with an invalid baseline', () => {
    const invalid = inspecting({ 7: recorded({ invalid: 'boost changed during the run: off → on' }) });
    expect(decide({ current, approved: false, listing, inspect: invalid })).toMatchObject({ action: 'none', reason: expect.stringContaining('is invalid: boost changed during the run') });
    expect(decide({ current, approved: true, listing, inspect: invalid })).toMatchObject({ action: 'fail', reason: expect.stringContaining('is invalid') });
  });

  it('skips newer runs that recorded no baseline (cancelled, or failed before the gates) and runs whose head is not on main', () => {
    const runs = [run(9, 'cancelled'), run(8, 'failure'), run(6), run(7)];
    const inspect = inspecting({ 9: recorded({}, { artifactId: 90, path: null }), 6: { offMain: true }, 7: recorded() });
    expect(decide({ current, approved: true, listing: { runs }, inspect })).toMatchObject({ action: 'use', reason: expect.stringMatching(/^baseline from main's run 7/) });
  });

  it('stops at a newer run that recorded a baseline but did not succeed, and never falls back to an older one', () => {
    const runs = [run(9, 'failure'), run(7)];
    const inspect = inspecting({ 9: recorded({ invalid: 'the governor changed during the run: performance → schedutil' }, { artifactId: 90 }), 7: recorded() });
    expect(decide({ current, approved: true, listing: { runs }, inspect })).toEqual({
      action: 'fail',
      reason:
        "budgets.json is approved but main's newest baseline (run 9, artifact 90) comes from a run that concluded failure (the governor changed during the run: performance → schedutil); only a successful run's baseline is used",
    });
    expect(decide({ current, approved: false, listing: { runs }, inspect }).action).toBe('none');
  });
});

describe('main runs a baseline may come from', () => {
  const repository = { id: 42 };
  const base = { status: 'completed', head_branch: 'main', event: 'push', path: WORKFLOW_PATH, repository, head_repository: repository };
  const runs = [
    { ...base, id: 1, created_at: '2026-11-19T00:00:00Z' },
    { ...base, id: 2, created_at: '2026-11-22T00:00:00Z', head_repository: { id: 99 } },
    { ...base, id: 3, created_at: '2026-11-22T01:00:00Z', event: 'pull_request' },
    { ...base, id: 4, created_at: '2026-11-22T02:00:00Z', path: '.github/workflows/other.yml' },
    { ...base, id: 5, created_at: '2026-11-22T03:00:00Z', head_branch: 'rebuild/x' },
    { ...base, id: 6, created_at: '2026-11-22T04:00:00Z', status: 'in_progress' },
    { ...base, id: 7, created_at: '2026-11-21T00:00:00Z' },
    { ...base, id: 8, created_at: '2026-11-20T00:00:00Z', path: `${WORKFLOW_PATH}@refs/heads/main` },
  ];

  it('are completed push runs of ci.yml on main whose head is in this repository, newest first', () => {
    expect(trustedRuns(runs, { workflowPath: WORKFLOW_PATH, events: ['push'] }).map((r) => r.id)).toEqual([7, 8, 1]);
    expect(trustedRuns([], { workflowPath: WORKFLOW_PATH, events: ['push'] })).toEqual([]);
  });
});

describe("main's baseline artifact, as ci/gate-host.mjs records it", () => {
  const dirs: string[] = [];
  afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));
  const temp = () => {
    const d = mkdtempSync(join(tmpdir(), 'gate-baseline-'));
    dirs.push(d);
    return d;
  };
  const uid = process.getuid!();
  const env = { SIGNAL_TREE_GATES_RUNNER: '["self-hosted","linux","x64","gates"]', SIGNAL_TREE_GATE_RUNNER_NAME: 'ax42-gates', RUNNER_NAME: 'ax42-gates' };

  /** A gate runner with amd-pstate boost `boost` on 2 CPUs, one runner whose Runner.Worker runs this job, and the marker. */
  function gateRunner(boost: string) {
    const root = temp();
    for (const i of [0, 1]) {
      mkdirSync(join(root, `sys/devices/system/cpu/cpu${i}/cpufreq`), { recursive: true });
      writeFileSync(join(root, `sys/devices/system/cpu/cpu${i}/cpufreq/scaling_governor`), 'performance\n');
      mkdirSync(join(root, `sys/devices/system/cpu/cpufreq/policy${i}`), { recursive: true });
      writeFileSync(join(root, `sys/devices/system/cpu/cpufreq/policy${i}/boost`), `${boost}\n`);
    }
    mkdirSync(join(root, 'sys/devices/system/cpu/amd_pstate'), { recursive: true });
    writeFileSync(join(root, 'sys/devices/system/cpu/amd_pstate/status'), 'active\n');
    for (const [pid, ppid, comm] of [[1, 0, 'systemd'], [5, 1, 'Runner.Listener'], [10, 5, 'Runner.Worker'], [20, 10, 'node']] as const) {
      mkdirSync(join(root, `proc/${pid}`), { recursive: true });
      writeFileSync(join(root, `proc/${pid}/comm`), `${comm}\n`);
      writeFileSync(join(root, `proc/${pid}/stat`), `${pid} (${comm}) S ${ppid} ${pid} ${pid}\n`);
    }
    writeFileSync(join(root, 'proc/cpuinfo'), 'processor\t: 0\nvendor_id\t: AuthenticAMD\nflags\t\t: fpu sse2\n');
    writeFileSync(join(root, 'proc/swaps'), 'Filename Type Size Used Priority\n');
    writeFileSync(join(root, 'proc/meminfo'), 'SwapTotal: 0 kB\nSwapFree: 0 kB\n');
    writeFileSync(join(root, 'proc/loadavg'), '0.1 0.1 0.1 1/100 20\n');
    mkdirSync(join(root, 'etc/signal-tree'), { recursive: true });
    writeFileSync(join(root, MARKER), 'ax42-gates\n');
    chmodSync(join(root, MARKER), 0o644);
    return root;
  }
  const options = (root: string) => ({ root, env, selfPid: 20, rootUid: uid, system: { detectVirt: () => 'none' } });

  /** Main's gates run: preflight, sampler, a baseline, the re-check; the directory is what the artifact holds. */
  function mainRun(boost: string) {
    const root = gateRunner(boost);
    const dir = temp();
    // The identity and host part of the preflight; the toolchain is gate-host.spec.ts's concern.
    writeFileSync(join(dir, PRE_FILE), JSON.stringify(checkPre(options(root))));
    const at = new Date().toISOString();
    writeFileSync(join(dir, SAMPLES_FILE), JSON.stringify(addSample(newSamples({ pid: 9, ownWorker: 10, at }), readActivity(root, { selfPid: 20 }), at)));
    writeFileSync(join(dir, BROWSERS_FILE), JSON.stringify({ phase: 'browsers', enforced: true, problems: [] }));
    writeFileSync(join(dir, BASELINE_FILE), JSON.stringify({ kind: 'aa', scenarios: {} }));
    return { root, dir, post: () => recheck({ dir, ...options(root), stop: () => {} }) };
  }
  const seenIn = (dir: string) => ({ artifactId: 70, path: join(dir, BASELINE_FILE), host: baselineHost(dir), gatesRunner: 'ax42-gates' });

  it('reads the runner, governor, boost and amd-pstate mode the preflight recorded, and the same values for a PR run', () => {
    const { dir, post } = mainRun('0');
    expect(post().invalid).toBeNull();
    expect(baselineHost(dir)).toEqual({ ...gateHost, invalid: null });
    const pr = comparableHost(checkPre(options(gateRunner('0'))));
    expect(decide({ current: pr, approved: true, listing: { runs: [run(7)] }, inspect: () => seenIn(dir) }).action).toBe('use');
  });

  it('refuses when boost on the PR run differs from the baseline', () => {
    const { dir, post } = mainRun('0');
    post();
    const pr = comparableHost(checkPre(options(gateRunner('1'))));
    expect(decide({ current: pr, approved: true, listing: { runs: [run(7)] }, inspect: () => seenIn(dir) }).reason).toMatch(/recorded with boost off and this run has on/);
  });

  it('reads a baseline the re-check marked invalid as invalid', () => {
    const { root, dir, post } = mainRun('0');
    writeFileSync(join(root, 'sys/devices/system/cpu/cpu1/cpufreq/scaling_governor'), 'powersave\n');
    post();
    expect(baselineHost(dir).invalid).toMatch(/^the governor changed during the run: performance → performance\/powersave/);
  });

  it('reads a baseline with no post-run check, or none at all, as not comparable', () => {
    const { dir } = mainRun('0');
    expect(baselineHost(dir).invalid).toBe(`it has no post-run gate-host check (${POST_FILE})`);
    const legacy = temp();
    writeFileSync(join(legacy, BASELINE_FILE), '{}');
    writeFileSync(join(legacy, 'recorded-on.json'), JSON.stringify({ runnerEnvironment: 'self-hosted', runnerName: 'agent-vm' }));
    expect(baselineHost(legacy)).toMatchObject({ onGateRunner: false, runnerName: null });
  });
});
