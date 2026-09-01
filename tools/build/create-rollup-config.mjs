import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolveWorkspaceSpecs } from './workspace-specs.mjs';

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);

/**
 * Adjusts the Nx-generated Rollup configuration so each library emits
 * preserveModules-style ESM output in the layout our package manifests expect.
 */
export function createLibraryRollupConfig({
  packageRoot,
  moduleSubDir = 'dist',
} = {}) {
  if (!packageRoot) {
    throw new Error('createLibraryRollupConfig requires a packageRoot');
  }

  const resolvedPackageRoot = path.resolve(packageRoot);
  const srcRoot = path.join(resolvedPackageRoot, 'src');

  const normalizeForOutput = (moduleId) => {
    if (!moduleId) {
      return null;
    }

    const fromSrc = path.relative(srcRoot, moduleId);
    if (!fromSrc.startsWith('..')) {
      return fromSrc;
    }

    // Fall back to module path relative to the package root to keep the layout stable.
    const fromPackage = path.relative(resolvedPackageRoot, moduleId);
    if (!fromPackage.startsWith('..')) {
      return fromPackage;
    }

    return path.basename(moduleId);
  };

  return (config, options = {}) => {
    // Re-key the entry input map by src-relative path. @nx/rollup keys it by
    // entry BASENAME (with-nx.js createInput: `input[parse(entry).name]`), so
    // an additionalEntryPoint like `src/foo/index.ts` silently OVERWRITES the
    // main `src/index.ts` — both key as "index" — and the main barrel never
    // builds. That shipped broken barrels in realtime, ng-forms, and
    // guardrails (papered over by per-package "barrel-index-plugin" hacks that
    // fabricated dist/index.js from hardcoded, stale export lists). Output
    // filenames are unaffected: with preserveModules they derive from
    // facadeModuleId, not input keys.
    if (options.main) {
      const entries = [options.main, ...(options.additionalEntryPoints ?? [])];
      const input = {};
      for (const entry of entries) {
        const full = path.isAbsolute(entry)
          ? entry
          : path.join(workspaceRoot, entry);
        const key = path
          .relative(srcRoot, full)
          .replace(/\\/g, '/')
          .replace(/\.[jt]sx?$/i, '');
        input[key] = full;
      }
      config = { ...config, input };
    }

    const outputs = Array.isArray(config.output)
      ? config.output
      : [config.output ?? {}];

    const targetRoot = path.join(workspaceRoot, options.outputPath);
    const moduleDir = moduleSubDir ? moduleSubDir.replace(/\\/g, '/') : '';

    const toOutputPath = (moduleId, fallback) => {
      const normalized = normalizeForOutput(moduleId);
      const basePath = normalized
        ? normalized.replace(/\\/g, '/').replace(/\.[jt]sx?$/i, '')
        : fallback;

      if (!basePath) {
        return moduleDir ? `${moduleDir}/[name].js` : '[name].js';
      }

      return moduleDir ? `${moduleDir}/${basePath}.js` : `${basePath}.js`;
    };

    const updatedOutputs = outputs.map((output) => ({
      ...output,
      dir: targetRoot,
      format: 'esm',
      entryFileNames: (chunkInfo) =>
        toOutputPath(chunkInfo.facadeModuleId, chunkInfo.name),
      chunkFileNames: (chunkInfo) =>
        toOutputPath(
          chunkInfo.facadeModuleId ?? chunkInfo.moduleIds?.[0],
          chunkInfo.name
        ),
      exports: 'named',
      preserveModules: true,
      preserveModulesRoot: srcRoot,
      sourcemap: false,
    }));

    const plugins = Array.isArray(config.plugins)
      ? config.plugins
      : config.plugins
      ? [config.plugins]
      : [];

    // Strip comments from the emitted JS, and ONLY the JS.
    //
    // The packages used to do this with `removeComments: true` in
    // tsconfig.lib.prod.json — the single TypeScript switch for it, which strips
    // `.d.ts` as well. That shipped five of seven packages with declarations
    // carrying zero JSDoc: core/src/lib/types.ts has 476 doc lines and its
    // shipped types.d.ts had 0, so a consumer hovering `maxHistorySize` saw no
    // description and no `@default 50`.
    //
    // Doing it HERE rather than in a postbuild script is the load-bearing part.
    // An earlier attempt stripped comments in npm's `postbuild`, which worked
    // until `verify-gates.mjs` built `dist/` with nx directly and skipped the
    // hook entirely — the invariant then held on one build path and broke on
    // another. A rollup plugin lives in the build graph, so every path that
    // produces JS produces stripped JS.
    //
    // `minifyWhitespace` is required, not cosmetic: without it esbuild keeps
    // comments attached to object members, and one such survivor mentioning
    // '@angular/forms/signals' in prose trips the `angular-compat` gate, which
    // detects APIs with a substring scan (check-angular-compat.mjs:113) and so
    // silently assumes built JS carries no prose. Identifiers and syntax are
    // deliberately left alone — this is not a minifier, and consumer stack
    // traces should still name real functions.
    //
    // Safe because no source maps ship: outputs set `sourcemap: false` above,
    // and `files` publishes only `dist/**/*.js` and `src/**/*.d.ts`. If maps are
    // ever published this must generate them rather than invalidate them.
    const stripJsCommentsPlugin = {
      name: 'signaltree-strip-js-comments',
      async renderChunk(code) {
        if (!code.includes('/*') && !code.includes('//')) return null;
        const { transform } = await import('esbuild');
        const out = await transform(code, {
          loader: 'js',
          format: 'esm',
          minify: false,
          minifyIdentifiers: false,
          minifySyntax: false,
          minifyWhitespace: true,
          legalComments: 'none',
        });
        return { code: out.code, map: null };
      },
    };

    const resolveWorkspaceManifestPlugin = {
      name: 'signaltree-resolve-workspace-manifest',
      async closeBundle() {
        const manifestPath = path.join(targetRoot, 'package.json');
        let content;
        try {
          content = await fs.readFile(manifestPath, 'utf8');
        } catch {
          return;
        }
        const manifest = JSON.parse(content);
        if (resolveWorkspaceSpecs(manifest, manifest.version) > 0) {
          await fs.writeFile(
            manifestPath,
            `${JSON.stringify(manifest, null, 2)}\n`
          );
        }
      },
    };

    return {
      ...config,
      plugins: [
        ...plugins,
        stripJsCommentsPlugin,
        resolveWorkspaceManifestPlugin,
      ],
      // Entry barrels must keep their re-exports even when the module body is
      // empty after bundling (pure re-export barrels).
      preserveEntrySignatures: 'exports-only',
      output: Array.isArray(config.output) ? updatedOutputs : updatedOutputs[0],
      treeshake: {
        ...(config.treeshake || {}),
        moduleSideEffects: false,
      },
    };
  };
}
