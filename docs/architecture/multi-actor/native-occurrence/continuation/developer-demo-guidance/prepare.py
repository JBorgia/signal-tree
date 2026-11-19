from pathlib import Path
import hashlib,json,difflib
b=Path('/private/tmp/st-v16-demo-guidance');s=Path('/private/tmp/st-v16-integration-candidate')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
mods=['apps/demo/src/app/app.routes.ts','apps/demo/src/app/components/navigation/navigation.component.ts','apps/demo/src/app/components/navigation/navigation.component.spec.ts']
for f in mods:
 p=b/'before'/f;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((s/f).read_bytes())
 text=(s/f).read_text()
 if f.endswith('app.routes.ts'):
  marker="  {\n    path: 'async',"
  addition="""  {
    path: 'independent-publication',
    loadComponent: () =>
      import('./pages/independent-publication/independent-publication.component').then(
        (c) => c.IndependentPublicationComponent
      ),
    data: {
      title: 'Independent publication · v16 development preview (unreleased)',
      description:
        'Publish a literal note while a route proposal stays pending. Local state, admission receipts and an in-memory endpoint remain distinct.',
    },
  },
"""
  assert text.count(marker)==1;text=text.replace(marker,addition+marker)
 elif f.endswith('.spec.ts'):
  marker="        '/external-truth',\n";assert text.count(marker)==1;text=text.replace(marker,marker+"        '/independent-publication',\n")
 else:
  marker="""        {
          id: 'external',
          title: 'Server updates',
          route: '/external-truth',
        },
"""
  addition="""        {
          id: 'independent-publication',
          title: 'Independent publication · v16 preview',
          route: '/independent-publication',
        },
"""
  assert text.count(marker)==1;text=text.replace(marker,marker+addition)
 p=b/'overlay'/f;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text)
files=sorted(p.relative_to(b/'overlay').as_posix() for p in (b/'overlay').rglob('*') if p.is_file());assert len(files)==7
records=[];patch=[]
for f in files:
 before=b/'before'/f;after=b/'overlay'/f
 if not before.exists():assert not (s/f).exists(),f
 patch.extend(difflib.unified_diff(before.read_text().splitlines(True) if before.exists() else [],after.read_text().splitlines(True),fromfile='a/'+f if before.exists() else '/dev/null',tofile='b/'+f))
 records.append({'file':f,'before_sha256':sha(before) if before.exists() else None,'overlay_sha256':sha(after)})
(b/'demo-guidance.patch').write_text(''.join(patch))
(b/'HASHES.json').write_text(json.dumps({'source':str(s),'patch_sha256':sha(b/'demo-guidance.patch'),'files':records},indent=2)+'\n')
print('Prepared 7-file patch: lazy page (component/template/style/spec), route, navigation entry and exact navigation assertion.')
