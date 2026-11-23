// Fetches main's latest gate baseline for a gates run (finding 1 on PR #15).
//
// Rules (Jonathan):
// - Once main has a recorded baseline, a run whose fetch fails must fail.
// - "No baseline yet" is allowed only while bench/budgets.json has
//   "approved": false. Once approved, a missing baseline fails.
// - When the run or artifact listing itself fails, nobody can tell whether main
//   has a baseline, so the run fails.
// - Timings compare only between runs on the gate runner (rulings 9 and 10,
//   12.3: baselines are recorded on the self-hosted runner, not elsewhere), on
//   the same runner, with the same governor, boost and amd-pstate mode (review
//   of PR #85). The gate runner is the host ci/gate-host.mjs identifies by its
//   marker and pinned name, not any self-hosted runner. A run off the gate
//   runner, or a baseline main recorded off it, on another runner, or with
//   another governor, boost or amd-pstate mode, is not compared: while
//   budgets.json is unapproved the run only records; once approved, it fails.
//   The reason names the value that differs.
//
// Which run is main's baseline (independent review of #85): the run is chosen
// first, then its artifact; never an artifact by its branch name. Candidates
// are ci.yml push runs on main that this repository started itself (not a
// fork's head), from .github/workflows/ci.yml, whose head commit is on main.
// Newest first:
// - a run that did not succeed and recorded no aa-latest.json (cancelled, or
//   failed before the gates) is skipped;
// - a run that did not succeed but recorded a baseline ends the search: its
//   baseline is not used, and an older one is not used instead, since it would
//   measure older main code and an improvement landed since could hide a PR's
//   regression. Rerunning main's gates records a new one;
// - the first successful run is main's baseline. It is used only if
//   ci/gate-host.mjs --post found it valid, and GitHub's Jobs API says its gates
//   job ran on the runner its gate-host record names.
//
//   node ci/gate-baseline.mjs --out <dir>
//
// On success it prints the --baseline arguments for `pnpm bench` (and appends
// BASELINE_ARGS to $GITHUB_ENV in CI). Exit 1 means the gates run must fail.
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot } from './entry-graph.mjs';
import { checkPre, POST_FILE, PRE_FILE } from './gate-host.mjs';
import { downloadArtifact, ghApiOnce, onMain, repoSlug, runArtifacts, runJobs, trustedRuns } from './github.mjs';

export const ARTIFACT = 'gate-results';
export const BASELINE_FILE = 'aa-latest.json';
export const WORKFLOW_PATH = '.github/workflows/ci.yml';
/** The gates job's name in ci.yml, as the Jobs API reports it (ci/workflows.mjs keeps them equal). */
export const GATES_JOB = 'Gates (Angular reference app)';

/** The host values a baseline and a run must share, from a gate-host record (ci/gate-host.mjs). */
export const comparableHost = (record) => ({
  onGateRunner: record?.onGateRunner === true,
  runnerName: record?.identity?.runnerName ?? null,
  governor: record?.host?.governors?.join('/') || null,
  boost: record?.host?.boost ?? null,
  amdPstate: record ? (record.host?.amdPstate ?? 'none') : null,
});

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Where and how the baseline in `dir` (main's downloaded artifact) was
 * recorded, from its gate-host.json, and why it is invalid, from its
 * gate-host-post.json and the baseline file's own mark; `invalid` is null
 * when the run held the gate conditions throughout.
 */
export function baselineHost(dir) {
  const pre = readJson(join(dir, PRE_FILE));
  const post = readJson(join(dir, POST_FILE));
  const baseline = readJson(join(dir, BASELINE_FILE));
  let invalid = null;
  if (baseline?.invalid) invalid = baseline.invalid.reason ?? 'its results are marked invalid';
  else if (!post) invalid = `it has no post-run gate-host check (${POST_FILE})`;
  else if (post.error) invalid = `its post-run gate-host check can't be read (${post.error})`;
  else if (post.invalid) invalid = post.invalid.reason ?? 'the post-run gate-host check marked it invalid';
  else if (post.enforced !== true) invalid = 'its post-run gate-host check was not enforced (not a gate-runner run)';
  else if (pre?.problems?.length) invalid = `its preflight failed: ${pre.problems.join('; ')}`;
  return { ...comparableHost(pre?.error ? null : pre), invalid };
}

/**
 * Decides what a gates run does about its baseline.
 * `listing`: { error } | { runs: trustedRuns() of ci.yml push runs on main, newest first }
 * `inspect(run)`: { error } | { offMain: true } | { artifactId, path, host, gatesRunner }:
 *   whether the run's head is on main, its unexpired gate-results artifact
 *   (artifactId null when none), the aa-latest.json in it (path null when
 *   absent), baselineHost() of it, and the runner the Jobs API says its gates
 *   job ran on.
 * `current`: comparableHost() of this run.
 */
export function decide({ approved, listing, inspect, current }) {
  if (listing.error) return { action: 'fail', reason: `cannot tell whether main has a baseline: ${listing.error}` };
  const notComparable = (why) =>
    approved
      ? { action: 'fail', reason: `budgets.json is approved but ${why}` }
      : { action: 'none', reason: `${why}; budgets.json is not approved, so this run only records` };
  const noBaseline = (why) =>
    approved ? { action: 'fail', reason: `budgets.json is approved but ${why}` } : { action: 'none', reason: `${why} and budgets.json is not approved; this run only records` };
  if (!current.onGateRunner) return notComparable('this run is not on the gate runner, so its timings cannot be compared with a baseline');
  for (const run of listing.runs) {
    const seen = inspect(run);
    if (seen.error) return { action: 'fail', reason: `cannot tell whether main's run ${run.id} holds a baseline: ${seen.error}` };
    if (seen.offMain) continue;
    const baseline = `main's newest baseline (run ${run.id}, artifact ${seen.artifactId})`;
    if (run.conclusion !== 'success') {
      if (!seen.path) continue;
      return notComparable(`${baseline} comes from a run that concluded ${run.conclusion}${seen.host?.invalid ? ` (${seen.host.invalid})` : ''}; only a successful run's baseline is used`);
    }
    if (!seen.artifactId) return noBaseline(`main's newest successful run ${run.id} has no unexpired ${ARTIFACT} artifact, so main has no recorded baseline`);
    if (!seen.path) return { action: 'fail', reason: `main has a baseline artifact (run ${run.id}, artifact ${seen.artifactId}) but ${BASELINE_FILE} is not in it` };
    const host = seen.host;
    if (!host.onGateRunner) return notComparable(`${baseline} was not recorded on the gate runner`);
    if (host.invalid) return notComparable(`${baseline} is invalid: ${host.invalid}`);
    if (seen.gatesRunner !== host.runnerName) {
      return notComparable(`${baseline}: GitHub ran its gates job on runner ${seen.gatesRunner ?? 'unknown'}, but its gate-host record names ${host.runnerName}`);
    }
    for (const [what, recorded, now] of [
      ['the runner', host.runnerName, current.runnerName],
      ['the governor', host.governor, current.governor],
      ['boost', host.boost, current.boost],
      ['the amd-pstate mode', host.amdPstate, current.amdPstate],
    ]) {
      if (recorded !== now) return notComparable(`${baseline} was recorded with ${what} ${recorded ?? 'unrecorded'} and this run has ${now ?? 'none'}`);
    }
    return {
      action: 'use',
      path: seen.path,
      reason: `baseline from main's run ${run.id} (artifact ${seen.artifactId}; runner ${host.runnerName}, governor ${host.governor}, boost ${host.boost}, amd-pstate ${host.amdPstate})`,
    };
  }
  return noBaseline('main has no recorded baseline yet');
}

function main() {
  const outIndex = process.argv.indexOf('--out');
  const out = outIndex > 0 ? process.argv[outIndex + 1] : undefined;
  if (!out) {
    console.error('usage: node ci/gate-baseline.mjs --out <dir>');
    process.exit(2);
  }
  const approved = JSON.parse(readFileSync(join(repoRoot, 'bench', 'budgets.json'), 'utf8')).approved === true;
  let listing;
  let repo;
  try {
    repo = repoSlug(repoRoot);
    const page = ghApiOnce(`repos/${repo}/actions/workflows/ci.yml/runs?branch=main&event=push&status=completed&per_page=50`);
    listing = { runs: trustedRuns(page.workflow_runs ?? [], { workflowPath: WORKFLOW_PATH, events: ['push'] }) };
  } catch (error) {
    listing = { error: error.message };
  }
  const result = decide({
    approved,
    listing,
    // The same identity and host reading as the preflight, which ran before this step.
    current: comparableHost(checkPre()),
    inspect: (run) => {
      try {
        if (!onMain(repo, run.head_sha)) return { offMain: true };
        const artifact = runArtifacts(repo, run.id).find((a) => a.name === ARTIFACT && !a.expired);
        if (!artifact) return { artifactId: null, path: null, host: null, gatesRunner: null };
        const dir = join(out, String(run.id));
        downloadArtifact(repo, artifact.id, dir);
        const path = join(dir, BASELINE_FILE);
        const gatesRunner = runJobs(repo, run.id).find((j) => j.name === GATES_JOB)?.runner_name ?? null;
        return { artifactId: artifact.id, path: existsSync(path) ? path : null, host: baselineHost(dir), gatesRunner };
      } catch (error) {
        return { error: error.message };
      }
    },
  });
  console.log(`${result.action}: ${result.reason}`);
  if (result.action === 'fail') process.exit(1);
  if (result.action === 'use') {
    const args = `--baseline ${result.path}`;
    if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, `BASELINE_ARGS=${args}\n`);
    console.log(args);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
