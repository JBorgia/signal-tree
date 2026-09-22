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

    component.updateMessage('Local draft');
    await settle();
    expect(component.historyLength()).toBe(1);

    component.refreshFromServer();
    await settle();

    expect(component.historyLength()).toBe(1);
  });

  it('shows a conflict and preserves the whole state when server data supersedes an edit', async () => {
    const fixture = TestBed.createComponent(RestorationDemoComponent);
    const component = fixture.componentInstance;
    component.increment();
    component.updateMessage('Local draft');
    await settle();
    component.refreshFromServer();
    await settle();
    const before = {
      counter: component.counter(),
      message: component.message(),
      history: component.history(),
    };

    expect(() => component.undo()).not.toThrow();
    await settle();
    fixture.detectChanges();

    expect(component.counter()).toBe(before.counter);
    expect(component.message()).toBe(before.message);
    expect(component.history()).toEqual(before.history);
    expect(component.canUndo()).toBe(true);
    expect(component.canRedo()).toBe(false);
    expect(component.rollbackMessage()).toContain(
      'ST1034: restoration refused'
    );
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Nothing was changed'
    );
  });

  it('undoes an unrelated counter edit while preserving the server message', async () => {
    const fixture = TestBed.createComponent(RestorationDemoComponent);
    const component = fixture.componentInstance;
    component.increment();
    await settle();
    component.refreshFromServer();
    await settle();
    const serverMessage = component.message();
    component.undo();
    await settle();
    expect(component.counter()).toBe(0);
    expect(component.message()).toBe(serverMessage);
    expect(component.rollbackMessage()).toBeNull();
  });

  it('undoes and redoes an actual entity addition in the collection example', async () => {
    const fixture = TestBed.createComponent(RestorationDemoComponent);
    const component = fixture.componentInstance;
    component.addPerson();
    await settle();
    expect(component.peopleCount()).toBe(1);
    component.undoMarkers();
    await settle();
    expect(component.peopleCount()).toBe(0);
    component.redoMarkers();
    await settle();
    expect(component.people()).toEqual([{ id: 1, name: 'Person 1' }]);
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
