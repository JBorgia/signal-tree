import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
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
