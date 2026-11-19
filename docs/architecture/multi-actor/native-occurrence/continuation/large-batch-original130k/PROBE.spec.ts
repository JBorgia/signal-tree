import { appendFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { signalTree } from './signal-tree';
import { entityMap } from './markers/entity-map';
import { undoable } from './undoable';
import { entityMembershipReader } from './internals/entity-membership-view';
import { restoration } from '../enhancers/restoration/restoration';
// Retain the original spec's module graph without running its other cases.
void undoable; void restoration;
type Row = { id: number; n: number };
const rows = (count: number, offset = 0): Row[] =>
  Array.from({ length: count }, (_, i) => ({ id: i + offset, n: i }));
const LARGE = 130_000;
const mark = (stage: string) => appendFileSync(
  process.env.ST_STAGE_LOG!,
  JSON.stringify({stage,pid:process.pid,execArgv:process.execArgv,timeMs:Date.now(),memory:process.memoryUsage()})+'\n'
);
describe('entity batches larger than the argument limit — isolated stage trace', () => {
  it('setAll, replace and clear with membership observed', async () => {
    mark('test-start');
    const tree = signalTree({ rows: entityMap<Row, number>() });
    const reader = entityMembershipReader(tree)!;
    let events = 0;
    const stop = reader.subscribe(() => events++);
    try {
      mark('setAll-initial:before');
      tree.$.rows.setAll(rows(LARGE));
      mark('setAll-initial:after');
      mark('setAll-replace:before');
      tree.$.rows.setAll(rows(LARGE, LARGE));
      mark('setAll-replace:after');
      mark('setAll-clear:before');
      tree.$.rows.setAll([]);
      mark('setAll-clear:after');
      mark('finalassert:before');
      expect(tree.$.rows.count()).toBe(0);
      expect(events).toBeGreaterThan(0);
      mark('finalassert:after');
    } finally {
      mark('stop:before');
      stop();
      mark('stop:after');
      mark('destroy:before');
      tree.destroy();
      mark('destroy:after');
    }
    mark('drain:before');
    for (let i = 0; i < 12; i++) await Promise.resolve();
    mark('drain:after');
  }, 60_000);
});
