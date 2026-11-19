from pathlib import Path
root=Path('/private/tmp/st-c28-r3-entity-artifact-gate-f1/candidate')
p=root/'tools/verify-entity-registration-artifacts.mjs';s=p.read_text()
s=s.replace("const work = realpathSync(mkdtempSync(join(tmpdir(), 'st-entity-artifact-')));", """// Reject an in-workspace TMPDIR before creating anything there. Walk canonical
// ancestors so a symlink or a different checkout cannot supply workspace peers.
const tempRoot = realpathSync(tmpdir());
for (let dir = tempRoot; ; dir = dirname(dir)) {
  assert(
    dir !== realpathSync(ROOT) &&
      !existsSync(join(dir, 'pnpm-workspace.yaml')) &&
      !existsSync(join(dir, '.git')),
    'TMPDIR must be outside a workspace'
  );
  if (dirname(dir) === dir) break;
}
const work = realpathSync(mkdtempSync(join(tempRoot, 'st-entity-artifact-')));""")
s=s.replace('    modes: {},\n    graphs: [],', '    modes: {},\n    graphs: [],\n    blindModes: [],')
old="""      if (mutant)
        assert(
          behavioralFailures(results).length > 0,
          `${label}/${mode}: registration mutant survived behavioral detection`
        );
      else"""
new="""      if (mutant) {
        // Raw classified failures establish that the mutation reached behavior.
        // The independently mutated detector is tested only AFTER that fact.
        assert(
          results.some((r) => r.kind === 'behavior'),
          `${label}/${mode}: registration mutant has no behavioral witness`
        );
        if (behavioralFailures(results).length === 0) arm.blindModes.push(mode);
      } else"""
assert old in s;s=s.replace(old,new)
s=s.replace('  return arm;\n}', '  arm.controlsPassed = true;\n  return arm;\n}')
old="""    replay(pack(packages, stage, 'mutant-tarballs'), 'mutant', true);
    replay(clean, 'recovery');
  }
  report.passed = true;"""
new="""    const mutant = replay(pack(packages, stage, 'mutant-tarballs'), 'mutant', true);
    replay(clean, 'recovery');
    if (mutant.blindModes.length) {
      assert.deepEqual(mutant.blindModes, ['installed', 'production']);
      report.classifierBlindness = true;
    }
  }
  report.passed = !report.classifierBlindness;"""
assert old in s;s=s.replace(old,new)
old="""  save(join(work, 'result.json'), report);
}
if (report.passed)"""
new="""  // A proof is emitted only after both modes AND clean recovery completed,
  // and the finally block verified the original inputs. Never infer it from
  // an error message or a generic nonzero exit (review F1).
  if (report.classifierBlindness && report.inputsUnchanged &&
      !report.error && !report.integrityError) {
    report.mutationProof = {
      kind: 'entity-registration-classifier-blindness-v1',
      token: env.SIGNAL_TREE_MUTATION_PROOF_TOKEN,
      baseline: 'passed',
      mutant: 'behavioral-failures-both-modes',
      controls: 'passed',
      recovery: 'passed',
      inputs: 'unchanged',
    };
    process.exitCode = 42;
  }
  save(join(work, 'result.json'), report);
}
if (report.mutationProof) {
  console.log('SIGNALTREE_MUTATION_PROOF ' + JSON.stringify(report.mutationProof));
  console.error('Classifier blindness identified after baseline, mutant controls and clean recovery.');
} else if (report.passed)"""
assert old in s;s=s.replace(old,new);p.write_text(s)
p=root/'tools/verify-gates.mjs';s=p.read_text().replace("import { createHash } from 'node:crypto';", "import { createHash, randomUUID } from 'node:crypto';")
anchor="""    name: 'entity-registration-artifacts:self',
    covers:"""
assert anchor in s;s=s.replace(anchor,"""    name: 'entity-registration-artifacts:self',
    mutationProof: 'entity-registration-classifier-blindness-v1',
    covers:""")
anchor="if (has('--self-test')) {\n  console.log("
helper="""// Opt-in only: setup-sensitive mutation proofs must identify the intended
// detector failure, rather than treating any process failure as evidence.
function validMutationProof(gate, result, token) {
  if (result.code !== 42 || !token) return false;
  const prefix = 'SIGNALTREE_MUTATION_PROOF ';
  const lines = result.output.split('\\n').filter((line) => line.startsWith(prefix));
  if (lines.length !== 1) return false;
  try {
    const proof = JSON.parse(lines[0].slice(prefix.length));
    const expected = {
      kind: gate.mutationProof,
      token,
      baseline: 'passed',
      mutant: 'behavioral-failures-both-modes',
      controls: 'passed',
      recovery: 'passed',
      inputs: 'unchanged',
    };
    return Object.keys(proof).length === Object.keys(expected).length &&
      Object.entries(expected).every(([key, value]) => proof[key] === value);
  } catch {
    return false;
  }
}

"""
assert s.count(anchor)==1;s=s.replace(anchor,helper+anchor)
anchor="""      if (gate.provenBy) {
        // Not unproven"""
replacement="""      if (gate.provenBy) {
        if (GATES.find((g) => g.name === gate.provenBy)?.mutationProof) {
          results.push({ gate, state: 'pending-proof' });
          console.log(`  · ${gate.name} awaiting validated ${gate.provenBy}`);
          continue;
        }
        // Not unproven"""
assert anchor in s;s=s.replace(anchor,replacement)
anchor="""    let result;
    try {
      result = withMutation(gate.mutation, () =>
        run(gate.mutationCmd ? { ...gate, cmd: gate.mutationCmd } : gate)
      );"""
replacement="""    let result;
    const proofToken = gate.mutationProof ? randomUUID() : undefined;
    try {
      result = withMutation(gate.mutation, () =>
        run({
          ...gate,
          cmd: gate.mutationCmd ?? gate.cmd,
          ...(proofToken ? {
            env: { ...gate.env, SIGNAL_TREE_MUTATION_PROOF_TOKEN: proofToken },
          } : {}),
        })
      );"""
assert anchor in s;s=s.replace(anchor,replacement)
anchor="""    if (result.code !== 0) {
      results.push({ gate, state: 'proven' });"""
replacement="""    if (gate.mutationProof && !validMutationProof(gate, result, proofToken)) {
      results.push({ gate, state: 'error' });
      console.log(`ERROR — no validated ${gate.mutationProof} witness (exit ${result.code})`);
      if (result.output.trim()) console.log(result.output.trim().slice(-12000));
      continue;
    }
    if (result.code !== 0) {
      results.push({ gate, state: 'proven' });"""
assert anchor in s;s=s.replace(anchor,replacement)
anchor="""} else {
  console.log(`\\nRunning ${selected.length} gates\\n`);"""
replacement="""  // Only companions opting into the witness contract affect this deferred
  // path. Existing unrelated provenBy and generic mutation semantics stay put.
  for (const result of results.filter((r) => r.state === 'pending-proof')) {
    const proven = results.some((r) =>
      r.gate.name === result.gate.provenBy && r.state === 'proven');
    result.state = proven ? 'proven-by' : 'error';
    console.log(proven
      ? `  · ${result.gate.name} proven via validated ${result.gate.provenBy} ✓`
      : `  · ${result.gate.name} ERROR — companion proof absent or invalid`);
  }
} else {
  console.log(`\\nRunning ${selected.length} gates\\n`);"""
assert anchor in s;s=s.replace(anchor,replacement);p.write_text(s)
p=root/'tools/experiments/entity-registration/README.md';s=p.read_text();s+='''
The companion registry proof is opt-in: it accepts only an identified classifier-blindness witness after the clean baseline, both mutant modes and controls, clean recovery, and unchanged-input checks. Setup failures, timeouts, integrity failures, or a missing/invalid witness are errors, not proof; its parent is not proven unless the companion witness validates. The tool rejects TMPDIR inside a workspace before creating a consumer.

Recorded dependency qualification covers Node 24.15.0 and npm 11.12.1 only. No second npm version has been qualified; the publish workflow's broader npm range is not additional test evidence.
''';p.write_text(s)
