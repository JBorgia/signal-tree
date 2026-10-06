/**
 * @internal The trees, by position registry, applying a reversal or a
 * rollback right now. An entity collection in one of them reads and writes
 * its rows physically whatever its presence (v16 8e).
 *
 * A collection under an omitted member, or omitted itself, is an absent,
 * empty collection to public reads. Applying a reversal or a rollback is the
 * one place that must reach its retained rows: the realization adapter
 * resolves and writes them through the collection's own row API. Restoration
 * and transactions push their tree around exactly that application and pop
 * it in a `finally`. A whole value does not: it reconciles presence itself
 * and never reads a hidden row, so a consumer or tap running inside it sees
 * one absent collection. A collection of another tree is never affected.
 *
 * Projections never read through it, so nothing they cache can hold
 * retained rows.
 */
export const physicalRows: object[] = [];
