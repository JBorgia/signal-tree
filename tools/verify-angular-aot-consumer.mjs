#!/usr/bin/env node
/**
 * Real production AOT consumer of installed tarballs, with no compiler in the
 * browser. Run after build:all. Optional --kernel-tarball=... and
 * --angular-tarball=... verify downloaded registry/candidate artifacts verbatim.
 * --self-test also restores the original runtime decorator in the throwaway
 * installed package and requires the browser's missing-JIT error.
 * Requires Playwright Chromium: pnpm exec playwright install chromium.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import semver from 'semver';
import { resolveWorkspaceSpecs } from './build/workspace-specs.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const work = mkdtempSync(join(tmpdir(), 'signaltree-aot-'));
const negativeControl = process.argv.includes('--negative-control');
const arg = (name) =>
  process.argv
    .find((value) => value.startsWith(`--${name}=`))
    ?.split('=')
    .slice(1)
    .join('=');
const json = (path, value) =>
  writeFileSync(path, JSON.stringify(value, null, 2));
function run(command, args, cwd = work) {
  try {
    return execFileSync(command, args, {
      cwd,
      encoding: 'utf8',
      stdio: 'pipe',
      maxBuffer: 16 * 1024 * 1024,
      timeout: 300000,
    });
  } catch (error) {
    throw new Error(
      `${command} ${args.join(' ')} failed:\n${error.stdout ?? ''}${
        error.stderr ?? error.message
      }`
    );
  }
}

async function verifyBrowser(output) {
  const server = createServer((req, res) => {
    const path = req.url === '/' ? '/index.html' : req.url;
    if (!/^\/[\w.-]+$/.test(path ?? '')) {
      res.writeHead(404).end();
      return;
    }
    try {
      res.setHeader(
        'Content-Type',
        path.endsWith('.js') ? 'text/javascript' : 'text/html'
      );
      res.end(readFileSync(join(output, path)));
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((accept) => server.listen(0, '127.0.0.1', accept));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page
      .waitForFunction(() => window.aotConsumer, undefined, { timeout: 15000 })
      .catch((error) => {
        throw new Error(
          `AOT bootstrap failed: ${errors.join('\n') || error.message}`
        );
      });
    assert.equal(
      await page.evaluate(() => window.aotConsumer.production),
      true
    );
    const rendered = async (local, rootValue) => {
      await page.waitForFunction(
        ([localValue, rootValue]) =>
          document.querySelector('#local')?.textContent ===
            String(localValue) &&
          document.querySelector('#root')?.textContent === String(rootValue),
        [local, rootValue]
      );
    };
    await rendered(0, 0);
    for (const value of [1, 2, 7, 3, 19]) {
      await page.evaluate((next) => window.aotConsumer.write(next), value);
      await rendered(value * 2, value * 2);
    }
    await page.evaluate(() => window.aotConsumer.hide());
    await page.waitForFunction(() => !document.querySelector('#local'));
    assert.deepEqual(await page.evaluate(() => window.aotConsumer.snapshot()), {
      localDestroyed: [true],
      rootDestroyed: false,
    });
    await page.evaluate(() => window.aotConsumer.show());
    await rendered(0, 38);
    assert.deepEqual(await page.evaluate(() => window.aotConsumer.snapshot()), {
      localDestroyed: [true, false],
      rootDestroyed: false,
    });
    await page.evaluate(() => window.aotConsumer.write(23));
    await rendered(46, 46);
    await page.evaluate(() => window.aotConsumer.destroy());
    assert.deepEqual(await page.evaluate(() => window.aotConsumer.snapshot()), {
      localDestroyed: [true, true],
      rootDestroyed: true,
    });
    assert.deepEqual(
      errors,
      [],
      'browser must have zero uncaught/console errors'
    );
  } finally {
    try {
      await browser?.close();
    } finally {
      await new Promise((accept) => server.close(accept));
    }
  }
}

async function buildAndRun(broken) {
  const storePath = join(
    work,
    'node_modules/@signal-tree/angular/dist/lib/define-store.js'
  );
  const original = readFileSync(storePath, 'utf8');
  if (broken) {
    // Reproduce the pre-fix runtime decorator in this isolated installation only.
    writeFileSync(
      storePath,
      `import { Injectable } from '@angular/core';\nexport function defineStore(factory, config = {}) {\n class SignalTreeStore { constructor() { return factory(); } }\n Injectable({ providedIn: config.providedIn ?? null })(SignalTreeStore);\n return SignalTreeStore;\n}\n`
    );
  }
  try {
    run('node', [
      'node_modules/@angular/cli/bin/ng.js',
      'build',
      '--configuration=production',
      '--stats-json',
    ]);
    const stats = JSON.parse(
      readFileSync(join(work, 'dist/consumer/stats.json'), 'utf8')
    );
    assert.ok(
      Object.keys(stats.inputs).some((path) =>
        path.includes('@signal-tree/angular')
      ),
      'build must consume installed Angular facade'
    );
    const kernelInputs = Object.keys(stats.inputs).filter((path) =>
      path.includes('@signal-tree/kernel/')
    );
    assert.ok(
      kernelInputs.length > 0,
      'build must consume the supplied kernel'
    );
    const installedKernel = realpathSync(
      join(work, 'node_modules/@signal-tree/kernel')
    );
    for (const path of kernelInputs) {
      assert.ok(
        realpathSync(resolve(work, path)).startsWith(installedKernel + sep),
        `bundle used an unexpected kernel copy: ${path}`
      );
    }
    assert.ok(
      !Object.keys(stats.inputs).some((path) =>
        /@angular\/compiler\//.test(path)
      ),
      'browser bundle must not include Angular compiler'
    );
    await verifyBrowser(join(work, 'dist/consumer/browser'));
  } finally {
    writeFileSync(storePath, original);
  }
}

try {
  console.log(
    'Packing and installing isolated production Angular AOT consumer...'
  );
  mkdirSync(join(work, 'src'));
  const tarballs = [];
  for (const name of ['kernel', 'angular']) {
    const supplied = arg(`${name}-tarball`);
    if (supplied) {
      tarballs.push(resolve(supplied));
      continue;
    }
    const stage = join(work, 'stage', name);
    cpSync(join(root, 'dist/packages', name), stage, { recursive: true });
    const path = join(stage, 'package.json');
    const staged = JSON.parse(readFileSync(path, 'utf8'));
    resolveWorkspaceSpecs(staged, manifest.version);
    json(path, staged);
    const packed = JSON.parse(
      run('npm', ['pack', '--pack-destination', work, '--json'], stage)
    );
    assert.ok(packed[0]?.filename, `missing ${name} tarball`);
    tarballs.push(join(work, packed[0].filename));
  }
  const expected = tarballs.map((tarball, index) => {
    const name = `@signal-tree/${['kernel', 'angular'][index]}`;
    const metadata = JSON.parse(
      run('tar', ['-xOf', tarball, 'package/package.json'])
    );
    assert.equal(metadata.name, name, `unexpected package in ${tarball}`);
    assert.ok(semver.valid(metadata.version), `invalid ${name} version`);
    return {
      name,
      metadata,
      integrity:
        'sha512-' +
        createHash('sha512').update(readFileSync(tarball)).digest('base64'),
    };
  });
  const kernelRange =
    expected[1].metadata.dependencies?.['@signal-tree/kernel'];
  assert.ok(
    typeof kernelRange === 'string' &&
      semver.validRange(kernelRange) &&
      semver.satisfies(expected[0].metadata.version, kernelRange),
    `supplied kernel ${expected[0].metadata.version} does not satisfy Angular dependency ${kernelRange}`
  );
  json(join(work, 'package.json'), {
    name: 'signaltree-aot-consumer',
    version: '0.0.0',
    private: true,
    type: 'module',
  });
  const angular = manifest.dependencies['@angular/core'];
  run('npm', [
    'install',
    '--no-audit',
    '--no-fund',
    ...tarballs,
    ...[
      'core',
      'common',
      'compiler',
      'compiler-cli',
      'platform-browser',
      'cli',
      'build',
    ].map((name) => `@angular/${name}@${angular}`),
    `typescript@${manifest.devDependencies.typescript}`,
    'rxjs@^7.8.0',
    'tslib@^2.8.0',
  ]);
  const lock = JSON.parse(
    readFileSync(join(work, 'package-lock.json'), 'utf8')
  );
  for (const { name, metadata, integrity } of expected) {
    const installed = JSON.parse(
      readFileSync(join(work, 'node_modules', name, 'package.json'), 'utf8')
    );
    assert.equal(installed.name, name);
    assert.equal(
      installed.version,
      metadata.version,
      `${name} version was replaced`
    );
    assert.equal(
      lock.packages[`node_modules/${name}`]?.integrity,
      integrity,
      `${name} installation did not use the supplied tarball`
    );
  }
  const fromAngular = createRequire(
    join(work, 'node_modules/@signal-tree/angular/package.json')
  );
  assert.equal(
    realpathSync(fromAngular.resolve('@signal-tree/kernel/package.json')),
    realpathSync(join(work, 'node_modules/@signal-tree/kernel/package.json')),
    'Angular resolved a nested/replacement kernel instead of the supplied root kernel'
  );
  cpSync(
    join(root, 'tools/fixtures/angular-aot/main.ts'),
    join(work, 'src/main.ts')
  );
  writeFileSync(
    join(work, 'src/index.html'),
    '<!doctype html><html><head><meta charset="utf-8"><title>AOT consumer</title><link rel="icon" href="data:,"></head><body><aot-consumer></aot-consumer></body></html>'
  );
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
    angularCompilerOptions: { strictTemplates: true, compilationMode: 'full' },
    files: ['src/main.ts'],
  });
  json(join(work, 'angular.json'), {
    version: 1,
    projects: {
      consumer: {
        projectType: 'application',
        root: '',
        sourceRoot: 'src',
        architect: {
          build: {
            builder: '@angular/build:application',
            options: {
              browser: 'src/main.ts',
              index: 'src/index.html',
              tsConfig: 'tsconfig.json',
              outputPath: 'dist/consumer',
              aot: true,
              polyfills: [],
            },
            configurations: {
              production: {
                optimization: true,
                sourceMap: false,
                outputHashing: 'all',
              },
            },
            defaultConfiguration: 'production',
          },
        },
      },
    },
  });
  await buildAndRun(negativeControl);
  console.log(
    'PASS: packed production AOT bootstrap, repeated native rendering, component recreation and component/root injector teardown; no runtime compiler.'
  );
  if (process.argv.includes('--self-test')) {
    await assert.rejects(
      buildAndRun(true),
      /AOT bootstrap failed:.*JIT compilation failed|AOT bootstrap failed:.*JIT compiler|AOT bootstrap failed:.*compiler is not available/s
    );
    console.log(
      'PASS: original runtime Injectable decorator fails specifically during compiler-free browser bootstrap.'
    );
  }
} catch (error) {
  console.error(error.stack ?? error);
  process.exitCode = 1;
} finally {
  rmSync(work, { recursive: true, force: true });
}
