/** Consumer guard checks; source mode is interim evidence, never dist qualification. */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const packages = ['kernel', 'angular', 'react', 'vue', 'solid'];
const advisoryCodes = [
  'ST2001',
  'ST2002',
  'ST2003',
  'ST2007',
  'ST2016',
  'ST2021',
];
const requiredError = 'null/undefined [ST1001]';
const peers = [
  '@angular/*',
  'rxjs',
  'rxjs/*',
  'react',
  'react/*',
  'vue',
  'solid-js',
  'solid-js/*',
  'tslib',
];

function inspectPair(dev, prod) {
  assert.ok(
    dev.includes('[ST2021]'),
    'development control lost its exercised advisory'
  );
  for (const code of advisoryCodes) {
    assert.ok(
      !prod.includes(`[${code}]`),
      `production retained advisory ${code}`
    );
  }
  assert.ok(
    prod.includes(requiredError),
    'production lost a required readable error'
  );
}

function execute(text, development) {
  const diagnostics = [];
  const context = {
    console: {
      warn: (...args) => diagnostics.push(args.join(' ')),
      error: (...args) => diagnostics.push(args.join(' ')),
      log: () => undefined,
    },
    queueMicrotask,
  };
  // Intentionally no process, require, window, or ngDevMode shim.
  runInNewContext(text, context, { timeout: 5000 });
  assert.equal(
    context.__guardError,
    requiredError,
    'required error changed at runtime'
  );
  assert.equal(
    diagnostics.some((message) => message.includes('[ST2021]')),
    development,
    'raw-browser advisory behavior changed'
  );
  if (!development)
    assert.deepEqual(diagnostics, [], 'production emitted diagnostics');
}

const entry = (name) => `
  import { signalTree, entityMap } from '@signal-tree/${name}';
  const tree = signalTree({ count: 0, users: entityMap(), invalid: [entityMap()] });
  globalThis.__guardTree = tree;
  try { signalTree(null); }
  catch (error) { globalThis.__guardError = error.message; }
  tree.destroy();
`;

async function bundle(code, { source, production, runtime = false }) {
  const artifact = (name, subpath = 'index') =>
    join(
      root,
      source
        ? `packages/${name}/src/${subpath}.ts`
        : `dist/packages/${name}/dist/${subpath}.js`
    );
  const result = await build({
    stdin: {
      contents: code,
      resolveDir: root,
      sourcefile: 'guard-consumer.js',
    },
    bundle: true,
    write: false,
    minify: true,
    format: runtime ? 'iife' : 'esm',
    platform: 'browser',
    // Keep the raw-browser control raw: no automatic NODE_ENV replacement.
    define: production
      ? { ngDevMode: 'false', 'process.env.NODE_ENV': 'process.env.NODE_ENV' }
      : { 'process.env.NODE_ENV': 'process.env.NODE_ENV' },
    external: runtime ? [] : peers,
    nodePaths: [join(root, 'node_modules')],
    tsconfigRaw: {},
    legalComments: 'none',
    logLevel: 'silent',
    plugins: [
      {
        name: 'guard-probe-package-boundary',
        setup(build) {
          build.onResolve(
            {
              filter:
                /^@signal-tree\/(kernel|angular|react|vue|solid)(\/[^/]+)?$/,
            },
            ({ path }) => {
              const [, name, subpath] =
                /^@signal-tree\/([^/]+)(?:\/(.+))?$/.exec(path);
              return { path: artifact(name, subpath) };
            }
          );
        },
      },
    ],
  });
  return result.outputFiles[0].text;
}

export async function checkConsumerGuards({ source = false } = {}) {
  if (!source) {
    for (const name of packages) {
      assert.ok(
        existsSync(join(root, `dist/packages/${name}/dist/index.js`)),
        `Missing ${name} dist: wait for the coordinated build, or use --source-probes for labelled interim evidence.`
      );
    }
  }
  console.log(
    source
      ? 'SOURCE PROBES ONLY — not built-package or release qualification.'
      : 'Built-dist consumer guard probes (read-only; artifacts are not rebuilt).'
  );
  for (const name of packages) {
    const dev = await bundle(entry(name), { source, production: false });
    const prod = await bundle(entry(name), { source, production: true });
    inspectPair(dev, prod);
    console.log(
      `✓ ${name}: explicit ngDevMode=false removes advisories; readable error retained`
    );
  }
  for (const production of [false, true]) {
    const text = await bundle(entry('kernel'), {
      source,
      production,
      runtime: true,
    });
    execute(text, !production);
  }
  console.log(
    '✓ neutral no-process runtime: dev advisory fires; production is quiet; both throw readable errors'
  );
  console.log(
    'NODE_ENV-only automatic removal is not qualified by these explicit-define checks.'
  );
}

export async function checkConsumerGuardSelfTest() {
  const dev = `console.warn('[ST2021]');`;
  const good = `throw Error('${requiredError}');`;
  assert.doesNotThrow(() => inspectPair(dev, good));
  assert.throws(
    () => inspectPair(dev, `${good} console.warn('[ST2021]');`),
    /retained advisory/
  );
  assert.throws(
    () => inspectPair(dev, 'throw Error("ST1001");'),
    /required readable error/
  );
  assert.throws(() => inspectPair('', good), /development control/);
  assert.throws(
    () => execute('process.env.NODE_ENV;', true),
    /process is not defined/
  );
  assert.throws(
    () =>
      execute(
        `globalThis.__guardError=${JSON.stringify(requiredError)};`,
        true
      ),
    /advisory behavior/
  );
  // Exercise the bundler as well as the validator: this advisory cannot fold.
  const bad = await bundle(
    `console.warn('[ST2021]'); globalThis.error=${JSON.stringify(
      requiredError
    )};`,
    { source: true, production: true }
  );
  assert.throws(() => inspectPair(dev, bad), /retained advisory/);
  console.log(
    '✓ consumer gate self-test rejects warning retention, missing dev/error controls, and process dependence'
  );
}
