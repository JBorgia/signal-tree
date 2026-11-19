import type { OwnerCell, Proof } from './lifecycle';

/** Private role bits, not fabricated owner identities. */
export const REJECTED_DESTINATION = 1;
export const REJECTED_INPUT = 2;
export const REJECTED_VALIDATION = 4;
export const REJECTED_ACTUAL = 8;

/**
 * Compact only a future current-source certificate. Issued inputs, recovery
 * records and delivery tickets retain their original immutable references.
 * Callers must keep individually replaceable contributor addresses separate.
 */
export function compactTerminalProof(proof: Readonly<Proof>): Readonly<Proof> {
  let rejected = proof.terminalRejectedRoles ?? 0;
  const retained = (cells: readonly OwnerCell[] | undefined, role: number) => {
    const live: OwnerCell[] = [];
    for (const cell of cells ?? []) {
      if (cell.outcome === 'rolled-back') rejected |= role;
      else if (cell.outcome !== 'confirmed') live.push(cell);
    }
    return Object.freeze(live);
  };
  const destination = retained(proof.destination, REJECTED_DESTINATION);
  const input = retained(proof.input, REJECTED_INPUT);
  const validation = retained(proof.validation, REJECTED_VALIDATION);
  const classified = new Set([...(proof.destination ?? []), ...(proof.input ?? []), ...(proof.validation ?? [])]);
  const owners = retained(proof.owners, 0);
  for (const cell of proof.owners) {
    if (cell.outcome === 'rolled-back' && !classified.has(cell)) rejected |= REJECTED_ACTUAL;
  }
  const possible = Object.freeze((proof.possible ?? []).filter(cell => cell.outcome === 'pending' || cell.outcome === 'abandoned'));
  return Object.freeze({ ...proof, owners, destination, input, validation, possible,
    terminalRejectedRoles: rejected,
    historicalWindow: proof.historicalWindow === true || (proof.possible?.length ?? 0) > 0,
  });
}
