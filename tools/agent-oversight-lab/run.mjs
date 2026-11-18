import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url)),
  repo = resolve(here, '../..');
const [configArg, outArg, lineArg = '16', mode] = process.argv.slice(2);
assert(mode === undefined || mode === '--common-only');
assert(
  configArg && outArg && ['15', '16'].includes(lineArg),
  'run.mjs CONFIG NEW_OUTPUT [15|16]'
);
const out = resolve(outArg),
  configPath = resolve(configArg);
const config = JSON.parse(readFileSync(configPath));
const hash = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
mkdirSync(out);
const evidence = {
  line: lineArg,
  createdUTC: new Date().toISOString(),
  node: process.version,
  command: [process.execPath, ...process.argv.slice(1)],
  config: { path: configPath, sha256: hash(configPath) },
  inputs: {},
  commands: [],
  limits:
    'Functional local fixtures; no real model, production auth, durable recovery, performance or release certification.',
};
const save = () =>
  writeFileSync(
    join(out, 'receipt.json'),
    JSON.stringify(evidence, null, 2) + '\n'
  );
function run(id, command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      ST_OVERSIGHT_LINE: lineArg,
      npm_config_cache: join(out, 'cache'),
    },
  });
  const log = join(out, id + '.log');
  writeFileSync(
    log,
    (result.stdout ?? '') +
      (result.stderr ?? '') +
      (result.error ? String(result.error) : ''),
    { flag: 'wx' }
  );
  evidence.commands.push({
    id,
    command,
    args,
    cwd,
    exit: result.status,
    log,
    sha256: hash(log),
  });
  save();
  assert.equal(result.status, 0, id + ' failed; preserved ' + log);
}
const files = (p) =>
  readdirSync(p, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? files(join(p, e.name)) : [join(p, e.name)]
    )
    .sort();
try {
  evidence.inputs[config.artifactPlan] = hash(config.artifactPlan);
  assert.equal(hash(config.artifactPlan), config.artifactPlanSha256);
  const plan = JSON.parse(readFileSync(config.artifactPlan));
  assert.equal(config.line, lineArg);
  for (const [name, artifact] of Object.entries(config.artifacts)) {
    assert.deepEqual(artifact, plan.artifacts['v' + lineArg + '-' + name]);
    assert.equal(
      artifact.integrity,
      'sha512-' +
        createHash('sha512')
          .update(readFileSync(artifact.archive))
          .digest('base64')
    );
    evidence.inputs[artifact.archive] = hash(artifact.archive);
  }
  let consumer;
  if (lineArg === '16' && mode !== '--common-only') {
    run(
      'public-workflow',
      process.execPath,
      [
        join(repo, 'tools/agent-collaboration-lab/public-workflow.mjs'),
        configPath,
        join(out, 'public'),
      ],
      repo
    );
    consumer = join(out, 'public/consumer');
  } else {
    consumer = join(out, 'consumer');
    mkdirSync(consumer);
    writeFileSync(
      join(consumer, 'package.json'),
      JSON.stringify({
        name: 'oversight-v15-consumer',
        version: '0.0.0',
        private: true,
        type: 'module',
      })
    );
    const require = createRequire(join(repo, 'package.json'));
    const peerPacks = join(out, 'peer-packs');
    mkdirSync(peerPacks);
    run(
      'pack-tslib',
      'npm',
      [
        'pack',
        '--offline',
        '--ignore-scripts',
        '--json',
        '--pack-destination',
        peerPacks,
      ],
      dirname(require.resolve('tslib/package.json'))
    );
    const peers = files(peerPacks);
    for (const path of peers) evidence.inputs[path] = hash(path);
    run(
      'install',
      'npm',
      [
        'install',
        '--offline',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        config.artifacts.kernel.archive,
        ...peers,
      ],
      consumer
    );
    const reference = join(repo, 'tools/experiments/multi-actor-operations');
    for (const name of [
      'coordinator.mjs',
      'dispatch-fixture.mjs',
      'cleanup.mjs',
      'authority',
      'http',
    ])
      cpSync(join(reference, name), join(consumer, name), { recursive: true });
  }
  for (const name of [
    'coordinator.mjs',
    'dispatch-fixture.mjs',
    'cleanup.mjs',
    'authority/review-fixture.mjs',
    'http/fixture.mjs',
  ])
    evidence.inputs[join(consumer, name)] = hash(join(consumer, name));
  const tests = join(here, 'oversight.checks.mjs');
  evidence.inputs[tests] = hash(tests);
  cpSync(tests, join(consumer, 'oversight.checks.mjs'));
  evidence.inputs[fileURLToPath(import.meta.url)] = hash(
    fileURLToPath(import.meta.url)
  );
  const installed = join(consumer, 'node_modules/@signal-tree/kernel');
  evidence.installedKernel = Object.fromEntries(
    files(installed).map((p) => [relative(installed, p), hash(p)])
  );
  assert.deepEqual(
    evidence.installedKernel,
    plan.payloads.kernel,
    'Installed kernel payload must equal identified package'
  );
  assert.equal(
    JSON.parse(readFileSync(join(installed, 'package.json'))).version.split(
      '.'
    )[0],
    lineArg
  );
  run(
    'oversight',
    process.execPath,
    ['--test', 'oversight.checks.mjs'],
    consumer
  );
  if (lineArg === '16' && mode !== '--common-only')
    run(
      'http-browser',
      process.execPath,
      [
        join(repo, 'tools/agent-collaboration-lab/http-browser/run.mjs'),
        configPath,
        join(out, 'http-browser'),
      ],
      repo
    );
  evidence.outcome = 'PASS';
  save();
  console.log(out);
} catch (error) {
  evidence.outcome = 'FAIL';
  evidence.error = String(error);
  save();
  throw error;
}
