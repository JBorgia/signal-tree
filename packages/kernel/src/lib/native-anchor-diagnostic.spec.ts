import { expect, it } from 'vitest';
import { entityMap, signalTree, transactions } from '../index';
import { getEntityPublicationAnchor, getEntityPublicationBinding } from './internals/entity-publication';
import { getNodeAddress, getPositionRegistry } from './internals/position-registry';
import { captureNativeOccurrence } from './internals/native-occurrence';

for (const enhanced of [false, true]) it(`native anchor source identity diagnostic enhanced=${enhanced}`, () => {
  const tree = signalTree({ rows: entityMap<{id:string;n:number},string>() }, {enhancers:enhanced?[transactions()]:[]});
  try {
    const rows = tree.$.rows;
    rows.addOne({id:'a', n:1});
    const field = rows.byIdOrFail('a').n;
    const binding = getEntityPublicationBinding(field);
    expect(binding).toBeDefined();
    const anchor = getEntityPublicationAnchor(binding!.source);
    expect(anchor).toBeDefined();
    expect(getPositionRegistry(anchor)).toBe(getPositionRegistry(rows));
    expect(getNodeAddress(rows)).toEqual(['rows']);
    expect(getNodeAddress(anchor)).toEqual(['rows']);
    expect(captureNativeOccurrence(field).source).toBe(field);
  } finally { tree.destroy(); }
});
