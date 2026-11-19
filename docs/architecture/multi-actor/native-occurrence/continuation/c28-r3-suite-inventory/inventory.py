from pathlib import Path
import json,re,hashlib
r=Path(__file__).resolve().parent;c=r/'candidate';m=json.loads((r/'BASE-MANIFEST.json').read_text());allrows=[];counts={}
for project in ['kernel','angular','react','vue','solid']:
 d=json.loads((r/'discovery'/project/'stdout.json').read_text());counts[project]=len(d)
 for e in d:
  p=Path(e['file']);rel=str(p.relative_to(c));assert rel in m;assert hashlib.sha256(p.read_bytes()).hexdigest()==m[rel]
  s=p.read_text();rows=[]
  for i,line in enumerate(s.splitlines(),1):
   if re.search(r'process\.env|import\.meta\.env|\b(?:writeFile|appendFile|mkdir|readFile)(?:Sync)?\b|/private/tmp/|/tmp/|\b(?:it|test|describe)\.(?:skip|todo|fails|skipIf|runIf)|ST_[A-Z_]+|__c\d+|Research.only|research.only',line):rows.append({'line':i,'text':line})
  allrows.append({'project':project,'path':rel,'sha256':m[rel],'findings':rows})
(r/'DISCOVERED.json').write_text(json.dumps(allrows,indent=2)+'\n');(r/'COUNTS.json').write_text(json.dumps(counts,indent=2)+'\n')
for x in allrows:
 if x['findings']:
  print(x['path'])
  for f in x['findings']:print(str(f['line'])+': '+f['text'][:330])
print('COUNTS',counts)
