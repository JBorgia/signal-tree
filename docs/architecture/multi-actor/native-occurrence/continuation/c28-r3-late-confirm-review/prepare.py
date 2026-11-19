from pathlib import Path
import hashlib,json,shutil,difflib
p=Path(__file__).parent;b=Path('/private/tmp/st-c28-r3-comparator/candidate');base=Path('/private/tmp/st-c28-r3-comparator');h=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
assert h(base/'RUNTIME-MANIFEST.json')=='1edb39e668f2a370554f692d455b75fac08a9836003a150acd09e2326368a08c'
m=json.loads((base/'MANIFEST.json').read_text());rt=json.loads((base/'RUNTIME-MANIFEST.json').read_text());c=p/'r3-copy';c.mkdir()
for f,v in m.items():
 assert h(b/f)==v,f
 d=c/f;d.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(b/f,d)
assert {f:h(b/f) for f in m}==m
for f,v in rt.items():assert h(c/f)==v
(c/'node_modules').symlink_to('/Users/jonathanborgia/code/signaltree/node_modules',target_is_directory=True)
for fn in ['MANIFEST.json','RUNTIME-MANIFEST.json','SNAPSHOT.json']:shutil.copy2(base/fn,p/'originals'/fn)
original=Path('/private/tmp/st-c28-r3-boundary-controls/comparator-boundary-controls.spec.ts');shutil.copy2(original,p/'originals/BASELINE-boundary-controls.spec.ts')
s=original.read_text().split("it('late aggregate enrollment")[0].replace("import { RecipientOccurrences } from './experimental-publication/recipient-occurrence';\n",'')
s=s.replace("  const order: string[] = [];",'''  const order: string[] = [];
  let lateCell: lifecycle.OwnerCell | undefined;
  let nativeCutoff: bigint | undefined, confirmationOrdinal: bigint | undefined;
  let observing = false;
  const comparisons: { cutoff: string; lateProtected: boolean; before: Record<string, boolean>; after: Record<string, boolean>; pendingDestinationPreserved: boolean; flagsUnchanged: boolean }[] = [];
  const originalComparison = lifecycle.comparisonObligations;
  const comparisonSpy = vi.spyOn(lifecycle, 'comparisonObligations').mockImplementation((proof, admission) => {
    const result = originalComparison(proof, admission);
    if (observing && lateCell) {
      const roles = ['owners', 'destination', 'input', 'validation', 'possible'] as const;
      const before = Object.fromEntries(roles.map(role => [role, (proof[role] ?? []).includes(lateCell!)]));
      const after = Object.fromEntries(roles.map(role => [role, (result[role] ?? []).includes(lateCell!)]));
      const flags = ['unknown', 'invalid', 'unavailableInput', 'historicalWindow', 'terminalRejectedRoles'] as const;
      comparisons.push({ cutoff: String(admission.cutoff), lateProtected: admission.protectedOwners.includes(lateCell), before, after,
        pendingDestinationPreserved: (proof.destination ?? []).filter(cell => cell.outcome === 'pending').every(cell => (result.destination ?? []).includes(cell) && result.owners.includes(cell)),
        flagsUnchanged: flags.every(flag => proof[flag] === result[flag]) });
    }
    return result;
  });''')
s=s.replace("    a.confirm(); order.push('confirmed');", "    nativeCutoff = (native as { comparison?: lifecycle.ComparisonAdmission }).comparison?.cutoff;\n    a.confirm(); confirmationOrdinal = lifecycle.comparisonCutoff(); order.push('confirmed');")
s=s.replace("    a = tree.transact(() => tree.$.q(1));", "    const priorCells = new Set(lifecycle.pendingOwners());\n    a = tree.transact(() => tree.$.q(1));\n    lateCell = lifecycle.pendingOwners().find(cell => !priorCells.has(cell));\n    expect(lateCell?.outcome).toBe('pending');")
s=s.replace('    armed = true;', '    armed = true; observing = true;')
s=s.replace('    await drain(); const before = [...sent], beforeReceipt = receipt?.read();','    await drain(); observing = false; const before = [...sent], beforeReceipt = receipt?.read();')
s=s.replace("record({ case: 'late-confirm', calls, order, before, beforeReceipt, final, terminal,", "record({ case: 'late-confirm', calls, order, before, beforeReceipt, final, terminal,\n      nativeCutoff: String(nativeCutoff), confirmationOrdinal: String(confirmationOrdinal), comparisons,")
s=s.replace('    // Receipt attribution/error is recorded, not invented from timing alone.', '''    expect(nativeCutoff).toBeDefined(); expect(confirmationOrdinal).toBeDefined();
    expect(confirmationOrdinal! > nativeCutoff!).toBe(true);
    const actual = comparisons.filter(row => row.cutoff === String(nativeCutoff));
    expect(actual.length).toBeGreaterThan(0);
    const witnesses = actual.filter(row => row.before.input || row.before.validation);
    expect(witnesses.length).toBeGreaterThan(0);
    for (const row of witnesses) {
      expect(row.lateProtected).toBe(false);
      expect(row.after).toEqual(row.before);
      expect(row.pendingDestinationPreserved).toBe(true);
      expect(row.flagsUnchanged).toBe(true);
    }
    // Receipt attribution/error is recorded, not invented from timing alone.''')
s=s.replace('} finally { tail?.(); release?.(); c.dispose(); tree.destroy(); }','} finally { comparisonSpy.mockRestore(); tail?.(); release?.(); c.dispose(); tree.destroy(); }')
f='packages/kernel/src/lib/late-confirm-comparison-observation.spec.ts';(p/'late-confirm-comparison-observation.spec.ts').write_text(s);(c/f).write_text(s)
shutil.copy2(base/'MANIFEST.json',p/'R3-MANIFEST.json');(p/'IDENTITY.json').write_text(json.dumps({'manifestSHA256':h(base/'MANIFEST.json'),'runtimeManifestSHA256':h(base/'RUNTIME-MANIFEST.json'),'overlays':{f:h(c/f)}},indent=2)+'\n')
r=Path('/private/tmp/st-c28-r3-boundary-controls/run.py').read_text().replace("cwd=p/'r2-copy'","cwd=p/'r3-copy'").replace('R2-MANIFEST.json','R3-MANIFEST.json').replace('comparator-boundary-controls','late-confirm-comparison-observation');(p/'run.py').write_text(r)
(p/'TESTS.patch').write_text('diff --git a/'+f+' b/'+f+'\nnew file mode 100644\n'+''.join(difflib.unified_diff([],s.splitlines(True),fromfile='/dev/null',tofile='b/'+f)))
print('Verified/copied '+str(len(m))+' frozen files; runtime manifest exact.')
