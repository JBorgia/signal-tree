import { expect, it, vi } from 'vitest';
import '../index';
import * as lifecycle from './experimental-publication/lifecycle';
import {
  EntityPublicationSource,
  type EntityPublicationParticipant,
  type EntityPublicationEdit,
  type SourcePointPreparer,
} from './internals/entity-publication';
import {
  combineTerminalRecords,
  installTerminalRecord,
  type PreparedPublicationUnit,
} from './internals/intrinsic-mutation';

function apply(
  source: EntityPublicationSource,
  unit: PreparedPublicationUnit | undefined
): void {
  if (!unit) throw new Error('Missing native unit');
  unit.finalize?.();
  unit.validate?.();
  installTerminalRecord(unit.record);
  source.complete(unit.completion);
}
function assertCurrentSelection(source: EntityPublicationSource) {
  // Independent current View enumeration remains the semantic reference.
  const views = source.captureViews() as readonly {
    requirement: lifecycle.NativeRequirement;
  }[];
  const requirements = [...new Set(views.map((view) => view.requirement))];
  const actual = (
    source.captureInput() as { native: readonly lifecycle.NativeInput[] }
  ).native;
  expect(actual.length).toBe(requirements.length);
  expect(Object.isFrozen(actual)).toBe(true);
  actual.forEach((input, index) => {
    expect(input.requirement).toBe(requirements[index]);
    expect(input.owners).toEqual(
      lifecycle.captureNativeInput(requirements[index]).owners
    );
    expect(Object.isFrozen(input)).toBe(true);
    expect(Object.isFrozen(input.owners)).toBe(true);
  });
  return actual;
}
for (const storage of ['map', 'packed'] as const)
  for (const value of [0, 7])
    for (const demand of ['before-prepare', 'after-prepare'] as const)
      it(`point install refreshes ${storage} selection demanded ${demand}, physical value ${value}`, () => {
        let issue: SourcePointPreparer | undefined;
        const source = new EntityPublicationSource((prepare) => {
          issue = prepare;
        });
        let spy: { mockRestore(): void } | undefined;
        try {
          const initial = { x: 0, y: 0 };
          const edit: EntityPublicationEdit = {
            subject: 1,
            before: undefined,
            after: initial,
            fields: ['x', 'y'],
            structural:
              storage === 'packed'
                ? { kind: 'add', subject: 1, key: 1, value: initial }
                : undefined,
          };
          apply(
            source,
            source.prepare({
              owner: 0,
              id: {},
              meta: undefined,
              ordinary: [edit],
              physical: [edit],
            })
          );
          const native = (
            source as unknown as { native?: EntityPublicationParticipant }
          ).native;
          if (!issue || !native?.preparePoint)
            throw new Error('Missing private source point capability');
          const prepared = vi.spyOn(native, 'preparePoint');
          spy = prepared;
          const previousRequirement = source
            .evidence()
            ?.field(1, 'x', 'physical');
          if (!previousRequirement)
            throw new Error('Missing physical requirement');
          if (demand === 'before-prepare') assertCurrentSelection(source);
          const unit = issue({
            owner: 0,
            id: {},
            meta: undefined,
            subject: 1,
            fields: ['x'],
            physicalBefore: initial,
            physicalAfter: { x: value, y: 0 },
            ordinaryBefore: initial,
            ordinaryAfter: { x: value, y: 0 },
          });
          expect(prepared).toHaveBeenCalledTimes(1); // Guard against generic-path fallback.
          if (!unit) throw new Error('Missing prepared point unit');
          // The second case creates the cache only after preparation. A gate
          // based on preparation-time demand must fail this case.
          const before = assertCurrentSelection(source);
          expect(source.evidence()?.field(1, 'x', 'physical')).toBe(
            previousRequirement
          );
          let after: readonly lifecycle.NativeInput[] | undefined;
          let laterWrites = 0;
          unit.finalize?.();
          unit.validate?.();
          installTerminalRecord(
            combineTerminalRecords(unit.record, {
              writes: [
                {
                  map: {
                    set() {
                      laterWrites++;
                      expect(
                        source.evidence()?.field(1, 'x', 'physical')
                      ).not.toBe(previousRequirement);
                      after = assertCurrentSelection(source);
                    },
                  },
                  key: undefined,
                  value: undefined,
                },
              ],
              adds: [],
            })
          );
          expect(laterWrites).toBe(1);
          expect(after).toBeDefined();
          expect(after).not.toBe(before);
          source.complete(unit.completion);
          assertCurrentSelection(source);
        } finally {
          spy?.mockRestore();
          source.dispose();
        }
      });
