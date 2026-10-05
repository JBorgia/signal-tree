// Observation demand that changes during a staging callback.
//
// Carried from v15 012fd11d (8fe2664f's staging controls) in v16 integration
// slice 5. v16 does not yet gate entity payloads on `hasObservers` (slice 9,
// 97affed3/172a8268); the donor's gate cases are preserved in
// docs/audits/2026-10-01-v16-integration/preserved/entity-observation-gate.spec.ts.txt
// and arrive with that gate. These controls must hold with or without it: an
// interceptor that installs an observer mid-operation still receives the whole
// operation, and every removal's pre-state neighbours are captured before any
// tombstone commits.
import { describe, expect, it, vi } from 'vitest';

import {
  observeWrites,
  type ObservedWriteFrame,
} from './internals/write-observation';

import { createEntitySignal } from './entity-signal';
import { entityMap } from './markers/entity-map';
import { getPathNotifier } from './path-notifier';
import { signalTree } from './signal-tree';

type Row = { id: number; name: string; tags: string[] };

type Port = {
  notify: ReturnType<typeof vi.fn>;
  hasObservers?: () => boolean;
};

const row = (id: number, name = `r${id}`): Row => ({ id, name, tags: [name] });

describe('removal observation installed by an interceptor', () => {
  it.each(['one', 'many'] as const)(
    '%s publishes removals after subscription',
    (mode) => {
      const notifier = getPathNotifier();
      notifier.clear();
      const tree = signalTree({ rows: entityMap<Row, number>() });
      const seen: ObservedWriteFrame[] = [];
      let stop = () => undefined as void;
      try {
        tree.$.rows.setAll([row(1), row(2)]);
        notifier.flushSync();
        tree.$.rows.intercept({
          onRemove: (id) => {
            if (id === 2)
              stop = observeWrites((frame) => {
                seen.push(frame);
              });
          },
        });
        if (mode === 'one') tree.$.rows.removeOne(2);
        else tree.$.rows.removeMany([1, 2]);
        notifier.flushSync();
        expect(
          seen.map(({ path, before, after }) => ({ path, before, after }))
        ).toEqual(
          (mode === 'one' ? [2] : [1, 2]).map((id) => ({
            path: `rows.${id}`,
            before: row(id),
            after: undefined,
          }))
        );
      } finally {
        stop();
        tree.destroy();
        notifier.clear();
      }
    }
  );
});

it('captures every pre-removal neighbour when the last interceptor enables observation', () => {
  let observed = false;
  const port: Port = { notify: vi.fn(), hasObservers: () => observed };
  const api = createEntitySignal<Row, number>(
    { selectId: (r) => r.id },
    port as never,
    'rows'
  );
  api.setAll([row(1), row(2), row(3)]);
  // v16 adaptation: without slice 9's gate the port also received the setAll
  // above. Only the removal's publications are under test.
  port.notify.mockClear();
  api.intercept({
    onRemove: (id) => {
      if (id === 2) observed = true;
    },
  });
  api.removeMany([1, 2]);
  const effects = port.notify.mock.calls.map(
    (call) => call[6].structuralEffect
  );
  expect(effects).toEqual([
    {
      kind: 'remove',
      subject: 1,
      key: 1,
      value: row(1),
      beforeSubject: undefined,
      afterSubject: 2,
    },
    {
      kind: 'remove',
      subject: 2,
      key: 2,
      value: row(2),
      beforeSubject: 1,
      afterSubject: 3,
    },
  ]);
});
