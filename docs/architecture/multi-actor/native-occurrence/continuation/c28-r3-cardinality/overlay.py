from pathlib import Path
import json,hashlib,difflib,os
r=Path(__file__).resolve().parent
h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
lib='packages/kernel/src/lib/'
helper=lib+'cardinality-diagnostic.ts'
helpertext='''// Disposable diagnostic only; no retained runtime references or output in hooks.
let counts: Record<string, number> = Object.create(null);
export function tally(key:string,n=1):void { counts[key]=(counts[key]??0)+n; }
export function size(key:string,n:number):void {
 tally(key+'.calls'); tally(key+'.sum',n);
 counts[key+'.max']=Math.max(counts[key+'.max']??0,n);
 if(!Number.isSafeInteger(n)||n<0)tally('invariant.invalidSize');
}
export function check(ok:boolean):void {if(!ok)tally('invariant.failed');}
export function take():Record<string,number> {const old=counts;counts=Object.create(null);return old;}
'''
for arm in ['baseline','indexed']:
 c=r/arm/'candidate';base=json.loads((r/arm/'MANIFEST.json').read_text()); changed={}
 def edit(path,changes):
  p=c/(lib+path);old=p.read_text();s=old
  rel=os.path.relpath(c/helper,p.parent).replace('.ts','')
  if not rel.startswith('.'):rel='./'+rel
  s="import { tally as ct, size as cs, check as cc } from '"+rel+"'; // CARDINALITY-ONLY\n"+s
  for a,b in changes:
   assert s.count(a)==1,(arm,path,a,s.count(a));s=s.replace(a,b)
  p.write_text(s);changed[lib+path]=h(p)
  out=r/arm/'overlays'/path;out.parent.mkdir(parents=True,exist_ok=True)
  out.with_suffix(out.suffix+'.original').write_text(old)
  out.with_suffix(out.suffix+'.patch').write_text(''.join(difflib.unified_diff(old.splitlines(True),s.splitlines(True),fromfile='a/'+lib+path,tofile='b/'+lib+path)))
 edit('physical/entity-value-store.ts', [('    const target = new Map(this.retainedEntities);','    cs("target.retained",this.retainedEntities.size); cs("target.subjects",subjects.length);\n    const target = new Map(this.retainedEntities);')])
 edit('internals/entity-publication.ts', [
 ('  prepare(packet: EntityPublicationPacket): PreparedPublicationUnit | undefined {','  prepare(packet: EntityPublicationPacket): PreparedPublicationUnit | undefined {\n    cs("packet.ordinary",packet.ordinary.length); cs("packet.physical",packet.physical.length); ct(packet.steps===undefined?"packet.stepsAbsent":"packet.stepsPresent"); cs("packet.steps",packet.steps?.length??0);'),
 ('    const nativeUnit = native?.prepare(packet);','    ct(native?"packet.nativePresent":"packet.nativeAbsent");\n    const nativeUnit = native?.prepare(packet);')])
 edit('experimental-publication/entity.ts',[
 ('    prepare(packet){','    prepare(packet){\n      ct("native.prepare");'),
 ('if(!row)nextFields.set(id,row=new Map(fields.get(id)));','if(!row){cs("native.rowFieldsCopy",fields.get(id)?.size??0);nextFields.set(id,row=new Map(fields.get(id)));}'),
 ('if(!row)nextViews.set(id,row=new Map(views.get(id)));','if(!row){cs("native.rowViewsCopy",views.get(id)?.size??0);nextViews.set(id,row=new Map(views.get(id)));}'),
 ('        physicalAt.set(edit,new Map(row));','        cs("native.physicalAtCopy",row.size);\n        physicalAt.set(edit,new Map(row));'),
 ('        const ordinaryRow=singleton?row:new Map(row),physicalRow=new Map(physical&&physicalAt.get(physical)||view);','        ct(singleton?"native.singletonReuse":"native.multiCopy");\n        if(!singleton)cs("native.ordinaryRowCopy",row.size);\n        cs("native.selectedPhysicalCopy",(physical&&physicalAt.get(physical)||view).size);\n        const ordinaryRow=singleton?row:new Map(row),physicalRow=new Map(physical&&physicalAt.get(physical)||view);')])
 edit('internals/intrinsic-mutation.ts',[
 ('  const present = plans.filter((plan): plan is TerminalRecordPlan => plan !== undefined);', '''  cs('terminal.slots',plans.length);
  let w=0,a=0,d=0;
  const present = plans.filter((plan): plan is TerminalRecordPlan => {
    if(plan!==undefined){cs('terminal.inputWrites',plan.writes.length);cs('terminal.inputAdds',plan.adds.length);cs('terminal.inputDeletes',plan.deletes?.length??0);w+=plan.writes.length;a+=plan.adds.length;d+=plan.deletes?.length??0;}
    return plan !== undefined;
  });
  cs('terminal.present',present.length);'''),
 ('  if (present.length < 2) return present[0];','  if (present.length < 2) {ct("terminal.reusedOrAbsent");return present[0];}'),
 ('  return {\n    writes: present.flatMap(plan => plan.writes),','  const result = {\n    writes: present.flatMap(plan => plan.writes),'),
 ('    deletes: present.flatMap(plan => plan.deletes ?? []),\n  };','    deletes: present.flatMap(plan => plan.deletes ?? []),\n  };\n  cs("terminal.outputWrites",result.writes.length);cs("terminal.outputAdds",result.adds.length);cs("terminal.outputDeletes",result.deletes.length);\n  cc(result.writes.length===w&&result.adds.length===a&&result.deletes.length===d);return result;')])
 changes=[('  const publicationMeta = (effect: ReversalEffect): WriteMetadata => {','  const publicationMeta = (effect: ReversalEffect): WriteMetadata => {\n    ct("adapter.metaCalls");'),
 ('      ordinaryPlans.set(\n        owner,\n        node.__prepareOrdinaryRealization(group, undefined, physicalGroup,undefined,undefined,publicationPhase)\n      );','      const countedPlan = node.__prepareOrdinaryRealization(group, undefined, physicalGroup,undefined,undefined,publicationPhase);\n      cs("adapter.planChanges",countedPlan.changes.length);\n      ordinaryPlans.set(owner,countedPlan);')]
 if arm=='baseline':
  changes.append(('''    return plan
      ? withSelectedEntityDisposition(
          meta,
          plan.changes.filter((change) => change.subject === effect.subjectId)
        )
      : meta;''','''    if(!plan){ct('adapter.noPlan');return meta;}
    cs('adapter.filterInput',plan.changes.length);
    const selected=plan.changes.filter((change) => change.subject === effect.subjectId);
    cs('adapter.selected',selected.length);cc(selected.length<=plan.changes.length);
    return withSelectedEntityDisposition(meta,selected);'''))
 else:
  changes += [('    for (const change of plan.changes) {','    for (const change of plan.changes) {\n      ct("adapter.groupVisits");'),('      if (change.subject !== change.subject) continue;','      if (change.subject !== change.subject) {ct("adapter.nanSkipped");continue;}\n      ct("adapter.groupReferences");'),('      else subjects.set(change.subject, [change]);','      else {ct("adapter.groups");subjects.set(change.subject, [change]);}'),('    if (!plan) return meta;','    if (!plan) {ct("adapter.noPlan");return meta;}'),('''    return withSelectedEntityDisposition(meta,
      typeof effect.subjectId === 'number'
        ? subjects.get(effect.subjectId)?.slice() ?? []
        : []);''','''    const selected=typeof effect.subjectId === 'number'
        ? subjects.get(effect.subjectId)?.slice() ?? [] : [];
    cs('adapter.selected',selected.length);cc(selected.length<=plan.changes.length);
    return withSelectedEntityDisposition(meta,selected);''')]
 edit('internals/causal-runtime/tree-realization-adapter.ts',changes)
 (c/helper).write_text(helpertext);changed[helper]=h(c/helper)
 (r/arm/'OVERLAY-MANIFEST.json').write_text(json.dumps(changed,indent=2)+'\n')
# Adapt existing output-only markers: intervals attributed to immediately preceding marker.
p=r/'INSTRUMENTED-TEMPLATE.spec.ts';s=p.read_text();s="import { take as cardinalityTake } from './cardinality-diagnostic';\nlet precedingStage='module-import';\n"+s
s=s.replace('  const usage=process.memoryUsage(),v8=memoryHeapStatistics();','  const counts=cardinalityTake();\n  const phase=precedingStage;precedingStage=stage;\n  const usage=process.memoryUsage(),v8=memoryHeapStatistics();')
s=s.replace('{stage,at:Date.now()', '{stage,phase,counts,at:Date.now()')
s=s.replace('    await flush(); // MEMORY-ONLY final bounded drain\n','').replace("    memoryStage('restoration:after-final-drain'); // MEMORY-ONLY\n",'')
p.write_text(s)
(r/'test-overlay.patch').write_text(''.join(difflib.unified_diff((r/'ORIGINAL.spec.ts').read_text().splitlines(True),s.splitlines(True),fromfile='a/'+lib+'entity-large-batches.spec.ts',tofile='b/'+lib+'entity-large-batches.spec.ts')))
# All original body lines preserved. Remove helpers and markers to establish exact inverse.
body=s.split('// END MEMORY-ONLY INSTRUMENTATION\n',1)[1]
assert ''.join(l for l in body.splitlines(True) if '// MEMORY-ONLY' not in l)==(r/'ORIGINAL.spec.ts').read_text()
print('Five source hooks + primitive helper per arm; test-body inverse exact; no workload executed.')
