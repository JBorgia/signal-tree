from pathlib import Path
import hashlib,json,subprocess,shutil
p=Path(__file__).resolve().parent;a=Path('/private/tmp/st-c21-recipient-positive-counterparts');c=p/'candidate';sha=lambda b:hashlib.sha256(b).hexdigest()
m=json.loads((a/'SNAPSHOT-COUNTERPARTS.json').read_text());b=json.loads((a/'BASE-C21.json').read_text())
assert sha((a/'SNAPSHOT-COUNTERPARTS.json').read_bytes())=='4f828914a214bf556e16af6d44047a7f8b39ec1fa47eb231ca9981e564aec94d'
assert sha((a/'COUNTERPARTS.patch').read_bytes())=='9e011c68223cc16402cf84e2f36bea874f767cca5f4caa62b0298491bdf4b10f'
for f,h in m.items():
 data=(a/'candidate'/f).read_bytes();assert sha(data)==h,f
 out=c/f;out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(data)
for name in ['aggregate-independent-input.spec.ts','recipient-cause-classification.spec.ts']:
 assert sha((a/'originals'/name).read_bytes())==b['packages/kernel/src/lib/'+name]
changed={f for f in b if m.get(f)!=b[f]};assert changed=={'packages/kernel/src/lib/aggregate-independent-input.spec.ts','packages/kernel/src/lib/recipient-cause-classification.spec.ts'}
assert len(set(m)-set(b))==1
(c/'node_modules').symlink_to('/Users/jonathanborgia/code/signaltree/node_modules',target_is_directory=True)
# Reconstruct the exact classifier narrowing independently; all remaining assertions unchanged.
orig=(a/'originals/recipient-cause-classification.spec.ts').read_text()
expected=orig.replace("for(const cause of ['domain-only','external-origin','unknown-declaration']", "// Domain-only progress/terminal counterparts live in recipient-progress-positive-counterparts.spec.ts.\nfor(const cause of ['external-origin','unknown-declaration']")
expected=expected.replace(" if(cause==='domain-only'){expect(sent).toEqual([{x:1,y:0}]);expect(receipt.read()).toMatchObject({state:'started',basis:'surviving'});await c.settled();}\n else{expect(sent).toEqual([]);expect(receipt.read()).toMatchObject({state:'conservative',reason:'unknown'});}", " expect(sent).toEqual([]);expect(receipt.read()).toMatchObject({state:'conservative',reason:'unknown'});")
assert expected==(c/'packages/kernel/src/lib/recipient-cause-classification.spec.ts').read_text()
(p/'IDENTITY.json').write_text(json.dumps({'manifestSha256':sha((a/'SNAPSHOT-COUNTERPARTS.json').read_bytes()),'patchSha256':sha((a/'COUNTERPARTS.patch').read_bytes()),'verifiedFiles':len(m),'unchangedBaseline':len(b)-len(changed),'changed':sorted(changed),'originalBodiesByteExact':True,'retainedClassifierAssertionsExact':True,'ninePermissionGuardsByteExact':m['packages/kernel/src/lib/recipient-source-permission.spec.ts']==b['packages/kernel/src/lib/recipient-source-permission.spec.ts']},indent=2)+'\n')
shutil.copyfile(a/'SNAPSHOT-COUNTERPARTS.json',p/'INPUT-MANIFEST.json')
print('identity verified, copied')
