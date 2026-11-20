// E2 | Field carriers are stable per handle and created on first access
//
// Every access to field `n` through one held handle (rowHeldRead,
// rowHeldWrite) must yield the same carrier object; subjects report carrier
// identity as a per-tree label.
import type { Json } from '../model.js';
import { analyze } from './analysis.js';
import { instanceProperty, verdict, type Instance } from './types.js';

export const ROW = 'Field carriers are stable per handle and created on first access';

export const E2 = instanceProperty({
  id: 'E2',
  row: ROW,
  reason: '"Created on first access" is not observable from outside; only stability per handle is checked.',
  instances(trace) {
    const analysis = analyze(trace);
    const found: Instance[] = [];
    const first = new Map<number, { step: number; carrier: string }>();
    for (const s of analysis.steps) {
      if ((s.op.kind !== 'rowHeldRead' && s.op.kind !== 'rowHeldWrite') || s.row === undefined) continue;
      if (s.outcome.status !== 'ok') continue;
      const carrier = (s.outcome.value as { carrier?: Json } | undefined)?.carrier;
      if (typeof carrier !== 'string') continue;
      const seen = first.get(s.row);
      if (!seen) {
        first.set(s.row, { step: s.index, carrier });
        continue;
      }
      found.push(
        verdict(
          carrier === seen.carrier,
          s.index,
          'carrier-replaced',
          { carrier: seen.carrier },
          { carrier },
          `field n through handle h${s.row}, first reached at step ${seen.step}`
        )
      );
    }
    return found;
  },
});
