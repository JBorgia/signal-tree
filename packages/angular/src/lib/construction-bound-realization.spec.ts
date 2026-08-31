import { isSignal } from '@angular/core';
import { entityMap, signalTree as neutralSignalTree } from '@signal-tree/kernel';

import { signalTree as angularSignalTree } from '../index';

type Row = { id: string; value: number };

describe('construction-bound Angular realization', () => {
  it('realizes tree leaves and derived recipes as native Angular signals', () => {
    const tree = angularSignalTree(
      { count: 1 },
      { derived: ($) => ({ doubled: () => $.count() * 2 }) }
    );

    expect(isSignal(tree.$.count)).toBe(true);
    expect(isSignal(tree.$.doubled)).toBe(true);

    tree.$.count.set(2);
    expect(tree.$.doubled()).toBe(4);
    tree.destroy();
  });

  it('realizes EntityMap fields and readonly projections as Angular signals', () => {
    const tree = angularSignalTree({
      rows: entityMap<{ id: string; value: number }, string>({
        selectId: (row) => row.id,
      }),
    });
    tree.$.rows.addOne({ id: 'a', value: 1 });
    const value = tree.$.rows.byIdOrFail('a').value;

    expect(isSignal(value)).toBe(true);
    expect(isSignal(value.asReadonly())).toBe(true);
    expect(value.asReadonly()()).toBe(1);
    tree.destroy();
  });

  it('realizes EntityMap empty as a stable Angular signal', () => {
    const tree = angularSignalTree({
      rows: entityMap<Row, string>({ selectId: (row) => row.id }),
    });

    expect(tree.$.rows.empty).toBe(tree.$.rows.empty);
    expect(isSignal(tree.$.rows.empty)).toBe(true);
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

    expect(isSignal(neutralBefore.$.rows.byIdOrFail('n').value)).toBe(false);
    expect(isSignal(neutralBefore.$.rows.where((row) => row.value > 0))).toBe(false);
    expect(isSignal(neutralAfter.$.count)).toBe(false);

    expect(isSignal(angular.$.count)).toBe(true);
    expect(isSignal(angular.$.doubled)).toBe(true);
    expect(isSignal(angular.$.quadrupled)).toBe(true);
    expect(isSignal(angular.$.rows.byIdOrFail('a').value)).toBe(true);
    expect(isSignal(angular.$.rows.where((row) => row.value > 0))).toBe(true);
    expect(isSignal(angularAfter.$.rows.byIdOrFail('a2').value)).toBe(true);
    expect(isSignal(angularAfter.$.rows.where((row) => row.value > 0))).toBe(
      true
    );
    expect(angular.$.quadrupled()).toBe(4);

    neutralBefore.destroy();
    angular.destroy();
    neutralAfter.destroy();
    angularAfter.destroy();
  });
});
