import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const [input, output] = process.argv.slice(2);
const bytes = readFileSync(input), profile = JSON.parse(bytes);
const nodes = new Map(profile.nodes.map(node => [node.id, node]));
const parents = new Map(profile.nodes.flatMap(node => (node.children ?? []).map(child => [child, node.id])));
const self = new Map(), inclusive = new Map();
for (let index = 0; index < profile.samples.length; index++) {
  const sample = profile.samples[index], weight = profile.timeDeltas[index];
  self.set(sample, (self.get(sample) ?? 0) + weight);
  for (let ancestor = sample; ancestor; ancestor = parents.get(ancestor))
    inclusive.set(ancestor, (inclusive.get(ancestor) ?? 0) + weight);
}
const rows = values => [...values].sort((a,b)=>b[1]-a[1]).map(([id,microseconds])=>({id,weightedSampledElapsedMicroseconds:microseconds,frame:nodes.get(id).callFrame}));
writeFileSync(output,JSON.stringify({input,inputSha256:createHash('sha256').update(bytes).digest('hex'),command:process.argv,
  limits:'Inspector 100us sampling, unminified production-defined artifact bundle in Node. Weights are elapsed between samples, not exact function CPU cost; GC/protocol are included. Inclusive rows overlap and must never be added. These runs identify candidates, not comparative performance or browser startup.',
  samples:profile.samples.length,totalWeightedSampledElapsedMicroseconds:profile.timeDeltas.reduce((a,b)=>a+b,0),self:rows(self),inclusive:rows(inclusive)},null,2)+'\n',{flag:'wx'});
