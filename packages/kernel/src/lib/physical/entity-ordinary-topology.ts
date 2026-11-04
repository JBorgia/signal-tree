import type { TopologyViewInterval } from '../internals/mutation-capture-runtime';
import {
  EntityPlacementStage,
  type PreparedPlacementEntries,
} from './entity-placement-stage';
import type { StructuralEffect } from '../mutation-types';

export type OrdinaryEntityPresence<K extends string | number, E> =
  | { readonly present: false }
  | {
      readonly present: true;
      readonly key: K;
      readonly value: E;
      readonly beforeSubject?: number;
      readonly afterSubject?: number;
    };

type PlacementPresence<K> =
  | { readonly present: false }
  | {
      readonly present: true;
      readonly key: K;
      readonly beforeSubject?: number;
      readonly afterSubject?: number;
    };

/** Current presence/key/adjacency only; EntityValueStore owns every payload. */
export class EntityOrdinaryTopology<K extends string | number> {
  private continuity: unknown = {};
  private headOverride: { value: number | undefined } | undefined;
  private tailOverride: { value: number | undefined } | undefined;
  private readonly divergent = new Map<number, PlacementPresence<K>>();
  private readonly displaced = new Map<K, number>();
  preparePlacement(physical: EntityPlacementStage<K>): EntityPlacementStage<K> {
    return new EntityPlacementStage(
      (subject) => this.divergent.get(subject) ?? physical.base(subject),
      this.headOverride ? this.headOverride.value : physical.head,
      this.tailOverride ? this.tailOverride.value : physical.tail
    );
  }
  /** Positive eligibility for the point-only shortcut; do not depend on a
   * later generic install normalizing redundant placement exceptions. */
  isAligned(): boolean {
    return this.divergent.size === 0 && this.displaced.size === 0 &&
      this.headOverride === undefined && this.tailOverride === undefined;
  }
  /** A value-only write on an already ordinary-present lifetime changes no
   * placement. Retain the exact source continuity without constructing stages. */
  prepareUnchanged(): (() => void) & { readonly interval: TopologyViewInterval } {
    const interval = Object.freeze({before:this.continuity,after:this.continuity,pairs:Object.freeze([])});
    return Object.assign(() => { /* No placement mutation was prepared. */ }, {interval});
  }
  prepareInstall(
    ordinary: EntityPlacementStage<K>,
    physical: EntityPlacementStage<K>
  ): (() => void) & { readonly interval: TopologyViewInterval } {
    const interval = this.prepareInterval(ordinary);
    const updates = new Map<number, PlacementPresence<K> | undefined>();
    const ids = new Set([...ordinary.patch.keys(), ...physical.patch.keys()]);
    for (const subject of ids) {
      const o = ordinary.read(subject),
        p = physical.read(subject);
      const same =
        o.present === p.present &&
        (!o.present ||
          (p.present &&
            o.key === p.key &&
            o.beforeSubject === p.beforeSubject &&
            o.afterSubject === p.afterSubject));
      updates.set(
        subject,
        same ? undefined : o.present ? o : { present: false }
      );
    }
    const head =
      ordinary.head === physical.head ? undefined : { value: ordinary.head };
    const tail =
      ordinary.tail === physical.tail ? undefined : { value: ordinary.tail };
    return Object.assign(
      () => {
        this.continuity = interval.after;
        for (const [subject, row] of updates) this.install(subject, row);
        this.headOverride = head;
        this.tailOverride = tail;
      },
      { interval }
    );
  }
  prepareInterval(
    stage: EntityPlacementStage<K>,
    entries?: PreparedPlacementEntries<K>
  ): TopologyViewInterval {
    const pairs = (entries ?? [...stage.patch]).flatMap(([subject, after]) => {
      const before = stage.base(subject);
      const equal =
        before.present === after.present &&
        (!before.present ||
          (after.present &&
            before.key === after.key &&
            before.beforeSubject === after.beforeSubject &&
            before.afterSubject === after.afterSubject));
      return equal
        ? []
        : [
            Object.freeze({
              subject,
              before: Object.freeze({ ...before }),
              after:
                entries && Object.isFrozen(after)
                  ? after
                  : Object.freeze({ ...after }),
            }),
          ];
    });
    return Object.freeze({
      before: this.continuity,
      after: pairs.length ? {} : this.continuity,
      pairs: Object.freeze(pairs),
    });
  }
  read(subject: number): PlacementPresence<K> | undefined {
    return this.divergent.get(subject);
  }
  atKey(key: K): number | undefined {
    return this.displaced.get(key);
  }
  install(subject: number, next: PlacementPresence<K> | undefined): void {
    const previous = this.divergent.get(subject);
    if (previous?.present && this.displaced.get(previous.key) === subject)
      this.displaced.delete(previous.key);
    if (next === undefined) this.divergent.delete(subject);
    else {
      this.divergent.set(subject, next);
      if (next.present) this.displaced.set(next.key, subject);
    }
  }
  retains(subject: number): boolean {
    return this.divergent.get(subject)?.present === true;
  }
  clear(): void {
    this.divergent.clear();
    this.displaced.clear();
    this.headOverride = undefined;
    this.tailOverride = undefined;
  }
}

export function ordinaryPresenceRecord<K extends string | number, E>(
  kind: 'add' | 'remove',
  subject: number,
  state: Extract<OrdinaryEntityPresence<K, E>, { present: true }>
): StructuralEffect {
  return {
    kind,
    subject,
    key: state.key,
    value: state.value,
    beforeSubject: state.beforeSubject,
    afterSubject: state.afterSubject,
  };
}
