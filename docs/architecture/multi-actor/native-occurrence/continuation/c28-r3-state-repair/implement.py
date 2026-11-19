from pathlib import Path
import difflib
root=Path('/private/tmp/st-c28-r3-state-repair');base=Path('/private/tmp/st-c28-r3-comparator/candidate');paths=['packages/kernel/src/enhancers/transactions/transactions.ts','packages/kernel/src/lib/internals/causal-runtime/tree-realization-adapter.ts']
p=root/'candidate'/paths[0];s=p.read_text();old='''    if (
      recorded !== undefined &&
      installedOperations.get(recorded)?.owners.has(resolvedPositionIds[0])
    )''';new='''    // Only authored notification replay duplicates an installed terminal record.
    // Realized input retains an ambient transaction ID but is separate authority.
    if (
      getWriteParticipation(meta) !== 'realized' &&
      recorded !== undefined &&
      installedOperations.get(recorded)?.owners.has(resolvedPositionIds[0])
    )''';assert s.count(old)==1;s=s.replace(old,new);p.write_text(s)
p=root/'candidate'/paths[1];s=p.read_text();old='''      const apply = () => {
        // Prepare the remaining frame''';new='''      // Frame preparation now records ordinary authorship before notification.
      // Classify the realization at that boundary while retaining the caller's
      // origin/transaction context; withWriteContext restores it on return/throw.
      const apply = () => withWriteContext(
        { ...(getActiveWriteContext() ?? {}), intent: 'system', participation: 'realized' },
        () => {
        // Prepare the remaining frame''';assert s.count(old)==1;s=s.replace(old,new)
old='''        members?.publish();
      };

      // Membership listeners''';new='''        members?.publish();
        }
      );

      // Membership listeners''';assert s.count(old)==1;s=s.replace(old,new);p.write_text(s)
patch=''.join(''.join(difflib.unified_diff((base/f).read_text().splitlines(True),(root/'candidate'/f).read_text().splitlines(True),fromfile='a/'+f,tofile='b/'+f)) for f in paths);(root/'runtime.patch').write_text(patch)
