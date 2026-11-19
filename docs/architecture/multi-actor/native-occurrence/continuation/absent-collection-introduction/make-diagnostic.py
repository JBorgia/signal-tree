from pathlib import Path
p=Path(__file__).parent
src=Path('/private/tmp/st-native-combined-c10-promoted/candidate/packages/kernel/src/lib/absent-collection.spec.ts').read_text()
base=src[:src.index("describe('reads:")]
extra='''
import { MATERIALIZED } from './internals/snapshot-installation';
import { snapshotNodeKey } from './internals/node-shape';
it('diagnostic original held re-add sequence', () => {
 const tree=build([],true), rows=tree.$.a.rows;
 const whole=computed(()=>JSON.stringify(tree.$())); const all=computed(()=>rows.all());
 const trace=(phase:string)=>console.log(JSON.stringify({phase,records:[tree.$,tree.$.a,rows].map(x=>{const s=MATERIALIZED.get(snapshotNodeKey(x as object));return s?{generation:s.generation,cache:s.cache}:null;})}));
 omit(tree); console.log('omitted',whole(),all());trace('before-add');
 rows.addOne(Z);trace('after-add-before-demand');
 console.log('after',JSON.stringify({whole:whole(),all:all(),direct:tree.$(),directAll:rows.all()}));trace('after-demand');
 expect([whole(),all()]).toEqual(['{"a":{"rows":{"all":[{"id":"z","n":9}]}},"count":0}',[Z]]);
});
'''
for label in ['parent','c10']:
 d=p/('probe-'+label)
 (d/'candidate/packages/kernel/src/lib/absent-introduction-diagnostic.spec.ts').write_text(base+extra)
 runner=(d/'run-gate.py').read_text().replace("paths=set(json.loads((root/'BASE-MANIFEST.json').read_text()))", "paths=set(json.loads((root/'BASE-MANIFEST.json').read_text()));paths.add('packages/kernel/src/lib/absent-introduction-diagnostic.spec.ts')")
 (d/'run-diagnostic.py').write_text(runner)
