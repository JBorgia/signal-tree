import { signalTree } from '@signal-tree/angular';

type IsAny<T> = 0 extends (1 & T) ? true : false;
type IsUnknown<T> = IsAny<T> extends true ? false : unknown extends T ? true : false;
type Assert<T extends true> = T;

// Compile-only migration controls; production runtime is unchanged.
function verifyOpenRecords() {
  interface Hybrid extends Record<string, unknown> {
    title: string;
    readonly bind: number;
    name: number;
    nested: { n: number };
  }
  const tree = signalTree({
    scalar: {} as Record<string, number>,
    objects: {} as Record<string, { value: number }>,
    nestedRecords: {} as Record<string, Record<string, number>>,
    mixed: {} as Record<string, number | { n: number }>,
    hybrid: { title: 'a', bind: 1, name: 2, nested: { n: 1 } } as Hybrid,
    closed: { n: 1 },
  });
  type UnknownCall = Assert<IsUnknown<typeof tree.$.scalar['call']>>;
  type UnknownName = Assert<IsUnknown<typeof tree.$.scalar['name']>>;
  type UnknownLength = Assert<IsUnknown<typeof tree.$.scalar['length']>>;
  type UnknownKey = Assert<IsUnknown<typeof tree.$.scalar['x']>>;
  const checkUnknown: [UnknownCall, UnknownName, UnknownLength, UnknownKey] = [true, true, true, true];
  void checkUnknown;
  const arbitrary: unknown = tree.$.scalar['x'];
  const collision: unknown = tree.$.scalar['call'];
  // @ts-expect-error native representation does not prove a child handle
  void tree.$.scalar['x'].value;
  // @ts-expect-error unknown object-valued record cannot promise child topology
  void tree.$.objects['x'].value;
  // @ts-expect-error nested Records do not manufacture absent descendants
  void tree.$.nestedRecords['x']['y'];
  // @ts-expect-error mixed topology is also unknown at an arbitrary key
  void tree.$.mixed['x'].n;
  // @ts-expect-error closed objects still reject undeclared keys
  void tree.$.closed.missing;
  // @ts-expect-error hybrid arbitrary members remain unknown
  tree.$.hybrid['other']();
  tree.$.scalar({ x: 1, call: 2 });
  tree.$.objects({ x: { value: 1 } });
  tree.$.nestedRecords({ x: { y: 1 } });
  tree.$.mixed({ a: 1, b: { n: 2 } });
  tree.$.hybrid({ title: 'b', bind: 1, name: 2, nested: { n: 2 }, extra: true });
  // @ts-expect-error native-name masking must preserve known readonly children
  tree.$.hybrid.bind = tree.$.hybrid.name;
  tree.$.hybrid.name = tree.$.hybrid.bind;
  // @ts-expect-error whole-value writes retain their value constraint
  tree.$.scalar({ x: 'wrong' });
  const title: string = tree.$.hybrid.title();
  const nested: number = tree.$.hybrid.nested.n();
  tree.$.hybrid.nested.n.set(3);
  const closed: number = tree.$.closed.n();
  void [arbitrary, collision, title, nested, closed];
  tree.destroy();
}
void verifyOpenRecords;
