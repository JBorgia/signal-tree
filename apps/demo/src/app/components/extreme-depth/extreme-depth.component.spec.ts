import { ExtremeDepthComponent } from './extreme-depth.component';

describe('ExtremeDepthComponent', () => {
  let component: ExtremeDepthComponent;

  beforeEach(() => {
    component = new ExtremeDepthComponent();
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  it('binds the visible proof to exactly fifteen declared branches', () => {
    expect(component.pathSegments).toHaveLength(15);
    expect(component.pathSegments.at(-1)).toBe('result');
    expect(component.compilerChecks).toEqual({
      exactWritableLeaf: true,
      isAny: false,
    });
  });

  it('reads and writes the deepest declared leaves at runtime', () => {
    expect(component.result.status()).toBe('ready');
    expect(component.result.revision()).toBe(1);

    component.toggleStatus();

    expect(component.result.status()).toBe('review');
    expect(component.result.revision()).toBe(2);
    expect(component.result().status).toBe('review');
  });
});
