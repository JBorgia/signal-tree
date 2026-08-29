import ts from 'typescript';

/**
 * The census's discovery mechanisms, as pure functions over source text.
 *
 * ⚠️ EXTRACTED SO THEY CAN BE PROVEN. Category accounting shows that discovered
 * subjects were not dropped between discovery and the gate. It says nothing
 * about whether a detector can SEE every shape it claims to find:
 *
 *     CATEGORY ACCOUNTING PROVES THAT DISCOVERED SUBJECTS WERE NOT DROPPED; IT
 *     DOES NOT PROVE THAT THE DISCOVERY MECHANISM CAN OBSERVE EVERY SUBJECT IT
 *     CLAIMS TO FIND.
 *
 * This census has already suffered three parser failures — comment prose
 * extracted as export names, a line comment containing `/*` swallowing 1,063
 * characters including a whole interface, and a duplicate subject key that
 * silently deduped one ruling away. Two of those returned EMPTY or WRONG results
 * that looked like facts about the repository. Hence `--self-test`: every
 * detector is pointed at a fixture with one planted instance of each shape it
 * must find, and the run fails if any comes back empty.
 */

/** Strip comments — LINE FIRST. See the census header for why the order matters. */
export const stripComments = (s) =>
  s.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

export const detectPublicValueExports = (src) =>
  [...stripComments(src).matchAll(/^export \{\s*([^}]+?)\s*\} from/gms)]
    .flatMap((m) => m[1].split(',').map((s) => s.trim()))
    .filter((s) => s && !s.startsWith('type '))
    .map((s) => s.split(/\s+as\s+/).pop().trim());

/**
 * ⚠️ TWO SPELLINGS, NOT ONE. A public type reaches the barrel either as a whole
 * type clause or as an INLINE `type` member of a value clause:
 *
 *     export type { PlantedType } from './c';                    // clause
 *     export { plantedValue, type PlantedInline } from './a';    // inline
 *
 * Only the first was matched until PUBLIC-SURFACE-CENSUS-PARITY-0, which is why
 * NINE genuinely public types — the `readonly` view family, the audit types and
 * `DefineStoreConfig` — sat outside the ownership denominator while looking
 * perfectly ordinary in `index.ts`. The value detector below was never wrong
 * about them (it filters `type ` members out), so nothing was miscounted as a
 * value; the type side simply never looked in that clause.
 *
 *     A ZERO-CONSUMER CLAIM IS ONLY AS LARGE AS THE CONSUMER UNIVERSE IT
 *     SEARCHED — and a denominator is only as large as the SPELLINGS it knows.
 */
export const detectPublicTypeExports = (src) => {
  const clean = stripComments(src);
  const fromClauses = [...clean.matchAll(/^export type \{\s*([^}]+?)\s*\} from/gms)]
    .flatMap((m) => m[1].split(',').map((s) => s.trim()))
    .filter(Boolean);
  // ⚠️ WRITTEN DIFFERENTLY FROM THE VALUE DETECTOR'S PATTERN ON PURPOSE. The
  // mutation proof mutates each family by a declared source pattern and refuses
  // ambiguous ones — sharing regex TEXT with `detectPublicValueExports` made
  // that pattern match twice and the publicValueExport family unprovable.
  const inlineMembers = [...clean.matchAll(/^export \{([^}]+)\} from/gm)]
    .flatMap((m) => m[1].split(',').map((s) => s.trim()))
    .filter((s) => s.startsWith('type '))
    .map((s) => s.slice('type '.length).trim());
  return [...fromClauses, ...inlineMembers].map((s) => s.split(/\s+as\s+/).pop().trim());
};

export const detectInterfaceFields = (src, name) => {
  const m = stripComments(src).match(
    new RegExp(`export interface ${name}[^{]*\\{([\\s\\S]*?)\\n\\}`)
  );
  return m
    ? [...m[1].matchAll(/^\s{2}(?:readonly\s+)?([a-zA-Z_][\w]*)\??\s*[:(]/gm)].map((x) => x[1])
    : [];
};

export const detectCapabilities = (src) =>
  [
    ...[...src.matchAll(/hasCapability\(\s*'([^']+)'|capabilities:\s*\[([^\]]*)\]/g)]
      .flatMap((m) => (m[1] ? [m[1]] : (m[2] ?? '').split(',')))
      .map((s) => s.replace(/['"\s]/g, ''))
      .filter(Boolean),
  ];

export const detectMarkerRegistration = (src) =>
  /registerBuiltinMarkerProcessor|registerMarkerProcessor/.test(src);

/**
 * TOP-LEVEL BINDING discovery, via the TypeScript AST.
 *
 * ⚠️ THE REGEX VERSION WAS A SUBSET PRETENDING TO BE A DOMAIN. It matched three
 * initializer shapes — `= new X(...)`, `= {...}`, and a bare `let x: T;` — and
 * therefore could not see any of:
 *
 *     let enabled = true;          let revision = 0;
 *     let current = null;          let runtime = createRuntime();
 *     let stack = [];              const cache = signal(...);
 *     const registry = createRegistry();   const listeners = [];
 *
 * all of which are ordinary ways to hold module-level authority. Its positive
 * controls proved the three shapes it already knew about, which is exactly the
 * false confidence this census exists to prevent — and it was about to be the
 * evidence behind "MODULE-STATE-OWNERSHIP-0: 29 subjects".
 *
 *     FOR HIDDEN AUTHORITY DISCOVERY, OVER-INCLUSION IS CHEAPER THAN SILENT
 *     EXCLUSION.
 *
 *     A MODULE BINDING MAY BE DECLINED AFTER DISCOVERY; IT MUST NOT DISAPPEAR
 *     BECAUSE ITS INITIALIZER SHAPE WAS UNEXPECTED.
 *
 * So discovery no longer inspects initializers at all: every top-level `let`,
 * `var` and `const` is DISCOVERED, and the initializer only informs a later,
 * recorded decision to decline. Nested and function-local bindings are excluded
 * because they cannot be module authority — proven by a negative control.
 */
export function detectTopLevelBindings(src, fileName = 'x.ts') {
  const sf = ts.createSourceFile(fileName, src, ts.ScriptTarget.Latest, true);
  const out = [];
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    // ⚠️ `declare` IS NOT STATE. `declare const treeIdBrand: unique symbol` and
    // `declare let ngDevMode` are AMBIENT — type-level brands and a compile-time
    // flag, emitting nothing. Discovery still reports them (silence is how
    // subjects vanish); they are ANNOTATED so a ruling can dismiss them once,
    // rather than seven copies of `ngDevMode` masquerading as authority.
    const ambient = Boolean(
      stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.DeclareKeyword)
    );
    const flags = stmt.declarationList.flags;
    const kind =
      flags & ts.NodeFlags.Const ? 'const' : flags & ts.NodeFlags.Let ? 'let' : 'var';
    for (const d of stmt.declarationList.declarations) {
      const names = [];
      const collect = (name) => {
        if (ts.isIdentifier(name)) names.push(name.text);
        else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name))
          for (const el of name.elements)
            if (ts.isBindingElement(el)) collect(el.name);
      };
      collect(d.name);
      const init = d.initializer;
      for (const name of names)
        out.push({
          name,
          kind,
          init: init ? initShape(init) : 'uninitialised',
          // A `const` bound to a literal primitive cannot be reassigned and
          // cannot hold changing authority. Recorded, then declined by the
          // census — never silently dropped.
          ambient,
          immutablePrimitive:
            kind === 'const' && Boolean(init) && isLiteralPrimitive(init),
        });
    }
  }
  return out;
}

function isLiteralPrimitive(node) {
  return (
    ts.isStringLiteral(node) ||
    ts.isNumericLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword ||
    (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand))
  );
}

function initShape(node) {
  if (ts.isNewExpression(node)) return `new ${node.expression.getText?.() ?? '?'}`;
  if (ts.isCallExpression(node)) return `${node.expression.getText?.() ?? '?'}()`;
  if (ts.isObjectLiteralExpression(node)) return 'object literal';
  if (ts.isArrayLiteralExpression(node)) return 'array literal';
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return 'function';
  if (isLiteralPrimitive(node)) return `literal ${node.getText?.() ?? ''}`.trim();
  if (node.kind === ts.SyntaxKind.NullKeyword) return 'null';
  if (ts.isIdentifier(node) && node.text === 'undefined') return 'undefined';
  return ts.SyntaxKind[node.kind];
}

const PIPELINE_VERB =
  /(classify|intercept|mutate|publish|record|restore|reconcile|notify|emit|commit|materialize|activate|deactivate|invalidate|subscribe)/i;
/**
 * ⚠️ `export` IS OPTIONAL HERE, DELIBERATELY. This used to require
 * `^export function`, which made behavioural discovery depend on an API
 * modifier: de-exporting six same-file-only helpers in the 15.0 orphan sweep
 * silently deleted TWO pipeline subjects from the census, including
 * `defineIntrinsicMutationEmitter` — live production machinery that merely
 * stopped being exported.
 *
 *     A BEHAVIORAL PIPELINE DOES NOT STOP BEING BEHAVIOR WHEN ITS EXPORT
 *     MODIFIER IS REMOVED.
 *
 *     EXPORT STATUS IS API REACHABILITY EVIDENCE. IT IS NOT
 *     BEHAVIORAL-PIPELINE DISCOVERY.
 *
 * The `^` with the `m` flag still restricts this to column-zero declarations,
 * so nested closures are not swept in.
 */
export const detectPipelineFns = (src) =>
  [...src.matchAll(/^(?:export )?(?:async )?function ([A-Za-z_][\w]*)/gm)]
    .map((m) => m[1])
    .filter((n) => PIPELINE_VERB.test(n));

export const detectStructuralSymbols = (src) =>
  [...src.matchAll(/Symbol\.for\(\s*'(SignalTree:[^']+)'/g)].map((m) => m[1]);

export const detectAngularImports = (src) =>
  [...src.matchAll(/import\s+(type\s+)?\{([^}]+)\}\s+from\s+'@angular\/core'/g)].map((m) => ({
    typeOnly: Boolean(m[1]),
    symbols: m[2].split(',').map((s) => s.trim()).filter(Boolean),
  }));

export const detectExportedFns = (src) =>
  [...src.matchAll(/^export (?:async )?function ([A-Za-z_][\w]*)/gm)].map((m) => m[1]);

/** One planted instance of every shape the detectors must find. */
export const FIXTURE = {
  barrel: `
// export { notAnExport } from './lie';   <- a line comment must not be read
/* export { alsoNotAnExport } from './lie'; */
export { plantedValue } from './a';
export { anotherValue, type PlantedInlineType } from './e';
export { type RenamedInline as PlantedInlineAlias } from './f';
export { renamed as plantedAlias } from './b';
export type { PlantedType } from './c';
export type { RenamedType as PlantedTypeAlias } from './d';
`,
  iface: `
  // ⚠️ THIS LINE COMMENT CONTAINS packages/*/src/** ON PURPOSE. Stripping block
  // comments before line comments makes this open a block match that runs to the
  // next '*' + '/', swallowing the interface below — exactly the failure that
  // deleted MutationEnvelope from the real census. Without this shape in the
  // fixture, the ordering mutation survives and the control is decorative.
export interface Planted<T = unknown> {
  readonly plantedField: string;
  /** a doc comment mentioning packages/*/src/** must not swallow the rest */
  plantedOptional?: number;
}
`,
  bindings: `
let plantedTrue = true;
let plantedZero = 0;
let plantedNull = null;
let plantedFactory = createThing();
let plantedArray = [];
let plantedObject = {};
let plantedUninit: string | undefined;
var plantedVar = 1;
const plantedMap = new Map();
const plantedSignal = signal(0);
const plantedCall = createRegistry();
const plantedArrConst = [];
const plantedObjConst = {};
const PLANTED_CONST_PRIMITIVE = 100;
declare const plantedAmbient: unique symbol;
function outer() { let plantedNested = 1; return plantedNested; }
`,
  pkg: JSON.stringify({ exports: { '.': './x.js', './planted-subpath': './y.js' } }),
  markerModule: `
registerBuiltinMarkerProcessor(check, create, hooks);
`,
  module: `
import { computed } from '@angular/core';
import type { Signal } from '@angular/core';
const PLANTED_MAP = new WeakMap();
const PLANTED_OBJ = { a: 1 };
let plantedUninitialised: string | undefined;
const KEY = Symbol.for('SignalTree:PlantedSymbol');
export function publishPlanted() { return hasCapability('planted-capability'); }
export function plainHelper() { return 1; }
// ⚠️ NOT EXPORTED, and it must still be discovered — the export-invariance
// control for detectPipelineFns. Its absence is what let a de-export delete
// live behaviour from the denominator.
function publishInternalPlanted() { return 2; }
function hasCapability(c) { return c; }
`,
};

export const detectSubpathExports = (pkgJson) =>
  Object.keys(JSON.parse(pkgJson).exports ?? {});

const names = (bindings) => bindings.map((b) => b.name);
export const detectMarkerFactoryPaths = (paths) => paths.filter((p) => p.includes('/lib/markers/'));

/**
 * EVERY declared discovery family, each with a positive control, its negative
 * controls, and the mutation that must kill it.
 *
 * ⚠️ THE PREVIOUS SET WAS NOT "EVERY SHAPE THE DETECTORS MUST FIND". It had no
 * planted control for subpath discovery, marker factories, marker
 * registrations, or bare-module reachability — four declared subject
 * categories with no observation proof at all — and the mutation table covered
 * six mechanisms while being described as "each detector".
 */
export const FAMILIES = [
  {
    family: 'publicValueExport',
    mutate: { find: String.raw`^export \{\s*([^}]+?)\s*\} from`, replace: String.raw`^export \{ NEVERMATCH \} from` },
    positives: [
      ['plain', () => detectPublicValueExports(FIXTURE.barrel), 'plantedValue'],
      ['aliased', () => detectPublicValueExports(FIXTURE.barrel), 'plantedAlias'],
    ],
    negatives: [
      ['line-commented export', () => detectPublicValueExports(FIXTURE.barrel), 'notAnExport'],
      ['block-commented export', () => detectPublicValueExports(FIXTURE.barrel), 'alsoNotAnExport'],
      ['a type export is not a value', () => detectPublicValueExports(FIXTURE.barrel), 'PlantedType'],
      ['an inline type member is not a value', () => detectPublicValueExports(FIXTURE.barrel), 'PlantedInlineType'],
    ],
  },
  {
    family: 'publicTypeExport',
    mutate: { find: String.raw`^export type \{\s*([^}]+?)\s*\} from`, replace: String.raw`^export type \{ NEVERMATCH \} from` },
    positives: [
      ['plain', () => detectPublicTypeExports(FIXTURE.barrel), 'PlantedType'],
      ['aliased', () => detectPublicTypeExports(FIXTURE.barrel), 'PlantedTypeAlias'],
      ['inline `type` member of a value clause', () => detectPublicTypeExports(FIXTURE.barrel), 'PlantedInlineType'],
      ['aliased inline `type` member', () => detectPublicTypeExports(FIXTURE.barrel), 'PlantedInlineAlias'],
    ],
    negatives: [
      ['a value export is not a type', () => detectPublicTypeExports(FIXTURE.barrel), 'plantedValue'],
      ['a value BESIDE an inline type is not a type', () => detectPublicTypeExports(FIXTURE.barrel), 'anotherValue'],
    ],
  },
  {
    family: 'subpathExport',
    mutate: { find: String.raw`Object.keys(JSON.parse(pkgJson).exports ?? {});`, replace: String.raw`[];` },
    positives: [['subpath', () => detectSubpathExports(FIXTURE.pkg), './planted-subpath']],
    negatives: [['a value is not a subpath key', () => detectSubpathExports(FIXTURE.pkg), './y.js']],
  },
  {
    family: 'interfaceField',
    mutate: { find: String.raw`^\s{2}(?:readonly\s+)?([a-zA-Z_][\w]*)\??\s*[:(]`, replace: String.raw`^NEVERMATCH([a-zA-Z_])` },
    positives: [
      ['required', () => detectInterfaceFields(FIXTURE.iface, 'Planted'), 'plantedField'],
      ['optional', () => detectInterfaceFields(FIXTURE.iface, 'Planted'), 'plantedOptional'],
    ],
    negatives: [
      ['unknown interface yields nothing', () => detectInterfaceFields(FIXTURE.iface, 'NoSuch'), 'plantedField'],
    ],
  },
  {
    family: 'capability',
    mutate: { find: String.raw`hasCapability\(\s*'([^']+)'`, replace: String.raw`neverCapability\(\s*'([^']+)'` },
    positives: [['capability string', () => detectCapabilities(FIXTURE.module), 'planted-capability']],
    negatives: [['an ordinary string is not a capability', () => detectCapabilities(FIXTURE.module), 'plainHelper']],
  },
  {
    family: 'markerRegistration',
    mutate: { find: String.raw`/registerBuiltinMarkerProcessor|registerMarkerProcessor/.test(src)`, replace: String.raw`false` },
    positives: [['registration call', () => (detectMarkerRegistration(FIXTURE.markerModule) ? ['found'] : []), 'found']],
    negatives: [['a module without one is not a registration', () => (detectMarkerRegistration(FIXTURE.module) ? ['found'] : []), 'found']],
  },
  {
    family: 'markerFactory',
    mutate: { find: String.raw`paths.filter((p) => p.includes('/lib/markers/'))`, replace: String.raw`[]` },
    // Path-shaped, not source-shaped: a marker factory is discovered by living
    // under lib/markers/. Its control is therefore a path control, not a parser
    // control — stated plainly rather than dressed up as one.
    positives: [['path under lib/markers', () => detectMarkerFactoryPaths(['a/lib/markers/planted.ts', 'a/lib/other.ts']), 'a/lib/markers/planted.ts']],
    negatives: [['a non-marker path is not a factory', () => detectMarkerFactoryPaths(['a/lib/markers/planted.ts', 'a/lib/other.ts']), 'a/lib/other.ts']],
  },
  {
    family: 'moduleBinding',
    mutate: { find: String.raw`if (!ts.isVariableStatement(stmt)) continue;`, replace: String.raw`if (!ts.isVariableStatement(stmt)) continue;
    if (stmt.declarationList.flags & ts.NodeFlags.Let) continue;` },
    positives: [
      ['let = true', () => names(detectTopLevelBindings(FIXTURE.bindings)), 'plantedTrue'],
      ['let = 0', () => names(detectTopLevelBindings(FIXTURE.bindings)), 'plantedZero'],
      ['let = null', () => names(detectTopLevelBindings(FIXTURE.bindings)), 'plantedNull'],
      ['let = factory()', () => names(detectTopLevelBindings(FIXTURE.bindings)), 'plantedFactory'],
      ['let = []', () => names(detectTopLevelBindings(FIXTURE.bindings)), 'plantedArray'],
      ['let = {}', () => names(detectTopLevelBindings(FIXTURE.bindings)), 'plantedObject'],
      ['uninitialised let', () => names(detectTopLevelBindings(FIXTURE.bindings)), 'plantedUninit'],
      ['var', () => names(detectTopLevelBindings(FIXTURE.bindings)), 'plantedVar'],
      ['const = new Map()', () => names(detectTopLevelBindings(FIXTURE.bindings)), 'plantedMap'],
      ['const = signal()', () => names(detectTopLevelBindings(FIXTURE.bindings)), 'plantedSignal'],
      ['const = factory()', () => names(detectTopLevelBindings(FIXTURE.bindings)), 'plantedCall'],
      ['const = []', () => names(detectTopLevelBindings(FIXTURE.bindings)), 'plantedArrConst'],
      ['const = {}', () => names(detectTopLevelBindings(FIXTURE.bindings)), 'plantedObjConst'],
      ['const primitive IS discovered (declined later, not hidden)', () => names(detectTopLevelBindings(FIXTURE.bindings)), 'PLANTED_CONST_PRIMITIVE'],
      ['ambient declare IS discovered, annotated not hidden', () => names(detectTopLevelBindings(FIXTURE.bindings)), 'plantedAmbient'],
      ['ambient is flagged', () => detectTopLevelBindings(FIXTURE.bindings).filter((b) => b.ambient).map((b) => b.name), 'plantedAmbient'],
    ],
    negatives: [
      ['a function-local binding is not module state', () => names(detectTopLevelBindings(FIXTURE.bindings)), 'plantedNested'],
      ['a real binding is not flagged ambient', () => detectTopLevelBindings(FIXTURE.bindings).filter((b) => b.ambient).map((b) => b.name), 'plantedMap'],
    ],
  },
  {
    family: 'exportedPipelineCandidate',
    mutate: { find: String.raw`.filter((n) => PIPELINE_VERB.test(n));`, replace: String.raw`.filter(() => false);` },
    positives: [
      ['verb-named export', () => detectPipelineFns(FIXTURE.module), 'publishPlanted'],
      ['verb-named INTERNAL fn (export-invariance)', () => detectPipelineFns(FIXTURE.module), 'publishInternalPlanted'],
    ],
    negatives: [['a non-verb export is not a pipeline', () => detectPipelineFns(FIXTURE.module), 'plainHelper']],
  },
  {
    family: 'structuralSymbol',
    mutate: { find: String.raw`(SignalTree:[^']+)`, replace: String.raw`(NEVERTREE:[^']+)` },
    positives: [['Symbol.for', () => detectStructuralSymbols(FIXTURE.module), 'SignalTree:PlantedSymbol']],
    negatives: [['a plain identifier is not a symbol', () => detectStructuralSymbols(FIXTURE.module), 'KEY']],
  },
  {
    family: 'angularImport',
    mutate: { find: String.raw`from\s+'@angular\/core'`, replace: String.raw`from\s+'@never\/core'` },
    positives: [
      ['value import', () => detectAngularImports(FIXTURE.module).filter((a) => !a.typeOnly).flatMap((a) => a.symbols), 'computed'],
      ['type-only import', () => detectAngularImports(FIXTURE.module).filter((a) => a.typeOnly).flatMap((a) => a.symbols), 'Signal'],
    ],
    negatives: [
      ['a type-only import is not a value import', () => detectAngularImports(FIXTURE.module).filter((a) => !a.typeOnly).flatMap((a) => a.symbols), 'Signal'],
    ],
  },
  {
    family: 'exportedFn',
    mutate: { find: String.raw`[...src.matchAll(/^export (?:async )?function ([A-Za-z_][\w]*)/gm)].map((m) => m[1]);`, replace: String.raw`[];` },
    positives: [['exported function', () => detectExportedFns(FIXTURE.module), 'plainHelper']],
    negatives: [['a local function is not exported', () => detectExportedFns(FIXTURE.module), 'hasCapability']],
  },
];


/** Flattened views the runners consume. */
export const OBSERVERS = FAMILIES.flatMap((f) =>
  f.positives.map(([label, run, anchor]) => [`${f.family}:${label}`, run, anchor])
);
export const NEGATIVE = FAMILIES.flatMap((f) =>
  f.negatives.map(([label, run, forbidden]) => [`${f.family}:${label}`, run, forbidden])
);
