import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const [entry, expected] = process.argv.slice(2);
assert.ok(entry && ['published', 'fixed'].includes(expected), 'entry path and published|fixed required');
const { signalTree, entityMap, link } = await import(pathToFileURL(entry).href);
let release;
const wait = new Promise(resolve => { release = resolve; });
const tree = signalTree({ count: 0 });
const sent = [];
const connection = link(tree.$.count, { set: async value => { sent.push(value); await wait; } });
let early = false;
try {
  tree.$.count(1);
  const done = connection.settled().then(() => { early = true; });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(sent, [1]);
  assert.equal(early, expected === 'published');
  release(); await done;
} finally { release(); connection.dispose(); tree.destroy(); }
const warnings = [];
const warn = console.warn;
console.warn = message => warnings.push(message);
const rows = signalTree({ rows: entityMap({ selectId: row => row.key }) });
try {
  rows.$.rows.setAll([{ key: '', value: 1 }, { key: '', value: 2 }]);
  assert.deepEqual(rows.$.rows.all(), [{ key: '', value: 2 }]);
  assert.equal(warnings.length, expected === 'published' ? 0 : 1);
  if (expected === 'fixed') assert.match(warnings[0], /duplicate.*\[ST2001\]/);
} finally { console.warn = warn; rows.destroy(); }
console.log(JSON.stringify({ arm: expected, settledBeforeEndpointFinished: expected === 'published', duplicateWarnings: warnings.length, lastValueWins: true }));
