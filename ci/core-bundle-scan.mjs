// Bundle checks for an app that imports only @signal-tree/core.
//
// S6(a): the bundle ships no plugin code — no plugin source file is an input
//        and no identifier a plugin entry exports appears in the output.
// S6(c): the bundle's bytes are identical with and without the plugin folders
//        present (BRIEF.md section 10, ruling 10).
// Ruling 11: the bench-only build flag and the store-time marks it guards are
//        absent from the production bundle.
//
// ci/checks.spec.ts proves each check fires on a planted violation.
import { cpSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { PLUGIN_DIRS, entryGraph, publicEntries, repoRoot } from './entry-graph.mjs';

/** Compile-time constant that guards store-time marks in bench builds only. */
export const BENCH_FLAG = '__SIGNAL_TREE_BENCH__';
/** Prefix of every store-time performance mark. */
export const MARK_PREFIX = 'signal-tree:';

export const CORE_ONLY_APP = `import * as core from '@signal-tree/core';\n(globalThis as Record<string, unknown>).core = core;\n`;

/** S6(a) and ruling 11 for an app whose source is `appSource`, bundled in the repository. */
export async function scanApp(appSource, { root = repoRoot } = {}) {
  const dir = mkdtempSync(join(root, 'ci', '.scan-'));
  try {
    const entry = join(dir, 'app.ts');
    writeFileSync(entry, appSource);
    const graph = await entryGraph(entry, { root });
    const code = graph.outputs.map((o) => o.text).join('\n');

    const pluginInputs = graph.inputs.filter((file) =>
      PLUGIN_DIRS.some((dirName) => file.startsWith(`packages/core/src/${dirName}/`)),
    );

    const pluginSymbols = new Map();
    for (const entryPoint of publicEntries(root)) {
      const dirName = entryPoint.subpath.slice(2);
      if (entryPoint.packageDir !== 'core' || !PLUGIN_DIRS.includes(dirName)) continue;
      const pluginGraph = await entryGraph(entryPoint.file, { root });
      const exportsOut = Object.values(pluginGraph.metafile.outputs).flatMap((o) => o.exports ?? []);
      for (const name of exportsOut) {
        if (new RegExp(`\\b${name}\\b`).test(code)) pluginSymbols.set(name, dirName);
      }
    }

    const production = await build({
      entryPoints: [entry],
      absWorkingDir: root,
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'neutral',
      minify: true,
      define: { [BENCH_FLAG]: 'false' },
      logLevel: 'silent',
    });
    const productionCode = production.outputFiles.map((o) => o.text).join('\n');
    const benchLeaks = [BENCH_FLAG, MARK_PREFIX].filter((needle) => productionCode.includes(needle));

    return { pluginInputs, pluginSymbols: [...pluginSymbols.entries()], benchLeaks };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Bundles `root`/app/app.ts, resolving @signal-tree/core to `root`/packages/core through its exports. */
async function bundleCoreOnly(root, minify) {
  const manifest = JSON.parse(readFileSync(join(root, 'packages', 'core', 'package.json'), 'utf8'));
  const result = await build({
    entryPoints: [join(root, 'app', 'app.ts')],
    absWorkingDir: root,
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    minify,
    define: { [BENCH_FLAG]: 'false' },
    logLevel: 'silent',
    plugins: [
      {
        name: 'workspace-core',
        setup(b) {
          b.onResolve({ filter: /^@signal-tree\/core(\/.*)?$/ }, (args) => {
            const subpath = `.${args.path.slice('@signal-tree/core'.length)}`;
            const target = manifest.exports[subpath];
            if (!target) return { errors: [{ text: `no export ${subpath}` }] };
            return { path: join(root, 'packages', 'core', typeof target === 'string' ? target : target.default) };
          });
        },
      },
    ],
  });
  return result.outputFiles.map((o) => o.text).join('\n');
}

/**
 * S6(c): bundles the core-only app twice — once with `coreDir` copied whole and
 * once with its plugin folders left out — and reports whether the bytes match.
 * A build that fails without the plugin folders counts as a difference.
 */
export async function pluginFolderIdentity({ coreDir = join(repoRoot, 'packages', 'core') } = {}) {
  // Real path: esbuild names inputs by real path, so a symlinked temp dir would
  // put the two variants' absolute paths into the bundles' comments.
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'signal-tree-s6c-')));
  try {
    const roots = { with: join(base, 'with'), without: join(base, 'without') };
    for (const [variant, root] of Object.entries(roots)) {
      cpSync(coreDir, join(root, 'packages', 'core'), {
        recursive: true,
        filter: (src) =>
          !src.split('/').includes('node_modules') &&
          (variant === 'with' || !PLUGIN_DIRS.some((d) => src === join(coreDir, 'src', d) || src.startsWith(join(coreDir, 'src', d) + '/'))),
      });
      mkdirSync(join(root, 'app'));
      writeFileSync(join(root, 'app', 'app.ts'), CORE_ONLY_APP);
    }
    const differences = [];
    for (const minify of [false, true]) {
      let withPlugins;
      let withoutPlugins;
      try {
        withPlugins = await bundleCoreOnly(roots.with, minify);
        withoutPlugins = await bundleCoreOnly(roots.without, minify);
      } catch (error) {
        differences.push(`${minify ? 'minified' : 'unminified'} build fails without the plugin folders: ${String(error.message ?? error).split('\n')[0]}`);
        continue;
      }
      if (withPlugins !== withoutPlugins) differences.push(`${minify ? 'minified' : 'unminified'} bundles differ`);
    }
    return { identical: differences.length === 0, differences };
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { pluginInputs, pluginSymbols, benchLeaks } = await scanApp(CORE_ONLY_APP);
  const identity = await pluginFolderIdentity();
  const findings = [
    ...pluginInputs.map((file) => `S6(a): plugin source in core-only bundle: ${file}`),
    ...pluginSymbols.map(([name, plugin]) => `S6(a): ${plugin} symbol "${name}" in core-only bundle`),
    ...benchLeaks.map((needle) => `bench-only "${needle}" present in the production bundle`),
    ...identity.differences.map((d) => `S6(c): ${d}`),
  ];
  for (const f of findings) console.log(`FAIL ${f}`);
  console.log(
    findings.length
      ? `${findings.length} finding(s).`
      : 'ok: S6(a) no plugin code, S6(c) identical bytes without the plugin folders, no bench-only code in production.',
  );
  process.exit(findings.length ? 1 : 0);
}
