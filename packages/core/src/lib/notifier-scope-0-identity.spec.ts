import { describe, expect, it } from 'vitest';

import { getOwnedOwnerPath, getOwnedPositionIds } from './internals/owned-metadata';
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
  it('a leaf carries position ids and an owner path — but NOT its registry', async () => {
    const a = signalTree({ theme: 'a0' }, { enhancers: [restoration()] });
    await flush();
    const leaf = (a.$ as Record<string, unknown>)['theme'];

    // The half that exists.
    expect(getOwnedPositionIds(leaf)).toEqual([2]);
    expect(getOwnedOwnerPath(leaf)).toBe('theme');

    // The half that does not, and the whole of A2-3's failure.
    expect(getPositionRegistry(leaf)).toBeUndefined();
    expect(getPositionRegistry(a.$)).toBeDefined();
  });

  it('⚠️ two independent trees allocate the SAME local position id', async () => {
    const a = signalTree({ theme: 'a0' }, { enhancers: [restoration()] });
    const b = signalTree({ theme: 'b0' }, { enhancers: [restoration()] });
    await flush();

    const posA = getOwnedPositionIds((a.$ as Record<string, unknown>)['theme']);
    const posB = getOwnedPositionIds((b.$ as Record<string, unknown>)['theme']);

    // The registries are genuinely different objects — the trees are isolated
    // in every way except the number they hand out.
    expect(getPositionRegistry(a.$)).not.toBe(getPositionRegistry(b.$));
    expect(posA).toEqual(posB);
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
    a.$.alpha.set('a1');
    b.$.beta.set('b1');
    await flush();
    off();

    // Without this arm, a zero-delivery bug would satisfy the failing test
    // below for the wrong reason.
    expect(seen.sort()).toEqual(['alpha=a1', 'beta=b1']);
  });

  /**
   * ⚠️ KNOWN RED — `it.fails` because this SHOULD pass and does not. Measured
   * delivery is `["theme=b1 pos=[2]"]`: tree A's write is silently dropped,
   * because both trees call their first leaf position 2.
   *
   * Fixing NOTIFIER-SCOPE-0 must flip this to a plain `it`. Do not delete it.
   */
  it.fails('⚠️ two trees, SAME path, same tick — both must deliver', async () => {
    const a = signalTree({ theme: 'a0' }, { enhancers: [restoration()] });
    const b = signalTree({ theme: 'b0' }, { enhancers: [restoration()] });
    await flush();

    const seen: string[] = [];
    const off = getPathNotifier().subscribe('**', (next, _p, path) => {
      seen.push(`${path}=${String(next)}`);
    });
    a.$.theme.set('a1');
    b.$.theme.set('b1');
    await flush();
    off();

    expect(seen.sort()).toEqual(['theme=a1', 'theme=b1']);
  });
});
