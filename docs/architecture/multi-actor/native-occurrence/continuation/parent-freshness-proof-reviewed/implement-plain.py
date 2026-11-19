from pathlib import Path
p=Path(__file__).parent/'candidate/packages/kernel/src/lib'
def change(name,old,new,count=1):
 f=p/name;s=f.read_text();assert s.count(old)>=count,(name,old);f.write_text(s.replace(old,new,count))
a='internals/snapshot-authority.ts'
change(a,'  observe: ReadableCell<T>;','  observe: ReadableCell<T>;\n  generation: number;\n  cache?: { generation: number; value: T };\n  attempt?: { built: boolean };')
insert='''// Source readers do not publish native mirrors. Keys and ancestry remain weak.
const INSTALLED_READERS = new WeakMap<object, () => unknown>();
export function bindSnapshotInstalledReader(node: object, read: () => unknown): void {
  INSTALLED_READERS.set(node, read);
}
export function readSnapshotTerminal<T>(node: ReadableCell<T>, parent: object): T {
  bindSnapshotParent(node as object, parent);
  const observed = node();
  const installed = INSTALLED_READERS.get(node as object);
  return installed ? installed() as T : observed;
}
export function markSnapshotInstalled(node: object): void {
  let current: object | undefined = snapshotNodeKey(node);
  while (current) {
    const snapshot = MATERIALIZED.get(current);
    if (snapshot) snapshot.generation++;
    current = SNAPSHOT_PARENT.get(current)?.deref();
  }
}
'''
change(a,'const MEMBERSHIP_REVISION',insert+'\nconst MEMBERSHIP_REVISION')
f=p/a;s=f.read_text();start=s.index('  if (!snapshot) {',s.index('export function materializeSnapshotNode'))
s=s[:start]+'''  if (!snapshot) {
    const membershipRevision = membershipRevisionFor(key, locations);
    // Register before the first evaluation, including a cold reentrant build.
    const record: MaterializedSnapshot<T> = {
      generation: 0,
      observe: undefined as unknown as ReadableCell<T>,
    };
    const read = () => {
      if (record.attempt) record.attempt.built = true;
      const generation = record.generation;
      membershipRevision();
      const built = build();
      if (typeof ngDevMode === 'undefined' || ngDevMode) {
        if (built !== null && typeof built === 'object') Object.freeze(built);
      }
      // Never cache an output spanning an installation, nor retry its callback.
      if (generation !== record.generation) return built;
      if (record.cache?.generation === generation) return record.cache.value;
      record.cache = { generation, value: built };
      return built;
    };
    MATERIALIZED.set(key, record as MaterializedSnapshot<unknown>);
    record.observe = locations.createDerived(read);
    snapshot = record;
  }

  const previous = snapshot.attempt;
  const receipt = { built: false };
  snapshot.attempt = receipt;
  try {
    const observed = snapshot.observe();
    if (receipt.built) return observed;
    if (snapshot.cache?.generation === snapshot.generation) return snapshot.cache.value;
    // Observe was cached by the runtime: read installed truth without publishing.
    // Use the same tracked builder; a later real observe pass still collects all
    // dependencies and may allocate a temporary output before reusing this one.
    const generation = snapshot.generation;
    const built = build();
    if (typeof ngDevMode === 'undefined' || ngDevMode) {
      if (built !== null && typeof built === 'object') Object.freeze(built);
    }
    if (generation !== snapshot.generation) return built;
    if (snapshot.cache?.generation === generation) return snapshot.cache.value;
    snapshot.cache = { generation, value: built };
    return built;
  } finally {
    snapshot.attempt = previous;
  }
}
''';f.write_text(s)
change('utils.ts','  bindSnapshotParent,','  bindSnapshotParent,\n  readSnapshotTerminal,')
change('utils.ts','result[key] = (value as ReadableCell<unknown>)();','result[key] = readSnapshotTerminal(value as ReadableCell<unknown>, node);')
change('utils.ts','    if (isNodeAccessor(value)) {\n      // Take', '    if (isNodeAccessor(value)) {\n      bindSnapshotParent(value as object, node);\n      // Take')
change('utils.ts','''(result as Record<symbol, unknown>)[sym] = (
        value as ReadableCell<unknown>
      )();''','''(result as Record<symbol, unknown>)[sym] = readSnapshotTerminal(
        value as ReadableCell<unknown>, node
      );''')
# Shared slot substrate already has actual source binding in C8.
a='internals/tree-scalar-slot-runtime.ts'
change(a,"import { PublicationPreparation }","import { markSnapshotInstalled } from './snapshot-authority';\nimport { PublicationPreparation }")
change(a,'      return {revision,changedSlots:changed.map', '      for (const {slotIndex} of changed) {\n        const source = publicationSources[slotIndex];\n        if (source) markSnapshotInstalled(source);\n      }\n      return {revision,changedSlots:changed.map')
change(a,'      advanceRevision();\n      return {changed:semanticChanged,physicalChanged:!equal};','      advanceRevision();\n      const source = publicationSources[slotIndex];\n      if (!equal && source) markSnapshotInstalled(source);\n      return {changed:semanticChanged,physicalChanged:!equal};')
a='internals/native-tree-scalar-leaf-runtime.ts'
change(a,"import type {ConstructionAllocation}","import { bindSnapshotInstalledReader } from './snapshot-authority';\nimport type {ConstructionAllocation}")
change(a,'  holder.leaf = leaf;','  holder.leaf = leaf;\n  bindSnapshotInstalledReader(leaf, () => liveness.absence?.isAbsent(leaf) ? undefined : kernel.readSlot<T>(slotIndex));')
# Non-slot cells; slot neutral source writes are marked before callback at substrate.
a='internals/location-runtime.ts'
f=p/a;f.write_text("import { markSnapshotInstalled } from './snapshot-authority';\n"+f.read_text())
change(a,"          const physicalChanged=typeof result==='boolean'?result:result.physicalChanged;","          const physicalChanged=typeof result==='boolean'?result:result.physicalChanged;\n          if (typeof result === 'boolean' && physicalChanged) markSnapshotInstalled(location);",2)
a='internals/native-location-realization.ts';f=p/a;f.write_text("import { bindSnapshotInstalledReader, markSnapshotInstalled } from './snapshot-authority';\n"+f.read_text())
change(a,'    const mutationSource1 = observable','    bindSnapshotInstalledReader(location, read);\n    const mutationSource1 = observable')
change(a,"        const changed = write(next, 'replace');","        const changed = write(next, 'replace');\n        if (changed) markSnapshotInstalled(location);")
change(a,"        const changed = write(next, 'derive');","        const changed = write(next, 'derive');\n        if (changed) markSnapshotInstalled(location);")
a='internals/materialize-markers.ts'
change(a,'  bindSnapshotParent,','  bindSnapshotParent,\n  markSnapshotInstalled,')
change(a,'  linkAddedMember(branch as object, key, child);','  linkAddedMember(branch as object, key, child);\n  markSnapshotInstalled(branch);')
a='internals/member-membership.ts'
change(a,"import { publishMembershipChange }", "import { markSnapshotInstalled, publishMembershipChange }")
change(a,'    return changed;\n  } catch (error) {','''    if (changed) {
      markSnapshotInstalled(parent);
      // A held descendant can have a cached value even without a demanded parent.
      const mark = (node: unknown): void => {
        if (!isNodeAccessor(node)) return;
        markSnapshotInstalled(node);
        for (const key of Object.getOwnPropertyNames(node)) {
          if (key === 'caller' || key === 'arguments') continue;
          const descriptor = Object.getOwnPropertyDescriptor(node, key);
          if (descriptor && 'value' in descriptor) mark(descriptor.value);
        }
      };
      mark(child);
    }
    return changed;
  } catch (error) {''')
