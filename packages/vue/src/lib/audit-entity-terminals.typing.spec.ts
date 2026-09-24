import { signalTree, entityMap } from '../index';
import {
  treeCapabilities,
  treeRuntimeId,
  confirmedTurnReader,
} from '@signal-tree/kernel/internals';

type Row = {
  id: string;
  date: Date;
  bytes: Uint8Array;
  map: Map<string, number>;
};
const tree = signalTree({ rows: entityMap<Row, string>() });
const row = tree.$.rows.byIdOrFail('a');
const date: Date = row.date.value;
row.date.value = new Date();
const bytes: Uint8Array = row.bytes.value;
const map: Map<string, number> = row.map.value;
// @ts-expect-error Date payload methods are not native carrier methods
row.date.getTime();
// @ts-expect-error Map payload methods are not native carrier methods
row.map.get('x');
// @ts-expect-error typed-array members are not native carrier members
void row.bytes.byteLength;
treeCapabilities(tree);
treeRuntimeId(tree);
confirmedTurnReader(tree);
void [date, bytes, map];
tree.destroy();
