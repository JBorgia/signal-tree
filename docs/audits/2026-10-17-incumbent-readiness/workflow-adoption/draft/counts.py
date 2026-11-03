from pathlib import Path
import hashlib, json
root = Path(__file__).resolve().parent
counts = []
for name in ['editor.ts', 'scenario.ts', 'run.mjs', 'tsconfig.json']:
    data = (root / name).read_bytes()
    lines = data.decode().splitlines()
    counts.append(dict(file=name, physicalLines=len(lines), nonblankLines=sum(bool(line.strip()) for line in lines), sha256=hashlib.sha256(data).hexdigest()))
(root / 'counts.json').write_text(json.dumps(counts, indent=2) + '\n')
print(json.dumps(counts, indent=2))
