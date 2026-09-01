#!/usr/bin/env node
/**
 * Proves that both public kernel declaration bundles are reproducible and
 * self-contained under strict TypeScript checking.
 */
import { readFileSync, rmSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { rollup } from 'rollup';
import { dts } from 'rollup-plugin-dts';
import ts from 'typescript';

const ROOT = process.cwd();
const scratchRoot =
  process.argv[2] ?? join(ROOT, 'tmp', 'declaration-closure');
const shippedRoot = join(ROOT, 'dist', 'packages', 'kernel', 'dist');
const entries = ['index', 'adapter'];

rmSync(scratchRoot, { recursive: true, force: true });
await mkdir(scratchRoot, { recursive: true });

for (const entry of entries) {
  const bundle = await rollup({
    input: join(ROOT, 'packages', 'kernel', 'src', `${entry}.ts`),
    plugins: [dts({ respectExternal: true })],
  });
  await bundle.write({
    file: join(scratchRoot, `${entry}.d.ts`),
    format: 'es',
  });
  await bundle.close();
}

const mismatches = entries.filter(
  (entry) =>
    readFileSync(join(scratchRoot, `${entry}.d.ts`), 'utf8') !==
    readFileSync(join(shippedRoot, `${entry}.d.ts`), 'utf8')
);
if (mismatches.length > 0) {
  console.error(
    `Declaration build is not reproducible for: ${mismatches.join(', ')}`
  );
  process.exit(1);
}

const program = ts.createProgram(
  entries.map((entry) => join(scratchRoot, `${entry}.d.ts`)),
  {
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    skipLibCheck: false,
    strict: true,
    target: ts.ScriptTarget.ES2022,
    types: [],
  }
);
const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length > 0) {
  console.error(
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: () => ROOT,
      getNewLine: () => '\n',
    })
  );
  process.exit(1);
}

console.log(
  'Declaration closure is reproducible and strict for root and adapter bundles.'
);
