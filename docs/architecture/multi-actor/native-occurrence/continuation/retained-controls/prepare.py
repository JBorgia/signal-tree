from pathlib import Path
import json,hashlib,shutil
p=Path(__file__).resolve().parent
s=p/'retained-source-public-controls.spec.ts'
shutil.copy2(s,p/'FIRST-retained-source-public-controls.spec.ts')
t=s.read_text().replace("type State={visible:number;box?:{s:number;rows?:ReturnType<typeof entityMap<Row,string>>}};\n",'').replace('} as State,','},').replace("type Rows=NonNullable<NonNullable<Tree['$']['box']>['rows']>;","type Rows=Tree['$']['box']['rows'];")
a=t.index('const hide=');b=t.index('function absent',a)
t=t[:a]+'''// Mutations use public whole-value writers; casts permit deliberate omission only.
const hide=(tree:Tree,shape:Shape)=>{
 if(shape==='ancestor')(tree.$ as unknown as (value:unknown)=>void)({visible:1});
 else (tree.$.box as unknown as (value:unknown)=>void)({s:2});
};
// INTERNAL DIAGNOSTIC ONLY: same physical-storage read as absent-collection.spec.ts.
const stored=(rows:Rows)=>(rows as unknown as {
 __prepareTransitionTarget:{readSource():{subjects:readonly {value:unknown}[]}}
}).__prepareTransitionTarget.readSource().subjects.map(({value})=>value);
'''+t[b:]
t=t.replace('reversing ${shape} omission reveals compensated rows and untouched siblings','hidden ${shape} compensation restores physical rows without changing untouched siblings')
t=t.replace('const omission=hide(tree,shape);','hide(tree,shape);').replace("const omission=hide(tree,'ancestor');","hide(tree,'ancestor');")
t=t.replace('// This is deliberately NOT a supplied-value/addOne reveal, which replaces hidden contents.','expect(stored(rows)).toEqual([{id:\'a\',n:7,tag:\'A\'},{id:\'b\',n:3,tag:\'B\'}]);')
a=t.index('  omission.rollback();');b=t.index('\n }finally',a)
t=t[:a]+'''  expect(stored(rows)).toEqual([{id:'a',n:0,tag:'A'},{id:'b',n:3,tag:'B'}]);
  // Public reveal replaces hidden contents; this checks non-resurrection, not compensation.
  rows.addOne({id:'c',n:11,tag:'reveal'});await flush();
  expect(rows.all()).toEqual([{id:'c',n:11,tag:'reveal'}]);
  expect(rows.byId('a')).toBeUndefined();expect(rows.byId('b')).toBeUndefined();'''+t[b:]
t=t.replace('then retry compensates before reveal','then retry compensates while still absent')
a=t.index('  omission.rollback();');b=t.index('\n }finally',a)
t=t[:a]+'''  expect(stored(rows)).toEqual([{id:'a',n:7,tag:'A'},{id:'b',n:9,tag:'B'}]);
  pending.rollback();await flush();absent(tree,rows,'ancestor');
  expect(stored(rows)).toEqual([{id:'a',n:0,tag:'A'},{id:'b',n:3,tag:'B'}]);'''+t[b:]
t=t.replace('let refused=false,failure:unknown;try{pending.rollback();}catch(error){refused=true;failure=error;}','let refused=false;try{pending.rollback();}catch{refused=true;}')
t=t.replace("  if(refused)expect(failure).toMatchObject({code:'SIGNALTREE_ROLLBACK_FAILED',cause:{kind:'effect-validation-failed'}});\n",'')
a=t.index('  omission.rollback();');b=t.index('  if(refused)',a)
t=t[:a]+"  expect(stored(rows)).toEqual([{id:'a',n:99,tag:'new'}]);\n"+t[b:]
t=t.replace('expect(()=>omission.rollback()).toThrow();','')
s.write_text(t)
shutil.copy2(s,p/'candidate/packages/kernel/src/lib'/s.name)
src=Path('/private/tmp/st-retained-source-successor/candidate'); mf=src.parent/'SOURCE-SHA256.json';data=mf.read_bytes();shutil.copy2(mf,p/'MAIN-SOURCE-SHA256.json');dest=p/'main-copy'
for rel,h in json.loads(data).items():
 f=src/rel;content=f.read_bytes();assert hashlib.sha256(content).hexdigest()==h,rel
 out=dest/rel;out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(content)
(dest/'node_modules').symlink_to((p/'candidate/node_modules').resolve(),target_is_directory=True)
shutil.copy2(s,dest/'packages/kernel/src/lib'/s.name)
(p/'PREREGISTRATION.md').write_text('Corrected controls: ordinary omission, physical diagnostic explicitly internal, all mutations public. Expected earliest d3b failure: hidden pending.rollback source lookup, before compensation. Main must restore physical rows while all public views remain absent. Retry checks two preparations, atomic refusal, retained authority and successful retry. Same-key checks isolation only, no prescribed refusal kind. Reveal via addOne checks only non-resurrection; it does not prove retained compensation. Teardown checks saved handles cannot affect another tree. Initial transactional-omission mismatch and optional-shape type errors remain in FIRST spec and first-* logs; they are not runtime regressions. No ordering law asserted.\nMain manifest SHA256: '+hashlib.sha256(data).hexdigest()+'\nSpec SHA256: '+hashlib.sha256(s.read_bytes()).hexdigest()+'\n')
print('Main manifest',hashlib.sha256(data).hexdigest(), 'files',len(json.loads(data)))
