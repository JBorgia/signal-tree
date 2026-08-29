#!/usr/bin/env node
/**
 * MODULE-STATE-EVIDENCE-CONTROL-0 — controls for the evidence collector.
 *
 * The census's DISCOVERY is proven elsewhere. This instrument CHARACTERISES
 * subjects, and each of its claims — who writes, who reads, which symbol —
 * needs its own counterfactual, because the next decision it authorizes is
 * whether an apparently public capability has zero surviving claimants.
 *
 * ⚠️ MULTI-FILE CONTROLS ARE NOT OPTIONAL. The previous version's controls were
 * a single synthetic source string, so both cross-module failure modes passed
 * unexamined: an ALIASED import recorded no importer at all, and two modules
 * exporting the same spelling cross-attributed each other's uses.
 */
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { analyseProgram } from './module-state-evidence.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const dir = mkdtempSync(join(ROOT, 'tools', '.mse-fix-'));
const w = (name, src) => {
  const p = join(dir, name);
  writeFileSync(p, src, 'utf8');
  return p;
};

// ── fixture ─────────────────────────────────────────────────────────────────
const A = w('a.ts', `
export let sharedState = 0;
export const registry = new Map<string, number>();
let privateCounter = 0;
let assigned = 0;
let readOnly = 1;
let shadowedOutside = 'module';

export function bumpPrivate() { privateCounter++; --privateCounter; }
export function writeAssigned() { assigned = 5; }
export function readIt() { return readOnly + readOnly; }
export function shadowParam(shadowedOutside: string) { shadowedOutside = 'p'; return shadowedOutside; }
export function shadowLocal() { let shadowedOutside = 'l'; shadowedOutside = 'r'; return shadowedOutside; }
export class Allocator { readonly id: number = privateCounter++; }
export let loadTimeCounter = 0;
loadTimeCounter = 1;
const source = { a: 1, b: 2 };
const pair: [number, number, number] = [1, 2, 3];
const { a: destructuredA, b: renamedB } = source;
const [firstEl, , thirdEl] = pair;
export function readDestructured() { return destructuredA + renamedB + firstEl + thirdEl; }
`);
// B exports the SAME SPELLING as A — the same-name negative control.
const B = w('b.ts', `
export let sharedState = 100;
`);
// C imports from B only. It must never be attributed to A's sharedState.
const C = w('c.ts', `
import { sharedState } from './b';
export function readB() { return sharedState; }
`);
// D imports A's binding UNDER AN ALIAS and both reads and writes it.
const D = w('d.ts', `
import { sharedState as aliased, registry as aliasedRegistry } from './a';
export function readAliased() { return aliased; }
export function writeAliased() { aliased = 7; }
export function mutateAliased() { aliasedRegistry.set('k', 1); }
export function localShadow() { const aliased = 1; return aliased; }
`);

const { subjects } = analyseProgram([A, B, C, D]);
const find = (file, name) =>
  [...subjects.values()].find((s) => s.file === file && s.name === name);

const aShared = find(A, 'sharedState');
const bShared = find(B, 'sharedState');
const aRegistry = find(A, 'registry');
const priv = find(A, 'privateCounter');
const assigned = find(A, 'assigned');
const readOnly = find(A, 'readOnly');
const shadowed = find(A, 'shadowedOutside');

const filesOf = (s, list) => [...new Set(list.map((x) => x.file))];
const wheresOf = (s) => s.writes.map((x) => x.where);
const kindsOf = (s) => s.writes.map((x) => x.kind);

const CONTROLS = [
  // ── in-file attribution ───────────────────────────────────────────────────
  ['assignment is a write with its writer', () => wheresOf(assigned).includes('writeAssigned')],
  ['++ is a write with its writer', () => kindsOf(priv).includes('increment') && wheresOf(priv).includes('bumpPrivate')],
  ['-- is a write with its writer', () => kindsOf(priv).includes('decrement')],
  ['a plain read is counted', () => readOnly.reads.filter((r) => r.file === A).length >= 2],
  ['an assignment TARGET is not a read', () => assigned.reads.filter((r) => r.file === A).length === 0],
  ['a PARAMETER of the same name is not a module write', () => !wheresOf(shadowed).includes('shadowParam')],
  ['a LOCAL of the same name is not a module write', () => !wheresOf(shadowed).includes('shadowLocal')],
  ['a never-written binding has no writes', () => readOnly.writes.length === 0],

  // ── A. direct import ──────────────────────────────────────────────────────
  ['B.sharedState is read by c.ts', () => filesOf(bShared, bShared.reads).includes(C)],

  // ── B. ALIAS import ───────────────────────────────────────────────────────
  ['alias import READ attributes to the original declaration', () => filesOf(aShared, aShared.reads).includes(D)],
  ['alias import WRITE attributes to the original declaration', () => filesOf(aShared, aShared.writes).includes(D)],
  ['alias import MUTATION attributes to the original declaration', () => aRegistry.mutationCandidates.some((m) => m.file === D && m.method === 'set')],

  // ── C. same-name negative ─────────────────────────────────────────────────
  ['c.ts imports B, so it is NOT attributed to A.sharedState', () => !filesOf(aShared, aShared.reads).includes(C)],
  ['B.sharedState is not written by d.ts (which aliases A)', () => !filesOf(bShared, bShared.writes).includes(D)],

  // ── D. local shadow of an ALIASED import ──────────────────────────────────
  ['a local shadowing an aliased import is not the module symbol', () => aShared.reads.filter((r) => r.file === D && r.where === 'localShadow').length === 0],

  // ── module-private isolation ──────────────────────────────────────────────
  // ⚠️ A class property initializer runs PER CONSTRUCTION; module top level runs
  // once at load. Reporting the first as the second misstates the lifetime.
  ['a class property initializer is not reported as module top level', () => wheresOf(priv).some((x) => String(x).includes('Allocator.id'))],
  ['a genuine module-top-level write still reports top level', () => wheresOf(find(A, 'loadTimeCounter')).includes('(module top level)')],
  // ⚠️ THE COLLECTOR SKIPPED DESTRUCTURING UNDER A COMMENT CLAIMING OTHERWISE,
  // while census discovery recursed into it. Both reported 126 — the same count
  // for different sets. COUNT PARITY IS NOT SUBJECT PARITY.
  ['object destructuring binds a subject', () => Boolean(find(A, 'destructuredA'))],
  ['renamed object destructuring binds the LOCAL name', () => Boolean(find(A, 'renamedB'))],
  ['array destructuring binds a subject', () => Boolean(find(A, 'firstEl'))],
  ['array destructuring skips holes but keeps later elements', () => Boolean(find(A, 'thirdEl'))],
  ['a destructured binding is characterised, not merely discovered', () => (find(A, 'destructuredA')?.reads.length ?? 0) >= 1],
  ['a module-private binding has no cross-file uses', () => filesOf(priv, [...priv.reads, ...priv.writes]).every((f) => f === A)],
];

let bad = 0;
for (const [label, run] of CONTROLS) {
  let ok = false;
  try { ok = Boolean(run()); } catch { ok = false; }
  if (!ok) bad++;
  console.log(`  ${ok ? 'pass' : 'FAIL'}  ${label}`);
}
rmSync(dir, { recursive: true, force: true });
console.log(
  bad
    ? `\n❌ ${bad} evidence control(s) failed — the collector's claims are not what it measures.`
    : `\n✅ ${CONTROLS.length} evidence controls pass, including cross-module symbol identity.`
);
process.exit(bad ? 1 : 0);
