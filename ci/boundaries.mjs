// Checks every public entry point against BRIEF.md 4.1 ("May import") and
// rule 7 (nothing named or living under experimental, research, prototype or
// spike is reachable). Exits non-zero on any violation.
import { pathToFileURL } from 'node:url';
import {
  CORE_SUBPATH_DIRS,
  FRAMEWORK_IMPORTS,
  PLUGIN_DIRS,
  entryGraph,
  isRestrictedPath,
  publicEntries,
  repoRoot,
} from './entry-graph.mjs';

const CORE_SRC = 'packages/core/src/';

/** The core sub-directory a file belongs to, or null for core's own modules. */
function coreArea(file) {
  if (!file.startsWith(CORE_SRC)) return undefined;
  const first = file.slice(CORE_SRC.length).split('/')[0];
  return CORE_SUBPATH_DIRS.includes(first) ? first : null;
}

/** Returns the violations for one entry, given the files and externals it reaches. */
export function violationsFor(entry, { inputs, externals }) {
  const problems = [];
  for (const file of inputs) {
    if (isRestrictedPath(file)) problems.push(`rule 7: reaches ${file}`);
  }

  const ownArea = entry.packageDir === 'core' ? (entry.subpath === '.' ? null : entry.subpath.slice(2)) : undefined;
  for (const file of inputs) {
    const area = coreArea(file);
    if (entry.packageDir === 'core') {
      if (area === undefined) problems.push(`4.1: ${entry.specifier} reaches ${file}, outside @signal-tree/core`);
      else if (area !== null && area !== ownArea) problems.push(`4.1: ${entry.specifier} reaches ${file} (${area} is not core)`);
    } else {
      const ownSrc = `packages/${entry.packageDir}/src/`;
      if (file.startsWith(ownSrc)) continue;
      if (area === undefined) problems.push(`4.1: ${entry.specifier} reaches ${file}, outside core and its own package`);
      else if (area !== null) problems.push(`4.1: ${entry.specifier} reaches ${file} (${area} is not core)`);
    }
  }

  const allowed = entry.packageDir === 'core' ? [] : FRAMEWORK_IMPORTS[entry.packageDir] ?? [];
  for (const specifier of externals) {
    if (!allowed.some((pattern) => pattern.test(specifier))) {
      problems.push(`4.1: ${entry.specifier} imports "${specifier}", which it may not import`);
    }
  }
  return problems;
}

export async function checkBoundaries({ root = repoRoot } = {}) {
  const entries = publicEntries(root);
  const report = [];
  for (const entry of entries) {
    const graph = await entryGraph(entry.file, { root });
    report.push({ entry, problems: violationsFor(entry, graph) });
  }
  return report;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await checkBoundaries();
  const failed = report.filter((r) => r.problems.length > 0);
  for (const { entry, problems } of report) {
    console.log(`${problems.length ? 'FAIL' : 'ok  '} ${entry.specifier}`);
    for (const p of problems) console.log(`     ${p}`);
  }
  console.log(`${report.length} entry points checked, ${failed.length} with violations (plugins: ${PLUGIN_DIRS.join(', ')}).`);
  process.exit(failed.length ? 1 : 0);
}
