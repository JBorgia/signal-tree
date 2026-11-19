from pathlib import Path
r=Path('/private/tmp/st-scalar-frame-publication-successor/candidate/packages/kernel/src/lib')
def edit(p,f):
 q=r/p;s=q.read_text();q.write_text(f(s))
edit('internals/intrinsic-mutation.ts',lambda s:s.replace('readonly completion: object;','readonly completion: object;\n  /** Recipients whose prepared unit contains this exact contribution. */\n  readonly coveredRecipients?: readonly object[];',1).replace('readonly changed: boolean;\n}', 'readonly changed: boolean;\n  readonly coveredRecipients?: readonly object[];\n}',1).replace('const parts: Array<{ complete: PublicationCompleter; value: object }>','const coveredRecipients: object[] = [];\n    const parts: Array<{ complete: PublicationCompleter; value: object }>',1).replace('if (unit) { plans.push(unit.record); parts.push({ complete: entry.complete, value: unit.completion }); }','if (unit) { plans.push(unit.record); parts.push({ complete: entry.complete, value: unit.completion }); coveredRecipients.push(...(unit.coveredRecipients ?? [])); }',1).replace('completion };\n  };\n}', 'completion, coveredRecipients };\n  };\n}',1)+'''
/** Frame ownership uses the same source participant as the direct setter. */
export function prepareScalarSourcePublication(node: object, mutation: IntrinsicMutation<unknown>): PreparedPublicationUnit | undefined {
  return SOURCES.get(node)?.publicationPreparer?.(mutation);
}
export function completeScalarSourcePublication(unit: PreparedPublicationUnit): void {
  completePublication(unit.completion);
}
''')
edit('experimental-publication/private.ts',lambda s:s.replace('return {record:combineTerminalRecords(plan,terminalEdits)!,completion:{channel,unit,cleanIngress:clean?ingress:undefined}};','return {record:combineTerminalRecords(plan,terminalEdits)!,completion:{channel,unit,cleanIngress:clean?ingress:undefined},coveredRecipients:[channel]};'))
edit('internals/tree-scalar-slot-runtime.ts',lambda s:s.replace("import { installTerminalRecord }", "import { prepareScalarSourcePublication, completeScalarSourcePublication, installTerminalRecord }").replace("import type { TerminalRecordPlan }", "import type { PreparedPublicationUnit, TerminalRecordPlan }").replace('readonly changedSlots: readonly SlotIndex[];','readonly changedSlots: readonly SlotIndex[];\n  readonly publication?: ScalarFramePublication;',1).replace('export type SingleSlotCommitResult =', '''export interface ScalarFramePublication {
  readonly coverage: ReadonlyMap<number, readonly object[]>;
  complete(): void;
}

/** Completion belongs to the installed frame, independently of invalidation slots. */
export function completeScalarFrame(result: ScalarSlotCommitResult): void {
  result.publication?.complete();
}

export type SingleSlotCommitResult =''').replace('export interface TreeScalarSlotRuntime {','export interface TreeScalarSlotRuntime {\n  bindPublicationSource(slotIndex: SlotIndex, node: object): void;').replace('const values: unknown[] = [];','const values: unknown[] = [];\n  const publicationSources: Array<object | undefined> = [];',1).replace('const shadowPlans:Array<{slotIndex:number;keep:boolean;value:unknown}>=[];','const shadowPlans:Array<{slotIndex:number;keep:boolean;value:unknown}>=[];\n    const units: PreparedPublicationUnit[] = [];\n    const coverage = new Map<number, readonly object[]>();').replace('if(keep!==has || keep&&!Object.is(inspectionBaseline.get(slotIndex),before))shadowPlans.push({slotIndex,keep,value:before});','''if(keep!==has || keep&&!Object.is(inspectionBaseline.get(slotIndex),before))shadowPlans.push({slotIndex,keep,value:before});
      const source = publicationSources[slotIndex];
      if (source) {
        const unit = prepareScalarSourcePublication(source, {intent:'replace', before, after:equal ? before : nextValue, changed:!equal});
        if (unit) { units.push(unit); coverage.set(slotIndex, unit.coveredRecipients ?? []); }
      }''').replace('let used=false;\n    return()=>{','''let used=false;
    const publication: ScalarFramePublication | undefined = units.length ? {
      coverage,
      complete() {
        const pending = units.splice(0);
        let failed = false, first: unknown;
        for (const unit of pending) {
          try { completeScalarSourcePublication(unit); }
          catch (error) { if (!failed) { failed = true; first = error; } }
        }
        if (failed) throw first;
      },
    } : undefined;
    return()=>{''',1).replace('const revision=(changed.length||shadowPlans.length)', 'for (const unit of units) installTerminalRecord(unit.record);\n      const revision=(changed.length||shadowPlans.length)',1).replace('return {revision,changedSlots:changed.map(x=>x.slotIndex)};','return {revision,changedSlots:changed.map(x=>x.slotIndex),...(publication ? {publication} : {})};',1).replace('return {\n    createSlot<T>(', 'return {\n    bindPublicationSource(slotIndex, node) { assertSlotIndex(slotIndex); publicationSources[slotIndex] = node; },\n    createSlot<T>(',1))
# Both concrete tree leaf owners register the actual source and complete after invalidation.
for p in ['internals/tree-scalar-leaf-runtime.ts','internals/native-tree-scalar-leaf-runtime.ts']:
 def change(s):
  s="import { completeScalarFrame } from './tree-scalar-slot-runtime';\nimport { reportContainedObserverError as reportFrameError } from './error-reporter';\n"+s
  # wrap publication implementation, leaving direct one-slot publication unchanged
  s=s.replace('  publish(result: ScalarSlotCommitResult): void {','''  publish(result: ScalarSlotCommitResult): void {
    let failed = false;
    try { this.invalidate(result); }
    catch (error) { failed = true; throw error; }
    finally {
      try { completeScalarFrame(result); }
      catch (error) { if (!failed) throw error; reportFrameError({error,operation:'notify:subscriber'}); }
    }
  }

  private invalidate(result: ScalarSlotCommitResult): void {''',1)
  marker='      if (positionId !== undefined) {'
  s=s.replace(marker,'      kernel.bindPublicationSource(slotIndex, leaf);\n'+marker,1)
  return s
 edit(p,change)
edit('internals/plain-branch-membership.ts',lambda s:s.replace('scalarTargets === undefined\n      ? () => frame.commit({ advanceRevision: false, publish: false })\n      : frame.prepareCommit?.({ advanceRevision: false, publish: false })','frame.prepareCommit?.({ advanceRevision: false, publish: false })').replace('revision: installed.revision,\n              changedSlots:', '...installed,\n              changedSlots:'))
edit('internals/causal-runtime/tree-realization-adapter.ts',lambda s:s.replace('  let scalarCommitResult:\n', '''  const installScalarFrame = scalarFrame?.prepareCommit?.({advanceRevision:false,publish:false});
  if (scalarFrame && !installScalarFrame) throw new Error('Scalar realization preparation unavailable');
  let scalarCommitResult:
''',1).replace('scalarCommitResult = scalarFrame?.commit({\n      advanceRevision: false,\n      publish: false,\n    });','scalarCommitResult = installScalarFrame?.();',1).replace('  return {\n    commit(): void {\n      frame.commit();','''  const install = frame.prepareCommit?.();
  if (!install) throw new Error('Scalar realization preparation unavailable');
  return {
    commit(): void {
      install();''',1))
