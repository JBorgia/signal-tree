const { withNx } = require('@nx/rollup/with-nx');

// These options were migrated by @nx/rollup:convert-to-inferred from project.json
const options = {
  main: './src/index.ts',
  additionalEntryPoints: ['./src/adapter.ts'],
  tsConfig: './tsconfig.lib.prod.json',
  outputPath: '../../dist/packages/kernel',
  format: ['esm'],
  assets: [
    {
      input: 'packages/kernel',
      glob: 'README.md',
      output: '.',
    },
    {
      input: '.',
      glob: 'LICENSE',
      output: '.',
    },
    {
      input: '.',
      glob: 'NOTICE',
      output: '.',
    },
    {
      input: 'packages/kernel',
      glob: 'package.json',
      output: '.',
    },
  ],
  deleteOutputPath: true,
  buildLibsFromSource: true,
  generatePackageJson: false,
};

let config = withNx(options, {
  // Provide additional rollup configuration here. See: https://rollupjs.org/configuration-options
  // e.g.
  // output: { sourcemap: true },
});

config = require('./rollup.custom.mjs').default(config, options);

module.exports = config;
