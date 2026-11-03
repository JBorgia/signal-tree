/** Exact required execution matrix; no filters or recording-only success. */
export const retentionModes = Object.freeze([
  ...['hold-proceed', 'drop-proceed', 'hold-value'].flatMap(arm =>
    ['success', 'skip', 'caught'].map(scenario => Object.freeze({
      name: `${arm}-${scenario}`, kind: 'forwarding', arm, scenario,
      file: 'src/lib/forwarding-retention-probe.spec.ts',
    }))),
  ...['hold-proceed', 'drop-proceed', 'hold-row'].map(arm => Object.freeze({
    name: `held-${arm}`, kind: 'held', arm,
    file: 'src/lib/held-continuation-probe.spec.ts',
  })),
]);

export function validateRetentionSample(mode, sample, node) {
  if (!sample || sample.node !== node ||
      (mode.kind === 'forwarding'
        ? sample.arm !== mode.arm || sample.scenario !== mode.scenario
        : sample.mode !== mode.arm) ||
      !Array.isArray(sample.held) || sample.held.length !== 12 ||
      !Array.isArray(sample.released) || sample.released.length !== 12)
    throw new Error(`Missing, mismatched or incomplete sampling artifact: ${mode.name}`);
  // The unchanged fixtures enforce behavior. This rejects malformed recording
  // artifacts independently of process status; neither can replace the other.
  for (const round of [...sample.held, ...sample.released]) {
    if (!round || typeof round !== 'object' ||
        !Object.hasOwn(round, 'positive') || !Object.hasOwn(round, 'negative') ||
        !Object.values(round).every(value => typeof value === 'boolean'))
      throw new Error(`Malformed sampling round: ${mode.name}`);
  }
}

export function validateRetentionMatrix(results, readSample, node) {
  const errors = [];
  if (!Array.isArray(results)) return ['Missing execution matrix'];
  if (results.length !== retentionModes.length) errors.push('Incomplete execution matrix');
  const seen = new Set();
  for (const result of results) {
    const mode = retentionModes.find(item => item.name === result?.name);
    if (!mode || seen.has(result.name)) {
      errors.push(`Unexpected or duplicate mode: ${result?.name}`);
      continue;
    }
    seen.add(result.name);
    if (result.kind !== mode.kind || result.arm !== mode.arm || result.scenario !== mode.scenario ||
        result.exit !== 0 || result.processExit !== 0 || result.signal != null ||
        !Array.isArray(result.errors) || result.errors.length)
      errors.push(`Failed or mismatched execution: ${mode.name}`);
    try { validateRetentionSample(mode, readSample(result), node); }
    catch (error) { errors.push(`${mode.name}: ${error.message}`); }
  }
  for (const mode of retentionModes) if (!seen.has(mode.name)) errors.push(`Missing mode: ${mode.name}`);
  return errors;
}
