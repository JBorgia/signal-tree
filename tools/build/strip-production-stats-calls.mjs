import path from 'node:path';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';

const traverse = traverseModule.default ?? traverseModule;

/** Strip only statement calls bound to the kernel's instrumentation import. */
export function createStripProductionStatsCallsPlugin({ packageRoot }) {
  const sourceRoot = path.join(packageRoot, 'src') + path.sep;
  const statsModule = path.join(
    packageRoot,
    'src/lib/internals/production-substrate-stats'
  );

  return {
    name: 'signaltree-strip-production-stats-calls',
    transform(code, id) {
      if (!id.startsWith(sourceRoot) || !id.endsWith('.ts')) return null;

      // This hook runs after TypeScript. Babel's existing scope analysis handles
      // aliases, hoisting and lexical shadows; spelling alone is not identity.
      const source = parse(code, { sourceType: 'module' });
      const removals = [];
      traverse(source, {
        ExpressionStatement(statement) {
          const call = statement.node.expression;
          if (
            call.type !== 'CallExpression' ||
            call.callee.type !== 'Identifier'
          ) {
            return;
          }
          const binding = statement.scope.getBinding(call.callee.name);
          if (!binding?.path.isImportSpecifier()) return;
          const specifier = binding.path.node;
          if (
            (specifier.imported.name ?? specifier.imported.value) !==
            'recordProductionSubstrateStat'
          ) {
            return;
          }
          const importedFrom = binding.path.parent.source.value;
          if (
            !importedFrom.startsWith('.') ||
            path.resolve(
              path.dirname(id),
              importedFrom.replace(/\.js$/, '')
            ) !== statsModule
          ) {
            return;
          }
          removals.push([statement.node.start, statement.node.end]);
          statement.skip();
        },
      });

      if (removals.length === 0) return null;
      let transformed = code;
      for (const [start, end] of removals.sort((a, b) => b[0] - a[0])) {
        // Keep a statement in every grammar position. Deleting an unbraced
        // control body captures the next statement (or leaves an invalid else).
        transformed =
          transformed.slice(0, start) + ';' + transformed.slice(end);
      }
      return { code: transformed, map: null };
    },
  };
}
