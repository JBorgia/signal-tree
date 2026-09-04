#!/usr/bin/env node
/**
 * Every `@signaltree/*` symbol named in a shipped README must actually exist.
 *
 * ## Why this is narrower than lint-skills, on purpose
 *
 * `lint-skills.mjs` type-checks whole code blocks, which is the right bar for
 * `docs/skills/**` because those are written to be compiled. Pointing it at the
 * package READMEs produces ~170 errors, and almost all of them are the linter's
 * own model rather than doc defects: it concatenates every block in a file into
 * one scope, so a README that declares `const tree` in five examples reports
 * four redeclarations. Gating on that number would mean a permanently red gate,
 * and a permanently red gate teaches people to ignore gates.
 *
 * So this checks the ONE thing that is unambiguous and that actually burns a
 * user: does the symbol exist in the package the README says to import it from?
 * A reader copying an import that resolves to nothing is a broken first
 * experience, and READMEs ship inside the npm tarball.
 *
 * ## What it found the first time it ran
 *
 * Thirteen dead references across four shipped READMEs — `effects()` documented
 * with a full example and a note that "removal is planned", years after it was
 * removed; `bindFormToTree` in an example two paragraphs below prose correctly
 * naming `formBridge`; three guardrails functions that never existed at all;
 * `assertEventMatches` / `assertEventSequence` / `createTestEventBatch` against
 * a testing entry point that exports `createEventAssertions`; and
 * `createWizardForm`, which turned out to be implemented, documented, and
 * exported from nowhere.
 *
 * Usage:
 *   node scripts/lint-readme-apis.mjs
 *   node scripts/lint-readme-apis.mjs --list
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Package → the built declaration entry for each of its subpaths. */
function entryPoints(pkg) {
  const base = join(ROOT, 'dist/packages', pkg);
  const out = new Map();
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(base, 'package.json'), 'utf8'));
  } catch {
    return out;
  }
  for (const [subpath, value] of Object.entries(manifest.exports ?? {})) {
    if (subpath.endsWith('package.json') || subpath.includes('*')) continue;
    const declared =
      typeof value === 'string' ? null : value.types ?? value.default?.types;
    if (typeof declared !== 'string') continue;
    const file = join(base, declared);
    if (existsSync(file)) {
      const spec =
        subpath === '.' ? manifest.name : `${manifest.name}${subpath.slice(1)}`;
      out.set(spec, file);
    }
  }
  return out;
}

const ENTRYPOINTS = new Map();
for (const pkg of readdirSync(join(ROOT, 'dist/packages'))) {
  for (const [spec, file] of entryPoints(pkg)) ENTRYPOINTS.set(spec, file);
}

/** Exported names of a declaration file, following local and package re-exports. */
function exportsOf(file, seen = new Set(), out = new Set()) {
  if (!file || seen.has(file) || !existsSync(file)) return out;
  seen.add(file);
  const sf = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );
  for (const s of sf.statements) {
    const mods = ts.canHaveModifiers(s) ? ts.getModifiers(s) ?? [] : [];
    if (mods.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) {
      out.add('default');
    }
    if (mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
      if (ts.isVariableStatement(s)) {
        for (const d of s.declarationList.declarations)
          if (ts.isIdentifier(d.name)) out.add(d.name.text);
      } else if (s.name && ts.isIdentifier(s.name)) out.add(s.name.text);
    }
    if (ts.isExportDeclaration(s)) {
      if (s.exportClause && ts.isNamedExports(s.exportClause)) {
        for (const e of s.exportClause.elements) out.add(e.name.text);
        continue;
      }
      const spec = s.moduleSpecifier?.text;
      if (spec?.startsWith('.')) {
        const base = resolve(dirname(file), spec);
        for (const c of [`${base}.d.ts`, join(base, 'index.d.ts')])
          if (existsSync(c)) {
            exportsOf(c, seen, out);
            break;
          }
      } else if (spec && ENTRYPOINTS.has(spec)) {
        exportsOf(ENTRYPOINTS.get(spec), seen, out);
      }
    }
  }
  return out;
}

const SURFACE = new Map();
for (const [spec, file] of ENTRYPOINTS) SURFACE.set(spec, exportsOf(file));
if (SURFACE.size === 0) {
  console.error('✗ no built packages found — run `npm run build:all` first.');
  process.exit(1);
}

/**
 * Documents that DESCRIBE THE PAST are exempt, and the distinction is the whole
 * reason this check can be green.
 *
 * A migration guide's "before" block is *supposed* to name an API that no longer
 * exists — that is what the reader is migrating away from. Same for an RFC, an
 * audit, or a learnings write-up: they record what was true when written. Twenty
 * of the first thirty-one hits were exactly this, and "fixing" them would have
 * meant deleting the evidence a migration guide exists to show.
 *
 * What is NOT exempt is anything a reader follows as current advice — the
 * guides, the architecture docs, and above all `docs/ai/**`, which becomes the
 * `llms.txt` that ships in the core tarball. A dead API there is one an agent
 * will generate.
 */
const HISTORICAL_DIRS = new Set(['archive', 'rfcs', 'audits', 'learnings']);
const HISTORICAL_FILE = /migration|MIGRATION|CHANGELOG|HANDOFF/;

/** Everything a user or an agent reads: shipped READMEs plus all of docs/. */
function markdownUnder(dir, out = []) {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return out;
  for (const name of readdirSync(abs, { withFileTypes: true })) {
    const rel = `${dir}/${name.name}`;
    if (name.isDirectory()) {
      if (HISTORICAL_DIRS.has(name.name) || name.name === 'node_modules')
        continue;
      markdownUnder(rel, out);
    } else if (name.name.endsWith('.md') && !HISTORICAL_FILE.test(rel)) {
      out.push(rel);
    }
  }
  return out;
}

const READMES = [
  'README.md',
  // llms.txt ships inside the core tarball (prepare-publish-artifacts.mjs) and
  // is the AI-facing surface an agent reads first — it gets the same
  // dead-import and retired-API scan as every shipped README, not a pass.
  'llms.txt',
  ...readdirSync(join(ROOT, 'packages'))
    .map((p) => `packages/${p}/README.md`)
    .filter((f) => existsSync(join(ROOT, f))),
  ...markdownUnder('docs'),
];

/** Static SignalTree imports inside examples: named, default, namespace, or side-effect. */
const IMPORT =
  /^[ \t]*import[ \t]+(?:type[ \t]+)?(\{[^}]*\}|\*[ \t]+as[ \t]+[$\w]+|[$\w]+(?:[ \t]*,[ \t]*(?:\{[^}]*\}|\*[ \t]+as[ \t]+[$\w]+))?)[ \t]+from[ \t]*['"](@(?:signal-tree|signaltree)\/[^'"]+)['"][ \t]*;?|^[ \t]*import[ \t]*['"](@(?:signal-tree|signaltree)\/[^'"]+)['"][ \t]*;?/gm;

function inspectImports(text, rel) {
  const problems = [];
  let checked = 0;
  const lines = text.split('\n');
  for (const m of text.matchAll(IMPORT)) {
    const clause = m[1] ?? '';
    const spec = m[2] ?? m[3];
    const surface = SURFACE.get(spec);
    const line = text.slice(0, m.index).split('\n').length;
    const previousLine = lines[line - 2] ?? '';
    const context = lines.slice(Math.max(0, line - 4), line).join('\n');
    // One explicit marker exempts exactly the next import, never a whole block.
    if (
      /@skip-lint-next-import\b/.test(previousLine) ||
      /```ts\s+(wrong|bad)/.test(context)
    ) {
      continue;
    }

    if (!surface) {
      problems.push({ rel, line, name: '(package)', spec });
      continue;
    }

    if (!clause) {
      checked++;
      continue;
    }

    if (/^\*[ \t]+as[ \t]+[$\w]+$/.test(clause.trim())) {
      checked++;
      continue;
    }

    const defaultBinding = clause
      .trim()
      .match(/^([$A-Z_a-z][$\w]*)\s*(?:,|$)/)?.[1];
    if (defaultBinding) {
      checked++;
      if (!surface.has('default')) {
        problems.push({ rel, line, name: '(default)', spec });
      }
    }

    const named = clause.match(/\{([\s\S]*?)\}/)?.[1];
    if (!named) continue;
    for (const raw of named.split(',')) {
      const name = raw
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)[0]
        .trim();
      if (!name) continue;
      checked++;
      if (!surface.has(name)) {
        const near = [...surface].find(
          (s) =>
            s.toLowerCase().includes(name.toLowerCase().slice(0, 6)) &&
            s !== name
        );
        problems.push({ rel, line, name, spec, near });
      }
    }
  }
  return { problems, checked };
}

if (process.argv.includes('--self-test')) {
  const clean = inspectImports(
    "import { signalTree } from '@signal-tree/kernel';",
    '<clean-fixture>'
  );
  const cleanNamespace = inspectImports(
    "import * as kernel from '@signal-tree/kernel';",
    '<namespace-fixture>'
  );
  const cleanSideEffect = inspectImports(
    "import '@signal-tree/kernel';",
    '<side-effect-fixture>'
  );
  const invalidDefault = inspectImports(
    "import kernel from '@signal-tree/kernel';",
    '<default-fixture>'
  );
  const staleForms = [
    "import { signalTree } from '@signaltree/core';",
    "import legacy from '@signaltree/core';",
    "import * as legacy from '@signaltree/core';",
    "import '@signaltree/core';",
  ];
  const stale = staleForms.map((fixture) =>
    inspectImports(fixture, '<stale-fixture>')
  );
  const narrowExemption = inspectImports(
    '// @skip-lint-next-import — historical evidence\n' +
      "import legacy from '@signaltree/core';\n" +
      "import another from '@signaltree/core';",
    '<exemption-fixture>'
  );
  if (clean.checked !== 1 || clean.problems.length !== 0) {
    console.error('✗ self-test rejected a current kernel import.');
    process.exit(1);
  }
  if (
    cleanNamespace.checked !== 1 ||
    cleanNamespace.problems.length !== 0 ||
    cleanSideEffect.checked !== 1 ||
    cleanSideEffect.problems.length !== 0
  ) {
    console.error('✗ self-test rejected a resolvable non-named import.');
    process.exit(1);
  }
  if (
    invalidDefault.checked !== 1 ||
    invalidDefault.problems.length !== 1 ||
    invalidDefault.problems[0].name !== '(default)'
  ) {
    console.error('✗ self-test accepted an unavailable default export.');
    process.exit(1);
  }
  if (
    stale.some(
      (result) =>
        result.problems.length !== 1 ||
        result.problems[0].spec !== '@signaltree/core'
    )
  ) {
    console.error('✗ self-test accepted a retired package import form.');
    process.exit(1);
  }
  if (
    narrowExemption.problems.length !== 1 ||
    narrowExemption.problems[0].line !== 3
  ) {
    console.error(
      '✗ self-test allowed an import exemption to escape its line.'
    );
    process.exit(1);
  }
  if (
    !isHistoricalDocument(
      '# Record\n<!-- @historical-api-examples -->\n**Status:** audit.'
    ) ||
    isHistoricalDocument(
      '# Current guide\n<!-- @historical-api-examples -->\nCurrent guidance.'
    ) ||
    isHistoricalDocument(
      `**Status:** audit.\n${'evidence\n'.repeat(
        10
      )}<!-- @historical-api-examples -->`
    )
  ) {
    console.error(
      '✗ self-test accepted an unscoped or late historical-document marker.'
    );
    process.exit(1);
  }
  if (
    !teachingRegions('Current prose teaches `stored()` here.').some((region) =>
      region.text.includes('stored()')
    )
  ) {
    console.error('✗ self-test failed to inspect API-shaped prose.');
    process.exit(1);
  }
  console.log(
    '✓ self-test covers current, named, default, namespace, side-effect, and narrowly exempted imports.'
  );
  process.exit(0);
}

const problems = [];
let checked = 0;

for (const rel of READMES) {
  const result = inspectImports(readFileSync(join(ROOT, rel), 'utf8'), rel);
  checked += result.checked;
  problems.push(...result.problems);
}

console.log(
  `Checked ${checked} imported symbol(s) across ${READMES.length} README(s) ` +
    `against ${SURFACE.size} built entry point(s).`
);

if (process.argv.includes('--list')) {
  for (const [spec, names] of SURFACE)
    console.log(`  ${spec}: ${names.size} exports`);
}

if (problems.length) {
  console.error(
    `\n✗ ${problems.length} symbol(s) named in a README do not exist:\n`
  );
  for (const p of problems) {
    console.error(
      `    ${p.rel}:${p.line}  '${p.name}' is not exported by ${p.spec}` +
        (p.near ? `  (did you mean '${p.near}'?)` : '')
    );
  }
  console.error(
    `\nREADMEs ship inside the npm tarball, so this is the first thing a user\n` +
      `copies. Either fix the name, or export the symbol if the docs are right\n` +
      `and the barrel is wrong — that is how createWizardForm was found.`
  );
  process.exit(1);
}

console.log(
  '✓ every SignalTree package and symbol imported in current docs exists.'
);

/* ══════════════════════════════════════════════════════════════════════════
 * RETIRED APIs MAY NOT BE TAUGHT.        AI-DOC-SURFACE-GATE-0
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ WHY THE IMPORT CHECK ABOVE WAS NOT ENOUGH, measured rather than assumed.
 * That check already walks all of `docs/`, `docs/ai/LLM.md` included — and it
 * still passed while LLM.md taught `stored(key, default)` in a marker table,
 * taught the retired `status<E>()` beside it, and named `serialization()` as
 * the persistence enhancer when `serialization` is not exported at all.
 *
 * It passed because it only inspects IMPORT STATEMENTS. A table row teaches
 * without importing, and so does a code block that assumes the import. An agent
 * reading a table of markers needs no import line to be misled — and the
 * AI-facing document is the one an agent reads FIRST.
 *
 *     A DOC TEACHES BY EXAMPLE, NOT BY IMPORT.
 *
 * So this second pass looks for CALL SITES of names that are known to be gone.
 * It is deliberately a denylist rather than "every identifier must resolve":
 * doc examples legitimately call application-owned helpers, and a checker that
 * flagged those would be permanently red — which teaches people to ignore gates,
 * the exact failure this file's header already warns about.
 *
 * PROSE IS ALLOWED. "the old `stored()` marker is deleted" is a correct thing
 * for a migration note to say, so only fenced code blocks and API-table rows
 * count as teaching.
 */
/**
 * ⚠️ WITHDRAWN IS NOT RETIRED, and live docs must not advertise either.
 *
 * These are IMPLEMENTED and deliberately NOT EXPORTED — `compared` was pulled
 * from the RC surface at `76ab032c`, `loader` is absent by the same decision
 * (packages/kernel/README.md says so in prose). A user cannot import any of them.
 *
 * Retired means "the code is gone"; withdrawn means "the code is here and you
 * cannot have it". For a READER the difference is nil — following either leads
 * to an import that does not resolve — which is why both are checked, with
 * different wording so the fix is obvious: a retired name must be rewritten, a
 * withdrawn one is a product decision about whether to ship the capability.
 *
 * ⚠️ THIS LIST EXISTS BECAUSE A COMPETITIVE DOCUMENT MADE A CLAIM WE COULD NOT
 * HONOUR. `docs/compare/capability-matrix.md` listed "Per-leaf equality —
 * `compared()` / `byKeys()`" as a SignalTree capability that other libraries
 * lack, and its "Markers as one concept" bullet named six markers of which five
 * were unreachable.
 */
const WITHDRAWN = new Map([]);

const RETIRED = new Map([
  ['stored', 'deleted — keep persistence application-owned'],
  ['flushAllStoredSignals', 'deleted with `stored()`'],
  ['createStoredSignal', 'deleted with `stored()`'],
  ['isStoredMarker', 'deleted with `stored()`'],
  ['createStorageKeys', 'deleted with `stored()`'],
  ['clearStoragePrefix', 'deleted with `stored()`'],
  ['status', 'deleted — model loading state as ordinary tree state'],
  ['asyncSource', 'deleted — application-owned async + `external()`'],
  ['asyncQuery', 'deleted — application-owned async + `external()`'],
  ['effects', 'removed years ago'],
  ['withPersistence', 'deleted — keep persistence application-owned'],
  ['persistence', 'deleted — keep persistence application-owned'],
  ['serialization', 'deleted — keep serialization application-owned'],
  [
    'loader',
    "DELETED — link(tree.$.rows, endpoint); caching is the endpoint's job",
  ],
  ['invalidateTag', 'DELETED with `loader()`'],
  ['compared', 'DELETED — see PER-LOCATION-EQUALITY-0'],
  ['byKeys', 'DELETED with `compared()`'],
  ['linked', "deleted — use Angular's `linkedSignal()` in the derived factory"],
  ['derivedFrom', 'deleted — type an external derived factory with `TreeNode`'],
  ['form', 'deleted — use framework forms or ordinary state'],
  ['createEditSession', 'deleted — keep bounded drafts in application state'],
  ['onHydrateDecision', 'DELETED — nothing declines hydration any more'],
]);

/**
 * ⚠️ `derived` IS DELIBERATELY ABSENT FROM BOTH LISTS, and the reason is a limit
 * of the technique rather than an oversight.
 *
 * The old `derived()` MARKER and fluent `.derived()` method are both deleted,
 * but a free call still collides with an ordinary application-local function
 * named `derived`. This denylist therefore handles retired free functions while
 * the explicit retired-method scan below handles `.derived()`.
 *
 *     A NAME-BASED GATE CANNOT OUTLIVE A NAME COLLISION. Listing it anyway would
 *     buy nothing and cost two false positives in the most-read docs — and a
 *     gate that cries wolf is the failure this file's header already warns about.
 */

/**
 * ⚠️ THE DENYLIST'S OWN CONTROL. A denylist rots silently: if a name is ever
 * re-introduced, every entry naming it becomes a lie that still passes. So each
 * entry is asserted ABSENT from the built surface. Re-adding an API makes this
 * gate fail loudly and demands the entry be removed on purpose.
 */
const reachableNames = new Set();
for (const names of SURFACE.values())
  for (const n of names) reachableNames.add(n);
const stale = [...RETIRED.keys(), ...WITHDRAWN.keys()].filter((n) =>
  reachableNames.has(n)
);
if (stale.length > 0) {
  console.error(
    `\n✗ the RETIRED denylist is out of date — these are reachable again:\n` +
      stale.map((n) => `    ${n}`).join('\n') +
      `\n\n  Remove them from RETIRED/WITHDRAWN in scripts/lint-readme-apis.mjs. An\n  entry` +
      `  that names a live API silently stops protecting anything.\n`
  );
  process.exit(1);
}

/** Fenced code blocks, plus rows of a table whose first cell is a signature. */
function teachingRegions(text) {
  const out = [];
  const fence = /```[\s\S]*?```/g;
  for (const m of text.matchAll(fence)) {
    out.push({ text: m[0], line: text.slice(0, m.index).split('\n').length });
  }
  // ⚠️ ANY TABLE ROW, not just one whose first cell is a signature.
  //
  // The first version matched `/^\|\s*`([^`]+)`\s*\|/` — a row STARTING with a
  // backticked name. It passed clean while docs/compare/capability-matrix.md
  // advertised "**Per-leaf equality** — `compared()` / `byKeys()`" as a
  // SignalTree capability other libraries lack, because that cell opens with
  // prose. A capability table is the most load-bearing kind of teaching there
  // is: it is what a prospective user compares libraries with.
  const lines = text.split('\n');
  let inFence = false;
  lines.forEach((l, i) => {
    if (l.trimStart().startsWith('```')) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    if (l.trimStart().startsWith('|') || /`[$A-Z_a-z][$\w]*\s*[(<]/.test(l)) {
      out.push({ text: l, line: i + 1 });
    }
  });
  return out;
}

/**
 * ⚠️ A RECORD IS NOT A LESSON. `docs/research/**` contains exploratory records.
 * A document outside `docs/research` must opt in visibly near its title. The
 * marker classifies API examples as evidence; it does not make prose override
 * current manifests, types, or release decisions.
 * A visible role such as audit, research, decision record, or historical is
 * also required; adding the marker to a current guide is not sufficient.
 *
 * Architecture documents are current unless a local example is explicitly
 * marked historical. A directory name may not exempt current architecture.
 */
const RECORD_DIRS = /^docs\/research\//;
function isHistoricalDocument(text) {
  const heading = text.split('\n').slice(0, 10).join('\n');
  const role = heading.replace(/<!--\s*@historical-api-examples\s*-->/g, '');
  return (
    /<!--\s*@historical-api-examples\s*-->/.test(heading) &&
    /\b(historical|audit|research|competitive analysis|gap analysis|design note|ledger|checkpoint|decision record|discovery|append-only)\b/i.test(
      role
    )
  );
}

const taught = [];
for (const rel of READMES) {
  const text = readFileSync(join(ROOT, rel), 'utf8');
  if (RECORD_DIRS.test(rel) || isHistoricalDocument(text)) continue;
  for (const region of teachingRegions(text)) {
    if (/@skip-lint-(?:block|line)\b/.test(region.text)) continue;
    // ⚠️ EXPLAINING IS NOT TEACHING, and widening to whole table rows made this
    // necessary immediately: a row reading "Withdrawn: its subject, the
    // `stored()` marker, is deleted" is the CORRECT thing for an index to say,
    // and the first widened run flagged it. A row that announces the removal is
    // doing this gate's job, not violating it.
    if (
      /\b(deleted|removed|withdrawn|retired|no longer|not part of|does not exist|gone)\b/i.test(
        region.text
      )
    ) {
      continue;
    }
    for (const [name, why] of [...RETIRED, ...WITHDRAWN]) {
      // A FREE call site — not a bare mention in prose, and not a METHOD.
      //
      // ⚠️ `(?<![.\w])` is load-bearing and was earned immediately: without it
      // `derived` matched `.derived(`, the live tree method, and reported ten
      // false positives across the docs. The dead `derived()` MARKER and the
      // live `.derived()` FEATURE share a word — which is exactly why the marker
      // survived nine major versions after its factory was removed.
      if (new RegExp(`(?<![.\\w])${name}\\s*[(<]`).test(region.text)) {
        taught.push({ rel, line: region.line, name, why });
      }
    }
  }
}

if (taught.length > 0) {
  console.error(
    `\n✗ ${taught.length} live doc example(s) teach an API no user can reach:\n`
  );
  for (const t of taught) {
    console.error(`  ${t.rel}:${t.line}  ${t.name}()  — ${t.why}`);
  }
  console.error(
    `\n  Live docs may not teach APIs that no longer exist. Prose may NAME one\n` +
      `  (a migration note should), but an example or an API table must not.\n`
  );
  process.exit(1);
}
console.log(
  `✓ no live doc example teaches any of the ${RETIRED.size} retired or ` +
    `${WITHDRAWN.size} withdrawn API(s).`
);
