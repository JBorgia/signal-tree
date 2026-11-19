from pathlib import Path
import json,hashlib,shutil,difflib
r=Path(__file__).resolve().parent;orig=Path('/private/tmp/st-c28-r3-comparator');idx=Path('/private/tmp/st-c28-r3-disposition-index');h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();m=json.loads((orig/'MANIFEST.json').read_text());assert h(orig/'MANIFEST.json')=='e0b64de42df330abff455d2ee1b981c99abee187a77269cd064f52f3b08505f3';assert json.loads((idx/'BASE-MANIFEST.json').read_text())==m
adapter='packages/kernel/src/lib/internals/causal-runtime/tree-realization-adapter.ts';test='packages/kernel/src/lib/entity-large-batches.spec.ts';indexHash='0e9e8347f26bec9a360b0db5080fb52b0949b3f30da011db93efe018a8d57fce';assert h(idx/'candidate'/adapter)==indexHash
for arm,base in [('baseline',orig),('indexed',idx)]:
 expected=dict(m)
 if arm=='indexed':expected[adapter]=indexHash
 c=r/arm/'candidate'
 for p,v in expected.items():
  src=base/'candidate'/p;assert h(src)==v,(arm,p);dest=c/p;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dest);assert h(dest)==v
 (c/'node_modules').symlink_to('/Users/jonathanborgia/code/signaltree/node_modules',target_is_directory=True)
 (r/arm/'MANIFEST.json').write_text(json.dumps(expected,indent=2)+'\n')
source=(orig/'candidate'/test).read_text();(r/'ORIGINAL.spec.ts').write_text(source)
helper="""// BEGIN MEMORY-ONLY INSTRUMENTATION
import { appendFileSync as appendMemoryRow } from 'node:fs';
import { getHeapStatistics as memoryHeapStatistics } from 'node:v8';
function memoryStage(stage: string): void {
  const sink=process.env['ST_MEMORY_OUTPUT'];
  if(!sink)throw new Error('ST_MEMORY_OUTPUT is required');
  const usage=process.memoryUsage(),v8=memoryHeapStatistics();
  appendMemoryRow(sink,JSON.stringify({stage,at:Date.now(),pid:process.pid,node:process.version,execArgv:process.execArgv,size:LARGE,...usage,heapSizeLimit:v8.heap_size_limit,totalAvailableSize:v8.total_available_size,usedHeapSize:v8.used_heap_size,numberOfNativeContexts:v8.number_of_native_contexts,numberOfDetachedContexts:v8.number_of_detached_contexts})+'\\n');
}
// END MEMORY-ONLY INSTRUMENTATION
"""
# Only insert standalone output statements; exact inverse must recover original body.
lines=source.splitlines(True);out=[];which=None;treeCreation=False
for line in lines:
 if "it('setAll, replace and clear with membership observed'" in line:which='membership'
 if "it('undo and redo of a setAll that replaced every row'" in line:which='restoration'
 def mark(tag):out.append("    memoryStage('"+which+':'+tag+"'); // MEMORY-ONLY\n")
 if which:
  stripped=line.strip()
  if stripped.startswith('const tree = signalTree'):mark('before-create');treeCreation=True
  if stripped=='tree.$.rows.setAll(rows(LARGE));':mark('before-seed')
  if stripped=='tree.$.rows.setAll(rows(LARGE, LARGE));' or stripped.startswith('undoable(() => tree.$.rows.setAll'):mark('before-replace')
  if stripped=='tree.$.rows.setAll([]);':mark('before-clear')
  if stripped=='tree.undo();':mark('before-undo')
  if stripped=='tree.redo();':mark('before-redo')
  if stripped=='stop();':mark('before-stop')
  if stripped=='tree.destroy();':mark('before-destroy')
 out.append(line)
 if which:
  if treeCreation and (line.strip().endswith(');')):mark('after-create');treeCreation=False
  stripped=line.strip()
  if stripped=='tree.$.rows.setAll(rows(LARGE));':mark('after-seed')
  if stripped=='tree.$.rows.setAll(rows(LARGE, LARGE));' or stripped.startswith('undoable(() => tree.$.rows.setAll'):mark('after-replace')
  if stripped=='await flush();':mark('after-original-drain')
  if stripped=='tree.$.rows.setAll([]);':mark('after-clear')
  if stripped=='expect(events).toBeGreaterThan(0);':mark('after-original-assertions')
  if stripped=='tree.undo();':mark('after-undo')
  if stripped=='expect(tree.$.rows.ids()[0]).toBe(0);':mark('after-undo-assertions')
  if stripped=='tree.redo();':mark('after-redo')
  if stripped=='expect(tree.$.rows.ids()[0]).toBe(LARGE);':mark('after-redo-assertion')
  if stripped=='stop();':mark('after-stop')
  if stripped=='tree.destroy();':mark('after-destroy')
  if stripped.startswith('}, 60_000)') or stripped.startswith('}, 120_000)'):
   # Final drain only after completed restoration teardown; original synchronous membership case unchanged.
   if which=='restoration':
    out.pop();out.append('    await flush(); // MEMORY-ONLY final bounded drain\n');mark('after-final-drain');out.append(line)
   which=None
instrumented=helper+''.join(out)
recovered=''.join(l for l in instrumented[len(helper):].splitlines(True) if '// MEMORY-ONLY' not in l)
assert recovered==source
(r/'INSTRUMENTED-TEMPLATE.spec.ts').write_text(instrumented)
(r/'instrumentation.patch').write_text(''.join(difflib.unified_diff(source.splitlines(True),instrumented.splitlines(True),fromfile='original.spec.ts',tofile='instrumented-template.spec.ts')))
(r/'IDENTITY.json').write_text(json.dumps({'baselineManifest':h(orig/'MANIFEST.json'),'indexedBaseEntryMapEqual':True,'entries':len(m),'runtimeDeltaOnly':adapter,'baselineAdapter':m[adapter],'indexedAdapter':indexHash,'originalTest':h(orig/'candidate'/test),'inverseInstrumentationEqualsOriginal':True,'helperAppendsOnly':True},indent=2)+'\n')
print('Verified two3095-file arms; only adapter differs; instrumentation invertible; no tests launched.')
