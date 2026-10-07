import path from 'node:path';
import { fileURLToPath } from 'node:url';

import typescript from '@rollup/plugin-typescript';
import { dts } from 'rollup-plugin-dts';
import { createLibraryRollupConfig } from '../../tools/build/create-rollup-config.mjs';
import { createStripProductionStatsCallsPlugin } from '../../tools/build/strip-production-stats-calls.mjs';

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

      if (
        !normalizedSource.startsWith('.') ||
        path.resolve(path.dirname(importer), normalizedSource) !==
          path.join(packageRoot, 'src/lib/internals/production-substrate-stats')
      ) {
        return null;
      }

      return statsStubPath;
    },
  };

  const stripProductionStatsCallsPlugin = createStripProductionStatsCallsPlugin(
    { packageRoot }
  );

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

  // One declaration graph preserves every nominal identity across the public
  // entry points, including private construction metadata. Separate bundles
  // duplicate unique symbols; rewriting them as root imports would require
  // exporting private types. Shared chunks stay private package files instead.
  return [
    runtimeConfig,
    {
      input: {
        index: path.join(packageRoot, 'src/index.ts'),
        adapter: path.join(packageRoot, 'src/adapter.ts'),
        internals: path.join(packageRoot, 'src/internals.ts'),
      },
      output: {
        dir: path.join(packageRoot, '../../dist/packages/kernel/dist'),
        format: 'es',
        entryFileNames: '[name].d.ts',
        chunkFileNames: '_[name]-[hash].d.ts',
      },
      plugins: [dts({ respectExternal: true })],
    },
  ];
};
