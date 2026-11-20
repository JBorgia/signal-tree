// L1 | While a transaction that changed a linked location is pending, the link
// sends nothing to its endpoint and settled() stays unresolved; on confirm the
// link sends the confirmed value and settled() resolves only after the endpoint
// acknowledges it; on rollback nothing is sent for the reversed writes. A
// disposed link withdraws the consequences it held
//
// Checks the second clause: once dispose() succeeds, the link delivers
// nothing more to its endpoint. Applies when, after the dispose, the link's
// source changed or a transaction settled (either could otherwise produce an
// outbound write).
import { analyze, sourceCovers } from './analysis.js';
import { instanceProperty, verdict, type Instance } from './types.js';

export const ROW =
  'While a transaction that changed a linked location is pending, the link sends nothing to its endpoint and settled() stays unresolved; on confirm the link sends the confirmed value and settled() resolves only after the endpoint acknowledges it; on rollback nothing is sent for the reversed writes. A disposed link withdraws the consequences it held';

export const L1 = instanceProperty({
  id: 'L1',
  row: ROW,
  reason: 'The first clause names no outcome to check; only "a disposed link withdraws the consequences it held" is checked.',
  instances(trace) {
    const analysis = analyze(trace);
    const found: Instance[] = [];
    for (const s of analysis.steps) {
      if (s.op.kind !== 'linkDispose' || s.outcome.status !== 'ok' || s.link === undefined) continue;
      const link = analysis.links[s.link];
      if (!link) continue;
      const later = analysis.steps.slice(s.index + 1);
      const exercised = later.some(
        (l) =>
          [...l.changed].some((loc) => sourceCovers(link.source, loc)) ||
          ((l.op.kind === 'confirm' || l.op.kind === 'rollback') && l.outcome.status === 'ok')
      );
      if (!exercised) continue;
      const after = later.flatMap((l) =>
        l.observation.pushes.filter((p) => p.link === link.index).map((p) => ({ step: l.index, value: p.value }))
      );
      // The final record holds whatever the last drain delivered.
      const end = trace.records[analysis.steps.length];
      const atEnd = end
        ? end.observation.pushes.filter((p) => p.link === link.index).map((p) => ({ step: end.index, value: p.value }))
        : [];
      const pushes = [...after, ...atEnd];
      found.push(
        verdict(
          pushes.length === 0,
          pushes[0]?.step ?? s.index,
          'delivered-after-dispose',
          { deliveriesAfterDispose: [] },
          { deliveriesAfterDispose: pushes },
          `link${link.index} disposed at step ${s.index}`
        )
      );
    }
    return found;
  },
});
