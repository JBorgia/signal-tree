// Structural checks on the workflows, so an edit cannot silently drop what
// findings 1, 4 and 6 on PR #15, the ruling on #14 and the gate-host checks of
// #18 need, nor let approve-non-owned.yml run pull request code with its write
// token.
//
// This lint catches mistakes, not intent: a pull request can edit it along with
// the workflows, and the gates run that pull request's version. The control is
// code-owner review of .github/ and ci/ (BRIEF.md ruling 17); these checks keep
// a reviewer from having to spot every way an edit weakens the gate host checks.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { repoRoot } from './entry-graph.mjs';
import { ADAPTERS } from './done-check.mjs';
import { GATES_JOB } from './gate-baseline.mjs';

export function loadWorkflows(root = repoRoot) {
  const read = (name) => parse(readFileSync(join(root, '.github', 'workflows', name), 'utf8'));
  return { ci: read('ci.yml'), nightly: read('nightly.yml'), soak: read('soak.yml'), approve: read('approve-non-owned.yml') };
}

const runs = (job) => (job?.steps ?? []).map((s) => s.run ?? '').join('\n');
const isUpload = (s) => String(s.uses ?? '').startsWith('actions/upload-artifact');
const uploads = (job) => (job?.steps ?? []).filter(isUpload).map((s) => s.with?.name);

export const GATES_RUNNER_ENV = '${{ vars.SIGNAL_TREE_GATES_RUNNER }}';
export const GATE_RUNNER_NAME_ENV = '${{ vars.SIGNAL_TREE_GATE_RUNNER_NAME }}';
/** The runs-on a gate job may have: the gates runner's labels, with the hosted fallback (ci, nightly) or without it (soak). */
export const GATE_RUNS_ON = ["${{ fromJSON(vars.SIGNAL_TREE_GATES_RUNNER || '\"ubuntu-latest\"') }}", '${{ fromJSON(vars.SIGNAL_TREE_GATES_RUNNER) }}'];
export const PRE_COMMAND = 'node ci/gate-host.mjs --pre';
export const BROWSERS_COMMAND = 'node ci/gate-host.mjs --browsers';
export const POST_COMMAND = 'node ci/gate-host.mjs --post';
/** A step that mentions the gate-host checks at all; it must then be exactly one of the two commands. */
const MENTIONS_PRE = /gate-host(?:\.mjs)?[\s\S]*--pre\b/;
const MENTIONS_POST = /gate-host(?:\.mjs)?[\s\S]*--post\b/;
const MENTIONS_BROWSERS = /gate-host(?:\.mjs)?[\s\S]*--browsers\b/;
/** Installing the lock's packages (not a global install). */
const PNPM_INSTALL = /^\s*pnpm\s+install\b(?![^\n]*\s(?:-g|--global)\b)/m;
/** A harness step: its self-tests or typecheck, or any bench invocation. */
const HARNESS = /\bbench:test\b|@signal-tree\/bench\s+(?:run\s+)?(?:typecheck|test)\b/;
/**
 * A step that runs the bench harness, in any form: `pnpm bench`, `pnpm run
 * bench`, `pnpm --filter <pkg> bench`, npm, yarn or npx alike, or its CLI
 * (bench/runner/cli.ts). `pnpm bench:test`, the harness's own tests, is not.
 */
const BENCH = [/\b(?:pnpm|npm|yarn|npx)\b[^\n;&|]*?\s(?:run\s+)?bench(?=$|[\s"';&|)])/m, /runner\/cli(?:\.ts)?\b/];
const runsBench = (step) => BENCH.some((pattern) => pattern.test(String(step.run ?? '')));
/** The condition that keeps a step to the GitHub-hosted fallback: never on the gate runner. */
export const HOSTED_ONLY = "vars.SIGNAL_TREE_GATES_RUNNER == ''";
/** On the gate runner, the Chromium root installed and the toolchain manifest lists; elsewhere Playwright's default. */
export const BROWSERS_PATH_ENV = "${{ vars.SIGNAL_TREE_GATES_RUNNER != '' && '/opt/ms-playwright' || '' }}";
/**
 * A step that installs a toolchain or browser, or uses sudo: a setup-* action,
 * pnpm/action-setup, `playwright install`, install-deps, apt, a global npm,
 * pnpm or yarn install, corepack, a version manager, or a piped installer.
 */
const INSTALL_ACTION = /^(?:[\w.-]+\/setup-[\w.-]+|pnpm\/action-setup)@/;
const INSTALL_RUN =
  /\bsudo\b|\bplaywright\s+install\b|\binstall-deps\b|\bapt(?:-get)?\b[^\n]*\binstall\b|\b(?:npm|pnpm|yarn)\s+(?:i|install|add)\b[^\n]*\s(?:-g|--global)\b|\bcorepack\b|\b(?:nvm|fnm|volta|asdf|n)\s+install\b|\b(?:curl|wget)\b[^\n]*\|\s*(?:sudo\s+)?(?:ba|z)?sh\b/;
const installs = (step) => INSTALL_ACTION.test(String(step.uses ?? '')) || INSTALL_RUN.test(String(step.run ?? ''));
/** Step keys that change what a command does or whether its failure counts. */
const ALTERING = ['shell', 'working-directory', 'env', 'continue-on-error'];
/**
 * SIGNAL_TREE_GATE_HOST, spelled out in any case, or built: a format(...)
 * expression, an env-context expression naming a gate value, or a step writing
 * $GITHUB_ENV itself. Only ci/gate-host.mjs --pre may set it.
 */
const GATE_HOST_SPELLED = /gate_host/i;
const BUILT = [/format\s*\(/i, /\$\{\{[^}]*\benv\.[^}]*gate/i];

/**
 * #18, Jonathan's review of PR #85 and the independent review of #85, for
 * every job that measures gates:
 * - runs-on is the gates runner variable, and the job passes that variable, the
 *   pinned SIGNAL_TREE_GATE_RUNNER_NAME and PLAYWRIGHT_BROWSERS_PATH (the
 *   root-installed Chromium on the gate runner) through as env;
 * - the preflight is the first step after checkout, before pnpm install or
 *   anything else runs project or package code;
 * - a step that installs a toolchain or browser, or uses sudo, runs only on the
 *   hosted fallback (if: vars.SIGNAL_TREE_GATES_RUNNER == ''): the gate runner's
 *   fresh unprivileged user has no sudo, and uses the toolchain root installed;
 * - neither the job nor its preflight, bench or re-check steps continue on error;
 * - exactly one step runs exactly `node ci/gate-host.mjs --pre`, with no if:,
 *   shell, working-directory or env; exactly one runs exactly
 *   `node ci/gate-host.mjs --post` with if: always() and nothing else;
 * - every bench invocation runs between the two;
 * - exactly one step runs exactly `node ci/gate-host.mjs --browsers` (the
 *   preinstalled Chromium is the build the Playwright lock pins), with no if:,
 *   shell, working-directory or env, after pnpm install and before every
 *   harness or bench step;
 * - every upload comes after the re-check, with if: always(), and includes
 *   bench/out/*.json, so gate-host.json, gate-host-post.json, the sampler's
 *   record and the invalid marks ride in the same artifact as the results;
 * - no step writes $GITHUB_ENV itself.
 */
function hostCheckProblems(job, label) {
  const problems = [];
  const steps = job?.steps ?? [];
  const indexes = (test) => steps.map((_, i) => i).filter((i) => test(steps[i]));
  if (!GATE_RUNS_ON.includes(String(job?.['runs-on'] ?? ''))) problems.push(`${label}: runs-on must be the gates runner variable (${GATE_RUNS_ON.join(' or ')})`);
  if (job?.env?.SIGNAL_TREE_GATES_RUNNER !== GATES_RUNNER_ENV) {
    problems.push(`${label}: must set env SIGNAL_TREE_GATES_RUNNER: ${GATES_RUNNER_ENV}, so ci/gate-host.mjs knows when the job is aimed at the gate runner`);
  }
  if (job?.env?.SIGNAL_TREE_GATE_RUNNER_NAME !== GATE_RUNNER_NAME_ENV) {
    problems.push(`${label}: must set env SIGNAL_TREE_GATE_RUNNER_NAME: ${GATE_RUNNER_NAME_ENV}, the pinned gate runner ci/gate-host.mjs checks`);
  }
  if (job?.env?.PLAYWRIGHT_BROWSERS_PATH !== BROWSERS_PATH_ENV) {
    problems.push(`${label}: must set env PLAYWRIGHT_BROWSERS_PATH: ${BROWSERS_PATH_ENV}, so the gate runner uses the Chromium its toolchain manifest lists`);
  }
  if (job?.['continue-on-error'] !== undefined) problems.push(`${label}: must not continue on error`);
  if (!String(steps[0]?.uses ?? '').startsWith('actions/checkout@')) problems.push(`${label}: must start with actions/checkout`);
  for (const i of indexes(installs)) {
    if (String(steps[i].if ?? '').trim() !== HOSTED_ONLY) {
      problems.push(`${label}: step ${i + 1} installs a toolchain or browser, or uses sudo; on a gate job it must run only on the hosted fallback (if: ${HOSTED_ONLY})`);
    }
  }

  const pres = indexes((step) => MENTIONS_PRE.test(String(step.run ?? '')));
  const posts = indexes((step) => MENTIONS_POST.test(String(step.run ?? '')));
  const benches = indexes(runsBench);
  const pre = pres.length === 1 ? pres[0] : undefined;
  const post = posts.length === 1 ? posts[0] : undefined;
  if (pres.length === 0) problems.push(`${label}: must run the gate-host preflight (${PRE_COMMAND}, #18)`);
  else if (pres.length > 1) problems.push(`${label}: must run the gate-host preflight in exactly one step`);
  else {
    const step = steps[pre];
    if (pre !== 1) problems.push(`${label}: the gate-host preflight must be the first step after checkout, before pnpm install runs any package code`);
    if (String(step.run).trim() !== PRE_COMMAND) problems.push(`${label}: the gate-host preflight step must run exactly \`${PRE_COMMAND}\`, with nothing around or after it`);
    if (step.if !== undefined) problems.push(`${label}: the gate-host preflight step must not have an if:`);
    for (const key of ALTERING.filter((k) => step[k] !== undefined)) problems.push(`${label}: the gate-host preflight step must not set ${key}`);
  }
  if (posts.length === 0) problems.push(`${label}: must re-check the host after the gates (${POST_COMMAND})`);
  else if (posts.length > 1) problems.push(`${label}: must re-check the host in exactly one step`);
  else {
    const step = steps[post];
    if (String(step.run).trim() !== POST_COMMAND) problems.push(`${label}: the gate-host re-check step must run exactly \`${POST_COMMAND}\`, with nothing around or after it`);
    if (String(step.if ?? '').trim() !== 'always()') problems.push(`${label}: the gate-host re-check must run with if: always(), so a failed or cancelled run is still checked`);
    for (const key of ALTERING.filter((k) => step[k] !== undefined)) problems.push(`${label}: the gate-host re-check step must not set ${key}`);
  }
  const browserChecks = indexes((step) => MENTIONS_BROWSERS.test(String(step.run ?? '')));
  const installsLock = indexes((step) => PNPM_INSTALL.test(String(step.run ?? '')));
  const harness = indexes((step) => runsBench(step) || HARNESS.test(String(step.run ?? '')));
  if (browserChecks.length === 0) problems.push(`${label}: must check the preinstalled Chromium against the Playwright lock (${BROWSERS_COMMAND})`);
  else if (browserChecks.length > 1) problems.push(`${label}: must check the Chromium build in exactly one step`);
  else {
    const at = browserChecks[0];
    const step = steps[at];
    if (String(step.run).trim() !== BROWSERS_COMMAND) problems.push(`${label}: the Chromium build check must run exactly \`${BROWSERS_COMMAND}\`, with nothing around or after it`);
    if (step.if !== undefined) problems.push(`${label}: the Chromium build check must not have an if:`);
    for (const key of ALTERING.filter((k) => step[k] !== undefined)) problems.push(`${label}: the Chromium build check must not set ${key}`);
    if (installsLock.length === 0 || installsLock.some((i) => i > at)) problems.push(`${label}: the Chromium build check must run after pnpm install, when the lock's Playwright is readable`);
    if (harness.some((i) => i < at)) problems.push(`${label}: the Chromium build check must run before every harness or bench step`);
  }
  if (benches.length === 0) problems.push(`${label}: runs no bench step between the gate-host checks`);
  if (pre !== undefined && benches.some((i) => i < pre)) problems.push(`${label}: the gate-host preflight must run before every bench step`);
  if (post !== undefined && benches.some((i) => i > post)) problems.push(`${label}: the gate-host re-check must run after every bench step`);
  for (const i of benches) if (steps[i]['continue-on-error'] !== undefined) problems.push(`${label}: bench step ${i + 1} must not continue on error`);

  const uploadSteps = indexes(isUpload);
  if (uploadSteps.length === 0) problems.push(`${label}: must upload its results`);
  for (const i of uploadSteps) {
    const step = steps[i];
    const where = `${label}: upload step ${i + 1}`;
    if (String(step.if ?? '').trim() !== 'always()') problems.push(`${where} must run with if: always()`);
    const paths = String(step.with?.path ?? '').split('\n').map((p) => p.trim());
    if (!paths.includes('bench/out/*.json')) problems.push(`${where} must include bench/out/*.json, so gate-host.json and gate-host-post.json ride with the results`);
    if (post !== undefined && i < post) problems.push(`${where} must come after the gate-host re-check, so its invalid marks are uploaded`);
    if (step['continue-on-error'] !== undefined) problems.push(`${where} must not continue on error`);
  }
  for (const i of indexes((step) => /github_env/i.test(String(step.run ?? '')))) problems.push(`${label}: step ${i + 1} writes $GITHUB_ENV; in a gate job only ci/ scripts may`);
  return problems;
}

/** Only a passing ci/gate-host.mjs --pre may tell the bench harness it is on the gate runner. */
function gateHostEnvProblems(name, workflow) {
  const text = JSON.stringify(workflow ?? {});
  const problems = [];
  if (GATE_HOST_SPELLED.test(text)) problems.push(`${name}: sets or names SIGNAL_TREE_GATE_HOST; only ci/gate-host.mjs --pre may set it`);
  if (BUILT.some((pattern) => pattern.test(text))) problems.push(`${name}: builds a value with format() or the env context, which could construct SIGNAL_TREE_GATE_HOST; only ci/gate-host.mjs --pre may set it`);
  return problems;
}

export function workflowProblems({ ci, nightly, soak, approve }) {
  const problems = approveProblems(approve);
  for (const [name, workflow] of [['ci.yml', ci], ['nightly.yml', nightly], ['soak.yml', soak]]) problems.push(...gateHostEnvProblems(name, workflow));
  const gates = ci?.jobs?.gates;
  if (!gates) return [...problems, 'ci.yml has no gates job'];
  if (gates.name !== GATES_JOB) problems.push(`ci.yml gates: must be named "${GATES_JOB}", the name ci/gate-baseline.mjs finds it by in the Jobs API`);
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
  problems.push(...hostCheckProblems(gates, 'ci.yml gates'));
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
    problems.push(...hostCheckProblems(job, `nightly.yml gates (${adapter})`));
  }

  const soakJob = Object.values(soak?.jobs ?? {})[0];
  if (soakJob) problems.push(...hostCheckProblems(soakJob, 'soak.yml'));
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
