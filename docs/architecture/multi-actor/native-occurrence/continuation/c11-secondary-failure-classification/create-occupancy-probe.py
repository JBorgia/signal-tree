from pathlib import Path
p=Path(__file__).parent
for side in ['candidate','oracle']:
 root=p/side/'packages/kernel/src/lib';s=(root/'occupancy-successor-realization.spec.ts').read_text()
 start=s.index('  const physical=port.prepareOrdinaryEffects!(ordinary);');end=s.index('\n }finally{tree.destroy();}',start)
 s=s[:start]+'''  const validate=(rows as unknown as {__validateOrdinaryStructure(e:typeof ordinary):boolean}).__validateOrdinaryStructure;
  expect(validate(ordinary.map(e=>({...e,structural:'remove',before:e.after,after:undefined})))).toBe(true);
  expect(validate(ordinary)).toBe(false);
  const physical=port.prepareOrdinaryEffects!(ordinary);
  expect(port.validateEffects(physical)).toEqual({kind:'structural-drift'});
  expect(()=>port.applyAtomically(physical)).toThrow();
  expect(rows.ids()).toEqual(['c','bb']);expect(rows.byIdOrFail('bb')).toBe(b);expect(a()).toBeUndefined();expect(b.n()).toBe(88);
  expect(adds).toEqual([]);expect(removes).toEqual([]);expect(snapshots).toEqual([]);
'''+s[end:]
 (root/'independent-occupancy-admission.spec.ts').write_text(s)
