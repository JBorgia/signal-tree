import { signalTree, entityMap } from '../index';
import {
  treeCapabilities,
  treeRuntimeId,
  confirmedTurnReader,
} from '../internals';

type Row = {
  id: string;
  date: Date;
  bytes: Uint8Array;
  pattern: RegExp;
  map: Map<string, number>;
  optional: Date | undefined;
};
const tree = signalTree({ rows: entityMap<Row, string>() });
const row = tree.$.rows.byIdOrFail('a');
const date: Date = row.date();
row.date(new Date());
const bytes: Uint8Array = row.bytes();
const map: Map<string, number> = row.map();
const pattern: RegExp = row.pattern();
const optional: Date | undefined = row.optional();
// @ts-expect-error Date payload methods are not field-location methods
row.date.getTime();
// @ts-expect-error Map payload methods are not field-location methods
row.map.get('x');
// @ts-expect-error typed-array members are not field-location members
void row.bytes.byteLength;
treeCapabilities(tree);
treeRuntimeId(tree);
confirmedTurnReader(tree);
void [date, bytes, map, pattern, optional];
tree.destroy();
