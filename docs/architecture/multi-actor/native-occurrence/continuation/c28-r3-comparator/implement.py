from pathlib import Path
r=Path('/private/tmp/st-c28-r3-comparator/candidate/packages/kernel/src/lib/experimental-publication')
p=r/'lifecycle.ts';s=p.read_text()
s=s.replace('const pending=new Set<OwnerCell>();','''const pending=new Set<OwnerCell>();
// Comparison-only chronology. Weak exact-cell keys never retain owner history.
let confirmationSerial=0n;
const firstConfirmation=new WeakMap<OwnerCell,bigint>();
export type ComparisonAdmission=Readonly<{cutoff:bigint;protectedOwners:readonly OwnerCell[]}>;
export function comparisonCutoff():bigint{return confirmationSerial;}
export function comparisonAdmission(cutoff:bigint,invocation:NativeRequirement):ComparisonAdmission {
 return Object.freeze({cutoff,protectedOwners:Object.freeze([...new Set([
  ...invocation.inputs.flatMap(input=>input.owners),
  ...invocation.frames.flatMap(frame=>[...frame.protectedOwners]),
 ])])});
}
/** Disposable views only: never use this predicate for source or operation cleanup. */
export function comparisonObligations(proof:Readonly<Proof>,admission:ComparisonAdmission):Proof {
 const protectedOwners=new Set(admission.protectedOwners);
 const eligible=new Set([...(proof.input??[]),...(proof.validation??[])].filter(cell=>{
  const confirmed=firstConfirmation.get(cell);
  return confirmed!==undefined&&confirmed<=admission.cutoff&&cell.outcome==='confirmed'&&!protectedOwners.has(cell);
 }));
 return currentObligations(proof,eligible);
}''')
s=s.replace(' cell.outcome=outcome;pending.delete(cell);'," if(cell.outcome==='pending'&&outcome==='confirmed')firstConfirmation.set(cell,++confirmationSerial);\n cell.outcome=outcome;pending.delete(cell);")
needle='export function noWrite(channel:object,revision:object):void {'
s=s.replace(needle,'''/** Operand completion, not owner settlement. No mutation or permission grant. */
export function comparisonRevisionReady(channel:object,revision:object):boolean {
 const op=connections.get(channel)?.ops.get(revision);
 return !!op&&!op.frames.size&&!op.projectionPending&&projectionReady(op)&&
  (!op.native||nativeRequirementReady(op.native));
}
'''+needle)
p.write_text(s)
p=r/'private.ts';s=p.read_text()
s=s.replace('type Unit={relevance?', 'type Unit={comparison?:lifecycle.ComparisonAdmission;relevance?')
s=s.replace('const proofs=new WeakMap<Fact,Proof>();','''const proofs=new WeakMap<Fact,Proof>();
// Only the exact completed aggregate version qualifies. Later replacements do
// not inherit this witness; no historical Fact graph or closure epoch is needed.
const reducedComparisonProofs=new WeakSet<Proof>();''')
s=s.replace('   const predecessor=nativeValues.get(node)!;', '   const comparisonCutoff=lifecycle.comparisonCutoff();\n   const predecessor=nativeValues.get(node)!;')
s=s.replace('completion:{requirement,activation:prepared.requirement,relevance}', 'completion:{requirement,activation:prepared.requirement,relevance,comparison:lifecycle.comparisonAdmission(comparisonCutoff,prepared.requirement)}')
s=s.replace(' const unit:Unit={relevance,native,invocation:', ' const comparison=(nativeUnit as {comparison?:lifecycle.ComparisonAdmission}|undefined)?.comparison;\n const unit:Unit={comparison,relevance,native,invocation:')
s=s.replace('  proofs.set(unit.fact,lifecycle.projectRevision(channel,unit.fact,effective,b.index.unresolved()!==0));\n  const prior=unit.previous&&proofs.get(unit.previous);', '''  const stored=lifecycle.projectRevision(channel,unit.fact,effective,b.index.unresolved()!==0);
  proofs.set(unit.fact,stored);
  const reduced=b.index.unresolved()===0&&lifecycle.comparisonRevisionReady(channel,unit.fact)&&
   (!unit.native||lifecycle.nativeRequirementReady(unit.native))&&
   (!unit.selected||lifecycle.nativeRequirementReady(unit.selected));
  if(reduced)reducedComparisonProofs.add(stored);
  const prior=unit.previous&&proofs.get(unit.previous);
  const comparison=unit.comparison&&reduced&&prior&&reducedComparisonProofs.has(prior)?unit.comparison:undefined;''')
s=s.replace('sameProof(prior&&lifecycle.currentObligations(prior,unit.relevance),lifecycle.currentObligations(effective,unit.relevance))', 'sameProof(prior&&(comparison?lifecycle.comparisonObligations(prior,comparison):lifecycle.currentObligations(prior,unit.relevance)),comparison?lifecycle.comparisonObligations(effective,comparison):lifecycle.currentObligations(effective,unit.relevance))')
s=s.replace('  unit.relevance=undefined;unit.payload=undefined;', '  unit.comparison=undefined;unit.relevance=undefined;unit.payload=undefined;')
p.write_text(s)
