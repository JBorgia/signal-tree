#!/usr/bin/env node
/**
 * A package whose SOURCE carries JSDoc must ship JSDoc in its DECLARATIONS.
 *
 *   node tools/check-declaration-docs.mjs
 *   node tools/check-declaration-docs.mjs --self-test
 *
 * WHY. `removeComments: true` is the only TypeScript switch for keeping comments
 * out of emitted JS, and it strips them from `.d.ts` too. Five of seven packages
 * set it, so every shipped declaration carried zero JSDoc: core/src/lib/types.ts
 * had 476 JSDoc lines and its shipped types.d.ts had 0. A consumer hovering
 * `maxHistorySize` saw `maxHistorySize?: number` — no description, no default,
 * even though the source documents `@default 50`.
 *
 * Nothing existing caught it. `bundle-budget` measures bundled JS and never looks
 * at `.d.ts`; `api-surface` compares symbol inventories, not comments;
 * `package-hygiene` checks that declared entries are PRESENT, not documented.
 * `scripts/verify-jsdoc-stripping.js` encoded the right intent but inspected only
 * each package's barrel file, and listed a package removed in 14.0.0.
 *
 * SCOPE, stated narrowly: this checks ONE direction — source has JSDoc therefore
 * declarations have JSDoc — across every package, counting doc blocks in every
 * `.d.ts` rather than just the barrel. It does NOT check that runtime JS stays
 * comment-free; that is scripts/verify-jsdoc-stripping.js's job. The two are
 * complements and neither covers the other.
 */
import { readFile } from 'node:fs/promises';
import { glob } from 'node:fs/promises';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SELF_TEST = process.argv.includes('--self-test');
const PACKAGES = readdirSync(join(process.cwd(), 'packages'), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((pkg) => {
    const manifestPath = join(process.cwd(), 'packages', pkg, 'package.json');
    if (!existsSync(manifestPath)) return false;
    return JSON.parse(readFileSync(manifestPath, 'utf8')).private !== true;
  })
  .sort();

const FORBIDDEN_PUBLIC_GUIDANCE = ['through arbitrarily long `.with()` chains'];

const findForbiddenPublicGuidance = (text, file) =>
  FORBIDDEN_PUBLIC_GUIDANCE.filter((phrase) => text.includes(phrase)).map(
    (phrase) => ({ file, phrase })
  );

// Count JSDoc block openers. Line comments are deliberately not counted:
// declarations carry doc blocks, not `//` notes.
const countJsdoc = (text) => (text.match(/\/\*\*/g) ?? []).length;

const collect = async (pattern) => {
  const out = [];
  for await (const f of glob(pattern)) out.push(f);
  return out;
};

async function measure(pkg) {
  const srcFiles = await collect(`packages/${pkg}/src/**/*.ts`);
  const dtsFiles = [
    ...(await collect(`dist/packages/${pkg}/src/**/*.d.ts`)),
    ...(await collect(`dist/packages/${pkg}/dist/**/*.d.ts`)),
  ];
  let srcDocs = 0;
  for (const f of srcFiles) {
    if (f.endsWith('.spec.ts')) continue;
    srcDocs += countJsdoc(await readFile(f, 'utf8'));
  }
  let dtsDocs = 0;
  const staleGuidance = [];
  for (const f of dtsFiles) {
    const text = await readFile(f, 'utf8');
    dtsDocs += countJsdoc(text);
    staleGuidance.push(...findForbiddenPublicGuidance(text, f));
  }
  return {
    pkg,
    srcDocs,
    dtsDocs,
    dtsFiles: dtsFiles.length,
    staleGuidance,
  };
}

const rows = [];
for (const pkg of PACKAGES) {
  if (!existsSync(`packages/${pkg}/src`)) continue;
  if (!existsSync(`dist/packages/${pkg}`)) {
    console.error(
      `✗ ${pkg}: not built. Run \`npm run build\` before this check.`
    );
    process.exit(1);
  }
  rows.push(await measure(pkg));
}

// The invariant is a RATIO, not "not zero". Two reasons, both learned the hard way:
//
//  1. `stripInternal` legitimately removes whole `@internal` declarations, so a
//     package never ships 100% of its source blocks. Measured spread: 72%-98%.
//  2. "exactly zero" is untestable in practice. Documentation is concentrated —
//     guardrails keeps 106 of its 123 blocks in one file — so no single-file
//     mutation can drive a package to zero, and a gate whose mutation cannot trip
//     it is exactly the blind gate the harness exists to catch. It WAS caught
//     that way: the first version of this gate reported BLIND.
const FLOOR = 0.5;
const BUNDLED_DOC_BASELINE = {
  kernel: 248,
};

const retainedDocumentationRatio = (srcDocs, dtsDocs) =>
  srcDocs === 0 ? 1 : dtsDocs / srcDocs;

const hasStrippedDocumentation = (pkg, srcDocs, dtsDocs) => {
  const bundledBaseline = BUNDLED_DOC_BASELINE[pkg];
  if (bundledBaseline !== undefined) {
    return dtsDocs < bundledBaseline;
  }
  return srcDocs > 0 && retainedDocumentationRatio(srcDocs, dtsDocs) < FLOOR;
};

// --- self-test: prove the checker detects a stripped declaration set --------
if (SELF_TEST) {
  const probe = rows.find((r) => r.srcDocs > 0);
  if (!probe) {
    console.error(
      '✗ self-test cannot run: no package has documented source, so a stripped\n' +
        '  declaration set would be indistinguishable from a correct one.'
    );
    process.exit(1);
  }
  const detected = hasStrippedDocumentation(probe.pkg, probe.srcDocs, 0);
  const clean = !hasStrippedDocumentation(
    probe.pkg,
    probe.srcDocs,
    probe.dtsDocs
  );
  if (!detected) {
    console.error(
      '✗ self-test FAILED: a stripped declaration set was not flagged.'
    );
    process.exit(1);
  }
  if (!clean) {
    console.error(
      `✗ self-test FAILED: ${probe.pkg} retains ${(
        (probe.dtsDocs / probe.srcDocs) *
        100
      ).toFixed(0)}%, so the checker would flag the repo even when correct.`
    );
    process.exit(1);
  }
  const staleFixture =
    'State inference survives through arbitrarily long `.with()` chains.';
  const cleanFixture =
    'State inference is preserved through the declarative enhancer tuple.';
  if (
    findForbiddenPublicGuidance(staleFixture, '<fixture>').length !== 1 ||
    findForbiddenPublicGuidance(cleanFixture, '<fixture>').length !== 0
  ) {
    console.error(
      '✗ self-test FAILED: stale retired-API guidance was not flagged.'
    );
    process.exit(1);
  }
  console.log(
    `✓ self-test: flags a stripped set (${probe.pkg}: ${probe.srcDocs} src blocks -> 0 ` +
      `shipped), and reports clean at its real ratio (${(
        (probe.dtsDocs / probe.srcDocs) *
        100
      ).toFixed(0)}%); flags retired-API guidance.`
  );
  process.exit(0);
}

// --- the real check --------------------------------------------------------
const documentationFailures = [];
const guidanceFailures = [];
console.log('package      src JSDoc   shipped .d.ts JSDoc   retained   files');
console.log('─'.repeat(64));
for (const r of rows) {
  r.ratio = retainedDocumentationRatio(r.srcDocs, r.dtsDocs);
  const bad = hasStrippedDocumentation(r.pkg, r.srcDocs, r.dtsDocs);
  if (bad) documentationFailures.push(r);
  if (r.staleGuidance.length > 0) guidanceFailures.push(r);
  console.log(
    `${r.pkg.padEnd(12)} ${String(r.srcDocs).padEnd(10)} ${String(
      r.dtsDocs
    ).padEnd(21)} ${(r.ratio * 100).toFixed(0).padStart(3)}%       ${
      r.dtsFiles
    }  ${bad ? '❌ STRIPPED' : '✓'}`
  );
}

if (documentationFailures.length) {
  console.error(
    `\n❌ ${documentationFailures.length} package(s) retain under ${
      FLOOR * 100
    }% of their source documentation in shipped declarations.\n\n` +
      "   A consumer's IDE shows the type and nothing else — no description, no\n" +
      '   @default, no @example. The usual cause is `removeComments: true` in\n' +
      '   tsconfig.lib.prod.json, which strips `.d.ts` as well as `.js`.\n\n' +
      '   Keep comments in both outputs; the rollup plugin in\n' +
      '   tools/build/create-rollup-config.mjs removes them from the runtime JS.'
  );
  for (const f of documentationFailures) console.error(`   · ${f.pkg}`);
}

if (guidanceFailures.length) {
  console.error(
    `\n❌ ${guidanceFailures.length} package(s) ship guidance for a retired public API.`
  );
  for (const f of guidanceFailures) {
    console.error(`   · ${f.pkg}`);
    for (const stale of f.staleGuidance) {
      console.error(
        `     ${stale.file}: retired public guidance: "${stale.phrase}"`
      );
    }
  }
}

if (documentationFailures.length || guidanceFailures.length) process.exit(1);

console.log(
  '\n✅ every documented package ships current, documented declarations.'
);
process.exit(0);
