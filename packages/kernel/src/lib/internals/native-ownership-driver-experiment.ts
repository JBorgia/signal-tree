import { holdEntityMembershipDelivery } from './entity-membership-source';
import { nativeEntityOwnership } from './native-entity-ownership-experiment';
import { getPhysicalCommitClock } from './physical-commit-clock';
import { publishingExposedOnly } from './exposed-publication';
import { markOwnerInvalidatedFrom } from './owner-invalidation-port';
import { SignalTreeRollbackError } from '../types';
import {
  attachPreparation,
  detachPreparation,
  type Installation,
} from './native-ownership-experiment';
import { getTreeScalarSlotRuntime } from './tree-scalar-slot-port';
import { isNodeAccessor, nodeStoreOf } from './node-shape';
import { storedReads } from './member-membership';
import { getOwnedPositionIds } from './owned-metadata';
import { isWritableLocation } from './location-runtime';
import {
  preparePlainBranchMembers,
  registerPlainBranchMemberAddress,
} from './plain-branch-membership';
import { unwrapBranchForWriteCapture } from '../utils';
import { withWriteContext, getActiveWriteContext } from '../write-context';

type Fact = { value: unknown; order: number; diagnostic?: boolean };
type Ledger = { base: Fact; contributions: Map<number, Fact> };
type Address = { branch: object; key: string; ancestors: readonly string[] };
type Scalar = { position: number; ancestors: readonly string[] };
/** Bounded internal experiment; native values are the only committed store. */
export function nativeOwnershipExperiment(root: object) {
  const runtime = getTreeScalarSlotRuntime(root);
  if (!runtime) throw new Error('Missing native scalar runtime');
  const ledgers = new Map<string, Ledger>();
  const members = new Map<string, Address>();
  const scalars = new Map<number, Scalar>();
  const attached: object[] = [];
  const branches = new WeakSet<object>();
  let order = 0,
    owner = 0,
    branch = 0,
    revision = 0;
  let active: number | undefined;
  let installing = false;
  let fault: { error: unknown; after: number } | undefined;
  const owners = new Map<number, Set<string>>();
  const terminalListeners = new Map<number, (accepted: boolean) => void>();
  let destroyed = false;

  const hook = (
    target: object,
    prefix: string,
    parentAncestors: readonly string[] = [],
    branchNode?: object
  ) => {
    attached.push(target);
    attachPreparation(target, (changes: readonly Installation[]) => {
      if (installing) return;
      if (fault && --fault.after <= 0) {
        const { error } = fault;
        fault = undefined;
        throw error;
      }
      const preparedRevision = revision;
      const author = active;
      const authoredOrder = ++order;
      const inputs = new Map<
        string,
        { before: unknown; after: unknown; diagnostic?: boolean }
      >();
      for (const change of changes) {
        const key = prefix + change.key;
        inputs.set(key, { ...change, diagnostic: true });
        const ancestors = branchNode
          ? parentAncestors
          : scalars.get(Number(change.key))?.ancestors ?? [];
        // A newer surviving descendant write requires its enclosing membership.
        // Only pending presence obligations need a contribution; no canonical mirror.
        for (const ancestor of ancestors)
          if (ledgers.has(ancestor) && !inputs.has(ancestor))
            inputs.set(ancestor, {
              before: true,
              after: true,
              diagnostic: false,
            });
      }
      const plans = [...inputs].map(([key, change]) => {
        const old = ledgers.get(key);
        const next: Ledger = old
          ? { base: old.base, contributions: new Map(old.contributions) }
          : {
              base: { value: change.before, order: 0 },
              contributions: new Map(),
            };
        const fact = {
          value: change.after,
          order: authoredOrder,
          diagnostic: change.diagnostic,
        };
        if (author !== undefined) next.contributions.set(author, fact);
        else next.base = fact;
        return { key, next };
      });
      return {
        validate() {
          if (revision !== preparedRevision || active !== author)
            throw new Error('Native ownership preparation became stale');
        },
        install() {
          if (installing) return;
          for (const p of plans) {
            if (p.next.contributions.size) {
              ledgers.set(p.key, p.next);
              if (author !== undefined) owners.get(author)!.add(p.key);
            } else ledgers.delete(p.key);
          }
          revision++;
          // Construction may have introduced new descendants. Bind their known
          // physical addresses before the construction operation publishes.
          if (branchNode)
            for (const change of changes) {
              members.set(prefix + change.key, {
                branch: branchNode,
                key: String(change.key),
                ancestors: parentAncestors,
              });
              const child = Object.getOwnPropertyDescriptor(
                branchNode,
                String(change.key)
              )?.value;
              if (isNodeAccessor(child) || isWritableLocation(child))
                registerPlainBranchMemberAddress(
                  branchNode,
                  String(change.key),
                  child
                );
              register(child, [...parentAncestors, prefix + change.key]);
            }
        },
      };
    });
  };
  const register = (node: unknown, ancestors: readonly string[]) => {
    if (isWritableLocation(node)) {
      const position = getOwnedPositionIds(node)?.[0];
      const slot =
        position === undefined
          ? undefined
          : runtime.resolveScalarSlot(position);
      if (position !== undefined && slot !== undefined)
        scalars.set(slot, { position, ancestors });
      return;
    }
    if (!isNodeAccessor(node) || branches.has(node)) return;
    branches.add(node);
    const prefix = `p${++branch}:`;
    hook(node, prefix, ancestors, node);
    const store = nodeStoreOf(node);
    if (store) hook(store, prefix, ancestors, node);
    for (const key of Object.getOwnPropertyNames(node)) {
      const child = Object.getOwnPropertyDescriptor(node, key)?.value;
      if (!isNodeAccessor(child) && !isWritableLocation(child)) continue;
      registerPlainBranchMemberAddress(node, key, child);
      members.set(prefix + key, { branch: node, key, ancestors });
      register(child, [...ancestors, prefix + key]);
    }
  };
  hook(runtime, 's:');
  register(root, []);
  const entities = nativeEntityOwnership(
    root,
    () => active,
    () => {
      if (fault && --fault.after <= 0) {
        const error = fault.error;
        fault = undefined;
        throw error;
      }
    },
    () => installing
  );
  const settle = (id: number, accept: boolean) => {
    if (destroyed) throw new Error('Cannot settle a destroyed tree');
    const owned = owners.get(id);
    if (!owned) return;
    if (fault) {
      const { error } = fault;
      fault = undefined;
      throw error;
    }
    const baseRevision = revision;
    const physicalRevision = getPhysicalCommitClock(root)?.revision();
    const plans: { key: string; next: Ledger }[] = [];
    const presence = new Map<
      number,
      { present: boolean; value: unknown; turn: number; presenceOnly: true }
    >();
    const values: { owner: number; after: unknown; turn: number }[] = [];
    for (const key of owned) {
      const old = ledgers.get(key)!;
      const contribution = old.contributions.get(id);
      if (!contribution) continue;
      const next = {
        base:
          accept && contribution.order > old.base.order
            ? contribution
            : old.base,
        contributions: new Map(old.contributions),
      };
      next.contributions.delete(id);
      let visible = next.base;
      for (const c of next.contributions.values())
        if (c.order > visible.order) visible = c;
      plans.push({ key, next });
      if (key.startsWith('s:')) {
        const address = scalars.get(Number(key.slice(2)));
        if (!address)
          throw new Error('Unknown native scalar ownership address');
        values.push({
          owner: address.position,
          after: visible.value,
          turn: visible.order,
        });
      } else {
        const address = members.get(key)!;
        const child = Object.getOwnPropertyDescriptor(
          address.branch,
          address.key
        )?.value;
        const position = getOwnedPositionIds(child)?.[0];
        if (position === undefined)
          throw new Error('Unknown native member ownership address');
        let value: unknown;
        if (visible.value) {
          storedReads.depth++;
          try {
            value = unwrapBranchForWriteCapture(child);
          } finally {
            storedReads.depth--;
          }
        }
        presence.set(position, {
          present: Boolean(visible.value),
          value,
          turn: visible.order,
          presenceOnly: true,
        });
      }
    }
    // Reuse the production mixed-target preparation and realized publication.
    // Preparation may compare user values, so no native state or owner is retired yet.
    const prepared = preparePlainBranchMembers(root, presence, values);
    const entityPrepared = entities.prepare(id, accept);
    if (
      revision !== baseRevision ||
      getPhysicalCommitClock(root)?.revision() !== physicalRevision
    )
      throw new Error('Settlement preparation reentered native ownership');
    const releaseMembership = holdEntityMembershipDelivery(root);
    let failed = false,
      firstError: unknown;
    try {
      runtime.runInvalidationGroup(() => {
        installing = true;
        try {
          prepared.install();
          entityPrepared.install();
        } finally {
          installing = false;
        }
        // Shared target preparation deliberately leaves the physical clock to
        // its coordinator. Invalidate pre-settlement frames before any delivery.
        if (plans.length || entityPrepared.changed)
          getPhysicalCommitClock(root)?.advance();
        for (const p of plans) {
          if (p.next.contributions.size) ledgers.set(p.key, p.next);
          else ledgers.delete(p.key);
        }
        owners.delete(id);
        revision++;
        const terminal = terminalListeners.get(id);
        terminalListeners.delete(id);
        let terminalFailed = false;
        let terminalError: unknown;
        try {
          entityPrepared.invalidate();
        } catch (error) {
          terminalFailed = true;
          terminalError = error;
        }
        try {
          terminal?.(accept);
        } catch (error) {
          if (!terminalFailed) {
            terminalFailed = true;
            terminalError = error;
          }
        }
        // All admitted native state and ownership terminality precede delivery.
        // Do not suppress ownership capture while observers author newer writes.
        try {
          withWriteContext(
            {
              ...getActiveWriteContext(),
              origin: accept
                ? getActiveWriteContext()?.origin
                : 'transaction-rollback',
              intent: 'system',
              participation: 'realized',
            },
            () => {
              try {
                const deliver = (fn: () => void) => {
                  try {
                    fn();
                  } catch (error) {
                    if (!terminalFailed) {
                      terminalFailed = true;
                      terminalError = error;
                    }
                  }
                };
                deliver(() => entityPrepared.publish());
                deliver(() =>
                  publishingExposedOnly(root, () => prepared.publish())
                );
              } finally {
                if (plans.length || entityPrepared.changed)
                  markOwnerInvalidatedFrom(root);
              }
            }
          );
        } catch (error) {
          if (!terminalFailed) {
            terminalFailed = true;
            terminalError = error;
          }
        }
        if (terminalFailed) throw terminalError;
      });
    } catch (error) {
      failed = true;
      firstError = error;
    } finally {
      try {
        releaseMembership();
      } catch (error) {
        if (!failed) {
          failed = true;
          firstError = error;
        }
      }
    }
    if (failed) throw firstError;
  };
  const open = () => {
    if (destroyed) throw new Error('Cannot transact on a destroyed tree');
    const id = ++owner;
    owners.set(id, new Set());
    return {
      id,
      pending: () => owners.has(id),
      run(fn: () => void) {
        if (destroyed || !owners.has(id))
          throw new Error('Cannot write through an inactive ownership scope');
        const previous = active;
        active = id;
        try {
          fn();
        } finally {
          active = previous;
        }
      },
      onInstalled(listener: (accepted: boolean) => void) {
        terminalListeners.set(id, listener);
      },
      rollback: () => settle(id, false),
      confirm: () => settle(id, true),
      inspect: () => ({ changes: [...(owners.get(id) ?? [])] }),
      details() {
        const scalarDetails = [...(owners.get(id) ?? [])].flatMap((key) => {
          const ledger = ledgers.get(key);
          const contribution = ledger?.contributions.get(id);
          if (!ledger || !contribution || contribution.diagnostic === false)
            return [];
          let visible = ledger.base;
          for (const fact of ledger.contributions.values())
            if (fact.order > visible.order) visible = fact;
          const scalar = key.startsWith('s:');
          const member = members.get(key);
          const position = scalar
            ? scalars.get(Number(key.slice(2)))?.position
            : getOwnedPositionIds(
                member &&
                  Object.getOwnPropertyDescriptor(member.branch, member.key)
                    ?.value
              )?.[0];
          const current = scalar
            ? visible === contribution
            : visible.value === contribution.value;
          return [
            {
              position,
              subject: undefined as number | undefined,
              field: undefined as string | undefined,
              status: current ? ('current' as const) : ('superseded' as const),
            },
          ];
        });
        return [...scalarDetails, ...entities.details(id)];
      },
    };
  };
  return {
    maintain: () => entities.maintain(),
    open,
    begin(fn: () => void) {
      const handle = open();
      const id = handle.id;
      try {
        handle.run(fn);
      } catch (callbackError) {
        try {
          settle(id, false);
        } catch (cause) {
          if (!owners.has(id)) {
            try {
              console.error(
                'SignalTree: experimental rollback delivery after failed callback.',
                cause
              );
            } catch {
              /* reporting cannot replace the callback failure */
            }
            throw callbackError;
          }
          const error = new SignalTreeRollbackError(undefined, { cause });
          Object.defineProperty(error, 'recovery', {
            value: { transaction: handle, callbackFailed: true, callbackError },
          });
          throw error;
        }
        throw callbackError;
      }
      return handle;
    },
    fail(error: unknown, after = 1) {
      fault = { error, after };
    },
    stats() {
      return { pending: owners.size, ledgers: ledgers.size + entities.count() };
    },
    destroy() {
      destroyed = true;
      terminalListeners.clear();
      entities.destroy();
      for (const target of attached) detachPreparation(target);
      owners.clear();
      ledgers.clear();
      members.clear();
      scalars.clear();
    },
  };
}
