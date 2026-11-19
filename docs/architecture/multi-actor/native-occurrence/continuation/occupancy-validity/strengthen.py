from pathlib import Path
p=Path(__file__).parent;root=p/'candidate/packages/kernel/src/lib';s=(root/'independent-occupancy-remove-inverse.spec.ts').read_text()
s="import {getOwnedPositionIds,getOwnedSubjectIds} from './internals/owned-mutation';\nimport type {ReversalEffect} from './internals/causal-runtime/causal-types';\n"+s
marker="  const adds:string[]=[]"
assert marker in s
s=s.replace(marker,'''  const owner=getOwnedPositionIds(rows)![0];
  const ordinaryPresent=(subjectId:number,key:string)=>
   (rows as unknown as {__validateOrdinaryStructure(effects:readonly ReversalEffect[]):boolean}).__validateOrdinaryStructure([{owner,subjectId,before:key,after:undefined,structural:'remove'}]);
  const as=getOwnedSubjectIds(a.n)![0],bs=getOwnedSubjectIds(b.n)![0],freshBs=getOwnedSubjectIds(freshB.n)![0];
  expect(ordinaryPresent(as,'a')).toBe(false);expect(ordinaryPresent(bs,'b')).toBe(false);
  expect(ordinaryPresent(freshBs,'b')).toBe(true);
  expect(replacement.inspect().changes.length).toBeGreaterThanOrEqual(2);
  const adds:string[]=[]''')
marker="  const p=tree.transact(()=>b.n(88));"
s=s.replace(marker,"  expect(ordinaryPresent(as,'a')).toBe(true);expect(ordinaryPresent(bs,'b')).toBe(true);expect(ordinaryPresent(freshBs,'b')).toBe(false);\n"+marker)
(root/'independent-occupancy-supported-inverse.spec.ts').write_text(s)
