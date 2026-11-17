import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import {
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import linker from '@angular/compiler-cli/linker/babel';
import { startReferenceServer } from './server.mjs';
import { runBrowserChecks } from './checks.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repository = resolve(here, '../../..');
const experiment = join(repository, 'tools/experiments/multi-actor-operations');
const [configArg, outputArg, controlArg] = process.argv.slice(2);
assert(
  configArg && outputArg,
  'run.mjs CONFIG NEW_OUTPUT [--control=skip-native-settlement|ignore-instance]'
);
const control = controlArg?.replace(/^--control=/, '') ?? 'none';
assert(
  ['none', 'skip-native-settlement', 'ignore-instance'].includes(control),
  'Unknown control'
);
const configPath = realpathSync(resolve(configArg));
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const work = resolve(outputArg);
assert(
  !work.startsWith(repository + sep) && work !== repository,
  'Evidence/consumer output must be outside checkout'
);
const hash = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');
const integrity = (path) =>
  'sha512-' + createHash('sha512').update(readFileSync(path)).digest('base64');
const files = (root) =>
  readdirSync(root, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? files(join(root, entry.name))
        : [join(root, entry.name)]
    )
    .sort();
const inventory = (root) =>
  Object.fromEntries(
    files(root).map((path) => [relative(root, path), hash(path)])
  );
const require = createRequire(join(repository, 'package.json'));
const compilerPackage = require.resolve('@angular/compiler-cli/package.json');
const babel = createRequire(compilerPackage)('@babel/core');
mkdirSync(work); // Failed attempts cannot be overwritten.
const consumer = join(work, 'consumer'),
  packs = join(work, 'packs'),
  logs = join(work, 'logs');
for (const path of [consumer, packs, logs, join(consumer, 'browser')])
  mkdirSync(path, { recursive: true });
const manifest = {
  createdUTC: new Date().toISOString(),
  command: [process.execPath, ...process.argv.slice(1)],
  mode: 'installed public Angular; strict full AOT; production browser; real loopback HTTP; in-memory authority',
  control,
  work,
  configuration: { path: configPath, sha256: hash(configPath) },
  tools: {
    node: process.version,
    angular: require('@angular/core/package.json').version,
    typescript: require('typescript/package.json').version,
    playwright: require('playwright/package.json').version,
  },
  sources: {},
  inputs: {},
  commands: [],
  limitations: [
    'Fixed fixture credentials are not production authentication or security approval.',
    'One reviewed remote operation at a time; second native owner and independent writes do not prove simultaneous remote approvals.',
    'No database, durable receipt storage, restart recovery, actual navigation guard or runtime performance claim.',
    'Explicit disposal refuses unresolved ownership; closing a failed test page is harness teardown, not a product recovery guarantee.',
  ],
};
const save = () =>
  writeFileSync(
    join(work, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n'
  );
function run(name, command, args, cwd) {
  const startedUTC = new Date().toISOString();
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, npm_config_cache: join(work, 'cache') },
  });
  const log = join(logs, `${name}.log`);
  writeFileSync(
    log,
    (result.stdout ?? '') +
      (result.stderr ?? '') +
      (result.error ? String(result.error) : ''),
    { flag: 'wx' }
  );
  manifest.commands.push({
    name,
    command,
    args,
    cwd,
    startedUTC,
    finishedUTC: new Date().toISOString(),
    exit: result.status,
    log,
    logSha256: hash(log),
  });
  save();
  assert.equal(
    result.status,
    0,
    `${name} failed; first output preserved at ${log}`
  );
  return result;
}
function bind(path) {
  manifest.inputs[path] = hash(path);
}
let browser;
try {
  bind(configPath);
  bind(config.artifactPlan);
  assert.equal(
    hash(config.artifactPlan),
    config.artifactPlanSha256,
    'Artifact plan changed'
  );
  const plan = JSON.parse(readFileSync(config.artifactPlan));
  assert.deepEqual(Object.keys(config.artifacts).sort(), ['angular', 'kernel']);
  for (const name of ['kernel', 'angular']) {
    const artifact = config.artifacts[name];
    assert.deepEqual(
      artifact,
      plan.artifacts[`v16-${name}`],
      `Configured ${name} identity must equal the admitted plan entry`
    );
    assert.equal(
      integrity(artifact.archive),
      artifact.integrity,
      `Changed ${name} archive`
    );
    bind(artifact.archive);
    cpSync(artifact.archive, join(packs, `${name}.tgz`));
  }
  assert(
    config.artifacts.kernel.sourceCommit ||
      config.artifacts.kernel.sourceIdentity,
    'Admitted kernel must have an explicit source identity'
  );
  if (config.sourceRevision !== undefined)
    assert.equal(
      config.sourceRevision,
      config.artifacts.kernel.sourceCommit,
      'Source revision is not joined to artifact identity'
    );
  if (config.sourceIdentity !== undefined)
    assert.deepEqual(
      config.sourceIdentity,
      config.artifacts.kernel.sourceIdentity,
      'Source identity is not joined to artifact identity'
    );
  assert(
    config.sourceRevision !== undefined || config.sourceIdentity !== undefined,
    'Configuration must explicitly name the admitted source identity'
  );
  manifest.artifacts = config.artifacts;
  manifest.sourceIdentity =
    config.artifacts.kernel.sourceIdentity ??
    config.artifacts.kernel.sourceCommit;
  const referencePaths = [
    ...files(here),
    join(experiment, 'coordinator.mjs'),
    join(experiment, 'dispatch-fixture.mjs'),
    join(experiment, 'authority/review-fixture.mjs'),
    join(experiment, 'protocol/ag-ui.mjs'),
    join(experiment, 'installed/coordinator.d.mts'),
    join(experiment, 'installed/browser/ag-ui.d.mts'),
  ];
  for (const path of referencePaths) {
    manifest.sources[path] = hash(path);
    bind(path);
  }
  cpSync(here, join(work, 'frozen-source'), { recursive: true });
  for (const name of [
    'tslib',
    '@angular/core',
    '@angular/compiler',
    '@angular/common',
    '@angular/platform-browser',
    'rxjs',
  ]) {
    run(
      'pack-' + name.replaceAll('/', '-'),
      'npm',
      [
        'pack',
        '--offline',
        '--ignore-scripts',
        '--json',
        '--pack-destination',
        packs,
      ],
      dirname(require.resolve(`${name}/package.json`))
    );
  }
  for (const path of files(packs)) bind(path);
  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify({
      name: 'st-http-browser-reference',
      version: '0.0.0',
      private: true,
      type: 'module',
    }) + '\n'
  );
  run(
    'install',
    'npm',
    [
      'install',
      '--offline',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      ...files(packs).filter((path) => path.endsWith('.tgz')),
    ],
    consumer
  );
  manifest.installed = {};
  for (const name of ['kernel', 'angular']) {
    const expected = join(work, 'unpacked', name);
    mkdirSync(expected, { recursive: true });
    run(
      'extract-' + name,
      'tar',
      ['-xzf', join(packs, name + '.tgz'), '-C', expected],
      work
    );
    const installed = join(consumer, 'node_modules/@signal-tree', name);
    assert.deepEqual(
      inventory(installed),
      inventory(join(expected, 'package')),
      `Installed ${name} differs from admitted archive`
    );
    manifest.installed[name] = { root: installed, files: inventory(installed) };
  }
  const installedKernel = JSON.parse(
    readFileSync(
      join(consumer, 'node_modules/@signal-tree/kernel/package.json')
    )
  );
  const installedAngular = JSON.parse(
    readFileSync(
      join(consumer, 'node_modules/@signal-tree/angular/package.json')
    )
  );
  assert.equal(
    installedAngular.dependencies['@signal-tree/kernel'],
    installedKernel.version,
    'Facade dependency does not name this kernel version'
  );
  for (const name of ['coordinator.mjs'])
    cpSync(join(experiment, name), join(consumer, name));
  cpSync(
    join(experiment, 'installed/coordinator.d.mts'),
    join(consumer, 'coordinator.d.mts')
  );
  cpSync(
    join(experiment, 'protocol/ag-ui.mjs'),
    join(consumer, 'browser/ag-ui.mjs')
  );
  cpSync(
    join(experiment, 'installed/browser/ag-ui.d.mts'),
    join(consumer, 'browser/ag-ui.d.mts')
  );
  for (const name of ['app.ts', 'main.ts', 'model.ts'])
    cpSync(join(here, name), join(consumer, 'browser', name));
  writeFileSync(
    join(consumer, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'bundler',
          strict: true,
          skipLibCheck: false,
          experimentalDecorators: true,
          useDefineForClassFields: false,
          outDir: 'out',
          rootDir: '.',
          types: [],
          lib: ['ES2022', 'DOM'],
        },
        angularCompilerOptions: {
          strictTemplates: true,
          strictInjectionParameters: true,
          compilationMode: 'full',
        },
        files: ['browser/app.ts', 'browser/main.ts'],
      },
      null,
      2
    ) + '\n'
  );
  for (const path of files(consumer).filter(
    (path) => !path.includes('/node_modules/')
  ))
    bind(path);
  run(
    'strict-aot',
    process.execPath,
    [
      join(dirname(compilerPackage), 'bundles/src/bin/ngc.js'),
      '-p',
      'tsconfig.json',
    ],
    consumer
  );
  cpSync(
    join(consumer, 'coordinator.mjs'),
    join(consumer, 'out/coordinator.mjs')
  );
  cpSync(
    join(consumer, 'browser/ag-ui.mjs'),
    join(consumer, 'out/browser/ag-ui.mjs')
  );
  const site = join(work, 'site');
  mkdirSync(site);
  const bundled = await build({
    absWorkingDir: consumer,
    entryPoints: [join(consumer, 'out/browser/main.js')],
    outfile: join(site, 'app.js'),
    bundle: true,
    minify: true,
    treeShaking: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    metafile: true,
    define: {
      ngDevMode: 'false',
      __DEV__: 'false',
      'process.env.NODE_ENV': '"production"',
    },
    plugins: [
      {
        name: 'production-angular-linker',
        setup(builder) {
          builder.onLoad(
            { filter: /node_modules\/.*\.m?js$/ },
            async (args) => {
              const code = readFileSync(args.path, 'utf8');
              if (!code.includes('ɵɵngDeclare')) return;
              const output = await babel.transformAsync(code, {
                filename: args.path,
                configFile: false,
                babelrc: false,
                plugins: [[linker, { linkerJitMode: false }]],
              });
              return { contents: output.code, loader: 'js' };
            }
          );
        },
      },
    ],
  });
  const included = Object.keys(bundled.metafile.inputs).map((path) =>
    realpathSync(resolve(consumer, path))
  );
  for (const path of included) {
    assert(
      !path.includes('/worktrees/') &&
        !path.includes('/packages/kernel/src') &&
        !path.includes('/packages/angular/src'),
      'Source alias in consumer bundle'
    );
    assert(
      !path.includes('node_modules/@angular/compiler/'),
      'Runtime compiler in production bundle'
    );
    assert(
      !/dispatch-fixture|review-fixture|http-browser\/server/.test(path),
      'Server authority leaked into browser'
    );
    if (path.includes('/node_modules/@signal-tree/'))
      assert(
        path.startsWith(join(consumer, 'node_modules/@signal-tree') + sep),
        'Mixed installed kernel/facade roots'
      );
  }
  manifest.browserInputs = included;
  writeFileSync(
    join(work, 'bundle-metafile.json'),
    JSON.stringify(bundled.metafile, null, 2) + '\n'
  );
  writeFileSync(
    join(site, 'index.html'),
    '<!doctype html><html><head><meta charset="utf-8"><title>HTTP dispatch reference</title><style>body{font:16px system-ui;max-width:1000px;margin:24px auto}button,input{font:inherit;padding:8px;margin:4px}p{overflow-wrap:anywhere}</style></head><body><http-reference></http-reference><script type="module" src="/app.js"></script></body></html>'
  );
  manifest.emitted = inventory(site);
  save();
  browser = await chromium.launch({ headless: true });
  manifest.chromium = await browser.version();
  const report = await runBrowserChecks(
    browser,
    (fault) => startReferenceServer(site, { fault }),
    work,
    control
  );
  writeFileSync(
    join(work, 'browser-results.json'),
    JSON.stringify(report, null, 2) + '\n'
  );
  manifest.report = report;
  for (const [path, expected] of Object.entries(manifest.inputs))
    assert.equal(
      hash(path),
      expected,
      `Bound input changed during execution: ${path}`
    );
  for (const [name, pkg] of Object.entries(manifest.installed))
    assert.deepEqual(
      inventory(pkg.root),
      pkg.files,
      `Installed ${name} changed during execution`
    );
  assert.equal(
    report.passed,
    true,
    'HTTP-browser conformance/control did not meet its registered oracle'
  );
  manifest.complete = true;
  save();
  console.log(
    JSON.stringify(
      {
        work,
        control,
        cases: report.results.map(({ id, outcome }) => ({ id, outcome })),
        controlDetected: report.controlDetected,
      },
      null,
      2
    )
  );
} catch (error) {
  manifest.error = String(error);
  manifest.complete = false;
  save();
  console.error(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
