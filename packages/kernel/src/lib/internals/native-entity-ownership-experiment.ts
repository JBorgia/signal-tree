import { isTraversableNode } from './node-shape';
import {
  admitNativeOrder,
  settleNativeOrder,
  projectNativeOrder,
  nativeOrderRequires,
  retainNativeOrder,
  nativeOrderDetails,
  type NativeOrderAdmission,
} from './native-order-admission-experiment';
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
  const orderAdmissions = new Map<number, NativeOrderAdmission>();
  const orderOwners = new Map<number, Set<number>>();
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
    const staged = new Map<string, Ledger>();
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
      staged.set(key, next);
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
    const deletes: NonNullable<TerminalRecordPlan['deletes']>[number][] = [];
    if (capture.ordering) {
      const admission = admitNativeOrder(
        orderAdmissions.get(capture.owner),
        collection.__readOwnershipOrder(),
        capture.ordering,
        id,
        order
      );
      if (
        retainNativeOrder(admission, (subject) =>
          Boolean(
            (
              staged.get(`${capture.owner}:${subject}:@`) ??
              ledgers.get(`${capture.owner}:${subject}:@`)
            )?.pending.size
          )
        )
      ) {
        writes.push({
          map: orderAdmissions as Map<unknown, unknown>,
          key: capture.owner,
          value: admission,
        });
        if (id !== undefined)
          keyedAdds.push({
            map: orderOwners as Map<unknown, Set<unknown>>,
            key: id,
            prepared: (orderOwners.get(id) ??
              new Set<number>()) as Set<unknown>,
            value: capture.owner,
          });
      } else if (orderAdmissions.has(capture.owner)) {
        // Not retaining the replacement must retire its predecessor atomically;
        // leaving it installed lets later membership settlement resurrect it.
        deletes.push({
          map: orderAdmissions as Map<unknown, unknown>,
          key: capture.owner,
        });
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
    return { writes, adds, keyedAdds, deletes };
  };
  if (runtime) runtime.prepareEntityResponsibility = capture;
  return {
    prepare(id: number, accept: boolean) {
      const owned = owners.get(id) ?? new Set<string>();
      const next = new Map<string, Ledger>();
      const touched = new Map<string, Address>();
      const nextOrders = new Map<number, NativeOrderAdmission>();
      for (const owner of orderOwners.get(id) ?? []) {
        const old = orderAdmissions.get(owner);
        if (old) nextOrders.set(owner, settleNativeOrder(old, id, accept));
      }
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
        touched.set(`${a.owner}:${a.subject}`, a);
        if (a.field === undefined && !nextOrders.has(a.owner)) {
          const ordering = orderAdmissions.get(a.owner);
          if (ordering) nextOrders.set(a.owner, ordering);
        }
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
          // A pending removal can be rejected. Check the earliest applicable
          // absence as well as the visible absence before retiring a creator.
          const absentFact = [membership.base, ...membership.pending.values()]
            .filter(
              (fact) =>
                fact.value === null && fact.order >= membership.base.order
            )
            .reduce(
              (earliest, fact) =>
                fact.order < earliest.order ? fact : earliest,
              winner(membership)
            );
          const ordering =
            nextOrders.get(address.owner) ?? orderAdmissions.get(address.owner);
          if (
            ordering &&
            nativeOrderRequires(ordering, address.subject, absentFact.order)
          )
            throw new Error(
              'Surviving order depends on removed entity lifetime'
            );
          for (const key of rowFields.get(prefix) ?? []) {
            if (addresses.get(key)?.field === undefined) continue;
            const ledger = next.get(key) ?? ledgers.get(key);
            if (!ledger) continue;
            const surviving = [ledger.base, ...ledger.pending.values()].filter(
              (fact) => fact.order >= ledger.base.order
            );
            if (
              surviving.some(
                (fact) => fact.order > absentFact.order && fact.value !== absent
              )
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
      for (const [owner, admission] of nextOrders) {
        const collection = collections.get(owner);
        if (!collection) throw new Error('Missing pending order collection');
        const order = projectNativeOrder(admission);
        const list = groups.get(collection) ?? [];
        groups.set(collection, list);
        groupOwners.set(collection, owner);
        const existing = new Map(
          list.map((change) => [change.subject, change])
        );
        const survivors = order.filter((subject) => {
          const change = existing.get(subject);
          return change
            ? change.after
            : collection.__readOwnershipSubject(subject);
        });
        // A surviving key/membership can keep a subject outside the rejected
        // order's inverse baseline. Preserve its observed placement during target
        // preparation; this does not admit a new order fact or dependency.
        const selected = new Set(survivors);
        const observed = collection.__readOwnershipOrder();
        let successor: number | undefined;
        for (let index = observed.length - 1; index >= 0; index--) {
          const subject = observed[index];
          const change = existing.get(subject);
          if (change && !change.after) continue;
          if (!selected.has(subject)) {
            const rank =
              successor === undefined
                ? survivors.length
                : survivors.indexOf(successor);
            survivors.splice(rank, 0, subject);
            selected.add(subject);
          }
          successor = subject;
        }
        for (let rank = 0; rank < survivors.length; rank++) {
          const subject = survivors[rank];
          const old = existing.get(subject);
          const before =
            old?.before ?? collection.__readOwnershipSubject(subject);
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
        const owner = groupOwners.get(collection);
        // Only a removal in this target proves a chain through an unavailable
        // anchor. An independently absent lifetime is not a chain or a tail.
        const removedPlacement = (
          subject: number,
          current: Placement | null
        ) => {
          const ledger =
            owner === undefined
              ? undefined
              : ledgers.get(`${owner}:${subject}:@`);
          const placement =
            current ?? (ledger ? winner(ledger).placement : undefined);
          if (!placement)
            throw new Error('Removed entity anchor has no placement');
          return placement;
        };
        type Successor =
          | { available: true; subject: number | undefined }
          | { available: false };
        const successor = (
          subject: number | undefined,
          seen = new Set<number>()
        ): Successor => {
          if (subject === undefined)
            return { available: true, subject: undefined };
          if (seen.has(subject))
            throw new Error('Cyclic removed entity placement');
          seen.add(subject);
          const change = bySubject.get(subject);
          if (change?.after) return { available: true, subject };
          const current = collection.__readOwnershipSubject(subject);
          if (!change)
            return current
              ? { available: true, subject }
              : { available: false };
          return successor(
            removedPlacement(subject, current).afterSubject,
            seen
          );
        };
        const predecessor = (
          subject: number | undefined,
          seen = new Set<number>()
        ): number | undefined => {
          if (subject === undefined) return undefined;
          if (seen.has(subject))
            throw new Error('Cyclic removed entity predecessor');
          seen.add(subject);
          const change = bySubject.get(subject);
          if (change?.after) return subject;
          const current = collection.__readOwnershipSubject(subject);
          if (!change) return current ? subject : undefined;
          return predecessor(
            removedPlacement(subject, current).beforeSubject,
            seen
          );
        };
        const resolved = new Map<number, number | undefined>();
        const resolving = new Set<number>();
        const resolve = (change: EntityOwnershipDelta): number | undefined => {
          if (resolved.has(change.subject)) return resolved.get(change.subject);
          if (resolving.has(change.subject))
            throw new Error('Cyclic entity predecessor placement');
          resolving.add(change.subject);
          let next: number | undefined;
          const forward =
            change.afterSubject === undefined
              ? undefined
              : successor(change.afterSubject);
          if (forward?.available) next = forward.subject;
          else if (change.orderChanged && change.afterSubject === undefined) {
            // A complete prepared order proves its final subject is the tail;
            // this is distinct from an inverse that merely observed a tail.
            next = undefined;
          } else if (change.beforeSubject !== undefined) {
            const previous = predecessor(change.beforeSubject);
            if (previous === undefined)
              throw new Error('Original entity placement anchors unavailable');
            if (previous === change.subject)
              throw new Error('Self entity predecessor');
            const target = bySubject.get(previous);
            const current = collection.__readOwnershipSubject(previous);
            if (target?.after && target.topology) {
              next = resolve(target);
              // A target predecessor may already name this row. Its current
              // physical successor supplies the remaining proof when available.
              if (next === change.subject) {
                if (!current)
                  throw new Error('Entity predecessor placement is unproved');
                const physical = successor(current.afterSubject);
                if (!physical.available)
                  throw new Error(
                    'Current entity predecessor successor unavailable'
                  );
                next = physical.subject;
              }
              resolved.set(previous, change.subject);
            } else {
              if (!current)
                throw new Error('Current entity predecessor unavailable');
              const physical = successor(current.afterSubject);
              if (!physical.available)
                throw new Error(
                  'Current entity predecessor successor unavailable'
                );
              next = physical.subject;
            }
            if (next === change.subject) {
              const currentSelf = collection.__readOwnershipSubject(
                change.subject
              );
              if (!currentSelf) throw new Error('Self entity successor');
              const following = successor(currentSelf.afterSubject);
              if (!following.available)
                throw new Error('Current entity successor unavailable');
              next = following.subject;
            }
          } else if (change.afterSubject !== undefined) {
            throw new Error('Original entity placement anchors unavailable');
          }
          // Both original anchors absent is the explicit neighborless case.
          if (next === change.subject) throw new Error('Self entity successor');
          resolving.delete(change.subject);
          resolved.set(change.subject, next);
          return next;
        };
        for (const change of changes)
          if (change.topology && change.after) resolve(change);
        for (let i = 0; i < changes.length; i++) {
          const change = changes[i];
          if (change.topology && change.after) {
            changes[i] = {
              ...change,
              afterSubject: resolved.get(change.subject),
            };
            bySubject.set(change.subject, changes[i]);
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
        changed: next.size > 0 || nextOrders.size > 0,
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
          for (const [owner, admission] of nextOrders) {
            if (
              retainNativeOrder(admission, (subject) =>
                Boolean(ledgers.get(`${owner}:${subject}:@`)?.pending.size)
              )
            )
              orderAdmissions.set(owner, admission);
            else orderAdmissions.delete(owner);
          }
          orderOwners.delete(id);
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
      const orderDetails = [...(orderOwners.get(id) ?? [])].flatMap((owner) => {
        const admission = orderAdmissions.get(owner);
        const status = admission && nativeOrderDetails(admission, id);
        return status
          ? [
              {
                position: owner,
                subject: undefined,
                addressSuffix: undefined,
                field: undefined,
                status,
              },
            ]
          : [];
      });
      return [
        ...orderDetails,
        ...[...(owners.get(id) ?? [])].flatMap((key) => {
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
        }),
      ];
    },
    maintain,
    count: () => ledgers.size + orderAdmissions.size,
    destroy() {
      destroyed = true;
      for (const id of new Set([...owners.keys(), ...orderOwners.keys()]))
        claims?.release(claimOwner(id));
      candidates.clear();
      if (runtime?.prepareEntityResponsibility === capture)
        runtime.prepareEntityResponsibility = previous;
      ledgers.clear();
      orderAdmissions.clear();
      orderOwners.clear();
      rowFields.clear();
      addresses.clear();
      owners.clear();
      collections.clear();
    },
  };
}
