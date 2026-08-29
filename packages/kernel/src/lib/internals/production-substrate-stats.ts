export interface ProductionSubstrateStats {
  slotReads: number;
  slotWrites: number;
  equalityChecks: number;
  revisionIncrements: number;
  positionResolutions: number;
  publicationDependencyReads: number;
  publications: number;
  treeVisits: number;
  structuralActiveKeyLookups: number;
  structuralActiveKeyEntriesVisited: number;
  structuralSubjectsCreated: number;
  structuralSubjectTransfers: number;
  structuralSubjectTombstones: number;
  valueStoreWrites: number;
  publicAddPreviousTailReads: number;
  publicAddExistingKeysCopied: number;
  publicUndoPositionEntriesExamined: number;
  publicUndoTurnEffectsExamined: number;
}

type CounterName = keyof ProductionSubstrateStats;

export const PRODUCTION_SUBSTRATE_STATS_ENABLED = true;

let activeStats: ProductionSubstrateStats | undefined;

export function installProductionSubstrateStatsForTesting(): ProductionSubstrateStats {
  const stats = createProductionSubstrateStats();
  activeStats = stats;
  return stats;
}

export function clearProductionSubstrateStatsForTesting(): void {
  activeStats = undefined;
}

export function resetProductionSubstrateStatsForTesting(
  stats: ProductionSubstrateStats
): ProductionSubstrateStats {
  stats.slotReads = 0;
  stats.slotWrites = 0;
  stats.equalityChecks = 0;
  stats.revisionIncrements = 0;
  stats.positionResolutions = 0;
  stats.publicationDependencyReads = 0;
  stats.publications = 0;
  stats.treeVisits = 0;
  stats.structuralActiveKeyLookups = 0;
  stats.structuralActiveKeyEntriesVisited = 0;
  stats.structuralSubjectsCreated = 0;
  stats.structuralSubjectTransfers = 0;
  stats.structuralSubjectTombstones = 0;
  stats.valueStoreWrites = 0;
  stats.publicAddPreviousTailReads = 0;
  stats.publicAddExistingKeysCopied = 0;
  stats.publicUndoPositionEntriesExamined = 0;
  stats.publicUndoTurnEffectsExamined = 0;
  return stats;
}

export function recordProductionSubstrateStat(
  counter: CounterName,
  delta = 1
): void {
  if (!activeStats) {
    return;
  }

  activeStats[counter] += delta;
}

function createProductionSubstrateStats(): ProductionSubstrateStats {
  return {
    slotReads: 0,
    slotWrites: 0,
    equalityChecks: 0,
    revisionIncrements: 0,
    positionResolutions: 0,
    publicationDependencyReads: 0,
    publications: 0,
    treeVisits: 0,
    structuralActiveKeyLookups: 0,
    structuralActiveKeyEntriesVisited: 0,
    structuralSubjectsCreated: 0,
    structuralSubjectTransfers: 0,
    structuralSubjectTombstones: 0,
    valueStoreWrites: 0,
    publicAddPreviousTailReads: 0,
    publicAddExistingKeysCopied: 0,
    publicUndoPositionEntriesExamined: 0,
    publicUndoTurnEffectsExamined: 0,
  };
}
