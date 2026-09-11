import {
  entityMap,
  external,
  signalTree,
  transactions,
} from '@signal-tree/kernel';
import { observeWrites } from '@signal-tree/kernel/internals';
import { describe, expect, it } from 'vitest';
import {
  createRealizationCapture,
  liveCaptureTarget,
  startRealizationCapture,
} from '../index';

describe('source-owned realization metadata', () => {
  it('copies source identities and never manufactures a transaction correlation', () => {
    const capture = createRealizationCapture({ treeId: 'tree', ownerId: 1 });
    const subjects = [2],
      positions = [4];
    capture.accept({
      path: 'rows.a',
      ownerPath: 'rows',
      before: 0,
      after: 1,
      origin: 'external',
      participation: 'realized',
      ownerId: 1,
      subjectIds: subjects,
      positionIds: positions,
    });
    subjects[0] = 99;
    positions[0] = 100;
    const effect = capture.snapshot().effects[0];
    expect(effect.subjectIds).toEqual([2]);
    expect(effect.positionIds).toEqual([4]);
    expect(effect.transactionId).toBeUndefined();
    capture.accept({
      path: 'rows.a',
      ownerPath: 'rows',
      before: 1,
      after: 2,
      origin: 'external',
      participation: 'realized',
      ownerId: 1,
      transactionId: 7,
    });
    expect(capture.snapshot().effects[1].transactionId).toBe(7);
    capture.dispose();
  });
  it('marks omitted identity metadata and accounts arrays against retention bytes', () => {
    const capture = createRealizationCapture({
      treeId: 'tree',
      ownerId: 1,
      maxBytes: 1024,
    });
    capture.accept({
      path: 'n',
      ownerPath: 'n',
      before: 0,
      after: 1,
      participation: 'realized',
      ownerId: 1,
      subjectIds: Array(2001).fill(1),
      positionIds: [NaN],
    });
    expect(capture.snapshot().effects[0]).toMatchObject({
      metadataOmitted: true,
    });
    expect(capture.snapshot().effects[0].subjectIds).toBeUndefined();
    capture.accept({
      path: 'n',
      ownerPath: 'n',
      before: 1,
      after: 2,
      participation: 'realized',
      ownerId: 1,
      positionIds: Array(200).fill(1),
    });
    expect(capture.snapshot().retention.truncated).toBe(true);
    expect(capture.snapshot().retention.retainedBytes).toBeLessThanOrEqual(
      1024
    );
    capture.dispose();
  });
  it('passes through actual notifier metadata without kernel changes', async () => {
    const tree = signalTree(
      {
        rows: entityMap<{ id: string; n: number }, string>({
          selectId: (row) => row.id,
        }),
      },
      { enhancers: [transactions()] }
    );
    const lease = startRealizationCapture(
      liveCaptureTarget(tree, 'metadata-live')!
    );
    const frames: {
      subjectIds?: readonly number[];
      positionIds?: readonly number[];
      transactionId?: number;
    }[] = [];
    const off = observeWrites((frame) => {
      if (frame.participation === 'realized') frames.push(frame);
    });
    try {
      external(() => tree.$.rows.addOne({ id: 'a', n: 1 }));
      for (let i = 0; i < 12; i++) await Promise.resolve();
      expect(frames.length).toBeGreaterThan(0);
      const effect = lease.snapshot().effects[0];
      expect(effect).toBeDefined();
      expect(effect.subjectIds).toEqual(frames[0].subjectIds);
      expect(effect.positionIds).toEqual(frames[0].positionIds);
      expect(effect.transactionId).toBe(frames[0].transactionId);
    } finally {
      off();
      lease.dispose();
      tree.destroy();
    }
  });
});
