// Small GitHub helpers for the CI scripts, through the gh CLI (GH_TOKEN in CI,
// the signed-in account locally).
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function repoSlug(root) {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  const url = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: root, encoding: 'utf8' }).trim();
  return url.replace(/^.*github\.com[:/]/, '').replace(/\.git$/, '');
}

/** `gh api --paginate --slurp`, flattened; throws with gh's own message. */
export function ghApi(path) {
  try {
    const out = execFileSync('gh', ['api', '--paginate', '--slurp', path], { encoding: 'utf8', maxBuffer: 256 << 20, stdio: ['ignore', 'pipe', 'pipe'] });
    return JSON.parse(out).flat();
  } catch (error) {
    throw new Error(`gh api ${path.split('?')[0]}: ${String(error.stderr || error.message).trim().split('\n')[0]}`, { cause: error });
  }
}

/** Downloads artifact `id` and unzips it into `dir`; throws on any failure. */
export function downloadArtifact(repo, id, dir) {
  const work = mkdtempSync(join(tmpdir(), 'signal-tree-artifact-'));
  try {
    const zip = join(work, 'artifact.zip');
    let bytes;
    try {
      bytes = execFileSync('gh', ['api', `repos/${repo}/actions/artifacts/${id}/zip`], { maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      throw new Error(`downloading artifact ${id}: ${String(error.stderr || error.message).trim().split('\n')[0]}`, { cause: error });
    }
    writeFileSync(zip, bytes);
    mkdirSync(dir, { recursive: true });
    execFileSync('unzip', ['-o', '-q', zip, '-d', dir], { stdio: ['ignore', 'ignore', 'pipe'] });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** `gh api` for one response, without pagination; throws with gh's own message. */
export function ghApiOnce(path) {
  try {
    return JSON.parse(execFileSync('gh', ['api', path], { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'pipe'] }));
  } catch (error) {
    throw new Error(`gh api ${path.split('?')[0]}: ${String(error.stderr || error.message).trim().split('\n')[0]}`, { cause: error });
  }
}

/**
 * Workflow runs this repository started itself on main: completed, from
 * `workflowPath`, for one of `events`, with the head in this repository (not a
 * fork's). Newest first. Whether each head is on main is checked separately
 * (onMain), since it costs a request per run.
 */
export function trustedRuns(runs, { workflowPath, events }) {
  return runs
    .filter(
      (r) =>
        r.status === 'completed' &&
        r.head_branch === 'main' &&
        events.includes(r.event) &&
        r.head_repository?.id != null &&
        r.head_repository.id === r.repository?.id &&
        (r.path === workflowPath || String(r.path ?? '').startsWith(`${workflowPath}@`))
    )
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

/** Whether `sha` is main's tip or one of its ancestors. */
export function onMain(repo, sha) {
  if (!/^[0-9a-f]{40}$/.test(String(sha))) return false;
  const { status } = ghApiOnce(`repos/${repo}/compare/${sha}...main?per_page=1`);
  return status === 'identical' || status === 'ahead';
}

/** The jobs of a run's latest attempt. */
export const runJobs = (repo, runId) => ghApi(`repos/${repo}/actions/runs/${runId}/jobs?per_page=100`).flatMap((p) => p.jobs ?? []);

/** The artifacts of a run. */
export const runArtifacts = (repo, runId) => ghApi(`repos/${repo}/actions/runs/${runId}/artifacts?per_page=100`).flatMap((p) => p.artifacts ?? []);
