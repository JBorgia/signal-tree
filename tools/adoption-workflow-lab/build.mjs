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
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';
import linker from '@angular/compiler-cli/linker/babel';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const [configArg, outArg] = process.argv.slice(2);
assert(configArg && outArg, 'build.mjs CONFIG NEW_OUTPUT');
const configPath = realpathSync(configArg),
  out = resolve(outArg);
const config = JSON.parse(readFileSync(configPath));
const require = createRequire(join(repo, 'package.json'));
const compiler = require.resolve('@angular/compiler-cli/package.json');
const babel = createRequire(compiler)('@babel/core');
const hash = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');
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
assert.equal(process.version, 'v24.15.0');
mkdirSync(out);
mkdirSync(join(out, 'logs'));
mkdirSync(join(out, 'source'));
for (const file of files(here))
  cpSync(file, join(out, 'source', relative(here, file)));
const frozenSource = join(out, 'source');
const manifest = {
  command: process.argv,
  createdUTC: new Date().toISOString(),
  node: process.version,
  angular: require('@angular/core/package.json').version,
  typescript: require('typescript/package.json').version,
  config: { path: configPath, sha256: hash(configPath) },
  source: inventory(join(out, 'source')),
  arms: {},
  commands: [],
  complete: false,
  limits: [
    'Synthetic in-memory authority and receipt cache, not durable storage.',
    'Identified query strategies, not a universal ranking or human responsiveness metric.',
  ],
};
const save = () =>
  writeFileSync(
    join(out, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n'
  );
function run(name, command, args, cwd) {
  const start = performance.now();
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, npm_config_cache: config.npmCache, CI: 'true' },
  });
  const log = join(out, 'logs', name + '.log');
  writeFileSync(
    log,
    (result.stdout ?? '') +
      (result.stderr ?? '') +
      (result.error ? String(result.error) : '')
  );
  manifest.commands.push({
    name,
    command,
    args,
    cwd,
    exitCode: result.status,
    milliseconds: performance.now() - start,
    log,
    sha256: hash(log),
  });
  save();
  assert.equal(result.status, 0, `${name} failed: ${log}`);
}
const arms = config.arms ?? [
  { name: 'v15', read: 'signaltree', editor: 'signaltree', line: 'v15' },
  { name: 'v16', read: 'signaltree', editor: 'signaltree', line: 'v16' },
  { name: 'tanstack', read: 'tanstack', editor: 'native' },
  { name: 'tanstack-v15', read: 'tanstack', editor: 'signaltree', line: 'v15' },
  { name: 'tanstack-v16', read: 'tanstack', editor: 'signaltree', line: 'v16' },
];
try {
  for (const arm of arms) {
    const consumer = join(out, arm.name),
      source = join(consumer, 'src');
    mkdirSync(source, { recursive: true });
    for (const file of files(frozenSource).filter((path) =>
      path.endsWith('.ts')
    )) {
      let code = readFileSync(file, 'utf8');
      if (arm.line === 'v15' && file.endsWith('/editor-signaltree.ts')) {
        assert.equal(code.split('tree.transact(').length, 2);
        code = code.replace('tree.transact(', 'tree.transaction(');
      }
      writeFileSync(join(source, relative(frozenSource, file)), code);
    }
    writeFileSync(
      join(source, 'selected-read.ts'),
      `export { createReadModel } from './read-${arm.read}';\n`
    );
    writeFileSync(
      join(source, 'selected-editor.ts'),
      `export { createEditor } from './editor-${arm.editor}';\n`
    );
    writeFileSync(
      join(source, 'selected-arm.ts'),
      `export const ARM = ${JSON.stringify(arm.name)};\n`
    );
    const dependencies = {
      '@angular/core': '22.0.7',
      '@angular/common': '22.0.7',
      '@angular/compiler': '22.0.7',
      '@angular/platform-browser': '22.0.7',
      rxjs: '7.8.2',
      tslib: '2.8.1',
      typescript: '6.0.3',
    };
    if (arm.read === 'tanstack') dependencies['@tanstack/db'] = '1.0.0-rc.1.5';
    if (arm.line)
      for (const name of ['kernel', 'angular']) {
        const artifact = config.artifacts[arm.line][name];
        assert.equal(
          hash(artifact.archive),
          artifact.sha256,
          'Archive identity'
        );
        dependencies[`@signal-tree/${name}`] = `file:${artifact.archive}`;
      }
    writeFileSync(
      join(consumer, 'package.json'),
      JSON.stringify(
        {
          name: `adoption-${arm.name}`,
          private: true,
          type: 'module',
          version: '0.0.0',
          dependencies,
        },
        null,
        2
      ) + '\n'
    );
    run(
      `${arm.name}-install`,
      'npm',
      ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund'],
      consumer
    );
    const installed = {};
    if (arm.line)
      for (const name of ['kernel', 'angular']) {
        const artifact = config.artifacts[arm.line][name];
        assert.equal(hash(artifact.manifest), artifact.manifestSha256);
        const expected = JSON.parse(readFileSync(artifact.manifest));
        assert.equal(expected.head, config.sources[arm.line]);
        const packageRoot = join(consumer, 'node_modules/@signal-tree', name);
        assert.deepEqual(
          inventory(packageRoot),
          expected.files,
          'Installed archive payloads'
        );
        installed[name] = {
          root: packageRoot,
          source: expected.head,
          files: expected.files,
        };
      }
    if (arm.line) {
      const fromFacade = createRequire(
        join(installed.angular.root, 'package.json')
      );
      assert.equal(
        realpathSync(fromFacade.resolve('@signal-tree/kernel/package.json')),
        realpathSync(join(installed.kernel.root, 'package.json')),
        'One kernel authority'
      );
    }
    const tsconfig = {
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
      files: ['src/main.ts'],
    };
    writeFileSync(
      join(consumer, 'tsconfig.json'),
      JSON.stringify(tsconfig, null, 2) + '\n'
    );
    run(
      `${arm.name}-aot`,
      process.execPath,
      [
        join(dirname(compiler), 'bundles/src/bin/ngc.js'),
        '-p',
        'tsconfig.json',
      ],
      consumer
    );
    const site = join(consumer, 'site');
    mkdirSync(site);
    const result = await build({
      absWorkingDir: consumer,
      entryPoints: ['out/src/main.js'],
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
          name: 'angular-linker',
          setup(builder) {
            builder.onLoad(
              { filter: /node_modules\/.*\.m?js$/ },
              async (args) => {
                const code = readFileSync(args.path, 'utf8');
                if (!code.includes('ɵɵngDeclare')) return;
                const linked = await babel.transformAsync(code, {
                  filename: args.path,
                  configFile: false,
                  babelrc: false,
                  plugins: [[linker, { linkerJitMode: false }]],
                });
                return { contents: linked.code, loader: 'js' };
              }
            );
          },
        },
      ],
    });
    const included = Object.keys(result.metafile.inputs).map((path) =>
      realpathSync(resolve(consumer, path))
    );
    assert(
      !included.some(
        (path) =>
          path.includes('/worktrees/') || path.includes('/@angular/compiler/')
      ),
      'No source aliases or runtime compiler in production artifact'
    );
    if (!arm.line)
      assert(
        !included.some((path) => path.includes('/@signal-tree/')),
        'Native draft excludes SignalTree'
      );
    if (arm.read !== 'tanstack')
      assert(
        !included.some((path) => path.includes('/@tanstack/')),
        'Plain arm excludes TanStack'
      );
    writeFileSync(
      join(consumer, 'bundle-metafile.json'),
      JSON.stringify(result.metafile, null, 2) + '\n'
    );
    writeFileSync(
      join(site, 'index.html'),
      '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Independent dispatch editors</title><style>body{font:16px system-ui;margin:0 auto;max-width:1050px;padding:24px;color:#152a38;background:#f5f8fa}button{font:inherit;margin:6px;padding:10px;border:1px solid #4c6477;border-radius:6px;background:white}button:focus-visible{outline:3px solid #245bc2}article{padding:16px;margin:16px 0;background:white;border:1px solid #c8d4dc}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:8px;border-bottom:1px solid #c8d4dc}p{line-height:1.5}</style></head><body><adoption-workspace></adoption-workspace><script type="module" src="/app.js"></script></body></html>'
    );
    const code = readFileSync(join(site, 'app.js'));
    manifest.arms[arm.name] = {
      ...arm,
      consumer,
      site,
      installed,
      inputs: included,
      packageLockSha256: hash(join(consumer, 'package-lock.json')),
      emitted: inventory(site),
      bytes: code.length,
      gzip: gzipSync(code, { level: 9 }).length,
    };
    save();
  }
  assert.deepEqual(inventory(join(out, 'source')), manifest.source);
  manifest.complete = true;
  save();
  console.log(
    JSON.stringify({ out, arms: Object.keys(manifest.arms), complete: true })
  );
} catch (error) {
  manifest.error = String(error);
  save();
  console.error(error);
  process.exitCode = 1;
}
