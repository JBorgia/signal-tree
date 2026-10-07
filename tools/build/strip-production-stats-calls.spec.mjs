import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { rollup } from 'rollup';
import { parseAst } from 'rollup/parseAst';
import configureKernel from '../../packages/kernel/rollup.custom.mjs';

const packageRoot = fileURLToPath(
  new URL('../../packages/kernel', import.meta.url)
);
const id = path.join(packageRoot, 'src/lib/build-transform-fixture.ts');
const [runtime] = configureKernel({}, { outputPath: 'dist/packages/kernel' });
const plugin = runtime.plugins.find(
  ({ name }) => name === 'signaltree-strip-production-stats-calls'
);
assert.ok(
  plugin,
  'test the plugin installed in the kernel runtime configuration'
);
const statsImport =
  "import { recordProductionSubstrateStat } from './internals/production-substrate-stats';";

async function execute(code, strip = true, entry = id, dependencies = {}) {
  const bundle = await rollup({
    input: entry,
    treeshake: false,
    plugins: [
      {
        name: 'fixture-loader',
        resolveId(source) {
          return source;
        },
        load(source) {
          if (source === entry) return code;
          if (Object.hasOwn(dependencies, source)) return dependencies[source];
          return `export function recordProductionSubstrateStat() {
            ${strip ? "throw new Error('instrumentation survived');" : ''}
          }`;
        },
      },
      ...(strip ? [plugin] : []),
    ],
  });
  try {
    const { output } = await bundle.generate({ format: 'cjs' });
    const context = { exports: {} };
    vm.runInNewContext(output[0].code, context, { timeout: 1000 });
    return JSON.parse(JSON.stringify(context.exports.result));
  } finally {
    await bundle.close();
  }
}

const controls = [
  [
    'unbraced false if regression',
    "if (false) recordProductionSubstrateStat('x'); value = 7;",
    7,
    [],
  ],
  [
    'unbraced true if',
    "if (true) recordProductionSubstrateStat('x'); value = 7;",
    7,
    [],
  ],
  [
    'braced if',
    "if (true) { recordProductionSubstrateStat('x'); order.push('inside'); } value = 7;",
    7,
    ['inside'],
  ],
  [
    'unbraced if else',
    "if (false) recordProductionSubstrateStat('x'); else value = 3; order.push('after');",
    3,
    ['after'],
  ],
  [
    'unbraced else',
    "if (false) value = 3; else recordProductionSubstrateStat('x'); value = 7;",
    7,
    [],
  ],
  [
    'both branches stripped',
    "if (true) recordProductionSubstrateStat('x'); else recordProductionSubstrateStat('y'); value = 7;",
    7,
    [],
  ],
  [
    'braced if else',
    "if (false) { recordProductionSubstrateStat('x'); } else { order.push('else'); recordProductionSubstrateStat('y'); } value = 7;",
    7,
    ['else'],
  ],
  [
    'while body',
    "while (value++ < 2) recordProductionSubstrateStat('x'); order.push(value);",
    3,
    [3],
  ],
  [
    'zero iteration while',
    "while (false) recordProductionSubstrateStat('x'); value = 7;",
    7,
    [],
  ],
  [
    'for body',
    "for (; value < 3; value++) recordProductionSubstrateStat('x'); order.push(value);",
    3,
    [3],
  ],
  [
    'for of body',
    "for (const item of [1, 2]) recordProductionSubstrateStat('x'); order.push('after');",
    0,
    ['after'],
  ],
  [
    'for in body',
    "for (const key in { a: 1, b: 2 }) recordProductionSubstrateStat('x'); order.push('after');",
    0,
    ['after'],
  ],
  [
    'do while body',
    "do recordProductionSubstrateStat('x'); while (++value < 2); order.push(value);",
    2,
    [2],
  ],
  [
    'nested dangling else',
    "if (true) if (false) recordProductionSubstrateStat('x'); else value = 4; order.push('after');",
    4,
    ['after'],
  ],
  [
    'nested loop if',
    "for (; value < 2; value++) if (false) recordProductionSubstrateStat('x'); else order.push(value); order.push('after');",
    2,
    [0, 1, 'after'],
  ],
  [
    'label body',
    "label: recordProductionSubstrateStat('x'); value = 7;",
    7,
    [],
  ],
  [
    'ordinary statements',
    "order.push('before'); recordProductionSubstrateStat('x'); value = 7; order.push('after');",
    7,
    ['before', 'after'],
  ],
  [
    'multiline call',
    "if (false)\n recordProductionSubstrateStat(\n 'x'\n );\nvalue = 7;",
    7,
    [],
  ],
  [
    'automatic semicolon insertion',
    "if (false) recordProductionSubstrateStat('x')\nvalue = 7;",
    7,
    [],
  ],
  ['standalone call', "recordProductionSubstrateStat('x');", 0, []],
  [
    'multiple removals',
    "recordProductionSubstrateStat('x'); order.push('middle'); recordProductionSubstrateStat('y'); value = 7;",
    7,
    ['middle'],
  ],
];
for (const [name, body, value, order] of controls) {
  test(name, async () => {
    const code = `${statsImport}\nlet value = 0; const order = []; ${body}\nexport const result = { value, order };`;
    const expected = { value, order };
    assert.deepEqual(
      await execute(code, false),
      expected,
      'fixture with no-op instrumentation'
    );
    assert.deepEqual(
      await execute(code),
      expected,
      'actual transformed emitted JavaScript'
    );
  });
}

test('strips aliased imports from the instrumentation module', async () => {
  assert.deepEqual(
    await execute(`
    import { recordProductionSubstrateStat as stat } from './internals/production-substrate-stats.js';
    stat('x'); export const result = 7;
  `),
    7
  );
});

const preserved = [
  [
    'local same-name function',
    `function recordProductionSubstrateStat(x) { order.push(x); } recordProductionSubstrateStat('local');`,
  ],
  [
    'parameter shadow',
    `${statsImport} function run(recordProductionSubstrateStat) { recordProductionSubstrateStat('parameter'); } run(x => order.push(x));`,
  ],
  [
    'block shadow',
    `${statsImport} { const recordProductionSubstrateStat = x => order.push(x); recordProductionSubstrateStat('block'); }`,
  ],
  [
    'hoisted function shadow',
    `${statsImport} function run() { recordProductionSubstrateStat('hoisted'); function recordProductionSubstrateStat(x) { order.push(x); } } run();`,
  ],
  [
    'var shadow',
    `${statsImport} function run() { var recordProductionSubstrateStat = x => order.push(x); recordProductionSubstrateStat('var'); } run();`,
  ],
  [
    'catch binding shadow',
    `${statsImport} try { throw x => order.push(x); } catch (recordProductionSubstrateStat) { recordProductionSubstrateStat('catch'); }`,
  ],
  [
    'loop binding shadow',
    `${statsImport} for (const recordProductionSubstrateStat of [x => order.push(x)]) recordProductionSubstrateStat('loop');`,
  ],
  [
    'member and other calls',
    `${statsImport} const object = { recordProductionSubstrateStat: x => order.push(x) }; object.recordProductionSubstrateStat('member'); function other(x) { order.push(x); } other('other');`,
  ],
];
for (const [name, body] of preserved) {
  test(`preserves ${name}`, async () => {
    const code = `const order = []; ${body} export const result = order;`;
    const expected = await execute(code, false);
    assert.ok(expected.length > 0, 'fixture actually invokes a preserved call');
    assert.deepEqual(await execute(code), expected);
  });
}

test('preserves same-name imports from unrelated modules', async () => {
  const code = `import { recordProductionSubstrateStat } from './other'; recordProductionSubstrateStat('x');`;
  assert.equal(plugin.transform.call({ parse: parseAst }, code, id), null);
});

test('preserves value-producing expressions and non-statement calls', () => {
  const code = `${statsImport} const value = recordProductionSubstrateStat('x'); function f() { return recordProductionSubstrateStat('y'); }`;
  assert.equal(plugin.transform.call({ parse: parseAst }, code, id), null);
});

test('ignores modules outside the kernel source directory and non-TS ids', () => {
  for (const entry of [
    path.join(packageRoot, 'src-other/test.ts'),
    path.join(packageRoot, 'other/test.ts'),
    id.replace('.ts', '.js'),
  ]) {
    assert.equal(
      plugin.transform.call(
        { parse: parseAst },
        `${statsImport} recordProductionSubstrateStat('x');`,
        entry
      ),
      null
    );
  }
});

test('strips imported calls while preserving shadowed calls in the same module', async () => {
  assert.deepEqual(
    await execute(`
    ${statsImport}
    const order = [];
    recordProductionSubstrateStat('before');
    function run({ recordProductionSubstrateStat }) {
      recordProductionSubstrateStat('shadow');
    }
    run({ recordProductionSubstrateStat: x => order.push(x) });
    recordProductionSubstrateStat('after');
    export const result = order;
  `),
    ['shadow']
  );
});

for (const source of [
  './other',
  './other/production-substrate-stats',
  'some-package/production-substrate-stats',
]) {
  test(`executes unrelated imported calls: ${source}`, async () => {
    const code = `import { recordProductionSubstrateStat, order } from '${source}';
      recordProductionSubstrateStat('retained'); export const result = order;`;
    const dependencies = {
      [source]: `export const order = [];
      export function recordProductionSubstrateStat(x) { order.push(x); }`,
    };
    assert.deepEqual(await execute(code, true, id, dependencies), ['retained']);
  });
}

const stubPlugin = runtime.plugins.find(
  ({ name }) => name === 'signaltree-core-production-stats-stub'
);
for (const source of [
  './other/production-substrate-stats',
  'some-package/production-substrate-stats',
]) {
  test(`stub resolver preserves unrelated module: ${source}`, () => {
    assert.equal(stubPlugin.resolveId(source, id), null);
  });
}
test('stub resolver replaces the exact instrumentation module', () => {
  for (const source of [
    './internals/production-substrate-stats',
    './internals/production-substrate-stats.js',
  ]) {
    assert.equal(
      stubPlugin.resolveId(source, id),
      path.join(
        packageRoot,
        'src/lib/internals/production-substrate-stats.prod.ts'
      )
    );
  }
});
