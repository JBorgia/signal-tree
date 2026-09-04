import { ExtremeDepthComponent } from './extreme-depth.component';

describe('ExtremeDepthComponent', () => {
  let component: ExtremeDepthComponent;

  beforeEach(() => {
    component = new ExtremeDepthComponent();
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  it('starts on the compiled fifteen-branch proof', () => {
    expect(component.selectedDepth()).toBe(15);
    expect(component.pathSegments()).toHaveLength(15);
    expect(component.pathSegments().at(-1)).toBe('result');
    expect(component.compilerChecks).toEqual({
      exactLocation: true,
      isAny: false,
    });
  });

  it('generates and runtime-tests another compile-backed depth', () => {
    const originalTree = component.tree();

    component.setDepthInput('32');
    component.generateAndTest();

    expect(component.selectedDepth()).toBe(32);
    expect(component.pathSegments()).toHaveLength(32);
    expect(component.pathSegments().at(-1)).toBe('result');
    expect(component.result().status()).toBe('ready');
    expect(component.lastOperation()).toContain('Depth 32 generated');
    expect(component.lastOperation()).toContain('runtime read/write passed');
    expect(originalTree.destroyed()).toBe(true);
  });

  it('rejects depths outside the generated compile-proof catalog', () => {
    component.setDepthInput('41');

    expect(component.depthInputError()).toBe(
      'Enter a whole number from 1 to 40.'
    );
    expect(component.canGenerate()).toBe(false);

    component.generateAndTest();
    expect(component.selectedDepth()).toBe(15);
  });

  it('reads and writes the deepest declared leaves at runtime', () => {
    expect(component.result().status()).toBe('ready');
    expect(component.result().revision()).toBe(1);

    component.toggleStatus();

    expect(component.result().status()).toBe('review');
    expect(component.result().revision()).toBe(2);
    expect(component.result()().status).toBe('review');
  });
});
