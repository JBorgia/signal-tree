import { entityMap, signalTree as neutralSignalTree } from '@signal-tree/kernel';

import { signalTree as angularSignalTree } from '../index';

type Row = { id: string; value: number };

describe('construction-bound Angular realization', () => {
  it('realizes tree leaves and derived recipes as universal locations', () => {
    const tree = angularSignalTree(
      { count: 1 },
      { derived: ($) => ({ doubled: () => $.count() * 2 }) }
    );

    expect(typeof tree.$.count.peek).toBe('function');
    expect(typeof tree.$.count.subscribe).toBe('function');
    expect(typeof tree.$.doubled).toBe('function');

    tree.$.count(2);
    expect(tree.$.doubled()).toBe(4);
    tree.destroy();
  });

  it('realizes EntityMap fields and readonly projections as locations', () => {
    const tree = angularSignalTree({
      rows: entityMap<{ id: string; value: number }, string>({
        selectId: (row) => row.id,
      }),
    });
    tree.$.rows.addOne({ id: 'a', value: 1 });
    const value = tree.$.rows.byIdOrFail('a').value;

    expect(typeof value).toBe('function');
    expect(value.asReadonly()).toBe(value);
    expect(value.asReadonly()()).toBe(1);
    tree.destroy();
  });

  it('realizes EntityMap empty as a stable location', () => {
    const tree = angularSignalTree({
      rows: entityMap<Row, string>({ selectId: (row) => row.id }),
    });

    expect(tree.$.rows.empty).toBe(tree.$.rows.empty);
    expect(typeof tree.$.rows.empty).toBe('function');
    tree.destroy();
  });

  it('coexists with neutral construction through later lazy allocations', () => {
    const neutralBefore = neutralSignalTree({
      rows: entityMap<Row, string>({ selectId: (row) => row.id }),
    });
    const angular = angularSignalTree(
      {
        count: 1,
        rows: entityMap<Row, string>({ selectId: (row) => row.id }),
      },
      {
        derived: ($) => {
          const doubled = () => $.count() * 2;
          return { doubled, quadrupled: () => doubled() * 2 };
        },
      }
    );
    const neutralAfter = neutralSignalTree({ count: 2 });
    const angularAfter = angularSignalTree({
      rows: entityMap<Row, string>({ selectId: (row) => row.id }),
    });

    neutralBefore.$.rows.addOne({ id: 'n', value: 1 });
    angular.$.rows.addOne({ id: 'a', value: 2 });
    angularAfter.$.rows.addOne({ id: 'a2', value: 3 });

    expect(typeof neutralBefore.$.rows.byIdOrFail('n').value).toBe('function');
    expect(typeof neutralBefore.$.rows.where((row) => row.value > 0)).toBe('function');
    expect(typeof neutralAfter.$.count).toBe('function');
    expect(typeof angular.$.count).toBe('function');
    expect(typeof angular.$.doubled).toBe('function');
    expect(typeof angular.$.quadrupled).toBe('function');
    expect(typeof angular.$.rows.byIdOrFail('a').value).toBe('function');
    expect(typeof angular.$.rows.where((row) => row.value > 0)).toBe('function');
    expect(typeof angularAfter.$.rows.byIdOrFail('a2').value).toBe('function');
    expect(typeof angularAfter.$.rows.where((row) => row.value > 0)).toBe('function');
    expect(angular.$.quadrupled()).toBe(4);

    neutralBefore.destroy();
    angular.destroy();
    neutralAfter.destroy();
    angularAfter.destroy();
  });
});
