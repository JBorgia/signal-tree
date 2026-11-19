// Fetches main's latest gate baseline for a gates run (finding 1 on PR #15).
//
// Rules (Jonathan):
// - Once main has a recorded baseline, a run whose fetch fails must fail.
// - "No baseline yet" is allowed only while bench/budgets.json has
//   "approved": false. Once approved, a missing baseline fails.
// - When the artifact listing itself fails, nobody can tell whether main has a
//   baseline, so the run fails.
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

/**
 * Decides what a gates run does about its baseline.
 * `listing`: { error } | { artifact: { id, created_at } | null }
 * `download`: called only when an artifact exists; returns { path } or { error }.
 */
export function decide({ approved, listing, download }) {
  if (listing.error) return { action: 'fail', reason: `cannot tell whether main has a baseline: ${listing.error}` };
  if (!listing.artifact) {
    return approved
      ? { action: 'fail', reason: 'budgets.json is approved but main has no recorded baseline' }
      : { action: 'none', reason: 'main has no recorded baseline yet and budgets.json is not approved; this run only records' };
  }
  const fetched = download(listing.artifact);
  if (fetched.error) return { action: 'fail', reason: `main has a baseline (artifact ${listing.artifact.id}) but fetching it failed: ${fetched.error}` };
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
    download: (artifact) => {
      try {
        downloadArtifact(repo, artifact.id, out);
        const path = join(out, BASELINE_FILE);
        return existsSync(path) ? { path } : { error: `${BASELINE_FILE} is not in the artifact` };
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
