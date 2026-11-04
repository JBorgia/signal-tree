import { expect, it } from 'vitest';
import '../index';
import {
  EntityPublicationSource,
  type EntityPublicationParticipant,
  type SourcePointPreparer,
} from './internals/entity-publication';
import { installTerminalRecord, type PreparedPublicationUnit } from './internals/intrinsic-mutation';

function install(source: EntityPublicationSource, unit: PreparedPublicationUnit | undefined): void {
  if (!unit) throw new Error('Missing prepared source unit');
  unit.finalize?.();
  unit.validate?.();
  installTerminalRecord(unit.record);
  source.complete(unit.completion);
}

it.each([0, 7])('invalidates a retirement plan captured after point preparation when x becomes %s', value => {
  let preparePoint: SourcePointPreparer | undefined;
  const source = new EntityPublicationSource(prepare => { preparePoint = prepare; });
  try {
    const edit = { subject: 1, before: undefined, after: { x: 0, y: 0 }, fields: ['x', 'y'] };
    install(source, source.prepare({ owner: 0, id: {}, meta: undefined, ordinary: [edit], physical: [edit] }));
    if (!preparePoint) throw new Error('Missing source-issued point capability');
    // Capture the plan after target selection. Escape marking during plan
    // creation is too late to influence this unit's preparation-time COW.
    const unit = preparePoint({ owner: 0, id: {}, meta: undefined, subject: 1, fields: ['x'],
      ordinaryBefore: { x: 0, y: 0 }, ordinaryAfter: { x: value, y: 0 },
      physicalBefore: { x: 0, y: 0 }, physicalAfter: { x: value, y: 0 } });
    const participant = (source as unknown as { native?: EntityPublicationParticipant }).native;
    const plan = participant?.prepareRetirement?.(1);
    if (!plan) throw new Error('Missing native retirement plan');
    const before = source.evidence()?.field(1, 'x', 'ordinary');
    expect(plan.current()).toBe(true);
    install(source, unit);
    expect(source.evidence()?.field(1, 'x', 'ordinary')).not.toBe(before);
    expect(plan.current()).toBe(false);
  } finally { source.dispose(); }
});
