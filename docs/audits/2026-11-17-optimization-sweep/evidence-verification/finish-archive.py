#!/usr/bin/env python3
"""Exact post-closure packaging; outputs remain outside their own archive."""
from pathlib import Path
import datetime,hashlib,json,subprocess,sys
R=Path('/Users/jonathanborgia/code/signaltree');C=R/'artifacts/optimization-sweep-final-packaging-1';S=R/'.worktrees/agent-collaboration-evaluation'
closure_dir=Path(sys.argv[1]).resolve();out=Path(sys.argv[2]).resolve();assert not out.exists();out.mkdir(parents=True)
read=lambda p:json.loads(Path(p).read_text())
def sha(p):
 h=hashlib.sha256()
 with Path(p).open('rb') as f:
  while b:=f.read(1024*1024):h.update(b)
 return h.hexdigest()
def write(p,d):
 with Path(p).open('x') as f:json.dump(d,f,indent=2);f.write('\n')
assert read(closure_dir/'report.json')['complete'] is True
closure=closure_dir/'closure.json';closure_digest=sha(closure)
selector=S/'tools/optimization-sweep/archive-selection.py';selector_digest=sha(selector)
assert selector_digest=='12811cbe60f20da9f9a873c1bd7b854d16cd5d2a1ec34c439b05178190517f76'
legacy=S/'tools/application-lab/archive-evidence.py';wrapper=C/'original-free-source11/original-free.py'
archive=out/'archive';packed=out/'evidence.tar.gz';extracted=out/'extracted';checks=[]
def run(name,args,accepted=(0,)):
 print('START '+name,flush=True)
 target=out/name
 command=[sys.executable,str(R/'artifacts/optimization-sweep-2026-11-17/run-command.py'),str(target),str(R),*map(str,args)]
 code=subprocess.call(command);assert code in accepted,(name,code)
 receipt=read(target/'receipt.json');log=(target/'command.log').read_text(errors='replace')
 assert receipt['exitCode']==code
 checks.append({'name':name,'receipt':str(target/'receipt.json'),'receiptSha256':sha(target/'receipt.json'),'exitCode':code})
 return log
run('create',[sys.executable,legacy,'create',archive,'--selection',closure_dir/'selection.json','--recover',closure_dir/'recovery'])
run('pack',[sys.executable,legacy,'pack',archive,packed])
run('extract',[sys.executable,legacy,'extract',packed,extracted])
archived_selector=extracted/'payloads/sha256'/selector_digest
run('verify-extracted',[sys.executable,archived_selector,'verify-extracted',extracted,closure_digest])
manifest=read(extracted/'manifest.json')
size,digest=min((x['size'],h) for h,x in manifest['payloads'].items() if 0<x['size']<=4096 and h not in {selector_digest,closure_digest,sha(legacy)})
p=extracted/'payloads/sha256'/digest;original=p.read_bytes();assert sha(p)==digest
backup=out/'control-original-payload';backup.write_bytes(original)
try:
 p.write_bytes(original+b'archive-control-corruption')
 log=run('reject-corrupt',[sys.executable,extracted/'archive-evidence.py','verify',extracted],(1,))
 assert digest in log and any(term in log.lower() for term in ('checksum','size mismatch','digest mismatch')),'Unrelated corruption rejection'
 p.write_bytes(original);p.unlink()
 log=run('reject-missing',[sys.executable,extracted/'archive-evidence.py','verify',extracted],(1,))
 assert digest in log and 'Missing archived file' in log,'Unrelated missing-payload rejection'
finally:p.write_bytes(original)
assert sha(p)==digest
log=run('original-read-denial-restored',[sys.executable,'-I','-B',wrapper,extracted,closure_digest,selector])
lines=[json.loads(x) for x in log.splitlines() if x.startswith('{')]
assert any(x.get('kind')=='original-read-denial-verification' and x.get('passed') is True and x.get('verificationOutsideOpens')==0 for x in lines)
parts=out/'parts';parts.mkdir();entries=[]
with packed.open('rb') as f:
 i=0
 while data:=f.read(90000000):
  i+=1;p=parts/f'evidence.tar.gz.part-{i:03}';p.write_bytes(data);entries.append({'file':p.name,'bytes':len(data),'sha256':sha(p)})
reassembled=out/'reassembled.tar.gz';h=hashlib.sha256()
with reassembled.open('xb') as dst:
 for entry in entries:
  p=parts/entry['file'];assert sha(p)==entry['sha256'] and p.stat().st_size==entry['bytes']
  with p.open('rb') as src:
   while data:=src.read(1024*1024):h.update(data);dst.write(data)
assert h.hexdigest()==sha(packed) and reassembled.stat().st_size==packed.stat().st_size
result={'passed':True,'completedUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'closure':{'path':str(closure),'sha256':closure_digest},'selector':{'path':str(selector),'sha256':selector_digest},'legacyVerifier':{'path':str(legacy),'sha256':sha(legacy)},'originalReadDenialWrapper':{'path':str(wrapper),'sha256':sha(wrapper)},'archive':{'path':str(packed),'bytes':packed.stat().st_size,'sha256':sha(packed),'manifestSha256':sha(extracted/'manifest.json'),'partsInOrder':entries},'counts':{'originalVersionMappings':len(manifest['entries']),'uniquePayloads':len(manifest['payloads']),'payloadBytes':sum(x['size'] for x in manifest['payloads'].values())},'checks':checks,'corruptionControl':{'payloadDigest':digest,'bytes':size,'restored':True},'reassembledBytesIdentical':True,'limits':['Integrity and typed evidence-reference closure, not authenticity or a universal semantic claim.','Full predecessor index bytes and producer-selected members are checked; unrelated historical members are not requalified.','Original-read denial is a Python open/dependency audit of this known verifier, not an OS security sandbox.','Post-packaging receipts and the final public index are external to avoid a self-hash cycle.']}
write(out/'result.json',result)
print(json.dumps({'passed':True,'result':str(out/'result.json'),'archiveBytes':packed.stat().st_size,'parts':len(entries)}),flush=True)
