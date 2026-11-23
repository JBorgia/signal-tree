import { spawnSync } from 'node:child_process';
import { appendFileSync, cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { LOCK_REF, acquire, holder, lockIdentity, release } from './lock.mjs';
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
  // A remote and two clones of it, a and b, made once; each test works on a copy.
  let template = '';
  beforeAll(() => {
    template = mkdtempSync(join(tmpdir(), 'signal-tree-lock-template-'));
    sh(template, 'init', '-q', '--bare', join(template, 'remote.git'));
    for (const name of ['a', 'b']) sh(template, 'clone', '-q', join(template, 'remote.git'), join(template, name));
  });
  afterAll(() => rmSync(template, { recursive: true, force: true }));
  const roots: string[] = [];
  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });
  /** A copy of the template, with the clones' origin pointing at the copied remote. */
  const setup = () => {
    const root = mkdtempSync(join(tmpdir(), 'signal-tree-lock-'));
    roots.push(root);
    cpSync(template, root, { recursive: true });
    for (const name of ['a', 'b']) {
      const config = join(root, name, '.git', 'config');
      writeFileSync(config, readFileSync(config, 'utf8').replaceAll(join(template, 'remote.git'), join(root, 'remote.git')));
    }
    return { root, a: join(root, 'a'), b: join(root, 'b') };
  };

  it('lets one session hold the lock and refuses another, naming the holder', () => {
    const { a, b } = setup();
    expect(acquire({ cwd: a, session: 'session-a' })).toMatchObject({ acquired: true });
    const refused = acquire({ cwd: b, session: 'session-b' });
    expect(refused.acquired).toBe(false);
    expect(refused.holder).toMatchObject({ session: 'session-a', startedAt: expect.any(String), host: expect.any(String) });
  });

  it('shows the holder to every clone', () => {
    const { a, b } = setup();
    acquire({ cwd: a, session: 'session-a' });
    expect(holder({ cwd: b })).toMatchObject({ session: 'session-a' });
  });

  it('lets the holding session take it again', () => {
    const { a } = setup();
    acquire({ cwd: a, session: 'session-a' });
    expect(acquire({ cwd: a, session: 'session-a' })).toMatchObject({ acquired: true, reused: true });
  });

  it('does not let another session release it', () => {
    const { a, b } = setup();
    acquire({ cwd: a, session: 'session-a' });
    expect(release({ cwd: b, session: 'session-b' })).toMatchObject({ released: false });
    expect(holder({ cwd: b })).toMatchObject({ session: 'session-a' });
  });

  it('lets --force release it from another clone', () => {
    const { a, b } = setup();
    acquire({ cwd: a, session: 'session-a' });
    expect(release({ cwd: b, force: true })).toMatchObject({ released: true });
    expect(holder({ cwd: a })).toBeNull();
  });

  it('lets another session take it once the holder releases it', () => {
    const { a, b } = setup();
    acquire({ cwd: a, session: 'session-a' });
    expect(release({ cwd: a, session: 'session-a' })).toMatchObject({ released: true });
    expect(acquire({ cwd: b, session: 'session-b' })).toMatchObject({ acquired: true });
  });

  it("takes the lock commit's identity from SIGNAL_TREE_GIT_NAME and SIGNAL_TREE_GIT_EMAIL, defaulting to Jonathan", () => {
    expect(lockIdentity({})).toEqual({ name: 'Jonathan Borgia', email: 'jonathanborgia@gmail.com' });
    expect(lockIdentity({ SIGNAL_TREE_GIT_NAME: 'Borgia', SIGNAL_TREE_GIT_EMAIL: 'other@example.com' })).toEqual({ name: 'Borgia', email: 'other@example.com' });
  });

  /** The author and committer of the lock commit `acquire` makes in a clone whose git config names someone else. */
  const lockCommitter = (identity?: { name: string; email: string }) => {
    const { a } = setup();
    appendFileSync(join(a, '.git', 'config'), '[user]\n\tname = Someone Else\n\temail = someone@example.com\n');
    const held = acquire({ cwd: a, session: 'session-a', ...(identity ? { identity } : {}) });
    return sh(a, 'log', '-1', '--format=%an <%ae> / %cn <%ce>', held.holder.sha).stdout.trim();
  };

  it("commits the lock as lockIdentity() of the environment, whatever git config says", () => {
    const { name, email } = lockIdentity();
    expect(lockCommitter()).toBe(`${name} <${email}> / ${name} <${email}>`);
  });

  it('commits the lock as Jonathan by default', () => {
    expect(lockCommitter(lockIdentity({}))).toBe('Jonathan Borgia <jonathanborgia@gmail.com> / Jonathan Borgia <jonathanborgia@gmail.com>');
  });

  it('commits the lock as SIGNAL_TREE_GIT_NAME and SIGNAL_TREE_GIT_EMAIL when they are set', () => {
    expect(lockCommitter(lockIdentity({ SIGNAL_TREE_GIT_NAME: 'Borgia', SIGNAL_TREE_GIT_EMAIL: 'other@example.com' }))).toBe('Borgia <other@example.com> / Borgia <other@example.com>');
  });

  it('cannot be taken by a racing session: creation is a compare-and-swap on the remote', () => {
    const { a, b } = setup();
    acquire({ cwd: a, session: 'session-a' });
    const sha = sh(b, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit-tree', '4b825dc642cb6eb9a060e54bf8d69288fbee4904', '-m', '{"session":"session-b"}').stdout.trim();
    const push = sh(b, 'push', `--force-with-lease=${LOCK_REF}:`, 'origin', `${sha}:${LOCK_REF}`);
    expect(push.status).not.toBe(0);
    expect(holder({ cwd: b })).toMatchObject({ session: 'session-a' });
  });
});

describe('supervisor model pin', () => {
  const script = new URL('./supervise.sh', import.meta.url).pathname;
  const text = () => readFileSync(script, 'utf8');

  for (const args of ['--model claude-sonnet-5-5', '--fallback-model claude-haiku-5-5']) {
    it(`refuses extra arguments that set a model: ${args}`, () => {
      const state = mkdtempSync(join(tmpdir(), 'signal-tree-sup-'));
      try {
        const run = spawnSync('bash', [script], { env: { ...process.env, SIGNAL_TREE_ISOLATED: '1', SIGNAL_TREE_STATE_DIR: state, SIGNAL_TREE_CLAUDE_ARGS: args }, encoding: 'utf8' });
        expect(run.status).toBe(2);
        expect(run.stderr).toContain('pinned to claude-opus-5-5');
      } finally {
        rmSync(state, { recursive: true, force: true });
      }
    });
  }

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

  for (const version of ['2.1.323', '2.1.281']) {
    it(`turns attribution off with the single switch on ${version} (from 2.1.281)`, () => {
      expect(fn(`attribution_setting ${version}`)).toBe('false');
    });
  }

  for (const version of ['2.1.280', '2.0.9', '']) {
    it(`empties the attribution texts and the session URL on ${version ? `older version ${version}` : 'an unknown version'}`, () => {
      expect(JSON.parse(fn(`attribution_setting '${version}'`))).toEqual({ commit: '', pr: '', sessionUrl: false });
    });
  }

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

  for (const [result, shown] of [
    ['Failed to authenticate: OAuth session expired and could not be refreshed', 'authenticate'],
    ['Invalid API key', 'API key'],
  ] as const) {
    it(`recognises a run that failed to authenticate: ${result}`, () => {
      expect(authFailure([JSON.stringify({ type: 'result', is_error: true, result })])).toContain(shown);
    });
  }

  for (const [what, line] of [
    ['another error', '{"type":"result","is_error":true,"result":"Rate limited, retry later"}'],
    ['a success', '{"type":"result","is_error":false,"result":"done"}'],
  ] as const) {
    it(`does not mistake ${what} for an authentication failure`, () => {
      expect(authFailure([line])).toBe('');
    });
  }
});
