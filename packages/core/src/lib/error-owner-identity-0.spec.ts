import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { entityMap } from './types';
import { getOwnedOwnerPath } from './internals/owned-metadata';
import { getPositionRegistry } from './internals/position-registry';
import { restoration } from '../enhancers/restoration/restoration';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';

/**
 * ERROR-OWNER-IDENTITY-0 — can the EXISTING ownership namespace supply the
 * opaque attribution token the public error event needs?
 *
 * ```text
 * NULL       the PositionRegistry identity already used to isolate
 *            notifications is unique across live trees, stable for a tree's
 *            lifetime, available at EVERY live error producer, not a
 *            PositionId, not path-derived, and suitable as an OPAQUE
 *            diagnostic token
 * FALSIFIER  at least one live producer cannot obtain it without traversal,
 *            global lookup, or inventing another registry
 * ```
 *
 * ## RESULT — ⚠️ FALSIFIED, by exactly ONE producer, and it is RETIRING
 *
 * ```text
 * producer       tree identity              path                    status
 * link           registry.id            ✓   getOwnedOwnerPath(x) ✓  KEEPS
 * stored         ownerRegistry.id       ✓   `key`                ✓  RETIRING
 * async-source   NONE                   ✗   NONE                 ✗  RETIRING
 * ```
 *
 * `createAsyncSourceSignal(marker)` takes **only the marker**. It receives no
 * materialization context, no path and no registry, so it cannot attribute an
 * error without new plumbing — which is precisely the "inventing another
 * registry / traversal" clause the falsifier names.
 *
 * ## ⚠️ THE PROPERTY THAT MATTERS IS ALREADY TRUE FOR THE SURVIVOR
 *
 * Everything the token must be, `registry.id` already is, and it is measured
 * below rather than assumed:
 *
 * ```text
 * unique across simultaneously live trees   ✓  even same-shaped ones
 * stable for one tree's lifetime            ✓  across writes and rekeys
 * NOT a PositionId                          ✓  two trees share position ids
 * NOT derived from path                     ✓  same path, different trees
 * ```
 *
 * ⚠️ The third line is the whole reason this is not solved with a PositionId:
 * two same-shaped trees deliberately give their positions the SAME local ids.
 * That collision is a designed falsifier elsewhere (NOTIFIER-OWNERSHIP), and it
 * is exactly what makes PositionId unusable as public attribution.
 *
 * ## Disposition — do NOT weaken the event for a retiring API
 *
 * The tempting move is `treeId?: TreeId`, so `async-source` can omit it. That
 * would freeze an optional-attribution wart into v15 permanently in order to
 * accommodate an API v15 is deleting — the same "migration debt becoming API"
 * failure ERROR-SURFACE-1 rejected for the `source` union.
 *
 * ```text
 * OPTION 1   plumb context into createAsyncSourceSignal, then export with
 *            treeId REQUIRED
 * OPTION 2   export the reporter AFTER async-source is removed, with treeId
 *            REQUIRED from the start
 * ```
 *
 * Both keep `treeId` required. ⚠️ Recorded, NOT implemented — which one to take
 * depends on migration sequencing, and that is a decision rather than a
 * measurement.
 *
 * ## The identity model this preserves
 *
 * ```text
 * TreeId      identifies the owning LIVE TREE / namespace   (opaque, runtime-local)
 * PositionId  identifies a causal position INSIDE that tree
 * SubjectId   identifies an entity lifetime inside collection ownership
 * path        human / diagnostic location, never identity
 * ```
 *
 * ⚠️ `TreeId` must be documented as CORRELATION ONLY — "event A came from tree
 * X, event B from tree Y". Not persistence, not state addressing, not
 * restoration, not cross-process identity.
 */

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

type Row = { id: string; n: number };

const makeTree = () =>
  signalTree(
    {
      settings: { theme: 'light' },
      rows: entityMap<Row, string>({ selectId: (r: Row) => r.id }),
    },
    { enhancers: [restoration(), transactions()] }
  );

describe('ERROR-OWNER-IDENTITY-0: the candidate token', () => {
  it('⚠️ two SAME-SHAPED trees have distinct registry identity', async () => {
    const a = makeTree();
    const b = makeTree();
    await flush();

    const idA = getPositionRegistry(a.$)?.id;
    const idB = getPositionRegistry(b.$)?.id;

    expect(idA).toBeDefined();
    expect(idB).toBeDefined();
    expect(idA).not.toBe(idB);
  });

  it('⚠️ and their POSITION ids collide — which is why PositionId cannot serve', async () => {
    const a = makeTree();
    const b = makeTree();
    await flush();

    // The designed collision. Identity is (registry, position), never position
    // alone — so a diagnostic channel keyed on PositionId would merge two
    // independent applications' trees.
    const { getOwnedPositionIds } = await import('./internals/owned-metadata');
    expect(getOwnedPositionIds(a.$.rows)).toEqual(getOwnedPositionIds(b.$.rows));
    expect(getPositionRegistry(a.$)?.id).not.toBe(getPositionRegistry(b.$)?.id);
  });

  it('is stable across writes, structural change and rekey', async () => {
    const tree = makeTree();
    await flush();
    const before = getPositionRegistry(tree.$)?.id;

    tree.$.settings.theme.set('dark');
    tree.$.rows.addOne({ id: 'r1', n: 1 });
    await flush();
    tree.$.rows.changeId('r1', 'r9');
    await flush();

    expect(getPositionRegistry(tree.$)?.id).toBe(before);
  });

  it('is not derived from path — same path, different trees', async () => {
    const a = makeTree();
    const b = makeTree();
    await flush();

    // Identical location strings, distinct owners.
    expect(getOwnedOwnerPath(a.$.settings.theme)).toBe(
      getOwnedOwnerPath(b.$.settings.theme)
    );
    expect(getPositionRegistry(a.$)?.id).not.toBe(getPositionRegistry(b.$)?.id);
  });
});

const SRC = (() => {
  for (const c of [join(process.cwd(), 'packages/core/src'), join(process.cwd(), 'src')]) {
    try {
      readFileSync(join(c, 'lib/signal-tree.ts'), 'utf8');
      return c;
    } catch {
      /* next */
    }
  }
  throw new Error('ERROR-OWNER-IDENTITY-0: could not locate packages/core/src');
})();

describe('ERROR-OWNER-IDENTITY-0: producer reachability', () => {
  it('link can obtain BOTH identity and path with no new plumbing', () => {
    const src = readFileSync(join(SRC, 'lib/link.ts'), 'utf8');
    expect(src).toContain('const registry = getPositionRegistry(x);');
    expect(src).toContain('const ownerPath = getOwnedOwnerPath(x)');
  });

  it('stored can too — the registry is in scope at its report site', () => {
    const src = readFileSync(join(SRC, 'lib/markers/stored.ts'), 'utf8');
    expect(src).toContain('const ownerRegistry = context?.positionRegistry;');
    // And it already supplies a path.
    expect(src).toContain('path: key,');
  });

  it('⚠️ async-source CANNOT — its processor receives only the marker', () => {
    const src = readFileSync(join(SRC, 'lib/markers/async-source.ts'), 'utf8');

    // The whole falsifier, in one signature.
    expect(src).toContain('export function createAsyncSourceSignal<T>(\n  marker: AsyncSourceMarker<T>\n): AsyncSourceSignal<T> {');

    // No registry, no ownership, anywhere in the file.
    expect(src).not.toContain('positionRegistry');
    expect(src).not.toContain('getPositionRegistry');

    // And its report carries no path either.
    expect(src).toContain("operation: 'load',");
  });
});
