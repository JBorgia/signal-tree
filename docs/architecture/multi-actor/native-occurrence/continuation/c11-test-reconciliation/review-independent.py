from pathlib import Path
import subprocess,json
p=Path(__file__).parent;d=p/'independent-review';d.mkdir(exist_ok=True)
prompt='''Independently review a test-only reconciliation patch. You have no tools; use the complete supplied originals, diff, runtime source excerpts and raw evidence. Do not infer a preferred verdict. Identify whether expectations preserve useful falsifiers, are justified by current contracts, weaken behavior, or introduce type/runtime issues. Owner authorizes acquisition-independent fresh SignalTree reads but no new runtime/publicsurface policy. Requires full current metadata shape; reentry atomicity/retry/redo retained; complete structural removal recipes; occupancy success must not become refusal-only without valid-state paired success. One occupancy fixture is unchanged; determine whether leaving it open is warranted and what fixture is needed. Report blocking findings with source locations or no blocker demonstrated, and run/not-run limits. This is not release approval. Do not claim to have run commands.\n'''
for n in json.loads((p/'CHANGED.json').read_text())+['packages/kernel/src/lib/occupancy-successor-realization.spec.ts','packages/kernel/src/lib/complete-structural-sequence.spec.ts','packages/kernel/src/lib/structural-completeness.spec.ts']:
 prompt+='\nORIGINAL '+n+'\n'+(p/'original'/n).read_text()
prompt+='\nPROPOSED PATCH\n'+(p/'TESTS.patch').read_text()
for n,spans in [('packages/kernel/src/lib/internals/scalar-publication-coverage.ts',[(1,62)]),('packages/kernel/src/lib/internals/intercept-leaf-signals.ts',[(17,47),(135,180),(230,260)]),('packages/kernel/src/lib/internals/causal-runtime/tree-realization-adapter.ts',[(490,566),(1625,1645)]),('packages/kernel/src/lib/entity-signal.ts',[(758,804)]),('packages/kernel/src/index.ts',[(92,97)]),('docs/review-contract.md',[(1,35)])]:
 lines=(p/'original'/n).read_text().splitlines();prompt+='\nSOURCE '+n+'\n'
 for lo,hi in spans:
  prompt+='\n'.join(f'{i+1}: {lines[i]}' for i in range(lo-1,min(hi,len(lines))))+'\n'
raw=(p.parent/'c11-second-classification/runs/candidate-original/first.log').read_text();prompt+='\nORIGINAL RAW prior same exact C11 selected run\n'+raw[raw.index(' RUN  v'):]
(d/'PROMPT.txt').write_text(prompt)
a=['/Users/jonathanborgia/.local/bin/claude','-p','--tools','','--strict-mcp-config','--mcp-config','{"mcpServers":{}}','--setting-sources','','--settings','{"disableAllHooks":true}','--no-session-persistence','--output-format','json']
(d/'COMMAND.json').write_text(json.dumps({'cwd':str(d),'argv':a,'stdin':'PROMPT.txt'},indent=2))
with (d/'first.stdout').open('w') as o,(d/'first.stderr').open('w') as e:r=subprocess.run(a,input=prompt,text=True,cwd=d,stdout=o,stderr=e)
(d/'RESULT.json').write_text(json.dumps({'exit':r.returncode}));print('independent review',r.returncode)
