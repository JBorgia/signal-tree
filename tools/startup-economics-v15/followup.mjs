// Registered follow-up: preserve the first adverse cohort and isolate its two
// source changes using the SAME frozen child workload and package fixtures.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const [command, configArg, outputArg] = process.argv.slice(2);
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const save = (p, value) => writeFileSync(p, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const configPath = resolve(configArg), config = read(configPath), out = resolve(outputArg);
const script = fileURLToPath(import.meta.url);
const verify = bindings => { for (const [p, h] of Object.entries(bindings)) assert.equal(sha(p), h, p); };
assert.equal(process.version, 'v24.15.0');
if (command === 'plan') {
  assert(!existsSync(out)); mkdirSync(out, { recursive: true });
  assert.deepEqual(Object.keys(config.arms).sort(), ['baseline', 'combined', 'sparse']);
  const bindings = { [configPath]: sha(configPath), [script]: sha(script), [config.child]: sha(config.child) };
  for (const path of Object.values(config.arms)) { bindings[path] = sha(path); Object.assign(bindings, read(path).bindings); }
  verify(bindings);
  const samples = [], arms = ['baseline', 'sparse', 'combined'];
  for (const [profileIndex, profile] of ['entities-10000', 'transactions-10000', 'ordinary'].entries()) {
    for (let round = 0; round < 7; round++) {
      const offset = (profileIndex + round) % 3;
      const order = [...arms.slice(offset), ...arms.slice(0, offset)];
      if (round % 2) order.reverse();
      for (const arm of order) {
        const sample = { carrier: 'angular', profile, round, arm, kind: 'cpu' };
        if (arm === 'baseline' && round % 2 === 0) samples.push({ ...sample, arm: 'baseline-aa' });
        samples.push(sample);
        if (arm === 'baseline' && round % 2 !== 0) samples.push({ ...sample, arm: 'baseline-aa' });
      }
    }
  }
  assert.equal(samples.length, 84);
  save(join(out, 'plan.json'), { command: process.argv, createdUTC: new Date().toISOString(), config, bindings, samples,
    limits: 'Seven matched rounds, 84 serial fresh processes. Angular facade only, same unminified production-defined child as initial cohort. No discarded warmups. A/A is observed noise, not confidence interval. Ordinary:64x128 leaves,4096 checked writes,64 late scalar Links. Entities:10k rows,100 held row nodes,1000 checked writes,full reversed replacement,ABA lifetime check. Configured transactions includes enhancer but does not time explicit transaction settlement.' });
  console.log(join(out, 'plan.json'));
} else if (command === 'run') {
  const planPath = resolve(configArg), plan = read(planPath);
  assert(!existsSync(out)); mkdirSync(out, { recursive: true });
  const results = [];
  verify(plan.bindings);
  save(join(out, 'admission.json'), { planPath, planSha256: sha(planPath), command: process.argv });
  for (const [index, sample] of plan.samples.entries()) {
    const packet = plan.config.arms[sample.arm === 'baseline-aa' ? 'baseline' : sample.arm];
    const args = [plan.config.child, 'child', packet, JSON.stringify(sample)];
    const child = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024, env: { ...process.env, NODE_OPTIONS: '', NODE_ENV: 'production' } });
    writeFileSync(join(out, `${index}.stdout`), child.stdout ?? '', { flag: 'wx' });
    writeFileSync(join(out, `${index}.stderr`), child.stderr ?? '', { flag: 'wx' });
    save(join(out, `${index}.invocation.json`), { args, status: child.status, signal: child.signal, error: String(child.error ?? '') });
    assert.equal(child.status, 0, `Child ${index}: ${child.stderr}`);
    results.push(JSON.parse(child.stdout));
    console.log(index, sample.profile, sample.arm, 'passed');
  }
  verify(plan.bindings); save(join(out, 'results.json'), results);
} else throw new Error('Expected plan or run');
