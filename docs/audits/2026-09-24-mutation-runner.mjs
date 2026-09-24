/**
 * Mutation-test the TEST SUITE against REAL kernel source.
 *
 * PREREGISTERED PREDICTIONS, recorded before the first run:
 *   Ma  identity flattened to String(key)     predict CAUGHT  (I06)
 *   Mb  subject lifetime = business key       predict CAUGHT  (I07)
 *   Mc  retire pending before compensation    predict SURVIVES
 *       — R6 tests CHARACTERIZE the broken behaviour, so more brokenness
 *         in the same direction may not trip them
 *   Md  ignore later confirmed writes         predict CAUGHT
 *   Me  segment address -> string split       predict CAUGHT  (hostile keys)
 *
 * A surviving mutation means the suite is too weak THERE, not that the
 * mutation is harmless.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = '/Users/jonathanborgia/code/signaltree';
const M = [
  // REDONE. The first Ma/Mb proved nothing: Ma was a type-only edit (vitest
  // transpiles without typechecking, so it was inert at runtime) and Mb
  // renamed a called method, which crashes with a TypeError and only proves
  // the line executes. Both are now real runtime semantic mutations.
  { id: "Ma' key identity flattened with String()", predict: 'CAUGHT',
    file: 'packages/kernel/src/lib/physical/structural-store.ts',
    find: '  subjectIdForKey(key: K): number | undefined {\n    return this.subjectIds.get(key);',
    replace: '  subjectIdForKey(key: K): number | undefined {\n    return this.subjectIds.get(String(key) as K) ?? this.subjectIds.get(key);' },
  { id: "Mb' subject id reused instead of monotonic", predict: 'CAUGHT',
    file: 'packages/kernel/src/lib/physical/structural-store.ts',
    find: '  allocateFreshSubjectId(): number {\n    const subjectId = this.nextSubjectId;\n    this.nextSubjectId += 1;\n    return subjectId;',
    replace: '  allocateFreshSubjectId(): number {\n    const subjectId = this.nextSubjectId;\n    return subjectId;' },
];


const run = () => {
  try {
    execFileSync('npx', ['vitest', 'run', '--root', 'packages/kernel', '--bail=1'],
      { cwd: ROOT, stdio: 'pipe', maxBuffer: 64 * 1024 * 1024, timeout: 900000 });
    return { caught: false };
  } catch (e) {
    const out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
    return { caught: true, first: (out.match(/FAIL\s+(\S+)/) ?? [])[1] ?? '(unknown)' };
  }
};

for (const m of M) {
  const p = `${ROOT}/${m.file}`;
  const original = readFileSync(p, 'utf8');
  if (!original.includes(m.find)) {
    console.log(`INERT     ${m.id} — anchor not found, proves nothing`);
    continue;
  }
  writeFileSync(p, original.replace(m.find, m.replace));
  let r;
  try { r = run(); } finally { writeFileSync(p, original); }
  const verdict = r.caught ? 'CAUGHT  ' : 'SURVIVED';
  const agree = (r.caught ? 'CAUGHT' : 'SURVIVES') === m.predict ? 'as predicted' : '** PREDICTION WRONG **';
  console.log(`${verdict}  ${m.id}  [${agree}]${r.caught ? `  first: ${r.first}` : ''}`);
}
