import assert from 'node:assert/strict';
import { writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { cpus, loadavg, freemem } from 'node:os';
import { read, sha, save, verify, fresh, profiles } from './common.mjs';

// This bounded follow-up retains the original packet and workload unchanged.
const [packetArg, kind, outputArg] = process.argv.slice(2), packetPath = resolve(packetArg);
const packet = read(packetPath), packetSha256 = sha(packetPath), here = dirname(fileURLToPath(import.meta.url));
assert.equal(process.version, 'v24.15.0'); assert(['controls', 'cpu'].includes(kind));
assert.equal(packet.kind, 'v15-construction-cost-v1'); verify(packet.bindings);
const out = fresh(outputArg, [dirname(packetPath), here]), harness = join(out, 'harness'); mkdirSync(harness);
const bindings = { [packetPath]: packetSha256, [process.execPath]: sha(process.execPath) };
for (const file of ['repeated-lifetimes.mjs', 'repeated-lifetimes-child.mjs', 'REPEATED-LIFETIMES.md']) {
  copyFileSync(join(here, file), join(harness, file)); bindings[join(here, file)] = sha(join(here, file)); bindings[join(harness, file)] = sha(join(harness, file));
}
bindings[join(here, 'common.mjs')] = sha(join(here, 'common.mjs'));
const selectedProfiles = profiles.filter(profile => ['ordinary', 'late-root'].includes(profile.id));
assert.equal(selectedProfiles.length, 2);
const samples = [], arms = ['baseline', 'planning', 'lazy'];
for (const carrier of ['neutral', 'angular']) for (const [profileIndex, profile] of selectedProfiles.entries()) {
  if (kind === 'controls') {
    for (const arm of arms) {
      samples.push({ arm, carrier, profile, round: 0 });
      samples.push({ arm, carrier, profile, round: 0, fault: 'drop-episode' });
    }
  } else for (let round = 0; round < 7; round++) {
    const offset = (round + profileIndex) % arms.length;
    const order = [...arms.slice(offset), ...arms.slice(0, offset)]; if (round % 2) order.reverse();
    for (const arm of order) {
      const primary = { arm, carrier, profile, round }, control = { ...primary, control: 'AA' };
      if (arm === 'baseline' && round % 2 === 0) samples.push(control);
      samples.push(primary);
      if (arm === 'baseline' && round % 2 !== 0) samples.push(control);
    }
  }
}
samples.forEach((sample, index) => { sample.index = index; });
save(join(out, 'plan.json'), { kind, packetPath, packetSha256, episodes: 12, command: process.argv, samples, bindings });
const groups = new Map();
for (const sample of samples) {
  const bundle = packet.bundles[sample.arm][sample.carrier][sample.profile.entry];
  const childBindings = { [bundle]: packet.bindings[bundle], [packet.node]: packet.bindings[packet.node], [join(harness, 'repeated-lifetimes-child.mjs')]: bindings[join(harness, 'repeated-lifetimes-child.mjs')] };
  for (const file of ['workload.mjs', 'common.mjs']) childBindings[join(packet.harness, file)] = packet.bindings[join(packet.harness, file)];
  const input = join(out, `input-${sample.index}.json`), output = join(out, `result-${sample.index}.json`);
  save(input, { sample, bundle, workload: join(packet.harness, 'workload.mjs'), episodes: 12, bindings: childBindings });
  const childCommand = [packet.node, join(harness, 'repeated-lifetimes-child.mjs'), input];
  const environment = { cpu: cpus()[0]?.model, cores: cpus().length, freeMemory: freemem(), loadavg: loadavg() };
  const startedUTC = new Date().toISOString(), clock = process.hrtime.bigint();
  const child = spawnSync(childCommand[0], childCommand.slice(1), { encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024, env: { ...process.env, NODE_OPTIONS: '', NODE_ENV: 'production' } });
  writeFileSync(output + '.stdout', child.stdout ?? '', { flag: 'wx' }); writeFileSync(output + '.stderr', child.stderr ?? '', { flag: 'wx' });
  let result; try { result = JSON.parse(child.stdout.trim()); } catch { result = { passed: false, error: 'Missing complete JSON' }; }
  save(output, result);
  const passed = sample.fault ? child.status === 1 && result.passed === false && result.error?.includes('episode-count-oracle')
    : child.status === 0 && result.passed === true && result.episodes.length === 12;
  save(join(out, `receipt-${sample.index}.json`), { sample, childCommand, environment, startedUTC, seconds: Number(process.hrtime.bigint() - clock) / 1e9,
    inputSha256: sha(input), resultSha256: sha(output), stdoutSha256: sha(output + '.stdout'), stderrSha256: sha(output + '.stderr'),
    exitCode: child.status, signal: child.signal, launchError: child.error?.message, passed });
  console.log(`${kind} ${sample.index + 1}/${samples.length} ${sample.arm}/${sample.carrier}/${sample.profile.id}: ${passed ? 'pass' : 'FAIL'}`);
  assert(passed, `Preserve failed child: ${output}`);
  if (!sample.fault) {
    const key = sample.carrier + '/' + sample.profile.id;
    if (groups.has(key)) assert.deepEqual(result.episodes.map(value => value.oracles), groups.get(key), 'same-observable-work-oracle');
    else groups.set(key, result.episodes.map(value => value.oracles));
  }
}
verify(packet.bindings); verify(bindings);
save(join(out, 'result.json'), { passed: true, kind, packetPath, packetSha256, children: samples.length, episodesPerChild: 12,
  bindingsUnchanged: true, sameObservableWork: true,
  limits: 'Repeated complete store lifetimes assess cold/warmed execution and amortization. Not one long-lived store or application throughput. Original adverse cohort remains evidence. No forced GC; automatic GC is part of CPU cost.' });
