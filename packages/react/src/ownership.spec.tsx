import { act, render } from '@testing-library/react';
import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { signalTree, useSignalTree } from './index';

const createStore = (count: number) => signalTree({ count });

function Count({ tree }: { tree: ReturnType<typeof createStore> }) {
  return <output>{useSignalTree(tree, ($) => $.count())}</output>;
}

describe('external tree ownership', () => {
  it('keeps a shared owner live when a StrictMode borrower unmounts', async () => {
    const tree = createStore(1);
    const first = render(
      <StrictMode>
        <Count tree={tree} />
      </StrictMode>
    );
    const second = render(
      <StrictMode>
        <Count tree={tree} />
      </StrictMode>
    );
    try {
      first.unmount();
      expect(tree.destroyed()).toBe(false);
      await act(async () => {
        tree.$.count(2);
        for (let index = 0; index < 4; index++) await Promise.resolve();
      });
      expect(second.container.textContent).toBe('2');
      second.unmount();
      expect(tree.destroyed()).toBe(false);
      tree.destroy();
      expect(tree.destroyed()).toBe(true);
    } finally {
      first.unmount();
      second.unmount();
      tree.destroy();
    }
  });

  it('isolates request owners and releases one without destroying another', () => {
    const first = createStore(1);
    const second = createStore(10);
    try {
      first.$.count(2);
      expect(renderToString(<Count tree={first} />)).toContain('>2</output>');
      expect(renderToString(<Count tree={second} />)).toContain('>10</output>');
      first.destroy();
      expect(first.destroyed()).toBe(true);
      expect(second.destroyed()).toBe(false);
      second.$.count(11);
      expect(renderToString(<Count tree={second} />)).toContain('>11</output>');
    } finally {
      first.destroy();
      second.destroy();
    }
    expect(second.destroyed()).toBe(true);
  });
});
