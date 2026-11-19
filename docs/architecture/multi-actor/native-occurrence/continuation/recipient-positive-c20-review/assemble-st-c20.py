from pathlib import Path
import json,hashlib,shutil
base=Path('/private/tmp/st-native-combined-c19'); out=Path('/private/tmp/st-native-combined-c20'); out.mkdir(exist_ok=False); dst=out/'candidate'; dst.mkdir()
m=json.loads((base/'SNAPSHOT-C19.json').read_text())
for rel,h in m.items():
 p=base/'candidate'/rel; assert hashlib.sha256(p.read_bytes()).hexdigest()==h,rel
 t=dst/rel;t.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,t)
(dst/'node_modules').symlink_to('/Users/jonathanborgia/code/signaltree/node_modules')
shutil.copy2(base/'run-gate.py',out/'run-gate.py')
original=out/'research-only';original.mkdir()
changes=[]
for filename,spans in [('occurrence-successor.spec.ts',[("for(const kind of ['scalar','empty','collection','mixed']", "it('omission prunes")]),('recipient-window-review.spec.ts',[("for(const outcome of ['confirm','rollback'] as const)it(`equal undeclared", "for(const known of [false,true])"),("for(const outcome of ['confirm','rollback'] as const)it(`membership omission", "it('a finalizer throw")])]:
 p=dst/'packages/kernel/src/lib'/filename;s=p.read_text();(original/(filename+'.txt')).write_text(s)
 for begin,end in spans:
  a=s.index(begin);b=s.index(end,a);changes.append({'file':filename,'removedExactBody':s[a:b]});s=s[:a]+s[b:]
 p.write_text(s)
s=Path('/private/tmp/st-c19-recipient-positive-counterparts/candidate/packages/kernel/src/lib/recipient-positive-counterparts.spec.ts').read_text()
s=s.replace("const starts = vi.spyOn(life, 'started');", """const originalStarted = life.started;
  const admissions: Array<{ channel: object; revision: object; declared: boolean }> = [];
  const starts = vi.spyOn(life, 'started').mockImplementation((...args) => {
    admissions.push({channel: args[0], revision: args[1], declared: life.hasDeclaration(args[0], args[1])});
    return originalStarted(...args);
  });""")
s=s.replace('life.hasDeclaration(childChannel, childStarts()[0][1])', 'admissions.find(entry => entry.channel === childChannel && entry.revision === childStarts()[0][1])?.declared')
s=s.replace('life.hasDeclaration(bChannel, bStarts()[0][1])', 'admissions.find(entry => entry.channel === bChannel && entry.revision === bStarts()[0][1])?.declared')
s=s.replace('    await child.settled();\n    q[outcome]();', '''    await child.settled();
    expect(nestedSent).toEqual(expected); expect(sent).toEqual([{other: 1}]);
    expect(childStarts()).toHaveLength(1); expect(q.inspect()).toEqual(inspection);
    expect(tree.$()).toEqual({other: 1}); expect(foreign.$.z()).toBe(7);
    q[outcome]();''')
s=s.replace('    await child.settled();\n  } finally', '''    await child.settled();
    expect(nestedSent).toEqual(expected); expect(sent).toEqual([{other: 1}]);
    expect(childStarts()).toHaveLength(1); expect(tree.$()).toEqual({other: 1});
    expect(foreign.$.z()).toBe(outcome === 'confirm' ? 7 : 0);
  } finally''')
s=s.replace('    await b.settled();\n    p[outcome]();', '''    await b.settled();
    expect(left).toEqual([expected]); expect(right).toEqual([expected]);
    expect(bStarts()).toHaveLength(1); expect(p.inspect()).toEqual(inspection);
    expect(tree.$.pair()).toEqual(expected); expect(foreign.$.z()).toBe(7);
    if (second) expect(second.read()).toMatchObject({state: 'no-write'});
    p[outcome]();''')
s=s.replace('    await b.settled();\n  } finally', '''    await b.settled();
    expect(left).toEqual([expected]); expect(right).toEqual([expected]);
    expect(bStarts()).toHaveLength(1); expect(tree.$.pair()).toEqual(expected);
    expect(foreign.$.z()).toBe(outcome === 'confirm' ? 7 : 0);
    if (second) expect(second.read()).toMatchObject({state: 'no-write'});
  } finally''')
rel='packages/kernel/src/lib/recipient-positive-counterparts.spec.ts';(dst/rel).write_text(s)
keys=set(m)|{rel};manifest={r:hashlib.sha256((dst/r).read_bytes()).hexdigest() for r in sorted(keys)}
(out/'SNAPSHOT-C20.json').write_text(json.dumps(manifest,indent=2)+'\n')
(out/'DISCOVERY-CHANGES.json').write_text(json.dumps(changes,indent=2)+'\n')
print(hashlib.sha256((out/'SNAPSHOT-C20.json').read_bytes()).hexdigest())
print('changed', [r for r in keys if manifest[r]!=m.get(r)])
