/**
 * TRANSACTION-SEMANTICS-2 — the black-box conformance contract.
 *
 * Specified in docs/research/transaction-semantics-2/. Laws L1..L18 are frozen.
 *
 * This module names NO implementation concept: no rollback, layers, MVCC,
 * baseline, TurnStore or SubjectId representation. Every candidate maps its
 * own mechanism onto `SemanticCandidate` and runs these same cases unmodified.
 * The suite must survive a total rewrite of transactions.ts.
 */

/** Opaque handle to a speculative unit. */
export type Handle = { readonly __brand: 'contribution' };

/** Resolved values keyed by a test-chosen location name. */
export type Snapshot = Record<string, unknown>;

/**
 * How an authority event orders itself. Independent of what it settles —
 * a single response can be a snapshot AND versioned AND settle a contribution.
 */
export type AuthorityOrder =
  | { kind: 'snapshot' }
  | { kind: 'versioned'; revision: number }
  | { kind: 'unordered' };

/** What an authority event says about a specific contribution. */
export type SettlementRelation =
  | { kind: 'none' }
  | { kind: 'accepts'; contribution: Handle }
  | { kind: 'rejects'; contribution: Handle }
  | { kind: 'includes'; contribution: Handle };

export type AuthorityEvent = {
  truth?: () => void;
  order: AuthorityOrder;
  settlement?: SettlementRelation | readonly SettlementRelation[];
};

export type SettlementResult =
  | { status: 'settled' }
  | { status: 'refused'; reason: unknown }
  | { status: 'already-settled' };

/** Disposition of a contribution. L9 requires every one to be defined. */
export type Disposition =
  | 'pending'
  | 'committed'
  | 'superseded'
  | 'rejected'
  | 'conflicted';

export type SettlementView = {
  disposition: Disposition;
  /** True while this unit can still be settled (L2, L14). */
  retainsAuthority: boolean;
};

export interface SemanticCandidate {
  beginContribution(fn: () => void): Handle;

  settleAccept(handle: Handle): SettlementResult;
  settleReject(handle: Handle): SettlementResult;

  applyAuthority(event: AuthorityEvent): void;

  /** Server / current truth, with no pending overlay. */
  readCanonical(): Snapshot;
  /** Canonical plus the resolved pending projection. */
  readVisible(): Snapshot;
  readSettlementState(handle: Handle): SettlementView;

  observeVisible(cb: (s: Snapshot) => void): () => void;
}

/** A candidate factory plus the locations the cases operate on. */
export type CandidateFactory = () => Promise<{
  candidate: SemanticCandidate;
  /** Write a scalar location. Used only inside contribution/authority fns. */
  write: (key: string, value: unknown) => void;
  /** Let pending work flush. */
  flush: () => Promise<void>;
  dispose: () => void;
}>;

export type LawId =
  | 'L1'
  | 'L2'
  | 'L3'
  | 'L4'
  | 'L5'
  | 'L6'
  | 'L7'
  | 'L8'
  | 'L9'
  | 'L10'
  | 'L11'
  | 'L12'
  | 'L13'
  | 'L14'
  | 'L15'
  | 'L16'
  | 'L17'
  | 'L18';

export type CaseResult = {
  id: string;
  laws: LawId[];
  status: 'held' | 'violated' | 'unsupported' | 'error';
  violation?: string;
  unsupported?: string;
  error?: string;
};

type Case = {
  id: string;
  laws: LawId[];
  run: (f: CandidateFactory) => Promise<string | undefined>;
};

const eq = (a: unknown, b: unknown) => Object.is(a, b);

const expectVisible = (
  got: Snapshot,
  want: Record<string, unknown>,
  label: string
): string | undefined => {
  for (const [k, v] of Object.entries(want)) {
    if (!eq(got[k], v)) {
      return `${label}: expected ${k}=${String(v)}, got ${String(got[k])}`;
    }
  }
  return undefined;
};

// ───────────────────────────── scalar ownership ─────────────────────────────

const SCALAR_CASES: Case[] = [
  {
    id: 'S01 one pending writer, rejected',
    laws: ['L2', 'L3'],
    run: async (f) => {
      const { candidate, write, flush } = await f();
      const p = candidate.beginContribution(() => write('x', 1));
      await flush();
      if (!eq(candidate.readVisible()['x'], 1)) {
        return 'speculative value not visible while pending';
      }
      const r = candidate.settleReject(p);
      if (r.status !== 'settled') return `reject refused: ${r.status}`;
      return expectVisible(candidate.readVisible(), { x: 0 }, 'after reject');
    },
  },
  {
    id: 'S03 two pending, same location — reject OLDER',
    laws: ['L3', 'L4'],
    run: async (f) => {
      const { candidate, write, flush } = await f();
      const p1 = candidate.beginContribution(() => write('y', 1));
      await flush();
      candidate.beginContribution(() => write('y', 2));
      await flush();

      const r = candidate.settleReject(p1);
      if (r.status === 'refused') {
        // Atomic refusal is permitted; nothing may have moved.
        return expectVisible(
          candidate.readVisible(),
          { y: 2 },
          'refused reject must not move state'
        );
      }
      // L4: P2 is still live and must be untouched.
      return expectVisible(
        candidate.readVisible(),
        { y: 2 },
        'rejecting the older writer destroyed the newer live value'
      );
    },
  },
  {
    id: 'S04 THREE pending, same location — reject MIDDLE',
    laws: ['L3', 'L4'],
    run: async (f) => {
      const { candidate, write, flush } = await f();
      candidate.beginContribution(() => write('y', 1));
      await flush();
      const middle = candidate.beginContribution(() => write('y', 2));
      await flush();
      candidate.beginContribution(() => write('y', 3));
      await flush();

      const r = candidate.settleReject(middle);
      if (r.status === 'refused') {
        return expectVisible(candidate.readVisible(), { y: 3 }, 'refused');
      }
      return expectVisible(
        candidate.readVisible(),
        { y: 3 },
        'rejecting the middle writer disturbed the newest'
      );
    },
  },
  {
    id: 'S05 reject OLDEST then settle newer — newer must not be lost',
    laws: ['L4', 'L9'],
    run: async (f) => {
      const { candidate, write, flush } = await f();
      const p1 = candidate.beginContribution(() => {
        write('x', 1);
        write('y', 1);
      });
      await flush();
      const p2 = candidate.beginContribution(() => {
        write('y', 2);
        write('z', 2);
      });
      await flush();

      const first = candidate.settleReject(p1);
      if (first.status === 'refused') {
        return expectVisible(
          candidate.readVisible(),
          { x: 1, y: 2, z: 2 },
          'refused reject must not move state'
        );
      }
      const second = candidate.settleAccept(p2);
      if (second.status !== 'settled')
        return `accept refused: ${second.status}`;
      return expectVisible(
        candidate.readVisible(),
        { x: 0, y: 2, z: 2 },
        'an ACCEPTED contribution lost one of its own fields'
      );
    },
  },
  {
    id: 'S07 reject NEWEST — older pending value survives',
    laws: ['L3', 'L4'],
    run: async (f) => {
      const { candidate, write, flush } = await f();
      candidate.beginContribution(() => write('y', 1));
      await flush();
      const p2 = candidate.beginContribution(() => write('y', 2));
      await flush();

      const r = candidate.settleReject(p2);
      if (r.status !== 'settled') return `reject refused: ${r.status}`;
      return expectVisible(
        candidate.readVisible(),
        { y: 1 },
        "rejecting the newer writer did not restore the older writer's value"
      );
    },
  },
  {
    id: 'S11 reject both — no rejected value may remain',
    laws: ['L5'],
    run: async (f) => {
      const { candidate, write, flush } = await f();
      const p1 = candidate.beginContribution(() => write('y', 1));
      await flush();
      const p2 = candidate.beginContribution(() => write('y', 2));
      await flush();

      const a = candidate.settleReject(p1);
      const b = candidate.settleReject(p2);
      if (a.status === 'refused' || b.status === 'refused') {
        // Refusal is allowed, but then the refused unit must still be pending.
        const stillPending =
          candidate.readSettlementState(a.status === 'refused' ? p1 : p2)
            .disposition === 'pending';
        return stillPending
          ? undefined
          : 'a refused settlement did not leave the unit pending';
      }
      return expectVisible(
        candidate.readVisible(),
        { y: 0 },
        'both rejected, yet a rejected value is still visible'
      );
    },
  },
  {
    id: 'S10 accept NEWER then accept OLDER — settlement must not reorder',
    laws: ['L6'],
    run: async (f) => {
      const { candidate, write, flush } = await f();
      const p1 = candidate.beginContribution(() => write('y', 1));
      await flush();
      const p2 = candidate.beginContribution(() => write('y', 2));
      await flush();

      const a = candidate.settleAccept(p2);
      if (a.status !== 'settled') return `accept p2 refused: ${a.status}`;
      const midway = expectVisible(
        candidate.readVisible(),
        { y: 2 },
        'after accepting the newer writer'
      );
      if (midway) return midway;

      const b = candidate.settleAccept(p1);
      if (b.status === 'refused') return undefined; // defined refusal is legal
      return expectVisible(
        candidate.readVisible(),
        { y: 2 },
        'accepting the OLDER writer later made it win — settlement reordered authorship'
      );
    },
  },
];

// ──────────────────────── authority / frontier (L11, L12) ────────────────────

const AUTHORITY_CASES: Case[] = [
  {
    id: 'A1 unrelated snapshot advances canonical, P1 stays pending',
    laws: ['L11'],
    run: async (f) => {
      const { candidate, write, flush } = await f();
      const p1 = candidate.beginContribution(() => write('y', 1));
      await flush();

      candidate.applyAuthority({
        truth: () => write('y', 2),
        order: { kind: 'snapshot' },
        settlement: { kind: 'none' },
      });
      await flush();

      const canonical = candidate.readCanonical();
      if (!eq(canonical['y'], 2)) {
        return `canonical did not advance: expected 2, got ${String(
          canonical['y']
        )}`;
      }
      const view = candidate.readSettlementState(p1);
      if (view.disposition !== 'pending') {
        return `an UNRELATED snapshot settled P1: disposition=${view.disposition}`;
      }
      return expectVisible(
        candidate.readVisible(),
        { y: 1 },
        'pending overlay was dropped by an unrelated snapshot'
      );
    },
  },
  {
    id: 'A2 correlated ACCEPT settles the contribution',
    laws: ['L11'],
    run: async (f) => {
      const { candidate, write, flush } = await f();
      const p1 = candidate.beginContribution(() => write('y', 1));
      await flush();

      candidate.applyAuthority({
        truth: () => write('y', 1),
        order: { kind: 'versioned', revision: 11 },
        settlement: { kind: 'accepts', contribution: p1 },
      });
      await flush();

      const view = candidate.readSettlementState(p1);
      if (view.disposition === 'pending') {
        return 'a correlated ACCEPT left the contribution pending';
      }
      return expectVisible(candidate.readVisible(), { y: 1 }, 'after accept');
    },
  },
  {
    id: 'A5 fresh snapshot, no relation — settlement must NOT be invented',
    laws: ['L11', 'L12'],
    run: async (f) => {
      const { candidate, write, flush } = await f();
      const p1 = candidate.beginContribution(() => write('y', 1));
      await flush();

      candidate.applyAuthority({
        truth: () => write('y', 5),
        order: { kind: 'snapshot' },
        settlement: { kind: 'none' },
      });
      await flush();

      const view = candidate.readSettlementState(p1);
      return view.disposition === 'pending'
        ? undefined
        : `settlement was invented from a bare snapshot: ${view.disposition}`;
    },
  },
  {
    id: 'A6 stale versioned event must not regress canonical',
    laws: ['L12'],
    run: async (f) => {
      const { candidate, write, flush } = await f();
      candidate.applyAuthority({
        truth: () => write('y', 7),
        order: { kind: 'versioned', revision: 20 },
      });
      await flush();
      candidate.applyAuthority({
        truth: () => write('y', 3),
        order: { kind: 'versioned', revision: 11 },
      });
      await flush();

      return eq(candidate.readCanonical()['y'], 7)
        ? undefined
        : `canonical regressed to a STALE revision: ${String(
            candidate.readCanonical()['y']
          )}`;
    },
  },
];

// ───────────────────────── settlement terminality (L14) ─────────────────────

const TERMINALITY_CASES: Case[] = [
  {
    // Historical assertion frozen below: it treats every repeated `settled`
    // result as fresh success. L14/MATRIX also permit a defined non-mutating
    // no-op. A void native return cannot distinguish those outcomes. Preserve
    // this first-red instrument result; supplemental sentinel checks measure
    // non-mutation independently without inventing an already-settled status.
    id: 'F06 reject succeeds, then reject again',
    laws: ['L14'],
    run: async (f) => {
      const { candidate, write, flush } = await f();
      const p = candidate.beginContribution(() => write('x', 1));
      await flush();
      const first = candidate.settleReject(p);
      if (first.status !== 'settled') return `first reject: ${first.status}`;

      const before = candidate.readVisible();
      const second = candidate.settleReject(p);
      if (second.status === 'settled') {
        return 'a second reject reported a fresh successful settlement';
      }
      return expectVisible(
        candidate.readVisible(),
        before,
        'a second settlement attempt mutated state'
      );
    },
  },
  {
    id: 'F07 reject succeeds, then accept must not resurrect',
    laws: ['L14', 'L5'],
    run: async (f) => {
      const { candidate, write, flush } = await f();
      const p = candidate.beginContribution(() => write('x', 1));
      await flush();
      const first = candidate.settleReject(p);
      if (first.status !== 'settled') return `reject: ${first.status}`;

      candidate.settleAccept(p);
      return expectVisible(
        candidate.readVisible(),
        { x: 0 },
        'accept after a successful reject resurrected the contribution'
      );
    },
  },
];

export const ALL_CASES: Case[] = [
  ...SCALAR_CASES,
  ...AUTHORITY_CASES,
  ...TERMINALITY_CASES,
];

/** Missing candidate semantics are evidence gaps, never passing cases. */
export class UnsupportedSemantic extends Error {}

/** Preserve every result while making instrument failures fail the invocation. */
export class ContractExecutionError extends Error {
  constructor(readonly results: CaseResult[]) {
    super(
      `Contract execution failed: ${
        results.filter((r) => r.status === 'error').length
      } case(s)`
    );
  }
}

/** Runs the existing cases, disposes every fixture, and rejects execution errors. */
export async function runContract(
  factory: CandidateFactory
): Promise<CaseResult[]> {
  const out: CaseResult[] = [];
  for (const c of ALL_CASES) {
    const fixtures: Awaited<ReturnType<CandidateFactory>>[] = [];
    let result: CaseResult;
    try {
      const violation = await c.run(async () => {
        let fixture: Awaited<ReturnType<CandidateFactory>>;
        try {
          fixture = await factory();
        } catch (cause) {
          // Even an UnsupportedSemantic from a constructor means no candidate
          // ran; it cannot turn an entirely broken factory into a green report.
          throw new Error(
            `Candidate construction failed: ${describeError(cause)}`
          );
        }
        fixtures.push(fixture);
        return fixture;
      });
      result = {
        id: c.id,
        laws: c.laws,
        status: violation ? 'violated' : 'held',
        violation,
      };
    } catch (e) {
      result =
        e instanceof UnsupportedSemantic
          ? {
              id: c.id,
              laws: c.laws,
              status: 'unsupported',
              unsupported: e.message,
            }
          : {
              id: c.id,
              laws: c.laws,
              status: 'error',
              error: describeError(e),
            };
    } finally {
      // Cases can return early or throw; ownership still ends at this boundary.
      for (const fixture of fixtures.reverse()) {
        try {
          fixture.dispose();
        } catch (e) {
          result = {
            id: c.id,
            laws: c.laws,
            status: 'error',
            error: `${result?.error ?? ''} Disposal failed: ${describeError(
              e
            )}`.trim(),
          };
        }
      }
    }
    out.push(result);
  }
  if (out.some((r) => r.status === 'error'))
    throw new ContractExecutionError(out);
  return out;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
