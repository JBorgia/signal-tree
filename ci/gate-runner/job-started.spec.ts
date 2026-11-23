import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// The gate runner's job-started hook (BRIEF.md ruling 10; #18): it empties the
// job's workspace before every job and refuses any workspace that isn't the
// runner's <runner>/_work/<repository>/<repository>.
const HOOK = join(__dirname, 'job-started.sh');

let root: string;
let ws: string;

const run = (workspace: string | undefined) => {
  const env: Record<string, string> = { PATH: process.env.PATH ?? '/usr/bin:/bin' };
  if (workspace !== undefined) env.GITHUB_WORKSPACE = workspace;
  return spawnSync('sh', [HOOK], { env, encoding: 'utf8' });
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'job-started-'));
  ws = join(root, 'runner', '_work', 'signal-tree', 'signal-tree');
  mkdirSync(join(ws, 'nested', 'deeper'), { recursive: true });
  writeFileSync(join(ws, 'nested', 'deeper', 'left-behind.json'), '{}');
  writeFileSync(join(ws, '.hidden'), 'x');
  mkdirSync(join(ws, '.git'));
  writeFileSync(join(ws, '.git', 'config'), '');
  mkdirSync(join(root, 'runner', '_work', '_actions'), { recursive: true });
  writeFileSync(join(root, 'runner', '_work', '_actions', 'keep'), '');
  mkdirSync(join(root, 'outside'));
  writeFileSync(join(root, 'outside', 'keep'), '');
  symlinkSync(join(root, 'outside'), join(ws, 'link-out'));
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('gate runner job-started hook', () => {
  it('empties the workspace, dotfiles and nested folders included, and nothing outside it', () => {
    const result = run(ws);
    expect(result.status, result.stderr).toBe(0);
    expect(readdirSync(ws)).toEqual([]);
    expect(existsSync(join(root, 'outside', 'keep'))).toBe(true);
    expect(existsSync(join(root, 'runner', '_work', '_actions', 'keep'))).toBe(true);
  });

  it('succeeds without creating anything when the workspace does not exist yet', () => {
    rmSync(ws, { recursive: true });
    const result = run(ws);
    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(ws)).toBe(false);
  });

  // Paths are built under the temporary root; the trailing-slash, `..` and
  // doubled-slash forms resolve to the populated workspace, so only the refusal
  // keeps it intact.
  it.each([
    ['unset', () => undefined],
    ['empty', () => ''],
    ['relative', () => 'runner/_work/signal-tree/signal-tree'],
    ['not under _work', () => join(root, 'runner', 'signal-tree', 'signal-tree')],
    ['repository names that differ', () => join(root, 'runner', '_work', 'signal-tree', 'nested')],
    ['the work folder itself', () => join(root, 'runner', '_work', 'signal-tree')],
    ['a trailing slash', () => `${ws}/`],
    ['a .. component', () => `${root}/runner/_work/../_work/signal-tree/signal-tree`],
    ['a doubled slash', () => `${root}/runner//_work/signal-tree/signal-tree`],
    ['_work at the file system root', () => '/_work/signal-tree/signal-tree'],
  ])('refuses a workspace that is %s, and deletes nothing', (_label, workspace) => {
    const result = run(workspace());
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('refusing to clean');
    expect(readdirSync(ws).sort()).toEqual(['.git', '.hidden', 'link-out', 'nested']);
  });

  it('refuses a workspace that is a symlink, and leaves its target alone', () => {
    const linked = join(root, 'runner', '_work', 'linked', 'linked');
    mkdirSync(join(root, 'runner', '_work', 'linked'));
    symlinkSync(join(root, 'outside'), linked);
    const result = run(linked);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('is not a directory');
    expect(existsSync(join(root, 'outside', 'keep'))).toBe(true);
  });
});
