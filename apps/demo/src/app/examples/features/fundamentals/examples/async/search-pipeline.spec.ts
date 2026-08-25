import { Subject, of, throwError, timer } from 'rxjs';
import { map } from 'rxjs';

import { createSearchPipeline } from './search-pipeline';

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

type User = { id: string };

/**
 * ⚠️ THE BEHAVIOURAL PROOF THE RETIREMENT OWED.
 *
 * `ASYNC-QUERY-RETIRE-0` migrated the demo lesson to an RxJS pipeline, but its
 * only test asserted the rendered SNIPPET contained the word `switchMap`. That
 * proves the panel renders, not that the behaviour survives.
 *
 * ASYNC-QUERY-CLOSE-0 adds the missing control: this executes the pipeline.
 */
describe('createSearchPipeline (the asyncQuery replacement)', () => {
  it('⚠️ latest-wins: a slow A loses to a fast B that started later', async () => {
    const started: string[] = [];
    const p = createSearchPipeline<User>(
      (q) => {
        started.push(q);
        // A is slow, B is fast — so A resolves LAST.
        return timer(q === 'A' ? 80 : 10).pipe(map(() => [{ id: q }]));
      },
      { debounceMs: 0 }
    );

    p.search('A');
    await tick(5);
    p.search('B');
    await tick(140);

    // Both requests were issued...
    expect(started).toEqual(['A', 'B']);
    // ...and switchMap cancelled A, so the LATER query wins even though the
    // earlier one finished last.
    expect(p.tree.$.results()).toEqual([{ id: 'B' }]);
    p.destroy();
  });

  it('debounce collapses a burst into one request', async () => {
    const started: string[] = [];
    const p = createSearchPipeline<User>(
      (q) => {
        started.push(q);
        return of([{ id: q }]);
      },
      { debounceMs: 40 }
    );

    p.search('a');
    p.search('ab');
    p.search('abc');
    await tick(120);

    expect(started).toEqual(['abc']);
    p.destroy();
  });

  it('dedup: the same query twice issues one request', async () => {
    const started: string[] = [];
    const p = createSearchPipeline<User>(
      (q) => {
        started.push(q);
        return of([{ id: q }]);
      },
      { debounceMs: 0 }
    );

    p.search('same');
    await tick(20);
    p.search('same');
    await tick(20);

    expect(started).toEqual(['same']);
    p.destroy();
  });

  it('loading is true while active and false on result', async () => {
    const gate = new Subject<User[]>();
    const p = createSearchPipeline<User>(() => gate, { debounceMs: 0 });

    p.search('q');
    await tick(10);
    expect(p.tree.$.loading()).toBe(true);

    gate.next([{ id: 'q' }]);
    await tick(10);
    expect(p.tree.$.loading()).toBe(false);
    p.destroy();
  });

  it('a rejection populates the error state and clears loading', async () => {
    const boom = new Error('search failed');
    const p = createSearchPipeline<User>(() => throwError(() => boom), {
      debounceMs: 0,
    });

    p.search('q');
    await tick(20);

    expect(p.tree.$.error()).toBe(boom);
    expect(p.tree.$.loading()).toBe(false);
    p.destroy();
  });
});

describe('createSearchPipeline: recovery after an error', () => {
  it('⚠️ a later successful query still works after a failure', async () => {
    let fail = true;
    const p = createSearchPipeline<User>(
      (q) => {
        if (fail) return throwError(() => new Error('boom'));
        return of([{ id: q }]);
      },
      { debounceMs: 0 }
    );

    p.search('first');
    await tick(20);
    expect(p.tree.$.error()).toBeInstanceOf(Error);

    fail = false;
    p.search('second');
    await tick(20);

    // ⚠️ THE DEFECT asyncQuery's source explicitly warned about: if a query
    // error escapes switchMap it terminates the OUTER subscription and the
    // pipeline silently stops responding to every future input.
    expect(p.tree.$.results()).toEqual([{ id: 'second' }]);
    p.destroy();
  });
});
