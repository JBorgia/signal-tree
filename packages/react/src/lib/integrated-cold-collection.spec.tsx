import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { entityMap, signalTree, useSignalTree } from '../index';

type Row = { id: string; v: number };
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

it('INTEGRATED-COLD-0: mounts a React collection selector after cold writes and observes later value and membership writes', async () => {
  const tree = signalTree({ rows: entityMap<Row, string>() });
  const rows = tree.$.rows;
  rows.setAll([{ id: 'a', v: 0 }]);
  rows.updateOne('a', { v: 1 });
  rows.updateOne('a', { v: 2 });
  const mounted = renderHook(() => useSignalTree(tree, $ =>
    `${$.rows.all().map(row => row.v).join(',')}|${$.rows.count()}`));
  try {
    expect(mounted.result.current).toBe('2|1');
    await act(async () => { rows.updateOne('a', { v: 3 }); await settle(); });
    expect(mounted.result.current).toBe('3|1');
    await act(async () => { rows.addOne({ id: 'b', v: 4 }); await settle(); });
    expect(mounted.result.current).toBe('3,4|2');
  } finally {
    mounted.unmount();
    tree.destroy();
  }
});

it('INTEGRATED-COLD-0: first React collection selection can begin in the same act batch as an earlier cold write', async () => {
  const tree = signalTree({ rows: entityMap<Row, string>() });
  const rows = tree.$.rows;
  rows.setAll([{ id: 'a', v: 0 }]);
  const mounted = renderHook(({ enabled }: { enabled: boolean }) =>
    useSignalTree(tree, $ => enabled
      ? `${$.rows.all().map(row => row.v).join(',')}|${$.rows.count()}`
      : 'idle'), { initialProps: { enabled: false } });
  try {
    expect(mounted.result.current).toBe('idle');
    await act(async () => {
      rows.updateOne('a', { v: 1 });
      mounted.rerender({ enabled: true });
      await settle();
    });
    expect(mounted.result.current).toBe('1|1');
    await act(async () => { rows.updateOne('a', { v: 2 }); await settle(); });
    expect(mounted.result.current).toBe('2|1');
    mounted.rerender({ enabled: false });
    expect(mounted.result.current).toBe('idle');
    await act(async () => { rows.updateOne('a', { v: 3 }); await settle(); });
    mounted.rerender({ enabled: true });
    expect(mounted.result.current).toBe('3|1');
  } finally {
    mounted.unmount();
    tree.destroy();
  }
});
