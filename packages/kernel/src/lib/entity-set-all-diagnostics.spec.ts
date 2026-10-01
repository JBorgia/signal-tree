import { afterEach, describe, expect, it, vi } from 'vitest';
import { entityMap } from './types';
import { signalTree } from './signal-tree';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('setAll duplicate identity diagnostics', () => {
  it('warns once for repeated incoming keys and preserves last-value-wins behavior', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const selectId = vi.fn((row: { key: string; value: number }) => row.key);
    const tree = signalTree({ rows: entityMap({ selectId }) });
    try {
      tree.$.rows.setAll([{ key: '', value: 1 }, { key: '', value: 2 }, { key: '', value: 3 }]);
      expect(tree.$.rows.all()).toEqual([{ key: '', value: 3 }]);
      expect(selectId).toHaveBeenCalledTimes(3);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('[ST2001]');
      expect(warn.mock.calls[0][0]).toContain('duplicate');
      tree.$.rows.setAll([{ key: '', value: 4 }, { key: '', value: 5 }]);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(tree.$.rows.all()).toEqual([{ key: '', value: 5 }]);
    } finally { tree.destroy(); }
  });

  it('does not confuse an existing key with a duplicate within the incoming payload', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const tree = signalTree({ rows: entityMap<{ id: string; value: number }>() });
    try {
      tree.$.rows.addOne({ id: 'a', value: 1 });
      tree.$.rows.setAll([{ id: 'a', value: 2 }, { id: 'b', value: 3 }]);
      expect(tree.$.rows.all()).toEqual([{ id: 'a', value: 2 }, { id: 'b', value: 3 }]);
      expect(warn).not.toHaveBeenCalled();
    } finally { tree.destroy(); }
  });

  it('keeps numeric and string keys distinct', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const tree = signalTree({ rows: entityMap<{ id: string | number; value: number }, string | number>() });
    try {
      tree.$.rows.setAll([{ id: 1, value: 2 }, { id: '1', value: 3 }]);
      expect(tree.$.rows.ids()).toEqual([1, '1']);
      expect(tree.$.rows.byId(1)?.value()).toBe(2);
      expect(tree.$.rows.byId('1')?.value()).toBe(3);
      expect(warn).not.toHaveBeenCalled();
    } finally { tree.destroy(); }
  });

  it('keeps production behavior and emits no development warning', () => {
    vi.stubGlobal('ngDevMode', false);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const tree = signalTree({ rows: entityMap<{ id: string; value: number }>() });
    try {
      tree.$.rows.setAll([{ id: 'a', value: 1 }, { id: 'a', value: 2 }]);
      expect(tree.$.rows.all()).toEqual([{ id: 'a', value: 2 }]);
      expect(warn).not.toHaveBeenCalled();
    } finally { tree.destroy(); }
  });
});
