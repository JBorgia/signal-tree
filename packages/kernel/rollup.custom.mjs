import path from 'node:path';
import { fileURLToPath } from 'node:url';

import typescript from '@rollup/plugin-typescript';
import { dts } from 'rollup-plugin-dts';
import ts from 'typescript';
import { createLibraryRollupConfig } from '../../tools/build/create-rollup-config.mjs';

const packageRoot = path.dirname(fileURLToPath(import.meta.url));

const baseConfigFactory = createLibraryRollupConfig({ packageRoot });

const adapterEntityMarkerIdentityPlugin = {
  name: 'signaltree-adapter-entity-marker-identity',
  renderChunk(code, chunk) {
    if (!chunk.fileName.endsWith('adapter.d.ts')) {
      return null;
    }

    const source = ts.createSourceFile(
      chunk.fileName,
      code,
      ts.ScriptTarget.Latest,
      false,
      ts.ScriptKind.TS
    );
    const brandDeclarations = source.statements.filter(
      (statement) =>
        ts.isVariableStatement(statement) &&
        statement.declarationList.declarations.some(
          (declaration) =>
            ts.isIdentifier(declaration.name) &&
            declaration.name.text === 'ENTITY_MAP_BRAND'
        )
    );
    const markerDeclarations = source.statements.filter(
      (statement) =>
        ts.isInterfaceDeclaration(statement) &&
        statement.name.text === 'EntityMapMarker'
    );

    if (brandDeclarations.length !== 1 || markerDeclarations.length !== 1) {
      this.error(
        'adapter declaration must contain exactly one local EntityMapMarker definition.'
      );
    }

    let transformed = code;
    for (const declaration of [
      ...brandDeclarations,
      ...markerDeclarations,
    ].sort((left, right) => right.getFullStart() - left.getFullStart())) {
      transformed =
        transformed.slice(0, declaration.getFullStart()) +
        transformed.slice(declaration.getEnd());
    }

    return {
      code: `import type { EntityMapMarker } from './index.js';\n${transformed}`,
      map: null,
    };
  },
};

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

      const source = this.parse(code);
      const removals = [];

      const visit = (node) => {
        if (
          node.type === 'ExpressionStatement' &&
          node.expression?.type === 'CallExpression' &&
          node.expression.callee?.type === 'Identifier' &&
          node.expression.callee.name === 'recordProductionSubstrateStat'
        ) {
          removals.push([node.start, node.end]);
          return;
        }
        for (const value of Object.values(node)) {
          if (Array.isArray(value)) {
            for (const child of value) {
              if (child?.type) visit(child);
            }
          } else if (value?.type) {
            visit(value);
          }
        }
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

  const runtimePlugins = existingPlugins.filter(
    (plugin) => plugin?.name !== 'typescript' && plugin?.name !== 'dts-bundle'
  );

  const runtimeConfig = {
    ...baseConfig,
    plugins: [
      productionStatsStubPlugin,
      ...runtimePlugins,
      typescript({
        tsconfig: path.join(packageRoot, 'tsconfig.lib.prod.json'),
        declaration: false,
        declarationMap: false,
        declarationDir: undefined,
      }),
      stripProductionStatsCallsPlugin,
    ],
  };

  return [
    runtimeConfig,
    {
      input: path.join(packageRoot, 'src/index.ts'),
      output: {
        file: path.join(
          packageRoot,
          '../../dist/packages/kernel/dist/index.d.ts'
        ),
        format: 'es',
      },
      plugins: [dts({ respectExternal: true })],
    },
    {
      input: path.join(packageRoot, 'src/adapter.ts'),
      output: {
        file: path.join(
          packageRoot,
          '../../dist/packages/kernel/dist/adapter.d.ts'
        ),
        format: 'es',
        plugins: [adapterEntityMarkerIdentityPlugin],
      },
      plugins: [dts({ respectExternal: true })],
    },
  ];
};
