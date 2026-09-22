const { withNx } = require('@nx/rollup/with-nx');

const options = {
  main: './src/index.ts',
  additionalEntryPoints: [],
  tsConfig: './tsconfig.lib.prod.json',
  outputPath: '../../dist/packages/solid',
  format: ['esm'],
  assets: [
    {
      input: 'packages/solid',
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
      input: 'packages/solid',
      glob: 'package.json',
      output: '.',
    },
    {
      input: 'packages/solid/src',
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
