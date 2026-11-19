from pathlib import Path
p=Path(__file__).parent;root=p/'candidate/packages/kernel/src/lib';s=(root/'independent-occupancy-valid-inverse.spec.ts').read_text()
(root/'independent-occupancy-reverse-inverse.spec.ts').write_text(s.replace("rows.addOne({id:'a',n:42});rows.addOne({id:'b',n:43});","rows.addOne({id:'b',n:43});rows.addOne({id:'a',n:42});"))
start=s.index("  withWriteContext({participation:'inspection'},()=>{rows.removeOne('a');")
end=s.index("  const adds:string[]",start)
new='''  const replacement=tree.transact(()=>{
   rows.removeOne('a');
   withWriteContext({participation:'inspection'},()=>{rows.changeId('b','bb');rows.setAll([{id:'c',n:9},{id:'bb',n:88}]);});
   rows.addOne({id:'b',n:43});
  });
  const freshB=rows.byIdOrFail('b');expect(freshB).not.toBe(b);
  withWriteContext({participation:'inspection'},()=>rows.removeOne('b'));
  expect(rows.ids()).toEqual(['c','bb']);expect(rows.byIdOrFail('bb')).toBe(b);expect(b.n()).toBe(88);expect(a()).toBeUndefined();
'''
(root/'independent-occupancy-remove-inverse.spec.ts').write_text(s[:start]+new+s[end:])
