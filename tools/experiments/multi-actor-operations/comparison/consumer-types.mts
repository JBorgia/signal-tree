import { entityMap, signalTree } from '@signal-tree/kernel';
import { SignalTreeApp } from './c1.mjs';

const tree = signalTree({ rows: entityMap<{ id: string; capacity: number }, string>() });
tree.$.rows.addOne({ id: 'a', capacity: 1 });
const count: number = tree.$.rows.count();
const capacity: number = tree.$.rows.byIdOrFail('a')().capacity;
// @ts-expect-error Installed declarations reject an invalid field value.
tree.$.rows.updateOne('a', { capacity: 'wrong' });
// @ts-expect-error Installed declarations reject the wrong key type.
tree.$.rows.removeOne(7);
tree.destroy();
const app = new SignalTreeApp({ apply: command => ({ commandId: command.commandId, status: 'applied' }) });
// @ts-expect-error Application typing does not accept authenticated actor claims.
app.create('a', { entityId: 'delivery-1', patch: {}, expected: {} }, { kind: 'verified' });
void count; void capacity;
