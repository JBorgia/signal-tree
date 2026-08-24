import { describe, expect, it } from 'vitest';
import { undoable } from '../../lib/undoable';

import { timeTravel } from './restoration';
import { signalTree } from '../../lib/signal-tree';

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('time-travel behavior', () => {
  it('records history and supports undo/redo', async () => {
    const enhanced = signalTree(
      { count: 0, text: '' },
      { enhancers: [timeTravel()] }
    );

    undoable(() => enhanced.$.count.set(1));
    await flush();
    undoable(() => enhanced.$.text.set('hello'));
    await flush();

    expect(enhanced.canUndo()).toBe(true);
    const beforeIndex = enhanced.getCurrentIndex();
    enhanced.undo();
    const afterFirstUndo = enhanced.getCurrentIndex();
    expect(afterFirstUndo).toBeLessThanOrEqual(beforeIndex);
    expect(enhanced.$.text()).toBe('');
    expect(enhanced.$.count()).toBe(1);

    enhanced.undo();
    const afterSecondUndo = enhanced.getCurrentIndex();
    expect(afterSecondUndo).toBeLessThanOrEqual(afterFirstUndo);
    expect(enhanced.$.count()).toBe(0);

    // ensure history is present and jump back to latest entry
    const history = enhanced.getRestorationHistory();
    expect(history.length).toBeGreaterThanOrEqual(3);
    enhanced.jumpTo(history.length - 1);
    expect(enhanced.getCurrentIndex()).toBe(history.length - 1);
    expect(enhanced.$.count()).toBe(1);
    expect(enhanced.$.text()).toBe('hello');
  });
});
