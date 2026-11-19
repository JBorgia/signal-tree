// S6(a): an app that imports only @signal-tree/core must ship no plugin code.
// Bundles such an app without minification and fails if any plugin source file
// is an input, or if any identifier a plugin entry exports appears in the
// output. The self-test in core-bundle-scan.spec.ts proves the scan fires.
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PLUGIN_DIRS, entryGraph, publicEntries, repoRoot } from './entry-graph.mjs';

/** Bundles a throwaway app whose source is `appSource` and returns the scan result. */
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
    return { pluginInputs, pluginSymbols: [...pluginSymbols.entries()] };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export const CORE_ONLY_APP = `import * as core from '@signal-tree/core';\n(globalThis as Record<string, unknown>).core = core;\n`;

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { pluginInputs, pluginSymbols } = await scanApp(CORE_ONLY_APP);
  for (const file of pluginInputs) console.log(`FAIL plugin source in core-only bundle: ${file}`);
  for (const [name, plugin] of pluginSymbols) console.log(`FAIL ${plugin} symbol "${name}" in core-only bundle`);
  const failed = pluginInputs.length + pluginSymbols.length;
  console.log(failed ? `S6(a) failed: ${failed} finding(s).` : 'S6(a) ok: the core-only bundle contains no plugin code.');
  process.exit(failed ? 1 : 0);
}
