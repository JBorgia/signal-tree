// Structural checks on the workflows that run the gates, so an edit cannot
// silently drop what findings 1, 4 and 6 on PR #15 and the ruling on #14 need.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { repoRoot } from './entry-graph.mjs';
import { ADAPTERS } from './done-check.mjs';

export function loadWorkflows(root = repoRoot) {
  const read = (name) => parse(readFileSync(join(root, '.github', 'workflows', name), 'utf8'));
  return { ci: read('ci.yml'), nightly: read('nightly.yml'), soak: read('soak.yml') };
}

const runs = (job) => (job?.steps ?? []).map((s) => s.run ?? '').join('\n');
const uploads = (job) => (job?.steps ?? []).filter((s) => String(s.uses ?? '').startsWith('actions/upload-artifact')).map((s) => s.with?.name);

export function workflowProblems({ ci, nightly, soak }) {
  const problems = [];
  const gates = ci?.jobs?.gates;
  if (!gates) return ['ci.yml has no gates job'];
  if (gates.permissions?.actions !== 'read') problems.push('ci.yml gates: needs permissions.actions: read to fetch main\'s baseline');
  if (!runs(gates).includes('node ci/gate-baseline.mjs')) problems.push('ci.yml gates: the baseline must come from ci/gate-baseline.mjs, which fails closed');
  if (/gh run download|No baseline on main yet/.test(runs(gates))) problems.push('ci.yml gates: an inline baseline fetch can swallow failures');
  if (!String(gates.concurrency?.group ?? '').includes('github.head_ref || github.ref_name')) problems.push('ci.yml gates: concurrency group must be shared by a branch\'s push and pull_request runs');
  if (gates.concurrency?.['cancel-in-progress'] !== true) problems.push('ci.yml gates: concurrency must cancel the superseded run');
  const condition = String(gates.if ?? '');
  if (!condition.includes("github.event_name == 'pull_request'") || !condition.includes('needs.pr-lookup.outputs.open')) {
    problems.push('ci.yml gates: a branch with an open PR must run the gates through pull_request only');
  }
  if (!ci.jobs['pr-lookup']) problems.push('ci.yml: missing the pr-lookup job');

  const nightlyJobs = Object.values(nightly?.jobs ?? {});
  const named = (name) => nightlyJobs.find((j) => j.name === name);
  if (!nightly?.on?.schedule) problems.push('nightly.yml: not scheduled');
  if (!named('oracle (100k)') || !runs(named('oracle (100k)')).includes('--runs 100000')) problems.push('nightly.yml: needs an "oracle (100k)" job running 100,000 sequences');
  else if (!uploads(named('oracle (100k)')).includes('nightly-oracle')) problems.push('nightly.yml: the oracle job must upload nightly-oracle');
  const present = ADAPTERS.filter((a) => named(`gates (${a})`));
  if (present.length === 0) problems.push('nightly.yml: no "gates (<adapter>)" job');
  for (const adapter of present) {
    const job = named(`gates (${adapter})`);
    if (!runs(job).includes('--s5-compressed')) problems.push(`nightly.yml gates (${adapter}): must run the compressed S5`);
    if (!uploads(job).includes(`nightly-gates-${adapter}`)) problems.push(`nightly.yml gates (${adapter}): must upload nightly-gates-${adapter}, which done-check reads`);
  }

  const soakJob = Object.values(soak?.jobs ?? {})[0];
  const cron = String(soak?.on?.schedule?.[0]?.cron ?? '');
  if (cron.split(/\s+/)[4] === undefined || cron.split(/\s+/)[4] === '*') problems.push('soak.yml: must run weekly');
  if (!runs(soakJob).includes('--s5-full')) problems.push('soak.yml: must run the full 8-hour S5');
  if (!String(soakJob?.if ?? '').includes('SIGNAL_TREE_GATES_RUNNER')) problems.push('soak.yml: must run only on the dedicated gates runner');
  return problems;
}
