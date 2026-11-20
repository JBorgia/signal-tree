// Claude Code Stop hook for the unattended rebuild (BRIEF.md section 11.4).
//
// Blocks the session from stopping while `node ci/done-check.mjs` fails, and
// lets it stop after 20 consecutive blocked stops with no new commit, so a
// stuck session cannot loop forever. The supervisor (supervise.sh) then sees
// the stuck state and stops resuming the session.
//
// The done check runs in SIGNAL_TREE_VERIFY_DIR, a clean checkout of
// origin/main that the hook command resets before every run, so edits in the
// agent's own checkout cannot change the check or its result. Hook state lives
// in SIGNAL_TREE_STATE_DIR, outside the repository.
//
//   node stop-hook.mjs              run as the Stop hook (reads hook JSON on stdin)
//   node stop-hook.mjs --is-stuck   exit 0 if the last stop was let through as stuck
//                                   and no commit has landed since; used by supervise.sh
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const BLOCK_LIMIT = 20;

/**
 * Decides one stop. `state` is the previous decision's state (or null);
 * `newestCommit` identifies the newest commit on any branch of the agent's checkout.
 */
export function decide({ doneOk, doneOutput = '', newestCommit, state, limit = BLOCK_LIMIT }) {
  if (doneOk) return { allow: true, state: { blocks: 0, commit: newestCommit, stuck: false } };
  const blocks = state && state.commit === newestCommit ? state.blocks + 1 : 1;
  if (blocks > limit) {
    return {
      allow: true,
      state: { blocks: 0, commit: newestCommit, stuck: true },
      message: `Letting the session stop: ${limit} consecutive stops were blocked with no new commit, and the done check still fails.`,
    };
  }
  return {
    allow: false,
    state: { blocks, commit: newestCommit, stuck: false },
    reason: [
      `The rebuild is not done: node ci/done-check.mjs fails on origin/main (blocked stop ${blocks} of ${limit} with no new commit).`,
      doneOutput.trim(),
      'Keep working on the next unmet item in BRIEF.md order. File any question as a needs-jonathan issue with a recommendation, adopt the recommendation provisionally, and continue.',
    ]
      .filter(Boolean)
      .join('\n\n'),
  };
}

/** True when the last stop was let through as stuck and no commit has landed since. */
export function isStuck(state, newestCommit) {
  return Boolean(state?.stuck) && state.commit === newestCommit;
}

function newestCommit(workDir) {
  return execFileSync('git', ['-C', workDir, 'for-each-ref', '--sort=-committerdate', '--count=1', '--format=%(objectname)', 'refs/heads', 'refs/remotes'], { encoding: 'utf8' }).trim();
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set; start the session through ci/unattended/supervise.sh`);
  return value;
}

function readState(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function ensureInstalled(verifyDir, stateDir) {
  const lock = readFileSync(join(verifyDir, 'pnpm-lock.yaml'), 'utf8');
  const marker = join(stateDir, 'verify-lock.txt');
  if (existsSync(join(verifyDir, 'node_modules')) && existsSync(marker) && readFileSync(marker, 'utf8') === lock) return;
  execFileSync('pnpm', ['install', '--frozen-lockfile', '--prefer-offline'], { cwd: verifyDir, stdio: 'ignore' });
  writeFileSync(marker, lock);
}

function main() {
  const stateDir = requireEnv('SIGNAL_TREE_STATE_DIR');
  const verifyDir = requireEnv('SIGNAL_TREE_VERIFY_DIR');
  const workDir = process.env.CLAUDE_PROJECT_DIR || requireEnv('SIGNAL_TREE_WORK_DIR');
  mkdirSync(stateDir, { recursive: true });
  const statePath = join(stateDir, 'stop-hook.json');

  if (process.argv.includes('--is-stuck')) {
    process.exit(isStuck(readState(statePath), newestCommit(workDir)) ? 0 : 1);
  }

  ensureInstalled(verifyDir, stateDir);
  const done = spawnSync('node', ['ci/done-check.mjs'], { cwd: verifyDir, encoding: 'utf8' });
  const result = decide({
    doneOk: done.status === 0,
    doneOutput: `${done.stdout ?? ''}${done.stderr ?? ''}`,
    newestCommit: newestCommit(workDir),
    state: readState(statePath),
  });
  writeFileSync(statePath, `${JSON.stringify(result.state)}\n`);
  if (result.allow) {
    if (result.message) process.stdout.write(`${JSON.stringify({ systemMessage: result.message })}\n`);
    process.exit(0);
  }
  process.stdout.write(`${JSON.stringify({ decision: 'block', reason: result.reason })}\n`);
  process.exit(0);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    // A broken hook must not let the session stop unnoticed: block with the error.
    process.stdout.write(`${JSON.stringify({ decision: 'block', reason: `The Stop hook failed: ${error.message}. Fix the environment or report it in a needs-jonathan issue.` })}\n`);
    process.exit(0);
  }
}
