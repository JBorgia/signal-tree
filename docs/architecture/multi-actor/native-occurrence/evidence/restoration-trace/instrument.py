from pathlib import Path
r=Path('/private/tmp/st-occurrence-restoration-trace/candidate/packages/kernel/src/lib')
(r/'restoration-trace.ts').write_text('''const ids=new WeakMap<object,number>();let serial=0,seq=0;
export function traceId(value:object|undefined):number|undefined {if(!value)return;let id=ids.get(value);if(!id)ids.set(value,id=++serial);return id;}
export function traceProof(p: {unknown?:boolean;invalid?:boolean;owners?:readonly object[];possible?:readonly object[];destination?:readonly object[];input?:readonly object[]}|undefined):unknown {if(!p)return;return {unknown:p.unknown,invalid:p.invalid,...Object.fromEntries((['owners','possible','destination','input'] as const).map(k=>[k,p[k]?.map(c=>({id:traceId(c),outcome:(c as {outcome?:unknown}).outcome}))]))};}
export function traceReq(r:object|undefined):unknown {return r?{id:traceId(r),proof:traceProof((r as {proof?:Parameters<typeof traceProof>[0]}).proof)}:undefined;}
export function trace(event:string,data:unknown):void {console.log('RESTORATION_TRACE '+JSON.stringify({seq:++seq,event,data}));}
''')
def edit(name,changes,imp):
 p=r/name;s=p.read_text();s=imp+'\n'+s
 for old,new in changes:
  assert old in s,(name,old);s=s.replace(old,new,1)
 p.write_text(s)
edit('experimental-publication/private.ts',[
 ('function prepareMembership(edit:MembershipPublicationEdit):PreparedPublicationUnit|undefined{','function prepareMembership(edit:MembershipPublicationEdit):PreparedPublicationUnit|undefined{ trace("prepareMembership",{address:edit.address,key:edit.key,present:edit.present,ordinary:edit.ordinary});'),
 ('function completeMembership(completion:object):void{','function completeMembership(completion:object):void{trace("completeMembership",{units:(completion as {parts:{unit:Unit}[]}).parts.map(p=>p.unit.fact.revision)});'),
 ('  const authoredRequirement=lifecycle.combineNativeRequirements','  trace("reduceUnit",{revision:unit.fact.revision,kind:unit.collection?"collection":unit.presence?"membership":unit.field?"field":"value",payload:unit.payload,member:unit.presence&&{key:unit.presence.slot.key,present:unit.presence.state.present,ordinary:unit.presence.ordinary},native:traceReq(unit.native),proof:traceProof(proof)});\n  const authoredRequirement=lifecycle.combineNativeRequirements'),
 ('     setCollectionEntry(channel,b,collection,edit.key,','     trace("collectionSupportEdit",{revision:unit.fact.revision,key:edit.key,after:traceReq(edit.after)});\n     setCollectionEntry(channel,b,collection,edit.key,'),
 ('  proofs.set(unit.fact,effective);','  trace("reducedSelection",{revision:unit.fact.revision,payload:maskPayload(b),proof:traceProof(effective),unresolved:b.index.unresolved()});\n  proofs.set(unit.fact,effective);'),
 ('export function completeSourceProjection(completion:object):void { completeScalar(completion); }','export function completeSourceProjection(completion:object):void {trace("completeCollection",{revision:(completion as {unit:Unit}).unit.fact.revision}); completeScalar(completion); }'),
 (' unit.complete=true;wakeChannel(channel);',' unit.complete=true;wakeChannel(channel);')
],"import {trace,traceReq,traceProof} from '../restoration-trace';")
edit('internals/entity-publication.ts',[
 ('    const recipientRevision = this.recipientRevision,sourceRevision=this.revisionToken;','    trace("entityPacket",{physical:packet.physical,ordinary:packet.ordinary,steps:packet.steps,physicalOrder:packet.physicalOrder,ordinaryOrder:packet.ordinaryOrder});\n    const recipientRevision = this.recipientRevision,sourceRevision=this.revisionToken;')
],"import {trace} from '../restoration-trace';")
edit('link.ts',[
 ('        const receipt=affected&&prepared?.requirement?', '        trace("entityRecipientPrepared",{affected,changed,next,supportEdits:staged?.supportEdits.map(e=>({key:e.key,before:traceReq(e.before),after:traceReq(e.after)})),native:traceReq(prepared?.requirement)});\n        const receipt=affected&&prepared?.requirement?')
],"import {trace,traceReq} from './restoration-trace';")
edit('signal-tree.ts',[
 ('        hydrated = hydrateMarkerNode(prop, value, \'restore\');','        hydrated = hydrateMarkerNode(prop, value, \'restore\');\n        trace("recursiveHydrate",{path:childPath,supplied:value,hydrated});')
],"import {trace} from './restoration-trace';")
