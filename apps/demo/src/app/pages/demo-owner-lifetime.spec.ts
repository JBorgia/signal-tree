import { type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MarkersDemoComponent } from '../examples/features/fundamentals/examples/markers/markers-demo.component';
import { EntitySortComparerDemoComponent } from '../examples/features/fundamentals/examples/entity-sort-comparer/entity-sort-comparer-demo.component';
import { DevtoolsDemoComponent } from '../examples/features/fundamentals/examples/enhancers/devtools-demo/devtools-demo.component';

interface OwnedDemo {
  store: { destroyed(): boolean };
}
const owners: readonly Type<OwnedDemo>[] = [
  MarkersDemoComponent,
  EntitySortComparerDemoComponent,
  DevtoolsDemoComponent,
];

describe('routed demonstration ownership', () => {
  it.each(owners)(
    'destroys the actual tree when %p closes',
    async (component) => {
      await TestBed.configureTestingModule({
        imports: [component],
      }).compileComponents();
      const fixture = TestBed.createComponent(component);
      fixture.detectChanges();
      const tree = fixture.componentInstance.store;
      expect(tree.destroyed()).toBe(false);
      fixture.destroy();
      expect(tree.destroyed()).toBe(true);
    }
  );

  it('records real counter commands and stops an in-flight replay when its route closes', async () => {
    jest.useFakeTimers();
    try {
      await TestBed.configureTestingModule({
        imports: [DevtoolsDemoComponent],
      }).compileComponents();
      const fixture = TestBed.createComponent(DevtoolsDemoComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.increment();
      component.increment();
      expect(component.counter()).toBe(2);
      expect(component.actionHistory).toHaveLength(2);
      const replayTimer = jest.spyOn(globalThis, 'setTimeout');
      const cancelTimer = jest.spyOn(globalThis, 'clearTimeout');
      const replay = component.replayActions();
      expect(component.counter()).toBe(3);
      const scheduled =
        replayTimer.mock.results[replayTimer.mock.results.length - 1]?.value;
      expect(scheduled).toBeDefined();
      const lastAction = component.lastAction;
      fixture.destroy();
      expect(cancelTimer).toHaveBeenCalledWith(scheduled);
      // No advance of time is required to settle the cancelled replay.
      await replay;
      expect(component.store.destroyed()).toBe(true);
      expect(component.actionHistory).toEqual([]);
      expect(component.replaying).toBe(false);
      expect(component.lastAction).toBe(lastAction);
    } finally {
      jest.useRealTimers();
    }
  });
});
