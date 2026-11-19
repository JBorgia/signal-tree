import type * as Kernel from '../../src/index';
export const receiptCases = ['field', 'row', 'collection'].flatMap(kind =>
  [false, true].map(dependent => ({ kind, dependent, name: `${kind} changed receipt / ${dependent ? 'dependent' : 'independent'}` }))
);
const drain = async () => { for (let i = 0; i < 60; i++) await Promise.resolve(); };
const check = (value: boolean, message: string) => { if (!value) throw new Error(message); };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export async function runReceiptCase(api: typeof Kernel, test: typeof receiptCases[number]): Promise<void> {
  const tree = api.signalTree({ rows: api.entityMap<{ id: string; x: number }>() });
  const foreign = api.signalTree({ x: 0 }, { enhancers: [api.transactions()] });
  tree.$.rows.setAll([{ id: 'r', x: 0 }]);
  const row = tree.$.rows.byIdOrFail('r');
  const sent: unknown[] = [];
  const target = { set: (value: unknown) => { sent.push(JSON.parse(JSON.stringify(value))); } };
  const relation = test.kind === 'field' ? api.link(row.x, target)
    : test.kind === 'row' ? api.link(row, target) : api.link(tree.$.rows, target);
  let ownerSettled = false;
  let owner: ReturnType<typeof foreign.transact> | undefined;
  const expected = (x: number) => test.kind === 'field' ? x : test.kind === 'row' ? { id: 'r', x } : [{ id: 'r', x }];
  const write = (x: number) => {
    if (test.kind === 'field') row.x(x);
    else if (test.kind === 'row') row({ id: 'r', x });
    else tree.$.rows.setAll([{ id: 'r', x }]);
  };
  try {
    await drain(); sent.length = 0;
    owner = foreign.transact(() => foreign.$.x(7));
    const inspection = JSON.stringify(owner.inspect());
    const receipt = relation.declare(test.dependent ? { kind: 'dependent', owners: [owner] } : { kind: 'independent' },
      () => write(test.dependent ? foreign.$.x() + 2 : 9));
    check(row.x() === 9, 'actual changed physical9');
    check(receipt.read().state !== 'no-write', 'changed write must not return no-write');
    check(JSON.stringify(owner.inspect()) === inspection && foreign.$.x() === 7, 'foreign ownership unchanged');
    await drain();
    check(receipt.read().state !== 'no-write', 'changed write must not settle as no-write');
    if (test.dependent) {
      check(same(receipt.read(), { state: 'held', reason: 'pending-dependency' }), 'dependent receipt held before confirm');
      check(sent.length === 0, 'dependent has no early transport');
      let settled = false; const wait = relation.settled().then(() => { settled = true; });
      await drain(); check(!settled, 'dependent settled remains pending');
      owner.confirm(); ownerSettled = true; await drain(); await wait;
      check(settled, 'dependent settles after confirmation');
    } else {
      check(same(sent, [expected(9)]), 'independent useful9 while foreign pending');
      owner.confirm(); ownerSettled = true; await drain();
    }
    check(same(sent, [expected(9)]), 'exact useful9 once');
    check(receipt.read().state === 'started', 'useful transport terminal receipt');
    const earlier = JSON.stringify(receipt.read());
    const next = relation.declare({ kind: 'independent' }, () => write(11));
    await drain(); await relation.settled();
    check(next.read().state !== 'no-write', 'second actual changed write');
    check(same(sent, [expected(9), expected(11)]), 'two exact useful transports');
    check(JSON.stringify(receipt.read()) === earlier, 'earlier receipt stays terminal after newer write');
    relation.dispose(); await drain();
    check(JSON.stringify(receipt.read()) === earlier, 'earlier terminal receipt survives disposal');
    check(same(sent, [expected(9), expected(11)]), 'no duplicate after settlement/disposal');
  } finally { relation.dispose(); if (!ownerSettled) owner?.confirm(); tree.destroy(); foreign.destroy(); }
}
