"""Verify ordered archive chunks and all payloads without extraction or execution."""
from pathlib import Path,PurePosixPath
import hashlib,json,tarfile,tempfile
p=Path(__file__).resolve().parent;s=json.loads((p/'EVIDENCE-SEAL.json').read_text())
def digest(stream):return hashlib.file_digest(stream,'sha256').hexdigest()
with tempfile.TemporaryFile() as joined:
 total=0;combined=hashlib.sha256()
 for c in s['chunks']:
  name=PurePosixPath(c['name']);assert len(name.parts)==1 and not name.is_absolute()
  f=p/c['name'];assert f.stat().st_size==c['bytes']
  with f.open('rb') as stream:assert digest(stream)==c['sha256']
  with f.open('rb') as stream:
   while data:=stream.read(1024*1024):joined.write(data);combined.update(data);total+=len(data)
 assert total==s['bytes'] and combined.hexdigest()==s['sha256'];joined.seek(0)
 with tarfile.open(fileobj=joined,mode='r:gz') as tar:
  members=tar.getmembers();names=[m.name for m in members];assert len(names)==len(set(names))
  assert all(m.isfile() and not PurePosixPath(m.name).is_absolute() and '..' not in PurePosixPath(m.name).parts for m in members)
  raw=tar.extractfile('FILE-MAP.json').read();assert hashlib.sha256(raw).hexdigest()==s['mapSha256'];entries=json.loads(raw);assert set(names)==set(entries)|{'FILE-MAP.json'}
  for name,e in entries.items():
   m=tar.getmember(name);assert m.size==e['bytes'] and m.mode&0o111==e['executable'],name
   with tar.extractfile(m) as stream:assert digest(stream)==e['sha256'],name
  assert len(entries)==s['verifiedPayloads']
print(f"Verified {len(s['chunks'])} chunks and {len(entries)} file payloads; no extraction or execution.")
