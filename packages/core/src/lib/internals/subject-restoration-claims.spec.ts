import { describe, expect, it } from 'vitest';

import { createSubjectRestorationClaims } from './subject-restoration-claims';

/**
 * The properties these pin are the ones Step 8 depends on. The registry is
 * small enough that a reviewer can read it and believe it; the reason to test
 * it anyway is that every one of these properties is a way retention silently
 * becomes unbounded, and none of them shows up as a failure at the call site.
 */
describe('subject restoration claims', () => {
  it('reports a subject as unowned only when its LAST owner releases', () => {
    const claims = createSubjectRestorationClaims();

    claims.retain('time-travel:1', [7]);
    claims.retain('time-travel:2', [7]);
    claims.retain('transaction:9', [7]);

    expect(claims.release('time-travel:1')).toEqual([]);
    expect(claims.isClaimed(7)).toBe(true);
    expect(claims.release('time-travel:2')).toEqual([]);
    expect(claims.isClaimed(7)).toBe(true);

    // Only now. Reclaiming at the first release is exactly the bug the
    // eviction boundary is being built to avoid.
    expect(claims.release('transaction:9')).toEqual([7]);
    expect(claims.isClaimed(7)).toBe(false);
  });

  it('composes claims across systems, not just across entries', () => {
    const claims = createSubjectRestorationClaims();

    claims.retain('time-travel:1', [1, 2]);
    claims.retain('transaction:1', [2, 3]);

    expect(claims.ownersOf(2).sort()).toEqual(['time-travel:1', 'transaction:1']);
    // Evicting the whole time-travel window must not free a subject a pending
    // transaction still needs to roll back to.
    expect(claims.release('time-travel:1')).toEqual([1]);
    expect(claims.isClaimed(2)).toBe(true);
    expect(claims.release('transaction:1').sort()).toEqual([2, 3]);
  });

  it('is idempotent per owner — re-retaining does not pin a subject forever', () => {
    const claims = createSubjectRestorationClaims();

    claims.retain('time-travel:1', [5]);
    claims.retain('time-travel:1', [5]);
    claims.retain('time-travel:1', [5]);

    // A refcount would sit at 3 here and this release would free nothing.
    expect(claims.release('time-travel:1')).toEqual([5]);
    expect(claims.snapshot()).toEqual({ owners: 0, claimedSubjects: 0 });
  });

  it('collapses duplicates within one retain call', () => {
    const claims = createSubjectRestorationClaims();

    claims.retain('time-travel:1', [4, 4, 4, 9]);

    expect(claims.ownersOf(4)).toEqual(['time-travel:1']);
    expect(claims.release('time-travel:1').sort()).toEqual([4, 9]);
  });

  it('retain replaces an owner atomically and reports what that dropped', () => {
    const claims = createSubjectRestorationClaims();

    claims.retain('time-travel:1', [1, 2, 3]);
    // The record is re-captured naming a different set. 1 is gone from it and
    // nothing else holds 1, so this call is where 1 becomes reclaimable — a
    // caller that only listens to `release` would leak it.
    expect(claims.retain('time-travel:1', [2, 3, 4])).toEqual([1]);
    expect(claims.claimedSubjects().sort()).toEqual([2, 3, 4]);
  });

  it('does not report a dropped subject that another owner still holds', () => {
    const claims = createSubjectRestorationClaims();

    claims.retain('time-travel:1', [1, 2]);
    claims.retain('transaction:1', [1]);

    expect(claims.retain('time-travel:1', [2])).toEqual([]);
    expect(claims.isClaimed(1)).toBe(true);
  });

  it('treats an empty retain as holding nothing, and stops counting the owner', () => {
    const claims = createSubjectRestorationClaims();

    claims.retain('time-travel:1', [1]);
    expect(claims.retain('time-travel:1', [])).toEqual([1]);
    expect(claims.snapshot()).toEqual({ owners: 0, claimedSubjects: 0 });

    // A record that names no subjects must not occupy an owner slot; the
    // bound Step 8 asserts is on what PINS something.
    claims.retain('time-travel:2', []);
    expect(claims.snapshot()).toEqual({ owners: 0, claimedSubjects: 0 });
  });

  it('releasing an unknown owner is a no-op, not a throw', () => {
    const claims = createSubjectRestorationClaims();

    // Entries captured before claims existed, and entries that named nothing,
    // both reach the eviction boundary. Neither is an error there.
    expect(claims.release('time-travel:404')).toEqual([]);
    expect(claims.release('')).toEqual([]);
  });

  it('releaseAll returns every claimed subject and empties both indexes', () => {
    const claims = createSubjectRestorationClaims();

    claims.retain('time-travel:1', [1, 2]);
    claims.retain('transaction:1', [2, 3]);

    expect(claims.releaseAll().sort()).toEqual([1, 2, 3]);
    expect(claims.snapshot()).toEqual({ owners: 0, claimedSubjects: 0 });
    expect(claims.isClaimed(2)).toBe(false);
    // And it must stay empty rather than resurrect on the next read.
    expect(claims.releaseAll()).toEqual([]);
  });

  it('keeps the claimed set bounded by the window, not by total churn', () => {
    const claims = createSubjectRestorationClaims();
    const WINDOW = 20;

    // The shape a sliding history produces: each new record claims fresh
    // subjects, the oldest is evicted. This is the property the whole of
    // Step 8 exists to obtain, expressed at the level of the data structure.
    for (let turn = 0; turn < 5_000; turn++) {
      claims.retain(`time-travel:${turn}`, [turn * 2, turn * 2 + 1]);
      if (turn >= WINDOW) {
        claims.release(`time-travel:${turn - WINDOW}`);
      }
    }

    expect(claims.snapshot()).toEqual({
      owners: WINDOW,
      claimedSubjects: WINDOW * 2,
    });
  });

  it('does not lose a claim when one owner releases a subject another re-retains', () => {
    const claims = createSubjectRestorationClaims();

    claims.retain('time-travel:1', [8]);
    claims.retain('time-travel:2', [8]);
    claims.release('time-travel:1');
    // Re-registering an owner that already holds it must not disturb the
    // reverse index for the owner that still does.
    claims.retain('time-travel:2', [8]);

    expect(claims.ownersOf(8)).toEqual(['time-travel:2']);
    expect(claims.release('time-travel:2')).toEqual([8]);
  });
});
