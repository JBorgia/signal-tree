from pathlib import Path
r=Path('/private/tmp/st-fixed-window-retirement-successor/candidate/packages/kernel/src/lib')
p=r/'experimental-publication/lifecycle.ts';s=p.read_text();anchor='function ownerWake(cell:OwnerCell):void{for(const op of cell.dependents)wake(op.channel);}'
s=s.replace(anchor,anchor+'''
// Exact-cell source retirement observers. They are neither recipient operations
// nor readiness observers, and never execute on the transition stack.
type OwnerTransitionObserver = { callback?: () => void; queued: boolean };
const ownerTransitionObservers = new WeakMap<OwnerCell, Set<OwnerTransitionObserver>>();
function queueOwnerObserver(observer: OwnerTransitionObserver): void {
 if (observer.queued || !observer.callback) return;
 observer.queued = true;
 queueMicrotask(() => { observer.queued = false; observer.callback?.(); });
}
function notifyOwnerTransition(cell: OwnerCell): void {
 for (const observer of ownerTransitionObservers.get(cell) ?? []) queueOwnerObserver(observer);
}
/** False for unavailable sources; disappearance never settles the captured cell. */
export function ownerCellCanTransition(cell: OwnerCell): boolean {
 return cell.outcome === 'pending' && sources.get(cell.owner)?.cells.get(cell.id) === cell;
}
export function onOwnerCellTransition(cell: OwnerCell, callback: () => void): () => void {
 let observers = ownerTransitionObservers.get(cell);
 if (!observers) ownerTransitionObservers.set(cell, observers = new Set());
 const observer: OwnerTransitionObserver = { callback, queued: false };
 observers.add(observer);
 // Covers a terminal/disappearance race between assessment and subscription.
 if (!ownerCellCanTransition(cell)) queueOwnerObserver(observer);
 return () => {
  observer.callback = undefined;
  observers!.delete(observer);
  if (!observers!.size) ownerTransitionObservers.delete(cell);
 };
}
''')
s=s.replace(' ownerWake(cell);\n}', ' ownerWake(cell);notifyOwnerTransition(cell);\n}',1)
s=s.replace('pending.delete(cell);ownerWake(cell);}', 'pending.delete(cell);ownerWake(cell);notifyOwnerTransition(cell);}',1)
s=s.replace('export type NativeRequirement={readonly components?', '''export type NativeRequirement={
/** Preparation provenance, never inferred from a compacted unknown bit. */
readonly retirementOwnWindowOnly?: boolean;
readonly components?''')
s=s.replace('const requirement:NativeRequirement={known:Object.freeze([...known]),unknown,inputs:', 'const requirement:NativeRequirement={retirementOwnWindowOnly:!unknown&&known.length===0&&inputs.length===0&&active.length===0,known:Object.freeze([...known]),unknown,inputs:')
p.write_text(s)
p=r/'internals/entity-publication.ts';s=p.read_text().replace('  onReady(callback: () => void): () => void;','''  onReady(callback: () => void): () => void;
  /** Only exact live cells whose settlement could make this snapshot releasable. */
  onSettlement?(callback: () => void): () => void;''')
s=s.replace('''      // No owner-settlement subscription is implied by requirement readiness.
      // A ready non-neutral record remains source evidence; drop only the request.
      if (!plan.neutral) { this.cancelRetirement(subject); return; }''','''      // Readiness and owner settlement are separate lifetimes. A permanently
      // ineligible proof remains evidence, without retaining a dead request.
      if (!plan.neutral) {
        if (plan.onSettlement) request.release = plan.onSettlement(() => this.scheduleRetirement(subject, request));
        else this.cancelRetirement(subject);
        return;
      }''')
p.write_text(s)
p=r/'experimental-publication/entity.ts';s=p.read_text();start=s.index('      const neutral = ready && [...requirements].every(requirement => {');end=s.index('      return { ready, neutral,',start)
s=s[:start]+'''      const waiting = new Set<lifecycle.OwnerCell>();
      const releasable = (requirement: Requirement): boolean => {
        // A composite is eligible only when every constituent independently is.
        if (requirement.components) return requirement.components.every(releasable);
        const proof = lifecycle.nativeProof(requirement);
        if (proof.invalid || proof.unavailableInput || proof.terminalRejectedRoles ||
            proof.owners.length || (proof.destination?.length ?? 0) ||
            (proof.input?.length ?? 0) || (proof.validation?.length ?? 0)) return false;
        if (!proof.unknown && !(proof.possible?.length ?? 0)) return true;
        // Do not erase arbitrary unknown input/origin/validation. Only the
        // source's own window, classified before those facts could be cleared.
        if (!requirement.retirementOwnWindowOnly || !proof.historicalWindow) return false;
        for (const cell of proof.possible ?? []) {
          if (cell.outcome === 'confirmed' || cell.outcome === 'rolled-back') continue;
          if (!lifecycle.ownerCellCanTransition(cell)) return false;
          waiting.add(cell);
        }
        return true;
      };
      const canRelease = ready && [...requirements].every(releasable);
      const neutral = canRelease && waiting.size === 0;
''' +s[end:]
s=s.replace('''      return { ready, neutral,
        current:''','''      return { ready, neutral,
        onSettlement: canRelease && waiting.size ? (callback: () => void) => {
          const releases = [...waiting].map(cell => lifecycle.onOwnerCellTransition(cell, callback));
          return () => { for (const release of releases) release(); };
        } : undefined,
        current:''')
p.write_text(s)
