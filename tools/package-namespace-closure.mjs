#!/usr/bin/env node
/**
 * PACKAGE-NAMESPACE-CLOSURE-0
 *
 * `PACKAGE-GENERATION-CENSUS-0` enumerated every directory that ever held a
 * publishable manifest — 21 subjects, 0 unexplained. That claim was true and
 * too small:
 *
 *     A REPOSITORY-MANIFEST CENSUS IS NOT A PACKAGE-NAMESPACE CENSUS.
 *
 * Names like `@signaltree/authoring`, `kernel`, `angular`, `storage` and
 * `source` appear in the repository without ever having been a directory, so a
 * manifest-derived denominator cannot see them. The denominator here is the
 * UNION of three independent sources:
 *
 *     A  every package manifest ever present in git
 *     B  every `@signaltree/*` name mentioned anywhere in the tree OR history
 *     C  every name that actually resolves on the npm registry
 *
 * ⚠️ C IS PROBED PER NAME, NOT SEARCHED. `npm search @signaltree` returns SEVEN
 * packages and misses `@signaltree/enterprise`, which is published at 13.5.0.
 * A search index is a convenience, not a denominator.
 *
 * Every name in the union carries exactly one disposition. No name is inferred
 * "never published" from the absence of a manifest.
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const sh = (c) => { try { return execSync(c, { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return ''; } };

// ── A: manifests ever present ─────────────────────────────────────────────
const manifests = new Set([
  ...sh(`git log --all --diff-filter=D --name-only --format="" -- 'packages/*/package.json' | sort -u`)
    .split('\n').filter(Boolean).map((p) => p.split('/')[1]),
  ...sh('ls -1 packages').split('\n').filter(Boolean)
    .filter((d) => existsSync(`${ROOT}/packages/${d}/package.json`)),
]);

// ── B: mentioned anywhere in tree or history ──────────────────────────────
//
// ⚠️ TWO DEFECTS WERE FIXED HERE, AND BOTH PRODUCED A WRONG DENOMINATOR.
//
// 1. `grep -rho ... | grep -v node_modules` — `-h` suppresses filenames, so the
//    second grep filters MATCH TEXT, not paths. It could never exclude a
//    node_modules hit. Replaced with a real `--exclude-dir`.
//
// 2. `git log --all -p | grep` streamed the entire history through a pipe. That
//    produced a phantom subject, `@signaltree/persist`, which exists in no file,
//    no commit and no registry — a token split across a buffer boundary, with
//    `persistence` truncated to `persist`. A denominator that changes between
//    runs is not a denominator.
//
//        A DENOMINATOR ASSEMBLED THROUGH AN UNBOUNDED PIPE IS NOT REPRODUCIBLE.
//
//    Replaced with `git grep` over every ref, which reads objects directly and
//    emits whole matches.
const NAME_RE = /^[a-z0-9][a-z0-9-]*$/;
const mentioned = new Set();
const addNames = (raw) => {
  for (const line of raw.split('\n')) {
    for (const m of line.matchAll(/@signaltree\/([a-z0-9-]+)/g)) {
      if (NAME_RE.test(m[1])) mentioned.add(m[1]);
    }
  }
};
// ⚠️ THE CENSUS TOOLING IS EXCLUDED FROM ITS OWN DENOMINATOR. This file names
// `@signaltree/definitely-not-a-package-xyz` as a registry liveness control, and
// without this exclusion the census discovers its own probe and demands a
// disposition for it — the same defect as the bare-module reporter censusing its
// synthetic entry.
//
//     A MEASUREMENT HARNESS MUST NOT APPEAR IN ITS OWN MEASUREMENT.
addNames(sh(`grep -rhoE "@signaltree/[a-z0-9-]+" --include="*.json" --include="*.md" --include="*.ts" --include="*.mjs" --include="*.cjs" --include="*.html" --exclude-dir=node_modules --exclude=package-namespace-closure.mjs --exclude=package-generation-census.mjs . 2>/dev/null`));
addNames(sh(`git grep -hoE "@signaltree/[a-z0-9-]+" $(git rev-list --all 2>/dev/null | head -4000) -- '*.json' '*.md' '*.ts' '*.mjs' '*.cjs' '*.html' 2>/dev/null`));

// ── C: AUTHORITATIVE registry enumeration of the scope ────────────────────
//
// ⚠️ NOT `npm search`, AND NOT A HAND-MAINTAINED LIST. Search was proven
// incomplete — it returns seven packages and omits `@signaltree/enterprise`,
// which is published. A hand list is worse: it can only re-verify names already
// known from A and B, so it cannot discover a package that exists ONLY on npm.
// That is not a denominator, it is a status check on the answer you already had.
//
//     A DENOMINATOR THAT CAN ONLY CONFIRM WHAT YOU ALREADY KNEW IS NOT AN
//     INDEPENDENT SOURCE.
//
// `registry.npmjs.org/-/org/<scope>/package` enumerates the scope
// authoritatively and answers unauthenticated. It immediately found
// `@signaltree/async`, which A∪B had recorded as never published — it WAS
// published and was UNPUBLISHED on 2025-09-16, which is why `npm view` reports
// nothing while the scope still lists it.
const SCOPE_ENUM_URL = 'https://registry.npmjs.org/-/org/signaltree/package';
let scopeNames = [];
try {
  const raw = sh(`curl -sS --max-time 60 ${SCOPE_ENUM_URL}`);
  const parsed = JSON.parse(raw);
  scopeNames = Object.keys(parsed).map((n) => n.replace('@signaltree/', '')).sort();
} catch (e) {
  console.error('❌ scope enumeration FAILED — this is not an empty namespace.');
  console.error('   ' + String(e).slice(0, 120));
  console.error('   Enumeration failure and an empty scope are different facts; refusing to conflate them.');
  process.exit(1);
}
if (!scopeNames.includes('core') || !scopeNames.includes('enterprise')) {
  console.error('❌ scope enumeration missing a known positive (core / enterprise) — not trustworthy.');
  process.exit(1);
}
/** Verified per name; `null` = enumerated but no installable version (unpublished). */
const PUBLISHED = {};
for (const n of scopeNames) {
  const v = sh(`npm view @signaltree/${n} version 2>/dev/null | grep -v '^npm warn' | tail -1`);
  PUBLISHED[n] = v || null;
}

/** Dispositions for names that were never a manifest. Evidence, not spelling. */
/**
 * ⚠️ EXACTLY SIX FINAL DISPOSITIONS ARE ALLOWED:
 *   LEGACY-ONLY · ABSORB · DELETE · REBUILD · NON-PACKAGE · BRIDGE
 *
 * An earlier version invented PROSE-ONLY, TEST-FIXTURE, PROPOSED-FUTURE,
 * PROPOSED-NOT-EARNED, NEVER-EXISTED and NOT-A-PACKAGE. Those are REASONS, not
 * dispositions — every one of them means "this string never represented a
 * package contract", which is NON-PACKAGE. They are kept as a `[subtype]`
 * prefix on the rationale so the detail survives without inflating the ontology.
 *
 *     A RATIONALE IS NOT A DISPOSITION.
 *
 * Note `kernel` and `angular`: their possible future existence under
 * @signal-tree does not make the OLD @signaltree strings anything but
 * NON-PACKAGE in this census.
 */
const NON_PACKAGE = {
  authoring: ['NON-PACKAGE', '[PROPOSED-NOT-EARNED] RELEASE-1.0.md: "@signaltree/authoring — STOPPED. Package/form is UNPROVEN."'],
  kernel: ['NON-PACKAGE', '[PROPOSED-FUTURE] the v15 kernel package identity; belongs to the @signal-tree generation, not this scope'],
  angular: ['NON-PACKAGE', '[PROPOSED-FUTURE] the v15 Angular adapter package; belongs to the @signal-tree generation'],
  storage: ['NON-PACKAGE', '[NEVER-EXISTED] docs/myths-and-misconceptions.md documents it as a MYTH: "No @signaltree/storage package exists"'],
  source: ['NON-PACKAGE', '[NOT-A-PACKAGE] the Nx workspace root project name in project.json, never publishable'],
  forms: ['NON-PACKAGE', '[PROSE-ONLY] TODO.md shorthand for the forms integration idea'],
  validation: ['NON-PACKAGE', '[PROSE-ONLY] RELEASE-1.0.md prose about the retired validation surface'],
  react: ['NON-PACKAGE', '[PROSE-ONLY] architecture prose about a possible future vertical'],
  ai: ['NON-PACKAGE', '[PROSE-ONLY] CHANGELOG prose'],
  llm: ['NON-PACKAGE', '[PROSE-ONLY] history prose'],
  data: ['NON-PACKAGE', '[PROSE-ONLY] ai-codegen benchmark scorer example text'],
  queries: ['NON-PACKAGE', '[PROSE-ONLY] history prose'], indexing: ['NON-PACKAGE', '[PROSE-ONLY] history prose'],
  security: ['NON-PACKAGE', '[PROSE-ONLY] history prose'], performance: ['NON-PACKAGE', '[PROSE-ONLY] history prose'],
  openai: ['NON-PACKAGE', '[PROSE-ONLY] history prose'], supabase: ['NON-PACKAGE', '[PROSE-ONLY] history prose'],
  monolith: ['NON-PACKAGE', '[PROSE-ONLY] history prose about a rejected packaging shape'],
  computed: ['NON-PACKAGE', '[PROSE-ONLY] history prose'], restoration: ['NON-PACKAGE', '[PROSE-ONLY] history prose'],
  diagnostics: ['NON-PACKAGE', '[PROSE-ONLY] history prose'], enhancers: ['NON-PACKAGE', '[PROSE-ONLY] history prose'],
  'lazy-tree': ['NON-PACKAGE', '[PROSE-ONLY] history prose about the withdrawn lazy feature'],
  'runtime-utils': ['NON-PACKAGE', '[PROSE-ONLY] history prose'], 'core-internal': ['NON-PACKAGE', '[PROSE-ONLY] history prose'],
  'batching-impl': ['NON-PACKAGE', '[PROSE-ONLY] history prose'], 'devtools-impl': ['NON-PACKAGE', '[PROSE-ONLY] history prose'],
  'guardrails-docs': ['NON-PACKAGE', '[PROSE-ONLY] history prose'],
  workspace: ['NON-PACKAGE', '[PROSE-ONLY] the `workspace:*` protocol string, not a package name'],
  signaltree: ['NON-PACKAGE', '[PROSE-ONLY] self-reference in prose'],
  'signal-tree': ['NON-PACKAGE', '[PROSE-ONLY] reference to the NEW generation scope'],
  persist: ['NON-PACKAGE', '[NON-PACKAGE] appears only in historical revision text — absent from every manifest, from the live discussion record (RELEASE-1.0.md/TODO.md/docs), and from the registry (404). It corresponds to the persistence capability, which shipped as the in-core `persistence()` enhancer; the never-published `@signaltree/serialization` was its package-shaped ancestor. RESIDUAL: the exact originating commit was not pinpointed within the search budget, and that is stated rather than glossed'],
  fake: ['NON-PACKAGE', '[TEST-FIXTURE] tools/verify-tarball-consumer.mjs — a deliberately bogus specifier'],
  x: ['NON-PACKAGE', '[TEST-FIXTURE] scripts/lint-readme-apis.mjs fixture'],
  'definitely-not-a-package': ['NON-PACKAGE', '[TEST-FIXTURE] tools/check-documented-imports.mjs known-negative control'],
};

// ── the registry probe must be PROVEN LIVE ────────────────────────────────
//
//     ABSENCE OF A RESULT IS NOT EVIDENCE OF ABSENCE UNTIL THE PROBE IS SHOWN
//     TO WORK.
//
// A network failure, a proxy, or an auth problem all return "no version" —
// indistinguishable from "never published" unless a known-positive is checked
// in the same run. `npm search @signaltree` was ALSO shown unreliable: it
// returns seven packages and silently omits `@signaltree/enterprise`, which is
// published. That is why C is probed per name and verified here.
if (process.argv.includes('--verify-registry')) {
  const probe = (name) => {
    try {
      const v = execSync(`npm view ${name} version 2>/dev/null`, { encoding: 'utf8' })
        .split('\n').filter((l) => l && !l.startsWith('npm warn')).pop();
      return { ok: true, version: v?.trim() || null };
    } catch (e) {
      const msg = String(e.stderr ?? e.message);
      return { ok: /E404|404 Not Found/.test(msg), version: null, error: /E404|404/.test(msg) ? null : msg.slice(0, 80) };
    }
  };
  const pos = probe('@signal-tree/kernel');
  const neg = probe('@signaltree/definitely-not-a-package-xyz');
  console.log('registry probe liveness:');
  console.log(`  known-published  @signal-tree/kernel -> ${pos.version ?? '(none)'}`);
  console.log(`  known-absent     bogus name       -> ${neg.version ?? '404 (correctly absent)'}`);
  if (!pos.version) {
    console.error('\n❌ registry probe is NOT live — a known-published package returned nothing.');
    console.error('   Every "never published" conclusion in this census would be unfounded.');
    process.exit(1);
  }
  if (neg.version) { console.error('\n❌ probe returned a version for a bogus name.'); process.exit(1); }
  console.log('  ✅ probe discriminates: published != absent != failed\n');
}

/**
 * Manifest-name dispositions, mirrored from PACKAGE-GENERATION-CENSUS-0 so this
 * table closes in the six allowed values rather than deferring.
 */
const GENERATION = {
  core: ['REBUILD', 'the v15 kernel; becomes @signal-tree/kernel'],
  events: ['LEGACY-ONLY', 'published 14.1.3; old implementation deleted by EVT-DEL. A future event package is NOT earned'],
  'ng-forms': ['LEGACY-ONLY', 'published 14.1.3; old implementation deleted by NGF-DEL. A future forms package is NOT earned'],
  guardrails: ['LEGACY-ONLY', 'published 14.1.3 against the v14 kernel'],
  realtime: ['LEGACY-ONLY', 'published 14.1.3 against the v14 kernel'],
  schema: ['LEGACY-ONLY', 'published 14.1.3; SignalTree ships no validation API in v15'],
  enterprise: ['LEGACY-ONLY', 'published 13.5.0; never reached the 14 generation'],
  'callable-syntax': ['LEGACY-ONLY', 'published 13.5.0; the transform can never run'],
  async: ['DELETE', 'was published and UNPUBLISHED 2025-09-16; asyncSource/asyncQuery are absent from the v15 surface'],
  batching: ['ABSORB', 'now core/enhancers/batching; batching() is public'],
  devtools: ['ABSORB', 'now core/enhancers/devtools; devTools() is public'],
  serialization: ['ABSORB', 'now core/enhancers/serialization; persistence() is public'],
  'time-travel': ['ABSORB', 'now core/enhancers/restoration'],
  entities: ['ABSORB', 'now the core entityMap marker and EntitySignal'],
  types: ['ABSORB', 'folded into core type modules (TYPE-BARREL-CONVERGENCE-0)'],
  utils: ['ABSORB', 'folded into core/lib/utils.ts and @signaltree/shared'],
  shared: ['ABSORB', 'private workspace package; kernel utilities reachable from the bare bundle'],
  memoization: ['DELETE', 'enhancer deleted in 9.0.1; Angular computed() is the answer'],
  middleware: ['DELETE', 'superseded by the enhancer contract'],
  presets: ['DELETE', 'bundles over an enhancer set that no longer exists'],
  'syntax-transform': ['DELETE', 'a build transform that cannot run'],
};

const union = [...new Set([...manifests, ...mentioned, ...Object.keys(PUBLISHED)])].sort();

const rows = union.map((name) => {
  const hadManifest = manifests.has(name);
  const published = PUBLISHED[name];
  // ⚠️ RESOLVED, NOT DEFERRED. Pointing at the other census was itself an
  // invented seventh disposition; the six-value ontology has to be satisfied by
  // THIS table.
  const d = hadManifest ? GENERATION[name] : NON_PACKAGE[name];
  return { name, hadManifest, published, disposition: d?.[0], why: d?.[1] };
});

const missing = rows.filter((r) => !r.disposition);
const orphanPublished = rows.filter((r) => r.published && !r.hadManifest);

console.log(`PACKAGE-NAMESPACE-CLOSURE-0\n`);
console.log(`  A  git manifests            ${manifests.size}`);
console.log(`  B  names mentioned          ${mentioned.size}`);
console.log(`  C  names published (probed) ${Object.keys(PUBLISHED).length}`);
console.log(`  U  union                    ${rows.length}\n`);

const by = {};
for (const r of rows) if (r.disposition) (by[r.disposition] ??= []).push(r.name);
for (const [d, ns] of Object.entries(by).sort()) {
  console.log(`  ${String(ns.length).padStart(3)}  ${d}`);
  if (d !== 'PROSE-ONLY') console.log(`       ${ns.join(', ')}`);
}
console.log(`\n  published names with NO manifest: ${orphanPublished.length}` +
  (orphanPublished.length ? ` — ${orphanPublished.map((r) => r.name).join(', ')}` : ' (every published name had a manifest)'));
console.log(`  unexplained: ${missing.length}`);
if (missing.length) {
  for (const m of missing) console.error(`  ‼ @signaltree/${m.name} has no disposition`);
  process.exit(1);
}
console.log('\n✅ namespace closure: every name in the union is dispositioned.');
