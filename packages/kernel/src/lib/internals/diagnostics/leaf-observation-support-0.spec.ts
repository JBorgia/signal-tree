/**
 * LEAF-OBSERVATION-SUPPORT-0 — can S2 support be decided STRUCTURALLY?
 *
 * FLUSH-0 measured which compositions make scalar leaves observable. This asks
 * whether a construction-time fact predicts that, so the capture lease can
 * refuse synchronously instead of listening to see what happens.
 *
 * ⚠️ The candidate predicate must be verified, not assumed from its name:
 *
 *     hasCapability('causal-runtime') === true  =>  scalar leaves observable
 *
 * `interceptLeafSignals` is called DIRECTLY by the restoration and transactions
 * enhancers — no capability gates it — and `RuntimeTreePlan` documents that
 * `causal-runtime` can be requested through `capabilities` WITHOUT an enhancer.
 * That configuration is the adversarial case below.
 */
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { batching } from '../../../enhancers/batching/batching';
import { restoration } from '../../../enhancers/restoration/restoration';
import { transactions } from '../../../enhancers/transactions/transactions';
import { external } from '../../external';
import { getPathNotifier } from '../../path-notifier';
import { signalTree } from '../../signal-tree';

type Cart = { total: number };
const settle = async () => { await Promise.resolve(); await Promise.resolve(); };
const rows: string[] = [];

/** Empirical: does a scalar leaf write reach an observer? */
async function leafObservable(make: () => unknown): Promise<boolean> {
  let seen = 0;
  const off = getPathNotifier().subscribe('**', (_n, _p, path) => {
    if (path === 'total') seen++;
  });
  try {
    const tree = make() as { $: Record<string, (v?: unknown) => unknown> };
    tree.$['total'](9600);
    external(() => tree.$['total'](10200));
    await settle();
    return seen > 0;
  } finally {
    off();
  }
}

async function probe(label: string, make: () => unknown) {
  const observable = await leafObservable(make);
  rows.push(`${label.padEnd(38)} leafObservable=${observable ? 'YES' : 'NO '}`);
  return observable;
}

describe('LEAF-OBSERVATION-SUPPORT-0', () => {
  it('bare tree', async () => {
    expect(await probe('bare', () => signalTree({ total: 12000 } as Cart))).toBe(false);
  });

  it('batching only', async () => {
    expect(
      await probe('batching()', () =>
        signalTree({ total: 12000 } as Cart, { enhancers: [batching()] } as never)
      )
    ).toBe(false);
  });

  it('transactions', async () => {
    expect(
      await probe('transactions()', () =>
        signalTree({ total: 12000 } as Cart, { enhancers: [transactions()] } as never)
      )
    ).toBe(true);
  });

  it('restoration', async () => {
    expect(
      await probe('restoration()', () =>
        signalTree({ total: 12000 } as Cart, { enhancers: [restoration()] } as never)
      )
    ).toBe(true);
  });

  it('both', async () => {
    expect(
      await probe('transactions()+restoration()', () =>
        signalTree({ total: 12000 } as Cart, {
          enhancers: [restoration(), transactions()],
        } as never)
      )
    ).toBe(true);
  });

  /**
   * THE ADVERSARIAL CASE. `causal-runtime` requested directly, with NO enhancer
   * to install leaf interception. If this is observable, the capability is a
   * safe predicate. If not, `hasCapability('causal-runtime')` would claim
   * support that does not exist.
   */
  it('capabilities:[causal-runtime] WITHOUT an enhancer', async () => {
    const observable = await probe('capabilities:[causal-runtime]', () =>
      signalTree({ total: 12000 } as Cart, {
        capabilities: ['causal-runtime'],
      } as never)
    );
    rows.push(
      observable
        ? 'VERDICT: capability implies observability -> structural predicate is SAFE'
        : 'VERDICT: capability does NOT imply observability -> predicate UNSAFE'
    );
    writeFileSync('/tmp/leaf-support-0.txt', rows.join('\n') + '\n');
  });
});
