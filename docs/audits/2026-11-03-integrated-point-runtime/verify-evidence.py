"""Verify the sealed experiment archive without extracting paths or executing code."""
from pathlib import Path, PurePosixPath
import hashlib,json,tarfile
p=Path(__file__).resolve().parent;a=p/'integrated-point-evidence.tar.gz';seal=json.loads((p/'EVIDENCE-SEAL.json').read_text())
assert a.stat().st_size==seal['bytes']
assert hashlib.sha256(a.read_bytes()).hexdigest()==seal['sha256']
with tarfile.open(a,'r:gz') as t:
 members=t.getmembers();names=[m.name for m in members]
 assert len(names)==len(set(names))
 assert all(m.isfile() and not PurePosixPath(m.name).is_absolute() and '..' not in PurePosixPath(m.name).parts for m in members)
 raw=t.extractfile('FILE-MAP.json').read();assert hashlib.sha256(raw).hexdigest()==seal['mapSha256'];entries=json.loads(raw)
 assert set(names)==set(entries)|{'FILE-MAP.json'}
 for name,v in entries.items():
  m=t.getmember(name);data=t.extractfile(m).read()
  assert len(data)==v['bytes'] and hashlib.sha256(data).hexdigest()==v['sha256'] and m.mode&0o111==v['executable'],name
 assert len(entries)==seal['verifiedPayloads']
 print(f"Verified archive SHA256 and {len(entries)} file payloads; no extraction or execution.")
