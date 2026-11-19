// Shared helpers for the boundary check (ci/boundaries.mjs) and the
// core-only bundle scan (ci/core-bundle-scan.mjs). Both resolve the real
// module graph with esbuild instead of reading import statements, so they see
// what a bundler would actually ship.
import { readFileSync, readdirSync, existsSync, realpathSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { build } from 'esbuild';

export const repoRoot = realpathSync(new URL('..', import.meta.url).pathname);

export const PLUGIN_DIRS = ['transactions', 'restoration', 'writers', 'devtools'];
export const CORE_SUBPATH_DIRS = ['adapter', ...PLUGIN_DIRS];

/** Bare module specifiers each framework adapter may import (BRIEF.md 4.1). */
export const FRAMEWORK_IMPORTS = {
  angular: [/^@angular\//],
  vue: [/^vue$/, /^@vue\//],
  solid: [/^solid-js(\/|$)/],
  preact: [/^preact(\/|$)/, /^@preact\/signals(-core)?$/],
  react: [/^react(\/|$)/, /^use-sync-external-store(\/|$)/],
};

const RESTRICTED_WORDS = new Set(['experimental', 'research', 'prototype', 'spike']);

/** Rule 7: true if any path segment, or any -_. separated token of one, is a restricted word. */
export function isRestrictedPath(path) {
  return path
    .split(/[\\/]/)
    .some((segment) => segment.toLowerCase().split(/[-_.]/).some((token) => RESTRICTED_WORDS.has(token)));
}

/** Every public entry point: one per export of every package under packages/. */
export function publicEntries(root = repoRoot) {
  const packagesDir = join(root, 'packages');
  if (!existsSync(packagesDir)) return [];
  const entries = [];
  for (const dir of readdirSync(packagesDir).sort()) {
    const manifestPath = join(packagesDir, dir, 'package.json');
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    for (const [subpath, target] of Object.entries(manifest.exports ?? {})) {
      if (subpath === './package.json') continue;
      const file = typeof target === 'string' ? target : target.default ?? target.import;
      entries.push({
        packageDir: dir,
        packageName: manifest.name,
        specifier: subpath === '.' ? manifest.name : `${manifest.name}/${subpath.slice(2)}`,
        subpath,
        file: join(packagesDir, dir, file),
      });
    }
  }
  return entries;
}

/**
 * Bundles one entry and returns the repo-relative source files it reaches and
 * the bare specifiers it leaves external (everything outside @signal-tree/*).
 */
export async function entryGraph(entryFile, { root = repoRoot } = {}) {
  const externals = new Set();
  const result = await build({
    entryPoints: [entryFile],
    absWorkingDir: root,
    bundle: true,
    write: false,
    metafile: true,
    format: 'esm',
    platform: 'neutral',
    mainFields: ['module', 'main'],
    logLevel: 'silent',
    plugins: [
      {
        name: 'record-externals',
        setup(b) {
          b.onResolve({ filter: /^[^./]/ }, (args) => {
            if (args.path.startsWith('@signal-tree/')) return undefined;
            externals.add(args.path);
            return { path: args.path, external: true };
          });
        },
      },
    ],
  });
  const inputs = Object.keys(result.metafile.inputs).map((p) => toRepoPath(p, root));
  return { inputs, externals: [...externals].sort(), outputs: result.outputFiles, metafile: result.metafile };
}

function toRepoPath(p, root) {
  const absolute = p.startsWith(sep) ? p : join(root, p);
  return relative(root, existsSync(absolute) ? realpathSync(absolute) : absolute).split(sep).join('/');
}
