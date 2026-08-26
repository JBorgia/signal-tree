/**
 * KERNEL FRAMEWORK-NEUTRALITY GATE — GREENFIELD-FRAMEWORK-NEUTRALITY-SPIKE-0 / A2.
 *
 * FRAMEWORK NEUTRALITY IS A TYPE-CLOSURE PROPERTY.
 *
 * A module with no `@angular/*` import of its own is NOT neutral if any module
 * it imports — at any depth, through type-only edges included — reaches Angular.
 * The spike measured exactly that trap: `tree-scalar-slot-runtime.ts` had zero
 * Angular imports and a 27-file type closure with SIX Angular-tainted members,
 * entering through two single-symbol edges that both pointed at a re-exporting
 * hub instead of the neutral module where the symbol is actually defined:
 *
 *     import type { PositionId }   from '../types'   -> lib/mutation-types.ts
 *     import { isTraversableNode } from '../utils'   -> internals/node-shape.ts
 *
 * Both were one-line redirects. Neither changed a single runtime behaviour.
 * That is precisely why this needs a GATE rather than a note: the contamination
 * is invisible at the file being read, costs nothing to reintroduce, and an
 * ordinary `import { X } from '../types'` is what a careful author would write.
 *
 * ⚠️ TYPE-ONLY EDGES COUNT. They are erased at runtime, so a bundle-size or
 * module-load probe cannot see them — the kernel's RUNTIME closure was already
 * clean while its TYPE closure was not. Public contracts are types; a kernel
 * whose types name Angular is an Angular kernel no matter what it emits.
 *
 * Usage:
 *   node tools/check-kernel-neutrality.mjs
 *   node tools/check-kernel-neutrality.mjs --self-test
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const SRC = resolve('packages/core/src');

/**
 * Modules declared framework-neutral. Adding a root here is a CLAIM that its
 * entire transitive type closure is Angular-free, and this gate is what makes
 * that claim falsifiable. Grow this list as the handoff extraction proceeds.
 */
const NEUTRAL_ROOTS = [
  'lib/internals/tree-scalar-slot-runtime.ts',
  'lib/internals/position-registry.ts',
  'lib/internals/physical-commit-clock.ts',
  'lib/mutation-types.ts',
  'lib/internals/node-shape.ts',
];

const resolveSpec = (from, spec) => {
  for (const c of [join(dirname(from), `${spec}.ts`), join(dirname(from), spec, 'index.ts')]) {
    if (existsSync(c)) return c;
  }
  return undefined;
};

/** Transitive closure over ALL relative edges — type-only imports included. */
function closure(entry) {
  const seen = new Set();
  const stack = [resolve(entry)];
  while (stack.length) {
    const p = stack.pop();
    if (seen.has(p) || !existsSync(p)) continue;
    seen.add(p);
    const text = readFileSync(p, 'utf8');
    for (const m of text.matchAll(/from\s*'(\.[^']+)'/g)) {
      const r = resolveSpec(p, m[1]);
      if (r) stack.push(r);
    }
  }
  return seen;
}

const tainted = (file) => /@angular\//.test(readFileSync(file, 'utf8'));

function violations(roots) {
  const out = [];
  for (const root of roots) {
    const entry = join(SRC, root);
    if (!existsSync(entry)) {
      out.push({ root, member: root, missing: true });
      continue;
    }
    for (const member of [...closure(entry)].sort()) {
      if (tainted(member)) out.push({ root, member: relative(SRC, member) });
    }
  }
  return out;
}

if (process.argv.includes('--self-test')) {
  // ⚠️ THE GATE'S OWN POSITIVE CONTROL. "Found nothing" is indistinguishable
  // from "cannot find anything" — this repository has been burned by exactly
  // that twice. So the detector is pointed at a root KNOWN to be tainted: the
  // Angular scalar runtime, which imports `linkedSignal`/`signal` directly and
  // is the deliberate peer of the neutral kernel.
  const control = violations(['lib/internals/tree-scalar-slot-angular-runtime.ts']);
  if (control.length === 0) {
    console.error(
      '✗ SELF-TEST FAILED: the closure walker found NO Angular taint in ' +
        'tree-scalar-slot-angular-runtime.ts, which imports @angular/core on line 1. ' +
        'The detector is broken, not the kernel.'
    );
    process.exit(1);
  }
  console.log(
    `✓ self-test: walker found ${control.length} tainted closure member(s) in the known-positive Angular runtime.`
  );
  process.exit(0);
}

const found = violations(NEUTRAL_ROOTS);
if (found.length > 0) {
  console.error('✗ KERNEL NEUTRALITY VIOLATED — a declared-neutral root reaches @angular/* through its type closure:\n');
  for (const v of found) {
    if (v.missing) console.error(`  ${v.root}\n      MISSING — declared neutral but does not exist`);
    else console.error(`  ${v.root}\n      reaches  ${v.member}`);
  }
  console.error('\n  Usually the fix is a one-line redirect to the module that DEFINES the symbol,');
  console.error('  not the barrel/hub that re-exports it. See the header of this file.');
  process.exit(1);
}
console.log(`✓ ${NEUTRAL_ROOTS.length} neutral kernel roots — type closures are Angular-free.`);
