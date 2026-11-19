from pathlib import Path
r=Path(__file__).parent/'candidate/packages/kernel/src/lib'
(r/'internals/prepared-entity-structure.ts').write_text('''/** Exact source operations in the complete physical dependency order. */
export type EntityStructureOperation =
  | { kind: 'remove'; subject: number; key: string | number }
  | { kind: 'restore' | 'fresh'; subject: number; key: string | number; value: unknown; beforeSubject?: number; afterSubject?: number }
  | { kind: 'rekey'; subject: number; from: string | number; key: string | number; value: unknown; placement?: {beforeSubject?:number;afterSubject?:number} };
export interface PreparedEntityStructure {
  install(): void;
  complete(): void;
  invalidate(): void;
}
''')
p=r/'entity-signal.ts';s=p.read_text();s="import type { EntityStructureOperation, PreparedEntityStructure } from './internals/prepared-entity-structure';\n"+s
pos=s.index('  function prepareSelectedRows(')
s=s[:pos]+'''  function prepareStructuralUnit(operations: readonly EntityStructureOperation[]): PreparedEntityStructure {
    const frame = createEntityMutationFrame();
    frame.useProposedPlacement();
    const stage = structuralStore.preparePlacement();
    const keys = new Map<K, number | undefined>();
    const atKey = (key: K) => {
      if (keys.has(key)) return keys.get(key);
      const subject = structuralStore.subjectIdForKey(key);
      if (subject === undefined) return undefined;
      const row = stage.read(subject);
      return row.present && row.key === key ? subject : undefined;
    };
    for (const op of operations) {
      const key = op.key as K, prior = stage.read(op.subject);
      if (op.kind === 'remove') {
        if (!prior.present || prior.key !== key) throw new Error('Prepared removal source changed');
        frame.stageSubjectTombstone({kind:'tombstone-subject',key,subjectId:op.subject,restoreAllowed:resolveSubjectState(op.subject)?.restoreAllowed ?? true});
        keys.set(key,undefined);stage.remove(op.subject);
      } else {
        const occupied = atKey(key);
        if (occupied !== undefined && occupied !== op.subject) throw new Error('Prepared destination is occupied');
        if (op.kind === 'rekey') {
          if (!prior.present || prior.key !== op.from) throw new Error('Prepared rekey source changed');
          if (op.placement && !deepEqual(valueStore.backingForSubject(op.subject), op.value))
            frame.stageValueReplacement({kind:'replace-value',key:op.from as K,subjectId:op.subject,nextValue:op.value as E,authoredFields:'realization'});
          frame.stageKeyTransfer({kind:'transfer-key',subjectId:op.subject,fromKey:op.from as K,toKey:key,placement:op.placement});
          keys.set(prior.key,undefined);stage.rekey(op.subject,key);
          if(op.placement)stage.insert(op.subject,key,op.placement.beforeSubject,op.placement.afterSubject);
        } else {
          if (prior.present) throw new Error('Prepared addition lifetime is active');
          const state=resolveSubjectState(op.subject);
          if(op.kind==='fresh') {
            if(state)throw new Error('Prepared fresh lifetime already exists');
            frame.stageFreshSubject({kind:'create-fresh-subject',subjectId:op.subject,key,nextValue:op.value as E});
          } else {
            if(state && !state.restoreAllowed)throw new Error('Prepared restoration backing retired');
            frame.stageSubjectRestore({kind:'restore-subject',subjectId:op.subject,key,realizedValue:op.value as E,restoreAllowed:state?.restoreAllowed??true,beforeSubject:op.beforeSubject,afterSubject:op.afterSubject});
          }
          stage.insert(op.subject,key,op.beforeSubject,op.afterSubject);
        }
        keys.set(key,op.subject);
      }
    }
    const prepared = prepareEntityMutationFrame(frame,{advancePhysicalRevision:false,publication:'physical'});
    let result: ReturnType<typeof prepared.install> | undefined;
    return {
      install(){result=prepared.install();},
      complete(){prepared.complete();},
      invalidate(){
        if(!result)throw new Error('Structural source unit not installed');
        for(const subject of result.physicallyChangedSubjectIds)publishSubjectPhysicalChange(subject);
        for(const op of operations){
          lastSubjectIds=[op.subject];
          if(op.kind==='remove')tombstoneSubjectSignal(op.subject);
          else {
            if(op.kind==='fresh')invalidateNodeCache(op.key as K);
            if(op.kind==='rekey'){rekeyedSubjects.add(op.subject);if(activeIdValue===op.from)replaceLocation(activeIdSignal,op.key as K);}
            syncEntitySignal(op.key as K);
          }
        }
        updateSignals();
      },
    };
  }

'''+s[pos:]
pos=s.index("  Object.defineProperty(api, '__preparePointValues'")
s=s[:pos]+"  Object.defineProperty(api, '__prepareStructuralUnit', { value: prepareStructuralUnit });\n"+s[pos:];p.write_text(s)
p=r/'physical/entity-mutation-frame.ts';s=p.read_text();pos=s.index('  stageFinalFront(');s=s[:pos]+'''  private proposedPlacement = false;
  useProposedPlacement(): void { this.proposedPlacement = true; }
'''+s[pos:]
a=s.index('    return this.mutations.map((mutation) => {',s.index('  private prepareCommitInstructions'))
s=s[:a]+'''    if (this.proposedPlacement) {
      const stage = this.structuralStore.preparePlacement();
      return this.mutations.map((mutation): PreparedCommitInstruction<K,E> => {
        if (mutation.kind==='restore-subject') {
          stage.insert(mutation.subjectId,mutation.key,mutation.beforeSubject,mutation.afterSubject);
          const row=stage.read(mutation.subjectId);
          if(!row.present)throw new Error('Prepared restore placement absent');
          return {...mutation,resolvedValue:mutation.realizedValue??this.valueStore.backingForSubject(mutation.subjectId),resolvedPlacement:{beforeSubject:row.beforeSubject,afterSubject:row.afterSubject}};
        }
        if(mutation.kind==='create-fresh-subject')stage.insert(mutation.subjectId,mutation.key);
        else if(mutation.kind==='tombstone-subject')stage.remove(mutation.subjectId);
        else if(mutation.kind==='transfer-key'){stage.rekey(mutation.subjectId,mutation.toKey);if(mutation.placement)stage.insert(mutation.subjectId,mutation.toKey,mutation.placement.beforeSubject,mutation.placement.afterSubject);}
        return mutation;
      });
    }
'''+s[a:];p.write_text(s)
p=r/'internals/causal-runtime/tree-realization-adapter.ts';s=p.read_text();s="import type { EntityStructureOperation, PreparedEntityStructure } from '../prepared-entity-structure';\n"+s
pos=s.index('  __planRestore?(');s=s[:pos]+'''  __prepareStructuralUnit?(operations: readonly EntityStructureOperation[]): PreparedEntityStructure;
'''+s[pos:]
pos=s.index('  let scalarCommitResult:',s.index('function planHeterogeneousFrame('))
s=s[:pos]+'''  // One source frame sees this unit's complete ordered occupancy proposal.
  const structuralGroups = new Map<CollectionNode, EntityStructureOperation[]>();
  const physicalOrder = [...removeEffects, ...placementEffects, ...plannedRekeys.filter(({effect})=>!realizationPlacement(effect)).map(({effect})=>effect)];
  for(const effect of physicalOrder) {
    const node=resolveCollectionNode(tree,descriptors.get(effect.owner),structuralOwnerPaths,effect);
    if(!node?.__prepareStructuralUnit || typeof effect.subjectId!=='number')throw new Error('Structural source preparation unavailable');
    let group=structuralGroups.get(node);if(!group)structuralGroups.set(node,group=[]);
    if(effect.structural==='remove')group.push({kind:'remove',subject:effect.subjectId,key:removeKeysByEffect.get(effect as ReversalEffect & {structural:'remove';subjectId:number})!});
    else {
      const subject=preparedContext.resolveSubject(effect,effect.subjectId);
      if(!subject)throw new Error('Prepared structural subject missing');
      if(effect.structural==='rekey')group.push({kind:'rekey',subject:effect.subjectId,from:effect.before as string|number,key:effect.after as string|number,value:subject.value,placement:realizationPlacement(effect)?.structuralContext as {beforeSubject?:number;afterSubject?:number}|undefined});
      else {
        const context=getStructuralAddEffect(descriptors.get(effect.owner),effect);
        if(!context)throw new Error('Prepared structural context missing');
        group.push({kind:node.__inspectSubjectResources?.(effect.subjectId)===undefined?'fresh':'restore',subject:effect.subjectId,key:effect.after as string|number,value:subject.value,beforeSubject:context.beforeSubject,afterSubject:context.afterSubject});
      }
    }
  }
  const structuralUnits=[...structuralGroups].map(([node,operations])=>node.__prepareStructuralUnit!(operations));

'''+s[pos:]
a=s.index('    for (const { plan } of plannedRemoves) {',s.index('  const install = (): void =>',s.index('function planHeterogeneousFrame(')));b=s.index('    for (const plan of livePointPlans)',a)
s=s[:a]+'''    for (const unit of structuralUnits) unit.install();

'''+s[b:]
pos=s.index('    for (const plan of livePointPlans) run(() => plan.invalidate());',s.index('function planHeterogeneousFrame('));s=s[:pos]+'''    for (const unit of structuralUnits) run(() => unit.complete());
    for (const unit of structuralUnits) run(() => unit.invalidate());
'''+s[pos:]
p.write_text(s)
