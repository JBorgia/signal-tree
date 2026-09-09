import { afterEach, describe, expect, it } from 'vitest';

import {
  attachStudioProbe,
  peekRegistry,
  StudioRequirementError,
  type ConfirmedTurnReader,
  type StudioTreeProbe,
} from './index';

const reader = (turns: readonly { id: number }[] = []): ConfirmedTurnReader => ({
  treeId: {},
  readConfirmedTurns: () => ({
    retention: { truncated: false, firstAvailableTurnId: turns[0]?.id },
    turns: turns.map((t) => ({ id: t.id, positions: [1], effects: [] })),
  }),
});

const probe = (
  over: Partial<StudioTreeProbe> = {}
): StudioTreeProbe => ({
  runtimeTreeId: {},
  confirmedTurnReader: reader([{ id: 1 }]),
  ...over,
});

/**
 * Session ids are allocated from a module-global counter that deliberately
 * survives registry drops (see registry.ts), so absolute ids are order
 * dependent. Tests assert RELATIVE identity, and cleanup runs even when an
 * assertion fails — otherwise one failure leaks attachments into every test
 * after it, which is exactly what happened when this suite was first written.
 */
const opened: { detach: () => void }[] = [];
const open = (...args: Parameters<typeof attachStudioProbe>) => {
  const attachment = attachStudioProbe(...args);
  opened.push(attachment);
  return attachment;
};

afterEach(() => {
  while (opened.length > 0) {
    opened.pop()?.detach();
  }
});

describe('attachStudio', () => {
  /** S1-BRIDGE-SPEC §1 — frozen decision. */
  it('attaches a tree WITHOUT transactions() instead of throwing', () => {
    const attachment = open(probe({ confirmedTurnReader: undefined }), {
      label: 'AppTree',
    });

    expect(attachment.capabilities).toEqual([]);
    expect(peekRegistry()?.listTrees()).toEqual([
      { id: attachment.id, label: 'AppTree', capabilities: [] },
    ]);
  });

  it('refuses the read structurally rather than returning an empty history', () => {
    const attachment = open(probe({ confirmedTurnReader: undefined }));
    const result = peekRegistry()?.readConfirmedTurns(attachment.id);

    expect(result?.ok).toBe(false);
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'STUDIO_CAPABILITY_UNAVAILABLE',
        capability: 'committed-transactions',
      },
    });
  });

  it('advertises capability per TREE, not globally', () => {
    const a = open(probe({ confirmedTurnReader: undefined }), { label: 'A' });
    const b = open(probe(), { label: 'B' });

    expect(peekRegistry()?.listTrees()).toEqual([
      { id: a.id, label: 'A', capabilities: [] },
      { id: b.id, label: 'B', capabilities: ['committed-transactions'] },
    ]);
    expect(a.id).not.toBe(b.id);
  });

  it('throws only when the caller declared require, and registers nothing', () => {
    expect(() =>
      attachStudioProbe(probe({ confirmedTurnReader: undefined }), {
        require: ['committed-transactions'],
      })
    ).toThrow(StudioRequirementError);

    // A failed require must leave no Studio state behind.
    expect(peekRegistry()).toBeUndefined();
  });

  it('reads turns through the registry when the capability is present', () => {
    const attachment = open(probe(), { label: 'AppTree' });
    const result = peekRegistry()?.readConfirmedTurns(attachment.id);

    expect(result?.ok).toBe(true);
    if (result?.ok) {
      expect(result.value.treeId).toBe(attachment.id);
      expect(result.value.turns).toHaveLength(1);
      expect(result.value.retention.truncated).toBe(false);
    }
  });

  it('distinguishes an unknown tree from an incapable one', () => {
    open(probe());
    expect(peekRegistry()?.readConfirmedTurns('tree-does-not-exist')).toEqual({
      ok: false,
      error: { code: 'STUDIO_TREE_NOT_FOUND' },
    });
  });
});

describe('registry lifecycle', () => {
  /** Importing the package must create nothing — the production boundary. */
  it('does not exist until the first attachment', () => {
    expect(peekRegistry()).toBeUndefined();
  });

  it('is created on first attach and dropped with the last detach', () => {
    const a = attachStudioProbe(probe());
    expect(peekRegistry()).toBeDefined();

    const b = attachStudioProbe(probe());
    expect(peekRegistry()?.size()).toBe(2);

    a.detach();
    expect(peekRegistry()?.size()).toBe(1);

    b.detach();
    // "nothing attached" and "never attached" are the same observable state.
    expect(peekRegistry()).toBeUndefined();
  });

  it('detach is idempotent', () => {
    const a = attachStudioProbe(probe());
    a.detach();
    a.detach();
    expect(peekRegistry()).toBeUndefined();
  });

  it('evicts automatically when the tree is destroyed', () => {
    let evict: (() => void) | undefined;
    attachStudioProbe(probe({ onDestroy: (fn) => (evict = fn) }), { label: 'Doomed' });

    expect(peekRegistry()?.listTrees()).toHaveLength(1);
    evict?.();

    // Unlisted, not lingering as an entry whose reader throws.
    expect(peekRegistry()).toBeUndefined();
  });

  it('surfaces STUDIO_TREE_DESTROYED if a reader throws while still attached', () => {
    const attachment = open(
      probe({
        confirmedTurnReader: {
          treeId: {},
          readConfirmedTurns: () => {
            throw Object.assign(new Error('gone'), { code: 'STUDIO_TREE_DESTROYED' });
          },
        },
      })
    );

    expect(peekRegistry()?.readConfirmedTurns(attachment.id)).toEqual({
      ok: false,
      error: { code: 'STUDIO_TREE_DESTROYED' },
    });
  });

  /**
   * The registry is dropped when the last attachment leaves, but ids must NOT
   * restart — a panel still holding a retired id would otherwise silently read
   * a different tree's history.
   */
  it('never recycles a session id, even across a registry drop', () => {
    const a = attachStudioProbe(probe());
    const firstId = a.id;
    a.detach();
    expect(peekRegistry()).toBeUndefined();

    const b = attachStudioProbe(probe());
    expect(b.id).not.toBe(firstId);
    b.detach();
  });
});
