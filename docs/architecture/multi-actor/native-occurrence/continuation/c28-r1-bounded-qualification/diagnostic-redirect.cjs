// Exact diagnostic output mappings only; leave unknown paths and I/O errors intact.
const fs = require('node:fs');
const path = require('node:path');
const output = process.env.ST_C21_DIAGNOSTIC_OUTPUT;
if (!output) throw new Error('ST_C21_DIAGNOSTIC_OUTPUT is required');
const sources = [
  ...['recipient-traces.jsonl', 'participant.jsonl', 'getter.jsonl',
      'preparation-scalar.jsonl', 'completion.jsonl'].map(
    name => '/private/tmp/st-joint-phase-successor-r4/runs/' + name),
  ...['external', 'foreign-callback'].map(cause =>
    '/private/tmp/st-fixed-window-retirement-cancellation-successor/provenance-' + cause + '.json'),
  ...['owner-evidence-0.txt', 'flush-0.txt', 'flush-probe.txt', 'leaf-support-0.txt',
      'owner-scope-leak.json', 'owner-scope-0.txt'].map(name => '/tmp/' + name)
];
const mapped = new Map(sources.map(source => [source, path.join(output, path.basename(source))]));
for (const method of ['appendFileSync', 'writeFileSync']) {
  const original = fs[method];
  fs[method] = function (target, ...args) {
    return original.call(this, mapped.get(target) ?? target, ...args);
  };
}
require('node:module').syncBuiltinESMExports();
