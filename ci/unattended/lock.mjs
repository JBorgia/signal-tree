// One agent session at a time (Jonathan's decision, November 19).
//
// The lock is the ref refs/agent/lock on the repository's remote. Taking it is
// a compare-and-swap push that succeeds only when the ref does not exist yet,
// so two sessions on different machines cannot both hold it. The ref points
// at an empty commit whose message records the holder as JSON: session ID,
// host, process ID, working directory and start time.
//
//   node lock.mjs acquire --session <id>     take it, or keep it if this session holds it
//   node lock.mjs release --session <id>     give it back (only the holder can)
//   node lock.mjs release --force            clear a lock left by a session that died
//   node lock.mjs status                     print the holder, if any
//
// The lock commit is pushed to GitHub, so it carries Jonathan's identity like
// every other commit: SIGNAL_TREE_GIT_NAME and SIGNAL_TREE_GIT_EMAIL, the same
// variables supervise.sh uses, defaulting to Jonathan Borgia
// <jonathanborgia@gmail.com>.
//
// Exit status: 0 done; 3 held by another session; 1 any other failure.
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { hostname } from 'node:os';
import { pathToFileURL } from 'node:url';

export const LOCK_REF = 'refs/agent/lock';
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

function git(cwd, args, { input, env } = {}) {
  return execFileSync('git', args, { cwd, input, env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

/** Author and committer of the lock commit. */
export function lockIdentity(env = process.env) {
  return { name: env.SIGNAL_TREE_GIT_NAME || 'Jonathan Borgia', email: env.SIGNAL_TREE_GIT_EMAIL || 'jonathanborgia@gmail.com' };
}

/** The current holder, or null when the lock is free. */
export function holder({ cwd, remote = 'origin' }) {
  const line = git(cwd, ['ls-remote', remote, LOCK_REF]);
  if (!line) return null;
  const sha = line.split(/\s+/)[0];
  git(cwd, ['fetch', '-q', remote, `+${LOCK_REF}:refs/agent/observed-lock`]);
  const message = git(cwd, ['log', '-1', '--format=%B', sha]);
  try {
    return { sha, ...JSON.parse(message) };
  } catch {
    return { sha, session: null, raw: message };
  }
}

/**
 * Takes the lock for `session`. Returns { acquired: true } when this session
 * now holds it (newly or already), or { acquired: false, holder } when another
 * session does.
 */
export function acquire({ cwd, session, remote = 'origin', now = new Date(), identity = lockIdentity() }) {
  const current = holder({ cwd, remote });
  if (current) return current.session === session ? { acquired: true, holder: current, reused: true } : { acquired: false, holder: current };
  const info = { session, host: hostname(), pid: process.ppid, cwd, startedAt: now.toISOString() };
  // The environment outranks any user.name or user.email in git config.
  const env = { ...process.env, GIT_AUTHOR_NAME: identity.name, GIT_AUTHOR_EMAIL: identity.email, GIT_COMMITTER_NAME: identity.name, GIT_COMMITTER_EMAIL: identity.email };
  const sha = git(cwd, ['commit-tree', EMPTY_TREE, '-m', JSON.stringify(info)], { env });
  try {
    // An empty expected value means "only if the ref does not exist": the server rejects the push otherwise.
    git(cwd, ['push', '-q', `--force-with-lease=${LOCK_REF}:`, remote, `${sha}:${LOCK_REF}`]);
    return { acquired: true, holder: { sha, ...info } };
  } catch (error) {
    // Lost the race to another session, or the push failed for another reason.
    const winner = holder({ cwd, remote });
    if (!winner) throw new Error(`could not take the agent lock: ${String(error.stderr || error.message).trim().split('\n').pop()}`, { cause: error });
    return winner.session === session ? { acquired: true, holder: winner, reused: true } : { acquired: false, holder: winner };
  }
}

/** Releases the lock if `session` holds it (or unconditionally with force). */
export function release({ cwd, session, remote = 'origin', force = false }) {
  const current = holder({ cwd, remote });
  if (!current) return { released: false, reason: 'not held' };
  if (!force && current.session !== session) return { released: false, reason: `held by session ${current.session}` };
  git(cwd, ['push', '-q', `--force-with-lease=${LOCK_REF}:${current.sha}`, remote, `:${LOCK_REF}`]);
  return { released: true };
}

function main() {
  const [command, ...rest] = process.argv.slice(2);
  const option = (name) => {
    const i = rest.indexOf(name);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  const cwd = process.cwd();
  const session = option('--session');
  if (command === 'status') {
    const current = holder({ cwd });
    console.log(current ? `held by ${JSON.stringify(current)}` : 'free');
    return 0;
  }
  if (command === 'acquire' && session) {
    const result = acquire({ cwd, session });
    if (result.acquired) {
      console.log(`${result.reused ? 'already held' : 'acquired'} by session ${session}`);
      return 0;
    }
    console.error(`Refusing to start: the agent lock is held by ${JSON.stringify(result.holder)}. If that session is gone, run: node ci/unattended/lock.mjs release --force`);
    return 3;
  }
  if (command === 'release' && (session || rest.includes('--force'))) {
    const result = release({ cwd, session, force: rest.includes('--force') });
    console.log(result.released ? 'released' : `not released: ${result.reason}`);
    return result.released || result.reason === 'not held' ? 0 : 3;
  }
  console.error('usage: node lock.mjs acquire --session <id> | release --session <id> | release --force | status');
  return 1;
}

// Node runs the main module from its real path; compare with that, or a path through a
// symlink (macOS /var, a linked home) would skip main and exit 0 having done nothing.
if (import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try {
    process.exit(main());
  } catch (error) {
    console.error(`agent lock: ${error.message}`);
    process.exit(1);
  }
}
