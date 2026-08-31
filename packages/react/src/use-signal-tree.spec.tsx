import { act, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { signalTree } from '@signal-tree/kernel';
import { useSignalTree } from './use-signal-tree';

const settleKernel = async (): Promise<void> => {
  for (let index = 0; index < 4; index++) await Promise.resolve();
};

describe('useSignalTree', () => {
  it('observes a selected canonical location without materializing the root', async () => {
    const tree = signalTree({ count: 1, unrelated: 0 });
    let selectedReads = 0;
    let renders = 0;

    function SelectedCount() {
      renders++;
      const count = useSignalTree(tree, ($) => {
        selectedReads++;
        return $.count();
      });
      return <output>{count}</output>;
    }

    render(<SelectedCount />);
    const initialRenders = renders;
    const initialReads = selectedReads;

    await act(async () => {
      tree.$.unrelated.set(1);
      await settleKernel();
    });

    expect(selectedReads).toBeGreaterThan(initialReads);
    expect(renders).toBe(initialRenders);

    await act(async () => {
      tree.$.count.set(2);
      await settleKernel();
    });

    expect(screen.getByText('2')).toBeTruthy();
    expect(renders).toBeGreaterThan(initialRenders);
    tree.destroy();
  });

  it('expresses whole-root observation through the root projection', async () => {
    const tree = signalTree({ count: 1 });

    function WholeRoot() {
      const snapshot = useSignalTree(tree, ($) => $());
      return <output>{snapshot.count}</output>;
    }

    render(<WholeRoot />);
    await act(async () => {
      tree.$.count.set(2);
      await settleKernel();
    });

    expect(screen.getByText('2')).toBeTruthy();
    tree.destroy();
  });

  it('switches owner and selector without retaining the previous observation', async () => {
    const first = signalTree({ count: 1, label: 'first' });
    const second = signalTree({ count: 2, label: 'second' });

    function Selection({
      owner,
      field,
    }: {
      owner: typeof first;
      field: 'count' | 'label';
    }) {
      const selected = useSignalTree(owner, ($) =>
        field === 'count' ? $.count() : $.label()
      );
      return <output>{selected}</output>;
    }

    const rendered = render(<Selection owner={first} field="count" />);
    expect(screen.getByText('1')).toBeTruthy();

    rendered.rerender(<Selection owner={second} field="label" />);
    expect(screen.getByText('second')).toBeTruthy();

    await act(async () => {
      first.$.count.set(3);
      second.$.label.set('updated');
      await settleKernel();
    });

    expect(screen.getByText('updated')).toBeTruthy();
    expect(screen.queryByText('3')).toBeNull();
    first.destroy();
    second.destroy();
  });

  it('uses the latest selector when props change without an owner mutation', () => {
    const tree = signalTree({ count: 1, label: 'one' });

    function Selection({ field }: { field: 'count' | 'label' }) {
      const selected = useSignalTree(tree, ($) =>
        field === 'count' ? $.count() : $.label()
      );
      return <output>{selected}</output>;
    }

    const rendered = render(<Selection field="count" />);
    expect(screen.getByText('1')).toBeTruthy();

    rendered.rerender(<Selection field="label" />);
    expect(screen.getByText('one')).toBeTruthy();
    tree.destroy();
  });

  it('cleans up StrictMode registrations at unmount', async () => {
    const tree = signalTree({ count: 1 });
    let reads = 0;

    function Count() {
      const count = useSignalTree(tree, ($) => {
        reads++;
        return $.count();
      });
      return <output>{count}</output>;
    }

    const rendered = render(
      <StrictMode>
        <Count />
      </StrictMode>
    );
    rendered.unmount();
    const readsAfterUnmount = reads;

    await act(async () => {
      tree.$.count.set(2);
      await settleKernel();
    });

    expect(reads).toBe(readsAfterUnmount);
    tree.destroy();
  });

  it('surfaces React snapshot instability for an allocating selector', () => {
    const tree = signalTree({ count: 1 });
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    function AllocatingSelection() {
      const selected = useSignalTree(tree, ($) => ({ count: $.count() }));
      return <output>{selected.count}</output>;
    }

    try {
      expect(() => render(<AllocatingSelection />)).toThrow();
    } finally {
      error.mockRestore();
      tree.destroy();
    }
  });
});
