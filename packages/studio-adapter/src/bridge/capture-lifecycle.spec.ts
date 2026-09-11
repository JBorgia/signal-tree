/**
 * CAPTURE-LIFECYCLE-0 — does Studio stop charging writes when it stops?
 *
 * Capture is bridge-driven, but its cost is process-global: `observeWrites`
 * installs a notifier subscription that sees EVERY tree's writes. Detach and
 * destroy are not user actions, so the invariant cannot be satisfied by the
 * panel calling Stop first:
 *
 * ```text
 * capture active -> detach()      -> observer removed, evidence released
 * capture active -> tree.destroy() -> same
 * ```
 *
 * ⚠️ EVERY INVARIANT BELOW IS PAIRED WITH A POSITIVE CONTROL that introduces
 * the prohibited condition and shows the assertion fails. Without one, an
 * invariant that never observed a live observer would pass vacuously — the
 * failure mode that made JOURNAL-LIVE-0's cross-tree falsifier worthless.
 */
import { restoration } from '@signal-tree/kernel';
import { signalTree } from '@signal-tree/kernel';
import { transactions } from '@signal-tree/kernel';
import { external } from '@signal-tree/kernel';
import { afterEach, describe, expect, it } from 'vitest';

import { attachStudio } from '../attach-studio';
import { isCaptureActive, peekCapture, disposeCapture } from '../realization/lease';
import { peekRegistry } from '../registry';
import { handleStudioRequest } from './handle-request';
import { STUDIO_PROTOCOL_VERSION } from './protocol';

const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const send = (command: string, extra: Record<string, unknown> = {}) =>
  handleStudioRequest({
    protocol: STUDIO_PROTOCOL_VERSION,
    id: 'x',
    command,
    ...extra,
  } as never) as { ok: boolean; value?: never; error?: never };

/** A tree that can actually be observed: `causal-runtime` via transactions(). */
function liveTree() {
  return signalTree({ cart: { total: 9800 } }, {
    enhancers: [restoration(), transactions()],
  } as never) as never as {
    $: { cart: { total: (v?: number) => number } };
    registerCleanup(fn: () => void): void;
    destroy(): void;
    destroyed(): boolean;
  };
}

/** Writes that MUST land in capture while it is live, and must not after. */
async function realize(tree: ReturnType<typeof liveTree>, value: number) {
  external(() => tree.$.cart.total(value));
  await settle();
}

const opened: (() => void)[] = [];
afterEach(() => {
  while (opened.length) {
    opened.pop()!();
  }
});

function attachAndCapture() {
  const tree = liveTree();
  const attachment = attachStudio(tree, { label: 'AppTree' });
  opened.push(() => {
    disposeCapture(attachment.id);
    attachment.detach();
  });
  expect(send('startRealizationCapture', { treeId: attachment.id }).ok).toBe(true);
  expect(isCaptureActive(attachment.id)).toBe(true);
  return { tree, attachment };
}

const retained = (id: string) => peekCapture(id)?.snapshot().retention.retained;

describe('CAPTURE-LIFECYCLE-0', () => {
  it('PRECONDITION — capture is genuinely live, so absence later means something', async () => {
    const { tree, attachment } = attachAndCapture();
    await realize(tree, 10200);
    // Without this, every "no longer capturing" assertion below is vacuous.
    expect(retained(attachment.id)).toBe(1);
  });

  describe('detach while capture is active', () => {
    it('disposes the lease, removes the observer and releases evidence', async () => {
      const { tree, attachment } = attachAndCapture();
      await realize(tree, 10200);
      expect(retained(attachment.id)).toBe(1);

      attachment.detach();

      expect(isCaptureActive(attachment.id)).toBe(false);
      expect(peekCapture(attachment.id)).toBeUndefined();

      // The observer is gone: further realized writes are not charged.
      await realize(tree, 11000);
      expect(peekCapture(attachment.id)).toBeUndefined();
    });

    /**
     * POSITIVE CONTROL — introduce the prohibited condition.
     *
     * This is exactly what detach did before the repair: remove the attachment
     * from the registry without disposing the bridge-driven lease. If the
     * assertions above could pass in this state, they would be proving nothing.
     */
    it('POSITIVE CONTROL — delisting without disposing leaves the observer running', async () => {
      const { tree, attachment } = attachAndCapture();
      await realize(tree, 10200);

      // The pre-repair detach, reproduced: registry only.
      peekRegistry()?.remove(attachment.id);

      // Studio no longer presents the tree...
      expect(send('listTrees').value).toEqual([]);
      // ...and is still charging every realized write to it.
      expect(isCaptureActive(attachment.id)).toBe(true);
      await realize(tree, 11000);
      expect(retained(attachment.id)).toBe(2);
    });
  });

  describe('tree.destroy() while capture is active', () => {
    it('reaches the same state through the other route', async () => {
      const { tree, attachment } = attachAndCapture();
      await realize(tree, 10200);
      expect(retained(attachment.id)).toBe(1);

      tree.destroy();
      await settle();

      expect(isCaptureActive(attachment.id)).toBe(false);
      expect(peekCapture(attachment.id)).toBeUndefined();
    });

    it('POSITIVE CONTROL — a destroy that never reaches dispose keeps capturing', async () => {
      const { tree, attachment } = attachAndCapture();
      await realize(tree, 10200);
      // No destroy, no detach — the state a missed cleanup hook would leave.
      expect(isCaptureActive(attachment.id)).toBe(true);
      await realize(tree, 11000);
      expect(retained(attachment.id)).toBe(2);
    });
  });

  describe('the bridge reports capture state from one authority', () => {
    it('readRealizations follows the lease, not a bridge-local copy', async () => {
      const { tree, attachment } = attachAndCapture();
      await realize(tree, 10200);
      expect((send('readRealizations', { treeId: attachment.id }).value as never as { capture: string }).capture).toBe('active');

      // Disposed underneath the bridge, as destroy does.
      disposeCapture(attachment.id);

      const after = send('readRealizations', { treeId: attachment.id });
      expect((after.value as never as { capture: string }).capture).toBe('inactive');
      expect((after.value as never as { support: string }).support).toBe('supported');
    });

    it('stop after an underlying dispose reports not-active rather than throwing', () => {
      const { attachment } = attachAndCapture();
      disposeCapture(attachment.id);
      expect(send('stopRealizationCapture', { treeId: attachment.id }).value).toEqual({
        stopped: false,
        reason: 'not-active',
      });
    });
  });

  describe('refusals name the capability they refused', () => {
    it('an unobservable composition is refused as `realizations`', () => {
      const bare = signalTree({ cart: { total: 1 } }) as never as { destroy(): void };
      const attachment = attachStudio(bare as never, { label: 'BareTree' });
      opened.push(() => attachment.detach());

      const res = send('startRealizationCapture', { treeId: attachment.id });
      expect(res.ok).toBe(false);
      expect(res.error).toEqual({
        code: 'STUDIO_CAPABILITY_UNAVAILABLE',
        // ⚠️ NOT `committed-transactions`. The condition detected is leaf
        // observation; naming the transaction capability would state a true
        // refusal with a false reason.
        capability: 'realizations',
      });
      // And it must not be confusable with "this tree is not attached".
      expect(send('listTrees').value).toHaveLength(1);
    });
  });
});
