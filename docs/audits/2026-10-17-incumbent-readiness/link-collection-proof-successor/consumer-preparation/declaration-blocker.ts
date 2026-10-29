import { link, signalTree } from '@signal-tree/angular';
const tree = signalTree({ status: 'open' });
const connection = link(tree.$.status, { set: () => undefined });
// Capability probe intentionally must fail for the frozen public Link type.
// No @ts-expect-error, private import, structural cast or alternate declaration.
connection.declare;
connection.dispose();
tree.destroy();
