#!/usr/bin/env node
/**
 * Every example a live document teaches must USE the API the way its types
 * allow — not merely name a symbol that exists somewhere.
 *
 * ## The gap this fills, and the defect that earned it
 *
 * Four gates already ask about documented API and none asks this question:
 *
 *   lint-readme-apis      does this SYMBOL exist in some built entry point?
 *   find-dead-exports     is this symbol reachable from barrels or repo imports?
 *   documented-imports    can a user import the documented SPECIFIER at all?
 *   documented-symbols    does a barrel's API-SUMMARY advertise what it exports?
 *   MISSING               does the EXAMPLE AS WRITTEN still typecheck?
 *
 * `scripts/lint-readme-apis.mjs` says in its own header that block-level
 * typechecking is `lint-skills.mjs`'s job. `lint-skills.mjs` and `docs/skills/`
 * were both deleted. Nothing inherited the responsibility, so no documented code
 * block has been typechecked since.
 *
 * What that permitted, found the first time this ran: `packages/kernel/ENHANCERS.md`
 * — a file that SHIPS INSIDE THE KERNEL TARBALL — taught `.with()` chaining as
 * the current composition API, with prose insisting "Chain `.with()` instead; it
 * is not a workaround, it is the path that preserves the types." `.with()` was
 * deleted in 15.0 and replaced by `signalTree(state, { enhancers: [...] })`. The
 * same file taught `withTimeTravel`, which is exported from nowhere. Every other
 * gate stayed green: the specifier `@signal-tree/kernel` resolves, and
 * `signalTree`, `batching` and `devTools` all exist. None of them ask whether
 * `.with()` is still a method.
 *
 * ## Why per-block isolation, and why the bar is narrow
 *
 * lint-readme-apis records why the previous attempt was abandoned: pointed at the
 * package READMEs it produced ~170 errors, "almost all of them the linter's own
 * model rather than doc defects", because it concatenated every block in a file
 * into one scope and reported a `const tree` declared in five examples as four
 * redeclarations. That was a TOOLING defect, not a documentation defect. This
 * gate compiles each block as its own module, which removes that entire class.
 *
 * The remaining ambiguity is deliberate elision: illustrative snippets reference
 * an `api`, a `tree` or a `User` they never declare, and omit parameter types for
 * brevity. Those are not defects, so unresolved names (TS2304) and implicit `any`
 * (TS7006) are NEVER reported. Because a missing local poisons the type of
 * everything downstream of it, property-level errors are suppressed in any block
 * that has one — a `.count` on an undeclared `tree` says nothing about `.count`.
 *
 * What survives is the unambiguous class: the module does not export this, the
 * thing you imported is not callable, it does not take that many arguments, or
 * a fully-resolved value has no such property.
 *
 *   node tools/check-documented-examples.mjs
 *   node tools/check-documented-examples.mjs --list
 *   node tools/check-documented-examples.mjs --self-test
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Documents whose examples are LIVE INSTRUCTIONS. Everything else — archives,
 * audits, RFCs, changelogs, release notes — records what was true at a point in
 * time. Excluded by PATH, never by inspecting a snippet and guessing.
 *
 * Kept deliberately in step with `tools/check-documented-imports.mjs`: the two
 * gates ask different questions about the same set of live documents.
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

/**
 * A migration guide's whole job is to show the OLD call beside the new one, so
 * its examples legitimately name deleted APIs. Excluded by NAME, matching
 * `check-documented-imports.mjs`, rather than by inspecting the snippet.
 */
const isMigrationGuide = (rel) => /migration/i.test(rel);

/** Always reported: these describe the imported API itself. */
const IMPORT_SHAPE = new Set([
  2305, // module has no exported member
  2349, // this expression is not callable
  2554, // expected N arguments, but got M
]);

/**
 * Reported only when every name in the block resolved. A property error on a
 * value whose type is already `unknown` because its declaration was elided is
 * a statement about the elision, not about the API.
 */
const PROPERTY_SHAPE = new Set([
  2339, // property does not exist on type
  2551, // property does not exist ... did you mean
]);

/** A block with any of these has elided context; its property errors are noise. */
const POISONS_TYPES = new Set([
  2304, // cannot find name
  2307, // cannot find module
]);

function collect(target) {
  const abs = join(ROOT, target);
  if (!existsSync(abs)) return [];
  if (statSync(abs).isFile()) return [target];
  return readdirSync(abs).flatMap((entry) => collect(join(target, entry)));
}

function liveDocuments() {
  return LIVE_DOCS.flatMap(collect)
    .filter((rel) => rel.endsWith('.md'))
    .filter((rel) => !isMigrationGuide(rel));
}

/**
 * Package specifier → source entry. Resolved against source rather than
 * `dist/`: whether the export MAP is right is `documented-imports`' question,
 * and a stale or partially built `dist/` would otherwise report every example
 * in the repository as broken.
 */
function packagePaths() {
  const paths = {};
  for (const pkg of readdirSync(join(ROOT, 'packages'))) {
    const src = join(ROOT, 'packages', pkg, 'src');
    if (!existsSync(join(src, 'index.ts'))) continue;
    paths[`@signal-tree/${pkg}`] = [join(src, 'index.ts')];
    for (const sub of ['adapter', 'internals']) {
      if (existsSync(join(src, `${sub}.ts`)))
        paths[`@signal-tree/${pkg}/${sub}`] = [join(src, `${sub}.ts`)];
    }
  }
  return paths;
}

/**
 * Blocks that teach an import from this project. A snippet with no
 * `@signal-tree/*` import is illustrating something else — a framework API, a
 * shell command, a competitor's code in a comparison — and is not ours to gate.
 */
function examplesIn(rel) {
  const source = readFileSync(join(ROOT, rel), 'utf8');
  const fence = /```(tsx|ts|typescript)\n([\s\S]*?)```/g;
  const found = [];
  let match;
  let index = 0;
  while ((match = fence.exec(source))) {
    index += 1;
    const code = match[2];
    if (!/from\s+['"]@signal-tree\//.test(code)) continue;
    found.push({
      file: rel,
      index,
      code,
      tsx: match[1] === 'tsx',
      line: source.slice(0, match.index).split('\n').length,
    });
  }
  return found;
}

function compilerOptions(paths) {
  return {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    baseUrl: ROOT,
    paths,
    types: [],
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
  };
}

/** Diagnostics for one block, compiled as its own module. */
function diagnose(block, options) {
  const virtual = join(
    ROOT,
    `__documented_example_${block.file.replace(/[/.]/g, '_')}_${block.index}.${
      block.tsx ? 'tsx' : 'ts'
    }`
  );
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (name, languageVersion, onError, shouldCreate) =>
    name === virtual
      ? ts.createSourceFile(
          name,
          block.code,
          languageVersion,
          true,
          block.tsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS
        )
      : getSourceFile(name, languageVersion, onError, shouldCreate);
  host.fileExists = (name) =>
    name === virtual ? true : ts.sys.fileExists(name);
  host.readFile = (name) =>
    name === virtual ? block.code : ts.sys.readFile(name);

  const program = ts.createProgram([virtual], options, host);
  const all = ts
    .getPreEmitDiagnostics(program)
    .filter((d) => d.file?.fileName === virtual);
  const elided = all.some((d) => POISONS_TYPES.has(d.code));
  return all.filter(
    (d) => IMPORT_SHAPE.has(d.code) || (!elided && PROPERTY_SHAPE.has(d.code))
  );
}

function describe(diagnostic) {
  const text = ts
    .flattenDiagnosticMessageText(diagnostic.messageText, ' ')
    .replace(/\s+/g, ' ');
  return `TS${diagnostic.code}: ${text}`;
}

function run({ list = false } = {}) {
  const paths = packagePaths();
  const options = compilerOptions(paths);
  const documents = liveDocuments();
  const blocks = documents.flatMap(examplesIn);
  const failures = [];

  for (const block of blocks) {
    const diagnostics = diagnose(block, options);
    if (list) {
      console.log(
        `${block.file}:${block.line} block #${block.index}${
          diagnostics.length ? '  FAIL' : '  ok'
        }`
      );
    }
    if (diagnostics.length)
      failures.push({ block, diagnostics: diagnostics.map(describe) });
  }

  if (failures.length) {
    console.error(
      `\n${failures.length} documented example(s) no longer typecheck against the API they teach:\n`
    );
    for (const { block, diagnostics } of failures) {
      console.error(`  ${block.file}:${block.line} (block #${block.index})`);
      for (const line of diagnostics) console.error(`      ${line}`);
      console.error('');
    }
    console.error(
      'Fix the example, or move the document out of LIVE_DOCS if it is a historical record.\n'
    );
    return 1;
  }

  console.log(
    `documented-examples: ${blocks.length} example(s) across ${documents.length} live document(s) typecheck against the API they teach.`
  );
  return 0;
}

/**
 * The gate must be able to fail, and must not fail for the reasons the previous
 * attempt did. Each case is compiled through the same pipeline as a real block.
 */
function selfTest() {
  const options = compilerOptions(packagePaths());
  const cases = [
    {
      name: 'accepts a current example',
      code: "import { signalTree } from '@signal-tree/kernel';\nconst tree = signalTree({ count: 0 });\ntree.$.count(1);\n",
      expect: 0,
    },
    {
      name: 'rejects a deleted method',
      code: "import { signalTree, batching } from '@signal-tree/kernel';\nconst tree = signalTree({ count: 0 }).with(batching());\n",
      expect: 1,
    },
    {
      name: 'rejects an unexported symbol',
      code: "import { withTimeTravel } from '@signal-tree/kernel';\nvoid withTimeTravel;\n",
      expect: 1,
    },
    {
      name: 'tolerates elided context (the ~170-error trap)',
      code: "import { asReadonly } from '@signal-tree/kernel';\nconst reader = asReadonly(tree);\nreader.$.count();\n",
      expect: 0,
    },
    {
      name: 'tolerates a repeated declaration in a separate block',
      code: "import { signalTree } from '@signal-tree/kernel';\nconst tree = signalTree({ count: 0 });\nvoid tree;\n",
      expect: 0,
    },
    {
      name: 'tolerates an untyped parameter',
      code: "import { signalTree } from '@signal-tree/kernel';\nconst tree = signalTree({ count: 0 });\ntree.$.count((value) => value + 1);\n",
      expect: 0,
    },
    {
      name: 'rejects a wrong-carrier spelling on a kernel leaf',
      code: "import { signalTree } from '@signal-tree/kernel';\nconst tree = signalTree({ count: 0 });\ntree.$.count.set(1);\n",
      expect: 1,
    },
  ];

  let failed = 0;
  for (const [index, testCase] of cases.entries()) {
    const diagnostics = diagnose(
      { file: 'self-test', index, code: testCase.code, tsx: false },
      options
    );
    const actual = diagnostics.length ? 1 : 0;
    const ok = actual === testCase.expect;
    if (!ok) failed += 1;
    console.log(
      `  ${ok ? 'ok  ' : 'FAIL'} ${testCase.name}${
        ok
          ? ''
          : ` — ${diagnostics.map(describe).join(' | ') || 'no diagnostic'}`
      }`
    );
  }
  if (failed) {
    console.error(`\nself-test: ${failed} case(s) failed\n`);
    return 1;
  }
  console.log('\nself-test: all cases behaved as specified\n');
  return 0;
}

const argv = process.argv.slice(2);
process.exit(
  argv.includes('--self-test')
    ? selfTest()
    : run({ list: argv.includes('--list') })
);
