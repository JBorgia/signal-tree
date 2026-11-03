import { getEntityPublicationAnchor, getEntityPublicationBinding } from './entity-publication';
import { isTraversableNode, nodeStoreOf } from './node-shape';
import { getNodeAddress, getPositionRegistry } from './position-registry';

// Cold enrollment only. These are source identities, never publication permission.
const roots = new WeakMap<object, WeakRef<object>>();
const issued = new WeakSet<object>();
export interface NativeOccurrenceEdge {
  readonly parent: object;
  readonly key: string;
  readonly child: object;
  readonly address: readonly string[];
  readonly present: boolean;
  readonly entity?: boolean;
}
export interface NativeOccurrence {
  readonly root: object;
  readonly source: object;
  readonly edges: readonly NativeOccurrenceEdge[];
}
export function registerNativeOccurrenceRoot(registry: object, root: object): void {
  roots.set(registry, new WeakRef(root));
}
export const occurrenceIdentity = (node: object): object => nodeStoreOf(node) ?? node;
export function captureNativeOccurrence(source: object): NativeOccurrence {
  const entity = getEntityPublicationBinding(source);
  const anchor = entity && entity.subject !== undefined ? getEntityPublicationAnchor(entity.source) : source;
  if (!anchor) throw new Error('Native occurrence has no collection anchor');
  const registry = getPositionRegistry(anchor), address = getNodeAddress(anchor);
  const root = registry && roots.get(registry)?.deref();
  if (!root || !address) throw new Error('Native occurrence has no verified root/address');
  const edges: NativeOccurrenceEdge[] = [];
  let parent = root;
  for (let i = 0; i < address.length; i++) {
    const storage = occurrenceIdentity(parent), key = address[i];
    const descriptor = Object.getOwnPropertyDescriptor(storage, key);
    if (!descriptor || !('value' in descriptor) || !isTraversableNode(descriptor.value)) throw new Error('Native occurrence ancestry changed');
    const child = descriptor.value;
    edges.push(Object.freeze({ parent, key, child, address: address.slice(0, i + 1), present: descriptor.enumerable === true }));
    parent = child;
  }
  if (occurrenceIdentity(parent) !== occurrenceIdentity(anchor)) throw new Error('Native occurrence address names another lifetime');
  if (anchor !== source && entity) {
    // Entity bindings are source-issued and lifetime-specific; do not resolve a reused public key.
    edges.push(Object.freeze({ parent: anchor, key: `${entity.subject}:${entity.field ?? ''}`, child: source, address, present: true, entity: true }));
  }
  const result = Object.freeze({ root, source, edges: Object.freeze(edges) });
  issued.add(result);return result;
}
export function isNativeOccurrence(value: NativeOccurrence): boolean { return issued.has(value); }

/** Source construction authority: authenticate a detached addition against its live parent. */
export function prepareNativeMemberOccurrences(parent: object, key: string, child: object) {
  const ancestry = captureNativeOccurrence(parent);
  const address = getNodeAddress(parent);
  if (!address || Object.getOwnPropertyDescriptor(occurrenceIdentity(parent), key))
    throw new Error('Prepared native member is not a fresh edge');
  const occurrences: NativeOccurrence[] = [];
  const seen=new Set<object>();
  const visit = (node: object, edges: readonly NativeOccurrenceEdge[]): void => {
    const expected=edges.at(-1)?.address??[],actual=getNodeAddress(node);
    if(getPositionRegistry(node)!==getPositionRegistry(parent)||!actual||actual.length!==expected.length||actual.some((part,i)=>part!==expected[i])||seen.has(node))
      throw new Error('Prepared native member has invalid source identity');
    seen.add(node);
    const occurrence = Object.freeze({root: ancestry.root, source: node, edges: Object.freeze([...edges])});
    issued.add(occurrence); occurrences.push(occurrence);
    if (getEntityPublicationBinding(node)) return;
    const storage = occurrenceIdentity(node);
    for (const name of Object.getOwnPropertyNames(storage)) {
      const descriptor = Object.getOwnPropertyDescriptor(storage, name);
      if (!descriptor || !('value' in descriptor) || !isTraversableNode(descriptor.value)) continue;
      const childAddress=getNodeAddress(descriptor.value);
      if(!childAddress)continue;
      visit(descriptor.value, [...edges, Object.freeze({parent: node, key:name, child:descriptor.value,
        address: Object.freeze([...address,key,...childAddress.slice(address.length+1)]), present:descriptor.enumerable===true})]);
    }
  };
  visit(child,[...ancestry.edges,Object.freeze({parent,key,child,address:Object.freeze([...address,key]),present:true})]);
  return {occurrences:Object.freeze(occurrences),validate:()=>{
    const current=captureNativeOccurrence(parent);
    if (current.root!==ancestry.root || current.edges.length!==ancestry.edges.length ||
        current.edges.some((edge,i)=>edge.child!==ancestry.edges[i].child||edge.present!==ancestry.edges[i].present) ||
        Object.getOwnPropertyDescriptor(occurrenceIdentity(parent),key))
      throw new Error('Prepared native member ancestry changed');
  }};
}
