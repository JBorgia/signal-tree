import type { EntityTargetHost } from './prepare-entity-target';
import type { StructuralEffect } from '../types';
import { replaceLocation, deriveLocation } from '../internals/location-runtime';
import { deepClone } from '../internals/utilities/deep-clone';
import { deepEqual } from '../internals/utilities/deep-equal';
import {
  MEMBERSHIP_OPEN_ORDER,
  MEMBERSHIP_OPEN,
  MEMBERSHIP_FACTS,
  MEMBERSHIP_CLOSE,
  type EntityMembershipInstruction,
} from '../internals/entity-membership-source';
export type EntityOwnershipDelta = {
  readonly subject: number;
  readonly before: {
    readonly key: string | number;
    readonly value: unknown;
  } | null;
  readonly after: {
    readonly key: string | number;
    readonly value: unknown;
  } | null;
  readonly beforeSubject?: number;
  readonly afterSubject?: number;
  readonly rank: number;
  readonly topology: boolean;
  readonly orderChanged: boolean;
};
export function prepareEntityOwnershipDelta<
  E extends Record<string, unknown>,
  K extends string | number
>(host: EntityTargetHost<E, K>, changes: readonly EntityOwnershipDelta[]) {
  const {
    structuralStore: store,
    valueStore,
    activeIdSignal,
    physicalCommitClock,
  } = host;
  if (host.positionId === undefined)
    throw new Error('Delta target has no owner');
  const frontier = store.activeOrderFrontier(),
    revision = physicalCommitClock?.revision();
  const activeIdBefore = activeIdSignal(),
    activeSubject =
      activeIdBefore === undefined
        ? undefined
        : store.subjectIdForKey(activeIdBefore);
  const bySubject = new Map(changes.map((c) => [c.subject, c]));
  if (bySubject.size !== changes.length)
    throw new Error('Duplicate delta lifetime');
  const vacating = new Set(
    changes.filter((c) => c.before && c.topology).map((c) => c.before!.key)
  );
  const claimed = new Set<string | number>();
  const prepared = changes.map((change) => {
    const state = store.stateForSubject(change.subject);
    const key = store.activeKeyForSubject(change.subject);
    const current =
      key === undefined
        ? undefined
        : valueStore.backingForSubject(change.subject);
    if (!state || (!state.active && !state.restoreAllowed))
      throw new Error('Delta lifetime unavailable');
    if (
      (change.before === null) !== (key === undefined) ||
      (change.before && change.before.key !== key)
    )
      throw new Error('Delta source membership changed');
    if (change.before && !deepEqual(current, change.before.value))
      throw new Error('Delta source value changed');
    if (change.after) {
      if (claimed.has(change.after.key)) throw new Error('Duplicate delta key');
      claimed.add(change.after.key);
      const occupied = store.subjectIdForKey(change.after.key as K);
      if (
        occupied !== undefined &&
        occupied !== change.subject &&
        !vacating.has(change.after.key)
      )
        throw new Error('Delta target key occupied');
      if (
        change.after.value === null ||
        typeof change.after.value !== 'object' ||
        Array.isArray(change.after.value)
      )
        throw new Error('Invalid delta row value');
      if (change.topology && change.afterSubject !== undefined) {
        const next = bySubject.get(change.afterSubject);
        if (
          change.afterSubject === change.subject ||
          (next && !next.after) ||
          (!next &&
            store.activeKeyForSubject(change.afterSubject) === undefined)
        )
          throw new Error('Delta successor unavailable');
      }
    }
    const value = change.after
      ? ((deepEqual(current, change.after.value)
          ? current
          : deepClone(change.after.value)) as E)
      : undefined;
    return {
      change,
      key,
      current,
      value,
      state,
      epoch: host.subjectEpochs.get(change.subject),
      stateSignal: host.subjectStateSignals.get(change.subject)?.deref(),
    };
  });
  const facts: EntityMembershipInstruction[] = [];
  for (const { change: c } of prepared) {
    if (!c.before && c.after)
      facts.push({
        kind: 'restore-subject',
        subjectId: c.subject,
        key: c.after.key,
      });
    else if (c.before && !c.after)
      facts.push({
        kind: 'tombstone-subject',
        subjectId: c.subject,
        key: c.before.key,
      });
    else if (c.before && c.after && c.before.key !== c.after.key)
      facts.push({
        kind: 'transfer-key',
        subjectId: c.subject,
        fromKey: c.before.key,
        toKey: c.after.key,
      });
  }
  const orderChanged = changes.some((c) => c.orderChanged);
  const membershipChanged = orderChanged || facts.length > 0;
  const movers = prepared
    .filter((p) => p.change.topology && p.change.after)
    .sort((a, b) => b.change.rank - a.change.rank);
  // Successors that move must be installed earlier. This also rejects cycles.
  const placed = new Set<number>();
  for (const p of movers) {
    const next = p.change.afterSubject;
    if (
      next !== undefined &&
      bySubject.get(next)?.topology &&
      !placed.has(next)
    )
      throw new Error('Delta successor dependency order invalid');
    placed.add(p.change.subject);
  }
  const selected =
    activeSubject === undefined ? undefined : bySubject.get(activeSubject);
  const activeIdAfter = selected?.after
    ? (selected.after.key as K)
    : activeIdBefore;
  if (
    store.activeOrderFrontier() !== frontier ||
    physicalCommitClock?.revision() !== revision
  )
    throw new Error('Delta preparation reentered installation');
  return {
    install() {
      if (store.activeOrderFrontier() !== frontier)
        throw new Error('Delta installation frontier is stale');
      const tap = membershipChanged ? host.membershipTap : undefined;
      tap?.(orderChanged ? MEMBERSHIP_OPEN_ORDER : MEMBERSHIP_OPEN);
      try {
        for (const p of prepared)
          if (p.change.topology && p.key !== undefined)
            store.tombstoneSubject(
              p.change.subject,
              p.key,
              p.state.restoreAllowed
            );
        for (const p of movers)
          store.restoreSubjectAtResolvedPlacement(
            p.change.subject,
            p.change.after!.key as K,
            { afterSubject: p.change.afterSubject },
            p.state.restoreAllowed
          );
        for (const p of prepared)
          if (p.change.after && p.value !== p.current)
            valueStore.retainSubjectValue(p.change.subject, p.value!);
        for (const p of prepared)
          if (
            !p.change.before ||
            !p.change.after ||
            p.change.before.key !== p.change.after.key
          )
            store.bumpSubjectRevision(p.change.subject);
        if (activeIdBefore !== activeIdAfter)
          replaceLocation(activeIdSignal, activeIdAfter);
        if (!orderChanged && facts.length) tap?.(MEMBERSHIP_FACTS, facts);
      } finally {
        tap?.(MEMBERSHIP_CLOSE);
      }
    },
    invalidate() {
      let failed = false;
      let firstError: unknown;
      const stage = (fn: () => void) => {
        try {
          fn();
        } catch (error) {
          if (!failed) {
            failed = true;
            firstError = error;
          }
        }
      };
      for (const p of prepared) {
        const bindingChanged =
          !p.change.before ||
          !p.change.after ||
          p.change.before.key !== p.change.after.key;
        if (p.epoch && (bindingChanged || p.current !== p.value))
          stage(() => host.advanceEpochHandle(p.epoch!));
        if (bindingChanged && p.stateSignal)
          stage(() => deriveLocation(p.stateSignal!, (n) => n + 1));
      }
      stage(() => host.updateSignals());
      if (failed) throw firstError;
    },
    publish() {
      let failed = false;
      let firstError: unknown;
      const run = (fn: () => void) => {
        try {
          fn();
        } catch (error) {
          if (!failed) {
            failed = true;
            firstError = error;
          }
        }
      };
      for (const p of prepared) {
        const c = p.change,
          key = c.after?.key ?? c.before?.key;
        if (key === undefined) continue;
        let effect: StructuralEffect | undefined;
        if (!c.before && c.after)
          effect = {
            kind: 'add',
            subject: c.subject,
            key,
            value: p.value,
            beforeSubject: c.beforeSubject,
            afterSubject: c.afterSubject,
          };
        else if (c.before && !c.after)
          effect = {
            kind: 'remove',
            subject: c.subject,
            key,
            value: p.current,
          };
        else if (c.before && c.after && c.before.key !== c.after.key)
          effect = {
            kind: 'rekey',
            subject: c.subject,
            beforeKey: c.before.key,
            afterKey: c.after.key,
          };
        if (!effect && p.current === p.value) continue;
        run(() =>
          host.pathNotifier.notify(
            `${host.basePath}.${String(key)}`,
            p.value,
            p.current,
            host.basePath,
            [c.subject],
            host.getPositionIdsForNotify(),
            {
              ...(effect
                ? host.createStructuralEffectMeta(effect)
                : host.ambientMeta()),
              intent: 'system',
              participation: 'realized',
            }
          )
        );
        if (effect?.kind === 'add')
          run(() => host.emitTap('onAdd', p.value!, key as K));
        else if (effect?.kind === 'remove')
          run(() => host.emitTap('onRemove', key as K, p.current!));
        else if (!effect && !deepEqual(p.current, p.value))
          run(() => host.emitTap('onUpdate', key as K, p.value!, p.value!));
      }
      if (failed) throw firstError;
    },
  };
}
