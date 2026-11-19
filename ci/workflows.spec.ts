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
