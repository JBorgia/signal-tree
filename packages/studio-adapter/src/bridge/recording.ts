import { observeRegistryChanges, peekRegistry, type ConfirmedTurnsResponse } from '../registry';
import { peekCapture, startRealizationCapture, type CaptureTarget, type RealizationLease } from '../realization/lease';
import { realizationSupport } from '../realization/support';

// Connected inspection owns automatic retention, not attachment or import.
// All panels share the same tree recorder; last disconnect releases only leases
// created by this bridge, leaving independently requested instrumentation alone.
let clients = 0;
let stopRegistry: (() => void) | undefined;
const owned = new Map<string, RealizationLease>();
const pausedTurns = new Map<string, ConfirmedTurnsResponse>();
const clearedIds = new Map<string, Set<number>>();
const epochs = new Map<string, number>();

function reconcile(): void {
  const registry = peekRegistry();
  for (const [id, lease] of owned) {
    if (!registry?.attachment(id)) {
      lease.dispose(); owned.delete(id); pausedTurns.delete(id);
      clearedIds.delete(id); epochs.delete(id);
    }
  }
  for (const tree of registry?.listTrees() ?? []) {
    if (peekCapture(tree.id)) continue;
    const attachment = registry?.attachment(tree.id);
    if (realizationSupport({capabilities:attachment?.structure?.capabilities}).state === 'unsupported') continue;
    const target = attachment?.createCaptureTarget?.() as CaptureTarget | undefined;
    if (!target) continue;
    owned.set(tree.id, startRealizationCapture({...target, treeId:tree.id}));
  }
}

export function acquireStudioRecording(): () => void {
  if (clients++ === 0) stopRegistry = observeRegistryChanges(reconcile);
  reconcile();
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    if (--clients !== 0) return;
    stopRegistry?.(); stopRegistry = undefined;
    for (const lease of owned.values()) lease.dispose();
    owned.clear(); pausedTurns.clear(); clearedIds.clear(); epochs.clear();
  };
}

export function studioHistoryEpoch(treeId: string): number { return epochs.get(treeId) ?? 0; }

/** Query retained kernel transactions; never build a second running history. */
export function readStudioTurns(treeId: string) {
  const frozen = pausedTurns.get(treeId);
  if (frozen) return {ok:true as const, value:frozen};
  const boundary = clearedIds.get(treeId);
  const result = peekRegistry()?.readConfirmedTurns(treeId, 500, boundary);
  if (!result?.ok) return result;
  const turns = result.value.turns;
  const window = turns.slice(-500).filter(turn => !boundary?.has(turn.id));
  return {ok:true as const, value:{...result.value, turns:window, retention:{
    ...result.value.retention,
    truncated:result.value.retention.truncated || turns.length > 500 || boundary !== undefined,
    firstAvailableTurnId:window[0]?.id,
  }}};
}

export function pauseStudioRecording(treeId: string): void {
  const turns = readStudioTurns(treeId);
  if (turns?.ok) pausedTurns.set(treeId, turns.value);
  peekCapture(treeId)?.pause();
}
export function resumeStudioRecording(treeId: string): void {
  pausedTurns.delete(treeId);
  peekCapture(treeId)?.resume();
}
export function clearStudioHistory(treeId: string): void {
  const existing = peekRegistry()?.readConfirmedTurns(treeId, 500);
  if (existing?.ok) clearedIds.set(treeId, new Set(existing.value.retention.observedTurnIds ?? existing.value.turns.slice(-500).map(turn=>turn.id)));
  epochs.set(treeId, studioHistoryEpoch(treeId) + 1);
  const paused = peekCapture(treeId)?.isPaused();
  pausedTurns.delete(treeId);
  peekCapture(treeId)?.clear();
  if (paused) {
    const empty = readStudioTurns(treeId);
    if (empty?.ok) pausedTurns.set(treeId, empty.value);
  }
}
