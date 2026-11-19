from pathlib import Path
base=Path('/private/tmp/st-native-explicit-handoff-successor/candidate/packages/kernel/src')
def edit(path,fn):
 p=base/path;s=p.read_text();p.write_text(fn(s))
def location(s):
 s="import type { ClaimedFieldEndpoint } from './native-field-selection';\n"+s
 s=s.replace('  replace(value: T): void;', '  replace(value: T): void;\n  replaceSelected?(value: T, selection: ClaimedFieldEndpoint): void;')
 pos=s.index('export function deriveLocation')
 s=s[:pos]+'''/** Private inverse dispatch; follows the same installed interceptor chain. */
export function replaceSelectedLocation<T>(location: Location<T>, value: T, selection: ClaimedFieldEndpoint): void {
  const binding = writableLocationBinding(location);
  if (!binding.replaceSelected) throw new Error('Selected replacement has no private projection continuation');
  binding.replaceSelected(value, selection);
}

'''+s[pos:]
 s=s.replace('  const previousDerive = binding.derive;', '  const previousDerive = binding.derive;\n  const previousSelected = binding.replaceSelected;\n  const wrappedSelected = previousSelected ? (value: T, selection: ClaimedFieldEndpoint): void =>\n    intercept({ intent: \'replace\', value }, () => previousSelected(value, selection)) : undefined;')
 s=s.replace('  binding.replace = wrappedReplace;', '  binding.replace = wrappedReplace;\n  binding.replaceSelected = wrappedSelected;')
 s=s.replace('    if (binding.replace === wrappedReplace) binding.replace = previousReplace;', '    if (binding.replace === wrappedReplace) binding.replace = previousReplace;\n    if (binding.replaceSelected === wrappedSelected) binding.replaceSelected = previousSelected;')
 s=s.replace("write: (value: T, intent: 'replace' | 'derive') => void", "write: (value: T, intent: 'replace' | 'derive', selection?: ClaimedFieldEndpoint) => void")
 start=s.index('export function createWritableProjection');end=s.index('let activeConsumer',start);part=s[start:end]
 part=part.replace('  const binding: WritableLocationBinding<T> = {\n    location,\n    notify: () => undefined,\n    replace: (value) => {','  const replace = (value: T, selection?: ClaimedFieldEndpoint): void => {')
 part=part.replace("      write(value, 'replace');", "      write(value, 'replace', selection);")
 part=part.replace('    },\n    derive: (update) => {','    };\n  const binding: WritableLocationBinding<T> = {\n    location,\n    notify: () => undefined,\n    replace: value => replace(value),\n    replaceSelected: replace,\n    derive: (update) => {',1)
 s=s[:start]+part+s[end:];return s
edit(Path('lib/internals/location-runtime.ts'),location)
def native(s):
 s="import type { ClaimedFieldEndpoint } from './native-field-selection';\n"+s
 start=s.index('  const createWritableProjection =');end=s.index('  const createDerived',start);p=s[start:end]
 p=p.replace("write: (value: T, intent: 'replace' | 'derive') => void", "write: (value: T, intent: 'replace' | 'derive', selection?: ClaimedFieldEndpoint) => void")
 p=p.replace('    const binding: WritableLocationBinding<T> = {\n      location,\n      notify: () => undefined,\n      replace: (value) => {','    const replace = (value: T, selection?: ClaimedFieldEndpoint): void => {')
 p=p.replace("        write(value, 'replace');", "        write(value, 'replace', selection);")
 p=p.replace('      },\n      derive: (update) => {','      };\n    const binding: WritableLocationBinding<T> = {\n      location,\n      notify: () => undefined,\n      replace: value => replace(value),\n      replaceSelected: replace,\n      derive: (update) => {',1)
 return s[:start]+p+s[end:]
edit(Path('lib/internals/native-location-realization.ts'),native)
def entity(s):
 s=s.replace('claimFieldEndpointInvocation,','')
 # extract implementations so public entry never receives an authority argument
 chunks=[]
 for name,nextmark,args in [('updateOne','    /**\n     * Replace,', 'id: K, changes: Partial<E>'),('replaceOne','    updateMany(', 'id: K, entity: E')]:
  begin=s.index('    '+name+'('+args+'): void {');end=s.index(nextmark,begin)
  part=s[begin:end]; close=part.rfind('    },');body=part[part.index('{')+1:close]
  body='\n'.join(line for line in body.split('\n') if 'const inverseClaim=claimFieldEndpointInvocation' not in line)
  chunks.append('  function '+name+'Private('+args+', inverseClaim?: ClaimedFieldEndpoint): void {'+body+'  }\n')
  call='id, changes' if name=='updateOne' else 'id, entity'
  s=s[:begin]+'    '+name+'('+args+'): void { '+name+'Private('+call+'); },\n\n'+part[close+7:]+s[end:]
 at=s.index('  function selectedInverseField');s=s[:at]+''.join(chunks)+s[at:]
 s=s.replace("intent: 'replace' | 'derive'\n      ) =>", "intent: 'replace' | 'derive',\n        selection?: ClaimedFieldEndpoint\n      ) =>")
 s=s.replace('api.updateOne(key, { [fieldKey]: value } as Partial<E>)','updateOnePrivate(key, { [fieldKey]: value } as Partial<E>, selection)')
 # share row write core; authority only passed via private binding
 s=s.replace('    const node = ((valueOrUpdater?: E | ((current: E) => E)): E | undefined => {','    const writeRow = (valueOrUpdater?: E | ((current: E) => E), selection?: ClaimedFieldEndpoint): E | undefined => {')
 s=s.replace('()=>api.replaceOne(key,next)', '()=>replaceOnePrivate(key,next,selection)')
 s=s.replace('    }) as unknown as EntityNode<E>;','    };\n    const node = ((valueOrUpdater?: E | ((current: E) => E)) => writeRow(valueOrUpdater)) as unknown as EntityNode<E>;',1)
 s=s.replace('defineEntityPublicationBinding(location,{source:entityPublication,subject:subjectId,field:fieldKey});','defineEntityPublicationBinding(location,{source:entityPublication,subject:subjectId,field:fieldKey,\n        replaceSelected: fieldKey === undefined ? (value, selection) => { writeRow(value as E, selection); } : undefined});')
 return s
edit(Path('lib/entity-signal.ts'),entity)
edit(Path('lib/internals/entity-publication.ts'),lambda s:s.replace('export interface EntityPublicationBinding {','export interface EntityPublicationBinding {\n  readonly replaceSelected?: (value: unknown, selection: import(\'./native-field-selection\').ClaimedFieldEndpoint) => void;'))
def adapter(s):
 s=s.replace('fieldEndpoints,withFieldEndpointInvocation','fieldEndpoints')
 s="import { replaceSelectedLocation } from '../location-runtime';\n"+s
 s=s.replace('const invoke = (target:object,body:()=>void):void => {','const invoke = (target:object,value:unknown,body:()=>void):void => {')
 s=s.replace('    withFieldEndpointInvocation(binding,path[0],endpoint,body);',"    const selection = Object.freeze({source:binding.source,subject:binding.subject!,field:path[0]!,endpoint});\n    if (binding.field !== undefined) replaceSelectedLocation(target as import('../cell-runtime').Location<unknown>, value, selection);\n    else {\n      if (!binding.replaceSelected) throw new Error('Selected row replacement has no private continuation');\n      binding.replaceSelected(value, selection);\n    }")
 s=s.replace('invoke(row,()=>row(value))','invoke(row,value,()=>row(value))').replace('invoke(target,()=>target.set(effect.after))','invoke(target,effect.after,()=>target.set(effect.after))').replace('invoke(target,()=>target(effect.after))','invoke(target,effect.after,()=>target(effect.after))')
 return s
edit(Path('lib/internals/causal-runtime/tree-realization-adapter.ts'),adapter)
