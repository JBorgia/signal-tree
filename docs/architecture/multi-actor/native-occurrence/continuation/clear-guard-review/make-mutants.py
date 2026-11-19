from pathlib import Path
import json,shutil,difflib
p=Path(__file__).parent;m=json.loads((p/'BASE-C19.json').read_text())
for arm in ['current-route-mutant','legacy-mutant']:
 for f in m:
  a=p/'candidate'/f;b=p/arm/f;b.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(a,b)
 (p/arm/'node_modules').symlink_to('/Users/jonathanborgia/code/signaltree/node_modules',target_is_directory=True)
file='packages/kernel/src/lib/physical/order-restores-for-placement.ts';f=p/'current-route-mutant'/file;s=f.read_text();old='''      fullHead < full.length
        ? full[fullHead++]
        : partialHead < partial.length
        ? partial[partialHead++]
        : restores.find(''';new='''      restores.find(effect => !placed.has(effect) && waiting.get(effect) === 0)
        ?? restores.find(effect => !placed.has(effect) && hasLiveAnchor.has(effect))
        ?? restores.find(''';assert old in s;f.write_text(s.replace(old,new));(p/'CURRENT-ROUTE-MUTANT.patch').write_text(''.join(difflib.unified_diff(s.splitlines(True),f.read_text().splitlines(True),fromfile='a/'+file,tofile='b/'+file)))
file='packages/kernel/src/lib/internals/causal-runtime/pending-rollback.ts';f=p/'legacy-mutant'/file;s=f.read_text();old='''dominantStructuralEffects
            .get(effect.subjectId)
            ?.find((candidate) => sameSubjectScope(candidate, effect))''';new="""turn.effects.find(candidate =>
            (candidate.structural === 'add' || candidate.structural === 'remove') &&
            sameSubjectScope(candidate, effect))""";assert old in s;f.write_text(s.replace(old,new));(p/'LEGACY-MUTANT.patch').write_text(''.join(difflib.unified_diff(s.splitlines(True),f.read_text().splitlines(True),fromfile='a/'+file,tofile='b/'+file)))
