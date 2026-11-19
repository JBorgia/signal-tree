from pathlib import Path
import re,difflib,json,hashlib
p=Path(__file__).parent;root=p/'candidate/packages/kernel/src/lib'
f=root/'internals/intercept-leaf-signals.spec.ts';s=f.read_text();at=s.index("describe('interceptLeafSignals")
helper='''// Scalar callbacks carry an uncovered private receipt even without write context.
// Check every own field and descriptor; do not discard symbols or accept subsets.
function expectScalarMetadata(
  actual: WriteMetadata | undefined,
  fields: WriteMetadata
): void {
  if (actual === undefined) throw new Error('Scalar callback metadata missing');
  expect(Object.getPrototypeOf(actual)).toBe(Object.prototype);
  expect(Object.getOwnPropertyNames(actual).sort()).toEqual(Object.keys(fields).sort());
  for (const [key, value] of Object.entries(fields)) {
    expect(Object.getOwnPropertyDescriptor(actual, key)).toEqual({
      value, enumerable: true, configurable: true, writable: true,
    });
  }
  const symbols = Object.getOwnPropertySymbols(actual);
  expect(symbols).toHaveLength(1);
  expect(symbols[0].description).toBe('ScalarPublicationCoverage');
  expect(Object.getOwnPropertyDescriptor(actual, symbols[0])).toEqual({
    value: undefined, enumerable: true, configurable: true, writable: true,
  });
}

'''
s=s[:at]+helper+s[at:]
s,n=re.subn(r'expect\((list\[\d\]\.meta)\)\.toEqual\(',r'expectScalarMetadata(\1, ',s);assert n==7
s=s.replace('passes meta=undefined when no withWriteContext frame is active','supplies mutation intent and an uncovered receipt when no write context is active')
f.write_text(s)
f=root/'internals/causal-runtime/heterogeneous-live-subject.spec.ts';s=f.read_text();assert s.count("mode === 'throw' ? sentinel : /stale/")==1
s=s.replace("expect(() => t.undo()).toThrow(mode === 'throw' ? sentinel : /stale/);", "// Reentry is rejected during joint preparation, before the install guard.\n        expect(() => t.undo()).toThrow(\n          mode === 'throw' ? sentinel : 'Joint preparation reentered installation'\n        );")
f.write_text(s)
f=root/'structural-admission-sequence.spec.ts';s=f.read_text();old=" const remove=(subjectId:number,before:string|number):ReversalEffect=>({owner,subjectId,before,after:undefined,structural:'remove'});"
assert old in s
s=s.replace(old,''' // Preserve the seeded existence recipe independently of later physical inspection.
 const removalRecipes=new Map([
  [a,{key:1,value:{id:1}}],
  [b,{key:2,value:{id:2}}],
 ]);
 const remove=(subjectId:number,before:string|number):ReversalEffect=>{
  const recipe=removalRecipes.get(subjectId);
  if(!recipe)throw new Error('Removal fixture has no captured existence recipe');
  return {owner,subjectId,before,after:undefined,structural:'remove',structuralContext:{kind:'remove',subject:subjectId,...recipe}};
 };''')
f.write_text(s)
changes=[];patch=[]
m=json.loads((p/'SNAPSHOT-C11-INPUT.json').read_text())
for n in m:
 a=p/'original'/n;b=p/'candidate'/n
 if a.read_bytes()!=b.read_bytes():
  assert n.endswith('.spec.ts'),n
  changes.append(n);patch.extend(difflib.unified_diff(a.read_text().splitlines(True),b.read_text().splitlines(True),fromfile='a/'+n,tofile='b/'+n))
(p/'TESTS.patch').write_text(''.join(patch));(p/'CHANGED.json').write_text(json.dumps(changes,indent=2)+'\n');print('\n'.join(changes))
