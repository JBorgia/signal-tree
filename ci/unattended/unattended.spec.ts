import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOCK_REF, acquire, holder, release } from './lock.mjs';
import { BLOCK_LIMIT, decide, isStuck } from './stop-hook.mjs';

describe('Stop hook decision', () => {
  it('lets the session stop once the done check passes', () => {
    const result = decide({ doneOk: true, newestCommit: 'a', state: { blocks: 7, commit: 'a', stuck: false } });
    expect(result).toEqual({ allow: true, state: { blocks: 0, commit: 'a', stuck: false } });
  });

  it('blocks while the done check fails, carrying its output as the reason', () => {
    const result = decide({ doneOk: false, doneOutput: 'Next unmet item: X', newestCommit: 'a', state: null });
    expect(result.allow).toBe(false);
    expect(result.state).toEqual({ blocks: 1, commit: 'a', stuck: false });
    expect(result.reason).toContain('Next unmet item: X');
  });

  it(`blocks ${BLOCK_LIMIT} consecutive stops with no new commit, then lets the next one through as stuck`, () => {
    let state = null;
    for (let i = 1; i <= BLOCK_LIMIT; i++) {
      const result = decide({ doneOk: false, newestCommit: 'a', state });
      expect(result.allow).toBe(false);
      state = result.state;
    }
    const last = decide({ doneOk: false, newestCommit: 'a', state });
    expect(last.allow).toBe(true);
    expect(last.state.stuck).toBe(true);
  });

  it('starts counting again after a new commit', () => {
    const result = decide({ doneOk: false, newestCommit: 'b', state: { blocks: BLOCK_LIMIT, commit: 'a', stuck: false } });
    expect(result.allow).toBe(false);
    expect(result.state.blocks).toBe(1);
  });

  it('reports stuck only while no commit has landed since', () => {
    expect(isStuck({ blocks: 0, commit: 'a', stuck: true }, 'a')).toBe(true);
    expect(isStuck({ blocks: 0, commit: 'a', stuck: true }, 'b')).toBe(false);
    expect(isStuck({ blocks: 3, commit: 'a', stuck: false }, 'a')).toBe(false);
    expect(isStuck(null, 'a')).toBe(false);
  });
});

describe('supervisor', () => {
  const script = new URL('./supervise.sh', import.meta.url).pathname;

  it('parses as bash', () => {
    expect(spawnSync('bash', ['-n', script]).status).toBe(0);
  });

  it('refuses to start outside the isolated machine', () => {
    const run = spawnSync('bash', [script], { env: { ...process.env, SIGNAL_TREE_ISOLATED: '' }, encoding: 'utf8' });
    expect(run.status).toBe(2);
    expect(run.stderr).toContain('isolated container or VM');
  });
});

describe('agent lock', () => {
  const sh = (cwd: string, ...args: string[]) => spawnSync('git', args, { cwd, encoding: 'utf8' });
  const setup = () => {
    const root = mkdtempSync(join(tmpdir(), 'signal-tree-lock-'));
    const remote = join(root, 'remote.git');
    sh(root, 'init', '-q', '--bare', remote);
    const clone = (name: string) => {
      const dir = join(root, name);
      sh(root, 'clone', '-q', remote, dir);
      return dir;
    };
    return { root, a: clone('a'), b: clone('b') };
  };

  it('lets one session hold the lock and refuses another, naming the holder', () => {
    const { root, a, b } = setup();
    try {
      expect(acquire({ cwd: a, session: 'session-a' })).toMatchObject({ acquired: true });
      const refused = acquire({ cwd: b, session: 'session-b' });
      expect(refused.acquired).toBe(false);
      expect(refused.holder).toMatchObject({ session: 'session-a', startedAt: expect.any(String), host: expect.any(String) });
      expect(holder({ cwd: b })).toMatchObject({ session: 'session-a' });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('lets the holding session resume, and only the holder (or --force) release it', () => {
    const { root, a, b } = setup();
    try {
      acquire({ cwd: a, session: 'session-a' });
      expect(acquire({ cwd: a, session: 'session-a' })).toMatchObject({ acquired: true, reused: true });
      expect(release({ cwd: b, session: 'session-b' })).toMatchObject({ released: false });
      expect(release({ cwd: b, force: true })).toMatchObject({ released: true });
      expect(acquire({ cwd: b, session: 'session-b' })).toMatchObject({ acquired: true });
      expect(release({ cwd: b, session: 'session-b' })).toMatchObject({ released: true });
      expect(holder({ cwd: a })).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('cannot be taken by a racing session: creation is a compare-and-swap on the remote', () => {
    const { root, a, b } = setup();
    try {
      acquire({ cwd: a, session: 'session-a' });
      const sha = sh(b, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit-tree', '4b825dc642cb6eb9a060e54bf8d69288fbee4904', '-m', '{"session":"session-b"}').stdout.trim();
      const push = sh(b, 'push', `--force-with-lease=${LOCK_REF}:`, 'origin', `${sha}:${LOCK_REF}`);
      expect(push.status).not.toBe(0);
      expect(holder({ cwd: b })).toMatchObject({ session: 'session-a' });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('supervisor model pin', () => {
  const script = new URL('./supervise.sh', import.meta.url).pathname;
  const text = () => readFileSync(script, 'utf8');

  it('refuses extra arguments that set a model or a fallback model', () => {
    for (const args of ['--model claude-sonnet-5-5', '--fallback-model claude-haiku-5-5']) {
      const state = mkdtempSync(join(tmpdir(), 'signal-tree-sup-'));
      try {
        const run = spawnSync('bash', [script], { env: { ...process.env, SIGNAL_TREE_ISOLATED: '1', SIGNAL_TREE_STATE_DIR: state, SIGNAL_TREE_CLAUDE_ARGS: args }, encoding: 'utf8' });
        expect(run.status).toBe(2);
        expect(run.stderr).toContain('pinned to claude-opus-5-5');
      } finally {
        rmSync(state, { recursive: true, force: true });
      }
    }
  });

  it('passes the model on every run, in settings and on the command line, with flag-switching off', () => {
    const s = text();
    expect(s).toContain('readonly MODEL=claude-opus-5-5');
    expect(s.match(/--model "\$MODEL"/g)).toHaveLength(2);
    expect(s).toContain('{model: $model, switchModelsOnFlag: false');
    expect(s).toContain('unset ANTHROPIC_MODEL');
  });

  it('flags a run whose events report another model', () => {
    const dir = mkdtempSync(join(tmpdir(), 'signal-tree-sup-'));
    try {
      const log = join(dir, 'run.log');
      writeFileSync(log, ['{"type":"system","subtype":"init","model":"claude-opus-5-5"}', '{"type":"assistant","message":{"model":"claude-opus-5"}}', '{"type":"assistant","message":{"model":"claude-opus-5-5"}}'].join('\n'));
      const filter = text().match(/ran_on=\$\(jq -r '([^']+)' "\$run_log"/)![1];
      const out = spawnSync('bash', ['-c', `jq -r '${filter}' "${log}" | sort -u | grep -v -x -e claude-opus-5-5 -e '' | paste -sd, -`], { encoding: 'utf8' });
      expect(out.stdout.trim()).toBe('claude-opus-5');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('supervisor attribution setting', () => {
  const script = new URL('./supervise.sh', import.meta.url).pathname;
  const fn = (call: string) =>
    // eval, not `source <(...)`: bash 3.2 (macOS) reads nothing from a sourced process substitution.
    spawnSync('bash', ['-c', `eval "$(sed -n '/^version_ge()/,/^}/p;/^attribution_setting()/,/^}/p' "${script}")"; ${call}`], { encoding: 'utf8' }).stdout.trim();

  it('turns attribution off with the single switch from 2.1.281', () => {
    expect(fn('attribution_setting 2.1.323')).toBe('false');
    expect(fn('attribution_setting 2.1.281')).toBe('false');
  });

  it('empties the attribution texts and the session URL on older versions or an unknown version', () => {
    for (const v of ['2.1.280', '2.0.9', '']) expect(JSON.parse(fn(`attribution_setting '${v}'`))).toEqual({ commit: '', pr: '', sessionUrl: false });
  });

  it('passes the setting into every session', () => {
    expect(readFileSync(script, 'utf8')).toContain('attribution: $attribution');
  });
});

describe('supervisor authentication (#16)', () => {
  const script = new URL('./supervise.sh', import.meta.url).pathname;

  it('refuses to start without an API key', () => {
    const state = mkdtempSync(join(tmpdir(), 'signal-tree-sup-'));
    try {
      const env: Record<string, string | undefined> = { ...process.env, SIGNAL_TREE_ISOLATED: '1', SIGNAL_TREE_STATE_DIR: state };
      delete env.ANTHROPIC_API_KEY;
      const run = spawnSync('bash', [script], { env: env as NodeJS.ProcessEnv, encoding: 'utf8' });
      expect(run.status).toBe(6);
      expect(run.stderr).toContain('ANTHROPIC_API_KEY');
    } finally {
      rmSync(state, { recursive: true, force: true });
    }
  });

  const authFailure = (lines: string[]) => {
    const dir = mkdtempSync(join(tmpdir(), 'signal-tree-sup-'));
    try {
      const log = join(dir, 'run.log');
      writeFileSync(log, lines.join('\n'));
      return spawnSync('bash', ['-c', `eval "$(sed -n '/^auth_failure()/,/^}/p' "${script}")"; auth_failure "${log}"`], { encoding: 'utf8' }).stdout.trim();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it('recognises a run that failed to authenticate', () => {
    expect(authFailure(['{"type":"result","is_error":true,"result":"Failed to authenticate: OAuth session expired and could not be refreshed"}'])).toContain('authenticate');
    expect(authFailure(['{"type":"result","is_error":true,"result":"Invalid API key"}'])).toContain('API key');
  });

  it('does not mistake another error or a success for one', () => {
    expect(authFailure(['{"type":"result","is_error":true,"result":"Rate limited, retry later"}'])).toBe('');
    expect(authFailure(['{"type":"result","is_error":false,"result":"done"}'])).toBe('');
  });
});
