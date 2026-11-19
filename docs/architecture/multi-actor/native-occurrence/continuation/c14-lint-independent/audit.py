import pathlib,json,hashlib,subprocess
out=pathlib.Path(__file__).parent
p=pathlib.Path('/private/tmp/st-c14-lint-cleanup'); b=pathlib.Path('/private/tmp/st-native-combined-c14')
h=lambda x:hashlib.sha256(x).hexdigest()
a=json.loads((p/'SNAPSHOT.json').read_text()); z=json.loads((b/'SNAPSHOT-C14.json').read_text()); f=json.loads((p/'FREEZE.json').read_text())
assert h((p/'SNAPSHOT.json').read_bytes())==f['manifestSha256'];assert h((p/'FROM-C14.patch').read_bytes())==f['patchSha256']
for root,m in [(p,a),(b,z)]:
 for name,digest in m.items(): assert h((root/'candidate'/name).read_bytes())==digest,(root,name)
assert a.keys()==z.keys()
changed=[n for n in a if a[n]!=z[n]];assert set(changed)==set(f['changed'])
result={'manifest':f['manifestSha256'],'patch':f['patchSha256'],'baseManifest':h((b/'SNAPSHOT-C14.json').read_bytes()),'verifiedFilesEach':len(a),'changed':{n:{'base':z[n],'candidate':a[n]} for n in changed}}
for name in ['runs/cleaned-lint/first.log','runs/source-types/first.log','runs/spec-types/first.log','runs/scalar-composition/first.log','FREEZE.json','FROM-C14.patch']:
 result.setdefault('evidence',{})[str(p/name)]=h((p/name).read_bytes())
(out/'identity.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
