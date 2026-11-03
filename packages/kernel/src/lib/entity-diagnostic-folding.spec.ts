import { afterEach, expect, it, vi } from 'vitest';
import { signalTree } from './signal-tree';
import { entityMap } from './markers/entity-map';
import { SIGNAL_TREE_MESSAGES } from './constants';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('keeps per-collection diagnostics available when development is enabled after construction', () => {
  vi.stubGlobal('ngDevMode', false);
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const trees = [signalTree({ rows: entityMap<{id: number; n: number}>() }), signalTree({ rows: entityMap<{id: number; n: number}>() })];
  const churn = (tree: typeof trees[number]) => { for (let i = 0; i < 30; i++) tree.$.rows.where(row => row.n > 0); };
  try {
    for (const tree of trees) { tree.$.rows.addOne({id: 1, n: 2}); churn(tree); Reflect.get(tree.$.rows, 'upsert'); }
    expect(warn).not.toHaveBeenCalled();
    vi.stubGlobal('ngDevMode', true);
    for (const tree of trees) { churn(tree); Reflect.get(tree.$.rows, 'upsert'); Reflect.get(tree.$.rows, 'upsert'); }
    expect(warn.mock.calls.filter(call => String(call[0]).includes('[ST2026]'))).toHaveLength(2);
    expect(warn.mock.calls.filter(call => String(call[0]).includes('[ST2002]'))).toHaveLength(2);
    vi.stubGlobal('ngDevMode', false);
    for (const tree of trees) { churn(tree); Reflect.get(tree.$.rows, 'addEntities'); }
    expect(warn).toHaveBeenCalledTimes(4);
    for (const tree of trees) expect(tree.$.rows.all()).toEqual([{id: 1, n: 2}]);
  } finally { trees.forEach(tree => tree.destroy()); }
});

it('preserves numeric, symbol and real accessor reads without diagnostic interference', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const tree = signalTree({ rows: entityMap<{id: number; n: number}, number>() });
  try {
    tree.$.rows.setAll([{id: 0, n: 2}, {id: 1, n: 3}]);
    const rows = tree.$.rows;
    const token = Symbol('custom'); let reads = 0;
    Object.defineProperty(rows, token, {get() { reads++; return 17; }});
    Object.defineProperty(rows, 'upsert', {get() { reads++; return 19; }});
    for (const flag of [false, true]) {
      vi.stubGlobal('ngDevMode', flag);
      expect(Reflect.get(rows, '1e0')).toBe(rows.byIdOrFail(1));
      expect(Reflect.get(rows, ' ')).toBe(rows.byIdOrFail(0));
      expect(Reflect.get(rows, token)).toBe(17);
      expect(Reflect.get(rows, 'upsert')).toBe(19);
      expect(Reflect.get(rows, 'notAnEntityMethod')).toBeUndefined();
    }
    expect(reads).toBe(4); expect(warn).not.toHaveBeenCalled();
  } finally { tree.destroy(); }
});

it('retains exact readable frozen messages', () => {
  expect(SIGNAL_TREE_MESSAGES).toEqual({NULL_OR_UNDEFINED: 'null/undefined [ST1001]', TREE_DESTROYED: 'destroyed [ST1012]', ENHANCER_CYCLE_DETECTED: 'enhancer cycle [ST1024]'});
  expect(Object.isFrozen(SIGNAL_TREE_MESSAGES)).toBe(true);
});
