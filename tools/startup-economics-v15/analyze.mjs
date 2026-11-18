import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const [input, candidate = 'candidate'] = process.argv.slice(2);
const parsed = JSON.parse(readFileSync(input, 'utf8'));
// The separately registered activation follow-up is Angular/heap only and
// wraps its successful children alongside its complete schedule.
const rows = Array.isArray(parsed) ? parsed : parsed.results.map(r => ({
  ...r, sample: { ...r.sample, carrier: 'angular', kind: 'heap' },
}));
if (!Array.isArray(parsed)) assert.equal(parsed.passed, true);
assert(rows.every(r => r.passed));
const median = xs => { const s = xs.slice().sort((a,b) => a-b); return s.length % 2 ? s[(s.length-1)/2] : (s[s.length/2-1]+s[s.length/2])/2; };
const groups = new Map();
for (const r of rows) {
  const key = `${r.sample.carrier}/${r.sample.profile}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(r);
}
const out = [];
for (const [profile, data] of groups) {
  const kind = data[0].sample.kind;
  const stages = Object.keys(kind === 'heap' ? data[0].heaps : data[0].stages);
  for (const stage of stages) {
    const value = r => kind === 'heap'
      ? r.heaps[stage] - r.heaps.moduleReady
      : r.stages[stage].ns / 1e6;
    const primary = data.filter(r => r.sample.arm === 'baseline');
    const at = (arm, round) => data.find(r => r.sample.arm === arm && r.sample.round === round);
    const differences = primary.map(b => value(at(candidate, b.sample.round))-value(b));
    const noise = primary.map(b => value(at('baseline-aa', b.sample.round))-value(b));
    out.push({ profile, arm: candidate, stage, units: kind === 'heap' ? 'bytes above module-ready' : 'milliseconds',
      baseline: median(primary.map(value)), candidate: median(primary.map(b => value(at(candidate, b.sample.round)))),
      pairedMedian: median(differences), pairedRange: [Math.min(...differences), Math.max(...differences)],
      aaMaxAbsolute: Math.max(...noise.map(Math.abs)), samples: primary.length });
  }
}
console.log(JSON.stringify(out, null, 2));
