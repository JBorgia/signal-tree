import { writeFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { signalTree } from '../../lib/signal-tree';
import { withWriteContext } from '../../lib/write-context';
import { transactions } from './transactions';
import {
  runContract,
  type CandidateFactory,
  type Handle,
  type SemanticCandidate,
  type SettlementResult,
  type Snapshot,
} from './semantics-contract';

/**
 * TRANSACTION-SEMANTICS-2 run against the CURRENT implementation.
 *
 * This is candidate A of the architecture competition. It maps transact() /
 * confirm() / rollback() onto the semantic adapter; a draft/MVCC candidate
 * would map draft()/merge()/discard() onto the same contract and run the same
 * cases unmodified.
 *
 * Predictions were recorded in docs/research/transaction-semantics-2/
 * PREDICTIONS.md BEFORE this file existed and are not revised afterwards.
 * Violations found here are EVIDENCE, and are reported, not fixed.
 */

const flushTwice = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

type Pending = { confirm(): void; rollback(): void };

const makeCurrent: CandidateFactory = async () => {
  const tree = signalTree(
    { x: 0, y: 0, z: 0 },
    { enhancers: [transactions()] }
  ) as unknown as {
    $: Record<string, (v?: unknown) => unknown>;
    transact?: (fn: () => void) => Pending;
    transaction?: (fn: () => void) => Pending;
    __transactions: { getPendingTurnIds(): number[] };
  };

  const open = tree.transact ?? tree.transaction;
  if (!open) throw new Error('no transaction entry point on this tree');

  const write = (key: string, value: unknown) => {
    tree.$[key]?.(value);
  };
  const read = (): Snapshot => ({
    x: tree.$['x']?.(),
    y: tree.$['y']?.(),
    z: tree.$['z']?.(),
  });

  const handles = new Map<Handle, { pending: Pending; settled: boolean }>();

  /**
   * The current model keeps no canonical/pending split: there is one live
   * tree. Canonical is therefore approximated as "the last authority truth
   * written", tracked here by the adapter rather than read from the kernel.
   * That approximation is itself a finding — a model with no canonical layer
   * cannot answer readCanonical() from its own state.
   */
  const canonical: Snapshot = { x: 0, y: 0, z: 0 };
  let highestRevision = -Infinity;

  const candidate: SemanticCandidate = {
    beginContribution(fn) {
      const h = {} as Handle;
      handles.set(h, { pending: open(fn), settled: false });
      return h;
    },
    settleAccept(handle): SettlementResult {
      const entry = handles.get(handle);
      if (!entry) return { status: 'refused', reason: 'unknown handle' };
      if (entry.settled) return { status: 'already-settled' };
      try {
        entry.pending.confirm();
        entry.settled = true;
        return { status: 'settled' };
      } catch (e) {
        return { status: 'refused', reason: e };
      }
    },
    settleReject(handle): SettlementResult {
      const entry = handles.get(handle);
      if (!entry) return { status: 'refused', reason: 'unknown handle' };
      if (entry.settled) return { status: 'already-settled' };
      try {
        entry.pending.rollback();
        entry.settled = true;
        return { status: 'settled' };
      } catch (e) {
        return { status: 'refused', reason: e };
      }
    },
    applyAuthority(event) {
      const order = event.order;
      if (order.kind === 'versioned') {
        // L12: a stale revision must not advance canonical truth.
        if (order.revision <= highestRevision) return;
        highestRevision = order.revision;
      }
      if (event.truth) {
        withWriteContext(
          { intent: 'system', participation: 'realized' },
          event.truth
        );
        Object.assign(canonical, read());
      }
      // The current model has no notion of a settlement RELATION: an
      // authority write is simply a later effect. Correlated accept/reject
      // therefore cannot be honoured, which is what A2 measures.
    },
    readCanonical() {
      return { ...canonical };
    },
    readVisible() {
      return read();
    },
    readSettlementState(handle) {
      const entry = handles.get(handle);
      const open = (tree.__transactions?.getPendingTurnIds?.() ?? []).length > 0;
      if (!entry) {
        return { disposition: 'conflicted', retainsAuthority: false };
      }
      if (entry.settled) {
        return { disposition: 'committed', retainsAuthority: false };
      }
      return {
        disposition: open ? 'pending' : 'conflicted',
        retainsAuthority: open,
      };
    },
    observeVisible() {
      return () => undefined;
    },
  };

  return { candidate, write, flush: flushTwice };
};

describe('TRANSACTION-SEMANTICS-2 — candidate A (current implementation)', () => {
  it('reports a disposition table; violations are evidence, not failures', async () => {
    const results = await runContract(makeCurrent);

    const violated = new Map<string, string[]>();
    for (const r of results) {
      const note = r.error ? `ERROR ${r.error}` : r.violation;
      if (!note) continue;
      for (const law of r.laws) {
        const list = violated.get(law) ?? [];
        list.push(`${r.id} — ${note}`);
        violated.set(law, list);
      }
    }

    const lines: string[] = [
      '',
      'TRANSACTION-SEMANTICS-2 / candidate A — current implementation',
      '',
    ];
    for (const r of results) {
      const note = r.error ? `ERROR ${r.error}` : r.violation;
      lines.push(`  ${note ? 'VIOLATION' : 'holds    '}  ${r.id}`);
      if (note) lines.push(`             ${note}`);
    }
    lines.push('');
    lines.push(
      `  laws violated: ${
        [...violated.keys()].sort().join(', ') || '(none)'
      }`
    );
    lines.push(
      `  cases: ${results.filter((r) => !r.violation && !r.error).length} held, ${
        results.filter((r) => r.violation || r.error).length
      } violated, ${results.length} total`
    );
    lines.push('');
    const report = lines.join('\n');
    console.log(report);
    if (process.env['SEMANTICS_REPORT']) {
      writeFileSync(process.env['SEMANTICS_REPORT'], report, 'utf8');
    }

    // The contract must RUN. It is not asserted green: the current
    // implementation is expected to violate most of these laws, and the
    // disposition table above is the deliverable.
    expect(results.length).toBeGreaterThan(0);
  });
});
