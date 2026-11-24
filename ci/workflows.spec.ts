import { describe, expect, it } from 'vitest';
import { loadWorkflows, workflowProblems } from './workflows.mjs';

const fresh = () => structuredClone(loadWorkflows());
type Workflows = ReturnType<typeof fresh>;

describe('gate workflows', () => {
  it('hold every requirement as committed', () => {
    expect(workflowProblems(fresh())).toEqual([]);
  });

  const planted: Array<[string, (w: Workflows) => void, RegExp]> = [
    ['no actions: read on the gates job', (w) => void delete w.ci.jobs.gates.permissions.actions, /actions: read/],
    ['an inline baseline fetch that swallows failures', (w) => void w.ci.jobs.gates.steps.push({ run: 'gh run download 1 || echo "No baseline on main yet"' }), /swallow/],
    ['the fail-closed baseline script removed', (w) => void (w.ci.jobs.gates.steps = w.ci.jobs.gates.steps.filter((s: { run?: string }) => !String(s.run ?? '').includes('gate-baseline'))), /fails closed/],
    ['a per-ref concurrency group', (w) => void (w.ci.jobs.gates.concurrency.group = 'gates-${{ github.ref }}'), /shared/],
    ['gates on every push, PR or not', (w) => void (w.ci.jobs.gates.if = 'always()'), /pull_request only/],
    ['gates on a fork\'s pull request', (w) => void (w.ci.jobs.gates.if = String(w.ci.jobs.gates.if).replace("github.event.pull_request.head.repo.full_name == github.repository", 'true')), /fork/],
    ['no oracle (100k) job', (w) => void delete w.nightly.jobs.oracle, /oracle \(100k\)/],
    ['a nightly gates job uploading under another name', (w) => void (w.nightly.jobs['gates-angular'].steps.at(-1).with.name = 'results'), /nightly-gates-angular/],
    ['a daily soak', (w) => void (w.soak.on.schedule[0].cron = '0 1 * * *'), /weekly/],
    ['a compressed weekly soak', (w) => void (step(w.soak.jobs['soak-angular'], /--s5-full/).run = 'pnpm bench S5 --s5-compressed'), /full 8-hour/],
  ];

  it.each(planted)('catches %s', (_name, plant, message) => {
    const workflows = fresh();
    plant(workflows);
    expect(workflowProblems(workflows).join('\n')).toMatch(message);
  });
});

type Step = { name?: string; uses?: string; run?: string; if?: string; shell?: string; with?: Record<string, unknown>; env?: Record<string, string>; 'continue-on-error'?: boolean };
type Job = { name?: string; 'runs-on'?: string; env?: Record<string, string>; 'continue-on-error'?: boolean; steps: Step[] };
const step = (job: Job, run: RegExp) => job.steps.find((s) => run.test(String(s.run ?? '')))!;
const without = (job: Job, run: RegExp) => void (job.steps = job.steps.filter((s) => !run.test(String(s.run ?? ''))));
const move = (job: Job, from: Step, before: Step | 'end') => {
  job.steps.splice(job.steps.indexOf(from), 1);
  if (before === 'end') job.steps.push(from);
  else job.steps.splice(job.steps.indexOf(before), 0, from);
};
const PRE = /node ci\/gate-host\.mjs --pre/;
const BROWSERS = /node ci\/gate-host\.mjs --browsers/;
const POST = /node ci\/gate-host\.mjs --post/;
const BENCH = /pnpm bench (?:M1|all|S5)/;
const upload = (job: Job) => job.steps.find((s) => String(s.uses).startsWith('actions/upload-artifact'))!;

describe('gate-host checks in every gate workflow (#18)', () => {
  const gateJobs: Array<[string, (w: Workflows) => Job, RegExp]> = [
    ['ci.yml gates', (w) => w.ci.jobs.gates, /^ci\.yml(?: gates)?: /],
    ['nightly.yml gates (angular)', (w) => w.nightly.jobs['gates-angular'], /^nightly\.yml(?: gates \(angular\))?: /],
    ['soak.yml', (w) => w.soak.jobs['soak-angular'], /^soak\.yml: /],
  ];

  const planted: Array<[string, (job: Job) => void, RegExp]> = [
    ['no post-run re-check', (job) => without(job, POST), /must re-check the host after the gates/],
    ['a post-run re-check without if: always()', (job) => void delete step(job, POST).if, /re-check must run with if: always\(\)/],
    ['a post-run re-check only on success', (job) => void (step(job, POST).if = 'success()'), /re-check must run with if: always\(\)/],
    ['a post-run re-check after the upload', (job) => move(job, step(job, POST), 'end'), /upload step \d+ must come after the gate-host re-check/],
    ['a post-run re-check before the gates', (job) => move(job, step(job, POST), step(job, BENCH)), /re-check must run after every bench step/],
    ['a post-run re-check that swallows its failure', (job) => void (step(job, POST).run = 'node ci/gate-host.mjs --post || true'), /re-check step must run exactly/],
    ['a post-run re-check that continues on error', (job) => void (step(job, POST)['continue-on-error'] = true), /re-check step must not set continue-on-error/],
    ['no preflight', (job) => without(job, PRE), /must run the gate-host preflight/],
    ['a preflight after the gates', (job) => move(job, step(job, PRE), step(job, POST)), /preflight must run before every bench step/],
    ['a preflight with an if:', (job) => void (step(job, PRE).if = "github.ref == 'refs/heads/main'"), /preflight step must not have an if:/],
    ['a preflight that swallows its failure', (job) => void (step(job, PRE).run = 'node ci/gate-host.mjs --pre || true'), /preflight step must run exactly/],
    ['a preflight followed by another command', (job) => void (step(job, PRE).run = 'node ci/gate-host.mjs --pre; exit 0'), /preflight step must run exactly/],
    ['a preflight that is only echoed', (job) => void (step(job, PRE).run = 'echo node ci/gate-host.mjs --pre'), /preflight step must run exactly/],
    ['a preflight with a trailing comment', (job) => void (step(job, PRE).run = 'node ci/gate-host.mjs --pre # skip'), /preflight step must run exactly/],
    ['a preflight run in another shell', (job) => void (step(job, PRE).shell = 'bash --noprofile --norc {0} || true'), /preflight step must not set shell/],
    ['a preflight that continues on error', (job) => void (step(job, PRE)['continue-on-error'] = true), /preflight step must not set continue-on-error/],
    ['a second preflight', (job) => void job.steps.splice(1, 0, { run: 'node ci/gate-host.mjs --pre' }), /preflight in exactly one step/],
    ['a bench step that continues on error', (job) => void (step(job, BENCH)['continue-on-error'] = true), /bench step \d+ must not continue on error/],
    ['a job that continues on error', (job) => void (job['continue-on-error'] = true), /must not continue on error/],
    ['pnpm run bench after the re-check', (job) => void job.steps.push({ run: 'pnpm run bench S8' }), /re-check must run after every bench step/],
    ['pnpm --filter … bench after the re-check', (job) => void job.steps.push({ run: 'pnpm --filter @signal-tree/bench bench M1' }), /re-check must run after every bench step/],
    ['the harness CLI before the preflight', (job) => void job.steps.splice(1, 0, { run: 'cd bench && node runner/cli.ts S8' }), /preflight must run before every bench step/],
    ['a job that does not say when it is aimed at the gate runner', (job) => void delete job.env, /must set env SIGNAL_TREE_GATES_RUNNER:/],
    ['no pinned gate runner name', (job) => void delete job.env!['SIGNAL_TREE_GATE_RUNNER_NAME'], /must set env SIGNAL_TREE_GATE_RUNNER_NAME/],
    ['a runs-on that is not the gates runner variable', (job) => void (job['runs-on'] = '[self-hosted, linux]'), /runs-on must be the gates runner variable/],
    ['an upload that leaves out the gate-host records', (job) => void (upload(job).with!.path = 'bench/out/results-*.json'), /must include bench\/out\/\*\.json/],
    ['an upload only on success', (job) => void delete upload(job).if, /upload step \d+ must run with if: always\(\)/],
    ['a second upload before the re-check', (job) => void job.steps.splice(1, 0, { uses: 'actions/upload-artifact@v4', if: 'always()', with: { name: 'early', path: 'bench/out/*.json' } }), /upload step 2 must come after the gate-host re-check/],
    ['SIGNAL_TREE_GATE_HOST set by the workflow', (job) => void (job.env = { ...job.env, SIGNAL_TREE_GATE_HOST: '${{ runner.name }}' }), /only ci\/gate-host\.mjs --pre may set it/],
    ['signal_tree_gate_host in another case', (job) => void (job.env = { ...job.env, signal_tree_gate_host: 'ax42-gates' }), /sets or names SIGNAL_TREE_GATE_HOST/],
    ['SIGNAL_TREE_GATE_HOST written by a step', (job) => void job.steps.splice(1, 0, { run: 'echo "SIGNAL_TREE_GATE_HOST=$RUNNER_NAME" >> "$GITHUB_ENV"' }), /writes \$GITHUB_ENV/],
    ['a value built with format()', (job) => void (job.env = { ...job.env, NAME: "${{ format('{0}_{1}', 'SIGNAL_TREE_GATE', 'HOST') }}" }), /builds a value with format\(\) or the env context/],
    ['a value built from the env context', (job) => void (step(job, BENCH).env = { X: '${{ env.SIGNAL_TREE_GATES_RUNNER }}' }), /builds a value with format\(\) or the env context/],
    ['an environment write spelled another way', (job) => void job.steps.splice(1, 0, { run: 'printf "%s=%s\\n" "$K" "$V" >> $github_env' }), /writes \$GITHUB_ENV/],
    ['a preflight after pnpm install', (job) => move(job, step(job, PRE), step(job, BENCH)), /preflight must be the first step after checkout/],
    ['a step before the preflight', (job) => void job.steps.splice(1, 0, { run: 'pnpm install --frozen-lockfile' }), /preflight must be the first step after checkout/],
    ['setup-node on the gate runner', (job) => void job.steps.splice(2, 0, { uses: 'actions/setup-node@v4', with: { 'node-version-file': '.nvmrc' } }), /step 3 installs a toolchain or browser, or uses sudo/],
    ['pnpm/action-setup on the gate runner', (job) => void job.steps.splice(2, 0, { uses: 'pnpm/action-setup@v4', if: "github.ref == 'refs/heads/main'" }), /step 3 installs a toolchain or browser/],
    ['a browser install on the gate runner', (job) => void job.steps.splice(2, 0, { run: 'pnpm --filter @signal-tree/bench exec playwright install chromium' }), /step 3 installs a toolchain or browser/],
    ['sudo on the gate runner', (job) => void job.steps.splice(2, 0, { run: 'sudo sysctl -w kernel.perf_event_paranoid=1' }), /step 3 installs a toolchain or browser, or uses sudo/],
    ['a global package install on the gate runner', (job) => void job.steps.splice(2, 0, { run: 'npm install -g pnpm@10.17.0' }), /step 3 installs a toolchain or browser/],
    ['a piped installer on the gate runner', (job) => void job.steps.splice(2, 0, { run: 'curl -fsSL https://get.pnpm.io/install.sh | sh -' }), /step 3 installs a toolchain or browser/],
    ['no PLAYWRIGHT_BROWSERS_PATH for the root-installed Chromium', (job) => void delete job.env!['PLAYWRIGHT_BROWSERS_PATH'], /must set env PLAYWRIGHT_BROWSERS_PATH/],
    ['a job that does not start with checkout', (job) => void job.steps.shift(), /must start with actions\/checkout/],
    ['no Chromium build check', (job) => without(job, BROWSERS), /must check the preinstalled Chromium against the Playwright lock/],
    ['a Chromium build check before pnpm install', (job) => move(job, step(job, BROWSERS), step(job, /^pnpm install/)), /Chromium build check must run after pnpm install/],
    ['a Chromium build check after the gates', (job) => move(job, step(job, BROWSERS), step(job, POST)), /Chromium build check must run before every harness or bench step/],
    ['a Chromium build check that swallows its failure', (job) => void (step(job, BROWSERS).run = 'node ci/gate-host.mjs --browsers || echo skipped'), /Chromium build check must run exactly/],
    ['a Chromium build check with an if:', (job) => void (step(job, BROWSERS).if = "vars.SIGNAL_TREE_GATES_RUNNER == ''"), /Chromium build check must not have an if:/],
    ['a second Chromium build check', (job) => void job.steps.splice(job.steps.indexOf(step(job, BROWSERS)), 0, { run: 'node ci/gate-host.mjs --browsers' }), /Chromium build in exactly one step/],
  ];

  it.each(gateJobs)('%s holds them as committed', (_label, job) => {
    const workflows = fresh();
    const steps = job(workflows).steps;
    const index = (test: RegExp) => steps.findIndex((s) => test.test(String(s.run ?? '')));
    expect(String(steps[0]!.uses)).toMatch(/^actions\/checkout@/);
    expect(index(PRE)).toBe(1);
    expect(steps[index(PRE)]).toEqual({ name: expect.any(String), run: 'node ci/gate-host.mjs --pre' });
    for (const s of steps.filter((s) => /setup|playwright install/.test(`${s.uses ?? ''} ${s.run ?? ''}`))) expect(s.if).toBe("vars.SIGNAL_TREE_GATES_RUNNER == ''");
    expect(index(PRE)).toBeLessThan(index(BENCH));
    expect(steps[index(POST)]).toEqual({ name: expect.any(String), if: 'always()', run: 'node ci/gate-host.mjs --post' });
    expect(index(POST)).toBeGreaterThan(index(BENCH));
    expect(steps[index(BROWSERS)]).toEqual({ name: expect.any(String), run: 'node ci/gate-host.mjs --browsers' });
    expect(index(BROWSERS)).toBeGreaterThan(index(/^pnpm install --frozen-lockfile$/));
    expect(index(BROWSERS)).toBeLessThan(index(/bench:test|@signal-tree\/bench typecheck|pnpm bench /));
    expect(steps.at(-1)).toMatchObject({ if: 'always()', with: { path: 'bench/out/*.json' } });
    expect(job(workflows).env).toEqual({
      SIGNAL_TREE_GATES_RUNNER: '${{ vars.SIGNAL_TREE_GATES_RUNNER }}',
      SIGNAL_TREE_GATE_RUNNER_NAME: '${{ vars.SIGNAL_TREE_GATE_RUNNER_NAME }}',
      PLAYWRIGHT_BROWSERS_PATH: "${{ vars.SIGNAL_TREE_GATES_RUNNER != '' && '/opt/ms-playwright' || '' }}",
    });
  });

  const cases = gateJobs.flatMap(([label, job, prefix]) => planted.map(([name, plant, message]) => [label, name, job, plant, prefix, message] as const));
  it.each(cases)('%s: catches %s', (_label, _name, job, plant, prefix, message) => {
    const workflows = fresh();
    plant(job(workflows));
    const problems = workflowProblems(workflows);
    expect(problems.filter((p) => prefix.test(p)).join('\n')).toMatch(message);
  });

  it('requires the gates job to keep the name ci/gate-baseline.mjs finds it by', () => {
    const workflows = fresh();
    workflows.ci.jobs.gates.name = 'Gates';
    expect(workflowProblems(workflows).join('\n')).toMatch(/must be named "Gates \(Angular reference app\)"/);
  });
});

describe('approve-non-owned.yml', () => {
  type Step = { uses?: string; run?: string; with?: Record<string, unknown>; env?: Record<string, string> };
  const steps = (w: Workflows): Step[] => w.approve.jobs.approve.steps;
  const checkout = (w: Workflows) => steps(w).find((s) => String(s.uses).startsWith('actions/checkout@'))!;

  it('runs main\'s code only, with contents: read and pull-requests: write', () => {
    const { approve } = fresh();
    expect(Object.keys(approve.on)).toEqual(['pull_request_target']);
    expect(approve.permissions).toEqual({ contents: 'read', 'pull-requests': 'write' });
    expect(checkout(fresh()).with).toEqual({ 'persist-credentials': false });
  });

  const planted: Array<[string, (w: Workflows) => void, RegExp]> = [
    ['a checkout of the head SHA', (w) => void (checkout(w).with!.ref = '${{ github.event.pull_request.head.sha }}'), /no ref: or repository:/],
    ['a checkout of the merge ref', (w) => void (checkout(w).with!.ref = 'refs/pull/${{ github.event.number }}/merge'), /never check it out/],
    ['a checkout of the head repository', (w) => void (checkout(w).with!.repository = '${{ github.event.pull_request.head.repo.full_name }}'), /no ref: or repository:/],
    ['a step that fetches the pull request', (w) => void steps(w).splice(1, 0, { run: 'git fetch origin pull/80/head && git checkout FETCH_HEAD' }), /fetches or checks out code/],
    ['gh pr checkout', (w) => void steps(w).splice(1, 0, { run: 'gh pr checkout 80' }), /fetches or checks out code/],
    ['the head ref in a run step', (w) => void (steps(w).at(-1)!.run = 'node ci/approve-non-owned.mjs ${{ github.head_ref }}'), /never check it out/],
    ['a stored token', (w) => void delete checkout(w).with!['persist-credentials'], /persist-credentials: false/],
    ['contents: write', (w) => void (w.approve.permissions.contents = 'write'), /exactly contents: read and pull-requests: write/],
    ['an extra permission', (w) => void (w.approve.permissions.actions = 'read'), /exactly contents: read and pull-requests: write/],
    ['write-all', (w) => void (w.approve.permissions = 'write-all'), /exactly contents: read and pull-requests: write/],
    ['a job that widens permissions', (w) => void (w.approve.jobs.approve.permissions = { contents: 'write', 'pull-requests': 'write' }), /approve: permissions must be exactly/],
    ['a pull_request trigger as well', (w) => void (w.approve.on.pull_request = {}), /pull_request_target only/],
    ['a missing ready_for_review', (w) => void (w.approve.on.pull_request_target.types = ['opened', 'synchronize', 'reopened']), /ready_for_review only/],
    ['pull requests into any branch', (w) => void delete w.approve.on.pull_request_target.branches, /into main only/],
    ['an action pinned by tag', (w) => void (checkout(w).uses = 'actions/checkout@v4'), /pinned by full commit SHA/],
    ['a secret', (w) => void (steps(w).at(-1)!.env = { GH_TOKEN: '${{ secrets.PAT }}' }), /uses a secret/],
    ['no fork check on the job', (w) => void delete w.approve.jobs.approve.if, /fork/],
    ['another decision script', (w) => void (steps(w).at(-1)!.run = 'node ci/approve.mjs'), /node ci\/approve-non-owned\.mjs/],
    ['no workflow at all', (w) => void delete (w as Partial<Workflows>).approve, /approve-non-owned\.yml is missing/],
  ];

  it.each(planted)('catches %s', (_name, plant, message) => {
    const workflows = fresh();
    plant(workflows);
    expect(workflowProblems(workflows).join('\n')).toMatch(message);
  });
});

describe('spec-test-entries.yml (ruling of 2026-11-24 on test tags)', () => {
  type Step = { uses?: string; run?: string; if?: string; with?: Record<string, unknown>; env?: Record<string, string>; 'continue-on-error'?: boolean };
  const job = (w: Workflows) => w.entries!.jobs.entries;
  const steps = (w: Workflows): Step[] => job(w).steps;
  const checkout = (w: Workflows) => steps(w).find((s) => String(s.uses).startsWith('actions/checkout@'))!;

  it('runs on every pull request and each review, read-only, under the required name', () => {
    const { entries } = fresh();
    expect(Object.keys(entries!.on).sort()).toEqual(['pull_request', 'pull_request_review']);
    expect(entries!.permissions).toEqual({ contents: 'read', 'pull-requests': 'read' });
    expect(job(fresh()).name).toBe("Existing spec-test entries change only with JBorgia's approval");
  });

  const planted: Array<[string, (w: Workflows) => void, RegExp]> = [
    ['no workflow at all', (w) => void delete (w as Partial<Workflows>).entries, /spec-test-entries\.yml is missing/],
    ['a job-level if:', (w) => void (job(w).if = "github.actor != 'signal-tree-ci[bot]'"), /no if:/],
    ['continue-on-error on the job', (w) => void (job(w)['continue-on-error'] = true), /no continue-on-error/],
    ['a step that may be skipped', (w) => void (steps(w).at(-1)!.if = 'false'), /no step may have if:/],
    ['a step allowed to fail', (w) => void (steps(w).at(-1)!['continue-on-error'] = true), /no step may have if:/],
    ['another job name', (w) => void (job(w).name = 'Spec test entries'), /the name the main ruleset requires/],
    ['a push trigger as well', (w) => void (w.entries!.on.push = {}), /pull_request and pull_request_review only/],
    ['a paths filter', (w) => void (w.entries!.on.pull_request = { paths: ['tests/spec-tests.json'] }), /no types, branches or paths filter/],
    ['no rerun on a dismissal', (w) => void (w.entries!.on.pull_request_review.types = ['submitted']), /submitted or dismissed/],
    ['a write token', (w) => void (w.entries!.permissions['pull-requests'] = 'write'), /exactly contents: read and pull-requests: read/],
    ['a job that widens permissions', (w) => void (job(w).permissions = { contents: 'write' }), /entries: permissions must be exactly/],
    ['a shallow checkout', (w) => void delete checkout(w).with!['fetch-depth'], /fetch-depth: 2/],
    ['a checkout of the head instead of the merge commit', (w) => void (checkout(w).with!.ref = '${{ github.event.pull_request.head.sha }}'), /merge commit/],
    ['an action pinned by tag', (w) => void (checkout(w).uses = 'actions/checkout@v4'), /pinned by full commit SHA/],
    ['another decision script', (w) => void (steps(w).at(-1)!.run = 'node ci/spec-tests.mjs check'), /node ci\/spec-test-entries\.mjs/],
    ['a secret', (w) => void (steps(w).at(-1)!.env = { GH_TOKEN: '${{ secrets.PAT }}' }), /uses a secret/],
    ['a second job', (w) => void (w.entries!.jobs.other = { 'runs-on': 'ubuntu-latest', steps: [] }), /exactly one job/],
  ];

  it.each(planted)('catches %s', (_name, plant, message) => {
    const workflows = fresh();
    plant(workflows);
    expect(workflowProblems(workflows).join('\n')).toMatch(message);
  });
});
