#!/usr/bin/env node
/**
 * RC public-surface disposition gate.
 *
 * The release gates already prove that package mechanics work. This gate asks a
 * different question: every public symbol in the RC candidate must have release
 * authority. Settled negative dispositions do not become fresh product decisions
 * just because release time arrived.
 *
 * Usage: node tools/check-rc-public-dispositions.mjs
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const api = JSON.parse(
  execFileSync(process.execPath, ['tools/api-surface.mjs', '--json'], {
    encoding: 'utf8',
  })
);

const core = api['@signaltree/core'];
if (!core) {
  console.error('❌ @signaltree/core is missing from API surface output.');
  process.exit(1);
}

const publicSymbols = new Set(core.symbols ?? []);

const BLOCKED = [
  {
    symbol: 'asyncSource',
    disposition: 'DELETE / named carrier removed; async-helper question does not revive this spelling',
  },
  {
    symbol: 'asyncQuery',
    disposition: 'DELETE / named carrier removed; async-helper question does not revive this spelling',
  },
  { symbol: 'AsyncSourceConfig', disposition: 'type companion of deleted asyncSource' },
  { symbol: 'AsyncSourceLoader', disposition: 'type companion of deleted asyncSource' },
  { symbol: 'AsyncSourceMarker', disposition: 'type companion of deleted asyncSource' },
  { symbol: 'AsyncSourceSignal', disposition: 'type companion of deleted asyncSource' },
  { symbol: 'AsyncQueryConfig', disposition: 'type companion of deleted asyncQuery' },
  { symbol: 'AsyncQueryFn', disposition: 'type companion of deleted asyncQuery' },
  { symbol: 'AsyncQueryMarker', disposition: 'type companion of deleted asyncQuery' },
  { symbol: 'AsyncQuerySignal', disposition: 'type companion of deleted asyncQuery' },
  { symbol: 'ReadonlyAsyncSourceSignal', disposition: 'readonly type companion of deleted asyncSource' },
  { symbol: 'ReadonlyAsyncQuerySignal', disposition: 'readonly type companion of deleted asyncQuery' },

  { symbol: 'loader', disposition: 'UNRESOLVED cache-policy carrier; survival requires independent authority' },
  { symbol: 'invalidateTag', disposition: 'UNRESOLVED tag invalidation carrier; A3 tree-scoped policy-holder question not run' },
  { symbol: 'LoaderOptions', disposition: 'type companion of unresolved loader helper' },
  { symbol: 'LoaderFeature', disposition: 'type companion of unresolved loader helper' },
  { symbol: 'EntityLoader', disposition: 'type companion of unresolved loader helper' },
  { symbol: 'EntityLoadOptions', disposition: 'type companion of unresolved loader helper' },
  { symbol: 'EntityLoaderSurface', disposition: 'type companion of unresolved loader helper' },
  { symbol: 'EntityPersist', disposition: 'type companion of unresolved loader helper' },
  { symbol: 'EntityStorageAdapter', disposition: 'type companion of unresolved loader helper' },
  { symbol: 'LoadingEntityMapBuilder', disposition: 'type companion of unresolved loader helper' },
  { symbol: 'LoadingEntityMapMarker', disposition: 'type companion of unresolved loader helper' },
  { symbol: 'LoadingEntitySignal', disposition: 'type companion of unresolved loader helper' },
  { symbol: 'ReadonlyEntityLoaderSurface', disposition: 'readonly type companion of unresolved loader helper' },
  { symbol: 'ReadonlyLoadingEntitySignal', disposition: 'readonly type companion of unresolved loader helper' },

  { symbol: 'stored', disposition: 'NOT EARNED as RC public API; consequence ordering fix is not survival proof' },
  { symbol: 'StoredMarker', disposition: 'type companion of unearned stored marker' },
  { symbol: 'StoredSignal', disposition: 'type companion of unearned stored marker' },
  { symbol: 'StoredOptions', disposition: 'type companion of unearned stored marker' },
  { symbol: 'StoredErrorContext', disposition: 'type companion of unearned stored marker' },
  { symbol: 'StoredReloadResult', disposition: 'type companion of unearned stored marker' },
  { symbol: 'ReadonlyStoredSignal', disposition: 'readonly type companion of unearned stored marker' },
  { symbol: 'MigrationFn', disposition: 'type companion of unearned stored marker' },
  { symbol: 'createStorageKeys', disposition: 'stored convenience API; survival not independently earned' },
  { symbol: 'clearStoragePrefix', disposition: 'stored convenience API; survival not independently earned' },
  { symbol: 'flushAllStoredSignals', disposition: 'LC page-hide drain for stored debounce hazard' },

  { symbol: 'linked', disposition: 'NOT EARNED; Angular owns linkedSignal primitive' },
  { symbol: 'LinkedOptions', disposition: 'type companion of unearned linked helper' },


  { symbol: 'serialization', disposition: 'NOT EARNED / unplaced as RC public API' },
  { symbol: 'SerializationConfig', disposition: 'type companion of unearned serialization enhancer' },
  { symbol: 'SerializationMethods', disposition: 'type companion of unearned serialization enhancer' },
  { symbol: 'SerializedState', disposition: 'type companion of unearned serialization enhancer' },

  { symbol: 'compared', disposition: 'UNPLACED; equality ownership null not run' },
  { symbol: 'byKeys', disposition: 'compared helper; equality ownership null not run' },
  { symbol: 'ComparedMarker', disposition: 'type companion of unplaced compared marker' },

  { symbol: 'lazy', disposition: 'UNPLACED threshold-driven subpath; no RC authority recorded' },
  { symbol: 'LazyFeature', disposition: 'type companion of unplaced lazy subpath' },
  { symbol: 'SignalMemoryManager', disposition: 'lazy subpath implementation class; no RC authority recorded' },

  { symbol: 'createEditSession', disposition: 'UNPLACED edit-session subpath; null not run' },
  { symbol: 'createTreeEditSession', disposition: 'UNPLACED edit-session subpath; null not run' },
  { symbol: 'EditSession', disposition: 'type companion of unplaced edit-session subpath' },
  { symbol: 'TreeEditSession', disposition: 'type companion of unplaced edit-session subpath' },
  { symbol: 'TreeEditSource', disposition: 'type companion of unplaced edit-session subpath' },
  { symbol: 'UndoRedoHistory', disposition: 'type companion of unplaced edit-session subpath' },
];

const missing = [];
for (const blocked of BLOCKED) {
  if (publicSymbols.has(blocked.symbol)) missing.push(blocked);
}

if (process.argv.includes('--self-test')) {
  const probeSurface = new Set(['asyncSource']);
  const caught = BLOCKED.filter((blocked) => probeSurface.has(blocked.symbol));
  if (caught.length !== 1 || caught[0].symbol !== 'asyncSource') {
    console.error('❌ self-test failed: blocked-symbol detection did not catch asyncSource.');
    process.exit(1);
  }

  const allowedSurface = new Set(['signalTree']);
  const falsePositive = BLOCKED.filter((blocked) => allowedSurface.has(blocked.symbol));
  if (falsePositive.length !== 0) {
    console.error('❌ self-test failed: allowed signalTree was treated as blocked.');
    process.exit(1);
  }

  console.log('✅ self-test passed: blocked symbols fail and allowed symbols pass.');
  process.exit(0);
}

const auditPath = 'docs/audits/2026-08/rc-public-surface-reconciliation.md';
const audit = readFileSync(auditPath, 'utf8');
const requiredPhrases = [
  'Remove from RC public surface',
  'not earned',
  'mechanically retained',
  '66.12 MB retained',
  'Collection throughput needs layer boundaries',
];
const missingAuditEvidence = requiredPhrases.filter((phrase) => !audit.includes(phrase));

if (missingAuditEvidence.length) {
  console.error(`❌ ${auditPath} is missing required reconciliation evidence:`);
  for (const phrase of missingAuditEvidence) console.error(`   - ${phrase}`);
  process.exit(1);
}

if (missing.length) {
  console.error('❌ RC public surface includes symbols with settled negative or unresolved dispositions:\n');
  for (const item of missing) {
    console.error(`   - ${item.symbol}: ${item.disposition}`);
  }
  console.error(
    '\nRemove these from the publishable public surface, or update this gate only with a later independent authority that explicitly grants the symbol.'
  );
  process.exit(1);
}

console.log('✅ RC public surface has no blocked disposition symbols.');
