import { EntitiesDemoComponent } from './entities-demo.component';

describe('EntitiesDemoComponent', () => {
  let component: EntitiesDemoComponent;

  beforeEach(() => {
    component = new EntitiesDemoComponent();
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  it('keeps a held entity handle stable across an ordinary update', () => {
    const heldProduct = component.store.$.products.byIdOrFail(1);

    component.renameAnchorProduct();

    expect(component.store.$.products.byIdOrFail(1)).toBe(heldProduct);
    expect(heldProduct().name).toBe('Desk lamp, revised');
  });

  it('updates derived EntityMap queries after structural mutations', () => {
    component.setFilter('reserved');
    expect(component.visibleProducts().map((product) => product.id)).toEqual([
      2,
    ]);

    component.toggleAvailability(1);

    expect(component.visibleProducts().map((product) => product.id)).toEqual([
      1,
      2,
    ]);
  });

  it('intercepts before commit and taps only committed mutations', () => {
    const countBefore = component.store.$.products.count();

    component.tryRejectedAdd();

    expect(component.store.$.products.count()).toBe(countBefore);
    expect(component.blockedOperation()).toContain('blank name');
    expect(component.lastEvent()).toBe('No committed mutations yet');

    component.newProductName = '  Field notebook  ';
    component.addProduct();

    expect(component.store.$.products.count()).toBe(countBefore + 1);
    expect(component.store.$.products.all().at(-1)?.name).toBe(
      'Field notebook'
    );
    expect(component.lastEvent()).toContain('after commit');
  });
});
