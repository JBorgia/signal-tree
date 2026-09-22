import { GranularReactivityDemoComponent } from './granular-reactivity-demo.component';

describe('GranularReactivityDemoComponent', () => {
  it('counts initial derivations in both totals and adds only measured reruns', () => {
    const component = new GranularReactivityDemoComponent();
    try {
      expect(component.treeTotal()).toBe(component.n);
      expect(component.rawTotal()).toBe(component.n);
      expect(component.treeDelta()).toBe(0);
      expect(component.rawDelta()).toBe(0);

      component.bumpTree();
      expect(component.treeDelta()).toBe(1);
      expect(component.treeTotal()).toBe(component.n + 1);
      expect(component.rawTotal()).toBe(component.n);

      component.bumpRaw();
      expect(component.rawDelta()).toBe(component.n);
      expect(component.rawTotal()).toBe(2 * component.n);
      expect(component.treeTotal()).toBe(component.n + 1);
    } finally {
      component.ngOnDestroy();
    }
  });
});
