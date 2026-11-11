#!/usr/bin/env node
// Staged, non-shipping consumer lab. Each packet is immutable after preparation;
// correction attempts get new directories. Never replace a failed receipt.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import os from 'node:os';
import { createRequire } from 'node:module';
import { buildIntegrity } from '../../scripts/publish-artifact-integrity.mjs';
import { RELEASE_PACKAGES } from '../../scripts/release-plan.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const [mode, suppliedPacket, ...rest] = process.argv.slice(2);
assert.ok(
  ['toolchain', 'prepare', 'build', 'build-dispatch', 'check-backend'].includes(
    mode
  ) && suppliedPacket,
  'lab.mjs toolchain PACKET | prepare PACKET REGISTRY_DIRECTORY V16_ROOT EXPECTED_SEAL TOOLCHAIN | build|build-dispatch PACKET | check-backend NEW_PACKET TOOLCHAIN'
);
const packet = resolve(suppliedPacket);
const json = (path, value) =>
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const sha = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');
const collect = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collect(path);
    assert.ok(entry.isFile(), `Unexpected file kind: ${path}`);
    return [path];
  });
const hashFiles = (paths) =>
  Object.fromEntries(paths.map((path) => [path, sha(path)]));
const verify = (bindings) => {
  for (const [path, expected] of Object.entries(bindings))
    assert.equal(sha(path), expected, `Input drift: ${path}`);
};
const run = (name, command, args, cwd) => {
  const log = join(packet, name + '.log');
  assert.ok(!existsSync(log), `Preserve first attempt: ${log}`);
  const started = Date.now();
  let receipt;
  try {
    const output = execFileSync(command, args, {
      cwd,
      encoding: 'utf8',
      env: {
        ...process.env,
        CI: 'true',
        NG_BUILD_MAX_WORKERS: '1',
        NX_DAEMON: 'false',
      },
      timeout: 600000,
      maxBuffer: 24 * 1024 * 1024,
    });
    writeFileSync(log, output, { flag: 'wx' });
    receipt = {
      command: [command, ...args],
      cwd,
      exit: 0,
      seconds: (Date.now() - started) / 1000,
    };
  } catch (error) {
    writeFileSync(
      log,
      String(error.stdout ?? '') +
        String(error.stderr ?? '') +
        String(error.stack),
      { flag: 'wx' }
    );
    receipt = {
      command: [command, ...args],
      cwd,
      exit: error.status ?? -1,
      seconds: (Date.now() - started) / 1000,
    };
    json(join(packet, name + '.receipt.json'), receipt);
    throw error;
  }
  json(join(packet, name + '.receipt.json'), receipt);
  console.log(name, 'passed');
};

if (mode === 'check-backend') {
  assert.ok(
    !existsSync(packet) && rest.length === 1,
    'Fresh output and frozen toolchain required'
  );
  const toolchain = resolve(rest[0]);
  const receipt = read(join(toolchain, 'toolchain.json'));
  assert.equal(sha(join(toolchain, 'package-lock.json')), receipt.lockSha256);
  mkdirSync(packet, { recursive: true });
  const inputs = hashFiles(
    [
      'model.ts',
      'dispatch-model.ts',
      'dispatch-backend.ts',
      'backend-check.mjs',
    ].map((name) => join(here, name))
  );
  const require = createRequire(join(toolchain, 'package.json'));
  require('esbuild').buildSync({
    entryPoints: [join(here, 'dispatch-backend.ts')],
    outfile: join(packet, 'backend.mjs'),
    bundle: true,
    platform: 'node',
    format: 'esm',
  });
  run(
    'backend-check',
    process.execPath,
    [join(here, 'backend-check.mjs'), join(packet, 'backend.mjs')],
    root
  );
  verify(inputs);
  json(join(packet, 'verification.json'), {
    inputs,
    toolchainLockSha256: receipt.lockSha256,
    bundleSha256: sha(join(packet, 'backend.mjs')),
    passed: true,
  });
} else if (mode === 'toolchain') {
  assert.ok(
    !existsSync(packet),
    'Toolchain installation requires a fresh directory'
  );
  mkdirSync(packet, { recursive: true });
  // One pinned union installation supplies exactly the same Angular/toolchain
  // files. Each served arm includes only its actually imported closure, which
  // is recorded from production build stats. SignalTree is not installed here.
  json(join(packet, 'package.json'), {
    name: 'signaltree-application-lab-toolchain',
    version: '0.0.0',
    private: true,
    type: 'module',
    dependencies: {
      '@angular/core': '22.0.7',
      '@angular/common': '22.0.7',
      '@angular/compiler': '22.0.7',
      '@angular/compiler-cli': '22.0.7',
      '@angular/platform-browser': '22.0.7',
      '@angular/build': '22.0.7',
      '@angular/cli': '22.0.7',
      '@ngrx/signals': '22.0.1',
      '@tanstack/angular-db': '0.2.12',
      '@tanstack/db': '0.15.2',
      '@tanstack/query-db-collection': '1.4.8',
      '@tanstack/query-core': '5.107.1',
      typescript: '6.0.3',
      rxjs: '7.8.2',
      tslib: '2.8.1',
      playwright: '1.56.1',
    },
  });
  run(
    'install',
    'npm',
    ['install', '--ignore-scripts', '--no-audit', '--no-fund'],
    packet
  );
  const locked = read(join(packet, 'package-lock.json'));
  const installed = {};
  for (const [name, wanted] of Object.entries(
    read(join(packet, 'package.json')).dependencies
  )) {
    const manifest = join(packet, 'node_modules', name, 'package.json');
    const version = read(manifest).version;
    assert.equal(version, wanted);
    installed[name] = {
      version,
      manifestSha256: sha(manifest),
      integrity: locked.packages['node_modules/' + name].integrity,
    };
  }
  json(join(packet, 'toolchain.json'), {
    node: process.version,
    installed,
    packageSha256: sha(join(packet, 'package.json')),
    lockSha256: sha(join(packet, 'package-lock.json')),
  });
} else if (mode === 'prepare') {
  assert.ok(
    !existsSync(packet),
    'Preparation requires a fresh packet directory'
  );
  assert.equal(rest.length, 4);
  const [registryDirectory, v16Root, expectedSeal, toolchainDirectory] =
    rest.map((value, index) => (index === 2 ? value : resolve(value)));
  const registryPath = join(registryDirectory, 'verification.json');
  const registry = read(registryPath);
  const registryClosurePath = join(registryDirectory, 'closure.json');
  const registryClosure = read(registryClosurePath);
  assert.equal(
    registryClosure.passed,
    true,
    'Registry consumer/signature checks must finish first'
  );
  assert.equal(registryClosure.registryVerificationSha256, sha(registryPath));
  assert.equal(registryClosure.candidateCommit, registry.candidateCommit);
  assert.equal(
    registry.candidateCommit,
    '37ef1788f6bac61678fc312f391b180bd7a6bbd7'
  );
  assert.deepEqual(
    registry.receipts.map((item) => item.name).sort(),
    RELEASE_PACKAGES.map((name) => '@signal-tree/' + name).sort()
  );
  const registryInputs = [registryPath, registryClosurePath];
  for (const receipt of registry.receipts) {
    assert.equal(receipt.version, '15.4.8');
    assert.equal(receipt.latest, '15.4.8');
    const path = join(registryDirectory, basename(receipt.tarball));
    assert.equal(
      'sha512-' +
        createHash('sha512').update(readFileSync(path)).digest('base64'),
      receipt.integrity
    );
    registryInputs.push(path);
  }
  for (const name of ['runtime', 'signatures', 'types', 'aot']) {
    const check = registryClosure.checks[name];
    assert.equal(check.exit, 0, `Registry ${name} failed`);
    assert.equal(sha(check.log), check.logSha256);
    registryInputs.push(check.log);
  }
  assert.equal(
    buildIntegrity(v16Root, RELEASE_PACKAGES),
    expectedSeal,
    'Wrong v16 built artifact'
  );
  const tc = read(join(toolchainDirectory, 'toolchain.json'));
  assert.equal(
    sha(join(toolchainDirectory, 'package-lock.json')),
    tc.lockSha256
  );
  assert.equal(sha(join(toolchainDirectory, 'package.json')), tc.packageSha256);
  mkdirSync(join(packet, 'archives'), { recursive: true });
  const artifacts = {};
  for (const name of ['kernel', 'angular']) {
    const source = registry.receipts.find(
      (item) => item.name === '@signal-tree/' + name
    );
    assert.equal(source.version, '15.4.8');
    const sourcePath = join(registryDirectory, basename(source.tarball));
    const integrity =
      'sha512-' +
      createHash('sha512').update(readFileSync(sourcePath)).digest('base64');
    assert.equal(integrity, source.integrity);
    const destination = join(packet, 'archives', `v15-${name}.tgz`);
    cpSync(sourcePath, destination);
    artifacts['v15-' + name] = {
      archive: destination,
      integrity,
      sourceCommit: registry.candidateCommit,
    };
    const packed = JSON.parse(
      execFileSync(
        'npm',
        [
          'pack',
          '--json',
          '--ignore-scripts',
          '--pack-destination',
          join(packet, 'archives'),
        ],
        { cwd: join(v16Root, 'dist/packages', name), encoding: 'utf8' }
      )
    )[0];
    const v16archive = join(packet, 'archives', packed.filename);
    artifacts['v16-' + name] = {
      archive: v16archive,
      integrity: packed.integrity,
      sourceSeal: expectedSeal,
    };
  }
  const arms = ['native', 'ngrx', 'tanstack', 'v15', 'v16'];
  const inputPaths = [
    fileURLToPath(import.meta.url),
    ...registryInputs,
    ...[
      'inventory-check.mjs',
      'dispatch-check.mjs',
      'measure.mjs',
      'dispatch-measure.mjs',
      'profile.mjs',
      'model.ts',
      'inventory-main.ts',
      'dispatch-main.ts',
      'dispatch-model.ts',
      'dispatch-backend.ts',
    ].map((name) => join(here, name)),
    ...['native', 'ngrx', 'tanstack', 'signaltree'].flatMap((name) =>
      ['inventory', 'dispatch'].map((scenario) =>
        join(here, 'arms', name + '-' + scenario + '.ts')
      )
    ),
    join(root, 'docs/audits/2026-11-11-application-comparison/PROTOCOL.md'),
    join(toolchainDirectory, 'package.json'),
    join(toolchainDirectory, 'package-lock.json'),
  ];
  for (const arm of arms) {
    const work = join(packet, arm);
    mkdirSync(join(work, 'src/arms'), { recursive: true });
    mkdirSync(join(work, 'node_modules'), { recursive: true });
    for (const name of readdirSync(join(toolchainDirectory, 'node_modules'))) {
      if (name !== '@signal-tree')
        symlinkSync(
          join(toolchainDirectory, 'node_modules', name),
          join(work, 'node_modules', name)
        );
    }
    if (arm === 'v15' || arm === 'v16') {
      for (const name of ['kernel', 'angular']) {
        const destination = join(work, 'node_modules/@signal-tree', name);
        mkdirSync(destination, { recursive: true });
        execFileSync('tar', [
          '-xzf',
          artifacts[arm + '-' + name].archive,
          '--strip-components=1',
          '-C',
          destination,
        ]);
        inputPaths.push(...collect(destination));
      }
    }
    cpSync(join(here, 'model.ts'), join(work, 'src/model.ts'));
    cpSync(join(here, 'inventory-main.ts'), join(work, 'src/main.ts'));
    for (const name of [
      'dispatch-main.ts',
      'dispatch-model.ts',
      'dispatch-backend.ts',
    ]) {
      cpSync(join(here, name), join(work, 'src', name));
    }
    const selected = arm.startsWith('v') ? 'signaltree' : arm;
    cpSync(
      join(here, 'arms', selected + '-inventory.ts'),
      join(work, 'src/arms/selected.ts')
    );
    cpSync(
      join(here, 'arms', selected + '-dispatch.ts'),
      join(work, 'src/arms/selected-dispatch.ts')
    );
    writeFileSync(
      join(work, 'src/arm.ts'),
      "export { createInventory } from './arms/selected';\n"
    );
    writeFileSync(
      join(work, 'src/dispatch-arm.ts'),
      "export { createDispatch } from './arms/selected-dispatch';\n"
    );
    if (arm.startsWith('v')) {
      const verb = arm === 'v15' ? 'transaction' : 'transact';
      writeFileSync(
        join(work, 'src/st-open.ts'),
        `import type { PendingTransaction } from '@signal-tree/angular';\nexport function open(tree: { ${verb}(work: () => void): PendingTransaction }, work: () => void): PendingTransaction { return tree.${verb}(work); }\n`
      );
    }
    writeFileSync(
      join(work, 'src/index.html'),
      '<!doctype html><html><head><meta charset="utf-8"><title>Dispatch inventory</title><link rel="icon" href="data:,"></head><body><lab-inventory></lab-inventory></body></html>'
    );
    writeFileSync(
      join(work, 'src/dispatch.html'),
      '<!doctype html><html><head><meta charset="utf-8"><title>Coordinated dispatch</title><link rel="icon" href="data:,"></head><body><lab-dispatch></lab-dispatch></body></html>'
    );
    json(join(work, 'package.json'), {
      name: `application-lab-${arm}`,
      version: '0.0.0',
      private: true,
      type: 'module',
    });
    json(join(work, 'tsconfig.json'), {
      compilerOptions: {
        strict: true,
        skipLibCheck: false,
        target: 'ES2022',
        module: 'preserve',
        moduleResolution: 'bundler',
        experimentalDecorators: true,
        useDefineForClassFields: false,
        lib: ['ES2022', 'DOM'],
        types: [],
      },
      angularCompilerOptions: {
        strictTemplates: true,
        compilationMode: 'full',
      },
      files: ['src/main.ts', 'src/dispatch-main.ts'],
    });
    const project = (scenario) => ({
      projectType: 'application',
      root: '',
      sourceRoot: 'src',
      architect: {
        build: {
          builder: '@angular/build:application',
          options: {
            browser:
              scenario === 'inventory' ? 'src/main.ts' : 'src/dispatch-main.ts',
            index: {
              input:
                scenario === 'inventory'
                  ? 'src/index.html'
                  : 'src/dispatch.html',
              output: 'index.html',
            },
            tsConfig: 'tsconfig.json',
            outputPath: 'dist/' + scenario,
            aot: true,
            polyfills: [],
          },
          configurations: {
            production: {
              optimization: true,
              sourceMap: {
                scripts: true,
                styles: false,
                hidden: true,
                vendor: true,
              },
              outputHashing: 'all',
            },
          },
          defaultConfiguration: 'production',
        },
      },
    });
    json(join(work, 'angular.json'), {
      version: 1,
      projects: {
        inventory: project('inventory'),
        dispatch: project('dispatch'),
      },
    });
    inputPaths.push(
      ...collect(join(work, 'src')),
      ...['package.json', 'tsconfig.json', 'angular.json'].map((name) =>
        join(work, name)
      )
    );
  }
  inputPaths.push(...collect(join(packet, 'archives')));
  json(join(packet, 'plan.json'), {
    createdUTC: new Date().toISOString(),
    arms,
    artifacts,
    toolchainDirectory,
    inputs: hashFiles(inputPaths),
    node: process.version,
    host: {
      cpu: os.cpus()[0]?.model,
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
    },
    phase:
      'Conformance before calibration; comparative timing schedule is not yet registered.',
    limits:
      'Experimental 20/1000/10000 rows, 40-row viewport. No INP, human productivity or calibrated-device claim.',
  });
  console.log('Prepared', packet);
} else {
  const plan = read(join(packet, 'plan.json'));
  verify(plan.inputs);
  const built = {};
  const scenario = mode === 'build-dispatch' ? 'dispatch' : 'inventory';
  for (const arm of plan.arms) {
    const work = join(packet, arm);
    run(
      'build-' + scenario + '-' + arm,
      process.execPath,
      [
        join(plan.toolchainDirectory, 'node_modules/@angular/cli/bin/ng.js'),
        'build',
        scenario,
        '--configuration=production',
        '--stats-json',
      ],
      work
    );
    const statsPath = join(work, 'dist', scenario, 'stats.json');
    const stats = read(statsPath);
    const dependencies = {};
    for (const path of Object.keys(stats.inputs)) {
      const actual = resolve(work, path);
      if (existsSync(actual)) dependencies[realpathSync(actual)] = sha(actual);
      else
        assert.ok(
          path.startsWith('angular:'),
          `Unbound nonvirtual build input ${path}`
        );
    }
    assert.ok(
      !Object.keys(dependencies).some((path) =>
        path.includes('/@angular/compiler/')
      ),
      'Runtime Angular compiler included'
    );
    if (arm.startsWith('v'))
      for (const name of ['kernel', 'angular']) {
        const selected = Object.keys(dependencies).filter((path) =>
          path.includes(`/@signal-tree/${name}/`)
        );
        assert.ok(selected.length);
        const expected =
          realpathSync(join(work, 'node_modules/@signal-tree', name)) + sep;
        assert.ok(
          selected.every((path) => path.startsWith(expected)),
          `Wrong ${arm} ${name} artifact`
        );
      }
    const served = collect(join(work, 'dist', scenario, 'browser'));
    const scripts = served.filter((path) => path.endsWith('.js'));
    built[arm] = {
      dependencies,
      served: hashFiles(served),
      statsSha256: sha(statsPath),
      jsBytes: scripts.reduce((sum, path) => sum + statSync(path).size, 0),
      jsGzipBytes: scripts.reduce(
        (sum, path) => sum + gzipSync(readFileSync(path)).length,
        0
      ),
      entryFiles: served.map((path) => relative(work, path)),
    };
  }
  verify(plan.inputs);
  json(
    join(
      packet,
      scenario === 'inventory' ? 'build.json' : 'dispatch-build.json'
    ),
    { planSha256: sha(join(packet, 'plan.json')), arms: built }
  );
}
