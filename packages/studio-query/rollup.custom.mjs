import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLibraryRollupConfig } from '../../tools/build/create-rollup-config.mjs';

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
const baseConfigFactory = createLibraryRollupConfig({ packageRoot });

export default (config, options) => ({
  ...baseConfigFactory(config, options),
  plugins: [
    ...baseConfigFactory(config, options).plugins,
    declarationExtensions(),
  ],
  external: (id) =>
    id.startsWith('@signal-tree/') || id === 'tslib' || id.startsWith('node:'),
});

// TypeScript preserves extensionless source imports; published ESM declarations
// must resolve under Node16 too. Rewrite only existing declaration asset targets.
function declarationExtensions() {
  return {
    name: 'studio-declaration-extensions',
    generateBundle(_options, bundle) {
      for (const asset of Object.values(bundle)) {
        if (asset.type !== 'asset' || !asset.fileName.endsWith('.d.ts'))
          continue;
        asset.source = String(asset.source).replace(
          /(["'])(\.{1,2}\/[^"']+)\1/g,
          (match, quote, specifier) => {
            const target = path.posix.normalize(
              path.posix.join(path.posix.dirname(asset.fileName), specifier)
            );
            if (bundle[target + '.d.ts'])
              return quote + specifier + '.js' + quote;
            if (bundle[target + '/index.d.ts'])
              return quote + specifier + '/index.js' + quote;
            return match;
          }
        );
      }
    },
  };
}
