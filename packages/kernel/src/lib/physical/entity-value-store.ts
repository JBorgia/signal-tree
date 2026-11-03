import { getActiveWriteContext } from '../write-context';
import { deepEqual } from '../internals/utilities/deep-equal';
import { deepClone } from '../internals/utilities/deep-clone';
import type {
  EntityRealizationEdit,
  EntityValueTransition,
} from '../internals/entity-value-transition';
import { recordProductionSubstrateStat } from '../internals/production-substrate-stats';

export class EntityValueStore<E extends Record<string, unknown>> {
  private retainedEntities = new Map<number, E>();
  private inspectionBaselines = new Map<number, E>();

  prepareValueTransition(
    subject: number,
    physicalAfter: E,
    fields?: readonly string[] | null | 'derive',
    previous?: EntityValueTransition<E>
  ): EntityValueTransition<E> {
    const physicalBefore =
      previous?.physicalAfter ?? this.retainedEntities.get(subject);
    if (fields === 'derive') {
      // Ordinary authorship does not narrow the physical row. Data-only
      // returns retain their reference; accessor staging preserves every other
      // descriptor and the prototype while evaluating with the original receiver.
      const descriptors: PropertyDescriptorMap =
        Object.getOwnPropertyDescriptors(physicalAfter);
      let hasAccessors = false;
      for (const field of Object.keys(physicalAfter)) {
        const descriptor = descriptors[field];
        if (!descriptor || 'value' in descriptor) continue;
        const value = physicalAfter[field];
        hasAccessors = true;
        // Build the final descriptors before creating the staged row so even
        // nonconfigurable input accessors can become prepared data properties.
        descriptors[field] = {
          value,
          enumerable: descriptor.enumerable,
          writable: true,
          configurable: descriptor.configurable,
        };
      }
      if (hasAccessors) {
        physicalAfter = Object.create(
          Object.getPrototypeOf(physicalAfter),
          descriptors
        ) as E;
      }
      fields = physicalBefore
        ? [...new Set([
            ...Object.keys(physicalBefore),
            ...Object.keys(physicalAfter),
          ])].filter(
            (field) =>
              Object.prototype.hasOwnProperty.call(physicalBefore, field) !==
                Object.prototype.hasOwnProperty.call(physicalAfter, field) ||
              !Object.is(physicalBefore[field], physicalAfter[field])
          )
        : Object.keys(physicalAfter);
    }
    const ordinaryBefore =
      previous?.ordinaryAfter ??
      this.inspectionBaselines.get(subject) ??
      physicalBefore;
    let ordinaryAfter = physicalAfter;
    if (getActiveWriteContext()?.participation === 'inspection') {
      ordinaryAfter = ordinaryBefore ?? physicalAfter;
    } else if (fields && ordinaryBefore) {
      const merged: Record<string, unknown> = { ...ordinaryBefore };
      for (const field of fields) {
        if (Object.prototype.hasOwnProperty.call(physicalAfter, field))
          Object.defineProperty(merged, field, {
            value: physicalAfter[field],
            enumerable: true,
            writable: true,
            configurable: true,
          });
        else delete merged[field];
      }
      ordinaryAfter = merged as E;
    }
    return Object.freeze({
      subject,
      physicalBefore,
      physicalAfter,
      ordinaryBefore,
      ordinaryAfter,
      retainDivergence:
        ordinaryBefore !== undefined &&
        !deepEqual(ordinaryAfter, physicalAfter),
    });
  }

  prepareRealizationTransition(
    subject: number,
    physicalAfter: E,
    edits: readonly EntityRealizationEdit[],
    previous?: EntityValueTransition<E>
  ): EntityValueTransition<E> {
    const physicalBefore = previous?.physicalAfter ?? this.retainedEntities.get(subject);
    const ordinaryBefore =
      previous?.ordinaryAfter ?? this.inspectionBaselines.get(subject) ?? physicalBefore;
    if (!ordinaryBefore)
      throw new Error('Point realization ordinary lifetime is unavailable');
    let ordinaryAfter = ordinaryBefore;
    for (const edit of edits) {
      if (edit.kind === 'row') {
        ordinaryAfter = deepClone(edit.value) as E;
      } else {
        const next = { ...ordinaryAfter };
        if (edit.present)
          Object.defineProperty(next, edit.field, {
            value: deepClone(edit.value),
            enumerable: true,
            configurable: true,
            writable: true,
          });
        else delete next[edit.field];
        ordinaryAfter = next;
      }
    }
    return Object.freeze({
      subject,
      physicalBefore,
      physicalAfter,
      ordinaryBefore,
      ordinaryAfter,
      retainDivergence: !deepEqual(ordinaryAfter, physicalAfter),
    });
  }

  installValueTransition(transition: EntityValueTransition<E>): void {
    this.installOrdinaryValueTransition(transition);
    recordProductionSubstrateStat('valueStoreWrites');
    this.retainedEntities.set(transition.subject, transition.physicalAfter);
  }

  /** Install prepared ordinary authority after the paired physical unit. */
  installOrdinaryValueTransition(transition: EntityValueTransition<E>): void {
    if (transition.retainDivergence)
      this.inspectionBaselines.set(
        transition.subject,
        transition.ordinaryAfter
      );
    else this.inspectionBaselines.delete(transition.subject);
  }

  ordinaryForSubject(subjectId: number): E | undefined {
    return this.inspectionBaselines.get(subjectId) ?? this.retainedEntities.get(subjectId);
  }

  dischargeOrdinaryValue(subjectId: number): void { this.inspectionBaselines.delete(subjectId); }

  backingForSubject(subjectId: number): E | undefined {
    return this.retainedEntities.get(subjectId);
  }

  retainSubjectValue(subjectId: number, entity: E): void {
    this.inspectionBaselines.delete(subjectId);
    recordProductionSubstrateStat('valueStoreWrites');
    this.retainedEntities.set(subjectId, entity);
  }

  prepareTargetValues(
    subjects: readonly { readonly subjectId: number; readonly value: E }[]
  ): Map<number, E> {
    const target = new Map(this.retainedEntities);
    for (const subject of subjects) {
      target.set(subject.subjectId, subject.value);
    }
    return target;
  }

  installPreparedTargetValues(target: Map<number, E>): void {
    this.retainedEntities = target;
  }

  hasRetainedValueBacking(subjectId: number): boolean {
    return this.retainedEntities.has(subjectId);
  }

  retireSubjectValue(subjectId: number): boolean {
    this.inspectionBaselines.delete(subjectId);
    return this.retainedEntities.delete(subjectId);
  }

  clear(): void {
    this.inspectionBaselines.clear();
    this.retainedEntities.clear();
  }
}
