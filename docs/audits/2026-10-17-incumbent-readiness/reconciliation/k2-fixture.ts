import { signalTree } from '@signal-tree/vue';
import { isRef, type Ref } from 'vue';

// Deliberately identical runtime construction values, distinct erased types.
const scalar = signalTree({ rows: {} as Record<string, number> });
const branch = signalTree({ rows: {} as Record<string, { value: number }> });
// These assignments must compile without casts; do not execute absent access.
function declaredScalar(): number { return scalar.$.rows['x'].value; }
function declaredBranch(): Ref<number> { return branch.$.rows['x'].value; }
void declaredScalar; void declaredBranch;
const presentScalar = signalTree({ rows: { x: 7 } as Record<string, number> });
const presentBranch = signalTree({ rows: { x: { value: 7 } } as Record<string, { value: number }> });
const scalarValue: number = presentScalar.$.rows['x'].value;
const branchMember: Ref<number> = presentBranch.$.rows['x'].value;
if (scalarValue !== 7 || !isRef(branchMember) || branchMember.value !== 7) throw new Error('present-key control failed');
const output = {
  source: '9917c92f identified built artifacts',
  absentScalarHandle: typeof scalar.$.rows['x'],
  absentBranchHandle: typeof branch.$.rows['x'],
  sameEmptyState: JSON.stringify(scalar.$()) === JSON.stringify(branch.$()),
  presentScalarValue: scalarValue,
  presentBranchValueIsRef: isRef(branchMember),
  presentBranchValue: branchMember.value,
};
console.log(JSON.stringify(output, null, 2));
for (const tree of [scalar, branch, presentScalar, presentBranch]) tree.destroy();
