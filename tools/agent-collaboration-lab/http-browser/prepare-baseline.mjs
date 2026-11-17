#!/usr/bin/env node
// Repack only the frozen baseline's verified installed payloads. This does not
// build, qualify, install, publish or modify either runtime or original archive.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const [configArg, outputArg] = process.argv.slice(2);
assert(
  configArg && outputArg && process.argv.length === 4,
  'prepare-baseline.mjs ORIGINAL_PUBLIC_WORKFLOW_CONFIG NEW_OUTPUT_DIRECTORY'
);
const tool = fileURLToPath(import.meta.url);
const repository = resolve(dirname(tool), '../../..');
const configPath = realpathSync(resolve(configArg));
const config = JSON.parse(readFileSync(configPath));
const originalPlanPath = realpathSync(config.artifactPlan);
const baseline = dirname(originalPlanPath);
const out = resolve(outputArg);
assert(!existsSync(out), 'Preserve previous attempt/output');
for (const inputRoot of [repository, baseline]) {
  assert(
    out !== inputRoot && !out.startsWith(inputRoot + sep),
    'Output must not modify source checkout or frozen baseline'
  );
}
let existingParent = dirname(out);
while (!existsSync(existingParent)) existingParent = dirname(existingParent);
const actualOut = resolve(
  realpathSync(existingParent),
  relative(existingParent, out)
);
for (const inputRoot of [realpathSync(repository), baseline]) {
  assert(
    actualOut !== inputRoot && !actualOut.startsWith(inputRoot + sep),
    'Output alias points inside immutable input'
  );
}
const sha = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');
const integrity = (path) =>
  'sha512-' + createHash('sha512').update(readFileSync(path)).digest('base64');
const json = (path, value) =>
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const files = (root) =>
  readdirSync(root, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(root, entry.name);
      assert(!entry.isSymbolicLink(), `Aliased package payload ${path}`);
      if (entry.isDirectory()) return files(path);
      assert(
        entry.isFile() && lstatSync(path).isFile(),
        `Non-file package payload ${path}`
      );
      return [path];
    })
    .sort();
const inventory = (root) =>
  Object.fromEntries(
    files(root).map((path) => [relative(root, path), sha(path)])
  );
mkdirSync(out, { recursive: true });
mkdirSync(join(out, 'logs'));
const inputs = {};
const receipt = {
  createdUTC: new Date().toISOString(),
  command: [process.execPath, ...process.argv.slice(1)],
  mode: 'Clean archive representation of exact frozen baseline payloads',
  qualified: false,
  commands: [],
  inputs,
  packages: {},
  limits:
    'No install/build/AOT/browser/runtime qualification, new source revision or registry publication is established by this repack.',
};
const save = () =>
  writeFileSync(
    join(out, 'preparation.json'),
    JSON.stringify(receipt, null, 2) + '\n'
  );
const bind = (path) => {
  inputs[path] = sha(path);
};
const copy = (source, destination) => {
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
  assert.equal(sha(destination), sha(source));
  bind(destination);
};
function run(name, command, args, options = {}) {
  const startedUTC = new Date().toISOString();
  const result = spawnSync(command, args, {
    cwd: out,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    ...options,
  });
  const stdout = join(out, 'logs', name + '.stdout.log'),
    stderr = join(out, 'logs', name + '.stderr.log');
  writeFileSync(stdout, result.stdout ?? '', { flag: 'wx' });
  writeFileSync(
    stderr,
    (result.stderr ?? '') + (result.error ? String(result.error) : ''),
    { flag: 'wx' }
  );
  receipt.commands.push({
    name,
    command,
    args,
    cwd: out,
    startedUTC,
    finishedUTC: new Date().toISOString(),
    exitCode: result.status,
    stdout,
    stdoutSha256: sha(stdout),
    stderr,
    stderrSha256: sha(stderr),
    ...(options.env?.COPYFILE_DISABLE
      ? { COPYFILE_DISABLE: options.env.COPYFILE_DISABLE }
      : {}),
  });
  save();
  assert.equal(result.status, 0, `${name} failed; original output preserved`);
  return result;
}
// Python's standard tar reader reports raw archive regular-file members without
// macOS tar's AppleDouble extraction behavior. Nothing is extracted here.
const inspectPython = String.raw`
import hashlib,json,pathlib,sys,tarfile
archive=sys.argv[1]
regular={};metadata={};directories=[];seen=set();pax={}
with tarfile.open(archive,'r:*') as source:
  for member in source.getmembers():
    name=member.name.rstrip('/')
    if name in seen: raise RuntimeError('Duplicate member '+name)
    seen.add(name)
    parts=name.split('/')
    if name.startswith('/') or any(part in ('','..','.') for part in parts): raise RuntimeError('Noncanonical member '+name)
    if member.pax_headers: pax[name]=member.pax_headers
    if member.isdir():
      directories.append(name);continue
    if not member.isfile(): raise RuntimeError('Non-regular member '+name)
    data=source.extractfile(member).read()
    item={'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)}
    if pathlib.PurePosixPath(name).name.startswith('._'):
      if data[:4] != bytes.fromhex('00051607'): raise RuntimeError('Not AppleDouble metadata '+name)
      metadata[name]=item
    else: regular[name]=item
print(json.dumps({'archive':archive,'regular':regular,'appleDouble':metadata,'directories':directories,'paxHeaders':pax},sort_keys=True))
`;
try {
  bind(tool);
  bind(configPath);
  bind(originalPlanPath);
  assert.equal(
    sha(originalPlanPath),
    config.artifactPlanSha256,
    'Original artifact plan changed'
  );
  const originalPlan = JSON.parse(readFileSync(originalPlanPath));
  assert.deepEqual(Object.keys(config.artifacts).sort(), ['angular', 'kernel']);
  assert.equal(
    config.sourceRevision,
    originalPlan.artifacts['v16-kernel'].sourceCommit,
    'Baseline source revision differs'
  );
  assert.equal(
    config.sourceRevision,
    '5d04ff65d2eaab1986ed1b420cbc013edc01542b',
    'This helper is scoped to the frozen v16 baseline'
  );
  copy(configPath, join(out, 'original-config.json'));
  copy(originalPlanPath, join(out, 'original-plan.json'));
  copy(tool, join(out, 'prepare-baseline.source.mjs'));
  writeFileSync(join(out, 'inspect-archive.py'), inspectPython, { flag: 'wx' });
  bind(join(out, 'inspect-archive.py'));
  const pythonVersion = run('python-version', 'python3', ['--version']);
  receipt.python = pythonVersion.stdout.trim();
  const artifacts = {};
  const expectedCounts = { kernel: 144, angular: 16 };
  for (const name of ['kernel', 'angular']) {
    const originalArtifact = originalPlan.artifacts[`v16-${name}`];
    assert.deepEqual(
      config.artifacts[name],
      originalArtifact,
      `Configured ${name} is not the bound original artifact`
    );
    assert.equal(
      integrity(originalArtifact.archive),
      originalArtifact.integrity,
      `Original ${name} archive changed`
    );
    bind(originalArtifact.archive);
    const root = join(baseline, 'v16/node_modules/@signal-tree', name);
    assert.equal(
      realpathSync(root),
      root,
      'Installed payload root must be the named frozen directory'
    );
    const prefix = root + sep;
    const expected = Object.fromEntries(
      Object.entries(originalPlan.inputs)
        .filter(([path]) => path.startsWith(prefix))
        .map(([path, hash]) => [path.slice(prefix.length), hash])
        .sort(([a], [b]) => a.localeCompare(b))
    );
    assert.equal(
      Object.keys(expected).length,
      expectedCounts[name],
      `Wrong ${name} baseline inventory`
    );
    assert(
      Object.values(expected).every(
        (hash) => typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash)
      ),
      'Invalid bound file digest'
    );
    assert.deepEqual(
      inventory(root),
      expected,
      `Installed ${name} payload differs from original plan`
    );
    const manifest = JSON.parse(readFileSync(join(root, 'package.json')));
    assert.equal(manifest.name, '@signal-tree/' + name);
    const originalCopy = join(
      out,
      'original-archives',
      basename(originalArtifact.archive)
    );
    copy(originalArtifact.archive, originalCopy);
    const oldIndex = JSON.parse(
      run(`inspect-original-${name}`, 'python3', [
        join(out, 'inspect-archive.py'),
        originalCopy,
      ]).stdout
    );
    const expectedArchive = Object.fromEntries(
      Object.entries(expected).map(([path, digest]) => [
        'package/' + path,
        digest,
      ])
    );
    assert.deepEqual(
      Object.fromEntries(
        Object.entries(oldIndex.regular).map(([path, data]) => [
          path,
          data.sha256,
        ])
      ),
      expectedArchive,
      `Original ${name} substantive archive payload differs from frozen installed payload`
    );
    for (const metadataPath of Object.keys(oldIndex.appleDouble)) {
      const target = join(
        dirname(metadataPath),
        basename(metadataPath).slice(2)
      );
      assert(
        Object.hasOwn(oldIndex.regular, target) ||
          oldIndex.directories.includes(target),
        `AppleDouble member has no substantive file/directory target: ${metadataPath}`
      );
    }
    // Known historical filesystem sidecars are classified, hashed and kept in
    // the unchanged original archive; no arbitrary extra payload is discarded.
    const oldReceiptPath = join(out, `${name}-original-archive-inventory.json`);
    json(oldReceiptPath, oldIndex);
    bind(oldReceiptPath);
    const snapshot = join(out, 'snapshots', name, 'package');
    for (const relativePath of Object.keys(expected)) {
      assert(
        !relativePath.startsWith('/') &&
          !relativePath
            .split('/')
            .some((part) => part === '..' || part === '.' || part === ''),
        'Unsafe payload key'
      );
      bind(join(root, relativePath));
      copy(join(root, relativePath), join(snapshot, relativePath));
    }
    assert.deepEqual(inventory(snapshot), expected, `Copied ${name} changed`);
    const archive = join(out, 'archives', `v16-${name}.tgz`);
    mkdirSync(dirname(archive), { recursive: true });
    run(
      `repack-${name}`,
      'tar',
      ['-czf', archive, '-C', dirname(snapshot), 'package'],
      { env: { ...process.env, COPYFILE_DISABLE: '1' } }
    );
    bind(archive);
    const cleanIndex = JSON.parse(
      run(`inspect-clean-${name}`, 'python3', [
        join(out, 'inspect-archive.py'),
        archive,
      ]).stdout
    );
    assert.deepEqual(
      cleanIndex.appleDouble,
      {},
      'Clean archive has AppleDouble metadata'
    );
    assert.deepEqual(
      Object.fromEntries(
        Object.entries(cleanIndex.regular).map(([path, data]) => [
          path,
          data.sha256,
        ])
      ),
      expectedArchive,
      'Clean archive must have exactly every verified payload and no extra files'
    );
    const expectedDirectories = new Set(['package']);
    for (const path of Object.keys(expectedArchive)) {
      const parts = path.split('/');
      for (let length = 1; length < parts.length; length++)
        expectedDirectories.add(parts.slice(0, length).join('/'));
    }
    assert.deepEqual(
      cleanIndex.directories.sort(),
      [...expectedDirectories].sort(),
      'Clean archive directory inventory differs'
    );
    const cleanReceiptPath = join(out, `${name}-clean-archive-inventory.json`);
    json(cleanReceiptPath, cleanIndex);
    bind(cleanReceiptPath);
    artifacts[`v16-${name}`] = {
      ...originalArtifact,
      archive,
      integrity: integrity(archive),
      note: 'Repacked identical frozen payloads without AppleDouble sidecars; unbuilt/unqualified in this new archive representation.',
      repackProvenance: {
        originalArtifact,
        originalPlan: originalPlanPath,
        originalPlanSha256: sha(originalPlanPath),
        installedPayloadRoot: root,
        exactFileCount: expectedCounts[name],
        originalArchiveInventory: {
          path: oldReceiptPath,
          sha256: sha(oldReceiptPath),
        },
        cleanArchiveInventory: {
          path: cleanReceiptPath,
          sha256: sha(cleanReceiptPath),
        },
      },
    };
    receipt.packages[name] = {
      root,
      originalArchive: originalCopy,
      originalIntegrity: originalArtifact.integrity,
      appleDoubleMembers: Object.keys(oldIndex.appleDouble).length,
      snapshot,
      exactPayloads: expected,
      archive,
      integrity: integrity(archive),
      sourceRevision: config.sourceRevision,
    };
    save();
  }
  const kernelManifest = JSON.parse(
    readFileSync(join(out, 'snapshots/kernel/package/package.json'))
  );
  const angularManifest = JSON.parse(
    readFileSync(join(out, 'snapshots/angular/package/package.json'))
  );
  assert.equal(
    angularManifest.dependencies['@signal-tree/kernel'],
    kernelManifest.version,
    'Facade/kernel version pairing changed'
  );
  for (const [path, expected] of Object.entries(inputs))
    assert.equal(
      sha(path),
      expected,
      `Bound input changed during preparation: ${path}`
    );
  const planPath = join(out, 'plan.json');
  json(planPath, {
    schemaVersion: 1,
    createdUTC: new Date().toISOString(),
    arms: ['v16'],
    artifacts,
    inputs,
    phase:
      'Exact frozen baseline payloads repacked; no build or consumer qualification',
    sourceRevision: config.sourceRevision,
    repack: {
      command: receipt.command,
      originalConfig: { path: configPath, sha256: sha(configPath) },
      originalPlan: { path: originalPlanPath, sha256: sha(originalPlanPath) },
      script: { path: tool, sha256: sha(tool) },
      excludes:
        'Only verified AppleDouble sidecar archive members; substantive payload bytes unchanged',
      limits: receipt.limits,
    },
  });
  const nextConfig = {
    ...config,
    artifactPlan: planPath,
    artifactPlanSha256: sha(planPath),
    artifacts: {
      kernel: artifacts['v16-kernel'],
      angular: artifacts['v16-angular'],
    },
    limits:
      config.limits +
      ' Clean repack only; fresh installed consumer qualification required.',
  };
  const nextConfigPath = join(out, 'public-workflow.baseline-clean.json');
  json(nextConfigPath, nextConfig);
  receipt.complete = true;
  receipt.plan = { path: planPath, sha256: sha(planPath) };
  receipt.config = { path: nextConfigPath, sha256: sha(nextConfigPath) };
  save();
  console.log(
    JSON.stringify(
      {
        output: out,
        config: nextConfigPath,
        plan: planPath,
        qualified: false,
        packages: Object.fromEntries(
          Object.entries(receipt.packages).map(([name, value]) => [
            name,
            {
              payloads: Object.keys(value.exactPayloads).length,
              oldAppleDoubleMembers: value.appleDoubleMembers,
              integrity: value.integrity,
            },
          ])
        ),
      },
      null,
      2
    )
  );
} catch (error) {
  receipt.complete = false;
  receipt.error = String(error);
  save();
  throw error;
}
