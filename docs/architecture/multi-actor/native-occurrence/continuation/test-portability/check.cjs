const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('/private/tmp/st-v16-integration-candidate/node_modules/typescript');
const base = '/private/tmp/st-test-sink-cleanup';
const inventory = require(base + '/inventory-baseline.json');
const mandatory = inventory.filter(x => x.classification.startsWith('mandatory'));
const removedMessages = ['Observation output required', 'Research diagnostic requires ST_EQUAL_OWNER_TRACE', 'fresh output directory required', 'unique evidence output directory required'];
function parse(file) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  assert.equal(source.parseDiagnostics.length, 0, file + ': syntax diagnostics');
  return source;
}
function normalize(source, file) {
  const result = ts.transform(source, [context => {
    const visit = node => {
      if (ts.isImportDeclaration(node) && (/optional-diagnostic$/.test(node.moduleSpecifier.text) || node.moduleSpecifier.text === 'node:fs')) return undefined;
      if (ts.isVariableStatement(node) && node.declarationList.declarations.some(d => d.name.getText(source) === 'diagnosticDirectory')) return undefined;
      if (ts.isIfStatement(node) && removedMessages.some(m => node.getText(source).includes(m))) return undefined;
      if (ts.isVariableDeclaration(node) && file.endsWith('/recipient-window-review.spec.ts') && node.name.getText(source) === 'output') return ts.factory.updateVariableDeclaration(node, node.name, node.exclamationToken, node.type, ts.factory.createStringLiteral('normalized-sink'));
      if (ts.isCallExpression(node) && ['writeDiagnostic', 'appendFileSync', 'writeFileSync'].includes(node.expression.getText(source))) {
        const append = node.expression.getText(source) === 'appendFileSync' || node.arguments[2]?.kind === ts.SyntaxKind.TrueKeyword;
        return ts.factory.createCallExpression(ts.factory.createIdentifier('__persist'), undefined, [ts.visitNode(node.arguments[1], visit), append ? ts.factory.createTrue() : ts.factory.createFalse()]);
      }
      return ts.visitEachChild(node, visit, context);
    };
    return root => ts.visitNode(root, visit);
  }]);
  const text = ts.createPrinter({removeComments: false}).printFile(result.transformed[0]);
  result.dispose();
  return text;
}
for (const {file} of mandatory) {
  const before = parse(base + '/before/' + file);
  const after = parse(base + '/overlay/' + file);
  assert.equal(normalize(after, file), normalize(before, file), file + ': non-persistence change');
  const imports = after.statements.filter(ts.isImportDeclaration).filter(n => n.moduleSpecifier.text.endsWith('optional-diagnostic'));
  assert.equal(imports.length, 1);
  assert.equal(path.resolve(path.dirname(base + '/overlay/' + file), imports[0].moduleSpecifier.text) + '.ts', base + '/overlay/tools/testing/optional-diagnostic.ts');
}
parse(base + '/overlay/tools/testing/optional-diagnostic.ts');
parse(base + '/overlay/packages/kernel/src/lib/optional-diagnostic.spec.ts');
console.log('PASS: 15 TypeScript files parse; all 13 normalized ASTs match originals (payloads, serialization, assertions, cases, controls, comments, sequencing); helper imports resolve. No test/type/build execution.');
