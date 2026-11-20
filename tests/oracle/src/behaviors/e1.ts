// E1 | A held row handle belongs to its entity lifetime; a reused key never
// retargets an old handle
//
// A handle held (rowHold) for the row under key k belongs to that row. Once
// the row is gone (k unlisted after some step) and later a row is listed
// under k again, that is another entity: a write through the old handle must
// not change the row now under k, and a read through it must not return that
// row (unless it is indistinguishable from the old one's last value).
// Handles whose key is ever rekeyed (changeId) are not checked; a rekey keeps
// the entity alive under another key.
import type { Json } from '../model.js';
import { canonical } from '../trace.js';
import { analyze, rekeys, rowAt } from './analysis.js';
import { instanceProperty, verdict, type Instance } from './types.js';

export const ROW = 'A held row handle belongs to its entity lifetime; a reused key never retargets an old handle';

export const E1 = instanceProperty({
  id: 'E1',
  row: ROW,
  instances(trace) {
    const analysis = analyze(trace);
    const found: Instance[] = [];
    for (const h of analysis.rowHandles) {
      let lastOld: Json | undefined = rowAt(analysis.steps[h.step]?.after, h.key);
      let dead = false;
      let reused = false;
      for (const s of analysis.steps.slice(h.step + 1)) {
        if (rekeys(s.op, h.key) || !s.after) break;
        const now = rowAt(s.after, h.key);
        if (s.row === h.index && reused && !s.unknown && s.before) {
          const current = rowAt(s.before, h.key);
          if (current !== undefined && s.op.kind === 'rowHeldWrite') {
            const after = now;
            found.push(
              verdict(
                canonical(after) === canonical(current),
                s.index,
                'write-retargeted',
                { [`rows.${h.key}`]: current },
                { [`rows.${h.key}`]: after ?? 'absent' },
                `write through the handle held at step ${h.step} after key ${h.key} was reused`
              )
            );
          }
          if (current !== undefined && s.op.kind === 'rowHeldRead' && s.outcome.status === 'ok') {
            const value = (s.outcome.value as { value?: Json } | undefined)?.value ?? null;
            const distinct = canonical(current) !== canonical(lastOld);
            if (distinct) {
              found.push(
                verdict(
                  canonical(value) !== canonical(current),
                  s.index,
                  'read-retargeted',
                  { notTheRowNowUnder: h.key, rowNowUnderKey: current },
                  { read: value },
                  `read through the handle held at step ${h.step} after key ${h.key} was reused`
                )
              );
            }
          }
        }
        if (!dead) {
          if (now === undefined) dead = true;
          else lastOld = now;
        } else if (!reused && now !== undefined) {
          reused = true;
        }
      }
    }
    return found;
  },
});
