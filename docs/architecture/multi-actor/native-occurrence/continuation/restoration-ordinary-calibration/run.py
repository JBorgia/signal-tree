from pathlib import Path
import json,os,hashlib,subprocess,sys,difflib
p=Path(__file__).resolve().parent;c=p/'candidate';arm=sys.argv[1];d=p/'runs'/arm;d.mkdir(parents=True,exist_ok=False)
for name in ['tmp','nx-cache','nx-data','observations']:(d/name).mkdir()
f=c/'packages/kernel/src/lib/internals/causal-runtime/tree-realization-adapter.ts';original=f.read_bytes();source=original.decode();changed=source
if arm=='mutant-validation':
 needle='''  for (const effect of effects) {
    if (
      !canApplyEffect('''
 replacement='''  for (const effect of effects) {
    // TEST MUTANT: repeat actual per-effect validation and discard its result.
    canApplyEffect(tree, descriptors, structuralOwnerPaths, scalarSlotRuntime, effect, preparedContext);
    if (
      !canApplyEffect('''
 assert source.count(needle)==1;changed=source.replace(needle,replacement)
elif arm=='mutant-snapshot':
 needle="  const rowNode = collectionNode.byIdOrFail(key);\n  return typeof rowNode === 'function' ? rowNode() : rowNode;"
 replacement="  const rowNode = collectionNode.byIdOrFail(key);\n  // TEST MUTANT: repeat real row snapshot materialization, discarding the first result.\n  if (typeof rowNode === 'function') rowNode();\n  return typeof rowNode === 'function' ? rowNode() : rowNode;"
 assert source.count(needle)==1;changed=source.replace(needle,replacement)
else:assert arm in ['baseline','source-types','spec-types']
(d/'mutant.patch').write_text(''.join(difflib.unified_diff(source.splitlines(True),changed.splitlines(True),fromfile='a/'+str(f.relative_to(c)),tofile='b/'+str(f.relative_to(c)))))
env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_NO_CLOUD='true',NX_TUI='false',NX_CACHE_DIRECTORY=str(d/'nx-cache'),NX_WORKSPACE_DATA_DIRECTORY=str(d/'nx-data'),TMPDIR=str(d/'tmp'),ST_TRACE_OUTPUT=str(d/'observations'))
argv=['corepack','pnpm','nx','test','kernel','restoration-paired-work.spec.ts','--skip-nx-cache','--maxWorkers=1']
if arm=='source-types':argv=['corepack','pnpm','run','typecheck']
if arm=='spec-types':argv=['corepack','pnpm','exec','node','tools/check-spec-types.mjs']
env.pop('ST_TRACE_OUTPUT',None)
env.pop('ST_PREPARED_REVIEW_OUTPUT',None)
(d/'COMMAND.json').write_text(json.dumps({'cwd':str(c),'argv':argv,'env':{k:v for k,v in env.items() if k.startswith(('NX_','ST_')) or k in ['PATH','TMPDIR']}},indent=2))
def sha(b):return hashlib.sha256(b).hexdigest()
try:
 f.write_text(changed)
 with (d/'first.log').open('w') as log:r=subprocess.run(argv,cwd=c,env=env,stdout=log,stderr=subprocess.STDOUT,timeout=180)
 result={'exit':r.returncode,'before':sha(original),'during':sha(changed.encode())}
finally:
 f.write_bytes(original)
 (d/'RESTORED.json').write_text(json.dumps({'before':sha(original),'after':sha(f.read_bytes()),'equal':original==f.read_bytes()},indent=2))
(d/'RESULT.json').write_text(json.dumps(result,indent=2));print(result)
