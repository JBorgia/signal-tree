import { isTraversableNode } from './node-shape';

/**
 * SUBJECT RESTORATION CLAIMS — who still needs a retired subject's backing?
 *
 * The contract this implements is frozen in
 * `docs/architecture/retired-subject-churn.md`, "FROZEN — the claim contract":
 *
 *   A restoration claim names the subjects whose backing must conservatively
 *   remain available while the record holding it is retained.
 *
 * Sufficiency is required; minimality is not. This structure is deliberately
 * dumb about WHY a subject is claimed — it aggregates claims and reports the
 * moment the last one goes. Deciding whether a subject that nothing claims may
 * actually be reclaimed stays with `assessReclamationEligibility`, which reads
 * the causal turn store. Unclaimed is a NECESSARY condition, not a sufficient
 * one, and this file must never grow the confidence to skip that check.
 *
 * ## Why owner sets rather than a refcount
 *
 * A per-subject integer is one line shorter and wrong in the way that matters.
 * Claims arrive from more than one system — restoration entries, transaction
 * turns, and whatever else earns restoration authority — and a system that
 * re-registers the same record twice would increment a counter twice and pin
 * that subject forever, with no way to tell the leak from a real second owner.
 * Owner sets make `retain` idempotent per owner, which is the property that
 * survives composition.
 *
 * ## Authority-neutral owner ids
 *
 * An owner is an opaque string. It is NOT a history index, because indices
 * shift when the window slides and a shifted index silently re-points a claim
 * at a different record. Callers mint stable ids — `restoration:<turnId>`,
 * `transaction:<turnId>` — and the prefix keeps two systems from colliding.
 */

/**
 * Opaque, stable identity of something that needs subjects kept alive.
 *
 * Convention is `<system>:<stable id>`. Never a positional index into a
 * sliding window.
 */
export type RestorationClaimOwner = string;

export interface SubjectRestorationClaimsSnapshot {
  readonly owners: number;
  readonly claimedSubjects: number;
}

export interface SubjectRestorationClaims {
  /**
   * ATOMIC REPLACEMENT of `owner`'s claim set.
   *
   * Not additive. An owner whose record is re-captured with a different subject
   * set should call this again; subjects the new set drops are released as part
   * of the same call, and any that were held by no one else are returned.
   *
   * Duplicates within `subjects` collapse. Returns the subjects that became
   * unowned as a result — usually empty.
   */
  retain(
    owner: RestorationClaimOwner,
    subjects: Iterable<number>
  ): readonly number[];

  /**
   * Drop every claim held by `owner` — the eviction boundary.
   *
   * Returns the subjects whose LAST claim this released, which is the set a
   * caller may now offer for reclamation. Unknown owners return empty; that is
   * not an error, because a record captured before claims existed, or one that
   * never named a subject, has nothing to release.
   */
  release(owner: RestorationClaimOwner): readonly number[];

  /** Drop every claim from every owner — `destroy()`. Returns all of them. */
  releaseAll(): readonly number[];

  /** Does any owner still need this subject's backing? */
  isClaimed(subjectId: number): boolean;

  /** Which owners need it — for diagnostics and for the retention probes. */
  ownersOf(subjectId: number): readonly RestorationClaimOwner[];

  /** Every subject currently claimed by anyone. The retention inventory. */
  claimedSubjects(): readonly number[];

  /** Cheap size read for gates that assert a bound rather than an inventory. */
  snapshot(): SubjectRestorationClaimsSnapshot;
}

export function createSubjectRestorationClaims(): SubjectRestorationClaims {
  /** owner -> the subjects it claims. */
  const byOwner = new Map<RestorationClaimOwner, Set<number>>();
  /** subject -> the owners claiming it. The reverse index is what makes
   *  `release` cost O(|owner's set|) instead of a scan over every owner. */
  const bySubject = new Map<number, Set<RestorationClaimOwner>>();

  function addClaim(owner: RestorationClaimOwner, subjectId: number): void {
    let owners = bySubject.get(subjectId);
    if (!owners) {
      owners = new Set();
      bySubject.set(subjectId, owners);
    }
    owners.add(owner);
  }

  /** @returns true if this was the LAST owner of `subjectId`. */
  function dropClaim(owner: RestorationClaimOwner, subjectId: number): boolean {
    const owners = bySubject.get(subjectId);
    if (!owners) {
      return false;
    }
    owners.delete(owner);
    if (owners.size > 0) {
      return false;
    }
    bySubject.delete(subjectId);
    return true;
  }

  return {
    retain(owner, subjects) {
      const next = new Set(subjects);
      const previous = byOwner.get(owner);

      const newlyUnowned: number[] = [];
      if (previous) {
        for (const subjectId of previous) {
          if (next.has(subjectId)) {
            continue;
          }
          if (dropClaim(owner, subjectId)) {
            newlyUnowned.push(subjectId);
          }
        }
      }

      if (next.size === 0) {
        // An owner with nothing to claim is not tracked. Keeping the entry
        // would make `snapshot().owners` count records that pin nothing, and
        // the whole point of the number is to bound what pins something.
        byOwner.delete(owner);
        return newlyUnowned;
      }

      for (const subjectId of next) {
        addClaim(owner, subjectId);
      }
      byOwner.set(owner, next);
      return newlyUnowned;
    },

    release(owner) {
      const held = byOwner.get(owner);
      if (!held) {
        return [];
      }
      byOwner.delete(owner);

      const newlyUnowned: number[] = [];
      for (const subjectId of held) {
        if (dropClaim(owner, subjectId)) {
          newlyUnowned.push(subjectId);
        }
      }
      return newlyUnowned;
    },

    releaseAll() {
      const released = [...bySubject.keys()];
      byOwner.clear();
      bySubject.clear();
      return released;
    },

    isClaimed(subjectId) {
      return bySubject.has(subjectId);
    },

    ownersOf(subjectId) {
      const owners = bySubject.get(subjectId);
      return owners ? [...owners] : [];
    },

    claimedSubjects() {
      return [...bySubject.keys()];
    },

    snapshot() {
      return { owners: byOwner.size, claimedSubjects: bySubject.size };
    },
  };
}

/**
 * `SignalTree:` prefix REQUIRED, not cosmetic. `unwrap()` walks
 * `Object.getOwnPropertySymbols` — which returns non-enumerable symbols too, so
 * `enumerable: false` buys nothing — and skips brands by that description
 * prefix. A symbol named anything else lands in every snapshot the tree
 * produces; measured as 67 failing specs before it was renamed.
 */
const SUBJECT_RESTORATION_CLAIMS_SYMBOL = Symbol.for(
  'SignalTree:SubjectRestorationClaims'
);

/**
 * Attach the registry to a tree, following the same convention as
 * `definePositionRegistry`. TREE-SCOPED ON PURPOSE: claims have to aggregate
 * across SYSTEMS, not merely across the entries of one of them. A tree with
 * both `restoration()` and `transactions()` has two independent reasons to keep
 * a subject alive, and a per-enhancer registry would let either one free
 * backing the other still needs.
 */
/**
 * Get the tree's registry, creating and installing it on first use.
 *
 * LAZY ON PURPOSE. Constructing it in `signalTree()` put it on the
 * statically-reachable path of the bare bundle and cost 0.11 KB prod that a
 * tree with no restoration authority never uses — `bundle-budget` caught it.
 * Only an enhancer that can restore has a reason to claim anything, so the
 * enhancer pays for it.
 *
 * Installed on `$` when there is one, which is where it has to live: enhancers
 * hand back a wrapper around the tree, so a symbol on the outer object is not
 * the same object the next enhancer sees, and two enhancers would each create
 * their own registry and stop composing.
 */
export function getOrCreateSubjectRestorationClaims(
  node: unknown
): SubjectRestorationClaims | undefined {
  const existing = getSubjectRestorationClaims(node);
  if (existing) {
    return existing;
  }
  const host = ((node as { $?: unknown } | null)?.$ ?? node) as object | null;
  if (!isTraversableNode(host)) {
    return undefined;
  }
  const claims = createSubjectRestorationClaims();
  defineSubjectRestorationClaims(host, claims);
  return claims;
}

// ⚠️ NOT EXPORTED. Used only inside this module; the `export` was surplus.
// (ORPHAN sweep, 15.0. Same-file-only proves the EXPORT is unnecessary — it says
// nothing about who owns the code, and this code is live.)
function defineSubjectRestorationClaims(
  node: object,
  claims: SubjectRestorationClaims
): void {
  Object.defineProperty(node, SUBJECT_RESTORATION_CLAIMS_SYMBOL, {
    value: claims,
    enumerable: false,
    configurable: true,
  });
}

/**
 * Resolve the registry from a tree, its `$`, or any node carrying it.
 *
 * `$` is checked because that is where it reliably lands: enhancers hand back a
 * wrapper around the tree, and a symbol defined on the object `signalTree`
 * built does not survive that, while `signalState` is passed through by
 * reference. Same resolution order `commit-consequence` uses for the position
 * registry, and for the same reason.
 */
export function getSubjectRestorationClaims(
  node: unknown
): SubjectRestorationClaims | undefined {
  return read(node) ?? read((node as { $?: unknown } | null)?.$);
}

function read(node: unknown): SubjectRestorationClaims | undefined {
  if (!isTraversableNode(node)) {
    return undefined;
  }
  return (
    node as Record<symbol, SubjectRestorationClaims | undefined>
  )[SUBJECT_RESTORATION_CLAIMS_SYMBOL];
}
