from pathlib import Path
import hashlib,json,shutil,difflib
root=Path('/private/tmp/st-c28-r3-state-repair');base=Path('/private/tmp/st-c28-r3-comparator');m=json.loads((base/'MANIFEST.json').read_text());root.joinpath('BASE-MANIFEST.json').write_bytes((base/'MANIFEST.json').read_bytes())
for arm in ['trace','candidate']:
 dest=root/arm
 for f,v in m.items():
  src=base/'candidate'/f;b=src.read_bytes();assert hashlib.sha256(b).hexdigest()==v,f
  out=dest/f;out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(b);shutil.copymode(src,out)
 (dest/'node_modules').symlink_to('/Users/jonathanborgia/code/signaltree/node_modules',target_is_directory=True)
f='packages/kernel/src/enhancers/transactions/transactions.ts';p=root/'trace'/f;s=p.read_text();s="import {appendFileSync as stateTraceAppend} from 'node:fs';\nfunction stateTrace(event:unknown):void{const path=process.env.ST_STATE_TRACE;if(path)stateTraceAppend(path,JSON.stringify(event)+'\\n');}\n"+s
needle='    const recorded = resolveTransactionId(meta);';assert s.count(needle)==1
s=s.replace(needle,needle+"\n    stateTrace({kind:'capture-probe',path,next,prev,id:recorded,participation:getWriteParticipation(meta),origin:meta?.origin,dedup:recorded!==undefined&&installedOperations.get(recorded)?.owners.has(resolvedPositionIds[0])});")
needle='    const externalEffects = callbackExternalEffects.get(transactionId) ?? [];';s=s.replace(needle,needle+"\n    stateTrace({kind:'materialize',transactionId,effects:effects.map(e=>({kind:e.kind,path:e.path,...(e.kind==='set'?{before:e.before,after:e.after}:{})})),externalEffects});")
needle='''          ) => {
            if (
              isRestoring ||''';assert s.count(needle)==1
s=s.replace(needle,'''          ) => {
            stateTrace({kind:'terminal-prepare',path,next,prev,id:resolveTransactionId(meta),participation:getWriteParticipation(meta),origin:meta?.origin,isRestoring});
            if (
              isRestoring ||''')
p.write_text(s)
patch=''.join(difflib.unified_diff((base/'candidate'/f).read_text().splitlines(True),s.splitlines(True),fromfile='a/'+f,tofile='b/'+f));(root/'TRACE.patch').write_text(patch)
(root/'PREPARATION.json').write_text(json.dumps({'baseManifest':hashlib.sha256((base/'MANIFEST.json').read_bytes()).hexdigest(),'baseFiles':len(m),'traceFiles':[f],'fixtureUnchanged':True},indent=2))
print('prepared',len(m))
