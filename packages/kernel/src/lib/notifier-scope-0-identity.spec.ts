import { describe, expect, it } from 'vitest';

import {
  getOwnedOwnerId,
  getOwnedOwnerPath,
  getOwnedPositionIds,
} from './internals/owned-metadata';
import { getPathNotifier } from './path-notifier';
import { getPositionRegistry } from './internals/position-registry';
import { restoration } from '../enhancers/restoration/restoration';
import { signalTree } from './signal-tree';

/**
 * NOTIFIER-SCOPE-0 — THE MECHANISM, and the correction to its first diagnosis.
 *
 * ## ⚠️ The original explanation was WRONG
 *
 * A2-4's control arm found the symptom and I recorded the cause as:
 *
 *     "the path notifier coalesces by PATH STRING within a flush, with no tree
 *      qualification"
 *
 * That is not what the code does. `PathNotifier.batchIdentityMode` defaults to
 * `'path-position-subject'`, and `hasSameSemanticIdentity` compares
 * `left.positionId === right.positionId` (and `subjectId`). **The notifier
 * already attempts semantic identity.**
 *
 * The real defect is one level down:
 *
 * ```text
 * TreePositionRegistry allocates from `nextPositionId = 1`, PER REGISTRY.
 * The notifier is PROCESS-GLOBAL.
 *
 *   tree A `theme` -> positionId 2      distinct registries,
 *   tree B `theme` -> positionId 2      identical local ids
 *
 * `2 === 2` -> "same semantic identity" -> coalesced -> one write LOST.
 * ```
 *
 * So `positionId` means "position 2 in THIS tree's registry", and the notifier
 * consumes it as if it meant "position 2 in the process". A registry-local
 * identifier is being used across a namespace boundary it does not span.
 *
 * That distinction decides the fix. Making position ids globally allocated
 * would repair the consumer by changing what the identifier MEANS; qualifying
 * the tuple with its registry/owner namespace repairs the consumer instead.
 * This file pins the INVARIANT and stays deliberately silent on which.
 *
 * ## Why this is the same missing fact A2-3 hit
 *
 * `resolveScopeKey` could not resolve a commit scope from a leaf, and A2-3 read
 * that as "a leaf has no owner identity, so persistence must be handed the
 * tree". Measured below: a leaf DOES carry `positionIds` and `ownerPath`. What
 * it lacks is the registry those ids index into — `definePositionRegistry` is
 * called on `tree` and `tree.$` only. Both findings are the same sentence:
 *
 *     a SignalTree location must be unambiguously owned by ONE tree, and that
 *     ownership must be resolvable FROM THE LOCATION.
 */

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('NOTIFIER-SCOPE-0 mechanism: what identity does a location carry?', () => {
  it('a leaf names its own owner — position ids, owner path, AND registry', async () => {
    const a = signalTree({ theme: 'a0' }, { enhancers: [restoration()] });
    await flush();
    const leaf = (a.$ as unknown as Record<string, unknown>)['theme'];

    expect(getOwnedPositionIds(leaf)).toEqual([2]);
    expect(getOwnedOwnerPath(leaf)).toBe('theme');

    // ⚠️ FIXED. This measured `undefined` before the ownership correction, and
    // that absence was the whole of A2-3's failure: `resolveScopeKey` asks
    // `getPositionRegistry(node)` and simply never got an answer from a leaf.
    // A leaf now resolves the SAME registry object the tree does, so a location
    // can name its owner without being handed the tree.
    expect(getPositionRegistry(leaf)).toBeDefined();
    expect(getPositionRegistry(leaf)).toBe(getPositionRegistry(a.$));

    // And the namespace is comparable as a value, which is what the notifier
    // needs — it has no node to ask.
    expect(getOwnedOwnerId(leaf)).toBe(getPositionRegistry(a.$)?.id);
  });

  it('⚠️ two independent trees allocate the SAME local position id', async () => {
    const a = signalTree({ theme: 'a0' }, { enhancers: [restoration()] });
    const b = signalTree({ theme: 'b0' }, { enhancers: [restoration()] });
    await flush();

    const leafA = (a.$ as unknown as Record<string, unknown>)['theme'];
    const leafB = (b.$ as unknown as Record<string, unknown>)['theme'];
    const posA = getOwnedPositionIds(leafA);
    const posB = getOwnedPositionIds(leafB);

    // The registries are genuinely different objects — the trees are isolated
    // in every way except the number they hand out.
    expect(getPositionRegistry(a.$)).not.toBe(getPositionRegistry(b.$));
    expect(posA).toEqual(posB);

    // The local numbers still collide — deliberately. The fix NAMES the
    // namespace rather than making position ids globally unique, so
    // `positionId` keeps meaning "position N in this tree".
    expect(getOwnedOwnerId(leafA)).not.toBe(getOwnedOwnerId(leafB));
  });
});

/**
 * THE INVARIANT, pinned before either fix is chosen.
 *
 * ```text
 * two trees / same path / same local positionId / same tick
 *   => two DISTINCT pending mutations
 *   => BOTH delivered
 *   => restoration remains tree-local          (notifier-scope-0-impact.spec)
 *   => transaction compensation remains tree-local  (notifier-scope-0-impact.spec)
 * ```
 */
describe('NOTIFIER-SCOPE-0 invariant: both trees must be delivered', () => {
  it('CONTROL — two trees with DIFFERENT paths both deliver', async () => {
    const a = signalTree({ alpha: 'a0' }, { enhancers: [restoration()] });
    const b = signalTree({ beta: 'b0' }, { enhancers: [restoration()] });
    await flush();

    const seen: string[] = [];
    const off = getPathNotifier().subscribe('**', (next, _p, path) => {
      seen.push(`${path}=${String(next)}`);
    });
    a.$.alpha('a1');
    b.$.beta('b1');
    await flush();
    off();

    // Without this arm, a zero-delivery bug would satisfy the failing test
    // below for the wrong reason.
    expect(seen.sort()).toEqual(['alpha=a1', 'beta=b1']);
  });

  /**
   * ⚠️ WAS KNOWN RED. Measured before the ownership correction:
   * `["theme=b1"]` — tree A's write silently dropped, because both trees call
   * their first leaf position 2 and the notifier compared the number without
   * its namespace.
   */
  it('⚠️ two trees, SAME path, same tick — both must deliver', async () => {
    const a = signalTree({ theme: 'a0' }, { enhancers: [restoration()] });
    const b = signalTree({ theme: 'b0' }, { enhancers: [restoration()] });
    await flush();

    const seen: string[] = [];
    const off = getPathNotifier().subscribe('**', (next, _p, path) => {
      seen.push(`${path}=${String(next)}`);
    });
    a.$.theme('a1');
    b.$.theme('b1');
    await flush();
    off();

    expect(seen.sort()).toEqual(['theme=a1', 'theme=b1']);
  });
});
