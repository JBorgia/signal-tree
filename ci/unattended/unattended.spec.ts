import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

/** process.env without the developer's own Claude or Anthropic settings, plus `extra`. */
function claudeEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
  const env: Record<string, string | undefined> = { ...process.env };
  for (const name of Object.keys(env)) if (/^(ANTHROPIC_|CLAUDE_)/.test(name)) delete env[name];
  return { ...env, ...extra } as NodeJS.ProcessEnv;
}

const TOKEN = 'sk-ant-oat01-test-subscription-token';

describe("supervisor authentication (Jonathan's ruling of 2026-11-23)", () => {
  const script = new URL('./supervise.sh', import.meta.url).pathname;

  /** The whole supervisor with `extra` set. With no mint config it stops at the key check (exit 13), after the credential checks. */
  const start = (extra: Record<string, string>) => {
    const state = mkdtempSync(join(tmpdir(), 'signal-tree-sup-'));
    try {
      return spawnSync('bash', [script], { env: claudeEnv({ SIGNAL_TREE_ISOLATED: '1', SIGNAL_TREE_STATE_DIR: state, SIGNAL_TREE_APP_CONFIG: join(state, 'missing.json'), ...extra }), encoding: 'utf8' });
    } finally {
      rmSync(state, { recursive: true, force: true });
    }
  };

  it('refuses to start without CLAUDE_CODE_OAUTH_TOKEN (exit 6)', () => {
    const run = start({});
    expect(run.status).toBe(6);
    expect(run.stderr).toContain('set CLAUDE_CODE_OAUTH_TOKEN');
    expect(run.stderr).toContain('`claude setup-token`');
  });

  it('refuses to start with an empty CLAUDE_CODE_OAUTH_TOKEN (exit 6)', () => {
    const run = start({ CLAUDE_CODE_OAUTH_TOKEN: '' });
    expect(run.status).toBe(6);
    expect(run.stderr).toContain('set CLAUDE_CODE_OAUTH_TOKEN');
  });

  for (const name of ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN']) {
    for (const [what, value] of [
      ['set', 'sk-ant-api03-SECRET'],
      ['set but empty', ''],
    ] as const) {
      it(`refuses to start when ${name} is ${what}, even with the subscription token (exit 6)`, () => {
        const run = start({ CLAUDE_CODE_OAUTH_TOKEN: TOKEN, [name]: value });
        expect(run.status).toBe(6);
        expect(run.stderr).toContain(`Refusing to start: ${name} is set. This VM uses Jonathan's Claude subscription (CLAUDE_CODE_OAUTH_TOKEN) as its only Claude credential`);
        expect(run.stderr).not.toContain('SECRET');
      });
    }
  }

  it('passes the credential checks with the subscription token alone, stopping only later at the key check', () => {
    const run = start({ CLAUDE_CODE_OAUTH_TOKEN: TOKEN });
    expect(run.status).toBe(13);
    expect(run.stderr).toContain('cannot read the key path (keyFile)');
    expect(run.stderr).not.toMatch(/CLAUDE_CODE_OAUTH_TOKEN|ANTHROPIC_/);
  });

  it('never removes CLAUDE_CODE_OAUTH_TOKEN from the environment the session inherits', () => {
    expect(readFileSync(script, 'utf8')).not.toMatch(/unset[^\n]*CLAUDE_CODE_OAUTH_TOKEN|-u *CLAUDE_CODE_OAUTH_TOKEN/);
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
    ['OAuth token revoked · Please run /login', 'OAuth token revoked'],
    ['Login expired · Please run /login', 'Please run /login'],
    ['API Error: 401 {"type":"error","error":{"type":"authentication_error","message":"OAuth token has expired."}}', '401'],
  ] as const) {
    it(`recognises a run that failed to authenticate: ${result}`, () => {
      expect(authFailure([JSON.stringify({ type: 'result', is_error: true, result })])).toContain(shown);
    });
  }

  for (const [what, line] of [
    ['another error', '{"type":"result","is_error":true,"result":"Rate limited, retry later"}'],
    ['a success', '{"type":"result","is_error":false,"result":"done"}'],
    // 1764014010 contains 401.
    ['a usage limit whose reset time contains 401', '{"type":"result","is_error":true,"result":"Claude AI usage limit reached|1764014010"}'],
    ['a usage limit', JSON.stringify({ type: 'result', is_error: true, result: "You've hit your limit · resets 1pm (UTC)" })],
    // Hypothetical wording: no usage-limit text counts, whatever else it says.
    ['a usage limit message that also names an API key','{"type":"result","is_error":true,"result":"Usage limit reached · resets 1pm (UTC) · or continue with an API key"}'],
    ['an outage whose request ID contains 401', '{"type":"result","is_error":true,"result":"API Error: 529 Overloaded · request req_0114017"}'],
  ] as const) {
    it(`does not mistake ${what} for an authentication failure`, () => {
      expect(authFailure([line])).toBe('');
    });
  }
});

describe('usage limit detection', () => {
  const script = new URL('./supervise.sh', import.meta.url).pathname;
  const RESET = 1795438800;
  /** usage_limit on a run log of `lines` (objects are written as JSON). */
  const usageLimit = (lines: (object | string)[]) => {
    const dir = mkdtempSync(join(tmpdir(), 'signal-tree-sup-'));
    try {
      const log = join(dir, 'run.log');
      writeFileSync(log, lines.map((line) => (typeof line === 'string' ? line : JSON.stringify(line))).join('\n'));
      return spawnSync('bash', ['-c', `eval "$(sed -n '/^usage_limit()/,/^}/p' "${script}")"; usage_limit "${log}"`], { encoding: 'utf8' }).stdout;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
  const event = (info: object) => ({ type: 'rate_limit_event', rate_limit_info: info, uuid: 'u', session_id: 's' });

  it("reads the type and reset time of a rejected rate_limit_event, skipping lines that are not JSON", () => {
    expect(usageLimit(['Error: something on stderr', event({ status: 'rejected', resetsAt: RESET, rateLimitType: 'five_hour', isUsingOverage: false })])).toBe(`five_hour ${RESET}\n`);
  });

  it('takes a reset time above 1e12 as milliseconds', () => {
    expect(usageLimit([event({ status: 'rejected', resetsAt: RESET * 1000, rateLimitType: 'seven_day' })])).toBe(`seven_day ${RESET}\n`);
  });

  it('gives an unknown type and no reset time when the event has neither', () => {
    expect(usageLimit([event({ status: 'rejected' })])).toBe('unknown \n');
  });

  for (const status of ['allowed', 'allowed_warning']) {
    it(`does not take an event with status ${status} for a limit`, () => {
      expect(usageLimit([event({ status, resetsAt: RESET, rateLimitType: 'five_hour' })])).toBe('');
    });
  }

  it('does not take a rejection that a later allowed event replaced for a limit', () => {
    expect(usageLimit([event({ status: 'rejected', resetsAt: RESET }), event({ status: 'allowed', resetsAt: RESET })])).toBe('');
  });

  for (const [what, line] of [
    ['an assistant error rate_limit', { type: 'assistant', message: { model: '<synthetic>' }, error: 'rate_limit' }],
    ['a result with apiError usage_limit_reached', { type: 'result', is_error: true, apiError: 'usage_limit_reached' }],
    ['an assistant message with api_error usage_limit_reached', { type: 'assistant', message: { model: '<synthetic>' }, api_error: 'usage_limit_reached' }],
  ] as const) {
    it(`recognises ${what} without a rate_limit_event, with no reset time`, () => {
      expect(usageLimit([line])).toBe('unknown \n');
    });
  }

  for (const [what, line] of [
    ['an authentication failure', { type: 'result', is_error: true, result: 'Invalid API key · Please run /login' }],
    ['a success', { type: 'result', is_error: false, result: 'done' }],
  ] as const) {
    it(`does not take ${what} for a limit`, () => {
      expect(usageLimit([line])).toBe('');
    });
  }
});

describe('supervisor session loop', () => {
  // The loop (run_sessions) runs with fakes first on PATH: claude; sleep and
  // date, so no test waits on the clock; gh, which only logs; and node, which
  // answers for the verifier's done check (it passes after claude's last
  // scripted run) and stop hook (never stuck), the loop's only node commands.
  // sync_verifier does nothing, so nothing reaches the network.
  const script = new URL('./supervise.sh', import.meta.url).pathname;
  const NOW = Date.UTC(2026, 10, 23, 12, 0, 0) / 1000;
  const SESSION = '0f6f2c4e-1b7a-4c1e-9d0e-3b7f5a2c9e11';
  const writeScript = (path: string, body: string) => {
    writeFileSync(path, `#!/usr/bin/env bash\n${body}\n`);
    chmodSync(path, 0o755);
  };
  // The fakes, made once. Each works in the test's directory, $LOOP: claude
  // prints run-<n>.jsonl on its nth run and, after the last one, marks the
  // done check as passing.
  let fake = '';
  beforeAll(() => {
    fake = mkdtempSync(join(tmpdir(), 'signal-tree-loop-bin-'));
    writeScript(
      join(fake, 'claude'),
      [
        'n=$(( $(cat "$LOOP/count" 2> /dev/null || echo 0) + 1 )); echo "$n" > "$LOOP/count"',
        '[[ -f $LOOP/run-$n.jsonl ]] || { echo "unexpected run $n" >> "$LOOP/claude.log"; kill "$PPID"; exit 1; }',
        `printf 'token=%s args=%s\\n' "\${CLAUDE_CODE_OAUTH_TOKEN-unset}" "$*" >> "$LOOP/claude.log"`,
        'cat "$LOOP/run-$n.jsonl"',
        '[[ -f $LOOP/run-$((n + 1)).jsonl ]] || : > "$LOOP/done"',
        'exit 1',
      ].join('\n'),
    );
    writeScript(join(fake, 'sleep'), 'echo "$*" >> "$LOOP/sleep.log"');
    writeScript(join(fake, 'date'), `if [[ $* == +%s ]]; then echo ${NOW}; else exec /bin/date "$@"; fi`);
    writeScript(join(fake, 'gh'), `printf '%s\\n' "$*" >> "$LOOP/gh.log"`);
    writeScript(
      join(fake, 'node'),
      ['case "$*" in', '  ci/done-check.mjs) [[ -f $LOOP/done ]] ;;', '  "$SIGNAL_TREE_VERIFY_DIR/ci/unattended/stop-hook.mjs --is-stuck") exit 1 ;;', '  *) echo "unexpected node $*" >&2; exit 2 ;;', 'esac'].join('\n'),
    );
  });
  afterAll(() => rmSync(fake, { recursive: true, force: true }));
  const roots: string[] = [];
  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  const init = { type: 'system', subtype: 'init', model: 'claude-opus-5-5', session_id: SESSION };
  const answer = (model = 'claude-opus-5-5') => ({ type: 'assistant', message: { model, content: [{ type: 'text', text: 'Working on it.' }] }, session_id: SESSION });
  /** A run that ends without reaching a limit. */
  const worked = [init, answer(), { type: 'result', subtype: 'success', is_error: false, result: 'Stopped.' }];
  /**
   * A run that hits the subscription's limit, as Claude Code 2.1.331 writes it:
   * a rejected rate_limit_event (with `info`), then its own error message, under
   * the model name <synthetic>, and an error result.
   */
  const limited = (info: object, model = 'claude-opus-5-5') => [
    init,
    answer(model),
    { type: 'rate_limit_event', rate_limit_info: { status: 'rejected', rateLimitType: 'five_hour', isUsingOverage: false, ...info }, uuid: 'u', session_id: SESSION },
    { type: 'assistant', message: { model: '<synthetic>', content: [{ type: 'text', text: "You've hit your limit · resets 1pm (UTC)" }] }, error: 'rate_limit', session_id: SESSION },
    { type: 'result', subtype: 'success', is_error: true, result: "You've hit your limit · resets 1pm (UTC)" },
  ];

  /**
   * run_sessions on a new session whose nth claude run prints runs[n - 1] and
   * exits 1. A claude run beyond those ends the loop, so a test cannot hang.
   */
  const loop = (runs: object[][]) => {
    const root = mkdtempSync(join(tmpdir(), 'signal-tree-loop-'));
    roots.push(root);
    const [state, verify] = [join(root, 'state'), join(root, 'verify')];
    for (const dir of [state, verify]) mkdirSync(dir);
    runs.forEach((events, i) => writeFileSync(join(root, `run-${i + 1}.jsonl`), events.map((e) => JSON.stringify(e)).join('\n') + '\n'));
    const at = (name: string) => join(root, name);
    const log = join(state, 'session.log');
    const functions = ['run_sessions', 'usage_limit', 'pause_for_usage_limit', 'utc_time', 'duration_text', 'auth_failure', 'report'];
    const shell = [
      `eval "$(sed -n '/^readonly /p;${functions.map((name) => `/^${name}()/,/^}/p`).join(';')}' "${script}")"`,
      'sync_verifier() { :; }',
      `run_sessions ${SESSION} 1 '{"model":"claude-opus-5-5"}' '--permission-mode bypassPermissions' "${log}"`,
    ].join('\n');
    const run = spawnSync('bash', ['-c', shell], {
      env: claudeEnv({ PATH: `${fake}:${process.env.PATH}`, LOOP: root, CLAUDE_CODE_OAUTH_TOKEN: TOKEN, SIGNAL_TREE_STATE_DIR: state, SIGNAL_TREE_VERIFY_DIR: verify, SIGNAL_TREE_STATUS_ISSUE: '7' }),
      encoding: 'utf8',
    });
    const lines = (name: string) => (existsSync(at(name)) ? readFileSync(at(name), 'utf8').trim().split('\n') : []);
    return {
      ...run,
      log,
      claude: lines('claude.log'),
      sleeps: lines('sleep.log'),
      gh: lines('gh.log'),
      /** The supervisor's own lines in the session log, without the runs' events. */
      notes: readFileSync(log, 'utf8').split('\n').filter((line) => line !== '' && !line.startsWith('{')),
    };
  };
  const paused = (type: string, until: string, length: string) => `2026-11-23T12:00:00Z usage limit (${type}) reached; paused until ${until} (${length})`;

  it('waits until a minute after the reset time, then resumes the same session, which finishes: exit 0, no report', () => {
    const r = loop([limited({ resetsAt: NOW + 3600 }), worked]);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain('Done: node ci/done-check.mjs passes on origin/main.');
    // 3660 s for the limit; then the usual 60 s backoff after the second run's quick exit.
    expect(r.sleeps).toEqual(['3660', '60']);
    expect(r.claude).toHaveLength(2);
    expect(r.claude[0]).toContain(`--session-id ${SESSION} `);
    expect(r.claude[1]).toContain(`--resume ${SESSION} `);
    expect(r.claude[1]).toContain('Continue the rebuild from BRIEF.md');
    expect(r.notes[0]).toBe(paused('five_hour', '2026-11-23T13:00:00Z', '1 h 1 min'));
    expect(r.notes[1]).toMatch(/^\S+Z claude exited with 1 after \d+s$/);
    expect(r.notes).toHaveLength(2);
    expect(r.gh).toEqual([]);
  });

  it('notes the pause so that the daily usage report lists it with its length', () => {
    const r = loop([limited({ resetsAt: NOW + 3600 }), worked]);
    const usage = spawnSync('bash', ['-c', `eval "$(sed -n '/^usage_report()/,/^}/p' "${script}")"; usage_report "${r.log}" /nonexistent ${NOW + 600}`], { encoding: 'utf8' });
    expect(usage.stdout).toContain('Usage-limit pauses in the last 24 hours: 1: five_hour from 2026-11-23T12:00:00Z, 1 h 1 min (still paused).\n');
  });

  for (const [what, info] of [
    ['no reset time', {}],
    ['a reset time in the past', { resetsAt: NOW - 60 }],
    ['a reset time more than 8 days ahead', { resetsAt: NOW + 9 * 86400 }],
  ] as const) {
    it(`waits 30 minutes, then resumes, when the limit gives ${what}`, () => {
      const r = loop([limited(info), worked]);
      expect(r.status, r.stderr).toBe(0);
      expect(r.sleeps).toEqual(['1800', '60']);
      expect(r.claude[1]).toContain(`--resume ${SESSION} `);
      expect(r.notes[0]).toBe(paused('five_hour', '2026-11-23T12:30:00Z', '30 min'));
      expect(r.gh).toEqual([]);
    });
  }

  it('waits 30 minutes again each time the limit persists with no reset time', () => {
    const r = loop([limited({}), limited({}), worked]);
    expect(r.status, r.stderr).toBe(0);
    expect(r.sleeps).toEqual(['1800', '1800', '60']);
    expect(r.claude).toHaveLength(3);
    expect(r.gh).toEqual([]);
  });

  it('resets the quick-exit backoff to 60 s after a usage limit', () => {
    // Without the reset, the last backoff would be 120 s, doubled after the first run.
    const r = loop([worked, limited({ resetsAt: NOW + 600 }), worked]);
    expect(r.status, r.stderr).toBe(0);
    expect(r.sleeps).toEqual(['60', '660', '60']);
  });

  it('gives the session the subscription token from its environment', () => {
    const r = loop([worked]);
    expect(r.status, r.stderr).toBe(0);
    expect(r.claude).toEqual([expect.stringMatching(new RegExp(`^token=${TOKEN} args=-p --session-id ${SESSION} `))]);
  });

  it('still stops on an authentication failure (exit 7), reporting how to replace the token, without waiting', () => {
    const r = loop([[init, { type: 'result', subtype: 'success', is_error: true, result: 'OAuth token revoked · Please run /login' }]]);
    expect(r.status).toBe(7);
    expect(r.sleeps).toEqual([]);
    expect(r.gh).toEqual([
      "issue comment 7 --body The unattended session could not authenticate: OAuth token revoked · Please run /login. The supervisor has stopped; as the agent user, re-run `claude setup-token` and replace the token in the agent user's secret store (#18).",
    ]);
  });

  it('does not count <synthetic> as another model: a new session\'s "Goal set" message, then a normal stop, resumes (no exit 5)', () => {
    // Claude Code 2.1.331 writes "Goal set: ..." under the model name <synthetic> when /goal starts a session.
    const goalSet = { type: 'assistant', message: { model: '<synthetic>', content: [{ type: 'text', text: 'Goal set: node ci/done-check.mjs exits 0' }] }, session_id: SESSION };
    const r = loop([[init, goalSet, answer(), { type: 'result', subtype: 'success', is_error: false, result: 'Stopped.' }], worked]);
    expect(r.status, r.stderr).toBe(0);
    expect(r.claude).toHaveLength(2);
    expect(r.claude[1]).toContain(`--resume ${SESSION} `);
    expect(r.gh).toEqual([]);
  });

  it('does not count an API error message (<synthetic>) as another model: it backs off and resumes (no exit 5)', () => {
    const outage = { type: 'assistant', message: { model: '<synthetic>', content: [{ type: 'text', text: 'API Error: 529 Overloaded' }] }, session_id: SESSION };
    const r = loop([[init, answer(), outage, { type: 'result', subtype: 'success', is_error: true, result: 'API Error: 529 Overloaded' }], worked]);
    expect(r.status, r.stderr).toBe(0);
    expect(r.sleeps[0]).toBe('60');
    expect(r.claude).toHaveLength(2);
    expect(r.gh).toEqual([]);
  });

  it('still stops on a real other model next to <synthetic> messages (exit 5)', () => {
    const goalSet = { type: 'assistant', message: { model: '<synthetic>', content: [{ type: 'text', text: 'Goal set: node ci/done-check.mjs exits 0' }] }, session_id: SESSION };
    const r = loop([[init, goalSet, answer('claude-sonnet-5-5'), { type: 'result', subtype: 'success', is_error: false, result: 'Stopped.' }]]);
    expect(r.status).toBe(5);
    expect(r.gh).toHaveLength(1);
    expect(r.gh[0]).toContain('ran on claude-sonnet-5-5 instead of claude-opus-5-5');
    expect(r.gh[0]).not.toContain('<synthetic>');
  });

  it('still stops when a run that hit the limit reported another model (exit 5), without waiting', () => {
    const r = loop([limited({ resetsAt: NOW + 3600 }, 'claude-sonnet-5-5')]);
    expect(r.status).toBe(5);
    expect(r.sleeps).toEqual([]);
    expect(r.gh).toHaveLength(1);
    expect(r.gh[0]).toContain('ran on ');
    expect(r.gh[0]).toContain('claude-sonnet-5-5');
  });
});

describe("supervisor installed copy (Jonathan's ruling of 2026-11-24)", () => {
  // check_installed_copy against a local bare remote whose main holds the four
  // supervisor files as they are in this checkout. The installed copy is a
  // directory laid out like ci/ under /opt/signal-tree. Each fetch gets a FIFO
  // as its deadline, which nothing writes, so no outcome depends on the clock.
  const script = new URL('./supervise.sh', import.meta.url).pathname;
  const source = new URL('..', import.meta.url).pathname;
  const FILES = ['unattended/supervise.sh', 'unattended/app-token.mjs', 'unattended/bin/gh', 'codeowners.mjs'];
  const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
  const roots: string[] = [];
  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });
  const gitEnv = { ...claudeEnv({}), GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 'Seed', GIT_AUTHOR_EMAIL: 'seed@example.com', GIT_COMMITTER_NAME: 'Seed', GIT_COMMITTER_EMAIL: 'seed@example.com' };
  const git = (cwd: string, ...args: string[]) => {
    const r = spawnSync('git', args, { cwd, env: gitEnv, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
    return r.stdout.trim();
  };
  /** Copies the four files from the directory holding ci/ files at `from` into `to`, laid out the same way. */
  const copyFiles = (from: string, to: string) => {
    for (const file of FILES) cpSync(join(from, file), join(to, file));
  };
  const fixture = () => {
    const root = mkdtempSync(join(tmpdir(), 'signal-tree-installed-'));
    roots.push(root);
    const [remote, seed, work, installed] = ['remote.git', 'seed', 'work', join('opt', 'ci')].map((name) => join(root, name));
    git(root, 'init', '-q', '--bare', '-b', 'main', remote);
    git(root, 'clone', '-q', remote, seed);
    copyFiles(source, join(seed, 'ci'));
    git(seed, 'add', '.');
    git(seed, 'commit', '-qm', 'seed');
    git(seed, 'push', '-q', 'origin', 'HEAD:main');
    git(root, 'clone', '-q', remote, work);
    copyFiles(source, installed);
    const deadline = join(root, 'deadline');
    expect(spawnSync('mkfifo', [deadline]).status).toBe(0);
    const check = () => {
      const functions = ['check_installed_copy', 'sha256', 'with_timeout'];
      const shell = `eval "$(sed -n '/^readonly /p;${functions.map((name) => `/^${name}()/,/^}/p`).join(';')}' "${script}")"; check_installed_copy "${work}" "${join(installed, 'unattended')}" "${deadline}"`;
      return spawnSync('bash', ['-c', shell], { env: { ...gitEnv, TMPDIR: root }, encoding: 'utf8' });
    };
    return { root, remote, seed, work, installed, check };
  };

  it('passes when this script and every helper hash like main\'s', () => {
    const f = fixture();
    const r = f.check();
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toMatch(/^Supervisor check passed: this script and its helpers are main's \(origin\/main [0-9a-f]{12}\)\.\n$/);
    expect(r.stderr).toBe('');
  });

  for (const file of FILES) {
    it(`refuses (exit 15 in the supervisor) when the installed ${file} differs from main's, naming it and both hashes`, () => {
      const f = fixture();
      const path = join(f.installed, file);
      const theirs = sha256(path);
      appendFileSync(path, '\n');
      const r = f.check();
      expect(r.status).toBe(1);
      // The script names each file under its own directory, so codeowners.mjs as .../unattended/../codeowners.mjs.
      const shown = `${join(f.installed, 'unattended')}/${file.startsWith('unattended/') ? file.slice('unattended/'.length) : `../${file}`}`;
      expect(r.stderr).toContain("Refusing to start: the supervisor is not main's (origin/main ");
      expect(r.stderr).toContain(`  ${shown}: ${sha256(path)}; main's ci/${file}: ${theirs}\n`);
      expect(r.stderr.split('\n').filter((line) => line.startsWith('  '))).toHaveLength(1);
      expect(r.stderr).toContain('installed root-owned and read-only under /opt/signal-tree from main (#18)');
    });
  }

  it('refuses when a helper is missing', () => {
    const f = fixture();
    rmSync(join(f.installed, 'unattended', 'bin', 'gh'));
    const r = f.check();
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(`  ${join(f.installed, 'unattended', 'bin', 'gh')}: missing; main's ci/unattended/bin/gh: ${sha256(join(source, 'unattended', 'bin', 'gh'))}`);
  });

  it('refuses a copy that main has moved past', () => {
    const f = fixture();
    appendFileSync(join(f.seed, 'ci', 'unattended', 'supervise.sh'), '# a later change on main\n');
    git(f.seed, 'commit', '-qam', 'later');
    git(f.seed, 'push', '-q', 'origin', 'HEAD:main');
    const r = f.check();
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(`  ${join(f.installed, 'unattended', 'supervise.sh')}: ${sha256(join(source, 'unattended', 'supervise.sh'))}; main's ci/unattended/supervise.sh: ${sha256(join(f.seed, 'ci', 'unattended', 'supervise.sh'))}`);
  });

  it("ignores the agent's checkout: a changed supervise.sh on its branch does not matter, the copy that runs does", () => {
    const f = fixture();
    appendFileSync(join(f.work, 'ci', 'unattended', 'supervise.sh'), '# the agent\'s branch\n');
    git(f.work, 'commit', '-qam', 'agent change');
    expect(f.check().status).toBe(0);
  });

  it('refuses when main cannot be fetched', () => {
    const f = fixture();
    rmSync(f.remote, { recursive: true, force: true });
    const r = f.check();
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("Refusing to start: could not fetch main to check that the supervisor is main's:");
  });

  // main() with every check and every step after them replaced by a stub that
  // logs its name, to show where --self-test stops.
  const runMain = (args: string[]) => {
    const root = mkdtempSync(join(tmpdir(), 'signal-tree-main-'));
    roots.push(root);
    const stubs = ['check_state_dir', 'check_key_unreadable', 'use_github_app', 'check_origin', 'use_real_gh', 'check_main_rules', 'check_installed_copy', 'workflow_selftest', 'sync_verifier']
      .map((name) => `${name}() { echo "${name}"; }`)
      .join('; ');
    const shell = [
      `eval "$(sed -n '/^readonly /p;/^main()/,/^}/p' "${script}")"`,
      stubs,
      `git() { if [[ $1 == rev-parse ]]; then echo "${root}"; else echo "git $1 $2 $3"; fi; }`,
      'node() { echo "node ${1##*/} $2"; return 1; }',
      `main ${args.join(' ')}`,
    ].join('\n');
    return spawnSync('bash', ['-c', shell], { cwd: root, env: claudeEnv({ SIGNAL_TREE_ISOLATED: '1', CLAUDE_CODE_OAUTH_TOKEN: TOKEN, SIGNAL_TREE_STATE_DIR: join(root, 'state') }), encoding: 'utf8' });
  };
  const CHECKS = ['check_state_dir', 'check_key_unreadable', 'use_github_app', 'check_origin', 'use_real_gh', 'check_main_rules'];

  it('--self-test runs every startup check, the installed copy before the workflow self-test, and exits 0 before the lock', () => {
    const r = runMain(['--self-test']);
    expect(r.status, r.stderr).toBe(0);
    const steps = r.stdout.trim().split('\n');
    expect(steps.slice(0, 6)).toEqual(CHECKS);
    expect(steps.slice(6)).toEqual(['check_installed_copy', 'workflow_selftest', 'Startup self-test: PASS (every startup check, through the workflow self-test; no lock taken, no session started).']);
    expect(r.stdout).not.toMatch(/sync_verifier|lock\.mjs|git clone/);
  });

  it('without --self-test goes on past the same checks to the agent lock', () => {
    const r = runMain([]);
    expect(r.status).toBe(4);
    const steps = r.stdout.trim().split('\n');
    expect(steps.slice(0, 6)).toEqual(CHECKS);
    expect(steps.slice(6, 8)).toEqual(['check_installed_copy', 'workflow_selftest']);
    expect(steps.at(-1)).toMatch(/^node lock\.mjs acquire$/);
  });

  for (const args of [['--bogus'], ['--self-test', '--self-test'], ['self-test']]) {
    it(`refuses the arguments ${args.join(' ')} (exit 2)`, () => {
      const r = runMain(args);
      expect(r.status).toBe(2);
      expect(r.stderr).toBe('Usage: supervise.sh [--self-test]\n');
      expect(r.stdout).toBe('');
    });
  }
});

describe("daily usage report (Jonathan's ruling of 2026-11-24)", () => {
  const script = new URL('./supervise.sh', import.meta.url).pathname;
  const NOW = Date.UTC(2026, 10, 24, 12, 0, 0) / 1000;
  const iso = (seconds: number) => new Date(seconds * 1000).toISOString().replace('.000Z', 'Z');
  const roots: string[] = [];
  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });
  const scratch = () => {
    const root = mkdtempSync(join(tmpdir(), 'signal-tree-usage-'));
    roots.push(root);
    return root;
  };
  const functions = (...names: string[]) => `eval "$(sed -n '/^readonly /p;${names.map((name) => `/^${name}()/,/^}/p`).join(';')}' "${script}")"`;
  const shell = (body: string, env: Record<string, string> = {}) => spawnSync('bash', ['-c', body], { env: claudeEnv(env), encoding: 'utf8' });

  for (const [seconds, text] of [
    [0, '0 min'],
    [1, '1 min'],
    [60, '1 min'],
    [61, '2 min'],
    [1800, '30 min'],
    [3600, '1 h'],
    [3660, '1 h 1 min'],
    [6 * 86400 + 2 * 3600, '6 d 2 h'],
    [8 * 86400 + 60, '8 d 1 min'],
  ] as const) {
    it(`writes ${seconds} s as "${text}"`, () => {
      expect(shell(`${functions('duration_text')}; duration_text ${seconds}`).stdout).toBe(`${text}\n`);
    });
  }

  /** A rate_limit_event as Claude Code 2.1.331 writes it, with both windows. */
  const event = (fiveHour: number, sevenDay: number, extra: object = {}) => ({
    type: 'rate_limit_event',
    rate_limit_info: {
      status: 'allowed_warning',
      resetsAt: NOW + 6 * 86400,
      rateLimitType: 'seven_day',
      utilization: sevenDay,
      overageStatus: 'rejected',
      isUsingOverage: false,
      unifiedWindows: { five_hour: { utilization: fiveHour, resetsAt: NOW + 3600, status: 'allowed' }, seven_day: { utilization: sevenDay, resetsAt: NOW + 6 * 86400, status: 'allowed' } },
      ...extra,
    },
    uuid: 'u',
    session_id: 's',
  });
  const note = (start: number, until: number, type = 'five_hour') => `${iso(start)} usage limit (${type}) reached; paused until ${iso(until)} (${type === 'five_hour' ? '20 min' : '3 d'})`;
  /** usage_report on a session log and, unless null, a run log, each given as lines (objects become JSON). */
  const report = (session: (object | string)[], run: (object | string)[] | null = null) => {
    const root = scratch();
    const write = (name: string, lines: (object | string)[]) => writeFileSync(join(root, name), lines.map((line) => (typeof line === 'string' ? line : JSON.stringify(line))).join('\n') + '\n');
    write('session.log', session);
    if (run) write('run.log', run);
    const r = shell(`${functions('usage_report')}; usage_report "${join(root, 'session.log')}" "${join(root, 'run.log')}" ${NOW}`);
    expect(r.stderr).toBe('');
    return r.stdout.split('\n').filter(Boolean);
  };
  const USAGE = `Subscription usage, from the latest rate_limit_event: 5-hour 7% (resets ${iso(NOW + 3600)}), 7-day 43% (resets ${iso(NOW + 6 * 86400)}).`;

  it('reports both windows from the last rate_limit_event, skipping lines that are not JSON or notes', () => {
    expect(report(['Error: on stderr', event(0.88, 0.41), `${iso(NOW - 60)} claude exited with 0 after 178s`, event(0.07, 0.43)])).toEqual([USAGE, 'Usage-limit pauses in the last 24 hours: none.']);
  });

  it("takes the current run's log over the session log, since its events are newer", () => {
    expect(report([event(0.5, 0.2)], [event(0.07, 0.43)])[0]).toBe(USAGE);
  });

  it('reads the session log alone when there is no run log', () => {
    expect(report([event(0.07, 0.43)])[0]).toBe(USAGE);
  });

  it('says so when Claude Code has written no rate_limit_event yet', () => {
    expect(report(['nothing here'])).toEqual(['Subscription usage: no rate_limit_event from Claude Code yet.', 'Usage-limit pauses in the last 24 hours: none.']);
  });

  it('falls back to the event\'s own window when it has no unifiedWindows, and shows the other as unknown', () => {
    const plain = { type: 'rate_limit_event', rate_limit_info: { status: 'allowed', rateLimitType: 'seven_day', utilization: 0.5, resetsAt: (NOW + 86400) * 1000 } };
    expect(report([plain])[0]).toBe(`Subscription usage, from the latest rate_limit_event: 5-hour unknown, 7-day 50% (resets ${iso(NOW + 86400)}).`);
  });

  it('lists every pause that overlaps the last 24 hours with its length, marking one still running', () => {
    const lines = report([
      note(NOW - 30 * 3600, NOW - 29 * 3600),
      event(0.07, 0.43),
      note(NOW - 26 * 3600, NOW - 23 * 3600, 'seven_day'),
      note(NOW - 3 * 3600, NOW - 3 * 3600 + 1200),
      note(NOW - 3600, NOW + 3600),
    ]);
    expect(lines).toEqual([
      USAGE,
      `Usage-limit pauses in the last 24 hours: 3: seven_day from ${iso(NOW - 26 * 3600)}, 3 d; five_hour from ${iso(NOW - 3 * 3600)}, 20 min; five_hour from ${iso(NOW - 3600)}, 20 min (still paused).`,
    ]);
  });

  /**
   * usage_ticker, called directly by a bash that stands in for the
   * supervisor, with fakes first on PATH: date prints the next of `times`,
   * sleep logs and, once no time is left, ends the ticker with TERM, and gh
   * logs (exiting with $T/gh-status).
   */
  const ticker = ({ times, stamp, ghStatus = 0, supervisor }: { times: number[]; stamp?: number; ghStatus?: number; supervisor?: number }) => {
    const root = scratch();
    const [bin, state] = [join(root, 'bin'), join(root, 'state')];
    mkdirSync(bin);
    mkdirSync(state);
    const fake = (name: string, body: string) => {
      writeFileSync(join(bin, name), `#!/usr/bin/env bash\n${body}\n`);
      chmodSync(join(bin, name), 0o755);
    };
    writeFileSync(join(root, 'times'), times.map(String).join('\n') + '\n');
    fake('date', 'head -1 "$T/times"; sed -i.bak 1d "$T/times"');
    fake('sleep', 'echo "$*" >> "$T/sleep.log"; [[ -s $T/times ]] || kill -TERM "$PPID"');
    fake('gh', `printf '%s\\n' "$*" >> "$T/gh.log"; exit ${ghStatus}`);
    if (stamp !== undefined) writeFileSync(join(state, 'usage-reported'), `${stamp}\n`);
    writeFileSync(join(state, 'session.log'), `${JSON.stringify(event(0.07, 0.43))}\n`);
    const r = spawnSync('bash', ['-c', `${functions('usage_ticker', 'usage_report', 'report')}; usage_ticker "${join(state, 'session.log')}" "${join(state, 'run.log')}" ${supervisor ?? '$$'}`], {
      env: claudeEnv({ PATH: `${bin}:${process.env.PATH}`, T: root, SIGNAL_TREE_STATE_DIR: state, SIGNAL_TREE_STATUS_ISSUE: '7' }),
      encoding: 'utf8',
      timeout: 20_000,
    });
    const read = (path: string) => (existsSync(path) ? readFileSync(path, 'utf8') : '');
    return { ...r, gh: read(join(root, 'gh.log')), sleeps: read(join(root, 'sleep.log')).trim().split('\n').filter(Boolean), stamp: read(join(state, 'usage-reported')).trim() };
  };

  it('posts nothing at the first start, and the first report 24 hours later on the Rebuild status issue', () => {
    const r = ticker({ times: [NOW, NOW + 600, NOW + 86400] });
    expect(r.status, r.stderr).toBe(0);
    expect(r.sleeps).toEqual(['600', '600', '600']);
    expect(r.gh).toBe(`issue comment 7 --body ${USAGE}\nUsage-limit pauses in the last 24 hours: none.\n`);
    expect(r.stamp).toBe(String(NOW + 86400));
  });

  it('keeps the rhythm across restarts: posts once 24 hours have passed since the last post, not before', () => {
    const r = ticker({ times: [NOW, NOW + 600], stamp: NOW + 600 - 86400 + 1 });
    expect(r.status, r.stderr).toBe(0);
    expect(r.gh).toBe('');
    const due = ticker({ times: [NOW, NOW + 600], stamp: NOW + 600 - 86400 });
    expect(due.gh.match(/^issue comment 7 --body /gm)).toHaveLength(1);
    expect(due.stamp).toBe(String(NOW + 600));
  });

  it('retries a failed post at the next check, keeping the time of the last good one', () => {
    const r = ticker({ times: [NOW, NOW + 600], stamp: NOW - 86400, ghStatus: 1 });
    expect(r.status, r.stderr).toBe(0);
    expect(r.gh.match(/^issue comment 7 --body /gm)).toHaveLength(2);
    expect(r.stamp).toBe(String(NOW - 86400));
  });

  it('exits at once, posting nothing, when the supervisor is gone', () => {
    const gone = spawnSync('true').pid;
    const r = ticker({ times: [NOW + 86400], stamp: NOW - 86400, supervisor: gone });
    expect(r.status, r.stderr).toBe(0);
    expect(r.gh).toBe('');
    expect(r.sleeps).toEqual([]);
  });

  it('runs beside the session loop and is stopped by the exit trap', () => {
    const text = readFileSync(script, 'utf8');
    expect(text).toContain('  usage_ticker "$log" "$SIGNAL_TREE_STATE_DIR/run.log" "$$" &\n  local ticker=$!\n  trap \'kill \'"$ticker"\' 2> /dev/null; ');
    expect(text.indexOf('usage_ticker "$log"')).toBeLessThan(text.indexOf('run_sessions "$session_id"'));
  });
});
