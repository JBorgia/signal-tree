#!/usr/bin/env python3
"""Measure exact before/after payloads with unchanged canonical bundle predicates.

CONFIG OUT. Config: workspace (for checker/esbuild), baselineManifest,
candidateManifest, passingFixtureManifest. No source/dist mutation or publication.
The separate passing-fixture growth control is not candidate budget acceptance.
"""
from pathlib import Path
import hashlib,json,subprocess,sys

config_path,out=map(lambda s:Path(s).resolve(),sys.argv[1:]);assert not out.exists();out.mkdir(parents=True)
read=lambda p:json.loads(Path(p).read_text())
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
write=lambda p,v:Path(p).write_text(json.dumps(v,indent=2)+'\n')
cfg=read(config_path);workspace=Path(cfg['workspace']);checker=workspace/'tools/check-bundle-budget.mjs';original=checker.read_text()
bindings={str(config_path):sha(config_path),str(Path(__file__).resolve()):sha(__file__),str(checker):sha(checker)}
esbuild=Path(subprocess.check_output(['node','-p',"require.resolve('esbuild/package.json')"],cwd=workspace,text=True).strip());bindings[str(esbuild)]=sha(esbuild)
for expression in ["process.execPath","require.resolve('esbuild')","require('node:module').createRequire(require.resolve('esbuild')).resolve('@esbuild/'+process.platform+'-'+process.arch+'/bin/esbuild')"]:
    dependency=Path(subprocess.check_output(['node','-p',expression],cwd=workspace,text=True).strip()).resolve();bindings[str(dependency)]=sha(dependency)
manifests={}
for role,key in [('baseline','baselineManifest'),('candidate','candidateManifest'),('fixture','passingFixtureManifest')]:
    path=Path(cfg[key]);manifest=read(path);bindings[str(path)]=sha(path)
    root=Path(manifest['root']);actual={str(p.relative_to(root)):sha(p) for p in root.rglob('*') if p.is_file()}
    assert actual==manifest['files'];assert sha(manifest['buildReceipt'])==manifest['buildReceiptSha256']
    receipt=read(manifest['buildReceipt']);assert receipt['head']==manifest['head'] and receipt['sourceSeal']==manifest['sourceSeal']
    assert receipt['exitCode']==0 and receipt['sourceUnchanged'] is True
    bindings[str(Path(manifest['buildReceipt']))]=manifest['buildReceiptSha256']
    bindings.update({str(root/name):h for name,h in actual.items()});manifests[role]=manifest
write(out/'inputs.json',{'bindings':bindings,'identities':{k:{n:v[n] for n in ['head','sourceSeal','root']} for k,v in manifests.items()},'limits':'Canonical numeric ceilings and predicates unchanged. Passing fixture only demonstrates detector discrimination. Minified input attribution is not additive gzip attribution.'})
def measure(name,role,bare=False,planted=False):
    numbers=out/(name+'-numbers.json');graph=out/(name+'-graph.json');derived=original
    changes=[
      ("import { build } from 'esbuild';","import { createRequire } from 'node:module';\nconst { build } = createRequire("+json.dumps(str(workspace/'package.json'))+")('esbuild');"),
      ("const CORE = new URL('../dist/packages/kernel/dist/index.js', import.meta.url)\n  .pathname;",'const CORE = '+json.dumps(str(Path(manifests[role]['root'])/'dist/index.js'))+';'),
      ("const REPO_NODE_MODULES = new URL('../node_modules', import.meta.url).pathname;",'const REPO_NODE_MODULES = '+json.dumps(str(workspace/'node_modules'))+';'),
      ('const dir = mkdtempSync','const metrics = []; const graphs = [];\nconst dir = mkdtempSync'),
      ('    write: false,','    write: false,\n    metafile: true,'),
      ('  return (\n    gzipSync','  graphs.push({entry,define,metafile:out.metafile});\n  writeFileSync('+json.dumps(str(graph))+',JSON.stringify(graphs,null,2)+"\\n");\n  return (\n    gzipSync'),
      ('  const dev = await measure(entry, {});','  const dev = await measure(entry, {});\n  metrics.push({id,prodBytes:Math.round(prod*1024),devBytes:Math.round(dev*1024),prodLimitBytes:prodKB*1024,devLimitBytes:devKB*1024});\n  writeFileSync('+json.dumps(str(numbers))+',JSON.stringify(metrics,null,2)+"\\n");')]
    if bare:changes.append(('Object.entries(TARGETS)',"Object.entries(TARGETS).filter(([id])=>id==='signaltree-bare')"))
    if planted:
        payload=''.join(hashlib.sha256(('sweep-budget-control-'+str(i)).encode()).hexdigest() for i in range(1024))
        injection='\nglobalThis.__sweepBudgetControl='+json.dumps(payload)+';\n'
        changes.append(("writeFileSync(entry, code, 'utf8');","writeFileSync(entry, code+"+json.dumps(injection)+", 'utf8');"))
    for before,after in changes:
        assert derived.count(before)==1,('derivation anchor',before);derived=derived.replace(before,after)
    source=out/(name+'.mjs');source.write_text(derived)
    write(out/(name+'-derivation.json'),{'source':str(checker),'sourceSha256':sha(checker),'derived':str(source),'derivedSha256':sha(source),'role':role,'bareOnly':bare,'plantedRetainedPayload':planted,'replacements':changes})
    with (out/(name+'.log')).open('xb') as stream:code=subprocess.run(['node',str(source)],cwd=workspace,stdout=stream,stderr=subprocess.STDOUT).returncode
    values=read(numbers);assert len(values)==(1 if bare else 2)
    failures=[v['id'] for v in values if v['prodBytes']>v['prodLimitBytes'] or v['devBytes']>v['devLimitBytes']]
    assert code==(1 if failures else 0)
    write(out/(name+'-receipt.json'),{'command':['node',str(source)],'exitCode':code,'logSha256':sha(out/(name+'.log')),'numbersSha256':sha(numbers),'graphSha256':sha(graph),'failedTargets':failures})
    return values
baseline=measure('baseline','baseline');candidate=measure('candidate','candidate')
clean=measure('fixture-before','fixture',True);bad=measure('fixture-planted','fixture',True,True);restored=measure('fixture-restored','fixture',True)
assert clean==restored
assert all(x['prodBytes']<=x['prodLimitBytes'] and x['devBytes']<=x['devLimitBytes'] for x in clean)
assert all(x['prodBytes']>x['prodLimitBytes'] and x['devBytes']>x['devLimitBytes'] for x in bad)
assert all(sha(path)==expected for path,expected in bindings.items())
write(out/'result.json',{'baseline':baseline,'candidate':candidate,'deltaBytes':[{k:c[k]-b[k] for k in ['prodBytes','devBytes']}|{'id':c['id']} for b,c in zip(baseline,candidate,strict=True)],'passingFixtureDiscrimination':True,'fixtureRestoredExactly':True,'inputsUnchanged':True,'publication':False})
print(out)
