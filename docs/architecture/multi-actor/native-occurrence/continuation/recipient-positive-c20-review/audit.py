from pathlib import Path
import hashlib,json,shutil
out=Path(__file__).parent;p=Path('/private/tmp/st-native-combined-c20');base=Path('/private/tmp/st-native-combined-c19');h=lambda b:hashlib.sha256(b).hexdigest()
raw=(p/'SNAPSHOT-C20.json').read_bytes();assert h(raw)=='9f14f5a476482cca596528aaed18cbf6be17122f73261e0fa047be40b641e94c';a=json.loads((base/'SNAPSHOT-C19.json').read_text());b=json.loads(raw)
for n,d in b.items():assert h((p/'candidate'/n).read_bytes())==d,n
w='packages/kernel/src/lib/';names=['occurrence-successor.spec.ts','recipient-window-review.spec.ts','recipient-positive-counterparts.spec.ts'];changed=[n for n in set(a)|set(b) if a.get(n)!=b.get(n)];assert set(changed)=={w+n for n in names}
discovery=json.loads((p/'DISCOVERY-CHANGES.json').read_text());assert len(discovery)==3
prefixes=["for(const kind of ['scalar','empty','collection','mixed']", "for(const outcome of ['confirm','rollback'] as const)it(`equal undeclared", "for(const outcome of ['confirm','rollback'] as const)it(`membership omission"]
for entry,prefix in zip(discovery,prefixes):assert entry['removedExactBody'].startswith(prefix)
for n in names[:2]:
 original=(base/'candidate'/w/n).read_bytes();assert (p/'research-only'/(n+'.txt')).read_bytes()==original
 active=original.decode()
 for entry in discovery:
  if entry['file']==n:
   body=entry['removedExactBody'];assert active.count(body)==1;active=active.replace(body,'',1)
 assert active==(p/'candidate'/w/n).read_text()
 shutil.copyfile(p/'research-only'/(n+'.txt'),out/('ORIGINAL-'+n+'.txt'))
 shutil.copyfile(p/'candidate'/w/n,out/n)
for n in ['SNAPSHOT-C20.json','DISCOVERY-CHANGES.json']:shutil.copyfile(p/n,out/n)
shutil.copyfile('/private/tmp/assemble-st-c20.py',out/'assemble-st-c20.py')
shutil.copyfile(p/'candidate'/w/names[2],out/names[2])
(out/'IDENTITY.json').write_text(json.dumps({'manifest':h(raw),'entries':len(b),'changes':{n:{'C19':a.get(n),'C20':b.get(n)} for n in changed},'archivalLoops':3,'archivalExpandedCases':12,'retainedOriginalCases':13},indent=2)+'\n')
print('Full frozen C20 verified; only3 specs differ; exact3 loop removals and byte-identical original archives; all other original bodies retained.')
