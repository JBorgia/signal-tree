from pathlib import Path
import json,hashlib,difflib
root=Path(__file__).parent
for p in [root,root/'r3-baseline']:
 f=p/'candidate/tools/check-bundle-budget.mjs';s=f.read_text();original=s;(p/'graph').mkdir()
 s=s.replace("import { build } from 'esbuild';",'import { build } from '+json.dumps(str(p/'candidate/node_modules/esbuild/lib/main.js'))+';')
 s=s.replace('import.meta.url',json.dumps(f.as_uri()))
 s=s.replace('    write: false,','    write: false,\n    metafile: true,')
 needle='  return (\n    gzipSync(Buffer.from(out.outputFiles[0].contents), { level: 9 }).length /'
 addition='''  const label = entry.split('/').at(-1).replace('.js','') + (define.ngDevMode ? '-prod' : '-dev');
  const bytes = Buffer.from(out.outputFiles[0].contents);
  writeFileSync(OUT + '/' + label + '.js', bytes);
  writeFileSync(OUT + '/' + label + '.json', JSON.stringify({gzipBytes:gzipSync(bytes,{level:9}).length,minifiedBytes:bytes.length,metafile:out.metafile},null,2));
'''.replace('OUT',json.dumps(str(p/'graph')))
 assert needle in s;s=s.replace(needle,addition+needle)
 (p/'graph-diagnostic.mjs').write_text(s)
 (p/'GRAPH-INSTRUMENTATION.patch').write_text(''.join(difflib.unified_diff(original.splitlines(True),s.splitlines(True),fromfile=str(f),tofile=str(p/'graph-diagnostic.mjs'))))
 (p/'GRAPH-PROVENANCE.json').write_text(json.dumps({'budgetTool':str(f),'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'outputOnlyInstrumentation':True,'workloadsOptionsAndCeilingsUnchanged':True},indent=2)+'\n')
