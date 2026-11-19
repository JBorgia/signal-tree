from pathlib import Path
import json,hashlib,shutil,difflib
r=Path(__file__).resolve().parent;originals={};patch=[]
for packet in ['st-c24-facade-controls','st-c24-kernel-adversarial-controls']:
 base=Path('/private/tmp')/packet;manifest=json.loads((base/'SNAPSHOT.json').read_text())
 assert all(hashlib.sha256((base/p).read_bytes()).hexdigest()==h for p,h in manifest.items()),packet
 originals[packet]={'snapshotSha256':hashlib.sha256((base/'SNAPSHOT.json').read_bytes()).hexdigest(),'verifiedArtifacts':len(manifest)}
 for file in (base/'files').rglob('*.ts*'):
  rel=str(file.relative_to(base/'files'));a=file.read_text();b=a
  if packet=='st-c24-facade-controls':
   old="""        expect(['held', 'conservative']).toContain(admission.state);
        if (admission.state === 'held') expect(admission.reason).toBe('pending-dependency');
        else expect(['invalid-declaration', 'unknown', 'rejected-dependency']).toContain(admission.reason);"""
   assert b.count(old)==1;b=b.replace(old,"""        // This invocation adopts no new support; older connection work is still held.
        expect(admission).toEqual({ state: 'no-write' });""")
   old="""      if (owned && terminal === 'rollback') {
        // A rollback replacement may supersede the original held operation.
        // Exact surviving payload/settlement above remains mandatory.
        expect(['started', 'superseded']).toContain(terminalState.state);
      } else {
        expect(terminalState.state).toBe('started');
      }"""
   assert b.count(old)==1;b=b.replace(old,"""      if (owned) {
        // No-write is terminal even when the Link's older work later publishes.
        expect(terminalState).toEqual({ state: 'no-write' });
      } else {
        expect(terminalState.state).toBe('started');
      }""")
  else:
   assert b.count("expect(['held', 'conservative']).toContain(held.read().state);")==2
   b=b.replace("expect(['held', 'conservative']).toContain(held.read().state);","expect(held.read()).toEqual({ state: 'no-write' });")
   assert b.count("expect(held.read().state).toBe('started');")==1
   b=b.replace("expect(held.read().state).toBe('started');","expect(held.read()).toEqual({ state: 'no-write' });")
   needle="""    expect(sent).toEqual([{ x: 1, y: 0 }, { x: 7, y: 0 }]);
  } finally { releaseFirst(); c.dispose(); tree.destroy(); }"""
   assert b.count(needle)==1;b=b.replace(needle,"""    expect(sent).toEqual([{ x: 1, y: 0 }, { x: 7, y: 0 }]);
    c.dispose();
    expect(held.read()).toEqual({ state: 'no-write' });
  } finally { releaseFirst(); c.dispose(); tree.destroy(); }""")
  orig=r/'originals'/rel;orig.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(file,orig)
  out=r/'files'/rel;out.parent.mkdir(parents=True,exist_ok=True);out.write_text(b)
  patch.extend(difflib.unified_diff(a.splitlines(True),b.splitlines(True),fromfile='a/'+rel,tofile='b/'+rel))
(r/'receipt-only-correction.patch').write_text(''.join(patch))
(r/'ORIGINALS-VERIFIED.json').write_text(json.dumps(originals,indent=2)+'\n')
print('original packets verified; five counterpart files, no runtime/test execution')
