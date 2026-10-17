import { isTraversableNode } from './node-shape';
import { reportContainedObserverError } from './error-reporter';
import {
  getOrCreateSubjectRestorationClaims,
  prepareSubjectRestorationClaims,
} from './subject-restoration-claims';
import { getOrCreateSubjectReclamationSink } from './subject-reclamation-sink';
import { getPathNotifier } from '../path-notifier';
import {
  getMutationCaptureRuntime,
  type CommittedEntityCapture,
} from './mutation-capture-runtime';
import type { TerminalRecordPlan } from './intrinsic-mutation';
import { getOwnedPositionIds } from './owned-metadata';
import { deepClone } from './utilities/deep-clone';
import { deepEqual } from './utilities/deep-equal';
import type { EntityOwnershipDelta } from '../physical/prepare-entity-ownership-delta';

type Row = { key: string | number; value: unknown };
type Placement = Row & { beforeSubject?: number; afterSubject?: number };
type Fact = {
  value: unknown;
  order: number;
  addressKey?: string | number;
  // Retain the sparse neighbor chain even when this fact removes its lifetime.
  placement?: Pick<Placement, 'beforeSubject' | 'afterSubject'>;
};
type Ledger = { base: Fact; pending: Map<number, Fact> };
type Address = {
  collection: Collection;
  owner: number;
  subject: number;
  field?: readonly string[];
  ordering?: boolean;
  authoredKey?: string | number;
};
type Collection = {
  __readOwnershipSubject(subject: number): Placement | null;
  __readOwnershipOrder(): readonly number[];
  __prepareOwnershipDelta(changes: readonly EntityOwnershipDelta[]): {
    install(): void;
    invalidate(): void;
    publish(): void;
  };
};
const plain = (v: unknown): v is Record<string, unknown> =>
  v !== null &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  Object.getPrototypeOf(v) === Object.prototype;
const absent = Symbol('absent entity field');
const winner = (l: Ledger) => {
  let v = l.base;
  for (const f of l.pending.values()) if (f.order > v.order) v = f;
  return v;
};
/** Sparse pending facts only. Native collections remain the committed source. */
export function nativeEntityOwnership(
  root: object,
  author: () => number | undefined,
  beforePrepare: () => void,
  suppressed: () => boolean
) {
  let runtime = getMutationCaptureRuntime(root);
  const collections = new Map<number, Collection>();
  const rowFields = new Map<string, Set<string>>();
  const ledgers = new Map<string, Ledger>(),
    addresses = new Map<string, Address>(),
    owners = new Map<number, Set<string>>();
  let sequence = 0;
  const register = (node: unknown, seen = new Set<object>()) => {
    if (!isTraversableNode(node)) return;
    const object = node as object;
    if (seen.has(object)) return;
    seen.add(object);
    const candidate = node as Collection;
    if (typeof candidate.__readOwnershipSubject === 'function') {
      runtime ??= getMutationCaptureRuntime(node);
      const id = getOwnedPositionIds(node)?.[0];
      if (id !== undefined) collections.set(id, candidate);
      return;
    }
    for (const key of Object.getOwnPropertyNames(object)) {
      const child = Object.getOwnPropertyDescriptor(object, key)?.value;
      if (isTraversableNode(child)) register(child, seen);
    }
  };
  register(root);
  const claims = collections.size
    ? getOrCreateSubjectRestorationClaims(root)
    : undefined;
  const sink = claims ? getOrCreateSubjectReclamationSink(root) : undefined;
  const candidates = new Set<number>();
  let scheduled = false,
    destroyed = false;
  const claimOwner = (id: number) => `native-transaction:${id}`;
  const maintain = () => {
    if (destroyed) return;
    const subjects = [...candidates];
    sink?.offerUnclaimed(subjects);
    for (const subject of subjects) candidates.delete(subject);
  };
  const schedule = () => {
    if (scheduled || destroyed) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (destroyed) return;
      try {
        getPathNotifier().flushSync();
        maintain();
      } catch (error) {
        reportContainedObserverError({
          error,
          operation: 'transaction:listener',
        });
      }
    });
  };
  const previous = runtime?.prepareEntityResponsibility;
  if (previous)
    throw new Error('Entity ownership already has a responsibility authority');
  const capture = (
    capture: CommittedEntityCapture
  ): TerminalRecordPlan | undefined => {
    if (suppressed()) return;
    beforePrepare();
    const id = author(),
      order = ++sequence;
    const collection = collections.get(capture.owner);
    if (!collection) throw new Error('Unregistered entity collection');
    const writes: TerminalRecordPlan['writes'][number][] = [],
      adds: TerminalRecordPlan['adds'][number][] = [];
    const keyedAdds: NonNullable<TerminalRecordPlan['keyedAdds']>[number][] =
      [];
    const preparedFields = new Map<string, Set<string>>();
    const owned =
      id === undefined ? undefined : owners.get(id) ?? new Set<string>();
    const stage = (
      key: string,
      address: Address,
      before: unknown,
      after: unknown,
      placement?: Placement
    ) => {
      const old = ledgers.get(key),
        next: Ledger = old
          ? { base: old.base, pending: new Map(old.pending) }
          : {
              base: { value: deepClone(before), order: 0 },
              pending: new Map(),
            };
      const fact = {
        value: deepClone(after),
        order,
        addressKey: address.authoredKey,
        placement: placement && {
          beforeSubject: placement.beforeSubject,
          afterSubject: placement.afterSubject,
        },
      };
      if (id === undefined) next.base = fact;
      else next.pending.set(id, fact);
      // A field author does not own its observed key. Its value can nevertheless
      // depend on a pending lifetime, including a field absent at creation.
      const membershipPending =
        address.field !== undefined &&
        ledgers.get(`${address.owner}:${address.subject}:@`)?.pending.size;
      if (next.pending.size || membershipPending) {
        writes.push(
          { map: ledgers as Map<unknown, unknown>, key, value: next },
          { map: addresses as Map<unknown, unknown>, key, value: address }
        );
        if (owned)
          keyedAdds.push({
            map: owners as Map<unknown, Set<unknown>>,
            key: id,
            prepared: owned as Set<unknown>,
            value: key,
          });
        const rowKey = `${address.owner}:${address.subject}`;
        let fields = preparedFields.get(rowKey) ?? rowFields.get(rowKey);
        if (!fields) {
          fields = new Set();
          preparedFields.set(rowKey, fields);
        }
        keyedAdds.push({
          map: rowFields as Map<unknown, Set<unknown>>,
          key: rowKey,
          prepared: fields as Set<unknown>,
          value: key,
        });
      }
    };
    const orderingKey = `${capture.owner}:order`;
    const explicitOrder = capture.ordering;
    const needsOrder =
      ledgers.has(orderingKey) ||
      explicitOrder?.kind === 'exact' ||
      (explicitOrder?.kind === 'front' &&
        capture.changes.some((change) => change.before !== undefined));
    if (
      needsOrder &&
      (explicitOrder || capture.changes.some((change) => change.structural))
    ) {
      const before = [...collection.__readOwnershipOrder()];
      const removed = new Set(
        capture.changes
          .filter((change) => change.after === undefined)
          .map((change) => change.subject)
      );
      let after = before.filter((subject) => !removed.has(subject));
      if (explicitOrder) {
        const subjects = [...explicitOrder.subjects],
          selected = new Set(subjects);
        after =
          explicitOrder.kind === 'exact'
            ? subjects
            : explicitOrder.kind === 'front'
            ? [
                ...subjects,
                ...after.filter((subject) => !selected.has(subject)),
              ]
            : [
                ...after,
                ...subjects.filter((subject) => !after.includes(subject)),
              ];
      }
      stage(
        orderingKey,
        { collection, owner: capture.owner, subject: -1, ordering: true },
        before,
        after
      );
    }
    for (const change of capture.changes) {
      const prefix = `${capture.owner}:${change.subject}`,
        membership = `${prefix}:@`;
      const current = collection.__readOwnershipSubject(change.subject),
        record = change.structuralRecord;
      const beforeKey =
        record?.kind === 'rekey'
          ? record.beforeKey
          : record && 'key' in record
          ? record.key
          : current?.key;
      const afterKey = record?.kind === 'rekey' ? record.afterKey : beforeKey;
      const placement =
        record && 'beforeSubject' in record
          ? {
              beforeSubject: record.beforeSubject,
              afterSubject: record.afterSubject,
            }
          : {
              beforeSubject: current?.beforeSubject,
              afterSubject: current?.afterSubject,
            };
      const before: Placement | null =
        change.before === undefined
          ? null
          : {
              key: beforeKey as string | number,
              value: change.before,
              ...placement,
            };
      const after: Placement | null =
        change.after === undefined
          ? null
          : {
              key: afterKey as string | number,
              value: change.after,
              ...placement,
            };
      const address = {
        collection,
        owner: capture.owner,
        subject: change.subject,
        authoredKey: beforeKey ?? afterKey,
      };
      if (change.structural)
        stage(membership, address, before, after, before ?? after ?? undefined);
      if (change.after !== undefined) {
        const b = (change.before ?? {}) as Record<string, unknown>,
          a = change.after as Record<string, unknown>;
        const diff = (
          b: Record<string, unknown>,
          a: Record<string, unknown>,
          path: readonly string[]
        ) => {
          for (const field of new Set([...Object.keys(b), ...Object.keys(a)])) {
            const bv = Object.prototype.hasOwnProperty.call(b, field)
                ? b[field]
                : absent,
              av = Object.prototype.hasOwnProperty.call(a, field)
                ? a[field]
                : absent,
              nextPath = [...path, field];
            if (!deepEqual(bv, av))
              stage(
                `${prefix}:${JSON.stringify(nextPath)}`,
                { ...address, field: nextPath },
                bv,
                av
              );
          }
        };
        diff(b, a, []);
      }
    }
    if (id !== undefined && claims) {
      const subjects = new Set<number>(
        capture.changes.map((change) => change.subject)
      );
      for (const change of capture.changes) {
        const record = change.structuralRecord;
        if (record && 'beforeSubject' in record) {
          if (record.beforeSubject !== undefined)
            subjects.add(record.beforeSubject);
          if (record.afterSubject !== undefined)
            subjects.add(record.afterSubject);
        }
      }
      for (const subject of capture.ordering?.subjects ?? [])
        subjects.add(subject);
      const plan = prepareSubjectRestorationClaims(
        claims,
        claimOwner(id),
        subjects
      );
      writes.push(...plan.writes);
      adds.push(...plan.adds);
      keyedAdds.push(...(plan.keyedAdds ?? []));
    }
    for (const change of capture.changes)
      if (change.after === undefined)
        adds.push({ set: candidates as Set<unknown>, value: change.subject });
    if (capture.changes.some((change) => change.after === undefined))
      schedule();
    return { writes, adds, keyedAdds };
  };
  if (runtime) runtime.prepareEntityResponsibility = capture;
  return {
    prepare(id: number, accept: boolean) {
      const owned = owners.get(id) ?? new Set<string>();
      const next = new Map<string, Ledger>();
      const touched = new Map<string, Address>();
      for (const key of owned) {
        const old = ledgers.get(key);
        const fact = old?.pending.get(id);
        if (!old || !fact) continue;
        const l = {
          base: accept && fact.order > old.base.order ? fact : old.base,
          pending: new Map(old.pending),
        };
        l.pending.delete(id);
        next.set(key, l);
        const a = addresses.get(key);
        if (!a) throw new Error('Missing pending entity address');
        if (!a.ordering) touched.set(`${a.owner}:${a.subject}`, a);
      }
      const groups = new Map<Collection, EntityOwnershipDelta[]>();
      const groupOwners = new Map<Collection, number>();
      for (const [prefix, address] of touched) {
        const before = address.collection.__readOwnershipSubject(
          address.subject
        );
        const membership =
          next.get(`${prefix}:@`) ?? ledgers.get(`${prefix}:@`);
        const desired = membership
          ? (winner(membership).value as Placement | null)
          : before;
        const after: Row | null = desired
          ? {
              key: desired.key,
              value: deepClone(before?.value ?? desired.value),
            }
          : null;
        if (!after && membership) {
          const absentFact = winner(membership);
          for (const key of rowFields.get(prefix) ?? []) {
            if (addresses.get(key)?.field === undefined) continue;
            const ledger = next.get(key) ?? ledgers.get(key);
            if (!ledger) continue;
            const surviving = winner(ledger);
            if (
              surviving.order > absentFact.order &&
              surviving.value !== absent
            )
              throw new Error(
                'Surviving field depends on removed entity lifetime'
              );
          }
        }
        if (after) {
          const value = after.value as Record<string, unknown>;
          // Visit only obligations for this touched lifetime, never unrelated rows.
          for (const key of rowFields.get(prefix) ?? []) {
            const a = addresses.get(key);
            if (
              a?.owner !== address.owner ||
              a.subject !== address.subject ||
              a.field === undefined
            )
              continue;
            const l = next.get(key) ?? ledgers.get(key);
            if (!l) continue;
            const v = winner(l).value;
            let target = value;
            for (const segment of a.field.slice(0, -1)) {
              const child = target[segment];
              target = target[segment] = plain(child) ? deepClone(child) : {};
            }
            const field = a.field[a.field.length - 1];
            if (v === absent) delete target[field];
            else target[field] = deepClone(v);
          }
        }
        const topology = before?.key !== after?.key;
        const place = desired as Placement | null;
        const list = groups.get(address.collection) ?? [];
        groups.set(address.collection, list);
        groupOwners.set(address.collection, address.owner);
        list.push({
          subject: address.subject,
          before,
          after,
          beforeSubject: place?.beforeSubject,
          afterSubject: place?.afterSubject,
          rank: 0,
          topology,
          orderChanged: false,
        });
      }
      for (const [key, ledger] of next) {
        const address = addresses.get(key);
        if (!address) throw new Error('Missing pending entity address');
        if (!address.ordering) continue;
        const order = winner(ledger).value as readonly number[];
        const list = groups.get(address.collection) ?? [];
        groups.set(address.collection, list);
        groupOwners.set(address.collection, address.owner);
        const existing = new Map(
          list.map((change) => [change.subject, change])
        );
        const survivors = order.filter((subject) => {
          const change = existing.get(subject);
          return change
            ? change.after
            : address.collection.__readOwnershipSubject(subject);
        });
        // A surviving ordering obligation names every admitted lifetime. A later
        // membership author is reconciled during preparation, not silently dropped.
        for (let rank = 0; rank < survivors.length; rank++) {
          const subject = survivors[rank];
          const old = existing.get(subject);
          const before =
            old?.before ?? address.collection.__readOwnershipSubject(subject);
          const after = old?.after ?? before;
          const change = {
            subject,
            before,
            after,
            beforeSubject: survivors[rank - 1],
            afterSubject: survivors[rank + 1],
            rank,
            topology: true,
            orderChanged: true,
          };
          if (old) list[list.indexOf(old)] = change;
          else list.push(change);
        }
      }
      for (const [collection, changes] of groups) {
        const bySubject = new Map(changes.map((c) => [c.subject, c]));
        // Resolve the historical successor through this settlement's removals.
        // The links come from actual native placement or retained removal facts;
        // no arbitrary neighbor or full-collection reconstruction is substituted.
        const owner = groupOwners.get(collection);
        const successor = (
          subject: number | undefined,
          seen = new Set<number>()
        ): number | undefined => {
          if (subject === undefined) return undefined;
          if (seen.has(subject))
            throw new Error('Cyclic removed entity placement');
          seen.add(subject);
          const change = bySubject.get(subject);
          if (change?.after) return subject;
          const current = collection.__readOwnershipSubject(subject);
          if (!change && current) return subject;
          const ledger =
            owner === undefined
              ? undefined
              : ledgers.get(`${owner}:${subject}:@`);
          const placement =
            current ?? (ledger ? winner(ledger).placement : undefined);
          if (!placement)
            throw new Error('Removed entity anchor has no placement');
          return successor(placement.afterSubject, seen);
        };
        for (let i = 0; i < changes.length; i++) {
          const change = changes[i];
          if (change.topology && change.after) {
            const resolved = {
              ...change,
              afterSubject: successor(change.afterSubject),
            };
            changes[i] = resolved;
            bySubject.set(change.subject, resolved);
          }
        }
        const rank = (
          c: EntityOwnershipDelta,
          seen = new Set<number>()
        ): number => {
          if (seen.has(c.subject)) throw new Error('Cyclic entity placement');
          seen.add(c.subject);
          const successor =
            c.afterSubject === undefined
              ? undefined
              : bySubject.get(c.afterSubject);
          return successor ? rank(successor, seen) - 1 : 0;
        };
        for (let i = 0; i < changes.length; i++)
          changes[i] = { ...changes[i], rank: rank(changes[i]) };
      }
      const prepared = [...groups].map(([collection, changes]) =>
        collection.__prepareOwnershipDelta(changes)
      );
      return {
        changed: next.size > 0,
        install() {
          for (const p of prepared) p.install();
          for (const [key, l] of next) {
            const address = addresses.get(key);
            const membershipKey =
              address && `${address.owner}:${address.subject}:@`;
            const membership =
              membershipKey &&
              (next.get(membershipKey) ?? ledgers.get(membershipKey));
            // Confirmed field truth remains a live existence dependency until
            // membership settles, even when that field was absent at creation.
            if (
              l.pending.size ||
              (address?.field !== undefined &&
                membership &&
                membership.pending.size)
            )
              ledgers.set(key, l);
            else {
              ledgers.delete(key);
              const a = addresses.get(key);
              if (a) {
                const rowKey = `${a.owner}:${a.subject}`,
                  fields = rowFields.get(rowKey);
                fields?.delete(key);
                if (!fields?.size) rowFields.delete(rowKey);
              }
              addresses.delete(key);
            }
          }
          // Release dependency-only field records once their membership obligation
          // ends. Pending field authors remain independently accountable.
          for (const prefix of touched.keys()) {
            if (ledgers.get(`${prefix}:@`)?.pending.size) continue;
            const fields = rowFields.get(prefix);
            for (const key of fields ?? []) {
              if (ledgers.get(key)?.pending.size) continue;
              ledgers.delete(key);
              addresses.delete(key);
              fields?.delete(key);
            }
            if (!fields?.size) rowFields.delete(prefix);
          }
          owners.delete(id);
          for (const subject of claims?.release(claimOwner(id)) ?? [])
            candidates.add(subject);
        },
        invalidate() {
          let failed = false,
            error: unknown;
          for (const p of prepared)
            try {
              p.invalidate();
            } catch (e) {
              if (!failed) {
                failed = true;
                error = e;
              }
            }
          if (failed) throw error;
        },
        publish() {
          let failed = false,
            error: unknown;
          for (const p of prepared)
            try {
              p.publish();
            } catch (e) {
              if (!failed) {
                failed = true;
                error = e;
              }
            }
          if (failed) throw error;
        },
      };
    },
    details(id: number) {
      return [...(owners.get(id) ?? [])].flatMap((key) => {
        const l = ledgers.get(key),
          a = addresses.get(key),
          f = l?.pending.get(id);
        return l && a && f
          ? [
              {
                position: a.owner,
                subject: a.subject < 0 ? undefined : a.subject,
                addressSuffix:
                  f.addressKey === undefined
                    ? undefined
                    : [f.addressKey, ...(a.field ?? [])],
                field: a.field,
                status:
                  winner(l) === f
                    ? ('current' as const)
                    : ('superseded' as const),
              },
            ]
          : [];
      });
    },
    maintain,
    count: () => ledgers.size,
    destroy() {
      destroyed = true;
      for (const id of owners.keys()) claims?.release(claimOwner(id));
      candidates.clear();
      if (runtime?.prepareEntityResponsibility === capture)
        runtime.prepareEntityResponsibility = previous;
      ledgers.clear();
      rowFields.clear();
      addresses.clear();
      owners.clear();
      collections.clear();
    },
  };
}
