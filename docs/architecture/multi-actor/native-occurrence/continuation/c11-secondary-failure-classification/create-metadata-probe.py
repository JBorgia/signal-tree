from pathlib import Path
p=Path(__file__).parent
for side in ['candidate','oracle']:
 root=p/side/'packages/kernel/src/lib/internals'
 s=(root/'intercept-leaf-signals.spec.ts').read_text()
 s=s.replace('list.push({ path, next, prev, meta, ownerPath });', '''const keys = Object.getOwnPropertySymbols(meta ?? {});
      expect(keys.map(k => k.description)).toEqual(['ScalarPublicationCoverage']);
      expect(keys.map(k => Reflect.get(meta!, k))).toEqual([undefined]);
      console.log('PRIVATE_RECEIPT', path, Object.keys(meta ?? {}), keys.map(k => ({description:k.description,value:Reflect.get(meta!,k),enumerable:Object.getOwnPropertyDescriptor(meta!,k)?.enumerable})));
      const publicFields = Object.fromEntries(Object.entries(meta ?? {}));
      list.push({ path, next, prev, meta: publicFields, ownerPath });''')
 (root/'independent-metadata-fields.spec.ts').write_text(s)
