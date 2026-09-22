import { BatchingDemoComponent } from './batching-demo.component';

describe('BatchingDemoComponent', () => {
  let component: BatchingDemoComponent;

  beforeEach(() => {
    component = new BatchingDemoComponent();
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  it('shows intermediate publications when each write is published separately', () => {
    component.runUnbatched();

    expect(component.writesPerformed()).toBe(3);
    expect(component.publicationTimeline()).toHaveLength(3);
    expect(component.intermediateStatesVisible()).toBe(2);
    expect(component.publicationTimeline().map((entry) => entry.coherent)).toEqual([
      false,
      false,
      true,
    ]);
    expect(component.finalStateCoherent()).toBe(true);
  });

  it('groups the same writes into one coherent publication', () => {
    component.runBatched();

    expect(component.writesPerformed()).toBe(3);
    expect(component.publicationTimeline()).toHaveLength(1);
    expect(component.intermediateStatesVisible()).toBe(0);
    expect(component.publicationTimeline()[0]).toMatchObject({
      alicePostCount: 3,
      bobPostCount: 3,
      postAuthor: 'Bob',
      coherent: true,
    });
    expect(component.finalStateCoherent()).toBe(true);
  });

  it('keeps batching ownership separate from jobs and transactions', () => {
    expect(component.nonResponsibilities).toEqual([
      'HTTP retries',
      'queues and workers',
      'delays and backoff',
      'failure recovery',
      'transactional pending state',
    ]);
  });
});
