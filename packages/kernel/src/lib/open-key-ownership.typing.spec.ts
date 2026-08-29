import { describe, it } from 'vitest';

import { signalTree } from './signal-tree';

/**
 * OPEN-KEY-OWNERSHIP-0 — TYPE AUTHORITY MEASUREMENT.
 *
 * ⚠️ NO CASTS. §29.7a — a cast invalidates type-evidence unless the cast IS the
 * subject. The subject here is exactly what the public typing PROMISES, so a
 * single `as never` would void the whole file.
 *
 * The question separating OPEN-A from OPEN-B is not "can recursiveUpdate create
 * a child". It is whether an open-key object type genuinely promises
 * independently addressable child locations for keys that do not exist at
 * construction.
 */
type Row = { id: string; n: number };
type Closed = { a: Row; b?: Row };
type Open = Record<string, Row>;
type Hybrid = { fixed: Row; [key: string]: Row };

describe('open-key ownership — what does the TYPE promise?', () => {
  it('compiles', () => {
    const row: Row = { id: 'a', n: 1 };

    // ── TYPE-1  CLOSED ──────────────────────────────────────────────────────
    const closed = signalTree({ rows: { a: row } as Closed });
    closed.$.rows.a.n();
    void closed.$.rows.b;
    // @ts-expect-error a closed object type must not admit an arbitrary key
    void closed.$.rows.arbitrary;

    // ── TYPE-2  OPEN  Record<string, Row> ───────────────────────────────────
    const open = signalTree({ rows: { a: row } as Open });
    void open.$.rows['a'];
    // Does the public typing promise a descendant for a key that has never
    // existed at runtime? If this line compiles, the answer is yes.
    void open.$.rows['arbitraryKeyNeverMaterialised'];
    void open.$.rows['also-never-materialised'];

    // ── TYPE-3  HYBRID index signature ──────────────────────────────────────
    const hybrid = signalTree({ rows: { fixed: row } as Hybrid });
    void hybrid.$.rows.fixed;
    void hybrid.$.rows['arbitrary'];
  });
});
