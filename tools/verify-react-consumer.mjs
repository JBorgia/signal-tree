#!/usr/bin/env node
/**
 * Install packed kernel/react packages into a throwaway React project, then
 * type-check, bundle, and execute one owner-bound selector update.
 *
 * SSR is deliberately outside this smoke test: the initial React package does
 * not freeze a getServerSnapshot or hydration policy.
 */
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist/packages');
const PACKAGES = ['kernel', 'react'];
const REACT_VERSION = process.env['REACT_VERSION'] || '^19.0.0';
const REACT_MAJOR = REACT_VERSION.match(/\d+/)?.[0] || '19';
const VERSION = JSON.parse(
  readFileSync(join(ROOT, 'package.json'), 'utf8')
).version;

for (const pkg of PACKAGES) {
  if (!existsSync(join(DIST, pkg, 'package.json'))) {
    console.error(`dist/packages/${pkg} not found - run the build first.`);
    process.exit(1);
  }
}

const work = mkdtempSync(join(tmpdir(), 'st-react-consumer-'));
const tgzDir = join(work, 'tgz');
mkdirSync(tgzDir, { recursive: true });

execFileSync(
  'node',
  ['scripts/resolve-workspace-specs.mjs', VERSION, ...PACKAGES],
  { cwd: ROOT, stdio: 'pipe' }
);

const tarballs = [];
for (const pkg of PACKAGES) {
  const packed = JSON.parse(
    execFileSync('npm', ['pack', '--pack-destination', tgzDir, '--json'], {
      cwd: join(DIST, pkg),
      encoding: 'utf8',
    })
  );
  const tarball = packed[0]?.filename;
  if (!tarball) throw new Error(`npm pack produced no ${pkg} tarball`);
  tarballs.push(join(tgzDir, tarball));
}

const project = join(work, 'consumer');
mkdirSync(join(project, 'src'), { recursive: true });
writeFileSync(
  join(project, 'package.json'),
  JSON.stringify({
    name: 'st-react-consumer',
    version: '0.0.0',
    private: true,
    type: 'module',
  }, null, 2)
);

writeFileSync(
  join(project, 'src', 'main.tsx'),
  `
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { signalTree } from '@signal-tree/kernel';
import { useSignalTree } from '@signal-tree/react';

const tree = signalTree({ count: 1, unrelated: 0 });

function Count() {
  const count: number = useSignalTree(tree, ($) => $.count());
  return <output>{count}</output>;
}

const holder: { current?: ReactTestRenderer } = {};
await act(async () => {
  holder.current = create(<Count />);
});
const rendered = holder.current;
if (!rendered) throw new Error('React consumer did not mount');
if (rendered.root.findByType('output').children.join('') !== '1') {
  throw new Error('initial selected value did not render');
}

await act(async () => {
  tree.$.count.set(2);
  for (let index = 0; index < 4; index++) await Promise.resolve();
});
if (rendered.root.findByType('output').children.join('') !== '2') {
  throw new Error('selected value did not update');
}

await act(async () => {
  rendered.unmount();
});
tree.destroy();
process.exit(0);
`
);

writeFileSync(
  join(project, 'tsconfig.json'),
  JSON.stringify({
    compilerOptions: {
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      target: 'es2022',
      module: 'esnext',
      moduleResolution: 'bundler',
      jsx: 'react-jsx',
      lib: ['es2022', 'dom'],
      types: ['node', 'react', 'react-dom', 'react-test-renderer'],
    },
    include: ['src/**/*.tsx'],
  }, null, 2)
);

try {
  execFileSync(
    'npm',
    [
      'install',
      '--no-audit',
      '--no-fund',
      ...tarballs,
      `react@${REACT_VERSION}`,
      `react-dom@${REACT_VERSION}`,
      `react-test-renderer@${REACT_VERSION}`,
      `@types/react@^${REACT_MAJOR}.0.0`,
      `@types/react-dom@^${REACT_MAJOR}.0.0`,
      `@types/react-test-renderer@^${REACT_MAJOR}.0.0`,
      '@types/node@^22.0.0',
      'typescript@^5.6.0',
      'esbuild@^0.25.0',
      'tslib@^2.0.0',
    ],
    { cwd: project, stdio: 'pipe' }
  );
  execFileSync('npx', ['tsc', '-p', 'tsconfig.json'], {
    cwd: project,
    stdio: 'pipe',
  });
  execFileSync(
    'npx',
    [
      'esbuild',
      'src/main.tsx',
      '--bundle',
      '--platform=node',
      '--format=esm',
      '--outfile=consumer.mjs',
    ],
    { cwd: project, stdio: 'pipe' }
  );
  execFileSync('node', ['consumer.mjs'], {
    cwd: project,
    stdio: 'pipe',
    timeout: 60_000,
  });
} catch (error) {
  console.error('React consumer smoke failed:');
  console.error(`${error.stdout || ''}${error.stderr || ''}`.trim());
  process.exit(1);
}

console.log('React tarball consumer typecheck, bundle, and runtime smoke passed.');
