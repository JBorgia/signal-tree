/**
 * THE SERIALIZATION ACQUISITION SURFACE — what can a consumer actually reach?
 *
 * Four methods that bring EXTERNAL truth into a live tree are attached at
 * runtime: `fromJSON`, `deserialize`, `restore`, `load`. Each one that a user
 * can actually call is a post-activation AUTHORITY ADOPTION boundary, and needs
 * the direct-baseline treatment that Link's `acquire()` proved load-bearing.
 *
 * Runtime attachment is not the question. A property assigned inside the
 * enhancer is implementation residue until a consumer can reach it. So this
 * fixture is written the way a user writes code — public entry point only, no
 * casts, no internal imports, no `any` — and the compiler answers.
 */
import { persistence, signalTree } from '../index';

type State = { n: number; s: { theme: string } };
const INITIAL: State = { n: 1, s: { theme: 'light' } };

const memory = {
  getItem: (_k: string): string | null => null,
  setItem: (_k: string, _v: string): void => undefined,
  removeItem: (_k: string): void => undefined,
};

// Exactly how a consumer composes it.
const tree = signalTree(INITIAL, {
  enhancers: [persistence({ key: 'probe', storage: memory })],
});

// ── PersistenceMethods — unquestionably exported by name ────────────────────
export const _load: Promise<void> = tree.load();
export const _save: Promise<void> = tree.save();
export const _clear: Promise<void> = tree.clear();

// ── SerializationMethods — the type is NOT named in the barrel. Are its
//    members nonetheless reachable through the accumulated enhancer additions?
// ⚠️ AND A RECORDED GREENFIELD CONCERN IS NOW MOOT. This flagged that the
//    reachable `toJSON()` returned `unknown` rather than `State` — the enhancer
//    declared two variants and a consumer reached the erased one, so a caller
//    had to re-narrow what the tree already knew. It was noted for the
//    greenfield surface review. PRE-RELEASE-PUBLIC-SURFACE-DEDUPE-0 deleted the
//    method, so the widening has no subject: `tree()` returns `State`.
//
//    Four spellings went with it — toJSON, fromJSON, snapshot, restore. What
//    remains is the codec pair, and the question this file exists to ask still
//    stands for them.
export const _serialize: string = tree.serialize();
tree.deserialize('{}');
