// Fetches main's latest gate baseline for a gates run (finding 1 on PR #15).
//
// Rules (Jonathan):
// - Once main has a recorded baseline, a run whose fetch fails must fail.
// - "No baseline yet" is allowed only while bench/budgets.json has
//   "approved": false. Once approved, a missing baseline fails.
// - When the artifact listing itself fails, nobody can tell whether main has a
//   baseline, so the run fails.
// - Timings compare only between runs on the gate runner (rulings 9 and 10,
//   12.3: baselines are recorded on the self-hosted runner, not elsewhere), on
//   the same runner, with the same governor and boost (review of PR #85). The
//   gate runner is the host with the provisioning marker ci/gate-host.mjs
//   checks, not any self-hosted runner. A run off the gate runner, or a baseline
//   main recorded off it, on another runner, or with another governor or boost,
//   is not compared: while budgets.json is unapproved the run only records;
//   once approved, it fails. The reason names the value that differs.
// - A baseline whose run ci/gate-host.mjs --post marked invalid, or that has no
//   post-run check, is never compared, by the same rule. An older valid one is
//   not used instead: it would measure older main code, and an improvement that
//   landed on main since could hide a PR's regression. Rerunning main's gates
//   records a new baseline.
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
import { downloadArtifact, ghApi, repoSlug } from './github.mjs';

export const ARTIFACT = 'gate-results';
export const BASELINE_FILE = 'aa-latest.json';

/** The host values a baseline and a run must share, from a gate-host record (ci/gate-host.mjs). */
export const comparableHost = (record) => ({
  onGateRunner: record?.onGateRunner === true,
  runnerName: record?.identity?.runnerName ?? null,
  governor: record?.host?.governors?.join('/') || null,
  boost: record?.host?.boost ?? null,
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
  else if (pre?.problems?.length) invalid = `its preflight failed: ${pre.problems.join('; ')}`;
  return { ...comparableHost(pre?.error ? null : pre), invalid };
}

/**
 * Decides what a gates run does about its baseline.
 * `listing`: { error } | { artifact: { id, created_at } | null }
 * `download`: called only when an artifact exists; returns { path, host } or { error },
 *   `host` being baselineHost() of the downloaded artifact.
 * `current`: comparableHost() of this run.
 */
export function decide({ approved, listing, download, current }) {
  if (listing.error) return { action: 'fail', reason: `cannot tell whether main has a baseline: ${listing.error}` };
  const notComparable = (why) =>
    approved
      ? { action: 'fail', reason: `budgets.json is approved but ${why}` }
      : { action: 'none', reason: `${why}; budgets.json is not approved, so this run only records` };
  if (!current.onGateRunner) return notComparable('this run is not on the gate runner, so its timings cannot be compared with a baseline');
  if (!listing.artifact) {
    return approved
      ? { action: 'fail', reason: 'budgets.json is approved but main has no recorded baseline' }
      : { action: 'none', reason: 'main has no recorded baseline yet and budgets.json is not approved; this run only records' };
  }
  const fetched = download(listing.artifact);
  const baseline = `main's newest baseline (artifact ${listing.artifact.id})`;
  if (fetched.error) return { action: 'fail', reason: `main has a baseline (artifact ${listing.artifact.id}) but fetching it failed: ${fetched.error}` };
  const host = fetched.host;
  if (!host.onGateRunner) return notComparable(`${baseline} was not recorded on the gate runner`);
  if (host.invalid) return notComparable(`${baseline} is invalid: ${host.invalid}`);
  for (const [what, recorded, now] of [
    ['the runner', host.runnerName, current.runnerName],
    ['the governor', host.governor, current.governor],
    ['boost', host.boost, current.boost],
  ]) {
    if (recorded !== now) return notComparable(`${baseline} was recorded with ${what} ${recorded ?? 'unrecorded'} and this run has ${now ?? 'none'}`);
  }
  return { action: 'use', path: fetched.path, reason: `baseline from main's artifact ${listing.artifact.id} (runner ${host.runnerName}, governor ${host.governor}, boost ${host.boost})` };
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
    // The same identity and host reading as the preflight, which ran before this step.
    current: comparableHost(checkPre()),
    download: (artifact) => {
      try {
        downloadArtifact(repo, artifact.id, out);
        const path = join(out, BASELINE_FILE);
        if (!existsSync(path)) return { error: `${BASELINE_FILE} is not in the artifact` };
        return { path, host: baselineHost(out) };
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
