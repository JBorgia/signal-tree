import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * DESCRIPTOR-ROLE-0 — is `TreeRealizationDescriptor` truthfully shaped?
 *
 * ```text
 * NULL       `collectionPath` and `fieldPathFromRow` serve SUBJECT realization
 *            exclusively; ordinary scalar replay is already addressable through
 *            its own position/path machinery
 * FALSIFIER  an ordinary non-subject scalar replay genuinely needs either field
 *            as part of its semantic target identity
 * ```
 *
 * ## RESULT — the NULL SURVIVES
 *
 * Every production read traced through its consumer branch:
 *
 * ```text
 * collectionPath
 *   PreparedRealizationContext occupancy   SUBJECT (keyed by subjectId)
 *   descriptor write / merge               capture-side, not resolution
 *   resolveCollectionPath                  STRUCTURAL / subject
 *   resolveCurrentSubjectTarget            SUBJECT — resolves a collection node
 *   prepared subject resolution            SUBJECT
 *
 * fieldPathFromRow
 *   canResolvePreparedSubjectTarget        requires effect.subjectId
 *   assignPreparedSubjectValue             requires a prepared SUBJECT
 *   resolveSubjectFieldPath                keyed by effect.subjectId
 * ```
 *
 * No read serves ordinary scalar resolution. `resolveLiveScalarNode` falls back
 * to `descriptor.path` for a non-subject effect and never consults either field.
 *
 * So the overload I suspected — `collectionPath` doubling as a parent/scope
 * coordinate for scalars — **does not exist in the consumers**. It exists only
 * in the DERIVATION, which computes a parent-shaped string for scalar-looking
 * inputs that nothing then reads. That is a narrower and better-behaved problem
 * than a genuinely overloaded field.
 *
 * ## ⚠️ AND THE TOP-LEVEL COPIES ARE VESTIGIAL
 *
 * Both fields exist twice — on the descriptor and on each `subjectDescriptors`
 * entry — with the top-level acting as a last-resort fallback:
 *
 * ```text
 * inline ?? subjectDescriptors[subjectId] ?? descriptor.<field>
 * ```
 *
 * Removing BOTH top-level fallbacks changes nothing across the entire suite:
 *
 * ```text
 * baseline                          2112 passing, 5 expected fail
 * both top-level fallbacks dropped  2112 passing, 5 expected fail
 * ```
 *
 * So they are HISTORICAL CONVENIENCE, not required fallback authority. They are
 * NOT deleted here — the question of what the descriptor must retain for
 * zero-tree-visit replay belongs to the implementation step, and deleting for
 * elegance is exactly what this audit refuses. Recorded so the implementation
 * does not preserve them on the assumption that something needs them.
 *
 * ## ⚠️ A THIRD MEANING FOR `''`, found while tracing
 *
 * The two consumers disagree about the empty string:
 *
 * ```text
 * canResolvePreparedSubjectTarget   if (!fieldPathFromRow) return false;
 *                                   -> '' is FALSY, so it reads as NO PATH
 * assignPreparedSubjectValue        if (fieldPathFromRow === '') { ... }
 *                                   -> '' reads as WHOLE SUBJECT
 * ```
 *
 * So `''` means "no address" to one consumer and "the whole subject" to the
 * other. That matters directly for SUBJECT-ADDRESS-0: the owner-only ping
 * manufactures `''`, and which consumer sees it decides whether the effect is
 * REFUSED or applied to the entire row.
 *
 * The three states must stay distinct — `undefined` (no information), `''`
 * (whole subject), `'name'` (a field) — and today two of them collide at one
 * call site.
 *
 * ## This file is an inventory, not behaviour
 *
 * The assertions below pin the CONSUMER SHAPE so the inventory cannot silently
 * go stale — if a new ordinary-scalar consumer starts reading either field, or
 * the `''` disagreement is resolved, these fail and the record gets revisited.
 */

const SRC = (() => {
  const candidates = [
    join(process.cwd(), 'packages/core/src'),
    join(process.cwd(), 'src'),
  ];
  for (const c of candidates) {
    try {
      readFileSync(join(c, 'lib/signal-tree.ts'), 'utf8');
      return c;
    } catch {
      /* next */
    }
  }
  throw new Error('DESCRIPTOR-ROLE-0: could not locate packages/core/src');
})();

const ADAPTER = readFileSync(
  join(SRC, 'lib/internals/causal-runtime/tree-realization-adapter.ts'),
  'utf8'
);

describe('DESCRIPTOR-ROLE-0: the consumer shape', () => {
  it('⚠️ `` \'\' `` is STILL falsy at one consumer and whole-subject at another', () => {
    // ⚠️ ADDRESS-REPAIR-1 did NOT remove this wart, and that is deliberate.
    //
    // The DERIVATION is now explicit — `deriveSubjectAddress` returns
    // `undefined | {kind:'whole'} | {kind:'field'}` — but the STORAGE encoding
    // is still `string | undefined` with `''` meaning whole, converted at one
    // place (`encodeSubjectAddress`). So the disagreement below survives in the
    // consumers.
    //
    // It is safe now only because the derivation no longer produces `''` for
    // anything meaning "no address": the owner-only ping returns `undefined`
    // before `subjectId` is ever consulted. Migrating the stored shape is a
    // representation change, not a correctness fix, and belongs in its own step.
    expect(ADAPTER).toMatch(/if \(!fieldPathFromRow\) \{\s*return false;/);
    expect(ADAPTER).toContain("if (fieldPathFromRow === '')");

    // The derivation-side representation that replaced the string heuristics.
    expect(ADAPTER).toContain("type SubjectAddress");
    expect(ADAPTER).toContain("function deriveSubjectAddress(");
    expect(ADAPTER).toContain("function encodeSubjectAddress(");
  });

  it('subject field resolution is keyed by subjectId, never by path shape', () => {
    // The resolution chain, which is what makes both fields subject-scoped.
    expect(ADAPTER).toContain(
      "descriptor?.subjectDescriptors?.get(String(effect.subjectId))?.fieldPathFromRow"
    );
    expect(ADAPTER).toContain(
      "subjectDescriptor?.collectionPath ??"
    );
  });

  it('ordinary scalar resolution falls back to descriptor.path, not collectionPath', () => {
    // The control for the NULL: if a scalar consumer ever starts reading
    // `collectionPath`, this record is wrong and this test should be revisited.
    const scalarFn = ADAPTER.slice(
      ADAPTER.indexOf('function resolveLiveScalarNode'),
      ADAPTER.indexOf('function resolveCollectionNode')
    );
    expect(scalarFn.length).toBeGreaterThan(0);
    expect(scalarFn).toContain('descriptor?.path');
    expect(scalarFn).not.toContain('collectionPath');
  });

  it('⚠️ the top-level copies still EXIST — measured unread, not yet removed', () => {
    // Removing both fallbacks left the whole suite unchanged (2112 passing,
    // 5 expected fail). They are recorded as vestigial so the implementation
    // does not preserve them believing something depends on them.
    expect(ADAPTER).toContain('descriptor?.fieldPathFromRow');
    expect(ADAPTER).toContain('descriptor?.collectionPath ??');
  });
});
