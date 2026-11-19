from pathlib import Path
import difflib
r=Path(__file__).resolve().parent;p=r/'INSTRUMENTED-TEMPLATE.spec.ts';s=p.read_text()
s="import {start as sampleStart,stop as sampleStop,close as sampleClose} from '"+str(r/'harness.mjs')+"'; // SAMPLING-ONLY\n"+s
s=s.replace('    await flush(); // MEMORY-ONLY final bounded drain\n','').replace("    memoryStage('restoration:after-final-drain'); // MEMORY-ONLY\n",'')
s=s.replace("    memoryStage('restoration:before-replace'); // MEMORY-ONLY", "    memoryStage('restoration:before-replace'); // MEMORY-ONLY\n    sampleStart('replacement'); // SAMPLING-ONLY")
s=s.replace("    memoryStage('restoration:after-replace'); // MEMORY-ONLY\n",'')
needle='      undoable(() => tree.$.rows.setAll(rows(LARGE, LARGE)));\n      await flush();'
assert needle in s;s=s.replace(needle,needle+"\n    sampleStop('replacement'); // SAMPLING-ONLY")
for stage in ['undo','redo']:
 s=s.replace("    memoryStage('restoration:before-"+stage+"'); // MEMORY-ONLY", "    memoryStage('restoration:before-"+stage+"'); // MEMORY-ONLY\n    sampleStart('"+stage+"'); // SAMPLING-ONLY")
 needle='      tree.'+stage+'();\n'+"    memoryStage('restoration:after-"+stage+"'); // MEMORY-ONLY";assert s.count(needle)==1;s=s.replace(needle,'      tree.'+stage+'();\n'+"    sampleStop('"+stage+"'); // SAMPLING-ONLY\n"+"    memoryStage('restoration:after-"+stage+"'); // MEMORY-ONLY")
# Cleanup at the outer test finally, after original destruction; no effect on first workload exception.
s=s.replace("    memoryStage('restoration:after-destroy'); // MEMORY-ONLY", "    memoryStage('restoration:after-destroy'); // MEMORY-ONLY\n    sampleClose(); // SAMPLING-ONLY")
p.write_text(s)
body=s.split('// END MEMORY-ONLY INSTRUMENTATION\n',1)[1]
assert ''.join(l for l in body.splitlines(True) if '// MEMORY-ONLY' not in l and '// SAMPLING-ONLY' not in l)==(r/'ORIGINAL.spec.ts').read_text()
(r/'sampling-overlay.patch').write_text(''.join(difflib.unified_diff((r/'ORIGINAL.spec.ts').read_text().splitlines(True),s.splitlines(True),fromfile='a/entity-large-batches.spec.ts',tofile='b/entity-large-batches.spec.ts')))
s=Path('/private/tmp/st-c28-r3-matched-memory/run.py').read_text();a=s.index('schedule=[');b=s.index(';results=[]',a)
s=s[:a]+"schedule=[('baseline',2048,1),('indexed',2048,1)]"+s[b:]
s=s.replace("memory[-1]['stage']=='restoration:after-final-drain'","memory[-1]['stage']=='restoration:after-destroy'")
s=s.replace("if arm in previous and n>previous[arm]['n'] and delta>64*1024**2 and delta>8*previous[arm]['delta']:steep=True",'# Fixed caps only, not allocation-slope inference.')
s=s.replace("source=verify(arm);steep=False", "source=verify(arm);steep=False\n protocol=[json.loads(x) for x in (d/'protocol.jsonl').read_text().splitlines()] if (d/'protocol.jsonl').exists() else []\n stops=[x for x in protocol if x['kind']=='stop-result'];valid=valid and [x['stage'] for x in stops]==['replacement','undo','redo'] and all(x['synchronous'] and x['startSynchronous'] for x in stops)")
(r/'run.py').write_text(s)
print('Original bodies invert exactly; two-worker schedule ready, no cardinality/runtime overlay.')
