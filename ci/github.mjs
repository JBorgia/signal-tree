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
