#!/usr/bin/env node
/**
 * MODULE-STATE-OWNERSHIP-0 evidence collector — TypeChecker-resolved.
 *
 * Collects, per top-level binding: retained fact, writers (with location),
 * reads, mutation candidates, and cross-file uses. It assigns NO owner.
 *
 *     STATE LIFETIME IS PART OF OWNERSHIP.
 *
 * ⚠️ EVERY FIELD NAME IS A CLAIM, AND THE FIRST TWO VERSIONS BOTH OVERCLAIMED.
 *
 * v1 named an identifier count `readers` and a substring match
 * `referencedByOtherProdFiles`, reporting 32 production files referencing a
 * module-PRIVATE `let runtime` — every occurrence of the word "runtime".
 *
 * v2 replaced the substring match with "does the importing file import this
 * SPELLING", which is still not symbol identity and fails two ways that matter
 * for a deletion verdict:
 *
 *     import { runtime as observationRuntime }   -> importer MISSED
 *     a.ts exports `state`; b.ts exports `state`;
 *     c.ts imports it from b                     -> attributed to A's `state` too
 *
 * A false-negative alias or a false-positive same-name import directly changes
 * whether a capability looks unclaimed, which is exactly the question this
 * evidence is about to authorize. So identity now comes from the TypeScript
 * TypeChecker: every identifier is resolved to a symbol, aliases are followed,
 * and comparison is on DECLARATION IDENTITY, never on text.
 */
import ts from 'typescript';
import { writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

export function walk(dir, out = [], specs = false) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out, specs);
    else if (p.endsWith('.ts') && (specs || !p.includes('.spec.'))) out.push(p);
  }
  return out;
}

/** Nearest enclosing function name, or module top level. */
function enclosingFn(node) {
  let n = node.parent;
  while (n) {
    if (ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n))
      return n.name?.getText?.() ?? '(anonymous fn)';
    if (ts.isFunctionExpression(n) || ts.isArrowFunction(n)) {
      const v = n.parent;
      if (ts.isVariableDeclaration(v) && ts.isIdentifier(v.name))
        return v.name.text;
      return '(anonymous fn)';
    }
    // ⚠️ A CLASS PROPERTY INITIALIZER IS NOT MODULE TOP LEVEL. `readonly id =
    // nextRegistryId++` runs once PER INSTANCE, not once per module load, and
    // those are different lifetimes — which is the whole point of this column.
    // Without this case the walker found no enclosing function and fell through
    // to "(module top level)", reporting a per-construction allocator as
    // module-load initialisation.
    if (ts.isPropertyDeclaration(n)) {
      const cls = n.parent;
      const clsName = ts.isClassDeclaration(cls)
        ? cls.name?.text ?? '(anonymous class)'
        : '?';
      return `${clsName}.${
        n.name?.getText?.() ?? '?'
      } (property initializer, per construction)`;
    }
    if (ts.isConstructorDeclaration(n)) {
      const cls = n.parent;
      const clsName = ts.isClassDeclaration(cls)
        ? cls.name?.text ?? '(anonymous class)'
        : '?';
      return `${clsName}.constructor`;
    }
    n = n.parent;
  }
  return '(module top level)';
}

const MUTATORS = new Set([
  'set',
  'delete',
  'clear',
  'add',
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse',
  'update',
  'next',
  'emit',
  'fill',
  'copyWithin',
]);

/**
 * Analyse a whole PROGRAM. Returns per-subject evidence keyed by the subject's
 * declaration node, so two identically-spelled bindings in different modules
 * can never collide.
 */
/**
 * Compiler options from the REAL project tsconfig.
 *
 * ⚠️ A HAND-INVENTED SUBSET IS NOT THE PRODUCTION COMPILER WORLD. The package
 * carries the production compiler world, and a synthetic program with a
 * hand-written option subset can lose legitimate cross-file consumers. For an
 * ordinary analysis tool that is a rounding error; for "zero claimants ->
 * delete the capability" it is the whole verdict.
 */
export function productionProjectConfig(
  configPath = `${ROOT}/packages/kernel/tsconfig.lib.json`
) {
  const read = ts.readConfigFile(configPath, ts.sys.readFile);
  if (read.error)
    throw new Error(
      `cannot read ${configPath}: ${ts.flattenDiagnosticMessageText(
        read.error.messageText,
        ' '
      )}`
    );
  const parsed = ts.parseJsonConfigFileContent(
    read.config,
    ts.sys,
    configPath.replace(/\/[^/]+$/, '')
  );
  return {
    options: parsed.options,
    fileNames: parsed.fileNames,
    projectReferences: parsed.projectReferences,
  };
}

/**
 * THE production source universe — whatever the project actually compiles.
 *
 * ⚠️ REAL OPTIONS WERE NOT ENOUGH. The previous version loaded the real
 * compiler options and then handed `createProgram` a file list built by walking
 * the directory for `*.ts` minus `*.spec.ts`. The project's own tsconfig also
 * excludes `src/test-setup.ts` and `vitest.config.ts`, and could include or
 * exclude anything else at any time.
 *
 * So both instruments could agree perfectly about a subject that is not in the
 * production compilation at all, or jointly omit one that is:
 *
 *     TWO INSTRUMENTS AGREEING DOES NOT PROVE THEIR SHARED UNIVERSE IS THE
 *     RIGHT UNIVERSE.
 *     COMPILER-OPTION PARITY IS NOT PROJECT-INPUT PARITY.
 *
 * One authority now, consumed by discovery, evidence and the consumer traces.
 */
export function productionSourceFiles(configPath) {
  return productionProjectConfig(configPath).fileNames.filter((f) =>
    f.endsWith('.ts')
  );
}

/** Back-compat shim for callers that only wanted options. */
export function productionCompilerOptions(configPath) {
  return productionProjectConfig(configPath).options;
}

export function analyseProgram(fileNames, options = undefined) {
  const program = ts.createProgram(
    fileNames,
    options ?? productionCompilerOptions()
  );
  const checker = program.getTypeChecker();
  const sources = program
    .getSourceFiles()
    .filter((sf) => !sf.isDeclarationFile && fileNames.includes(sf.fileName));

  /** declaration node -> evidence */
  const subjects = new Map();

  // ── 1. collect top-level binding subjects ────────────────────────────────
  for (const sf of sources) {
    for (const stmt of sf.statements) {
      if (!ts.isVariableStatement(stmt)) continue;
      const ambient = Boolean(
        stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.DeclareKeyword)
      );
      const exported = Boolean(
        stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      );
      const f = stmt.declarationList.flags;
      const kind =
        f & ts.NodeFlags.Const ? 'const' : f & ts.NodeFlags.Let ? 'let' : 'var';
      for (const d of stmt.declarationList.declarations) {
        // ⚠️ THE COMMENT HERE USED TO SAY "destructuring handled below" AND
        // NOTHING BELOW HANDLED IT. The census detector recurses into object
        // and array binding patterns; this collector silently skipped them. The
        // two instruments reported the same COUNT today, which is not the same
        // claim as describing the same SUBJECTS.
        //
        //     COUNT PARITY IS NOT SUBJECT PARITY.
        //
        // Every bound name in a destructuring pattern is now a subject, matching
        // discovery exactly, and `subject-set parity` is a control rather than
        // an assumption.
        for (const bound of boundNames(d.name)) {
          subjects.set(bound.node, {
            file: sf.fileName,
            name: bound.name,
            kind,
            ambient,
            exported,
            retainedFact: d.initializer
              ? initShape(d.initializer)
              : 'uninitialised',
            immutablePrimitive:
              kind === 'const' &&
              Boolean(d.initializer) &&
              isLiteralPrimitive(d.initializer),
            writes: [],
            reads: [],
            mutationCandidates: [],
          });
        }
      }
    }
  }

  /** Resolve an identifier to the DECLARATION of the subject it names, if any. */
  const resolveSubjectDecl = (node) => {
    let sym = checker.getSymbolAtLocation(node);
    if (!sym) return undefined;
    // ⚠️ FOLLOW ALIASES. `import { runtime as observationRuntime }` resolves to
    // a local alias symbol whose NAME is the alias; only the aliased symbol
    // carries the original declaration.
    if (sym.flags & ts.SymbolFlags.Alias) {
      try {
        sym = checker.getAliasedSymbol(sym);
      } catch {
        /* unresolvable alias — leave as-is */
      }
    }
    for (const decl of sym.declarations ?? []) {
      if (subjects.has(decl)) return decl;
      // A binding subject is keyed by its NAME node; a symbol's declaration is
      // the VariableDeclaration or BindingElement that owns it.
      const nameNode = decl.name;
      if (nameNode && subjects.has(nameNode)) return nameNode;
    }
    return undefined;
  };

  // ── 2. attribute every identifier by SYMBOL, not spelling ────────────────
  for (const sf of sources) {
    const visit = (node) => {
      if (ts.isBinaryExpression(node) && ts.isIdentifier(node.left)) {
        const op = node.operatorToken.kind;
        if (
          op === ts.SyntaxKind.EqualsToken ||
          (op >= ts.SyntaxKind.FirstCompoundAssignment &&
            op <= ts.SyntaxKind.LastCompoundAssignment)
        ) {
          const d = resolveSubjectDecl(node.left);
          if (d)
            subjects.get(d).writes.push({
              kind: 'assign',
              where: enclosingFn(node),
              file: sf.fileName,
            });
        }
      }
      if (
        (ts.isPostfixUnaryExpression(node) ||
          ts.isPrefixUnaryExpression(node)) &&
        ts.isIdentifier(node.operand) &&
        (node.operator === ts.SyntaxKind.PlusPlusToken ||
          node.operator === ts.SyntaxKind.MinusMinusToken)
      ) {
        const d = resolveSubjectDecl(node.operand);
        if (d)
          subjects.get(d).writes.push({
            kind:
              node.operator === ts.SyntaxKind.PlusPlusToken
                ? 'increment'
                : 'decrement',
            where: enclosingFn(node),
            file: sf.fileName,
          });
      }
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        MUTATORS.has(node.expression.name.text)
      ) {
        const d = resolveSubjectDecl(node.expression.expression);
        if (d)
          subjects.get(d).mutationCandidates.push({
            method: node.expression.name.text,
            where: enclosingFn(node),
            file: sf.fileName,
          });
      }
      if (ts.isIdentifier(node)) {
        const p = node.parent;
        const isDeclName = ts.isVariableDeclaration(p) && p.name === node;
        const isAssignTarget =
          ts.isBinaryExpression(p) &&
          p.left === node &&
          p.operatorToken.kind === ts.SyntaxKind.EqualsToken;
        const isPropName = ts.isPropertyAccessExpression(p) && p.name === node;
        const isImportSpec = ts.isImportSpecifier(p) || ts.isImportClause(p);
        if (!isDeclName && !isAssignTarget && !isPropName && !isImportSpec) {
          const d = resolveSubjectDecl(node);
          if (d)
            subjects
              .get(d)
              .reads.push({ file: sf.fileName, where: enclosingFn(node) });
        }
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(sf, visit);
  }
  return { subjects, program, checker };
}

/** Every identifier bound by a name or a destructuring pattern. */
function boundNames(name, out = []) {
  if (ts.isIdentifier(name)) out.push({ name: name.text, node: name });
  else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name))
    for (const el of name.elements)
      if (ts.isBindingElement(el)) boundNames(el.name, out);
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
  if (ts.isNewExpression(node))
    return `new ${node.expression.getText?.() ?? '?'}`;
  if (ts.isCallExpression(node))
    return `${node.expression.getText?.() ?? '?'}()`;
  if (ts.isObjectLiteralExpression(node)) return 'object literal';
  if (ts.isArrayLiteralExpression(node)) return 'array literal';
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node))
    return 'function';
  if (isLiteralPrimitive(node))
    return `literal ${node.getText?.() ?? ''}`.trim();
  if (node.kind === ts.SyntaxKind.NullKeyword) return 'null';
  return ts.SyntaxKind[node.kind];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // The production compilation's own inputs — not a directory walk.
  const FILES = productionSourceFiles();
  const rel = (p) => relative(ROOT, p).replace('packages/kernel/src/', '');
  const { subjects } = analyseProgram(FILES);
  const rows = [];
  for (const [, s] of subjects) {
    const home = s.file;
    const crossFileReads = s.reads.filter((r) => r.file !== home);
    const crossFileWrites = s.writes.filter((w) => w.file !== home);
    rows.push({
      subject: `state:${rel(home)}:${s.name}`,
      file: rel(home),
      name: s.name,
      kind: s.kind,
      ambient: s.ambient,
      exported: s.exported,
      retainedFact: s.retainedFact,
      mutableCandidate: !s.immutablePrimitive,
      writes: s.writes.map((w) => ({ ...w, file: rel(w.file) })),
      writerLocations: [...new Set(s.writes.map((w) => w.where))],
      symbolResolvedReadsInFile: s.reads.filter((r) => r.file === home).length,
      // ⚠️ READER LOCATIONS, not just a count. A module-private binding's owner
      // is decided by the JOB OF ITS READERS — which for a private binding are
      // functions in its own file. Exposing only a count forced the earlier
      // registry to fall back on "what else lives in this file", which is the
      // module-owner-to-job-owner direction the audit prohibits.
      readerLocationsInFile: [
        ...new Set(s.reads.filter((r) => r.file === home).map((r) => r.where)),
      ],
      symbolResolvedCrossFileReads: crossFileReads.length,
      symbolResolvedCrossFileWrites: crossFileWrites.length,
      referencingFiles: [
        ...new Set(
          [...crossFileReads, ...crossFileWrites].map((r) => rel(r.file))
        ),
      ],
      mutationCandidates: [
        ...new Set(s.mutationCandidates.map((m) => m.method)),
      ],
    });
  }
  // ── ANOMALY SCORE ─────────────────────────────────────────────────────────
  //
  //     100% OF SUBJECTS MUST BE ACCOUNTED FOR.
  //     NOT 100% OF SUBJECTS DESERVE A CUSTOM EXPERIMENT.
  //
  // Discovery stays exhaustive; this only decides HOW MUCH EVIDENCE to spend.
  // It never makes a ruling. The weights encode the shapes that actually
  // produced defects in this audit — `batchUpdates` (global policy with
  // per-tree spelling), the notifier reset divergence (multiple reset paths),
  // the stale port facade (installed runtime), dead `batchScope` (test-only
  // readers), duplicate registration (duplicate retained fact).
  const RESTORE = /restor|undo|redo|histor|causal|turn|transaction/i;
  const IDENTITY = /\bid\b|Id$|identity|registry|subject|position/i;
  const CACHE = /memo|cache|MATERIALIZED|SNAPSHOT/i;
  for (const r of rows) {
    let score = 0;
    const why = [];
    const add = (n, reason) => {
      score += n;
      why.push(`+${n} ${reason}`);
    };

    if (r.writerLocations.length > 1) add(3, 'multiple independent writers');
    // ⚠️ NAME/PATH SCORING IS A WEAK HINT, NOT A LANE DECIDER. Giving these +3
    // let `SUBJECT_RESTORATION_CLAIMS_SYMBOL` reach DEEP purely on the words in
    // its identifier and directory, while being a structural key. Path domain
    // is evidence about current REPRESENTATION, never about ownership, so it
    // may nudge and must not dominate mechanically derived evidence.
    if (RESTORE.test(r.file) || RESTORE.test(r.name))
      add(1, 'restoration / causal domain (weak: name/path hint)');
    if (IDENTITY.test(r.name)) add(1, 'identity-shaped name (weak: name hint)');
    // ⚠️ A `const f = () => {}` IS A FUNCTION DECLARATION, NOT AN INSTALLED
    // CALLBACK. The first scoring pass gave every module-level arrow function
    // +2 for "installed runtime", flagging six pure helpers as DEEP. The shape
    // that actually matters is a REASSIGNABLE slot — `let x: Fn | undefined`
    // that something installs into. Never-reassigned function constants carry
    // no state at all, which is the same "do not derive ownership from the
    // container type" error the collection pass exists to avoid, committed by
    // the triage tool itself.
    const reassignable = r.kind !== 'const' || r.writes.length > 0;
    if (
      reassignable &&
      (/^(uninitialised|null)$/.test(r.retainedFact) ||
        r.retainedFact === 'function')
    )
      add(2, 'installed runtime / mutable callback');
    if (!reassignable && r.retainedFact === 'function')
      add(-2, 'const function declaration, not state');
    // ⚠️ A `Symbol.for()` CONSTANT IS A PROPERTY KEY, NOT STATE. The scorer
    // rated `SUBJECT_RESTORATION_CLAIMS_SYMBOL` a 6 — entirely from its NAME
    // ("SUBJECT") and its FILE ("restoration"). It is a stable key attached to
    // a node, and the census already enumerates it separately as a structural
    // symbol. Scoring a subject on the words in its identifier is the same
    // mistake as `A SYMBOL'S NAME DOES NOT CHOOSE ITS OWNER`, in the tool built
    // to avoid it.
    if (!reassignable && /^Symbol\.for\(\)$/.test(r.retainedFact))
      add(-4, 'Symbol.for() key, censused as a structural symbol');
    if (
      r.mutationCandidates.length &&
      !r.mutationCandidates.some((m) => /delete|clear|pop|shift|splice/.test(m))
    )
      add(2, 'insertion with no removal path');
    if (
      /^new (Map|Set)$/.test(r.retainedFact) ||
      r.retainedFact === 'array literal'
    )
      add(2, "strong collection — retention is not the key's lifetime");
    if (CACHE.test(r.name))
      add(2, 'cache — correctness depends on invalidation');
    if (
      r.exported &&
      r.symbolResolvedCrossFileReads === 0 &&
      (r.importedBySpecCount ?? 0) > 0
    )
      add(2, 'exported, read only by specs');
    if (r.writerLocations.some((w) => /reset|clear/i.test(String(w))))
      add(2, 'has a reset path');
    if (/ForTesting|Testing/.test(r.writerLocations.join(' ')))
      add(-1, 'test-only writer');

    r.anomalyScore = Math.max(0, score);
    r.anomalyReasons = why;
    r.lane =
      r.anomalyScore <= 1
        ? 'FAST-LANE'
        : r.anomalyScore <= 3
        ? 'REVIEW-TABLE'
        : 'DEEP';
  }

  writeFileSync(
    `${ROOT}/tools/module-state-evidence.json`,
    JSON.stringify(rows, null, 2)
  );
  const mut = rows.filter((r) => r.mutableCandidate && !r.ambient);
  console.log(
    `module-state evidence: ${rows.length} bindings, ${mut.length} mutable non-ambient`
  );
}
