/**
 * WALKER CONFORMANCE SUITE — core package.
 *
 * One deliberately hostile fixture asserted against every core subsystem that
 * walks the tree. The v11.4/11.5 regressions (inert batching interception,
 * inert enterprise diff/patch, inert updateOptimized) all shared one root
 * cause — walkers whose specs used flat, plain-object fixtures never noticed
 * that real trees are made of CALLABLE NodeAccessors (typeof 'function') with
 * markers and built-in leaves (Date/Map) mixed in at depth. This suite makes
 * "the walker reaches nested nodes" a tested behavioral contract per
 * subsystem, not a code-review hope. See RFC 0004 §3 V-P1 / §4 step 1.
 *
 * Companion suites: packages/enterprise/src/lib/nested-state.spec.ts
 * (PathIndex / UpdateEngine / DiffEngine), plus schema and ng-forms
 * walker-conformance specs. `invalidateTag`'s nested-branch coverage also
 * lives in entity-map-loading.spec.ts; the variant here adds a built-in
 * (Date) sibling on the walk path.
 */
import { describe, expect, it } from 'vitest';

import { of } from 'rxjs';

import { batching, entityMap, signalTree } from '../index';
import { serialization } from '../enhancers/serialization/serialization';
import type { Location } from './internals/cell-runtime';
import { interceptLocationWrites } from './internals/location-runtime';
import { getPathNotifier, resetPathNotifier } from './path-notifier';

interface Member extends Record<string, unknown> {
  id: number;
  name: string;
}

/** Depth map: org(1) → teams(2) → alpha(3) → lead(4) → profile(5) → leaves. */
const makeDeepState = () => ({
  org: {
    meta: {
      founded: new Date('2020-01-02T00:00:00Z'), // built-in leaf on the walk path
      aliases: ['a1'],
    },
    teams: {
      alpha: {
        info: { name: 'Alpha', size: 3 },
        lead: { profile: { display: 'Ada', score: 1 } },
      },
    },
  },
  counter: 0,
});

describe('walker conformance — core subsystems on a deep callable-branch tree', () => {
  it('marker materialization reaches markers nested under deep branches', () => {
    const tree = signalTree(
      {
        org: {
          teams: {
            alpha: {
              members: entityMap<Member, number>(),
            },
          },
        },
      },
      { capabilities: ['causal-runtime'] }
    );

    tree.$.org.teams.alpha.members.addOne({ id: 1, name: 'Ada' });
    expect(tree.$.org.teams.alpha.members.all()).toEqual([
      { id: 1, name: 'Ada' },
    ]);
  });

  it('batching setter interception wraps leaves five branches deep', () => {
    // Count RAW writes by intercepting the location BEFORE the enhancer; if the
    // enhancer's walker skips callable branches, coalesce() applies every
    // write instead of one and this counter exposes it. The wrapper is
    // installed by a probe enhancer declared ahead of `batching`, which is the
    // only "before the enhancer" that exists now that construction and
    // enhancement are one call.
    let applied = 0;
    const countRawWrites = <TTree>(t: TTree): TTree => {
      const leaf = (
        t as unknown as {
          $: {
            org: {
              teams: { alpha: { lead: { profile: { score: unknown } } } };
            };
          };
        }
      ).$.org.teams.alpha.lead.profile.score as Location<number>;
      const release = interceptLocationWrites(leaf, (_operation, proceed) => {
        applied++;
        proceed();
      });
      (t as unknown as { registerCleanup(fn: () => void): void }).registerCleanup(
        release
      );
      return t;
    };

    const tree = signalTree(makeDeepState(), {
      capabilities: ['causal-runtime'],
      enhancers: [
        countRawWrites,
        batching({ enabled: true, notificationDelayMs: 0 }),
      ],
    });
    tree.coalesce(() => {
      tree.$.org.teams.alpha.lead.profile.score(10);
      tree.$.org.teams.alpha.lead.profile.score(20);
      tree.$.org.teams.alpha.lead.profile.score(30);
    });

    expect(tree.$.org.teams.alpha.lead.profile.score()).toBe(30);
    expect(applied).toBe(1);
  });

  it('serialization round-trips deep leaves and a Date sitting mid-path', () => {
    const initial = makeDeepState();
    const tree = signalTree(initial, { enhancers: [serialization()] });

    const json = tree.serialize();

    // Corrupt deep state, then restore — deserialize must recurse through
    // callable branch accessors (not bail on typeof 'function') to reach
    // the depth-5 leaves and the built-in Date leaf.
    tree.$.org.teams.alpha.lead.profile.display('WRONG');
    tree.$.org.teams.alpha.lead.profile.score(-1);
    tree.$.org.meta.founded(new Date(0));

    tree.deserialize(json);

    expect(tree.$.org.teams.alpha.lead.profile.display()).toBe('Ada');
    expect(tree.$.org.teams.alpha.lead.profile.score()).toBe(1);
    expect(tree.$.org.meta.founded().toISOString()).toBe(
      initial.org.meta.founded.toISOString()
    );
  });

  it('PathNotifier observes a write five branches deep', async () => {
    resetPathNotifier();
    const tree = signalTree(makeDeepState(), {
      capabilities: ['causal-runtime'],
    });
    const paths: string[] = [];
    const unsubscribe = getPathNotifier().subscribe(
      '**',
      (_next, _prev, path) => {
        paths.push(path);
      }
    );

    tree.$.org.teams.alpha.lead.profile.score(42);
    await Promise.resolve();

    expect(paths).toContain('org.teams.alpha.lead.profile.score');
    unsubscribe();
  });

});
