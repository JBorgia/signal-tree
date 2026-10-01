#!/usr/bin/env node
// Usage: node tools/probe-restoration-child-capture.cjs [source.ts] [report.json]
// Execute the exact local function extracted from each supplied source copy.
// Only its entry and recursive argument construction sites are instrumented.
// Counters describe executed source constructions, NOT heap/GC measurements.
const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const path = require('node:path');
const ts = require('typescript');
const sourcePath = path.resolve(
  process.argv[2] ??
    path.join(
      __dirname,
      '../packages/kernel/src/enhancers/restoration/restoration.ts'
    )
);
const outputPath = process.argv[3];
const source = fs.readFileSync(sourcePath, 'utf8');
const ast = ts.createSourceFile(
  sourcePath,
  source,
  ts.ScriptTarget.Latest,
  true
);
const declarations = new Map();
function find(node) {
  if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    ['enqueueScalarDiff', 'isPlainRecord'].includes(node.name.text)
  ) {
    assert(!declarations.has(node.name.text), 'unique source anchor');
    declarations.set(node.name.text, node);
  }
  ts.forEachChild(node, find);
}
find(ast);
assert.equal(declarations.size, 2);
const exact = [...declarations.values()]
  .map((node) => `const ${node.getText(ast)};`)
  .join('\n');
let recursiveSites = 0;
const instrument = (context) => {
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      node.expression.getText() === 'enqueueScalarDiff'
    ) {
      recursiveSites++;
      assert.equal(node.arguments.length, 5);
      const args = [...node.arguments];
      for (const [index, counter] of [
        [0, 'paths'],
        [3, 'segments'],
        [4, 'presence'],
      ]) {
        args[index] = ts.factory.createCallExpression(
          ts.factory.createIdentifier('construct'),
          undefined,
          [ts.factory.createStringLiteral(counter), args[index]]
        );
      }
      return ts.factory.updateCallExpression(
        node,
        node.expression,
        node.typeArguments,
        args
      );
    }
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText() === 'enqueueScalarDiff'
    ) {
      const arrow = node.initializer;
      const body = ts.visitEachChild(arrow.body, visit, context);
      const bump = ts.factory.createExpressionStatement(
        ts.factory.createPostfixIncrement(
          ts.factory.createPropertyAccessExpression(
            ts.factory.createIdentifier('stats'),
            'calls'
          )
        )
      );
      return ts.factory.updateVariableDeclaration(
        node,
        node.name,
        node.exclamationToken,
        node.type,
        ts.factory.updateArrowFunction(
          arrow,
          arrow.modifiers,
          arrow.typeParameters,
          arrow.parameters,
          arrow.type,
          arrow.equalsGreaterThanToken,
          ts.factory.updateBlock(body, [bump, ...body.statements])
        )
      );
    }
    return ts.visitEachChild(node, visit, context);
  };
  return (file) => ts.visitNode(file, visit);
};
const js = ts.transpileModule(exact, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
  },
  transformers: { before: [instrument] },
}).outputText;
assert.equal(recursiveSites, 1);
const execute = new Function(
  'before',
  'after',
  `
  const stats = { calls: 0, paths: 0, segments: 0, presence: 0 };
  const effects = [];
  const construct = (key, value) => { stats[key]++; return value; };
  const positionIds = [1], subjectIds = [2], ownerPath = 'rows', path = 'rows.1';
  const meta = undefined, effectMap = new Map();
  const enqueueEffect = (_map, effect) => effects.push(effect);
  ${js}
  enqueueScalarDiff(path, before, after);
  return { stats, effects };
`
);
const checks = [];
function check(name, fn) {
  try {
    fn();
    checks.push({ name, passed: true });
  } catch (error) {
    checks.push({ name, passed: false, error: error.message });
  }
}
// Every fixture is constructed before execute starts its counters.
const stable = Object.fromEntries(
  Array.from({ length: 32 }, (_, i) => [`stable${i}`, i])
);
const before = { ...stable, nested: { stable: 10, changed: 0 } };
const after = { ...stable, nested: { stable: 10, changed: 1 } };
const wide = execute(before, after);
check('one nested changed effect, unchanged siblings omitted', () => {
  assert.equal(wide.effects.length, 1);
  assert.deepEqual(wide.effects[0].fieldSegments, ['nested', 'changed']);
  assert.equal(wide.effects[0].before, 0);
  assert.equal(wide.effects[0].after, 1);
});
check('bounded recursive construction work', () => {
  assert.deepEqual(wide.stats, {
    calls: 3,
    paths: 2,
    segments: 2,
    presence: 2,
  });
});
for (const present of [false, true]) {
  check(`undefined own presence survives, initially present=${present}`, () => {
    const absent = { nested: { stable: 1 } };
    const owned = { nested: { stable: 1, optional: undefined } };
    const result = execute(present ? owned : absent, present ? absent : owned);
    assert.equal(result.effects.length, 1);
    assert.deepEqual(result.effects[0].fieldPresence, {
      before: present,
      after: !present,
    });
  });
}
check('strict equality keeps NaN different and signed zero equal', () => {
  const result = execute({ nan: NaN, zero: 0 }, { nan: NaN, zero: -0 });
  assert.deepEqual(
    result.effects.map((effect) => effect.fieldSegments),
    [['nan']]
  );
});
const getterTraces = [];
for (const changed of [false, true]) {
  check(`getter order/once and own presence order, changed=${changed}`, () => {
    const trace = [];
    function observed(label, value) {
      return new Proxy(
        {
          get field() {
            trace.push(`${label}:get`);
            return value;
          },
        },
        {
          getOwnPropertyDescriptor(target, key) {
            if (key === 'field') trace.push(`${label}:own`);
            return Reflect.getOwnPropertyDescriptor(target, key);
          },
        }
      );
    }
    const left = observed('before', 1),
      right = observed('after', changed ? 2 : 1);
    const result = execute(left, right);
    assert.deepEqual(trace, [
      'before:own',
      'after:own',
      'before:get',
      'after:get',
      'before:own',
      'after:own',
    ]);
    assert.equal(result.effects.length, changed ? 1 : 0);
    getterTraces.push({ changed, trace });
  });
}
check(
  'getter reentry sees the later value and preserves post-read presence',
  () => {
    const right = { field: 1 };
    let reads = 0;
    const left = {
      get field() {
        reads++;
        right.field = 2;
        return 1;
      },
    };
    const result = execute(left, right);
    assert.equal(reads, 1);
    assert.equal(result.effects[0].before, 1);
    assert.equal(result.effects[0].after, 2);
  }
);
const report = {
  sourcePath,
  sha256: crypto.createHash('sha256').update(source).digest('hex'),
  scope:
    'Exact extracted enqueueScalarDiff and isPlainRecord; effect sink collected directly. Source construction counts, not measured heap allocations or full runtime performance.',
  wide,
  getterTraces,
  checks,
};
if (outputPath)
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
process.exitCode = checks.every((check) => check.passed) ? 0 : 1;
