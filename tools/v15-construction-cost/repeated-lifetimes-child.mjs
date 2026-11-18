import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const input = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const result = { sample: input.sample, passed: false, episodes: [] };
const measure = async fn => {
  const clock = process.hrtime.bigint(), cpu = process.cpuUsage();
  const value = await fn(), used = process.cpuUsage(cpu);
  return { value, timing: { wallNs: Number(process.hrtime.bigint() - clock), userUs: used.user, systemUs: used.system } };
};
try {
  assert.equal(process.version, 'v24.15.0');
  assert.equal(global.gc, undefined, 'CPU only; no forced GC');
  for (const [path, hash] of Object.entries(input.bindings))
    assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'), hash, `Input drift: ${path}`);
  const { runWorkload } = await import(pathToFileURL(input.workload));
  const imported = await measure(() => import(pathToFileURL(input.bundle)));
  result.import = imported.timing;
  const repeated = await measure(async () => {
    for (let episode = 0; episode < input.episodes; episode++) {
      if (input.sample.fault === 'drop-episode' && episode === input.episodes - 1) continue;
      const current = {};
      await runWorkload(imported.value, { ...input.sample, kind: 'cpu', fault: undefined }, current);
      assert.deepEqual(current.checkpoints, {});
      if (result.episodes.length) assert.deepEqual(current.oracles, result.episodes[0].oracles, 'repeated-work-oracle');
      result.episodes.push({ episode, stages: current.stages, oracles: current.oracles });
    }
  });
  result.repeatedIncludingChecks = repeated.timing;
  assert.equal(result.episodes.length, input.episodes, 'episode-count-oracle');
  assert.deepEqual(result.episodes.map(value => value.episode), Array.from({ length: input.episodes }, (_, i) => i), 'episode-order-oracle');
  result.passed = true;
} catch (error) {
  result.error = String(error?.stack ?? error);
  process.exitCode = 1;
}
console.log(JSON.stringify(result));
