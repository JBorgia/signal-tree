from pathlib import Path
r=Path(__file__).parent/'candidate/packages/kernel/src/lib'
p=r/'internals/native-occurrence.ts';s=p.read_text();s+='''
/** Source construction authority: authenticate a detached addition against its live parent. */
export function prepareNativeMemberOccurrences(parent: object, key: string, child: object) {
  const ancestry = captureNativeOccurrence(parent);
  const address = getNodeAddress(parent);
  if (!address || Object.getOwnPropertyDescriptor(occurrenceIdentity(parent), key))
    throw new Error('Prepared native member is not a fresh edge');
  const occurrences: NativeOccurrence[] = [];
  const visit = (node: object, edges: readonly NativeOccurrenceEdge[]): void => {
    const occurrence = Object.freeze({root: ancestry.root, source: node, edges: Object.freeze([...edges])});
    issued.add(occurrence); occurrences.push(occurrence);
    if (getEntityPublicationBinding(node)) return;
    const storage = occurrenceIdentity(node);
    for (const name of Object.getOwnPropertyNames(storage)) {
      const descriptor = Object.getOwnPropertyDescriptor(storage, name);
      if (!descriptor || !('value' in descriptor) || !isTraversableNode(descriptor.value) || !getNodeAddress(descriptor.value)) continue;
      visit(descriptor.value, [...edges, Object.freeze({parent: node, key:name, child:descriptor.value,
        address: Object.freeze([...address,key,...getNodeAddress(descriptor.value)!.slice(address.length+1)]), present:descriptor.enumerable===true})]);
    }
  };
  visit(child,[...ancestry.edges,Object.freeze({parent,key,child,address:Object.freeze([...address,key]),present:true})]);
  return {occurrences:Object.freeze(occurrences),validate:()=>{
    const current=captureNativeOccurrence(parent);
    if (current.root!==ancestry.root || current.edges.length!==ancestry.edges.length ||
        current.edges.some((edge,i)=>edge.child!==ancestry.edges[i].child) ||
        Object.getOwnPropertyDescriptor(occurrenceIdentity(parent),key))
      throw new Error('Prepared native member ancestry changed');
  }};
}
''';p.write_text(s)
p=r/'internals/member-membership.ts';s=p.read_text();s+='''
/** Prepare the ordinary exception for a newly materialized physical edge. */
export function prepareFreshMemberPresence(branch: object,key: string,child: object) {
 const parent=nodeOf(branch),previous=ordinaryPresenceSources.get(parent);
 const source=previous??new OrdinaryMemberPresenceSource();
 const edit=source.prepare(key,child,false,true,getActiveWriteContext()?.participation==='inspection');
 return {present:edit.after,validate:()=>{
  if(ordinaryPresenceSources.get(parent)!==previous||Object.getOwnPropertyDescriptor(parent,key))throw new Error('Fresh membership preparation reentered installation');
  source.validate(edit);
 },install:()=>{
  const delta=source.install(edit);ordinaryPresenceSources.set(parent,source);
  const runtime=getTreeScalarSlotRuntime(parent);
  if(runtime&&delta){ordinaryDivergences.set(runtime,(ordinaryDivergences.get(runtime)??0)+delta);runtime.enableAbsence?.(ABSENCE);}
 }};
}
''';p.write_text(s)
p=r/'internals/intrinsic-mutation.ts';s=p.read_text().replace('export interface MembershipPublicationEdit {','export interface MembershipPublicationEdit {\n  readonly preparedOccurrences?: readonly import(\'./native-occurrence\').NativeOccurrence[];');
# staged registration: preparation owns closures only; install uses unique callback identity.
pos=s.index('\nfunction composePublication(source: SourceRecord)')
s=s[:pos]+'''
/** No source registration is reachable until the producer installs this record. */
export function stagePublicationMutations(node: object, prepare: PublicationPreparer,
 complete: PublicationCompleter, captureInput?: PublicationInputCapture) {
 if(!SOURCES.has(node))throw new Error('Prepared descendant lacks native publication source');
 let release:(()=>void)|undefined;
 return {install:()=>{release=preparePublicationMutations(node,prepare,complete,captureInput);},
 release:()=>{release?.();release=undefined;}};
}
'''+s[pos:];p.write_text(s)
p=r/'internals/materialize-markers.ts';s=p.read_text().replace("import { linkAddedMember }", "import { ordinaryMemberSnapshot } from './plain-branch-membership';\nimport { prepareNativeMemberOccurrences } from './native-occurrence';\nimport { linkAddedMember, prepareFreshMemberPresence }")
s=s.replace('  const unit = prepare && registry && address && isTraversableNode(child)\n    ? prepare({registry,branch,address,key,child,present:true}) : undefined;', '''  const fresh = isTraversableNode(child) ? prepareFreshMemberPresence(branch,key,child) : undefined;
  const occurrence = prepare && registry && address && isTraversableNode(child)
    ? prepareNativeMemberOccurrences(branch,key,child) : undefined;
  // Read the detached canonical child's ordinary image before any install or delivery.
  const ordinary = fresh ? {before:{present:false as const},after:fresh.present
    ? {present:true as const,value:ordinaryMemberSnapshot(child)} : {present:false as const}} : undefined;
  const unit = prepare && registry && address && isTraversableNode(child)
    ? prepare({registry,branch,address,key,child,present:true,ordinary,preparedOccurrences:occurrence?.occurrences}) : undefined;
  fresh?.validate();occurrence?.validate();''')
s=s.replace('  // Under a branch that has been omitted before,', '  fresh?.install();\n  // Under a branch that has been omitted before,');p.write_text(s)
