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
const out: string[] = [];

async function probe(label: string, make: () => { $: Record<string, (v?: unknown) => unknown> }) {
  const seen: string[] = [];
  const off = getPathNotifier().subscribe('**', (n, p, path, _o, origin, _s, _pp, meta) => {
    seen.push(`${path} ${String(p)}->${String(n)} origin=${origin ?? (meta as { origin?: string })?.origin ?? '-'}`);
  });
  try {
    const tree = make();
    tree.$['total'](9600);
    external(() => tree.$['total'](10200));
    await settle();
    out.push(`${label.padEnd(34)} ${seen.length} frame(s) ${JSON.stringify(seen)}`);
    return seen;
  } finally {
    off();
  }
}

const mk = (enh?: unknown[]) => () =>
  (enh
    ? signalTree({ total: 12000 } as Cart, { enhancers: enh } as never)
    : signalTree({ total: 12000 } as Cart)) as never as {
    $: Record<string, (v?: unknown) => unknown>;
  };

describe('FLUSH-0 follow-up: which composition makes scalar writes observable?', () => {
  it('bare', async () => { await probe('bare (no enhancers)', mk()); });
  it('batching only', async () => { await probe('batching()', mk([batching()])); });
  it('restoration only', async () => { await probe('restoration()', mk([restoration()])); });
  it('transactions only', async () => { await probe('transactions()', mk([transactions()])); });
  it('restoration + transactions', async () => {
    await probe('restoration()+transactions()', mk([restoration(), transactions()]));
  });

  it('VERDICT', () => {
    writeFileSync('/tmp/flush-probe.txt', out.join('\n') + '\n');
    expect(out.length).toBe(5);
  });
});
