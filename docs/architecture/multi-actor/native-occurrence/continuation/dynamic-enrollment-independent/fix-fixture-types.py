from pathlib import Path
import re,shutil
r=Path(__file__).resolve().parent
p=r/'candidate/packages/kernel/src/lib'
backup=r/'first-type-fixtures';backup.mkdir()
for f in p.glob('independent-*.spec.ts'):
 shutil.copy2(f,backup/f.name)
 s=f.read_text()
 s=re.sub(r'set:v=>(\w+)\.push\(v\)',r'set:v=>{\1.push(v);}',s)
 s=s.replace('set:(v:unknown)=>childSent.push(v)','set:(v:unknown)=>{childSent.push(v);}')
 s=s.replace('t.$({other:1} as Parameters<typeof t.$>[0])',"(t.$ as unknown as (value:{other:number})=>void)({other:1})")
 if f.name=='independent-dynamic-enrollment.spec.ts':
  s=s.replace('t.$.rows.a.deep.x','(t.$.rows.a as {deep:{x:Leaf;y:Leaf};other:Leaf}).deep.x')
  s=s.replace('expect(()=>t.$({fresh:', 'expect(()=>(t.$ as unknown as (value:{fresh:{n:number};trigger:{x:number}[]})=>void)({fresh:')
  s=s.replace('t.$.fresh!.n','(t.$.fresh as unknown as Row).n').replace('t.$.kept.saved(8)','(t.$.kept.saved as Leaf)(8)').replace('t.$.rows.a.n(7)','(t.$.rows.a as Row).n(7)')
 if f.name in ['independent-occurrence-terminal.spec.ts','independent-enrollment-diagnostics.spec.ts']:
  s=s.replace('link(t.$,{','link(t.$ as unknown as (()=>{other:number;branch?:unknown}),{')
 if f.name=='independent-enrollment-diagnostics.spec.ts':
  s=s.replace('t.$.rows.a.n(3)', '(t.$.rows.a as {n:(value:number)=>void}).n(3)')
 f.write_text(s)
