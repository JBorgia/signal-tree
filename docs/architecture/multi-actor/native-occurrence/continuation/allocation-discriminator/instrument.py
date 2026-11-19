from pathlib import Path
import shutil,re,json,hashlib
root=Path('/private/tmp/st-publication-allocation-discriminator')
helper='''// Diagnostic counters only: source-issued sites; no payload retention or timing.
type Counts={containers:number;copiedEntries:number;sets:number;newEntries:number;arrays:number;arrayEntries:number};
const counts:Record<string,Counts>=Object.create(null);
const at=(site:string)=>counts[site]??=( {containers:0,copiedEntries:0,sets:0,newEntries:0,arrays:0,arrayEntries:0});
export function resetAllocation(){for(const key of Object.keys(counts))delete counts[key];}
export function allocationSnapshot(){return JSON.parse(JSON.stringify(counts)) as Record<string,Counts>;}
export function countedArray<T>(site:string,value:T[]):T[]{const c=at(site);c.arrays++;c.arrayEntries+=value.length;return value;}
export class AllocationMap<K,V> extends Map<K,V>{
 constructor(private site:string,entries?:Iterable<readonly [K,V]>|null){super();const c=at(site);c.containers++;if(entries)for(const [k,v]of entries){c.copiedEntries++;if(!super.has(k))c.newEntries++;super.set(k,v);}}
 override set(k:K,v:V):this{const c=at(this.site);c.sets++;if(!super.has(k))c.newEntries++;return super.set(k,v);}
}
'''
ident={}
for arm,src in [('row',Path('/private/tmp/st-row-source-successor/candidate')),('retirement',Path('/private/tmp/st-publication-retirement-successor/candidate'))]:
 dest=root/arm
 shutil.copytree(src,dest,symlinks=True,ignore=shutil.ignore_patterns('.git','.nx','dist','coverage'))
 lib=dest/'packages/kernel/src/lib';(lib/'allocation-diagnostic.ts').write_text(helper)
 files=['experimental-publication/entity.ts','internals/entity-publication.ts'];ident[arm]={}
 for rel in files:
  file=lib/rel;s=file.read_text();ident[arm][rel]={'original':hashlib.sha256(s.encode()).hexdigest()}
  if rel.startswith('experimental'):
   # Count only Map constructors in the native entity publication module, preserving every iteration and value.
   out='';last=0
   for m in re.finditer(r'new Map(?=[<(])',s):
    start=m.start();j=m.end();generic=''
    if s[j]=='<':
     a=j;depth=0
     while j<len(s):
      if s[j]=='<':depth+=1
      elif s[j]=='>':
       depth-=1
       if depth==0:j+=1;break
      j+=1
     generic=s[a:j]
    assert s[j]=='(',s[j:j+30]
    line=s[:start].count('\n')+1;site=f'entity.ts:{line}:{start-s.rfind(chr(10),0,start)}'
    comma='' if s[j+1]==')' else ','
    out+=s[last:start]+f'new AllocationMap{generic}("{site}"{comma}';last=j+1
   s=out+s[last:]
   s=s.replace('[...entityPublicationOrdinary(packet)].reverse()',"countedArray('proposal-copy', [...entityPublicationOrdinary(packet)]).reverse()")
   if 'mappings:mappings.size' not in s:s=s.replace('preparedFieldEdits:acquisitions','mappings:mappings.size,mappingViews:mappingViews.size,preparedFieldEdits:acquisitions')
   s="import {AllocationMap,countedArray} from '../allocation-diagnostic';\n"+s
  else:
   s=s.replace('return packet.steps.flatMap(step => {',"return countedArray('ordinary-flatMap', packet.steps.flatMap(step => {")
   s=s.replace('? [...step.ordinary, removal] : step.ordinary;\n  });','? [...step.ordinary, removal] : step.ordinary;\n  }));')
   s="import {countedArray} from '../allocation-diagnostic';\n"+s
  file.write_text(s);ident[arm][rel]['instrumented']=hashlib.sha256(s.encode()).hexdigest()
(root/'IDENTITY.json').write_text(json.dumps(ident,indent=2)+'\n')
