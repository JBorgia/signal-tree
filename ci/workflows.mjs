// Structural checks on the workflows, so an edit cannot silently drop what
// findings 1, 4 and 6 on PR #15 and the ruling on #14 need, nor let
// approve-non-owned.yml run pull request code with its write token.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { repoRoot } from './entry-graph.mjs';
import { ADAPTERS } from './done-check.mjs';

export function loadWorkflows(root = repoRoot) {
  const read = (name) => parse(readFileSync(join(root, '.github', 'workflows', name), 'utf8'));
  return { ci: read('ci.yml'), nightly: read('nightly.yml'), soak: read('soak.yml'), approve: read('approve-non-owned.yml') };
}

const runs = (job) => (job?.steps ?? []).map((s) => s.run ?? '').join('\n');
const uploads = (job) => (job?.steps ?? []).filter((s) => String(s.uses ?? '').startsWith('actions/upload-artifact')).map((s) => s.with?.name);

export function workflowProblems({ ci, nightly, soak, approve }) {
  const problems = approveProblems(approve);
  const gates = ci?.jobs?.gates;
  if (!gates) return [...problems, 'ci.yml has no gates job'];
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
  if (!condition.includes('github.event.pull_request.head.repo.full_name == github.repository')) {
    problems.push('ci.yml gates: must never run a fork\'s pull request on the self-hosted runner');
  }

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

const APPROVE_TYPES = ['opened', 'synchronize', 'reopened', 'ready_for_review'];
const APPROVE_PERMISSIONS = { contents: 'read', 'pull-requests': 'write' };
// Expressions that name the pull request's code; only the fork check may read head.repo.full_name.
const PR_CODE = /head\.sha|head\.ref|head_ref|merge_commit_sha|refs\/pull\/|pull\/\d|github\.event\.pull_request\.head\.(?!repo\.full_name\b)/;
const sameKeys = (a, b) => JSON.stringify(Object.keys(a ?? {}).sort()) === JSON.stringify(Object.keys(b).sort());
const samePermissions = (p) => typeof p === 'object' && p !== null && sameKeys(p, APPROVE_PERMISSIONS) && Object.entries(APPROVE_PERMISSIONS).every(([k, v]) => p[k] === v);

/**
 * approve-non-owned.yml runs on pull_request_target with a token that can
 * approve, so it must run only main's code: it checks out the base (no ref:,
 * no repository:, no stored credentials), never fetches the pull request,
 * pins every action by commit SHA, uses no secrets, and holds contents: read
 * and pull-requests: write only.
 */
function approveProblems(approve) {
  if (!approve) return ['approve-non-owned.yml is missing'];
  const problems = [];
  const name = 'approve-non-owned.yml';
  const on = approve.on ?? {};
  const target = on.pull_request_target;
  if (!sameKeys(on, { pull_request_target: 1 })) problems.push(`${name}: must run on pull_request_target only`);
  if (JSON.stringify([...(target?.types ?? [])].sort()) !== JSON.stringify([...APPROVE_TYPES].sort())) problems.push(`${name}: must run for ${APPROVE_TYPES.join(', ')} only`);
  if (JSON.stringify(target?.branches) !== '["main"]') problems.push(`${name}: must run for pull requests into main only`);
  if (!samePermissions(approve.permissions)) problems.push(`${name}: permissions must be exactly contents: read and pull-requests: write`);
  const text = JSON.stringify(approve);
  if (/secrets\./.test(text)) problems.push(`${name}: uses a secret; it needs only the GITHUB_TOKEN`);
  if (PR_CODE.test(text)) problems.push(`${name}: names the pull request's code (head SHA, head ref or a pull ref); it must never check it out`);
  const jobs = Object.entries(approve.jobs ?? {});
  if (jobs.length === 0) problems.push(`${name}: has no job`);
  for (const [id, job] of jobs) {
    if (job.permissions !== undefined && !samePermissions(job.permissions)) problems.push(`${name} ${id}: permissions must be exactly contents: read and pull-requests: write`);
    if (!String(job.if ?? '').includes('github.event.pull_request.head.repo.full_name == github.repository')) problems.push(`${name} ${id}: must skip a fork's pull request`);
    if (job.uses) problems.push(`${name} ${id}: must not call another workflow`);
    const steps = job.steps ?? [];
    for (const step of steps) {
      const uses = String(step.uses ?? '');
      if (uses && !/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/.test(uses)) problems.push(`${name} ${id}: ${uses} must be pinned by full commit SHA`);
      if (uses.startsWith('actions/checkout@')) {
        if (step.with?.ref !== undefined || step.with?.repository !== undefined) problems.push(`${name} ${id}: checkout must take the base branch (no ref: or repository:), never the pull request's code`);
        if (step.with?.['persist-credentials'] !== false) problems.push(`${name} ${id}: checkout must not store the token (persist-credentials: false)`);
      }
      if (/\b(git\s+(fetch|checkout|switch|pull|worktree)|gh\s+pr\s+checkout|gh\s+repo\s+clone)\b/.test(String(step.run ?? ''))) problems.push(`${name} ${id}: a step fetches or checks out code; only actions/checkout of the base may`);
    }
    if (!steps.some((step) => String(step.run ?? '').trim() === 'node ci/approve-non-owned.mjs')) problems.push(`${name} ${id}: must decide with node ci/approve-non-owned.mjs`);
  }
  return problems;
}
