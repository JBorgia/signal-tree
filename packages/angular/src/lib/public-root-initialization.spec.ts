/**
 * THE PUBLIC ROOT INSTALLS THE REALIZATION — the property, not the module.
 *
 * The historical defect was import-order dependent: entity APIs reached through
 * a path that never evaluated the Angular binding got neutral cells.
 *
 * What this proves is the PACKAGE-ORDER property, stated precisely: the only
 * SignalTree module this file imports is the Angular package root, and its
 * realization is installed before the first SignalTree allocation. It does
 * construct through `signalTree()` — that is the public way to obtain an entity
 * surface — so the claim is not "no signalTree call"; it is that nothing but
 * the root was needed to make that call produce native Angular cells.
 */
import { describe, expect, it } from 'vitest';
import { entityMap, signalTree } from '../index';

describe('@signal-tree/angular public root', () => {
  it('realizes entity APIs with NO prior signalTree() call', () => {
    // first SignalTree allocation in this file, reached through the root alone
    const tree = signalTree({ users: entityMap<{ id: number; name: string }>() });
    const api = tree.$.users;
    api.addOne({ id: 1, name: 'Ada' });

    const row = api.byIdOrFail(1);
    expect(typeof row.name).toBe('function');
    expect(row.name.asReadonly()).toBe(row.name);
    expect(typeof api.empty).toBe('function');
  });

  it('ordinary leaves are universal locations through the root', () => {
    const tree = signalTree({ count: 0 });
    expect(typeof tree.$.count.peek).toBe('function');
    expect(typeof tree.$.count.subscribe).toBe('function');
    tree.$.count(3);
    expect(tree.$.count()).toBe(3);
  });
});
