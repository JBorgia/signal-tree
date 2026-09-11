const { withNx } = require('@nx/rollup/with-nx');

const options = {
  main: './src/index.ts',
  additionalEntryPoints: [],
  tsConfig: './tsconfig.lib.prod.json',
  outputPath: '../../dist/packages/studio-query',
  format: ['esm'],
  assets: [
    {
      input: 'packages/studio-query',
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
      input: 'packages/studio-query',
      glob: 'package.json',
      output: '.',
    },
    {
      input: 'packages/studio-query/src',
      glob: '**/*.d.ts',
      output: './src',
    },
  ],
  deleteOutputPath: true,
  buildLibsFromSource: true,
  generatePackageJson: false,
};

let config = withNx(options, {});
config = require('./rollup.custom.mjs').default(config, options);

module.exports = config;
