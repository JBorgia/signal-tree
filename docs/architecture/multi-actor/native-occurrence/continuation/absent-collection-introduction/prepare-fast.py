exec(open('/private/tmp/st-absent-collection-introduction/prepare.py').read().split('for label,')[0])
sources['c7a']=('/private/tmp/st-native-combined-c7a','SNAPSHOT-C7a.json')
for label,(folder,manifest) in sources.items():
 src=Path(folder);dest=root/('probe-'+label);dest.mkdir();m=json.loads((src/manifest).read_text());(dest/'BASE-MANIFEST.json').write_text(json.dumps(m,indent=2))
 for name,digest in m.items():
  f=src/'candidate'/name
  assert hashlib.sha256(f.read_bytes()).hexdigest()==digest,name
  target=dest/'candidate'/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(f,target)
 deps=dest/'candidate/node_modules';deps.mkdir();old=Path('/private/tmp/st-dormant-publication-feasibility/candidate/node_modules')
 for f in old.iterdir():
  if f.name in {'.cache','.vite','.bin'}:continue
  (deps/f.name).symlink_to(f.resolve())
 shutil.copytree(old/'.bin',deps/'.bin',symlinks=False)
 for f in (deps/'.bin').iterdir():
  try:t=f.read_text()
  except UnicodeError:continue
  f.write_text(t.replace(str(old),str(deps)))
 runner=Path('/private/tmp/st-dormant-publication-feasibility/run-gate.py').read_text().replace(";paths.update(['packages/kernel/src/lib/dormant-feasibility-discriminator.spec.ts','packages/kernel/src/lib/dormant-input-discriminator.spec.ts'])",'')
 (dest/'run-gate.py').write_text(runner)
 print(label,len(m),flush=True)
