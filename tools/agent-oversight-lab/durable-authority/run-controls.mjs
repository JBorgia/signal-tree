import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

assert(process.argv[2], 'run-controls.mjs NEW_OUTPUT');
assert.equal(process.versions.node, '24.15.0');
const output = resolve(process.argv[2]);
mkdirSync(output);
const here = dirname(fileURLToPath(import.meta.url));
const files = ['store.mjs', 'server.mjs', 'process.mjs', 'control-oracle.mjs'];
const sha = (value) => createHash('sha256').update(value).digest('hex');
const inputs = Object.fromEntries(
  files.map((file) => [file, sha(readFileSync(join(here, file)))])
);
const original = readFileSync(join(here, 'store.mjs'), 'utf8');
const changes = {
  authorization: [
    "this.writable(session, 'reviewer');",
    '/* Planted defect: proposer credentials can exercise reviewer authority. */',
  ],
  'duplicate-effect': [
    "this.db.exec('COMMIT');\n        return { receipt, duplicate: true };",
    "this.run('UPDATE entities SET effects=effects+1 WHERE tenant=? AND destination=? AND entity_id=?', tenant, destination, 'delivery-1');\n        this.db.exec('COMMIT');\n        return { receipt, duplicate: true };",
  ],
};
const results = [];
for (const [kind, [needle, replacement]] of Object.entries(changes)) {
  assert(original.includes(needle), 'Mutation must match actual source');
  for (const mutant of [false, true]) {
    const directory = join(output, kind + (mutant ? '-mutant' : '-baseline'));
    mkdirSync(directory);
    for (const file of files)
      copyFileSync(join(here, file), join(directory, file));
    if (mutant)
      writeFileSync(
        join(directory, 'store.mjs'),
        original.replace(needle, replacement)
      );
    const args = [join(directory, 'control-oracle.mjs'), kind, directory];
    const startedUTC = new Date().toISOString();
    const run = spawnSync(process.execPath, args, {
      encoding: 'utf8',
      timeout: 30000,
    });
    const log =
      (run.stdout ?? '') +
      (run.stderr ?? '') +
      (run.error ? String(run.error) : '');
    writeFileSync(join(directory, 'test.log'), log);
    const oracle =
      kind === 'authorization'
        ? 'authorization-zero-effects'
        : 'duplicate-one-effect';
    const expectedEffects = kind === 'authorization' ? 1 : 2;
    results.push({
      kind,
      mutant,
      startedUTC,
      finishedUTC: new Date().toISOString(),
      command: [process.execPath, ...args],
      exitCode: run.status,
      logSha256: sha(log),
      sourceHash: sha(readFileSync(join(directory, 'store.mjs'))),
      mutation: mutant ? { needle, replacement } : null,
    });
    writeFileSync(
      join(output, 'receipt.json'),
      JSON.stringify({ node: process.version, inputs, results }, null, 2) + '\n'
    );
    if (mutant) {
      assert.equal(run.status, 1, 'Planted defect must fail');
      assert.ok(
        log.includes(`"oracle":"${oracle}","effects":${expectedEffects}`),
        'Failure must reach actual effect oracle'
      );
      assert.ok(
        log.includes('AssertionError') && log.includes(oracle),
        'Expected named assertion must fail'
      );
    } else assert.equal(run.status, 0, log);
  }
}
for (const file of files)
  assert.equal(
    sha(readFileSync(join(here, file))),
    inputs[file],
    'Original source unchanged'
  );
console.log(
  JSON.stringify({ baselinePassed: 2, plantedDefectsDetected: 2, output })
);
