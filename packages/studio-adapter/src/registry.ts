import { captureBoundedValue } from './realization/bounded-value';
import { type CurrentValueEntry } from './realization/current-value';
import { type StudioTreeId, type StudioTurn } from '@signal-tree/studio-query';

import { type StudioCapability } from './capabilities';
import { type StudioResult } from './errors';
import { type ConfirmedTurnReader, type KernelRetention, type KernelConfirmedTurn, type KernelTurnEffect } from './kernel-contract';
import { toStudioTurn } from './normalize';
import { type StudioTreeId as _StudioTreeId } from '@signal-tree/studio-query';

export interface StudioBridgeTree {
  readonly id: StudioTreeId;
  readonly label?: string;
  readonly capabilities: readonly StudioCapability[];
}

export type TransactionOmissionReason='value-budget'|'history-budget'|'unsupported-value'|'metadata-budget';
export interface StudioTransactionRetention extends KernelRetention {
  readonly omittedTransactions?:number;
  readonly omissionReasons?:readonly TransactionOmissionReason[];
  readonly retainedTurnIds?:readonly number[];
  readonly observedTurnIds?:readonly number[];
  readonly retainedBytes?:number;
  readonly maxBytes?:number;
}
export interface ConfirmedTurnsResponse {
  readonly treeId: StudioTreeId;
  readonly retention: StudioTransactionRetention;
  readonly turns: readonly StudioTurn[];
}

interface Attachment {
  readonly observeChanges?: (notify: () => void) => () => void;
  readonly studioTreeId: StudioTreeId;
  readonly label?: string;
  /** `undefined` when the tree has no transactions() enhancer. */
  readonly reader: ConfirmedTurnReader | undefined;
  readonly capabilities: readonly StudioCapability[];
  /** S2 hooks. Absent for a probe-injected attachment in tests. */
  readonly structure?: { readonly capabilities: readonly string[] | undefined };
  readonly createCaptureTarget?: () => unknown;
  readonly readCurrentValue?: (path: string) => unknown;
  readonly readCurrentValues?: (paths: readonly string[]) => readonly CurrentValueEntry[];
  readonly readStateShape?: (options: { maxDepth?: number; maxKeys?: number }) => unknown;
}

export interface StudioRegistry {
  add(runtimeTreeId: unknown, attachment: Omit<Attachment, 'studioTreeId'>): StudioTreeId;
  /** The attachment record, for S2 bridge commands. Never creates. */
  attachment(treeId: StudioTreeId): Attachment | undefined;
  remove(studioTreeId: StudioTreeId): void;
  listTrees(): readonly StudioBridgeTree[];
  readConfirmedTurns(treeId: StudioTreeId, maxTurns?: number, excludedIds?:ReadonlySet<number>): StudioResult<ConfirmedTurnsResponse>;
  size(): number;
}

/**
 * Session id allocation, deliberately OUTSIDE the registry's lifetime.
 *
 * ⚠️ THESE TWO RULES CONFLICT IF THE COUNTER LIVES IN THE REGISTRY, and a test
 * caught it: dropping the registry on the last detach would reset numbering, so
 * a later tree would be handed `tree-0001` again. A panel still holding that id
 * would then silently read a DIFFERENT tree's history — the exact
 * cross-tree confusion `effectKey` and C11 exist to prevent, arriving through
 * the front door.
 *
 * Recycling is the dangerous half, so the counter survives registry drops. It
 * is a monotonic integer, not a reference: it pins no tree, no reader and no
 * DOM, so "release all Studio references" still holds exactly.
 */
let nextTreeOrdinal = 1;

/** Clone before normalization/codec. Never turn an omitted value into application data.
 * Newest source records get first use of the conservative 2 MiB inspection budget.
 * Failed attempts consume their allowance too, bounding clone work as well as output.
 * The kernel reader's own snapshot materialization remains outside this budget.
 */
function boundedTransactions(treeId:StudioTreeId,window:readonly KernelConfirmedTurn[]):{turns:StudioTurn[];retention:StudioTransactionRetention}{
 const maxBytes=2*1024*1024,perValue=64*1024;
 let remaining=maxBytes,retainedBytes=0,omittedTransactions=0;
 const turns:StudioTurn[]=[],reasons=new Set<TransactionOmissionReason>();
 for(let index=window.length-1;index>=0;index--){
  const turn=window[index]!;
  let cost=0,reason:TransactionOmissionReason|undefined;
  const charge=(bytes:number):boolean=>{if(bytes>remaining){reason='history-budget';return false;}remaining-=bytes;cost+=bytes;return true;};
  const clone=(value:unknown):{ok:true;value:unknown}|{ok:false}=>{
   if(remaining<32){reason='history-budget';return {ok:false};}
   const allowance=Math.min(perValue,remaining),result=captureBoundedValue(value,allowance);
   if(result.value.kind!=='value'){
    remaining-=allowance;
    reason=result.value.valueType==='capture-budget' ? allowance<perValue?'history-budget':'value-budget':'unsupported-value';
    return {ok:false};
   }
   if(!charge(result.bytes))return {ok:false};
   return {ok:true,value:result.value.value};
  };
  if(!charge(128)){omittedTransactions++;reasons.add(reason!);continue;}
  if(turn.effects.length>2048 || turn.positions.length>2048){omittedTransactions++;reasons.add('metadata-budget');continue;}
  const positions=clone(turn.positions);
  const effects:KernelTurnEffect[]=[];
  if(positions.ok)for(const effect of turn.effects){
   if(effect.path.length>2048 || effect.ownerPath.length>2048){reason='metadata-budget';break;}
   if(!charge(256+(effect.path.length+effect.ownerPath.length)*2))break;
   const before=clone(effect.before);if(!before.ok)break;
   const after=clone(effect.after);if(!after.ok)break;
   const subject=clone(effect.subject);if(!subject.ok)break;
   effects.push({position:effect.position,path:effect.path,ownerPath:effect.ownerPath,kind:effect.kind,before:before.value,after:after.value,subject:subject.value});
  }
  if(reason || !positions.ok){omittedTransactions++;reasons.add(reason ?? 'metadata-budget');continue;}
  turns.push(toStudioTurn(treeId,{id:turn.id,positions:positions.value as readonly number[],effects}));retainedBytes+=cost;
 }
 turns.reverse();
 return {turns,retention:{truncated:omittedTransactions>0,omittedTransactions,omissionReasons:[...reasons],retainedTurnIds:turns.map(turn=>turn.id),retainedBytes,maxBytes}};
}

function createRegistry(): StudioRegistry {
  const attachments = new Map<StudioTreeId, Attachment>();
  // Runtime identity -> session id, for THIS registry's lifetime. Keyed by the
  // opaque runtime value, which is the one use its contract permits.
  const assigned = new Map<unknown, StudioTreeId>();

  return {
    add(runtimeTreeId, attachment) {
      const studioTreeId =
        assigned.get(runtimeTreeId) ??
        `tree-${String(nextTreeOrdinal++).padStart(4, '0')}`;
      assigned.set(runtimeTreeId, studioTreeId);
      attachments.set(studioTreeId, { ...attachment, studioTreeId });
      notifyRegistryChanged();
      return studioTreeId;
    },

    attachment(treeId) {
      return attachments.get(treeId);
    },

    remove(studioTreeId) {
      attachments.delete(studioTreeId);
      notifyRegistryChanged();
      for (const [runtime, id] of assigned) {
        if (id === studioTreeId) {
          // Drop the runtime->session mapping too, so a rebuilt tree is a new
          // tree rather than inheriting a retired id.
          assigned.delete(runtime);
        }
      }
    },

    listTrees() {
      return [...attachments.values()].map((a) => ({
        id: a.studioTreeId,
        label: a.label,
        capabilities: a.capabilities,
      }));
    },

    readConfirmedTurns(treeId, maxTurns, excludedIds) {
      if (maxTurns !== undefined && (!Number.isSafeInteger(maxTurns) || maxTurns < 1 || maxTurns > 500)) {
        return { ok: false, error: { code: 'STUDIO_INVALID_LIMIT' } };
      }
      const attachment = attachments.get(treeId);
      if (!attachment) {
        // Never existed, or its attachment was removed — including by destroy
        // eviction, which is why DESTROYED rarely reaches a caller here.
        return { ok: false, error: { code: 'STUDIO_TREE_NOT_FOUND' } };
      }

      if (!attachment.reader) {
        // The tree is attached and inspectable; it simply cannot answer THIS
        // question. Refuse structurally rather than returning an empty list,
        // which would read as "this transaction history is empty".
        return {
          ok: false,
          error: {
            code: 'STUDIO_CAPABILITY_UNAVAILABLE',
            capability: 'committed-transactions',
          },
        };
      }

      let snapshot;
      try {
        snapshot = attachment.reader.readConfirmedTurns();
      } catch (cause) {
        // The reader observed destruction while the attachment was still live.
        if ((cause as { code?: string })?.code === 'STUDIO_TREE_DESTROYED') {
          return { ok: false, error: { code: 'STUDIO_TREE_DESTROYED' } };
        }
        throw cause;
      }

      const window = maxTurns === undefined ? snapshot.turns : snapshot.turns.slice(-maxTurns);
      if(maxTurns !== undefined){
        const bounded=boundedTransactions(treeId,window.filter(turn=>!excludedIds?.has(turn.id)));
        return {ok:true,value:{treeId,turns:bounded.turns,retention:{
          ...snapshot.retention,...bounded.retention,
          truncated:snapshot.retention.truncated || window.length<snapshot.turns.length || bounded.retention.omittedTransactions!>0 || !!excludedIds,
          firstAvailableTurnId:bounded.turns[0]?.id,
          observedTurnIds:window.map(turn=>turn.id),
        }}};
      }
      // Legacy internal readers preserve their original contract. The Studio
      // bridge always supplies maxTurns and therefore always takes the budgeted path.
      return {ok:true,value:{treeId,retention:snapshot.retention,turns:window.map(turn=>toStudioTurn(treeId,turn))}};
    },

    size() {
      return attachments.size;
    },
  };
}

/**
 * ⚠️ LAZY BY CONTRACT, NOT BY HABIT. Importing `@signal-tree/studio-adapter`
 * must create nothing: a module-level registry would put Studio state into
 * every bundle that so much as imports the package, and the "absent in
 * production" boundary is what makes the whole bridge defensible.
 *
 * Created on the FIRST attachment, dropped with the LAST detachment.
 */
let active: StudioRegistry | undefined;

export function registryForAttach(): StudioRegistry {
  return (active ??= createRegistry());
}

/** The live registry, or `undefined` when nothing is attached. Never creates. */
export function peekRegistry(): StudioRegistry | undefined {
  return active;
}

export function dropRegistryIfEmpty(): void {
  if (active && active.size() === 0) {
    active = undefined;
  }
}

// Subscriptions belong to connected bridges, not to registry instances: the
// last detach may drop the registry before a later attachment creates another.
let registryListeners: Set<() => void> | undefined;
export function observeRegistryChanges(listener: () => void): () => void {
  (registryListeners ??= new Set()).add(listener);
  return () => {
    registryListeners?.delete(listener);
    if (registryListeners?.size === 0) registryListeners = undefined;
  };
}
function notifyRegistryChanged(): void {
  for (const listener of registryListeners ?? []) listener();
}
