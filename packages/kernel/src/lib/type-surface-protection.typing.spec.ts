import { describe, it } from 'vitest';

import { signalTree } from './signal-tree';

/**
 * TYPE-SURFACE-PROTECTION-0 — TRIPWIRE FOR THE RECURSIVE TYPE SYSTEM.
 *
 * ⚠️ THIS EXISTS BECAUSE C5 IS PERFORMING STRUCTURAL SURGERY ON THE RUNTIME.
 *
 * `TreeNode<T>`'s recursive inference is expensive, hard-won infrastructure, and
 * a change to it is silent: your tree simply stops having topology, with no
 * diagnostic saying why. An earlier revision of this session collapsed
 * open-keyed objects to `Record<never, never>` via a `string extends keyof T`
 * special case. It compiled, production was clean, and it stripped child
 * locations from every `Record<string, V>` state AND from every
 * `interface X extends Record<string, unknown>` — 23 sites, most of which use
 * that `extends` as a generic CONSTRAINT rather than to declare open-key intent.
 *
 * This file is deliberately small. It does not freeze implementation detail; it
 * pins four properties that must survive while the runtime changes underneath:
 *
 *     recursive KNOWN-key inference
 *     honest OPEN-key uncertainty
 *     HYBRID named-key inference
 *     CLOSED arbitrary-key REJECTION
 *
 * The authorized v16 open-key migration must preserve named/hybrid topology.
 *
 * ⚠️ NO CASTS on the assertions themselves — §29.7a. The subject IS what the
 * public typing infers.
 */
type Row = { id: string; n: number };
interface Hybrid extends Record<string, unknown> {
  name: string;
  email: string;
}

describe('TYPE-SURFACE-PROTECTION-0', () => {
  it('compiles', () => {
    // ── recursive KNOWN-key inference ───────────────────────────────────────
    const closed = signalTree({ user: { name: 'Ada', age: 42 } });
    const _closedName: string = closed.$.user.name();
    const _closedAge: number = closed.$.user.age();
    void _closedName;
    void _closedAge;

    // ── CLOSED arbitrary-key REJECTION ──────────────────────────────────────
    // @ts-expect-error a closed object type must not admit an arbitrary key
    void closed.$.user.arbitrary;

    // ── honest OPEN-key uncertainty ────────────────────────────────────────
    // The original unchecked promises are retained below as rejected accesses.
    // Unknown dynamic access is the owner-authorized v16 compatibility change.
    // (Bracket syntax is forced by `noPropertyAccessFromIndexSignature`; it is a
    // lint affordance, not an API design statement.)
    const open = signalTree({ rows: { a: { id: 'a', n: 1 } } as Record<string, Row> });
    // @ts-expect-error arbitrary Record access has no proven handle topology
    const _openId: string = open.$.rows['arbitrary'].id();
    // @ts-expect-error arbitrary Record access has no proven handle topology
    const _openN: number = open.$.rows['arbitrary'].n();
    void _openId;
    void _openN;

    // ── HYBRID named-key inference ──────────────────────────────────────────
    // An index signature must NOT erase the named members beside it.
    const hybrid = signalTree<Hybrid>({ name: '', email: '' });
    const _hName: string = hybrid.$.name();
    const _hEmail: string = hybrid.$.email();
    void _hName;
    void _hEmail;
  });
});
