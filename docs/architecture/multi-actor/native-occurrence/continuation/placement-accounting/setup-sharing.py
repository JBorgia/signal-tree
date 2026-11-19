from pathlib import Path
import shutil,json,hashlib
root=Path(__file__).parent
counter='''import type { EntityPlacementStage } from './entity-placement-stage';
let enabled = false;
const totals: Record<string, Record<string, number>> = {};
const physical = new WeakSet<object>();
export function markPhysical(stage: object) { physical.add(stage); }
export function intervalScope(stage: object) { return physical.has(stage) ? 'physicalInterval' : 'ordinaryInterval'; }
export function bump(scope: string, key: string, count = 1) { if(enabled) { const row=totals[scope] ??= {}; row[key]=(row[key] ?? 0)+count; } }
export function* mapEntries<K,V>(map: Map<K,V>, scope: string): Generator<[K,V]> { for(const entry of map) { bump(scope,'mapEntryTuples'); bump(scope,'mapVisits'); yield entry; } }
export function* arrayEntries<T>(entries: readonly T[], scope:string): Generator<T> { for(const entry of entries) { bump(scope,'constructorVisits'); yield entry; } }
export function reset() { for(const key of Object.keys(totals))delete totals[key]; enabled=true; }
export function finish() { enabled=false; return structuredClone(totals); }
'''
fixture='''import { appendFileSync } from 'node:fs';
import { expect,it } from 'vitest';
import { signalTree,entityMap } from '../../index';
import { reset,finish } from './placement-work-counters';
for(const size of [32,128,512]) for(const operation of ['setAll','prependMany'] as const) {
 it(`${operation} ${size}: measured preparation allocations and traversal`,()=>{
  const tree=signalTree({rows:entityMap<{id:number;n:number},number>()});
  const input=Array.from({length:size},(_,id)=>({id,n:id}));
  try { reset(); tree.$.rows[operation](input); const counts=finish();
   expect(tree.$.rows.ids()).toEqual(input.map(row=>row.id));
   expect(tree.$.rows.all()).toEqual(input);
   appendFileSync(process.env.ST_PREPARED_REVIEW_OUTPUT+'/counts.jsonl',JSON.stringify({size,operation,counts})+'\\n');
  }finally{finish();tree.destroy();}
 });
}
'''.replace("from '../../index'","from '../../index'")
# fixture lives lib/physical; index is ../../index.
for label,src in [('sharing','/private/tmp/st-placement-sharing-successor/candidate')]:
 dest=root/label;dest.mkdir();shutil.copytree(src,dest/'candidate',symlinks=True,ignore=shutil.ignore_patterns('node_modules','.nx','.git','dist','coverage'))
 (dest/'candidate/node_modules').symlink_to(Path(src)/'node_modules',target_is_directory=True)
 shutil.copyfile('/private/tmp/st-placement-work-successor/run-gate.py',dest/'run-gate.py')
 r=dest/'candidate/packages/kernel/src/lib';ph=r/'physical'
 (ph/'placement-work-counters.ts').write_text(counter);(ph/'placement-work-accounting.spec.ts').write_text(fixture)
 p=r/'entity-signal.ts';s=p.read_text();s="import { markPhysical } from './physical/placement-work-counters';\n"+s;s=s.replace('const physicalPlacement = frame.preparePlacement();','const physicalPlacement = frame.preparePlacement();\n    markPhysical(physicalPlacement);');p.write_text(s)
 p=ph/'entity-mutation-frame.ts';s=p.read_text();s="import { mapEntries } from './placement-work-counters';\n"+s;s=s.replace('for (const [id, row] of stage.patch)', "for (const [id, row] of mapEntries(stage.patch, 'keyLookup'))");p.write_text(s)
 p=ph/'entity-placement-stage.ts';s=p.read_text()
 if label!='baseline':
  s="import { bump, mapEntries } from './placement-work-counters';\n"+s;s=s.replace('const entries: Array<readonly [number, Readonly<EntityPlacement<K>>]> = [];',"bump('capture','arrays');\n    const entries: Array<readonly [number, Readonly<EntityPlacement<K>>]> = [];")
  s=s.replace('for (const [subject, row] of this.patch)',"for (const [subject, row] of mapEntries(this.patch,'capture'))")
  s=s.replace('Object.freeze([subject, Object.freeze({ ...row })] as const)',"(bump('capture','explicitTuples'), bump('capture','rowClones'), bump('capture','freezes',2), Object.freeze([subject, Object.freeze({ ...row })] as const))")
  s=s.replace('for (const entry of this.patch)', "for (const entry of mapEntries(this.patch,'capture'))");s=s.replace('entry[1] = Object.freeze', "bump('capture','rowClones'); bump('capture','freezes',2); entry[1] = Object.freeze");s=s.replace('return Object.freeze(entries);',"bump('capture','freezes'); return Object.freeze(entries);");p.write_text(s)
 p=ph/'entity-ordinary-topology.ts';s=p.read_text();s="import { bump, mapEntries, intervalScope } from './placement-work-counters';\n"+s
 if label=='baseline':
  s=s.replace('const pairs = [...stage.patch].flatMap',"const scope=intervalScope(stage); bump(scope,'arrays',2);\n    const pairs = [...mapEntries(stage.patch,scope)].flatMap")
 else:
  s=s.replace('entries: PreparedPlacementEntries<K> = [...stage.patch]', 'entries?: PreparedPlacementEntries<K>')
  s=s.replace('const pairs = (entries ?? [...stage.patch]).flatMap', 'const pairs = entries.flatMap');s=s.replace('const pairs = entries.flatMap',"const scope=intervalScope(stage); bump(scope,'arrays');\n    const input=entries ?? (bump(scope,'arrays'), [...mapEntries(stage.patch,scope)]);\n    const pairs = input.flatMap")
 s=s.replace('const before = stage.base(subject);',"bump(scope,'arrayVisits'); const before = stage.base(subject);")
 s=s.replace('return equal\n        ? []\n        : [',"bump(scope,'arrays');\n      if(!equal) { bump(scope,'rowClones',entries && Object.isFrozen(after)?1:2); bump(scope,'pairRecords'); bump(scope,'freezes',entries && Object.isFrozen(after)?2:3); bump(scope,'flattenVisits'); }\n      return equal\n        ? []\n        : [")
 s=s.replace('return Object.freeze({\n      before: this.continuity,',"bump(scope,'intervalRecords'); bump(scope,'freezes',2); if(pairs.length)bump(scope,'continuityRecords');\n    return Object.freeze({\n      before: this.continuity,")
 p.write_text(s)
 p=ph/'prepared-placement-visibility.ts';s=p.read_text();s="import { bump, mapEntries, arrayEntries } from './placement-work-counters';\n"+s
 start=s.index('    const present = new Map(');end=s.index('    const visited =',start)
 s=s[:start]+'''    const scope='visibilitySeed';
    const seed = '''+("(bump(scope,'arrays'), [...mapEntries(physical.patch,scope)])" if label=='baseline' else "entries ?? (bump(scope,'arrays'), [...mapEntries(physical.patch,scope)])")+''';
    bump(scope,'arrays');
    const filtered = seed.filter((entry): entry is readonly [number, Extract<(typeof entry)[1], {present:true}>] => { bump(scope,'arrayVisits'); return entry[1].present; });
    bump(scope,'maps');
    const present = new Map(arrayEntries(filtered,scope));
'''+s[end:];p.write_text(s)
print('diagnostic copies ready')
