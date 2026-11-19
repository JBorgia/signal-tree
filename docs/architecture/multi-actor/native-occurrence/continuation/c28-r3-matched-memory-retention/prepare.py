from pathlib import Path
import json,hashlib,shutil,difflib
r=Path(__file__).parent;prior=Path('/private/tmp/st-c28-r3-matched-memory');h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
original=(prior/'ORIGINAL.spec.ts').read_text();template=(prior/'INSTRUMENTED-TEMPLATE.spec.ts').read_text();helperEnd=template.index('// END MEMORY-ONLY INSTRUMENTATION\n')+len('// END MEMORY-ONLY INSTRUMENTATION\n')
assert ''.join(l for l in template[helperEnd:].splitlines(True) if '// MEMORY-ONLY' not in l)==original
review=[]
for d in sorted((prior/'runs').iterdir()):
 if not (d/'RESULT.json').exists():continue
 res=json.loads((d/'RESULT.json').read_text());raw=[json.loads(l) for l in (d/'memory.jsonl').read_text().splitlines()];events=[json.loads(l) for l in (d/'events.jsonl').read_text().splitlines()];cases=[c for e in events if e['kind']=='module-end' for c in e['cases']];body=(d/'TEST.spec.ts').read_text();assert body==template.replace('const LARGE = 130_000;',f"const LARGE = {res['size']};")
 assert sum(x['state']=='passed' for x in cases)==2 and sum(x['state']=='failed' for x in cases)==0
 assert res['exit']==0 and not res['remainingOwned'] and not res['runtimeMismatches']
 review.append({'sample':d.name,'worker':raw[0]['pid'],'limit':raw[0]['heapSizeLimit'],'rows':len(raw),'maxHeap':max(x['heapUsed'] for x in raw),'sourceAndTwoCasesVerified':True})
assert len(review)==8 and len({x['worker'] for x in review})==8
(r/'PRIOR-REVIEW.json').write_text(json.dumps(review,indent=2)+'\n')
for arm in ['baseline','indexed']:
 m=json.loads((prior/arm/'MANIFEST.json').read_text());dest=r/arm/'candidate'
 for p,v in m.items():
  src=prior/arm/'candidate'/p
  if p=='packages/kernel/src/lib/entity-large-batches.spec.ts':src=prior/'ORIGINAL.spec.ts'
  assert h(src)==v,(arm,p)
  to=dest/p;to.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,to)
 (dest/'node_modules').symlink_to('/Users/jonathanborgia/code/signaltree/node_modules',target_is_directory=True)
 (r/arm/'MANIFEST.json').write_text(json.dumps(m,indent=2)+'\n')
(r/'ORIGINAL.spec.ts').write_text(original)
template=template.replace("  const sink=process.env['ST_MEMORY_OUTPUT'];", "  if(typeof globalThis.gc !== 'function')throw new Error('Actual worker GC is required');\n  const sink=process.env['ST_MEMORY_OUTPUT'];")
template=template.replace('size:LARGE,...usage','size:LARGE,gcAvailable:typeof globalThis.gc===\'function\',gcCalls:retentionGcCalls,nodeOptions:process.env[\'NODE_OPTIONS\'],...usage')
extra="""// BEGIN RETENTION-ONLY INSTRUMENTATION
let retentionGcCalls = 0;
const retentionDrain = async (): Promise<void> => {
  await flush();
  await new Promise<void>(resolve => setTimeout(resolve, 0));
};
async function retentionSamples(): Promise<void> {
  if(typeof globalThis.gc !== 'function')throw new Error('Actual worker GC is required');
  for(let sample=1;sample<=3;sample++) {
    await retentionDrain();
    globalThis.gc(); retentionGcCalls++;
    await retentionDrain();
    memoryStage(`restoration:gc-drain-${sample}`);
  }
}
// END RETENTION-ONLY INSTRUMENTATION
"""
template=extra+template
template=template.replace("    memoryStage('restoration:after-redo-assertion'); // MEMORY-ONLY", "    memoryStage('restoration:after-redo-assertion'); // MEMORY-ONLY\n    await retentionDrain(); // RETENTION-ONLY\n    memoryStage('restoration:post-workload-drain'); // RETENTION-ONLY")
template=template.replace("    memoryStage('restoration:after-final-drain'); // MEMORY-ONLY", "    memoryStage('restoration:after-final-drain'); // MEMORY-ONLY\n    await retentionDrain(); // RETENTION-ONLY\n    memoryStage('restoration:post-destroy-drain'); // RETENTION-ONLY\n    await retentionSamples(); // RETENTION-ONLY")
(r/'INSTRUMENTED-TEMPLATE.spec.ts').write_text(template)
# Strip both helper blocks and tagged added lines to recover exact source.
body=template.split('// END MEMORY-ONLY INSTRUMENTATION\n',1)[1]
assert ''.join(l for l in body.splitlines(True) if '// MEMORY-ONLY' not in l and '// RETENTION-ONLY' not in l)==original
(r/'instrumentation.patch').write_text(''.join(difflib.unified_diff(original.splitlines(True),template.splitlines(True),fromfile='original.spec.ts',tofile='retention-template.spec.ts')))
shutil.copy2('/private/tmp/st-r3-compatibility-inventory/full-reporter.mjs',r/'reporter.mjs')
print('Prior8 verified; both exact3095-file arms copied; retention instrumentation inverse verified')
