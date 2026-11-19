from pathlib import Path
import os,json,hashlib,shutil,subprocess,time,signal
r=Path(__file__).resolve().parent;b=Path('/private/tmp/st-c28-r3-comparator');c=r/'candidate';h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
m=b/'MANIFEST.json';expected='e0b64de42df330abff455d2ee1b981c99abee187a77269cd064f52f3b08505f3';assert h(m)==expected
assert h(b/'RUNTIME-MANIFEST.json')=='1edb39e668f2a370554f692d455b75fac08a9836003a150acd09e2326368a08c'
assert h(b/'runtime.patch')=='e29e34f8b4a5043da4f984c104ad683ba65869c9b2da3a3d5c12bf22ce7db634'
manifest=json.loads(m.read_text());shutil.copyfile(m,r/'BASE-MANIFEST.json')
for rel,digest in manifest.items():
 src=b/'candidate'/rel;assert h(src)==digest,rel
 dest=c/rel;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dest);assert h(dest)==digest
(c/'node_modules').symlink_to('/Users/jonathanborgia/code/signaltree/node_modules',target_is_directory=True)
shutil.copyfile('/private/tmp/st-c27-remaining-failure-replay/diagnostic-redirect.cjs',r/'diagnostic-redirect.cjs')

(r/'VERIFIED.json').write_text(json.dumps({'entries':len(manifest),'manifest':expected},indent=2)+'\n')
print('Verified copy',len(manifest))
