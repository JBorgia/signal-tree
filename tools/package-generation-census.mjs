#!/usr/bin/env node
/**
 * PACKAGE-GENERATION-CENSUS-0
 *
 * The kernel break is established. This is the separate question: which
 * PUBLISHED `@signaltree/*` artifacts exist, and what happens to each semantic
 * job in the v15 generation.
 *
 *     MOVING SOMETHING UNDER A NEW NAMESPACE DOES NOT MAKE IT v15-COMPATIBLE.
 *
 * ⚠️ WHAT THIS CAN AND CANNOT SEE. The denominator is built from the GIT
 * RECORD — every directory that ever held a publishable package manifest —
 * plus the current workspace. It reports each package's last in-repo version
 * and the commit that removed it. It CANNOT confirm what is actually published
 * on the npm registry, or whether a version newer than the last in-repo one was
 * released. Release truth is npm, not git, and that gap is stated rather than
 * papered over: rows are marked `registryUnverified`.
 *
 * Every package must carry exactly one disposition. A package with none fails
 * the run — there is no default.
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8' }).trim();

/**
 * Dispositions, decided from the deleting commit's own stated reason and from
 * whether the semantic job is reachable in the v15 public surface today.
 */
/**
 * REGISTRY TRUTH, recorded from `npm view` rather than inferred from git.
 *
 *     RELEASE TRUTH IS NPM, NOT GIT.
 *
 * Refresh with: for N in ...; do npm view @signaltree/$N version; done
 * A package absent here has NEVER been published, which changes its disposition
 * weight entirely: it has no users to strand.
 */
const PUBLISHED = {
  core: '14.1.3', events: '14.1.3', 'ng-forms': '14.1.3', schema: '14.1.3',
  guardrails: '14.1.3', realtime: '14.1.3',
  enterprise: '13.5.0', 'callable-syntax': '13.5.0',
};

/** Published peer range on @signal-tree/kernel, i.e. what the registry will admit. */
const PUBLISHED_CORE_RANGE = {
  'ng-forms': '^14.1.3', schema: '^14.1.3', guardrails: '^14.1.3',
  realtime: '^14.1.3', enterprise: '^13.5.0',
  events: '(none — does not depend on core)',
  'callable-syntax': '(none — build transform)',
};

const DISPOSITION = {
  // ── the surviving publishable package ────────────────────────────────────
  core: ['REBUILD', 'the v15 kernel itself; becomes the new-generation kernel package'],

  // ── ABSORB: the semantic job now lives inside an earned v15 boundary ─────
  batching: ['ABSORB', 'now core/enhancers/batching; `batching()` is public (BATCHING-OWNERSHIP-0 owes only its representation)'],
  devtools: ['ABSORB', 'now core/enhancers/devtools; `devTools()` is public'],
  serialization: ['ABSORB', 'now core/enhancers/serialization; `persistence()` is public'],
  'time-travel': ['ABSORB', 'now core/enhancers/restoration; `restoration()`/`undoable()` are public'],
  entities: ['ABSORB', 'now the core `entityMap` marker and EntitySignal (ENTITY-REPRESENTATION-OWNERSHIP-0 owes the representation)'],
  types: ['ABSORB', 'type surface folded into core/lib/types.ts and the owner modules (TYPE-BARREL-CONVERGENCE-0)'],
  utils: ['ABSORB', 'folded into core/lib/utils.ts and @signaltree/shared'],

  // ── DELETE: no surviving semantic job ────────────────────────────────────
  schema: ['DELETE', 'deleting commit: "SignalTree ships no validation API"'],
  'callable-syntax': ['DELETE', 'deleting commit: "the transform can never run"'],
  'syntax-transform': ['DELETE', 'same defect as callable-syntax — a build transform that cannot run'],
  memoization: ['DELETE', 'enhancer deleted in 9.0.1; Angular `computed()` is the answer'],
  enterprise: ['DELETE', 'deleting commit: "not published in 14.0.0" — never reached the 14 generation'],
  middleware: ['DELETE', 'superseded by the enhancer contract; no surviving public job'],
  presets: ['DELETE', 'configuration bundles over an enhancer set that no longer exists'],
  async: ['DELETE', 'asyncSource/asyncQuery are not in the v15 public surface'],

  // ── LEGACY-ONLY: real v14 artifacts with users; must not compose with v15 ─
  guardrails: ['LEGACY-ONLY', 'shipped 14.1.1 against the v14 kernel; its interception model predates the v15 observation architecture'],
  realtime: ['LEGACY-ONLY', 'shipped 14.1.1 against the v14 kernel'],

  // ── REBUILD: job survives, implementation cannot ─────────────────────────
  // ⚠️ NARROWED FROM REBUILD. "The job might be re-earned" is not REBUILD.
  //
  //     A SURVIVING USE CASE DOES NOT AUTOMATICALLY EARN A SURVIVING PACKAGE.
  //
  // REBUILD requires the semantic job independently PROVED to survive, the old
  // representation proved incompatible, and the new owner known. Neither of
  // these has the first or the third. They are legacy artifacts whose old
  // implementation is deleted; any future package must be earned on its own
  // evidence, exactly as surviving kernel mechanisms had to be.
  events: ['LEGACY-ONLY', 'published 14.1.3 and still installable; old implementation deleted by EVT-DEL. A future event/notification package is a CANDIDATE, not an earned rebuild'],
  'ng-forms': ['LEGACY-ONLY', 'published 14.1.3 and still installable; old implementation deleted by NGF-DEL. Angular forms integration is a semantic job candidate; the package boundary is NOT earned'],

  // ── private, never published ─────────────────────────────────────────────
  shared: ['ABSORB', 'private workspace package; kernel utilities consumed by core and reachable from the bare bundle'],
};

// ── denominator: every dir that ever held a publishable package ────────────
const historical = sh(
  `git log --all --diff-filter=D --name-only --format="" -- 'packages/*/package.json' | sort -u`
).split('\n').filter(Boolean).map((p) => p.split('/')[1]);

const present = sh(`ls -1 packages`).split('\n').filter(Boolean)
  .filter((d) => existsSync(`${ROOT}/packages/${d}/package.json`));

const all = [...new Set([...historical, ...present])].sort();

const rows = [];
for (const dir of all) {
  const live = existsSync(`${ROOT}/packages/${dir}/package.json`);
  let version = '?', name = `@signaltree/${dir}`, priv = false, deletedBy = '';
  if (live) {
    const j = JSON.parse(readFileSync(`${ROOT}/packages/${dir}/package.json`, 'utf8'));
    version = j.version; name = j.name; priv = Boolean(j.private);
  } else {
    const sha = sh(`git log --all --diff-filter=D --format=%H -1 -- packages/${dir}/package.json`);
    deletedBy = sh(`git log -1 --format="%h %ad" --date=short ${sha}`);
    try {
      const j = JSON.parse(sh(`git show ${sha}^:packages/${dir}/package.json`));
      version = j.version; name = j.name; priv = Boolean(j.private);
    } catch { /* unparseable historical manifest */ }
  }
  const d = DISPOSITION[dir];
  rows.push({ dir, name, version, live, priv, deletedBy, disposition: d?.[0], why: d?.[1],
    published: PUBLISHED[dir], coreRange: PUBLISHED_CORE_RANGE[dir] });
}

const missing = rows.filter((r) => !r.disposition);
const byDisp = {};
for (const r of rows) if (r.disposition) (byDisp[r.disposition] ??= []).push(r);

console.log(`PACKAGE-GENERATION-CENSUS-0 — ${rows.length} package(s) in the denominator\n`);
console.log('package                      published    in-repo      disposition');
for (const r of rows.sort((a, b) => (a.disposition ?? '').localeCompare(b.disposition ?? '') || a.dir.localeCompare(b.dir))) {
  const pub = r.published ?? '— never —';
  console.log(`  ${r.name.padEnd(28)}${pub.padEnd(13)}${String(r.version).padEnd(13)}${r.disposition ?? '‼ NONE'}`);
}
console.log('\nby disposition:');
for (const [d, rs] of Object.entries(byDisp).sort()) console.log(`  ${String(rs.length).padStart(3)}  ${d}`);
console.log(`  ${String(rows.length).padStart(3)}  TOTAL`);
console.log(`\nunexplained: ${missing.length}`);
const published = rows.filter((r) => r.published);
console.log(`\nPUBLISHED (have users): ${published.length} of ${rows.length}`);
console.log('NEVER PUBLISHED       : ' + (rows.length - published.length) + ' — no users to strand');
console.log('\nWHAT THE REGISTRY WOULD ACTUALLY ADMIT:');
for (const r of published) if (r.coreRange) console.log(`  ${r.name.padEnd(28)} core ${r.coreRange}`);
console.log(`
  Every published companion pins core to a 14.x or 13.x CARET range, which does
  NOT admit a 15.x core. npm would refuse the combination on its own.

  So the mixing hazard is NOT mechanical resolution — semver already blocks it.
  It is CONCEPTUAL: a reader (or a coding agent) seeing \`@signaltree/schema\`
  beside \`@signal-tree/kernel\` assumes one ecosystem. That is precisely what a
  scope change fixes and a version bump does not.`);
if (missing.length) {
  for (const m of missing) console.error(`  ‼ ${m.name} has no disposition`);
  process.exit(1);
}
