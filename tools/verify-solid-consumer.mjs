#!/usr/bin/env node
/**
 * PACKED-TARBALL CONSUMER GATE FOR `@signal-tree/solid`.
 *
 * The adapter working inside the monorepo is not evidence that the package is
 * shippable. Path aliases, workspace links and the repo's own tsconfig hide the
 * failures that actually reach users: a missing `exports` condition, a type
 * that never made it into the barrel, a peer dependency nobody declared.
 *
 * So this packs the real tarballs, installs them into a clean project that has
 * never heard of this repository, and both TYPE-CHECKS and RUNS a consumer
 * written against public entrypoints only.
 *
 * Running it matters as much as compiling it. Solid ships a client runtime and
 * an SSR build selected by export conditions, and under plain Node the SSR
 * build wins — where `createEffect` is a no-op. A consumer test that only
 * compiled, or that ran without selecting the client conditions, would observe
 * nothing and pass. The child process is therefore launched with
 * `--conditions=development --conditions=browser`.
 *
 *   node tools/verify-solid-consumer.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES = ['kernel', 'solid'];
const work = mkdtempSync(join(tmpdir(), 'st-solid-consumer-'));

const fail = (message, detail) => {
  console.error(`\n❌ ${message}`);
  if (detail) console.error(detail);
  process.exit(1);
};

console.log('📦 Packing and validating a real @signal-tree/solid consumer\n');

// --- pack -------------------------------------------------------------------
const tarballs = [];
for (const name of PACKAGES) {
  const before = new Set(readdirSync(work));
  try {
    execFileSync('npm', ['pack', '--pack-destination', work], {
      cwd: join(ROOT, 'dist/packages', name),
      stdio: 'pipe',
    });
  } catch (error) {
    fail(`npm pack failed for ${name}`, String(error));
  }
  const tarball = readdirSync(work).find(
    (file) => file.endsWith('.tgz') && !before.has(file)
  );
  if (!tarball) fail(`npm pack produced no tarball for ${name}`);
  tarballs.push(join(work, tarball));
  console.log(`  packed ${name}`);
}

// --- clean consumer project -------------------------------------------------
const proj = join(work, 'consumer');
mkdirSync(join(proj, 'src'), { recursive: true });
writeFileSync(
  join(proj, 'package.json'),
  JSON.stringify(
    { name: 'solid-consumer', private: true, version: '0.0.0', type: 'module' },
    null,
    2
  )
);
writeFileSync(
  join(proj, 'tsconfig.json'),
  JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        // `bundler` is what a real Solid app uses via Vite.
        moduleResolution: 'bundler',
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        jsx: 'preserve',
        jsxImportSource: 'solid-js',
        types: [],
      },
      include: ['src'],
    },
    null,
    2
  )
);

/**
 * Deliberately imports ONLY from published entrypoints — no deep paths, no
 * workspace aliases. If a type or value is missing from the public barrel this
 * is where it surfaces.
 */
writeFileSync(
  join(proj, 'src/consumer.ts'),
  `import { createEffect, createRoot } from 'solid-js';
import {
  entityMap,
  signalTree,
  type EntityNode,
  type SignalTree,
  type WritableLeaf,
} from '@signal-tree/solid';

type Row = { id: number; name: string; v: number };

const tree: SignalTree<{ count: number; rows: ReturnType<typeof entityMap<Row>> }> =
  signalTree({ count: 0, rows: entityMap<Row>({}) }) as never;

// A leaf is a Solid accessor the kernel made writable.
const count: WritableLeaf<number> = tree.$.count;
const readCount: number = count();
count.set(readCount + 1);

tree.$.rows.setAll([{ id: 1, name: 'a', v: 1 }]);
const row: EntityNode<Row> | undefined = tree.$.rows.byId(1);
tree.$.rows.updateOne(1, { name: 'b' });
const name: string | undefined = row?.()?.name;

const observed: (string | undefined)[] = [];
const dispose = createRoot((dispose) => {
  createEffect(() => observed.push(tree.$.rows.byId(1)?.()?.name));
  return dispose;
});

export { tree, name, observed, dispose };
`
);

/** The runtime half: a Solid effect must actually rerun from a kernel write. */
writeFileSync(
  join(proj, 'src/runtime.mjs'),
  `import { createEffect, createRoot } from 'solid-js';
import { entityMap, signalTree } from '@signal-tree/solid';

const tick = () => new Promise((r) => setTimeout(r, 0));
const problems = [];

const tree = signalTree({ count: 0, rows: entityMap({}) });

// Guard against the whole check passing vacuously: if Solid resolved to its
// SSR build, effects never run and every assertion below is meaningless.
const seen = [];
const dispose = createRoot((dispose) => {
  createEffect(() => seen.push(tree.$.count()));
  return dispose;
});
await tick();
if (seen.length === 0) {
  problems.push('Solid effects never ran — SSR build resolved, results are meaningless');
}

tree.$.count.set(1);
await tick();
if (seen.at(-1) !== 1) problems.push('scalar publication did not reach the effect: ' + JSON.stringify(seen));

tree.$.rows.setAll([{ id: 1, name: 'a', v: 1 }]);
const rowSeen = [];
const dispose2 = createRoot((dispose) => {
  createEffect(() => rowSeen.push(tree.$.rows.byId(1)?.()?.name));
  return dispose;
});
await tick();
tree.$.rows.updateOne(1, { name: 'b' });
await tick();
if (rowSeen.at(-1) !== 'b') problems.push('entity publication did not reach the effect: ' + JSON.stringify(rowSeen));

// Subject lifetime, not key identity.
const held = tree.$.rows.byId(1);
tree.$.rows.removeOne(1);
tree.$.rows.addOne({ id: 1, name: 'new-occupant', v: 9 });
if (held?.() !== undefined) problems.push('a held reference followed a new same-key occupant');
if (tree.$.rows.byId(1)?.()?.name !== 'new-occupant') problems.push('re-added row not visible');

dispose(); dispose2(); tree.destroy();

if (problems.length) { console.error(problems.join('\\n')); process.exit(1); }
console.log('runtime consumer OK');
`
);

// --- install ----------------------------------------------------------------
console.log('  installing tarballs into a clean project...');
try {
  execFileSync(
    'npm',
    [
      'install',
      '--no-audit',
      '--no-fund',
      '--silent',
      ...tarballs,
      `solid-js@${process.env.SOLID_VERSION ?? '^1.9.0'}`,
      'typescript@^5.6.0',
    ],
    { cwd: proj, stdio: 'pipe' }
  );
} catch (error) {
  fail('install of the packed tarballs failed', String(error));
}

// --- type-check -------------------------------------------------------------
try {
  execFileSync('npx', ['tsc', '-p', 'tsconfig.json'], { cwd: proj, stdio: 'pipe' });
  console.log('  ✅ consumer type-checks against the packed tarball');
} catch (error) {
  fail(
    'consumer type-check failed against the packed tarball',
    String(error.stdout ?? error)
  );
}

// --- run --------------------------------------------------------------------
try {
  const out = execFileSync(
    process.execPath,
    ['--conditions=development', '--conditions=browser', 'src/runtime.mjs'],
    { cwd: proj, encoding: 'utf8' }
  );
  if (!out.includes('runtime consumer OK')) fail('runtime consumer did not report OK', out);
  console.log('  ✅ Solid effects rerun from SignalTree publication');
} catch (error) {
  fail('runtime consumer failed', String(error.stdout ?? error.stderr ?? error));
}

rmSync(work, { recursive: true, force: true });
console.log('\n✅ @signal-tree/solid consumer gate passed: packed, installed, typed and running.');
