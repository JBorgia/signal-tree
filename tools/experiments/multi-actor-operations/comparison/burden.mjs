import fs from 'node:fs';
import crypto from 'node:crypto';
const groups = { C0: ['c0.mjs'], C1: ['c1.mts'], C2: ['../coordinator.mjs'], C3: ['c3.mjs'], sharedAlternatives: ['data.mjs','reference-server.mjs'], C2Backend: ['../dispatch-fixture.mjs'], commonTests: ['comparison.test.mjs','lifecycle.test.mjs'] };
const counts = Object.fromEntries(Object.entries(groups).map(([group, files]) => [group, files.map(path => {
  const text = fs.readFileSync(path, 'utf8');
  return { path, bytes: Buffer.byteLength(text), physicalLines: text.split('\n').length - Number(text.endsWith('\n')), nonblankLines: text.split('\n').filter(x => x.trim()).length, sha256: crypto.createHash('sha256').update(text).digest('hex') };
})]));
console.log(JSON.stringify({ command: 'node burden.mjs', interpretation: 'Descriptive source inventory, not productivity/performance ranking. Includes types/comments and differing feature breadth. C1 generated JS is excluded to avoid double counting; shared helpers/backend listed separately.', counts }, null, 2));
