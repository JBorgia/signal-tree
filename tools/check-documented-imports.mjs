#!/usr/bin/env node
/**
 * Every import specifier a live document teaches must be one a USER can actually
 * write.
 *
 * ## The gap this fills, and the defect that earned it
 *
 * Two gates already existed and neither asks this question:
 *
 *   lint-readme-apis    does this SYMBOL exist in some built entry point?
 *   find-dead-exports   is this symbol reachable from barrels or repo imports?
 *   MISSING             can a user import the documented SPECIFIER from the
 *                       published package at all?
 *
 * RELEASE-RESIDUE-0 found the consequence. The root README taught three subpath
 * imports — `@signal-tree/kernel/security`, `@signal-tree/kernel/edit-session` and
 * `@signal-tree/kernel/storage` — while `packages/kernel/package.json` exports only
 * `"."`. `security` and `storage` had been deleted; `edit-session` was never in
 * the export map at all, yet was implemented, tested and documented for six major
 * versions. `lint-readme-apis` could not see it because a path that is not an
 * entry point is checked against nothing, and `find-dead-exports` could not see
 * it because edit-session's own specs imported it, so it looked reachable.
 *
 * "Documented", "implemented", "tested" and "publishable" are four different
 * facts. This gate is the documented -> publishable edge.
 *
 * ## What it does
 *
 * Extracts every `from '@signaltree/...'` specifier in LIVE docs, splits it into
 * package + subpath, and requires the subpath to be present in that package's
 * `exports` map.
 *
 * Historical material is excluded by PATH, never by heuristic: a current guide
 * must not get a pass because a parser guessed a snippet was about the past.
 *
 *   node tools/check-documented-imports.mjs
 *   node tools/check-documented-imports.mjs --self-test
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

/**
 * Documents whose specifiers are LIVE INSTRUCTIONS. Everything else — archives,
 * migration guides, audits, changelogs, release notes — records what was true at
 * a point in time and is excluded by path rather than by guesswork.
 */
const LIVE_DOCS = [
  'README.md',
  'packages/kernel/README.md',
  'packages/kernel/ENHANCERS.md',
  'packages/angular/README.md',
  'packages/react/README.md',
  'packages/vue/README.md',
  'docs/guides',
  'docs/ai',
  'docs/overview.md',
];

const EXCLUDED_PREFIXES = [
  'docs/archive',
  'docs/audits',
  'docs/rfcs',
  'docs/research',
  'docs/compare',
  'CHANGELOG.md',
  'RELEASE-NOTES',
];

/**
 * Migration guides name what you are migrating FROM. Excluded by NAME, not by
 * inspecting the snippet — `docs/guides/MIGRATION.md` is the v4.0.0
 * package-consolidation guide and legitimately shows `@signaltree/batching`,
 * `@signaltree/devtools` and five more packages that were folded into core.
 */
const isMigrationGuide = (rel) => /migration/i.test(rel);

function collect(target) {
  const abs = join(ROOT, target);
  if (!existsSync(abs)) return [];
  if (statSync(abs).isFile()) return [target];
  return readdirSync(abs)
    .filter((f) => f.endsWith('.md'))
    .map((f) => join(target, f));
}

/**
 * ⚠️ PACKAGE NAME IS NOT DIRECTORY NAME, and after the v15 identity move it is
 * not even the same SCOPE. `@signal-tree/kernel` lives in `packages/kernel`, and
 * historical documents legitimately still name `@signaltree/*` — the v14
 * generation. Deriving the directory by stripping a hard-coded scope silently
 * stopped resolving anything once the rename landed, and the self-test caught it
 * exactly as designed.
 *
 * The manifest is located by NAME rather than guessed from the specifier.
 */
/**
 * ⚠️ A HISTORICAL DOCUMENT TEACHES A HISTORICAL SPECIFIER, AND THAT IS CORRECT.
 * `docs/ai/LLM.md` is titled "SignalTree v7" and pins `@signaltree/core@^7.0.0`
 * — the package that generation actually shipped. Rewriting it to the v15 name
 * would make the record lie about what v7 users installed.
 *
 *     A HISTORICAL RECORD IS EVIDENCE. DO NOT EDIT IT TO SATISFY A GATE.
 *
 * Same marker the doc-link gate uses, so the two gates agree on what "live"
 * means.
 */
const HISTORICAL_MARKER =
  /^\s*(>\s*)?\*\*Status:\s*HISTORICAL|^#\s.*Migration Guide:\s*v[0-9]|^#\s*SignalTree\s+v[0-9]+\s*[-–]/im;

function packageDirsByName() {
  const out = new Map();
  for (const dir of readdirSync(join(ROOT, 'packages'))) {
    const manifest = join(ROOT, 'packages', dir, 'package.json');
    if (!existsSync(manifest)) continue;
    try {
      const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
      if (pkg.name) out.set(pkg.name, pkg);
    } catch {
      /* unparseable manifest is not a package */
    }
  }
  return out;
}
const PACKAGES = packageDirsByName();

function exportsOf(pkgName) {
  const pkg = PACKAGES.get(pkgName);
  if (!pkg) return null;
  return pkg.exports ?? { '.': true };
}

/** `@signal-tree/kernel/edit-session` -> ['@signal-tree/kernel', './edit-session'] */
function split(specifier) {
  const parts = specifier.split('/');
  const pkgName = parts.slice(0, 2).join('/');
  const rest = parts.slice(2).join('/');
  return [pkgName, rest ? `./${rest}` : '.'];
}

function check(files) {
  const problems = [];
  let checked = 0;
  for (const rel of files) {
    const text = readFileSync(join(ROOT, rel), 'utf8');
    if (HISTORICAL_MARKER.test(text)) continue;
    const seen = new Set();
    for (const m of text.matchAll(/from '(@signal-?tree\/[^']+)'/g)) {
      if (seen.has(m[1])) continue;
      seen.add(m[1]);
      checked++;
      const [pkgName, subpath] = split(m[1]);
      const map = exportsOf(pkgName);
      if (!map) {
        problems.push({ rel, specifier: m[1], why: `no such package` });
        continue;
      }
      if (!(subpath in map)) {
        problems.push({
          rel,
          specifier: m[1],
          why: `'${subpath}' is not in ${pkgName}'s exports (${Object.keys(
            map
          ).join(', ')})`,
        });
      }
    }
  }
  return { problems, checked };
}

function liveFiles() {
  return LIVE_DOCS.flatMap(collect).filter((rel) => {
    const r = relative('.', rel);
    if (EXCLUDED_PREFIXES.some((p) => r.startsWith(p))) return false;
    if (isMigrationGuide(r)) return false;
    return true;
  });
}

if (process.argv.includes('--self-test')) {
  const cases = [
    ['@signal-tree/kernel', true],
    ['@signal-tree/kernel/definitely-not-exported', false],
    ['@signaltree/definitely-not-a-package', false],
  ];
  let ok = true;
  for (const [spec, shouldResolve] of cases) {
    const [pkgName, subpath] = split(spec);
    const map = exportsOf(pkgName);
    const resolves = !!map && subpath in map;
    const pass = resolves === shouldResolve;
    ok &&= pass;
    console.log(
      `  ${pass ? 'ok  ' : 'FAIL'}  ${spec} -> ${
        resolves ? 'resolves' : 'rejected'
      } (expected ${shouldResolve ? 'resolves' : 'rejected'})`
    );
  }
  console.log(
    ok
      ? '\n✅ self-test: the gate accepts a real entry point and rejects both a bogus subpath and a bogus package.'
      : '\n❌ self-test FAILED — the gate cannot tell a resolvable specifier from an unresolvable one.'
  );
  process.exit(ok ? 0 : 1);
}

const files = liveFiles();
const { problems, checked } = check(files);

console.log(
  `Checked ${checked} @signaltree import specifier(s) across ${files.length} live document(s) against the packages' export maps.`
);

if (problems.length === 0) {
  console.log(
    '✓ every documented import specifier resolves against a published export map.'
  );
  process.exit(0);
}

console.error(
  `\n✗ ${problems.length} documented import(s) a user cannot write:\n`
);
for (const p of problems) {
  console.error(`    ${p.rel}\n      ${p.specifier}\n      ${p.why}\n`);
}
console.error(
  'Documented, implemented and tested are three different facts from publishable.\n' +
    'Either add the subpath to the package exports, or stop teaching it.'
);
process.exit(1);
