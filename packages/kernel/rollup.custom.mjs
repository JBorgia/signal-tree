import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { createLibraryRollupConfig } from '../../tools/build/create-rollup-config.mjs';

const packageRoot = path.dirname(fileURLToPath(import.meta.url));

const baseConfigFactory = createLibraryRollupConfig({ packageRoot });

export default (config, options) => {
  const baseConfig = baseConfigFactory(config, options);
  const statsStubPath = path.join(
    packageRoot,
    'src',
    'lib',
    'internals',
    'production-substrate-stats.prod.ts'
  );

  const productionStatsStubPlugin = {
    name: 'signaltree-core-production-stats-stub',
    resolveId(source, importer) {
      if (!importer) {
        return null;
      }

      const normalizedSource = source.endsWith('.js')
        ? source.slice(0, -3)
        : source;

      if (!normalizedSource.endsWith('/production-substrate-stats')) {
        return null;
      }

      return statsStubPath;
    },
  };

  const stripProductionStatsCallsPlugin = {
    name: 'signaltree-strip-production-stats-calls',
    transform(code, id) {
      if (
        !id.startsWith(path.join(packageRoot, 'src')) ||
        !id.endsWith('.ts')
      ) {
        return null;
      }

      const source = ts.createSourceFile(
        id,
        code,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS
      );
      const removals = [];

      const visit = (node) => {
        if (
          ts.isExpressionStatement(node) &&
          ts.isCallExpression(node.expression) &&
          ts.isIdentifier(node.expression.expression) &&
          node.expression.expression.text === 'recordProductionSubstrateStat'
        ) {
          removals.push([node.getFullStart(), node.getEnd()]);
          return;
        }
        ts.forEachChild(node, visit);
      };
      visit(source);

      if (removals.length === 0) {
        return null;
      }

      let transformed = code;
      for (const [start, end] of removals.reverse()) {
        transformed = transformed.slice(0, start) + transformed.slice(end);
      }
      return { code: transformed, map: null };
    },
  };

  const existingPlugins = Array.isArray(baseConfig.plugins)
    ? baseConfig.plugins
    : baseConfig.plugins
    ? [baseConfig.plugins]
    : [];

  return {
    ...baseConfig,
    plugins: [
      stripProductionStatsCallsPlugin,
      productionStatsStubPlugin,
      ...existingPlugins,
    ],
  };
};
