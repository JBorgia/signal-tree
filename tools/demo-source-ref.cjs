const { execFileSync } = require('node:child_process');

function resolveDemoSourceRef({ hostedCommit, gitHead }) {
  const valid = (value) =>
    typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value);
  if (hostedCommit !== undefined && !valid(hostedCommit)) {
    throw new Error(
      'VERCEL_GIT_COMMIT_SHA must identify a complete Git commit.'
    );
  }
  if (gitHead !== undefined && !valid(gitHead)) {
    throw new Error('Local Git HEAD must identify a complete Git commit.');
  }
  if (
    hostedCommit &&
    gitHead &&
    hostedCommit.toLowerCase() !== gitHead.toLowerCase()
  ) {
    throw new Error(
      'Hosted commit and local Git HEAD disagree; refusing misleading source links.'
    );
  }
  const selected = hostedCommit ?? gitHead;
  if (!selected) {
    throw new Error(
      'Cannot identify demo source. Build from a Git checkout or supply VERCEL_GIT_COMMIT_SHA.'
    );
  }
  return selected.toLowerCase();
}

function readDemoSourceRef(workspaceRoot, env = process.env) {
  let gitHead;
  try {
    gitHead = execFileSync('git', ['rev-parse', '--verify', 'HEAD'], {
      cwd: workspaceRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    // Vercel source archives can omit .git while retaining deployment identity.
  }
  return resolveDemoSourceRef({
    hostedCommit: env.VERCEL_GIT_COMMIT_SHA,
    gitHead,
  });
}

module.exports = { resolveDemoSourceRef, readDemoSourceRef };
if (require.main === module)
  process.stdout.write(readDemoSourceRef(process.cwd()));
