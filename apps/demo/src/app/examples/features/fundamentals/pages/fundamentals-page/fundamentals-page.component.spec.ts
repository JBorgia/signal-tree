import { FundamentalsPageComponent } from './fundamentals-page.component';

describe('FundamentalsPageComponent', () => {
  let component: FundamentalsPageComponent;

  beforeEach(() => {
    component = new FundamentalsPageComponent();
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  it('demonstrates state shape, leaf writes, and derived state in one tree', () => {
    expect(component.tree.$.cart.itemCount()).toBe(2);
    expect(component.tree.$.subtotal()).toBe(48);

    component.addItem();
    component.setUnitPrice(30);

    expect(component.tree.$.cart.itemCount()).toBe(3);
    expect(component.tree.$.cart.unitPrice()).toBe(30);
    expect(component.tree.$.subtotal()).toBe(90);
  });

  it('hands dedicated concepts to their canonical pages', () => {
    expect(component.nextConcepts.map((concept) => concept.route)).toEqual([
      '/batching',
      '/entities',
      '/restoration',
      '/external-truth',
    ]);
  });
});
