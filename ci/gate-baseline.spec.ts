import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BASELINE_FILE, baselineHost, comparableHost, decide, newestMainArtifact } from './gate-baseline.mjs';
import { MARKER, POST_FILE, PRE_FILE, checkPre, preflight, recheck } from './gate-host.mjs';

const artifact = { id: 7, created_at: '2026-11-20T00:00:00Z' };
const gateHost = { onGateRunner: true, runnerName: 'ax42-gates', governor: 'performance', boost: 'off' };
const current = gateHost;
const offRunner = { onGateRunner: false, runnerName: 'GitHub Actions 3', governor: null, boost: 'unknown' };
const download =
  (host: Partial<typeof gateHost> & { invalid?: string | null } = {}) =>
  () => ({ path: '/tmp/main-gates/aa-latest.json', host: { ...gateHost, invalid: null, ...host } });
const ok = download();
const broken = () => ({ error: 'HTTP 403: Resource not accessible by integration' });

describe('gate baseline fetch', () => {
  it('uses main baseline when it downloads', () => {
    expect(decide({ current, approved: true, listing: { artifact }, download: ok })).toMatchObject({ action: 'use', path: '/tmp/main-gates/aa-latest.json' });
  });

  it('fails when main has a baseline but fetching it fails, approved or not', () => {
    expect(decide({ current, approved: false, listing: { artifact }, download: broken }).action).toBe('fail');
    expect(decide({ current, approved: true, listing: { artifact }, download: broken }).action).toBe('fail');
  });

  it('fails when the artifact listing fails, for example without actions: read', () => {
    expect(decide({ current, approved: false, listing: { error: 'HTTP 403' }, download: ok }).action).toBe('fail');
  });

  it('allows "no baseline yet" only while budgets.json is not approved', () => {
    expect(decide({ current, approved: false, listing: { artifact: null }, download: ok }).action).toBe('none');
    expect(decide({ current, approved: true, listing: { artifact: null }, download: ok }).action).toBe('fail');
  });

  it('compares only a run on the gate runner with a baseline recorded on it', () => {
    expect(decide({ current, approved: true, listing: { artifact }, download: ok }).action).toBe('use');
    const elsewhere = download({ onGateRunner: false, runnerName: null });
    expect(decide({ current, approved: false, listing: { artifact }, download: elsewhere }).action).toBe('none');
    expect(decide({ current, approved: true, listing: { artifact }, download: elsewhere })).toEqual({
      action: 'fail',
      reason: "budgets.json is approved but main's newest baseline (artifact 7) was not recorded on the gate runner",
    });
    expect(decide({ current: offRunner, approved: false, listing: { artifact }, download: ok }).action).toBe('none');
    expect(decide({ current: offRunner, approved: true, listing: { artifact }, download: ok }).action).toBe('fail');
  });

  it('still fails off the gate runner when the listing fails', () => {
    expect(decide({ current: offRunner, approved: false, listing: { error: 'HTTP 403' }, download: ok }).action).toBe('fail');
  });

  const differing: Array<[string, Partial<typeof gateHost>, string]> = [
    ['boost', { boost: 'on' }, 'was recorded with boost on and this run has off'],
    ['governor', { governor: 'performance/schedutil' }, 'was recorded with the governor performance/schedutil and this run has performance'],
    ['runner', { runnerName: 'ax42-old' }, 'was recorded with the runner ax42-old and this run has ax42-gates'],
  ];
  it.each(differing)('refuses a baseline whose %s differs from this run, and says which', (_what, host, why) => {
    expect(decide({ current, approved: false, listing: { artifact }, download: download(host) })).toEqual({
      action: 'none',
      reason: `main's newest baseline (artifact 7) ${why}; budgets.json is not approved, so this run only records`,
    });
    expect(decide({ current, approved: true, listing: { artifact }, download: download(host) })).toEqual({
      action: 'fail',
      reason: `budgets.json is approved but main's newest baseline (artifact 7) ${why}`,
    });
  });

  it('never compares with an invalid baseline, and does not fall back to an older one', () => {
    const invalid = download({ invalid: 'boost changed during the run: off → on' });
    expect(decide({ current, approved: false, listing: { artifact }, download: invalid })).toMatchObject({ action: 'none', reason: expect.stringContaining('is invalid: boost changed during the run') });
    expect(decide({ current, approved: true, listing: { artifact }, download: invalid })).toMatchObject({ action: 'fail', reason: expect.stringContaining('is invalid') });
  });

  it('picks the newest unexpired gate-results artifact from main only', () => {
    const list = [
      { id: 1, name: 'gate-results', expired: false, created_at: '2026-11-19T00:00:00Z', workflow_run: { head_branch: 'main' } },
      { id: 2, name: 'gate-results', expired: false, created_at: '2026-11-21T00:00:00Z', workflow_run: { head_branch: 'rebuild/x' } },
      { id: 3, name: 'gate-results', expired: true, created_at: '2026-11-22T00:00:00Z', workflow_run: { head_branch: 'main' } },
      { id: 4, name: 'oracle-report', expired: false, created_at: '2026-11-23T00:00:00Z', workflow_run: { head_branch: 'main' } },
      { id: 5, name: 'gate-results', expired: false, created_at: '2026-11-20T00:00:00Z', workflow_run: { head_branch: 'main' } },
    ];
    expect(newestMainArtifact(list)?.id).toBe(5);
    expect(newestMainArtifact([])).toBeNull();
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
  const env = { SIGNAL_TREE_GATES_RUNNER: '["self-hosted","linux","x64","signal-tree-gates"]', RUNNER_NAME: 'ax42-gates' };

  /** A gate runner with amd-pstate boost `boost` on 2 CPUs, its own Runner.Worker, and the marker. */
  function gateRunner(boost: string) {
    const root = temp();
    for (const i of [0, 1]) {
      mkdirSync(join(root, `sys/devices/system/cpu/cpu${i}/cpufreq`), { recursive: true });
      writeFileSync(join(root, `sys/devices/system/cpu/cpu${i}/cpufreq/scaling_governor`), 'performance\n');
      mkdirSync(join(root, `sys/devices/system/cpu/cpufreq/policy${i}`), { recursive: true });
      writeFileSync(join(root, `sys/devices/system/cpu/cpufreq/policy${i}/boost`), `${boost}\n`);
    }
    mkdirSync(join(root, 'proc/10'), { recursive: true });
    mkdirSync(join(root, 'proc/20'), { recursive: true });
    writeFileSync(join(root, 'proc/10/comm'), 'Runner.Worker\n');
    writeFileSync(join(root, 'proc/10/stat'), '10 (Runner.Worker) S 1 10 10\n');
    writeFileSync(join(root, 'proc/20/comm'), 'node\n');
    writeFileSync(join(root, 'proc/20/stat'), '20 (node) S 10 20 20\n');
    writeFileSync(join(root, 'proc/swaps'), 'Filename Type Size Used Priority\n');
    writeFileSync(join(root, 'proc/meminfo'), 'SwapTotal: 0 kB\nSwapFree: 0 kB\n');
    writeFileSync(join(root, 'proc/loadavg'), '0.1 0.1 0.1 1/100 20\n');
    mkdirSync(join(root, 'etc/signal-tree'), { recursive: true });
    writeFileSync(join(root, MARKER), 'ax42-gates\n');
    chmodSync(join(root, MARKER), 0o644);
    return root;
  }
  const options = (root: string) => ({ root, env, selfPid: 20, rootUid: uid });

  /** Main's gates run: preflight, a baseline, the re-check; the directory is what the artifact holds. */
  function mainRun(boost: string) {
    const root = gateRunner(boost);
    const dir = temp();
    writeFileSync(join(dir, PRE_FILE), JSON.stringify(preflight(options(root))));
    writeFileSync(join(dir, BASELINE_FILE), JSON.stringify({ kind: 'aa', scenarios: {} }));
    return { root, dir, post: () => recheck({ dir, ...options(root) }) };
  }

  it('reads the runner, governor and boost the preflight recorded, and the same values for a PR run', () => {
    const { dir, post } = mainRun('0');
    post();
    expect(baselineHost(dir)).toEqual({ ...gateHost, invalid: null });
    const pr = comparableHost(checkPre(options(gateRunner('0'))));
    expect(decide({ current: pr, approved: true, listing: { artifact }, download: () => ({ path: join(dir, BASELINE_FILE), host: baselineHost(dir) }) }).action).toBe('use');
  });

  it('refuses when boost on the PR run differs from the baseline', () => {
    const { dir, post } = mainRun('0');
    post();
    const pr = comparableHost(checkPre(options(gateRunner('1'))));
    expect(decide({ current: pr, approved: true, listing: { artifact }, download: () => ({ path: join(dir, BASELINE_FILE), host: baselineHost(dir) }) }).reason).toMatch(/recorded with boost off and this run has on/);
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
