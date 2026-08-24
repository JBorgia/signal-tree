import { describe, expect, it } from 'vitest';
import { undoable } from '../../lib/undoable';

import { signalTree } from '../../lib/signal-tree';
import { getPathNotifier, resetPathNotifier } from '../../lib/path-notifier';
import type { WriteMetadata } from '../../lib/types';
import { restoration } from './restoration';

/**
 * PR1: restoration replay writes are tagged with the ambient write-context
 * `{ intent: 'system', origin: 'restoration' }`. Enhancers (validation,
 * guardrails) consume this via `getActiveWriteContext()` to suppress side
 * effects for replays.
 */
describe('restoration — replay writes carry source: restoration (PR1)', () => {
  it('writes performed during undo() carry source=restoration meta', async () => {
    resetPathNotifier();

    const store = signalTree({ count: 0 }, { enhancers: [restoration()] });

    // Drive the tree forward so we have history to undo into.
    undoable(() => (store as any).$.count.set(1));
    await Promise.resolve();
    undoable(() => (store as any).$.count.set(2));
    await Promise.resolve();

    const captured: Array<{ path: string; meta?: WriteMetadata }> = [];
    const unsubscribe = getPathNotifier().subscribe(
      'count',
      (
        _next,
        _prev,
        path,
        _ownerPath,
        source,
        _subjectIds,
        _positionIds,
        meta
      ) => {
        if (source !== 'restoration') {
          return;
        }
        captured.push({ path, meta });
      }
    );

    // Undo: synchronously triggers restoreState, which wraps writes in
    // withWriteContext({ intent: 'system', origin: 'restoration' }).
    const t = (store as any).__restoration;
    expect(t.canUndo()).toBe(true);
    t.undo();
    await Promise.resolve();

    unsubscribe();

    // At least one leaf write must have fired during undo. Every replay
    // write carries the restoration context (no plain user writes happen
    // inside undo()).
    expect(captured.length).toBeGreaterThanOrEqual(1);
    for (const c of captured) {
      expect(c.meta).toBeDefined();
      expect(c.meta?.origin).toBe('restoration');
      expect(c.meta?.intent).toBe('system');
    }
  });

  it('writes performed during jumpTo() carry source=restoration meta', async () => {
    resetPathNotifier();

    const store = signalTree(
      { count: 0, label: 'a' },
      { enhancers: [restoration()] }
    );

    undoable(() => (store as any).$.count.set(1));
    await Promise.resolve();
    undoable(() => (store as any).$.label.set('b'));
    await Promise.resolve();
    undoable(() => (store as any).$.count.set(2));
    await Promise.resolve();

    const captured: Array<{ path: string; meta?: WriteMetadata }> = [];
    const unsubscribe = getPathNotifier().subscribe(
      '**',
      (
        _next,
        _prev,
        path,
        _ownerPath,
        source,
        _subjectIds,
        _positionIds,
        meta
      ) => {
        if (source !== 'restoration') {
          return;
        }
        captured.push({ path, meta });
      }
    );

    const t = (store as any).__restoration;
    t.jumpTo(0); // jump to initial state
    await Promise.resolve();

    unsubscribe();

    expect(captured.length).toBeGreaterThanOrEqual(1);
    for (const c of captured) {
      expect(c.meta?.origin).toBe('restoration');
      expect(c.meta?.intent).toBe('system');
    }
  });

  it('regular user writes carry canonical mutation metadata without a restoration source', async () => {
    resetPathNotifier();

    const store = signalTree({ count: 0 }, { enhancers: [restoration()] });

    const captured: Array<{ path: string; meta?: WriteMetadata }> = [];
    const unsubscribe = getPathNotifier().subscribe(
      'count',
      (
        _next,
        _prev,
        path,
        _ownerPath,
        source,
        _subjectIds,
        _positionIds,
        meta
      ) => {
        captured.push({ path, meta: source === undefined ? meta : undefined });
      }
    );

    undoable(() => (store as any).$.count.set(5));
    await Promise.resolve();

    unsubscribe();

    expect(captured.length).toBeGreaterThanOrEqual(1);
    expect(captured[0].path).toBe('count');
    expect(captured[0].meta?.origin).toBeUndefined();
    expect(captured[0].meta?.intent).toBeUndefined();
    expect(captured[0].meta?.mutationIntent).toBe('replace');
  });
});
