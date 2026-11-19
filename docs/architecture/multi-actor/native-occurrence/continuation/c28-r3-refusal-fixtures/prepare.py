from pathlib import Path
import json,hashlib,shutil,difflib
p=Path(__file__).parent;b=Path('/private/tmp/st-c28-r3-comparator/candidate');mp=Path('/private/tmp/st-c28-r3-comparator/MANIFEST.json');m=json.loads(mp.read_text());h=lambda f:hashlib.sha256(f.read_bytes()).hexdigest();c=p/'candidate';c.mkdir()
for f,v in m.items():
 assert h(b/f)==v,f
 d=c/f;d.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(b/f,d)
assert {f:h(b/f) for f in m}==m
(c/'node_modules').symlink_to('/Users/jonathanborgia/code/signaltree/node_modules',target_is_directory=True)
shutil.copy2(mp,p/'BASE-MANIFEST.json');shutil.copy2('/private/tmp/st-c28-r3-full-failure-review/REVIEW.md',p/'INPUT-REVIEW.md')
paths=['packages/kernel/src/enhancers/restoration/restoration.spec.ts','packages/kernel/src/lib/transaction-observer-failure.spec.ts','packages/kernel/src/lib/opaque-leaf-restoration-v16-controls.spec.ts','packages/kernel/src/enhancers/transactions/transaction-lifecycle-view.spec.ts']
for f in paths:
 d=p/'originals'/f;d.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(c/f,d)
# Only the first two selected-route success observers; legacy fallback spies untouched.
f=paths[0];s=(c/f).read_text()
old="    const applySpy = vi.spyOn(realizationPort, 'applyAtomically');"
new="    // Selected scalar compensation prepares on this port; public restored values below witness installation.\n    const prepareSpy = vi.spyOn(realizationPort, 'prepareSelectedUnit');\n    try {"
s=s.replace(old,new,2).replace('    expect(applySpy).toHaveBeenCalledTimes(1);','    expect(prepareSpy).toHaveBeenCalledTimes(1);',2)
a="    expect(turns).toHaveLength(baseline);\n  });";assert a in s;s=s.replace(a,"    expect(turns).toHaveLength(baseline);\n    } finally { prepareSpy.mockRestore(); }\n  });",1)
a="      b: { y: 20 },\n    });\n  });";assert a in s;s=s.replace(a,"      b: { y: 20 },\n    });\n    } finally { prepareSpy.mockRestore(); }\n  });",1);(c/f).write_text(s)
# Exactly five identified refusal injections, retain all public assertions and recovery actions.
f=paths[1];s=(c/f).read_text()
old="""    const port = getTreeRealizationPort(tree.$ as object) as {
      validateEffects: (...args: unknown[]) => unknown;
    };
    const original = port.validateEffects;
    port.validateEffects = () => ({ kind: 'structural-drift' });"""
new="""    const port = getTreeRealizationPort(tree.$ as object);
    if (!port?.prepareSelectedUnit) throw new Error('Expected selected preparation port');
    const original = port.prepareSelectedUnit;
    const refusal = new Error('injected pre-install selected preparation failure: structural-drift');
    let refusalCalls = 0, returnedPlans = 0;
    port.prepareSelectedUnit = function (...args) {
      refusalCalls++;
      if (refusalCalls === 1) throw refusal; // No original call or installable plan.
      const plan = original.apply(this, args); returnedPlans++; return plan;
    };"""
assert s.count(old)==5;s=s.replace(old,new);s=s.replace('port.validateEffects = original;','port.prepareSelectedUnit = original;')
# Insert reach/no-plan assertions only in each affected test, after fault/cleanup and before public outcome checks.
chunks=s.split("  it(")
for i,chunk in enumerate(chunks):
 if 'let refusalCalls = 0, returnedPlans = 0;' not in chunk:continue
 if '      const recovery = (' in chunk:
  # console-precedence test must keep its original first error precedence assertion; counters can precede recovery.
  chunk=chunk.replace('      const recovery = (','      expect(refusalCalls).toBe(1);\n      expect(returnedPlans).toBe(0); // Preparation threw before any compensation plan could install.\n      const recovery = (',1)
 else:
  chunk=chunk.replace('      expect(report).toHaveBeenCalledWith(','      expect(refusalCalls).toBe(1);\n      expect(returnedPlans).toBe(0);\n      expect(report).toHaveBeenCalledWith(',1)
 chunks[i]=chunk
s='  it('.join(chunks);(c/f).write_text(s)
f=paths[2];s=(c/f).read_text()
old="""      const port = getTreeRealizationPort(tree.$) as unknown as {
        validateEffects: (...args: unknown[]) => unknown;
      };
      const spy = vi
        .spyOn(port, 'validateEffects')
        .mockImplementation(() => ({ kind: 'structural-drift' }));"""
new="""      const port = getTreeRealizationPort(tree.$);
      if (!port?.prepareSelectedUnit) throw new Error('Expected selected preparation port');
      const refusal = new Error('injected pre-install selected preparation failure: structural-drift');
      let refusalCalls = 0;
      // One-shot throw before calling the real method: no installable compensation plan exists.
      const spy = vi.spyOn(port, 'prepareSelectedUnit').mockImplementationOnce(() => {
        refusalCalls++; throw refusal;
      });
      let refusedBeforePlan = false;"""
assert s.count(old)==1;s=s.replace(old,new)
s=s.replace('        spy.mockRestore();\n      }\n      expect(thrown).toBeInstanceOf(SignalTreeRollbackError);',"        refusedBeforePlan = spy.mock.results.length === 1 && spy.mock.results[0]?.type === 'throw' && spy.mock.results[0]?.value === refusal;\n        spy.mockRestore();\n      }\n      expect(refusalCalls).toBe(1);\n      expect(refusedBeforePlan).toBe(true);\n      expect(thrown).toBeInstanceOf(SignalTreeRollbackError);",1);(c/f).write_text(s)
f=paths[3];s=(c/f).read_text();s=s.replace("it('reports realization refusal with retained authority and permits confirmation'","it('reports injected pre-install realization refusal with retained authority and permits confirmation'",1)
s=s.replace('  const validate = port.validateEffects;',"  if (!port.prepareSelectedUnit) throw new Error('Expected selected preparation port');\n  const prepare = port.prepareSelectedUnit;\n  let refusalCalls = 0, returnedPlans = 0;",1)
s=s.replace("    port.validateEffects = () => ({ kind: 'structural-drift' });", "    // Generic injected preparation failure, not a public structural-drift witness.\n    port.prepareSelectedUnit = function (...args) {\n      refusalCalls++;\n      if (refusalCalls === 1) throw new Error('injected pre-install failure: structural-drift');\n      const plan = prepare.apply(this, args); returnedPlans++; return plan;\n    };",1)
s=s.replace("    expect(() => pending.rollback()).toThrow(/structural-drift/);", "    expect(() => pending.rollback()).toThrow(/structural-drift/);\n    expect(refusalCalls).toBe(1); expect(returnedPlans).toBe(0);\n    expect(tree.$.x()).toBe(1);",1)
s=s.replace('    port.validateEffects = validate;', '    port.prepareSelectedUnit = prepare;',1);(c/f).write_text(s)
# Freeze test overlay and exact original mapping before first run.
mapping=[];patch=[]
for f in paths:
 mapping.append({'path':f,'originalSha256':m[f],'candidateSha256':h(c/f)})
 patch.extend(difflib.unified_diff((b/f).read_text().splitlines(True),(c/f).read_text().splitlines(True),fromfile='a/'+f,tofile='b/'+f))
(p/'TESTS.patch').write_text(''.join(patch));(p/'MAPPING.json').write_text(json.dumps(mapping,indent=2)+'\n');(p/'IDENTITY.json').write_text(json.dumps({'manifestSHA256':h(mp),'overlays':{row['path']:row['candidateSha256'] for row in mapping}},indent=2)+'\n')
print('Prepared four-file test-only overlay on exact frozen R3.')
