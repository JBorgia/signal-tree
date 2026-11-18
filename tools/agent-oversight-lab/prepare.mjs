import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const [buildArg, outputArg] = process.argv.slice(2);
assert(
  buildArg && outputArg,
  'prepare.mjs IDENTIFIED_BUILD_DIRECTORY NEW_PACKET'
);
const build = resolve(buildArg),
  out = resolve(outputArg);
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const files = (root) =>
  readdirSync(root, { withFileTypes: true })
    .flatMap((e) => {
      assert(!e.isSymbolicLink(), 'No aliased package payloads');
      return e.isDirectory() ? files(join(root, e.name)) : [join(root, e.name)];
    })
    .sort();
const json = (p, value) =>
  writeFileSync(p, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const receiptPath = join(build, 'build-receipt.json');
const receipt = JSON.parse(readFileSync(receiptPath));
assert.equal(receipt.exitCode, 0);
assert.equal(receipt.sourceUnchanged, true);
assert.match(receipt.head, /^[0-9a-f]{40}$/);
assert.match(receipt.sourceSeal, /^[0-9a-f]{64}$/);
mkdirSync(out);
mkdirSync(join(out, 'packs'));
const sourceIdentity = {
  head: receipt.head,
  sourceSeal: receipt.sourceSeal,
  buildReceiptSha256: sha(receiptPath),
};
const line = JSON.parse(
  readFileSync(join(build, 'kernel/package.json'))
).version.split('.')[0];
assert(['15', '16'].includes(line));
const plan = {
  sourceIdentity,
  line,
  artifacts: {},
  payloads: {},
  inputs: { [receiptPath]: sha(receiptPath) },
  commands: [],
};
for (const name of ['kernel', 'angular']) {
  const descriptorPath = join(build, name + '.json');
  const descriptor = JSON.parse(readFileSync(descriptorPath));
  assert.equal(descriptor.head, receipt.head);
  assert.equal(descriptor.sourceSeal, receipt.sourceSeal);
  assert.equal(descriptor.buildReceiptSha256, sha(receiptPath));
  assert.equal(sha(descriptor.buildReceipt), sha(receiptPath));
  const inventory = Object.fromEntries(
    files(descriptor.root).map((p) => [relative(descriptor.root, p), sha(p)])
  );
  assert.deepEqual(
    inventory,
    descriptor.files,
    'Exact identified package bytes'
  );
  plan.inputs[descriptorPath] = sha(descriptorPath);
  const args = [
    'pack',
    '--ignore-scripts',
    '--json',
    '--pack-destination',
    join(out, 'packs'),
  ];
  const result = spawnSync('npm', args, {
    cwd: descriptor.root,
    encoding: 'utf8',
    env: { ...process.env, npm_config_cache: join(out, 'cache') },
  });
  writeFileSync(join(out, name + '-pack.log'), result.stdout + result.stderr);
  assert.equal(result.status, 0, 'Pack failed: see preserved log');
  const packed = JSON.parse(result.stdout)[0];
  // Angular publishes src declarations; its build-only dist/index.d.ts is
  // deliberately excluded by the package manifest. Bind that exact omission.
  const excluded = name === 'angular' ? ['dist/index.d.ts'] : [];
  const shipped = Object.fromEntries(
    Object.entries(inventory).filter(([p]) => !excluded.includes(p))
  );
  assert.deepEqual(
    packed.files.map((f) => f.path).sort(),
    Object.keys(shipped).sort(),
    'Canonical package file set differs'
  );
  plan.payloads[name] = shipped;
  const archive = join(out, 'packs', packed.filename);
  const extracted = join(out, 'extracted-' + name);
  mkdirSync(extracted);
  const extraction = spawnSync('tar', ['-xzf', archive, '-C', extracted], {
    encoding: 'utf8',
  });
  assert.equal(extraction.status, 0, extraction.stderr);
  const extractedRoot = join(extracted, 'package');
  assert.deepEqual(
    Object.fromEntries(
      files(extractedRoot).map((p) => [relative(extractedRoot, p), sha(p)])
    ),
    shipped,
    'Archive contents must match identified source payloads'
  );
  plan.artifacts['v' + line + '-' + name] = {
    archive,
    integrity:
      'sha512-' +
      createHash('sha512').update(readFileSync(archive)).digest('base64'),
    sourceIdentity,
  };
  plan.commands.push({
    command: 'npm',
    args,
    cwd: descriptor.root,
    exit: result.status,
  });
}
json(join(out, 'plan.json'), plan);
json(join(out, 'config.json'), {
  artifactPlan: join(out, 'plan.json'),
  artifactPlanSha256: sha(join(out, 'plan.json')),
  line,
  sourceIdentity,
  artifacts: {
    kernel: plan.artifacts['v' + line + '-kernel'],
    angular: plan.artifacts['v' + line + '-angular'],
  },
  limits:
    'Identified prior successful build, exact payload repack. In-memory local evaluation, not production authority or new release qualification.',
});
console.log(join(out, 'config.json'));
