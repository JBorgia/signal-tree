import { leaf, signalTree, type Location } from '../index';

const handler = () => undefined;
class Thing {}

const tree = signalTree({
  count: 0,
  range: leaf({ start: 0, end: 10 }),
  callback: leaf<null | (() => void)>(null),
  constructor: leaf<typeof Thing | null>(null),
  branch: { value: 1 },
});

const count: Location<number> = tree.$.count;
const range: Location<{ start: number; end: number }> = tree.$.range;
const snapshot: {
  count: number;
  range: { start: number; end: number };
  callback: null | (() => void);
  constructor: typeof Thing | null;
  branch: { value: number };
} = tree.$();
void [count, range, snapshot];

tree.$.count(1);
tree.$.count((current) => current + 1);
tree.$.range({ start: 2, end: 8 });
tree.$.callback(leaf(handler));
tree.$.constructor(leaf(Thing));

// @ts-expect-error an explicit object leaf has no descendant locations
tree.$.range.start();
// @ts-expect-error canonical locations do not expose Angular-shaped writers
tree.$.count.set(1);
// @ts-expect-error a naked callable is interpreted as an updater
tree.$.callback(handler);
// @ts-expect-error a bare constructor cannot enter the ordinary value overload
tree.$.constructor(Thing);
