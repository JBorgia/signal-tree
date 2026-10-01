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
 * September 30 correction: the disagreement above describes the historical
 * implementation. The structured-field repair now distinguishes [] (whole
 * entity) from an absent address, and its remaining descriptor fallback checks
 * the whole-entity case before rejecting a missing path. The assertion below
 * was intentionally red on this change and has been updated with that finding.
 *
 * ## This file is an inventory, not behaviour
 *
 * The assertions below pin the CONSUMER SHAPE so the inventory cannot silently
 * go stale — if a new ordinary-scalar consumer starts reading either field, or
 * the `''` disagreement is resolved, these fail and the record gets revisited.
 */

const SRC = (() => {
  const candidates = [
    join(process.cwd(), 'packages/kernel/src'),
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
  throw new Error('DESCRIPTOR-ROLE-0: could not locate packages/kernel/src');
})();

const ADAPTER = readFileSync(
  join(SRC, 'lib/internals/causal-runtime/tree-realization-adapter.ts'),
  'utf8'
);

describe('DESCRIPTOR-ROLE-0: the consumer shape', () => {
  it('distinguishes a whole entity from an absent field address', () => {
    // September 30 correction to the historical finding above: exact field
    // segments now take precedence. [] denotes the whole entity; undefined
    // permits the legacy descriptor fallback. The old assertion deliberately
    // pinned the disagreement so this inventory would be revisited when fixed.
    // Executable behavior is pinned separately in typed-entity-address.spec.ts.
    const resolver = ADAPTER.slice(
      ADAPTER.indexOf('function resolveCurrentSubjectTarget'),
      ADAPTER.indexOf('function resolveNotifyPath')
    );
    expect(resolver).toContain('if (effect.fieldSegments !== undefined)');
    expect(resolver).toContain('if (segments.length === 0) return rowNode');
    const whole = resolver.indexOf("if (fieldPathFromRow === '')");
    const absent = resolver.indexOf('if (!fieldPathFromRow)');
    expect(whole).toBeGreaterThanOrEqual(0);
    expect(absent).toBeGreaterThan(whole);
    expect(resolver.slice(absent)).toContain('return undefined');
  });

  it('subject field resolution is keyed by subjectId, never by path shape', () => {
    // The helper resolves the descriptor from the subject ID before consulting
    // either subject-scoped path. Path shape never chooses the subject.
    const resolver = ADAPTER.slice(
      ADAPTER.indexOf('function resolveCurrentSubjectTarget'),
      ADAPTER.indexOf('function resolveCurrentSubjectTarget') + 2400
    );
    expect(resolver).toContain('String(subjectId)');
    expect(resolver).toContain('subjectDescriptor?.collectionPath ??');
    expect(resolver).toContain('subjectDescriptor?.fieldPathFromRow ??');
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
