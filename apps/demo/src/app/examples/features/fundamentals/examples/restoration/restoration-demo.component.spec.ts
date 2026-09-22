import { TestBed } from '@angular/core/testing';

import { RestorationDemoComponent } from './restoration-demo.component';

const settle = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

describe('RestorationDemoComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RestorationDemoComponent],
    }).compileComponents();
  });

  it('retains explicitly designated authored operations and undoes them', async () => {
    const fixture = TestBed.createComponent(RestorationDemoComponent);
    const component = fixture.componentInstance;

    component.increment();
    await settle();

    expect(component.counter()).toBe(1);
    expect(component.historyLength()).toBe(1);
    expect(component.canUndo()).toBe(true);

    component.undo();
    await settle();

    expect(component.counter()).toBe(0);
  });

  it('does not retain externally realized truth as an undo step', async () => {
    const fixture = TestBed.createComponent(RestorationDemoComponent);
    const component = fixture.componentInstance;

    component.newTodoText = 'Local draft';
    component.addTodo();
    await settle();
    expect(component.historyLength()).toBe(1);

    component.refreshFromServer();
    await settle();

    expect(component.historyLength()).toBe(1);
  });

  it('reports undo and redo availability without inventing exact move counts', async () => {
    const fixture = TestBed.createComponent(RestorationDemoComponent);
    const component = fixture.componentInstance;

    component.increment();
    await settle();
    component.increment();
    await settle();
    component.undo();
    await settle();

    expect(component.canRedo()).toBe(true);
    expect(component.canUndo()).toBe(true);
  });

  it('clear history cancels pending generated sample actions', async () => {
    jest.useFakeTimers();
    try {
      const fixture = TestBed.createComponent(RestorationDemoComponent);
      const component = fixture.componentInstance;

      component.generateSampleActions();
      component.clearHistory();
      await jest.advanceTimersByTimeAsync(1_100);

      expect(component.historyLength()).toBe(0);
      expect(component.canUndo()).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });
});