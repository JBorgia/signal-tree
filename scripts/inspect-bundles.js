const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const files = [
  path.join(
    repoRoot,
    'dist',
    'packages',
    'devtools',
    'fesm2022',
    'signaltree-devtools.mjs'
  ),
  path.join(
    repoRoot,
    'dist',
    'packages',
    'middleware',
    'fesm2022',
    'signaltree-middleware.mjs'
  ),
  path.join(
    repoRoot,
    'dist',
    'packages',
    'batching',
    'fesm2022',
    'signaltree-batching.mjs'
  ),
];

const re = /(`([^`\\]|\\.)*`|'([^'\\]|\\.)*'|"([^"\\]|\\.)*")/g;

for (const f of files) {
  console.log('\n== FILE:', f, '==');
  try {
    const s = fs.readFileSync(f, 'utf8');
    const map = new Map();
    let m;
    while ((m = re.exec(s))) {
      const raw = m[0].slice(1, -1);
      if (raw.length < 6) continue;
      map.set(raw, (map.get(raw) || 0) + 1);
    }
    const arr = [...map.entries()].map(([k, v]) => ({
      len: k.length,
      count: v,
      s: k,
    }));
    arr.sort((a, b) => b.len - a.len || b.count - a.count);
    arr.slice(0, 40).forEach((a, i) => {
      console.log(
        `#${i + 1} len=${a.len} count=${a.count} preview=${a.s
          .slice(0, 200)
          .replace(/\n/g, '\\n')}`
      );
    });
  } catch (err) {
    console.error('ERR reading', f, err.message);
  }
}
