// Fetches main's latest gate baseline for a gates run (finding 1 on PR #15).
//
// Rules (Jonathan):
// - Once main has a recorded baseline, a run whose fetch fails must fail.
// - "No baseline yet" is allowed only while bench/budgets.json has
//   "approved": false. Once approved, a missing baseline fails.
// - When the artifact listing itself fails, nobody can tell whether main has a
//   baseline, so the run fails.
// - Timings compare only between runs on the gate runner (rulings 9 and 10,
//   12.3: baselines are recorded on the self-hosted runner, not elsewhere). A
//   run off the gate runner, or a baseline main recorded off it, is not
//   compared: while budgets.json is unapproved the run only records; once
//   approved, it fails.
//
//   node ci/gate-baseline.mjs --out <dir>
//
// On success it prints the --baseline arguments for `pnpm bench` (and appends
// BASELINE_ARGS to $GITHUB_ENV in CI). Exit 1 means the gates run must fail.
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot } from './entry-graph.mjs';
import { downloadArtifact, ghApi, repoSlug } from './github.mjs';

export const ARTIFACT = 'gate-results';
export const BASELINE_FILE = 'aa-latest.json';
/** Written next to main's baseline: where it was recorded. */
export const RECORDED_ON_FILE = 'recorded-on.json';

/** Whether a run environment is the gate runner: GitHub sets RUNNER_ENVIRONMENT to 'self-hosted' or 'github-hosted'. */
export const isGateRunner = (runnerEnvironment) => runnerEnvironment === 'self-hosted';

/**
 * Decides what a gates run does about its baseline.
 * `listing`: { error } | { artifact: { id, created_at } | null }
 * `download`: called only when an artifact exists; returns { path, recordedOn } or { error }.
 * `onGateRunner`: whether this run is on the gate runner. `recordedOn` is the
 * baseline's RUNNER_ENVIRONMENT, or undefined when the artifact predates it.
 */
export function decide({ approved, listing, download, onGateRunner }) {
  if (listing.error) return { action: 'fail', reason: `cannot tell whether main has a baseline: ${listing.error}` };
  const notComparable = (why) =>
    approved
      ? { action: 'fail', reason: `budgets.json is approved but ${why}` }
      : { action: 'none', reason: `${why}; budgets.json is not approved, so this run only records` };
  if (!onGateRunner) return notComparable('this run is not on the gate runner, so its timings cannot be compared with a baseline');
  if (!listing.artifact) {
    return approved
      ? { action: 'fail', reason: 'budgets.json is approved but main has no recorded baseline' }
      : { action: 'none', reason: 'main has no recorded baseline yet and budgets.json is not approved; this run only records' };
  }
  const fetched = download(listing.artifact);
  if (fetched.error) return { action: 'fail', reason: `main has a baseline (artifact ${listing.artifact.id}) but fetching it failed: ${fetched.error}` };
  if (!isGateRunner(fetched.recordedOn)) return notComparable(`main's newest baseline (artifact ${listing.artifact.id}) was not recorded on the gate runner`);
  return { action: 'use', path: fetched.path, reason: `baseline from main's artifact ${listing.artifact.id}` };
}

/** The newest unexpired gate-results artifact uploaded by a run on main. */
export function newestMainArtifact(artifacts) {
  return (
    artifacts
      .filter((a) => a.name === ARTIFACT && !a.expired && a.workflow_run?.head_branch === 'main')
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0] ?? null
  );
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
    listing = { artifact: newestMainArtifact(ghApi(`repos/${repo}/actions/artifacts?name=${ARTIFACT}&per_page=100`).flatMap((p) => p.artifacts ?? [])) };
  } catch (error) {
    listing = { error: error.message };
  }
  const result = decide({
    approved,
    listing,
    onGateRunner: isGateRunner(process.env.RUNNER_ENVIRONMENT),
    download: (artifact) => {
      try {
        downloadArtifact(repo, artifact.id, out);
        const path = join(out, BASELINE_FILE);
        if (!existsSync(path)) return { error: `${BASELINE_FILE} is not in the artifact` };
        const recordedOnPath = join(out, RECORDED_ON_FILE);
        const recordedOn = existsSync(recordedOnPath) ? JSON.parse(readFileSync(recordedOnPath, 'utf8')).runnerEnvironment : undefined;
        return { path, recordedOn };
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
