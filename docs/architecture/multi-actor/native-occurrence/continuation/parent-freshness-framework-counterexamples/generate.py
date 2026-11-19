from pathlib import Path
p=Path('/private/tmp/st-parent-freshness-other-frameworks')
for fw in ['vue','solid','react']:
 react=fw=='react'; vue=fw=='vue'
 path=f'packages/{fw}/src/'+('' if react else 'lib/')+'parent-freshness-counterparts.spec.'+('tsx' if react else 'ts')
 imports={'vue':"import { computed, nextTick, watchEffect } from 'vue';",'solid':"import { createComputed, createMemo, createRoot } from 'solid-js';",'react':"import { act, render } from '@testing-library/react';"}[fw]
 setup={'vue':"const native = computed(() => heldRoot());\n  const readNative = () => native.value;\n  const stopNative = watchEffect(() => { observed.push(native.value); }, { flush: 'sync' });",
 'solid':"let stopNative = () => {};\n  const native = createRoot(dispose => {\n    stopNative = dispose;\n    const memo = createMemo(() => heldRoot());\n    createComputed(() => { observed.push(memo()); });\n    return memo;\n  });\n  const readNative = () => native();",
 'react':"function View() {\n    const value = useSignalTree(tree, () => heldRoot());\n    observed.push(value);\n    return <output>{JSON.stringify(value)}</output>;\n  }\n  const mounted = render(<View />);\n  const readNative = () => observed[observed.length - 1];\n  const stopNative = () => mounted.unmount();"}[fw]
 step="await act(async () => { run(); for (let i=0;i<8;i++) await Promise.resolve(); });" if react else "run(); for (let i=0;i<8;i++) await Promise.resolve();"+(' await nextTick();' if vue else '')
 celltype="{ value: number }" if vue else "{ (): number; set(value: number): void }" if fw=='solid' else "{ (): number; (value: number): void }"
 guard="typeof value.n !== 'object' || value.n === null || !('value' in value.n)" if vue else "typeof value.n !== 'function'"+ (" || !('set' in value.n)" if fw=='solid' else '')
 write="row.n.value = value;" if vue else 'row.n.set(value);' if fw=='solid' else 'row.n(value);'
 s=f'''import {{ expect, it }} from 'vitest';
{imports}
import {{ signalTree, transactions{', useSignalTree' if react else ''} }} from '{'./index' if react else '../index'}';
import {{ registerMembershipPublication }} from '{'../../' if react else '../../../'}kernel/src/lib/internals/intrinsic-mutation';

type Image = Record<string, {{ n: number }}>;
type Row = {{ (): {{ n: number }} | undefined; n: {celltype} }};
function installedRow(value: unknown): Row {{
  if (typeof value !== 'function' || !('n' in value) || {guard}) {{
    throw new Error('Missing explicitly installed facade row');
  }}
  return value as Row;
}}
function write(row: Row, value: number) {{ {write} }}
const step = async (run: () => void) => {{ {step} }};

// The observer is private test instrumentation; all state/read/write/native
// consumers below use the real facade. No public completion API is implied.
it.each([false, true])('installed parent freshness and retained native dependencies (throw=%s)', async (fail) => {{
  const tree = signalTree({{ rows: {{ old: {{ n: 10 }} }} as Image, sibling: {{ n: 20 }} }}, {{ enhancers: [transactions()] }});
  const heldBranch = tree.$.rows;
  const heldRoot = tree.$;
  const before = heldRoot();
  const branchBefore = heldBranch();
  const siblingBefore = tree.$.sibling();
  const old = installedRow(heldBranch['old']);
  const observed: ReturnType<typeof heldRoot>[] = [];
  {setup}
  const nativeBefore = readNative();
  const countBefore = observed.length;
  let calls = 0;
  let during: Image | undefined;
  let ancestor: ReturnType<typeof heldRoot> | undefined;
  let cached: ReturnType<typeof heldRoot> | undefined;
  let afterNested: Image | undefined;
  let countDuring = -1;
  let retainedA: Row | undefined;
  const sentinel = new Error('counterpart completion sentinel');
  const off = registerMembershipPublication(
    e => e.branch === heldBranch && e.key === 'a' && !e.ordinary?.before.present
      ? {{ record: {{ writes: [], adds: [] }}, completion: {{}} }} : undefined,
    () => {{
      calls++;
      during = heldBranch();
      ancestor = heldRoot();
      retainedA = installedRow(heldBranch['a']);
      heldBranch({{ ...heldBranch(), b: {{ n: 2 }} }});
      afterNested = heldBranch();
      cached = readNative();
      countDuring = observed.length;
      if (fail) throw sentinel;
    }}
  );
  try {{
    expect(nativeBefore).toEqual(before);
    expect(countBefore).toBeGreaterThan(0);
    let caught: unknown;
    await step(() => {{ try {{ heldBranch({{ old: {{ n: 10 }}, a: {{ n: 1 }} }}); }} catch (error) {{ caught = error; }} }});
    off();
    expect(caught).toBe(fail ? sentinel : undefined);
    expect(calls).toBe(1);
    expect.soft(during).toEqual({{ old: {{ n: 10 }}, a: {{ n: 1 }} }});
    expect.soft(ancestor?.rows).toEqual(during);
    expect.soft(ancestor).not.toBe(before);
    expect.soft(ancestor?.sibling).toBe(siblingBefore);
    expect.soft(afterNested).toEqual({{ old: {{ n: 10 }}, a: {{ n: 1 }}, b: {{ n: 2 }} }});
    expect.soft(cached).toBe(nativeBefore);
    expect.soft(countDuring).toBe(countBefore);
    expect(heldBranch()).toEqual({{ old: {{ n: 10 }}, a: {{ n: 1 }}, b: {{ n: 2 }} }});
    expect(heldBranch()).not.toBe(branchBefore);
    expect(installedRow(heldBranch['a'])).toBe(retainedA);
    expect(readNative()).toEqual(heldRoot());
    expect(observed.length).toBeGreaterThan(countBefore);
    const a = installedRow(heldBranch['a']);
    const b = installedRow(heldBranch['b']);
    for (const [row, key, value] of [[old, 'old', 11], [a, 'a', 3], [b, 'b', 4]] as const) {{
      const count = observed.length;
      await step(() => write(row, value));
      expect(readNative()?.rows[key]).toEqual({{ n: value }});
      expect(observed.length).toBeGreaterThan(count);
    }}
    const stableRoot = heldRoot();
    const stableBranch = heldBranch();
    const stableNative = readNative();
    const stableCount = observed.length;
    await step(() => write(a, 3));
    expect(heldRoot()).toBe(stableRoot);
    expect(heldBranch()).toBe(stableBranch);
    expect(readNative()).toBe(stableNative);
    expect(observed.length).toBe(stableCount);
    {'expect(mounted.container.textContent).toBe(JSON.stringify(stableRoot));' if react else ''}
  }} finally {{ off(); stopNative(); tree.destroy(); }}
}});
'''
 (p/'candidate'/path).write_text(s)
 (p/'first-fixtures'/path).parent.mkdir(parents=True,exist_ok=True)
 (p/'first-fixtures'/path).write_text(s)
