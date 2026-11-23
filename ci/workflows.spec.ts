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
    ['a compressed weekly soak', (w) => void (w.soak.jobs['soak-angular'].steps.at(-2).run = 'pnpm bench S5 --s5-compressed'), /full 8-hour/],
  ];

  it.each(planted)('catches %s', (_name, plant, message) => {
    const workflows = fresh();
    plant(workflows);
    expect(workflowProblems(workflows).join('\n')).toMatch(message);
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
