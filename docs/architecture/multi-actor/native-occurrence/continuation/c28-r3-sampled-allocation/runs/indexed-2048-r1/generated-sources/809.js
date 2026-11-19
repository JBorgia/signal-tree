'use strict';async (__vite_ssr_exports__,__vite_ssr_import_meta__,__vite_ssr_import__,__vite_ssr_dynamic_import__,__vite_ssr_exportAll__,__vite_ssr_exportName__,__filename,__dirname,module,exports,require)=>{{Object.defineProperty(__vite_ssr_exports__, "OrdinaryMemberPresenceSource", { enumerable: true, configurable: true, get(){ try { return OrdinaryMemberPresenceSource } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "readOrdinaryMemberPresence", { enumerable: true, configurable: true, get(){ try { return readOrdinaryMemberPresence } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "MEMBERSHIP_CHANGED", { enumerable: true, configurable: true, get(){ try { return MEMBERSHIP_CHANGED } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "isDormantMember", { enumerable: true, configurable: true, get(){ try { return isDormantMember } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "getRetainedMembershipPath", { enumerable: true, configurable: true, get(){ try { return getRetainedMembershipPath } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "isAbsentMember", { enumerable: true, configurable: true, get(){ try { return isAbsentMember } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "structuralWrites", { enumerable: true, configurable: true, get(){ try { return structuralWrites } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "beginStructuralWrite", { enumerable: true, configurable: true, get(){ try { return beginStructuralWrite } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "endStructuralWrite", { enumerable: true, configurable: true, get(){ try { return endStructuralWrite } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "inStructuralWrite", { enumerable: true, configurable: true, get(){ try { return inStructuralWrite } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "readdedDuringStructuralWrite", { enumerable: true, configurable: true, get(){ try { return readdedDuringStructuralWrite } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "storedReads", { enumerable: true, configurable: true, get(){ try { return storedReads } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "reactivatePathOnWrite", { enumerable: true, configurable: true, get(){ try { return reactivatePathOnWrite } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "republishMembers", { enumerable: true, configurable: true, get(){ try { return republishMembers } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "linkAddedMember", { enumerable: true, configurable: true, get(){ try { return linkAddedMember } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "hasDormantMembers", { enumerable: true, configurable: true, get(){ try { return hasDormantMembers } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "dormantKeys", { enumerable: true, configurable: true, get(){ try { return dormantKeys } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "setMemberPresence", { enumerable: true, configurable: true, get(){ try { return setMemberPresence } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "prepareFreshMemberPresence", { enumerable: true, configurable: true, get(){ try { return prepareFreshMemberPresence } catch {} }});
const __vite_ssr_import_0__ = await __vite_ssr_import__("/src/lib/write-context.ts", {"importedNames":["getActiveWriteContext"]});
const __vite_ssr_import_1__ = await __vite_ssr_import__("/src/lib/internals/plain-branch-membership.ts", {"importedNames":["ordinaryMemberSnapshot"]});
const __vite_ssr_import_2__ = await __vite_ssr_import__("/src/lib/internals/mutation-capture-runtime.ts", {"importedNames":["getMutationCaptureRuntime"]});
const __vite_ssr_import_3__ = await __vite_ssr_import__("/src/lib/internals/intrinsic-mutation.ts", {"importedNames":["membershipPublicationPreparer","combineTerminalRecords","installTerminalRecord","completePreparedPublication"]});





const __vite_ssr_import_4__ = await __vite_ssr_import__("/src/lib/internals/position-registry.ts", {"importedNames":["getNodeAddress","getPositionRegistry"]});
const __vite_ssr_import_5__ = await __vite_ssr_import__("/src/lib/internals/error-reporter.ts", {"importedNames":["reportContainedObserverError"]});
const __vite_ssr_import_6__ = await __vite_ssr_import__("/src/lib/internals/production-substrate-stats.ts", {"importedNames":["PRODUCTION_SUBSTRATE_STATS_ENABLED","recordProductionSubstrateStat"]});



const __vite_ssr_import_7__ = await __vite_ssr_import__("/src/lib/internals/location-runtime.ts", {"importedNames":["getLocationRuntime","isWritableLocation","NEUTRAL_LOCATION_RUNTIME","writableLocationPublisher"]});





const __vite_ssr_import_8__ = await __vite_ssr_import__("/src/lib/internals/node-shape.ts", {"importedNames":["isNodeAccessor","isTraversableNode","NODE_STORE_SYMBOL"]});




const __vite_ssr_import_9__ = await __vite_ssr_import__("/src/lib/internals/owned-metadata.ts", {"importedNames":["getOwnedPositionIds"]});
const __vite_ssr_import_10__ = await __vite_ssr_import__("/src/lib/internals/owner-invalidation-port.ts", {"importedNames":["markOwnerInvalidatedFrom"]});
const __vite_ssr_import_11__ = await __vite_ssr_import__("/src/lib/internals/path-observation-port.ts", {"importedNames":["capturePathReAddIfObserved"]});
const __vite_ssr_import_12__ = await __vite_ssr_import__("/src/lib/internals/snapshot-authority.ts", {"importedNames":["markSnapshotInstalled","publishMembershipChange"]});
const __vite_ssr_import_13__ = await __vite_ssr_import__("/src/lib/internals/tree-scalar-slot-port.ts", {"importedNames":["getTreeScalarSlotRuntime"]});


const DORMANT = Symbol.for("SignalTree:DormantMember");
let membershipEpoch = 1;
const omittedMembers = /* @__PURE__ */ new WeakMap();
class OrdinaryMemberPresenceSource {
  revision = 0;
  divergent = /* @__PURE__ */ new Map();
  read(key, child, physical) {
    const entry = this.divergent.get(key);
    if (entry && entry.child !== child)
      throw new Error("Ordinary member presence identity changed");
    return entry?.present ?? physical;
  }
  prepare(key, child, physicalBefore, physicalAfter, inspection) {
    const before = this.read(key, child, physicalBefore);
    const after = inspection ? before : physicalAfter;
    return Object.freeze({
      revision: this.revision,
      key,
      child,
      before,
      after,
      physicalBefore,
      physicalAfter,
      retained: this.divergent.has(key),
      next: after === physicalAfter ? void 0 : Object.freeze({ child, present: after })
    });
  }
  validate(edit) {
    if (this.revision !== edit.revision)
      throw new Error("Ordinary membership preparation reentered installation");
  }
  install(edit) {
    if (edit.next) this.divergent.set(edit.key, edit.next);
    else this.divergent.delete(edit.key);
    if (edit.physicalBefore !== edit.physicalAfter || edit.before !== edit.after)
      this.revision++;
    return Number(edit.next !== void 0) - Number(edit.retained);
  }
};
const ordinaryPresenceSources = /* @__PURE__ */ new WeakMap();
const ordinaryDivergences = /* @__PURE__ */ new WeakMap();
function readOrdinaryMemberPresence(branch, key) {
  const parent = nodeOf(branch);
  const descriptor = Object.getOwnPropertyDescriptor(parent, key);
  if (!descriptor || !(0,__vite_ssr_import_8__.isTraversableNode)(descriptor.value))
    return descriptor?.enumerable === true;
  return ordinaryPresenceSources.get(parent)?.read(key, descriptor.value, descriptor.enumerable === true) ?? descriptor.enumerable === true;
};
function ownOrdinaryAbsence(node) {
  for (let binding = memberBinding(node); binding; binding = memberBinding(binding.parent))
    if (!readOrdinaryMemberPresence(binding.parent, binding.key)) return true;
  return false;
}
const ABSENCE_CHECK_EVERY = 64;
let absenceChecks = 0;
const MEMBERSHIP_CHANGED = Symbol.for("SignalTree:MembershipChanged");
function membershipHook(node) {
  return node?.[MEMBERSHIP_CHANGED];
}
const NODE_ACCESSOR_PEER = Symbol.for("SignalTree:NodeAccessorPeer");
function isDormantMember(leaf) {
  const binding = memberBinding(leaf);
  if (binding === void 0) return false;
  const descriptor = Object.getOwnPropertyDescriptor(
    binding.parent,
    binding.key
  );
  return descriptor !== void 0 && descriptor.enumerable === false;
};
function memberBinding(leaf) {
  if (!(0,__vite_ssr_import_8__.isTraversableNode)(leaf)) {
    return void 0;
  };
  return leaf[DORMANT];
}
function getRetainedMembershipPath(node) {
  const path = [];
  for (let child = node; (0,__vite_ssr_import_8__.isTraversableNode)(child); ) {
    const binding = memberBinding(child);
    if (!binding) break;
    const descriptor = Object.getOwnPropertyDescriptor(
      binding.parent,
      binding.key
    );
    path.push({
      parent: binding.parent,
      key: binding.key,
      child,
      present: descriptor?.enumerable === true && descriptor.value === child
    });
    child = binding.parent;
  };
  return path;
};
function reactivateOnWrite(leaf) {
  const binding = memberBinding(leaf);
  if (!binding) return false;
  return setMemberPresence(binding.parent, binding.key, "active");
}
function nodeOf(parent) {
  return parent[NODE_ACCESSOR_PEER] ?? parent;
}
function isAbsentMember(node) {
  const first = memberBinding(node);
  if (first === void 0) return false;
  if (first.epoch === membershipEpoch) {
    if ((typeof ngDevMode === "undefined" || ngDevMode) && ++absenceChecks % ABSENCE_CHECK_EVERY === 0 && walkAbsence(first) !== first.absent)
      throw new Error(
        "SignalTree internal: a cached absence answer disagrees with enumerability (membershipEpoch was not advanced)."
      );
    return first.absent;
  };
  if (__vite_ssr_import_6__.PRODUCTION_SUBSTRATE_STATS_ENABLED) {
    (0,__vite_ssr_import_6__.recordProductionSubstrateStat)("absenceWalks");
  };
  first.absent = walkAbsence(first);
  first.epoch = membershipEpoch;
  return first.absent;
};
function walkAbsence(first) {
  for (let binding = first; binding; binding = memberBinding(binding.parent)) {
    const descriptor = Object.getOwnPropertyDescriptor(
      binding.parent,
      binding.key
    );
    if (descriptor?.enumerable === false) return true;
  };
  return false;
}
const structuralWrites = {
  depth: 0,
  stamp: 0
};
function beginStructuralWrite() {
  structuralWrites.depth++;
};
function endStructuralWrite(failed) {
  if (--structuralWrites.depth) return;
  structuralWrites.readded = void 0;
  structuralWrites.end?.(failed);
};
function inStructuralWrite(node) {
  return node !== void 0 && structuralWrites.own === node;
};
function readdedDuringStructuralWrite(branch, key, since) {
  return (structuralWrites.readded?.get(nodeOf(branch))?.get(key) ?? 0) > since;
};
const storedReads = { depth: 0 };
function reactivatePathOnWrite(node) {
  const physicallyAbsent = isAbsentMember(node);
  if (!physicallyAbsent && !ownOrdinaryAbsence(node)) return false;
  if (inStructuralWrite(node)) return reactivateOnWrite(node);
  if (__vite_ssr_import_6__.PRODUCTION_SUBSTRATE_STATS_ENABLED) {
    (0,__vite_ssr_import_6__.recordProductionSubstrateStat)("absenceWalks");
  };
  const path = [];
  let outer = -1;
  for (let binding = memberBinding(node); binding; binding = memberBinding(binding.parent)) {
    const descriptor = Object.getOwnPropertyDescriptor(
      binding.parent,
      binding.key
    );
    if (descriptor?.enumerable === false || !readOrdinaryMemberPresence(binding.parent, binding.key))
      outer = path.length;
    path.push(binding);
  };
  if (outer < 0) return false;
  const announce = (0,__vite_ssr_import_11__.capturePathReAddIfObserved)(path, outer);
  for (let i = outer - 1; i >= 0; i--) {
    const { parent, key: kept } = path[i];
    for (const member of Object.keys(parent))
      if (member !== kept) setMemberPresence(parent, member, "dormant");
  };
  for (let i = outer; i >= 0; i--) {
    const { parent, key } = path[i];
    setMemberPresence(parent, key, "active");
    if (structuralWrites.depth) {
      const readded = structuralWrites.readded ??= /* @__PURE__ */ new Map();
      let keys = readded.get(parent);
      if (!keys) readded.set(parent, keys = /* @__PURE__ */ new Map());
      keys.set(key, ++structuralWrites.stamp);
    }
  };
  if (!(0,__vite_ssr_import_7__.isWritableLocation)(node) || outer > 0)
    republishMembers(path[outer].parent, [path[outer].key]);
  announce?.();
  return physicallyAbsent;
};
const ABSENCE = {
  // History capture reads what storage holds (`storedReads`).
  isAbsent: (node) => !storedReads.depth && isAbsentMember(node),
  reAdd: reactivatePathOnWrite,
  needsAdmission: (node) => (0,__vite_ssr_import_0__.getActiveWriteContext)()?.participation !== "inspection" && ownOrdinaryAbsence(node)
};
function republishMembers(parent, keys) {
  const runtime = (0,__vite_ssr_import_13__.getTreeScalarSlotRuntime)(parent);
  if (!runtime) return;
  const changedSlots = [];
  const unaddressedLeaves = [];
  const branches = [];
  const publish = (child) => {
    const positionId = (0,__vite_ssr_import_9__.getOwnedPositionIds)(child)?.[0];
    const slot = positionId === void 0 ? void 0 : runtime.resolveScalarSlot(positionId);
    if (slot !== void 0) return changedSlots.push(slot) > 0;
    const publisher = (0,__vite_ssr_import_7__.writableLocationPublisher)(child);
    if (publisher) return unaddressedLeaves.push(publisher) > 0;
    membershipHook(child)?.();
    if ((0,__vite_ssr_import_8__.isNodeAccessor)(child)) {
      branches.push(child);
      for (const key of Object.keys(child))
        publish(child[key]);
    };
    return false;
  };
  let tokenCarrying = 0;
  for (const key of keys)
    if (publish(parent[key])) tokenCarrying++;
  if (tokenCarrying < keys.length) {
    (0,__vite_ssr_import_12__.publishMembershipChange)(parent);
  } else {
    (0,__vite_ssr_import_10__.markOwnerInvalidatedFrom)(parent);
  };
  for (const branch of branches) (0,__vite_ssr_import_12__.publishMembershipChange)(branch);
  if (changedSlots.length > 0) {
    runtime.publishPrepared({ revision: runtime.revision(), changedSlots });
  };
  if (unaddressedLeaves.length > 0) {
    ((0,__vite_ssr_import_7__.getLocationRuntime)(parent) ?? __vite_ssr_import_7__.NEUTRAL_LOCATION_RUNTIME).publish(
      unaddressedLeaves
    );
  }
};
function deactivateOne(parent, key) {
  const descriptor = Object.getOwnPropertyDescriptor(parent, key);
  if (!descriptor || descriptor.enumerable === false) {
    return false;
  };
  if (!descriptor.configurable) {
    return false;
  };
  Object.defineProperty(parent, key, { ...descriptor, enumerable: false });
  membershipEpoch++;
  markHasDormant(parent);
  const runtime = (0,__vite_ssr_import_13__.getTreeScalarSlotRuntime)(parent);
  if (runtime) {
    omittedMembers.set(runtime, (omittedMembers.get(runtime) ?? 0) + 1);
    runtime.enableAbsence?.(ABSENCE);
  };
  const child = parent[key];
  if ((0,__vite_ssr_import_8__.isTraversableNode)(child)) {
    linkMember(parent, key, child);
    linkDescendants(child);
  };
  return true;
}
function linkMember(parent, key, child) {
  membershipEpoch++;
  Object.defineProperty(child, DORMANT, {
    value: {
      parent: nodeOf(parent),
      key,
      epoch: 0,
      absent: false
    },
    enumerable: false,
    configurable: true,
    writable: true
  });
}
function linkDescendants(node) {
  if (!(0,__vite_ssr_import_8__.isNodeAccessor)(node)) return;
  for (const key of Object.getOwnPropertyNames(node)) {
    const child = Object.getOwnPropertyDescriptor(node, key)?.value;
    if (!(0,__vite_ssr_import_8__.isNodeAccessor)(child) && !(0,__vite_ssr_import_7__.isWritableLocation)(child) && !membershipHook(child) || memberBinding(child))
      continue;
    linkMember(node, key, child);
    linkDescendants(child);
  }
}
function linkAddedMember(branch, key, child) {
  if (!(0,__vite_ssr_import_8__.isTraversableNode)(child) || !memberBinding(nodeOf(branch))) return;
  linkMember(branch, key, child);
  linkDescendants(child);
};
function activateOne(parent, key) {
  const descriptor = Object.getOwnPropertyDescriptor(parent, key);
  if (!descriptor || descriptor.enumerable === true) {
    return false;
  };
  if (!descriptor.configurable) {
    return false;
  };
  Object.defineProperty(parent, key, { ...descriptor, enumerable: true });
  membershipEpoch++;
  const runtime = (0,__vite_ssr_import_13__.getTreeScalarSlotRuntime)(parent);
  const omitted = runtime ? omittedMembers.get(runtime) : void 0;
  if (runtime && omitted !== void 0) {
    omittedMembers.set(runtime, omitted - 1);
    if (omitted === 1 && !ordinaryDivergences.get(runtime))
      runtime.disableAbsence?.();
  };
  return true;
}
const HAS_DORMANT = Symbol.for("SignalTree:HasDormantMembers");
function hasDormantMembers(parent) {
  return parent[HAS_DORMANT] === true;
};
function markHasDormant(parent) {
  if (hasDormantMembers(parent)) return;
  Object.defineProperty(parent, HAS_DORMANT, {
    value: true,
    enumerable: false,
    configurable: true,
    writable: true
  });
}
function dormantKeys(parent) {
  return Object.getOwnPropertyNames(parent).filter((key) => {
    const d = Object.getOwnPropertyDescriptor(parent, key);
    return d !== void 0 && d.enumerable === false && "value" in d;
  });
};
function peerOf(branch) {
  const record = branch;
  const peer = record[__vite_ssr_import_8__.NODE_STORE_SYMBOL] ?? record[NODE_ACCESSOR_PEER];
  return (0,__vite_ssr_import_8__.isTraversableNode)(peer) && peer !== branch ? peer : void 0;
}
function setMemberPresence(branch, key, presence) {
  const apply = presence === "active" ? activateOne : deactivateOne;
  const parent = nodeOf(branch), descriptor = Object.getOwnPropertyDescriptor(parent, key), peer = peerOf(branch);
  const child = descriptor?.value;
  if (!descriptor || !descriptor.configurable || !(0,__vite_ssr_import_8__.isTraversableNode)(child)) {
    let changed = apply(branch, key);
    if (peer) changed = apply(peer, key) || changed;
    return changed;
  };
  const physicalBefore = descriptor.enumerable === true, present = presence === "active";
  const previous = ordinaryPresenceSources.get(parent), source = previous ?? new OrdinaryMemberPresenceSource();
  const edit = source.prepare(
    key,
    child,
    physicalBefore,
    present,
    (0,__vite_ssr_import_0__.getActiveWriteContext)()?.participation === "inspection"
  );
  const epoch = membershipEpoch;
  const responsibility = edit.before !== edit.after ? (0,__vite_ssr_import_2__.getMutationCaptureRuntime)(parent)?.prepareMemberResponsibility?.(
    parent,
    key,
    child,
    { before: edit.before, after: edit.after }
  ) : void 0;
  const prepare = __vite_ssr_import_3__.membershipPublicationPreparer;
  const registry = prepare ? (0,__vite_ssr_import_4__.getPositionRegistry)(parent) : void 0;
  const address = registry ? (0,__vite_ssr_import_4__.getNodeAddress)(parent) : void 0;
  const ordinary = prepare && registry && address && (edit.before !== edit.after || !physicalBefore && present && (0,__vite_ssr_import_0__.getActiveWriteContext)()?.participation !== "inspection") ? Object.freeze({
    before: edit.before ? Object.freeze({ present: true, value: (0,__vite_ssr_import_1__.ordinaryMemberSnapshot)(child) }) : Object.freeze({ present: false }),
    after: edit.after ? Object.freeze({ present: true, value: (0,__vite_ssr_import_1__.ordinaryMemberSnapshot)(child) }) : Object.freeze({ present: false })
  }) : void 0;
  const unit = prepare && registry && address ? prepare({ registry, branch: parent, address, key, child, present, ordinary }) : void 0;
  if (membershipEpoch !== epoch || ordinaryPresenceSources.get(parent) !== previous || Object.getOwnPropertyDescriptor(parent, key)?.value !== child)
    throw new Error("Membership preparation reentered installation");
  source.validate(edit);
  const records = (0,__vite_ssr_import_3__.combineTerminalRecords)(responsibility, unit?.record);
  let failed = false;
  try {
    const delta = source.install(edit);
    if (!previous && (edit.before !== edit.after || physicalBefore !== present))
      ordinaryPresenceSources.set(parent, source);
    const runtime = (0,__vite_ssr_import_13__.getTreeScalarSlotRuntime)(parent);
    if (runtime && delta)
      ordinaryDivergences.set(
        runtime,
        (ordinaryDivergences.get(runtime) ?? 0) + delta
      );
    let changed = apply(branch, key);
    if (peer) changed = apply(peer, key) || changed;
    if (records) (0,__vite_ssr_import_3__.installTerminalRecord)(records);
    if (runtime) {
      if (ordinaryDivergences.get(runtime)) runtime.enableAbsence?.(ABSENCE);
      else if (!omittedMembers.get(runtime)) runtime.disableAbsence?.();
    };
    if (changed) {
      (0,__vite_ssr_import_12__.markSnapshotInstalled)(parent);
      const visited = /* @__PURE__ */ new Set();
      const mark = (node, effectiveChanged) => {
        if (!(0,__vite_ssr_import_8__.isTraversableNode)(node) || visited.has(node)) return;
        visited.add(node);
        if (membershipHook(node)) {
          if (effectiveChanged) (0,__vite_ssr_import_12__.markSnapshotInstalled)(node);
          return;
        };
        if (!(0,__vite_ssr_import_8__.isNodeAccessor)(node)) return;
        (0,__vite_ssr_import_12__.markSnapshotInstalled)(node);
        for (const key2 of Reflect.ownKeys(node)) {
          if (key2 === "caller" || key2 === "arguments" || key2 === __vite_ssr_import_8__.NODE_STORE_SYMBOL || key2 === NODE_ACCESSOR_PEER) continue;
          const descriptor2 = Object.getOwnPropertyDescriptor(node, key2);
          if (descriptor2 && "value" in descriptor2)
            mark(
              descriptor2.value,
              effectiveChanged && descriptor2.enumerable === true
            );
        }
      };
      mark(child, !isAbsentMember(parent));
    };
    return changed;
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    if (unit)
      try {
        (0,__vite_ssr_import_3__.completePreparedPublication)(unit.completion);
      } catch (error) {
        if (!failed) throw error;
        (0,__vite_ssr_import_5__.reportContainedObserverError)({ error, operation: "notify:subscriber" });
      }
  }
};
function prepareFreshMemberPresence(branch, key, child) {
  const parent = nodeOf(branch), previous = ordinaryPresenceSources.get(parent);
  const descriptor = Object.getOwnPropertyDescriptor(parent, key);
  const source = previous ?? new OrdinaryMemberPresenceSource();
  const edit = source.prepare(key, child, false, true, (0,__vite_ssr_import_0__.getActiveWriteContext)()?.participation === "inspection");
  return { present: edit.after, validate: () => {
    if (ordinaryPresenceSources.get(parent) !== previous || Object.getOwnPropertyDescriptor(parent, key)?.value !== descriptor?.value) throw new Error("Fresh membership preparation reentered installation");
    source.validate(edit);
  }, install: () => {
    const delta = source.install(edit);
    ordinaryPresenceSources.set(parent, source);
    if (!edit.after) {
      markHasDormant(parent);
      const peer = peerOf(parent);
      if (peer) markHasDormant(peer);
      linkMember(parent, key, child);
      linkDescendants(child);
    };
    const runtime = (0,__vite_ssr_import_13__.getTreeScalarSlotRuntime)(parent);
    if (runtime && delta) {
      ordinaryDivergences.set(runtime, (ordinaryDivergences.get(runtime) ?? 0) + delta);
      runtime.enableAbsence?.(ABSENCE);
    }
  } };
}
//# sourceMappingSource=vite-generated
//# sourceMappingURL=data:application/json;base64,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LFdBQU8sU0FBUyxJQUFJO0FBQUEsRUFDckIsR0FBRSxTQUFRLE1BQUk7QUFDYixVQUFNLFFBQU0sT0FBTyxRQUFRLElBQUk7QUFBRSw0QkFBd0IsSUFBSSxRQUFPLE1BQU07QUFDMUUsUUFBRyxDQUFDLEtBQUssT0FBTTtBQUFDLHFCQUFlLE1BQU07QUFBRSxZQUFNLE9BQUssT0FBTyxNQUFNO0FBQUUsVUFBRyxLQUFLLGdCQUFlLElBQUk7QUFBRSxpQkFBVyxRQUFPLEtBQUksS0FBSztBQUFFLHNCQUFnQixLQUFLO0FBQUEsSUFBRTtBQUNsSixVQUFNLGFBQVEsaURBQXlCLE1BQU07QUFDN0MsUUFBRyxXQUFTLE9BQU07QUFBQywwQkFBb0IsSUFBSSxVQUFTLG9CQUFvQixJQUFJLE9BQU8sS0FBRyxLQUFHLEtBQUs7QUFBRSxjQUFRLGdCQUFnQixPQUFPO0FBQUEsSUFBRTtBQUFBLEVBQ2xJLEVBQUM7QUFDRiIsIm5hbWVzIjpbImtleSIsImRlc2NyaXB0b3IiXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZXMiOlsibWVtYmVyLW1lbWJlcnNoaXAudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZ2V0QWN0aXZlV3JpdGVDb250ZXh0IH0gZnJvbSAnLi4vd3JpdGUtY29udGV4dCc7XG5pbXBvcnQgeyBvcmRpbmFyeU1lbWJlclNuYXBzaG90IH0gZnJvbSAnLi9wbGFpbi1icmFuY2gtbWVtYmVyc2hpcCc7XG5pbXBvcnQgeyBnZXRNdXRhdGlvbkNhcHR1cmVSdW50aW1lIH0gZnJvbSAnLi9tdXRhdGlvbi1jYXB0dXJlLXJ1bnRpbWUnO1xuaW1wb3J0IHtcbiAgbWVtYmVyc2hpcFB1YmxpY2F0aW9uUHJlcGFyZXIsXG4gIGNvbWJpbmVUZXJtaW5hbFJlY29yZHMsXG4gIGluc3RhbGxUZXJtaW5hbFJlY29yZCxcbiAgY29tcGxldGVQcmVwYXJlZFB1YmxpY2F0aW9uLFxufSBmcm9tICcuL2ludHJpbnNpYy1tdXRhdGlvbic7XG5pbXBvcnQgeyBnZXROb2RlQWRkcmVzcywgZ2V0UG9zaXRpb25SZWdpc3RyeSB9IGZyb20gJy4vcG9zaXRpb24tcmVnaXN0cnknO1xuaW1wb3J0IHsgcmVwb3J0Q29udGFpbmVkT2JzZXJ2ZXJFcnJvciB9IGZyb20gJy4vZXJyb3ItcmVwb3J0ZXInO1xuaW1wb3J0IHtcbiAgUFJPRFVDVElPTl9TVUJTVFJBVEVfU1RBVFNfRU5BQkxFRCxcbiAgcmVjb3JkUHJvZHVjdGlvblN1YnN0cmF0ZVN0YXQsXG59IGZyb20gJy4vcHJvZHVjdGlvbi1zdWJzdHJhdGUtc3RhdHMnO1xuaW1wb3J0IHtcbiAgZ2V0TG9jYXRpb25SdW50aW1lLFxuICBpc1dyaXRhYmxlTG9jYXRpb24sXG4gIE5FVVRSQUxfTE9DQVRJT05fUlVOVElNRSxcbiAgd3JpdGFibGVMb2NhdGlvblB1Ymxpc2hlcixcbiAgdHlwZSBMb2NhdGlvblB1Ymxpc2hlcixcbn0gZnJvbSAnLi9sb2NhdGlvbi1ydW50aW1lJztcbmltcG9ydCB7XG4gIGlzTm9kZUFjY2Vzc29yLFxuICBpc1RyYXZlcnNhYmxlTm9kZSxcbiAgTk9ERV9TVE9SRV9TWU1CT0wsXG59IGZyb20gJy4vbm9kZS1zaGFwZSc7XG5pbXBvcnQgeyBnZXRPd25lZFBvc2l0aW9uSWRzIH0gZnJvbSAnLi9vd25lZC1tZXRhZGF0YSc7XG5pbXBvcnQgeyBtYXJrT3duZXJJbnZhbGlkYXRlZEZyb20gfSBmcm9tICcuL293bmVyLWludmFsaWRhdGlvbi1wb3J0JztcbmltcG9ydCB7IGNhcHR1cmVQYXRoUmVBZGRJZk9ic2VydmVkIH0gZnJvbSAnLi9wYXRoLW9ic2VydmF0aW9uLXBvcnQnO1xuaW1wb3J0IHsgbWFya1NuYXBzaG90SW5zdGFsbGVkLCBwdWJsaXNoTWVtYmVyc2hpcENoYW5nZSB9IGZyb20gJy4vc25hcHNob3QtYXV0aG9yaXR5JztcbmltcG9ydCB7XG4gIGdldFRyZWVTY2FsYXJTbG90UnVudGltZSxcbiAgdHlwZSBNZW1iZXJBYnNlbmNlLFxufSBmcm9tICcuL3RyZWUtc2NhbGFyLXNsb3QtcG9ydCc7XG5cbi8qKlxuICogQlJBTkNIIE1FTUJFUiBNRU1CRVJTSElQIOKAlCDCp0MgLyBDNSwgR1JFRU5GSUVMRC1CUkFOQ0gtV1JJVEUtMC5cbiAqXG4gKiBBIHdob2xlLXZhbHVlIGFzc2lnbm1lbnQgc3RhdGVzIHRoZSBjb21wbGV0ZSBuZXh0IHZhbHVlIG9mIGEgbG9jYXRpb24sIHNvIGFcbiAqIGtleSB0aGUgdmFsdWUgb21pdHMgaXMgTk9UIEEgTUVNQkVSIG9mIGl0OlxuICpcbiAqICAgICBPTUlTU0lPTiBJTiBBIFdIT0xFIFZBTFVFIENIQU5HRVMgTUVNQkVSU0hJUC5cbiAqICAgICBPTUlTU0lPTiBJTiBBIFBST0pFQ1RJT04gREVGSU5FUyBTQ09QRS5cbiAqXG4gKiAoVGhlIHNlY29uZCBoYWxmIGlzIEM0J3MgYGFjcXVpcmVTY2FsYXJQcm9qZWN0aW9uYCwgd2hpY2ggc2F5cyBub3RoaW5nIGFib3V0XG4gKiB0aGUga2V5cyBpdCBvbWl0cyBhbmQgbXVzdCBuZXZlciByb3V0ZSB0aHJvdWdoIGhlcmUuKVxuICpcbiAqICMjIEF1dGhvcml0eVxuICpcbiAqIFBIWVNJQ0FMIE1FTUJFUlNISVAgSVMgT1dORUQgQlkgRU5VTUVSQUJJTElUWS4gYHVud3JhcGAgYWxyZWFkeVxuICogY29tcHV0ZXMgYSBicmFuY2gncyB2YWx1ZSBieSBlbnVtZXJhdGluZyBpdHMgc3RvcmUgKGBmb3IgKGNvbnN0IGtleSBpbiBub2RlKWApLFxuICogc28gZW51bWVyYWJpbGl0eSB3YXMgQUxSRUFEWSB0aGUgZGUtZmFjdG8gYXV0aG9yaXR5IOKAlCB0aGlzIG1vZHVsZSBtYWtlcyBpdFxuICogdGhlIGRlbGliZXJhdGUgcGh5c2ljYWwgYW5zd2VyLiBJbnNwZWN0aW9uIG1heSBkaXNwbGF5IGEgZGlmZmVyZW50IHRvcG9sb2d5XG4gKiBmcm9tIG9yZGluYXJ5IHRydXRoOyB0aGUgc3BhcnNlIHNvdXJjZSBiZWxvdyByZXRhaW5zIG9ubHkgdGhvc2Ugb3JkaW5hcnlcbiAqIGV4Y2VwdGlvbnMsIGtleWVkIGJ5IHRoZSByZXRhaW5lZCBjaGlsZCBpZGVudGl0eS5cbiAqXG4gKiAgICAgZW51bWVyYWJsZSAgICAgIOKGkiBhIGN1cnJlbnQgbWVtYmVyXG4gKiAgICAgbm9uLWVudW1lcmFibGUgIOKGkiBkb3JtYW50OyBhYnNlbnQgZnJvbSB0aGUgdmFsdWVcbiAqXG4gKiAjIyBQaHlzaWNhbCByZXRlbnRpb24gdnMuIG9ic2VydmFibGUgdHJ1dGhcbiAqXG4gKiAgICAgUEhZU0lDQUwgUkVURU5USU9OIE1VU1QgTk9UIENSRUFURSBBIFNFQ09ORCBPQlNFUlZBQkxFIFNUQVRFLlxuICpcbiAqICAgICBBIERFU0NFTkRBTlQgQUJTRU5UIEZST00gSVRTIFBBUkVOVCdTIENVUlJFTlQgVkFMVUUgSVMgU0VNQU5USUNBTExZXG4gKiAgICAgQUJTRU5UIEVWRU4gSUYgSVRTIFBIWVNJQ0FMIExPQ0FUSU9OIElTIFJFVEFJTkVELlxuICpcbiAqIFRoZSBzbG90LCBpdHMgaWRlbnRpdHkgYW5kIGl0cyByZXRhaW5lZCB2YWx1ZSBhbGwgc3Vydml2ZSBkZWFjdGl2YXRpb24g4oCUIHRoYXRcbiAqIGlzIGRlbGliZXJhdGUsIGFuZCBpdCBpcyB3aHkgbm90aGluZyBoZXJlIHdyaXRlcyBgdW5kZWZpbmVkYC4gQnV0IHRoZSByZXRhaW5lZFxuICogdmFsdWUgTVVTVCBOT1QgcmVtYWluIHJlYWRhYmxlLCBvciBgJC51c2VyKClgIGFuZCBgJC51c2VyLmFnZSgpYCB3b3VsZCBnaXZlIHR3b1xuICogZGlmZmVyZW50IGFuc3dlcnMgdG8gXCJ3aGF0IGlzIHRoZSB2YWx1ZSBhdCB1c2VyLmFnZVwiLCBhbmQgdGhlIHN0YWxlIHBoeXNpY2FsXG4gKiByZXByZXNlbnRhdGlvbiB3b3VsZCBoYXZlIGxlYWtlZCB0aHJvdWdoIHRoZSBjYW5vbmljYWwgc3RhdGUgQVBJLlxuICpcbiAqICMjIFdoeSBhIHN0YW1wIG9uIHRoZSBsZWFmIHJhdGhlciB0aGFuIGEgYmFjay1yZWZlcmVuY2UgdG8gdGhlIHBhcmVudFxuICpcbiAqIEEgbGVhZiBpcyBidWlsdCBib3R0b20tdXAsIGJlZm9yZSBpdHMgcGFyZW50IHN0b3JlIGV4aXN0cywgc28gaXQgY2Fubm90IGtub3dcbiAqIGl0cyBvd24gKHBhcmVudCwga2V5KSBhdCBjb25zdHJ1Y3Rpb24gd2l0aG91dCBwYXlpbmcgZm9yIGEgYmluZGluZyBvbiBFVkVSWVxuICogbGVhZi4gVGhlIHN0YW1wIGJlbG93IGlzIGFwcGxpZWQgb25seSB3aGVuIGEgbGVhZiBBQ1RVQUxMWSBnb2VzIGRvcm1hbnQsIHdoaWNoXG4gKiBpcyByYXJlIOKAlCBTUEVDSUFMSVpFIFRIRSBSQVJFIENBU0UgQkVGT1JFIFRBWElORyBUSEUgQ09NTU9OIENBU0UuIEEgbGVhZiB0aGF0XG4gKiBpcyBuZXZlciBvbWl0dGVkIGNhcnJpZXMgbm8gZXh0cmEgcHJvcGVydHkgYXQgYWxsLlxuICpcbiAqIOKaoO+4jyBTSU5HTEUgV1JJVEVSLiBUaGUgc3RhbXAgaXMgbm90IGEgc2Vjb25kIGF1dGhvcml0eTogdGhlIGRlc2NyaXB0b3IgYW5kIHRoZVxuICogc3RhbXAgYXJlIHdyaXR0ZW4gYnkgdGhlIHR3byBmdW5jdGlvbnMgYmVsb3cgYW5kIG5vd2hlcmUgZWxzZSwgc28gdGhleSBjYW5ub3RcbiAqIGRpc2FncmVlLiBEbyBOT1QgZmxpcCBgZW51bWVyYWJsZWAgb24gYSB0cmVlIHN0b3JlIGRpcmVjdGx5LlxuICovXG5cbi8qKlxuICogTW9kdWxlLXByaXZhdGUuIEFic2VudCBvbiBldmVyeSBsZWFmIHRoYXQgaGFzIG5ldmVyIGJlZW4gZGVhY3RpdmF0ZWQuXG4gKlxuICogQ2FycmllcyB0aGUgKHBhcmVudCwga2V5KSBiaW5kaW5nIGFzIHdlbGwgYXMgdGhlIGZsYWcsIGJlY2F1c2UgYSBsZWFmIHRoYXRcbiAqIGdvZXMgZG9ybWFudCBtdXN0IGJlIGFibGUgdG8gUkVBQ1RJVkFURSBJVFNFTEYgd2hlbiB3cml0dGVuIGRpcmVjdGx5IOKAlFxuICogV1JJVElORyBBTiBBQlNFTlQgREVTQ0VOREFOVCBSRUFDVElWQVRFUyBJVFMgTUVNQkVSU0hJUC4gU3RvcmluZyB0aGUgYmluZGluZ1xuICogZWFnZXJseSBvbiBldmVyeSBsZWFmIHdvdWxkIHRheCB0aGUgY29tbW9uIGNhc2UgZm9yIGEgcmFyZSBvbmU7IHN0b3JpbmcgaXQgYXRcbiAqIHRoZSBtb21lbnQgb2YgZGVhY3RpdmF0aW9uIGNvc3RzIG5vdGhpbmcgdW50aWwgYSBtZW1iZXIgaXMgYWN0dWFsbHkgb21pdHRlZC5cbiAqL1xuLy8g4pqg77iPIFRIRSBgU2lnbmFsVHJlZTpgIFBSRUZJWCBJUyBMT0FELUJFQVJJTkcuIGB1bndyYXBgJ3Mgc3ltYm9sIGxvb3Agc2tpcHNcbi8vIHRoYXQgcHJlZml4IGJ5IGlkZW50aXR5LCBzbyB0aGUgc3RhbXAgY2FuIG5ldmVyIGxlYWsgaW50byBhIHNuYXBzaG90IOKAlCB0aGVcbi8vIHNhbWUgcmVhc29uIERFUklWRURfU1RBTVAgYW5kIFBST0NFU1NPUl9TVEFNUCBjYXJyeSBpdC4gTWVhc3VyZWQgd2l0aCBhIHBsYWluXG4vLyBgU3ltYm9sKCdzaWduYWx0cmVlLuKApicpYDogdGhlIG1hcmtlciBhcHBlYXJlZCB2ZXJiYXRpbSBpbiBgdHJlZS4kLnVzZXIoKWAuXG5jb25zdCBET1JNQU5UID0gU3ltYm9sLmZvcignU2lnbmFsVHJlZTpEb3JtYW50TWVtYmVyJyk7XG5cbnR5cGUgRG9ybWFudEJpbmRpbmcgPSB7XG4gIHBhcmVudDogb2JqZWN0O1xuICBrZXk6IHN0cmluZztcbiAgLyoqXG4gICAqIGBpc0Fic2VudE1lbWJlcmAncyBsYXN0IGFuc3dlciBmb3IgdGhlIG5vZGUgdGhpcyBsaW5rIGlzIHN0YW1wZWQgb24sIGFuZFxuICAgKiB0aGUgYG1lbWJlcnNoaXBFcG9jaGAgaXQgd2FzIGNvbXB1dGVkIGF0LiBOb3QgbWVtYmVyc2hpcDogZW51bWVyYWJpbGl0eVxuICAgKiBhbnN3ZXJzIHRoYXQsIGFuZCBhbnkgY2hhbmdlIHRvIGl0IGFkdmFuY2VzIHRoZSBlcG9jaCAodjE2IDhnKS5cbiAgICovXG4gIGVwb2NoOiBudW1iZXI7XG4gIGFic2VudDogYm9vbGVhbjtcbn07XG5cbmRlY2xhcmUgY29uc3QgbmdEZXZNb2RlOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuXG4vKipcbiAqIOKaoO+4jyBBRFZBTkNFRCBCWSBFVkVSWSBDSEFOR0UgVEhBVCBDQU4gQ0hBTkdFIEFOIEFCU0VOQ0UgQU5TV0VSOiBlYWNoXG4gKiBlbnVtZXJhYmlsaXR5IGZsaXAgKGBhY3RpdmF0ZU9uZWAsIGBkZWFjdGl2YXRlT25lYCwgdGhlIG9ubHkgdHdvIHdyaXRlcnMgb2ZcbiAqIGEgbWVtYmVyJ3MgZW51bWVyYWJpbGl0eSkgYW5kIGVhY2ggbmV3IGxpbmsgKGBsaW5rTWVtYmVyYCkuIEEgY2FjaGVkIGFuc3dlclxuICogZnJvbSBhbiBvbGRlciBlcG9jaCBpcyByZWNvbXB1dGVkIGZyb20gdGhlIGRlc2NyaXB0b3JzLCBzbyB0aGUgY2FjaGUgY2FuIGJlXG4gKiBzdGFsZSBmb3Igb25lIHJlYWQgYXQgbW9zdCwgbmV2ZXIgd3JvbmcuXG4gKi9cbmxldCBtZW1iZXJzaGlwRXBvY2ggPSAxO1xuXG4vKipcbiAqIOKaoO+4jyBIT1cgTUFOWSBNRU1CRVJTIEVBQ0ggVFJFRSBIQVMgT01JVFRFRCwgcGVyIHBoeXNpY2FsIGhhbGY6IHRoZSBleGFjdFxuICogY291bnQgb2YgZW51bWVyYWJpbGl0eSBmbGlwcyAoYGRlYWN0aXZhdGVPbmVgICsxLCBgYWN0aXZhdGVPbmVgIC0xKSBvblxuICogaGFsdmVzIHRoYXQgcmVhY2ggdGhlIHRyZWUncyBydW50aW1lLiBBdCAwIG5vdGhpbmcgaW4gdGhlIHRyZWUgaXMgYWJzZW50XG4gKiBhbmQgbm90aGluZyBjYW4gbmVlZCByZS1hZGRpbmcsIHNvIGl0cyBsZWF2ZXMnIGxpdmVuZXNzIGlzIHJlbW92ZWQgYWdhaW5cbiAqIGFuZCB0aGVpciByZWFkcyBhbmQgd3JpdGVzIHBheSBub25lIG9mIGl0OiBhZnRlciBhbiBvbWl0IGFuZCBhIHJlLWFkZCB0aGV5XG4gKiBzdGlsbCBjb3N0IDIuNnggKHBlcmYtMTUuNC40LCBmeDQncyBvcHRpb25hbCBwYXJ0OyB2MTYgOGcpLlxuICovXG5jb25zdCBvbWl0dGVkTWVtYmVycyA9IG5ldyBXZWFrTWFwPG9iamVjdCwgbnVtYmVyPigpO1xuXG50eXBlIE9yZGluYXJ5UHJlc2VuY2VFbnRyeSA9IFJlYWRvbmx5PHsgY2hpbGQ6IG9iamVjdDsgcHJlc2VudDogYm9vbGVhbiB9Pjtcbi8qKiBDdXJyZW50IG9yZGluYXJ5IGV4Y2VwdGlvbnMgb25seTsgZGVzY3JpcHRvciBwYWlycyByZW1haW4gcGh5c2ljYWwgdHJ1dGguICovXG5leHBvcnQgY2xhc3MgT3JkaW5hcnlNZW1iZXJQcmVzZW5jZVNvdXJjZSB7XG4gIHByaXZhdGUgcmV2aXNpb24gPSAwO1xuICBwcml2YXRlIHJlYWRvbmx5IGRpdmVyZ2VudCA9IG5ldyBNYXA8c3RyaW5nLCBPcmRpbmFyeVByZXNlbmNlRW50cnk+KCk7XG4gIHJlYWQoa2V5OiBzdHJpbmcsIGNoaWxkOiBvYmplY3QsIHBoeXNpY2FsOiBib29sZWFuKTogYm9vbGVhbiB7XG4gICAgY29uc3QgZW50cnkgPSB0aGlzLmRpdmVyZ2VudC5nZXQoa2V5KTtcbiAgICBpZiAoZW50cnkgJiYgZW50cnkuY2hpbGQgIT09IGNoaWxkKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdPcmRpbmFyeSBtZW1iZXIgcHJlc2VuY2UgaWRlbnRpdHkgY2hhbmdlZCcpO1xuICAgIHJldHVybiBlbnRyeT8ucHJlc2VudCA/PyBwaHlzaWNhbDtcbiAgfVxuICBwcmVwYXJlKFxuICAgIGtleTogc3RyaW5nLFxuICAgIGNoaWxkOiBvYmplY3QsXG4gICAgcGh5c2ljYWxCZWZvcmU6IGJvb2xlYW4sXG4gICAgcGh5c2ljYWxBZnRlcjogYm9vbGVhbixcbiAgICBpbnNwZWN0aW9uOiBib29sZWFuXG4gICkge1xuICAgIGNvbnN0IGJlZm9yZSA9IHRoaXMucmVhZChrZXksIGNoaWxkLCBwaHlzaWNhbEJlZm9yZSk7XG4gICAgY29uc3QgYWZ0ZXIgPSBpbnNwZWN0aW9uID8gYmVmb3JlIDogcGh5c2ljYWxBZnRlcjtcbiAgICByZXR1cm4gT2JqZWN0LmZyZWV6ZSh7XG4gICAgICByZXZpc2lvbjogdGhpcy5yZXZpc2lvbixcbiAgICAgIGtleSxcbiAgICAgIGNoaWxkLFxuICAgICAgYmVmb3JlLFxuICAgICAgYWZ0ZXIsXG4gICAgICBwaHlzaWNhbEJlZm9yZSxcbiAgICAgIHBoeXNpY2FsQWZ0ZXIsXG4gICAgICByZXRhaW5lZDogdGhpcy5kaXZlcmdlbnQuaGFzKGtleSksXG4gICAgICBuZXh0OlxuICAgICAgICBhZnRlciA9PT0gcGh5c2ljYWxBZnRlclxuICAgICAgICAgID8gdW5kZWZpbmVkXG4gICAgICAgICAgOiBPYmplY3QuZnJlZXplKHsgY2hpbGQsIHByZXNlbnQ6IGFmdGVyIH0pLFxuICAgIH0pO1xuICB9XG4gIHZhbGlkYXRlKGVkaXQ6IFJldHVyblR5cGU8T3JkaW5hcnlNZW1iZXJQcmVzZW5jZVNvdXJjZVsncHJlcGFyZSddPik6IHZvaWQge1xuICAgIGlmICh0aGlzLnJldmlzaW9uICE9PSBlZGl0LnJldmlzaW9uKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdPcmRpbmFyeSBtZW1iZXJzaGlwIHByZXBhcmF0aW9uIHJlZW50ZXJlZCBpbnN0YWxsYXRpb24nKTtcbiAgfVxuICBpbnN0YWxsKGVkaXQ6IFJldHVyblR5cGU8T3JkaW5hcnlNZW1iZXJQcmVzZW5jZVNvdXJjZVsncHJlcGFyZSddPik6IG51bWJlciB7XG4gICAgaWYgKGVkaXQubmV4dCkgdGhpcy5kaXZlcmdlbnQuc2V0KGVkaXQua2V5LCBlZGl0Lm5leHQpO1xuICAgIGVsc2UgdGhpcy5kaXZlcmdlbnQuZGVsZXRlKGVkaXQua2V5KTtcbiAgICBpZiAoXG4gICAgICBlZGl0LnBoeXNpY2FsQmVmb3JlICE9PSBlZGl0LnBoeXNpY2FsQWZ0ZXIgfHxcbiAgICAgIGVkaXQuYmVmb3JlICE9PSBlZGl0LmFmdGVyXG4gICAgKVxuICAgICAgdGhpcy5yZXZpc2lvbisrO1xuICAgIHJldHVybiBOdW1iZXIoZWRpdC5uZXh0ICE9PSB1bmRlZmluZWQpIC0gTnVtYmVyKGVkaXQucmV0YWluZWQpO1xuICB9XG59XG5jb25zdCBvcmRpbmFyeVByZXNlbmNlU291cmNlcyA9IG5ldyBXZWFrTWFwPFxuICBvYmplY3QsXG4gIE9yZGluYXJ5TWVtYmVyUHJlc2VuY2VTb3VyY2Vcbj4oKTtcbmNvbnN0IG9yZGluYXJ5RGl2ZXJnZW5jZXMgPSBuZXcgV2Vha01hcDxvYmplY3QsIG51bWJlcj4oKTtcbi8qKiBPcmRpbmFyeSBsb2NhbCBlZGdlLCBzZXBhcmF0ZSBmcm9tIHBoeXNpY2FsIGVmZmVjdGl2ZSBhYnNlbmNlLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlYWRPcmRpbmFyeU1lbWJlclByZXNlbmNlKFxuICBicmFuY2g6IG9iamVjdCxcbiAga2V5OiBzdHJpbmdcbik6IGJvb2xlYW4ge1xuICBjb25zdCBwYXJlbnQgPSBub2RlT2YoYnJhbmNoKTtcbiAgY29uc3QgZGVzY3JpcHRvciA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IocGFyZW50LCBrZXkpO1xuICBpZiAoIWRlc2NyaXB0b3IgfHwgIWlzVHJhdmVyc2FibGVOb2RlKGRlc2NyaXB0b3IudmFsdWUpKVxuICAgIHJldHVybiBkZXNjcmlwdG9yPy5lbnVtZXJhYmxlID09PSB0cnVlO1xuICByZXR1cm4gKFxuICAgIG9yZGluYXJ5UHJlc2VuY2VTb3VyY2VzXG4gICAgICAuZ2V0KHBhcmVudClcbiAgICAgID8ucmVhZChrZXksIGRlc2NyaXB0b3IudmFsdWUsIGRlc2NyaXB0b3IuZW51bWVyYWJsZSA9PT0gdHJ1ZSkgPz9cbiAgICBkZXNjcmlwdG9yLmVudW1lcmFibGUgPT09IHRydWVcbiAgKTtcbn1cbmZ1bmN0aW9uIG93bk9yZGluYXJ5QWJzZW5jZShub2RlOiB1bmtub3duKTogYm9vbGVhbiB7XG4gIGZvcihsZXQgYmluZGluZz1tZW1iZXJCaW5kaW5nKG5vZGUpO2JpbmRpbmc7YmluZGluZz1tZW1iZXJCaW5kaW5nKGJpbmRpbmcucGFyZW50KSlcbiAgICBpZighcmVhZE9yZGluYXJ5TWVtYmVyUHJlc2VuY2UoYmluZGluZy5wYXJlbnQsYmluZGluZy5rZXkpKXJldHVybiB0cnVlO1xuICByZXR1cm4gZmFsc2U7XG59XG5cbi8qKiBEZXYtbW9kZSBjcm9zcy1jaGVjayBvZiBjYWNoZWQgYW5zd2Vycywgb25lIHJlYWQgaW4gdGhpcyBtYW55ICg4ZykuICovXG5jb25zdCBBQlNFTkNFX0NIRUNLX0VWRVJZID0gNjQ7XG5sZXQgYWJzZW5jZUNoZWNrcyA9IDA7XG5cbi8qKlxuICogQGludGVybmFsIEFuIGVudGl0eSBjb2xsZWN0aW9uJ3MgaG9vayBmb3IgYSBjaGFuZ2UgaW4gaXRzIHByZXNlbmNlOiBpdCwgb3JcbiAqIGEgbWVtYmVyIGFib3ZlIGl0LCB3YXMgb21pdHRlZCBvciByZS1hZGRlZCAodjE2IDhlKS4gSXRzIHJvd3MgYXJlIGl0cyBvd25cbiAqIHN0YXRlIGFuZCBpdCByZWFkcyBhYnNlbnQgd2hpbGUgaGlkZGVuLCBzbyBpdCBtdXN0IHJlLXJlYWQuIFRoZSBob29rIGlzXG4gKiBhbHNvIHdoYXQgbWFya3MgYSBjb2xsZWN0aW9uIGFzIGEgbWVtYmVyIHRvIGxpbmsgYW5kIHdha2UgaGVyZSwgd2l0aG91dFxuICogdGhpcyBtb2R1bGUga25vd2luZyBhbnl0aGluZyBhYm91dCBjb2xsZWN0aW9ucy5cbiAqL1xuZXhwb3J0IGNvbnN0IE1FTUJFUlNISVBfQ0hBTkdFRCA9IFN5bWJvbC5mb3IoJ1NpZ25hbFRyZWU6TWVtYmVyc2hpcENoYW5nZWQnKTtcblxuZnVuY3Rpb24gbWVtYmVyc2hpcEhvb2sobm9kZTogdW5rbm93bik6ICgoKSA9PiB2b2lkKSB8IHVuZGVmaW5lZCB7XG4gIHJldHVybiAobm9kZSBhcyB7IFtNRU1CRVJTSElQX0NIQU5HRURdPzogKCkgPT4gdm9pZCB9IHwgbnVsbCB8IHVuZGVmaW5lZCk/LltcbiAgICBNRU1CRVJTSElQX0NIQU5HRURcbiAgXTtcbn1cblxuLyoqXG4gKiBAaW50ZXJuYWwgVGhlIHR3byBwaHlzaWNhbCBvYmplY3RzIG9uZSBicmFuY2ggaXMgcmVwcmVzZW50ZWQgYnkuXG4gKlxuICogQSBicmFuY2ggaXMgT05FIHNlbWFudGljIG9iamVjdCBhbmQgVFdPIHBoeXNpY2FsIG9uZXM6IHRoZSBgTm9kZUFjY2Vzc29yYFxuICogY29uc3VtZXJzIGhvbGQsIGFuZCB0aGUgYmFja2luZyBzdG9yZSBpdHMgY2FsbCBwYXRoIGNsb3NlcyBvdmVyLiBCb3RoIGNhcnJ5IGFcbiAqIGRlc2NyaXB0b3IgcGVyIG1lbWJlciwgYW5kIGJvdGggYXJlIG9ic2VydmFibGUg4oCUIHRoZSBzdG9yZSB0aHJvdWdoIGBicmFuY2goKWBcbiAqIGFuZCBldmVyeSBzbmFwc2hvdCwgdGhlIGFjY2Vzc29yIHRocm91Z2ggYE9iamVjdC5rZXlzKGJyYW5jaClgLCBgJ2snIGluXG4gKiBicmFuY2hgIGFuZCBzcHJlYWQuXG4gKi9cbmNvbnN0IE5PREVfQUNDRVNTT1JfUEVFUiA9IFN5bWJvbC5mb3IoJ1NpZ25hbFRyZWU6Tm9kZUFjY2Vzc29yUGVlcicpO1xuXG4vKiogQGludGVybmFsIFRydWUgd2hlbiB0aGlzIGxlYWYgaXMgYWJzZW50IGZyb20gaXRzIHBhcmVudCdzIGN1cnJlbnQgdmFsdWUuICovXG4vKipcbiAqIEBpbnRlcm5hbCBUcnVlIHdoZW4gdGhpcyBsZWFmIGlzIGFic2VudCBmcm9tIGl0cyBwYXJlbnQncyBjdXJyZW50IHZhbHVlLlxuICpcbiAqIOKaoO+4jyBSRUFEUyBUSEUgREVTQ1JJUFRPUiwgTkVWRVIgQSBDQUNIRUQgRkxBRy4gVGhlIGJpbmRpbmcgYmVsb3cgb25seSBhbnN3ZXJzXG4gKiBcIndoZXJlIGRvIEkgY29uc3VsdCB0aGUgYXV0aG9yaXRhdGl2ZSBkZXNjcmlwdG9yXCI7IGl0IG11c3QgbmV2ZXIgYW5zd2VyIFwiaXNcbiAqIHRoaXMgbWVtYmVyIGFjdGl2ZVwiLiBFbnVtZXJhYmlsaXR5IG93bnMgdGhhdCwgYW5kIGEgY2FjaGVkIGJvb2xlYW4gYmVzaWRlIGl0XG4gKiB3b3VsZCBiZSBhIHNlY29uZCBtZW1iZXJzaGlwIHRydXRoIGFibGUgdG8gZGlzYWdyZWUuIChgaXNBYnNlbnRNZW1iZXJgJ3NcbiAqIGNhY2hlIGlzIG5vdCBvbmU6IGl0IGlzIHJlY29tcHV0ZWQgZnJvbSB0aGUgZGVzY3JpcHRvcnMgYWZ0ZXIgYW55XG4gKiBtZW1iZXJzaGlwIGNoYW5nZSwgYG1lbWJlcnNoaXBFcG9jaGAuKVxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNEb3JtYW50TWVtYmVyKGxlYWY6IHVua25vd24pOiBib29sZWFuIHtcbiAgY29uc3QgYmluZGluZyA9IG1lbWJlckJpbmRpbmcobGVhZik7XG4gIGlmIChiaW5kaW5nID09PSB1bmRlZmluZWQpIHJldHVybiBmYWxzZTtcbiAgY29uc3QgZGVzY3JpcHRvciA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoXG4gICAgYmluZGluZy5wYXJlbnQsXG4gICAgYmluZGluZy5rZXlcbiAgKTtcbiAgcmV0dXJuIGRlc2NyaXB0b3IgIT09IHVuZGVmaW5lZCAmJiBkZXNjcmlwdG9yLmVudW1lcmFibGUgPT09IGZhbHNlO1xufVxuXG5mdW5jdGlvbiBtZW1iZXJCaW5kaW5nKGxlYWY6IHVua25vd24pOiBEb3JtYW50QmluZGluZyB8IHVuZGVmaW5lZCB7XG4gIGlmICghaXNUcmF2ZXJzYWJsZU5vZGUobGVhZikpIHtcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG4gIHJldHVybiAobGVhZiBhcyBSZWNvcmQ8c3ltYm9sLCBEb3JtYW50QmluZGluZyB8IHVuZGVmaW5lZD4pW0RPUk1BTlRdO1xufVxuXG4vKiogQ29sZCByZWxhdGlvbnNoaXAgY29uc3RydWN0aW9uIG9ubHk7IG5vIGxpbmtzIGFyZSBjcmVhdGVkIGJ5IHRoaXMgcmVhZC4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRSZXRhaW5lZE1lbWJlcnNoaXBQYXRoKG5vZGU6IHVua25vd24pOiByZWFkb25seSB7XG4gIHJlYWRvbmx5IHBhcmVudDogb2JqZWN0O1xuICByZWFkb25seSBrZXk6IHN0cmluZztcbiAgcmVhZG9ubHkgY2hpbGQ6IG9iamVjdDtcbiAgcmVhZG9ubHkgcHJlc2VudDogYm9vbGVhbjtcbn1bXSB7XG4gIGNvbnN0IHBhdGg6IHtcbiAgICBwYXJlbnQ6IG9iamVjdDtcbiAgICBrZXk6IHN0cmluZztcbiAgICBjaGlsZDogb2JqZWN0O1xuICAgIHByZXNlbnQ6IGJvb2xlYW47XG4gIH1bXSA9IFtdO1xuICBmb3IgKGxldCBjaGlsZCA9IG5vZGU7IGlzVHJhdmVyc2FibGVOb2RlKGNoaWxkKTsgKSB7XG4gICAgY29uc3QgYmluZGluZyA9IG1lbWJlckJpbmRpbmcoY2hpbGQpO1xuICAgIGlmICghYmluZGluZykgYnJlYWs7XG4gICAgY29uc3QgZGVzY3JpcHRvciA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoXG4gICAgICBiaW5kaW5nLnBhcmVudCxcbiAgICAgIGJpbmRpbmcua2V5XG4gICAgKTtcbiAgICBwYXRoLnB1c2goe1xuICAgICAgcGFyZW50OiBiaW5kaW5nLnBhcmVudCxcbiAgICAgIGtleTogYmluZGluZy5rZXksXG4gICAgICBjaGlsZCxcbiAgICAgIHByZXNlbnQ6IGRlc2NyaXB0b3I/LmVudW1lcmFibGUgPT09IHRydWUgJiYgZGVzY3JpcHRvci52YWx1ZSA9PT0gY2hpbGQsXG4gICAgfSk7XG4gICAgY2hpbGQgPSBiaW5kaW5nLnBhcmVudDtcbiAgfVxuICByZXR1cm4gcGF0aDtcbn1cblxuLyoqIFJlc3RvcmUgYSBkb3JtYW50IG1lbWJlcidzIG93biBtZW1iZXJzaGlwOyB1c2VkIGluc2lkZSBhIHN0cnVjdHVyYWwgd3JpdGUuICovXG5mdW5jdGlvbiByZWFjdGl2YXRlT25Xcml0ZShsZWFmOiB1bmtub3duKTogYm9vbGVhbiB7XG4gIGNvbnN0IGJpbmRpbmcgPSBtZW1iZXJCaW5kaW5nKGxlYWYpO1xuICBpZiAoIWJpbmRpbmcpIHJldHVybiBmYWxzZTtcbiAgLy8g4pqg77iPIE1FTUJFUlNISVAgT05MWSDigJQgREVMSUJFUkFURUxZIE5PIFBVQkxJQ0FUSU9OIEhFUkUuXG4gIC8vXG4gIC8vIFRoZSBjYWxsZXIgaXMgdGhlIGNoaWxkJ3Mgb3duIGBzZXRgL2B1cGRhdGVgLCB3aGljaCBhbHJlYWR5IGtub3dzIGl0cyBzbG90XG4gIC8vIGFuZCBwdWJsaXNoZXMgaXQgZXhhY3RseSBvbmNlLiBSZXB1Ymxpc2hpbmcgdGhlIHdob2xlIGJyYW5jaCBmcm9tIGhlcmUgYXNcbiAgLy8gd2VsbCBlbWl0dGVkIFRIUkVFIHB1YmxpY2F0aW9ucyBmb3Igb25lIHNlbWFudGljIHRyYW5zaXRpb24gKG1lYXN1cmVkOlxuICAvLyAyIGZyb20gdGhlIGJyYW5jaCBzd2VlcCArIDEgZnJvbSB0aGUgY2FsbGVyKS4gSXQgaXMgYWxzbyB1bm5lY2Vzc2FyeSB1bmRlclxuICAvLyBNLUMyOiB0aGUgcGFyZW50IGFscmVhZHkgaG9sZHMgYSBkZXBlbmRlbmN5IG9uIHRoaXMgZG9ybWFudCBjaGlsZCdzIHRva2VuLFxuICAvLyBzbyB3YWtpbmcgdGhhdCBvbmUgc2xvdCB3YWtlcyB0aGUgcGFyZW50IHRvby5cbiAgcmV0dXJuIHNldE1lbWJlclByZXNlbmNlKGJpbmRpbmcucGFyZW50LCBiaW5kaW5nLmtleSwgJ2FjdGl2ZScpO1xufVxuXG4vKiogVGhlIG5vZGUgYSBwYXJlbnQncyBvd24gbWVtYmVyIGxpbmsgaXMgc3RhbXBlZCBvbiAoaXRzIGFjY2Vzc29yIGhhbGYpLiAqL1xuZnVuY3Rpb24gbm9kZU9mKHBhcmVudDogb2JqZWN0KTogb2JqZWN0IHtcbiAgcmV0dXJuIChcbiAgICAoKHBhcmVudCBhcyBSZWNvcmQ8c3ltYm9sLCB1bmtub3duPilbTk9ERV9BQ0NFU1NPUl9QRUVSXSBhcyBvYmplY3QpID8/XG4gICAgcGFyZW50XG4gICk7XG59XG5cbi8qKlxuICogQGludGVybmFsIFRydWUgd2hlbiBgbm9kZWAgaXMgYWJzZW50IGZyb20gdGhlIGN1cnJlbnQgdHJlZTogaXQsIG9yIGEgbWVtYmVyXG4gKiBhYm92ZSBpdCwgaXMgb21pdHRlZC5cbiAqXG4gKiAgICAgQSBERVNDRU5EQU5UIEFCU0VOVCBGUk9NIElUUyBQQVJFTlQnUyBDVVJSRU5UIFZBTFVFIElTIFNFTUFOVElDQUxMWVxuICogICAgIEFCU0VOVCBFVkVOIElGIElUUyBQSFlTSUNBTCBMT0NBVElPTiBJUyBSRVRBSU5FRC5cbiAqXG4gKiBgaXNEb3JtYW50TWVtYmVyYCBhbnN3ZXJzIG9ubHkgZm9yIHRoZSBub2RlJ3Mgb3duIGRlc2NyaXB0b3IsIHNvIGEgbG9jYXRpb25cbiAqIHVuZGVyIGFuIG9taXR0ZWQgYnJhbmNoIHJlYWQgYW5kIHdyb3RlIHJldGFpbmVkIHN0b3JhZ2UgKHYxNiBpbnRlZ3JhdGlvbiA4ZCxcbiAqIG9wZW4gaXRlbSAxKS4gVGhlIGxpbmtzIGZvbGxvd2VkIGhlcmUgYXJlIHN0YW1wZWQgd2hlbiBhIG1lbWJlciBpcyBmaXJzdFxuICogb21pdHRlZCwgb24gaXQgYW5kIG9uIGV2ZXJ5IHN0YXRlIGxvY2F0aW9uIGJlbG93IGl0OyB0aGV5IG9ubHkgbG9jYXRlXG4gKiBkZXNjcmlwdG9ycywgYW5kIGVudW1lcmFiaWxpdHkgc3RpbGwgYW5zd2Vycy4gQSBub2RlIG5ldmVyIHVuZGVyIGFuIG9taXR0ZWRcbiAqIG1lbWJlciBoYXMgbm8gbGluayBhbmQgcGF5cyBvbmUgc3ltYm9sIGxvb2t1cCwgYXMgYmVmb3JlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNBYnNlbnRNZW1iZXIobm9kZTogdW5rbm93bik6IGJvb2xlYW4ge1xuICBjb25zdCBmaXJzdCA9IG1lbWJlckJpbmRpbmcobm9kZSk7XG4gIGlmIChmaXJzdCA9PT0gdW5kZWZpbmVkKSByZXR1cm4gZmFsc2U7XG4gIC8vIOKaoO+4jyBBIENBQ0hFRCBBTlNXRVIsIFZBTElEQVRFRCBCWSBUSEUgTUVNQkVSU0hJUCBFUE9DSCAodjE2IDhnKS4gRXZlcnlcbiAgLy8gcmVhZCBhbmQgd3JpdGUgb2YgYSBsb2NhdGlvbiB1bmRlciBhIGxpbmsgd2Fsa2VkIGV2ZXJ5IGRlc2NyaXB0b3IgYWJvdmVcbiAgLy8gaXQ6IHJlYWRzIGFmdGVyIGFuIG9taXQgYW5kIHJlLWFkZCBjb3N0IDguOHgsIHdyaXRlcyAyLjN4IChwZXJmLTE1LjQuNCxcbiAgLy8gZng0KS4gRW51bWVyYWJpbGl0eSBzdGlsbCBhbnN3ZXJzOiB0aGUgd2FsayBiZWxvdyBydW5zIHdoZW5ldmVyIGFueVxuICAvLyBtZW1iZXJzaGlwIGNoYW5nZWQgc2luY2UgdGhlIGxhc3QgYW5zd2VyLlxuICBpZiAoZmlyc3QuZXBvY2ggPT09IG1lbWJlcnNoaXBFcG9jaCkge1xuICAgIGlmIChcbiAgICAgICh0eXBlb2YgbmdEZXZNb2RlID09PSAndW5kZWZpbmVkJyB8fCBuZ0Rldk1vZGUpICYmXG4gICAgICArK2Fic2VuY2VDaGVja3MgJSBBQlNFTkNFX0NIRUNLX0VWRVJZID09PSAwICYmXG4gICAgICB3YWxrQWJzZW5jZShmaXJzdCkgIT09IGZpcnN0LmFic2VudFxuICAgIClcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgJ1NpZ25hbFRyZWUgaW50ZXJuYWw6IGEgY2FjaGVkIGFic2VuY2UgYW5zd2VyIGRpc2FncmVlcyB3aXRoICcgK1xuICAgICAgICAgICdlbnVtZXJhYmlsaXR5IChtZW1iZXJzaGlwRXBvY2ggd2FzIG5vdCBhZHZhbmNlZCkuJ1xuICAgICAgKTtcbiAgICByZXR1cm4gZmlyc3QuYWJzZW50O1xuICB9XG4gIGlmIChQUk9EVUNUSU9OX1NVQlNUUkFURV9TVEFUU19FTkFCTEVEKSB7XG4gICAgcmVjb3JkUHJvZHVjdGlvblN1YnN0cmF0ZVN0YXQoJ2Fic2VuY2VXYWxrcycpO1xuICB9XG4gIGZpcnN0LmFic2VudCA9IHdhbGtBYnNlbmNlKGZpcnN0KTtcbiAgZmlyc3QuZXBvY2ggPSBtZW1iZXJzaGlwRXBvY2g7XG4gIHJldHVybiBmaXJzdC5hYnNlbnQ7XG59XG5cbmZ1bmN0aW9uIHdhbGtBYnNlbmNlKGZpcnN0OiBEb3JtYW50QmluZGluZyk6IGJvb2xlYW4ge1xuICBmb3IgKFxuICAgIGxldCBiaW5kaW5nOiBEb3JtYW50QmluZGluZyB8IHVuZGVmaW5lZCA9IGZpcnN0O1xuICAgIGJpbmRpbmc7XG4gICAgYmluZGluZyA9IG1lbWJlckJpbmRpbmcoYmluZGluZy5wYXJlbnQpXG4gICkge1xuICAgIGNvbnN0IGRlc2NyaXB0b3IgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKFxuICAgICAgYmluZGluZy5wYXJlbnQsXG4gICAgICBiaW5kaW5nLmtleVxuICAgICk7XG4gICAgaWYgKGRlc2NyaXB0b3I/LmVudW1lcmFibGUgPT09IGZhbHNlKSByZXR1cm4gdHJ1ZTtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbi8qKlxuICogQGludGVybmFsIEEgc3RydWN0dXJhbCB3cml0ZSAoYSB3aG9sZSB2YWx1ZSwgYSByZXZlcnNhbCBpbnN0YWxsaW5nIG1lbWJlcnMpXG4gKiByZWNvbmNpbGVzIG1lbWJlcnNoaXAgaXRzZWxmLCBsZXZlbCBieSBsZXZlbCwgYW5kIGFubm91bmNlcyBpdC5cbiAqXG4gKiDimqDvuI8gT05MWSBJVFMgT1dOIFdSSVRFUyAodjE2IDhmKS4gVGhlIHdyaXRlciBtYXJrcyBlYWNoIGxvY2F0aW9uIGl0IHdyaXRlc1xuICogaXRzZWxmIChgb3duYCkgZm9yIHRoZSBkdXJhdGlvbiBvZiB0aGF0IHdyaXRlOiB0aGF0IHdyaXRlIGtlZXBzIHRoZVxuICogb3duLW1lbWJlciByZWFjdGl2YXRpb24gaXQgYWx3YXlzIGhhZCBhbmQgYW5ub3VuY2VzIG5vdGhpbmcsIHNvIG5vXG4gKiB0cmFuc2l0aW9uIGlzIGFubm91bmNlZCB0d2ljZS4gQW55IG90aGVyIHdyaXRlIG1hZGUgd2hpbGUgaXQgcnVucywgZnJvbSBhXG4gKiB0YXAgb3IgYSBzeW5jIGVmZmVjdCBpbiB0aGlzIHRyZWUgb3IgYW5vdGhlciwgaXMgYW4gb3JkaW5hcnkgd3JpdGU6IGl0XG4gKiByZS1hZGRzIGl0cyBwYXRoLCBhbmQgdGhlIHN0cnVjdHVyYWwgd3JpdGUgbmV2ZXIgb21pdHMgdGhhdCBwYXRoIGFnYWluXG4gKiAoYHJlYWRkZWRgKS4gU2NvcGVkIHBlciB0cmVlLCA4ZSBzdGlsbCBsZXQgYSBzYW1lLXRyZWUgd3JpdGUgdmFuaXNoIGludG9cbiAqIHJldGFpbmVkIHN0b3JhZ2U7IGEgZ2xvYmFsIGNvdW50ZXIgKDhkKSBsZXQgYW55IHRyZWUncy5cbiAqXG4gKiBgZW5kYCBydW5zIHdoZW4gdGhlIG91dGVybW9zdCBzdHJ1Y3R1cmFsIHdyaXRlIGNsb3Nlcy4gT25seSBlbnRpdHlcbiAqIGNvbGxlY3Rpb25zIGluc3RhbGwgaXQsIHRvIHdha2UgdGhlaXIgY29uc3VtZXJzIGFmdGVyIGl0IHJhdGhlciB0aGFuIGluc2lkZVxuICogaXQgKGBlbnRpdHktc2lnbmFsYCksIHNvIGEgdHJlZSB3aXRob3V0IGNvbGxlY3Rpb25zIGNhcnJpZXMgbm9uZSBvZiB0aGF0LlxuICovXG5leHBvcnQgY29uc3Qgc3RydWN0dXJhbFdyaXRlczoge1xuICBkZXB0aDogbnVtYmVyO1xuICAvKiogQ291bnRzIHJlLWFkZHMgYW5kIHdob2xlIHZhbHVlcywgc28gZWFjaCBrbm93cyB3aGljaCBjYW1lIGFmdGVyIGl0LiAqL1xuICBzdGFtcDogbnVtYmVyO1xuICBvd24/OiB1bmtub3duO1xuICByZWFkZGVkPzogTWFwPG9iamVjdCwgTWFwPHN0cmluZywgbnVtYmVyPj47XG4gIGVuZD86IChmYWlsZWQ/OiBib29sZWFuKSA9PiB2b2lkO1xufSA9IHtcbiAgZGVwdGg6IDAsXG4gIHN0YW1wOiAwLFxufTtcblxuLyoqIEBpbnRlcm5hbCBPcGVuIGEgc3RydWN0dXJhbCB3cml0ZTsgY2xvc2UgaXQgd2l0aCBgZW5kU3RydWN0dXJhbFdyaXRlYCBpbiBhIGBmaW5hbGx5YC4gKi9cbmV4cG9ydCBmdW5jdGlvbiBiZWdpblN0cnVjdHVyYWxXcml0ZSgpOiB2b2lkIHtcbiAgc3RydWN0dXJhbFdyaXRlcy5kZXB0aCsrO1xufVxuXG4vKipcbiAqIEBpbnRlcm5hbCBDbG9zZSBhIHN0cnVjdHVyYWwgd3JpdGUgb3BlbmVkIHdpdGggYGJlZ2luU3RydWN0dXJhbFdyaXRlYC5cbiAqIGBmYWlsZWRgIHdoZW4gaXQgaXMgY2xvc2luZyBiZWNhdXNlIHRoZSB3cml0ZSB0aHJldywgc28gdGhhdCB3aGF0IGBlbmRgXG4gKiBydW5zIGRvZXMgbm90IHJlcGxhY2UgdGhlIHdyaXRlJ3Mgb3duIGVycm9yIChgZW50aXR5LXNpZ25hbGApLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZW5kU3RydWN0dXJhbFdyaXRlKGZhaWxlZD86IGJvb2xlYW4pOiB2b2lkIHtcbiAgaWYgKC0tc3RydWN0dXJhbFdyaXRlcy5kZXB0aCkgcmV0dXJuO1xuICBzdHJ1Y3R1cmFsV3JpdGVzLnJlYWRkZWQgPSB1bmRlZmluZWQ7XG4gIHN0cnVjdHVyYWxXcml0ZXMuZW5kPy4oZmFpbGVkKTtcbn1cblxuLyoqIEBpbnRlcm5hbCBUcnVlIGZvciB0aGUgbG9jYXRpb24gYSBzdHJ1Y3R1cmFsIHdyaXRlciBpcyB3cml0aW5nIGl0c2VsZi4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpblN0cnVjdHVyYWxXcml0ZShub2RlOiB1bmtub3duKTogYm9vbGVhbiB7XG4gIHJldHVybiBub2RlICE9PSB1bmRlZmluZWQgJiYgc3RydWN0dXJhbFdyaXRlcy5vd24gPT09IG5vZGU7XG59XG5cbi8qKlxuICogQGludGVybmFsIFRydWUgd2hlbiBhIHdyaXRlIHJlLWFkZGVkIGBrZXlgIG9mIGBicmFuY2hgIGFmdGVyIHRoZSB3aG9sZSB2YWx1ZVxuICogdGhhdCBiZWdhbiBhdCBgc2luY2VgIGRpZCAoYHN0cnVjdHVyYWxXcml0ZXMuc3RhbXBgKTogdGhhdCB3aG9sZSB2YWx1ZSBtdXN0XG4gKiBub3Qgb21pdCBpdCBhZ2Fpbi4gQSB3aG9sZSB2YWx1ZSB0aGF0IGEgdGFwIHN0YXJ0ZWQgbGF0ZXIgZGVjaWRlcyBmb3JcbiAqIGl0c2VsZiwgc28gYSByZS1hZGQgYmVmb3JlIGl0IGJlZ2FuIGRvZXMgbm90IGJpbmQgaXQgKHYxNiA4ZiByZXZpZXcpLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVhZGRlZER1cmluZ1N0cnVjdHVyYWxXcml0ZShcbiAgYnJhbmNoOiBvYmplY3QsXG4gIGtleTogc3RyaW5nLFxuICBzaW5jZTogbnVtYmVyXG4pOiBib29sZWFuIHtcbiAgcmV0dXJuIChzdHJ1Y3R1cmFsV3JpdGVzLnJlYWRkZWQ/LmdldChub2RlT2YoYnJhbmNoKSk/LmdldChrZXkpID8/IDApID4gc2luY2U7XG59XG5cbi8qKlxuICogQGludGVybmFsIFdoaWxlIHBvc2l0aXZlLCBldmVyeSBsb2NhdGlvbiByZWFkcyBpdHMgc3RvcmVkIHZhbHVlIHdoYXRldmVyXG4gKiBpdHMgcHJlc2VuY2UuIEhpc3RvcnkgY2FwdHVyZSByZWFkcyBiZWZvcmUtaW1hZ2VzIHRoaXMgd2F5OiBhIG1lbWJlcnNoaXBcbiAqIGNoYW5nZSByZWNvcmRlZCB3aGlsZSBpdHMgbG9jYXRpb24gd2FzIGFic2VudCBtdXN0IHJlc3RvcmUgd2hhdCBzdG9yYWdlXG4gKiBoZWxkLCBhcyBhIHdob2xlIHZhbHVlIGRvZXMuIFJlYWRpbmcgdGhlIGFic2VudCB2YWx1ZSBpbnN0ZWFkIHJlY29yZGVkXG4gKiBgdW5kZWZpbmVkYCwgc28gdW5kbyBvciByb2xsYmFjayBvZiBhIHR1cm4gdGhhdCBvbWl0dGVkIGEgYnJhbmNoIGFuZCB0aGVuXG4gKiB3cm90ZSB1bmRlciBpdCBsZWZ0IHRoYXQgYnJhbmNoJ3MgbWVtYmVycyB1bmRlZmluZWQgKHYxNiA4ZSwgbWVhc3VyZWQpLlxuICovXG5leHBvcnQgY29uc3Qgc3RvcmVkUmVhZHMgPSB7IGRlcHRoOiAwIH07XG5cbi8qKlxuICogQGludGVybmFsIFJlLWFkZCBhIHdyaXR0ZW4gbG9jYXRpb24gdGhhdCBpcyBhYnNlbnQgZnJvbSB0aGUgY3VycmVudCB0cmVlLlxuICpcbiAqICAgICBXUklUSU5HIEFOIEFCU0VOVCBERVNDRU5EQU5UIFJFQUNUSVZBVEVTIElUUyBNRU1CRVJTSElQXG4gKiAgICAgKGB3aG9sZS12YWx1ZS1tZW1iZXJzaGlwLnNwZWMudHNgIDcpLCBBTE9ORyBJVFMgV0hPTEUgUEFUSC5cbiAqXG4gKiBDYWxsIGl0IGFmdGVyIHRoZSB3cml0dGVuIHZhbHVlIGlzIGluc3RhbGxlZDogdGhlIHZhbHVlIGlzIHRoZVxuICogYXV0aG9yaXRhdGl2ZSBzdXBwbGllZCB2YWx1ZSBgYWN0aXZhdGVPbmVgIHJlcXVpcmVzLiBGcm9tIHRoZSBvdXRlcm1vc3RcbiAqIG9taXR0ZWQgbWVtYmVyIGRvd24gdG8gdGhlIHdyaXR0ZW4gbG9jYXRpb24ncyBwYXJlbnQsIGV2ZXJ5IG1lbWJlciBvZmYgdGhlXG4gKiBwYXRoIGlzIG1hZGUgZG9ybWFudCBmaXJzdDogaXQgd2FzIGFic2VudCBhbmQgc3RheXMgYWJzZW50LCBiZWNhdXNlXG4gKiBcIkRPUk1BTlQgU1RPUkFHRSBNVVNUIE5PVCBTVVBQTFkgVEhFIFJFQUNUSVZBVEVEIFZBTFVFXCIgKGNhc2UgMTgpLiBUaGVuIGV2ZXJ5XG4gKiBvbWl0dGVkIG1lbWJlciBvbiB0aGUgcGF0aCBpcyByZS1hZGRlZC4gVGhlIHJlc3VsdCBpcyB3aGF0IGEgd2hvbGUgdmFsdWUgYXRcbiAqIHRoZSBvdXRlcm1vc3Qgb21pdHRlZCBtZW1iZXIsIGhvbGRpbmcgb25seSB0aGUgd3JpdHRlbiBwYXRoLCB3b3VsZCBnaXZlLlxuICpcbiAqIEV2ZXJ5IGxldmVsJ3MgbWVtYmVyc2hpcCBjaGFuZ2UgaXMgYW5ub3VuY2VkLCBhcyB0aGF0IHdob2xlIHZhbHVlIHdvdWxkXG4gKiBhbm5vdW5jZSBpdC4gUmVzdG9yYXRpb24gYW5kIHRyYW5zYWN0aW9ucyByZWdpc3RlciBhIG1lbWJlcidzIGxvY2F0aW9uXG4gKiB3aGVuIHRoZXkgb2JzZXJ2ZSBpdHMgY2hhbmdlLCBhbmQgYSBsYXRlciByZXZlcnNhbCB0aGF0IG11c3QgcmUtYWRkIGFcbiAqIG1lbWJlciBkZXBlbmRzIG9uIHRoYXQgcmVnaXN0cmF0aW9uOyBhbm5vdW5jaW5nIG9ubHkgdGhlIG91dGVybW9zdCBtZW1iZXJcbiAqIGxlZnQgdGhlIHNpYmxpbmdzIHVucmVnaXN0ZXJlZCwgYW5kIHVuZG8gb2YgYW4gZWFybGllciB3cml0ZSB0byBvbmUgb2YgdGhlbVxuICogcmVmdXNlZCB3aXRoIFwiaXRzIHJldGFpbmVkIGxvY2F0aW9uIGlzIG5vIGxvbmdlciBhdmFpbGFibGVcIiAobWVhc3VyZWQpLlxuICpcbiAqIOKaoO+4jyBBTk5PVU5DRUQgSEVSRSwgQkVGT1JFIFRIRSBXUklURVIgQU5OT1VOQ0VTIElUUyBWQUxVRSAodjE2IDhlKS4gOGRcbiAqIGFubm91bmNlZCBtZW1iZXJzaGlwIGFmdGVyIHRoZSB2YWx1ZSwgYXMgYSB3aG9sZSB2YWx1ZSBkb2VzLCB3aGljaCBuZWVkZWQgYVxuICogd3JhcHBlciAodHdvIGNsb3N1cmVzKSBhcm91bmQgZXZlcnkgbGVhZidzIHdyaXRlcnMgaW4gZXZlcnkgdHJlZS4gQm90aFxuICogaGlzdG9yeSBjYXB0dXJlIHBhdGhzIGNvbXBvc2UgYSBtZW1iZXIncyB2YWx1ZSBhbmQgcHJlc2VuY2UgcGVyIHBvc2l0aW9uIGluXG4gKiBlaXRoZXIgb3JkZXIgKGBjb21wb3NlUGxhaW5CcmFuY2hNZW1iZXJFZmZlY3RgKSwgYW5kIHRoZSA4ZCBtdXRhdGlvbiB0aGF0XG4gKiBhbm5vdW5jZWQgZmlyc3Qgd2FzIGtpbGxlZCBvbmx5IGJ5IHRoZSB0ZXN0IHRoYXQgcGlubmVkIHRoZSBvcmRlci5cbiAqXG4gKiBAcmV0dXJucyB3aGV0aGVyIG1lbWJlcnNoaXAgY2hhbmdlZCwgc28gdGhlIHdyaXRlciBwdWJsaXNoZXMgaXRzIG93biB0b2tlblxuICogZXZlbiB3aGVuIHRoZSByZXRhaW5lZCB2YWx1ZSBlcXVhbGxlZCB0aGUgd3JpdHRlbiBvbmUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWFjdGl2YXRlUGF0aE9uV3JpdGUobm9kZTogdW5rbm93bik6IGJvb2xlYW4ge1xuICAvLyBBIHByZXNlbnQgbG9jYXRpb24gaGFzIG5vdGhpbmcgdG8gcmUtYWRkIG9uIGVpdGhlciBicmFuY2ggYmVsb3cgKGFcbiAgLy8gc3RydWN0dXJhbCB3cml0ZSdzIG93biBtZW1iZXIgd291bGQgZmluZCBpdHMgZGVzY3JpcHRvciBlbnVtZXJhYmxlKS5cbiAgLy8gQW5zd2VyZWQgZmlyc3QsIGZyb20gdGhlIGNhY2hlLCBiZWZvcmUgYWxsb2NhdGluZyB0aGUgcGF0aCAodjE2IDhnKS5cbiAgY29uc3QgcGh5c2ljYWxseUFic2VudCA9IGlzQWJzZW50TWVtYmVyKG5vZGUpO1xuICBpZiAoIXBoeXNpY2FsbHlBYnNlbnQgJiYgIW93bk9yZGluYXJ5QWJzZW5jZShub2RlKSkgcmV0dXJuIGZhbHNlO1xuICBpZiAoaW5TdHJ1Y3R1cmFsV3JpdGUobm9kZSkpIHJldHVybiByZWFjdGl2YXRlT25Xcml0ZShub2RlKTtcbiAgaWYgKFBST0RVQ1RJT05fU1VCU1RSQVRFX1NUQVRTX0VOQUJMRUQpIHtcbiAgICByZWNvcmRQcm9kdWN0aW9uU3Vic3RyYXRlU3RhdCgnYWJzZW5jZVdhbGtzJyk7XG4gIH1cbiAgY29uc3QgcGF0aDogRG9ybWFudEJpbmRpbmdbXSA9IFtdO1xuICBsZXQgb3V0ZXIgPSAtMTtcbiAgZm9yIChcbiAgICBsZXQgYmluZGluZyA9IG1lbWJlckJpbmRpbmcobm9kZSk7XG4gICAgYmluZGluZztcbiAgICBiaW5kaW5nID0gbWVtYmVyQmluZGluZyhiaW5kaW5nLnBhcmVudClcbiAgKSB7XG4gICAgY29uc3QgZGVzY3JpcHRvciA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoXG4gICAgICBiaW5kaW5nLnBhcmVudCxcbiAgICAgIGJpbmRpbmcua2V5XG4gICAgKTtcbiAgICBpZiAoXG4gICAgICBkZXNjcmlwdG9yPy5lbnVtZXJhYmxlID09PSBmYWxzZSB8fFxuICAgICAgIXJlYWRPcmRpbmFyeU1lbWJlclByZXNlbmNlKGJpbmRpbmcucGFyZW50LCBiaW5kaW5nLmtleSlcbiAgICApXG4gICAgICBvdXRlciA9IHBhdGgubGVuZ3RoO1xuICAgIHBhdGgucHVzaChiaW5kaW5nKTtcbiAgfVxuICBpZiAob3V0ZXIgPCAwKSByZXR1cm4gZmFsc2U7XG4gIC8vIENhcHR1cmVkIGJlZm9yZSBhbnl0aGluZyBjaGFuZ2VzLCBvbmx5IHdoZW4gc29tZXRoaW5nIG9ic2VydmVzIHBhdGhzLlxuICBjb25zdCBhbm5vdW5jZSA9IGNhcHR1cmVQYXRoUmVBZGRJZk9ic2VydmVkKHBhdGgsIG91dGVyKTtcbiAgZm9yIChsZXQgaSA9IG91dGVyIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICBjb25zdCB7IHBhcmVudCwga2V5OiBrZXB0IH0gPSBwYXRoW2ldO1xuICAgIGZvciAoY29uc3QgbWVtYmVyIG9mIE9iamVjdC5rZXlzKHBhcmVudCkpXG4gICAgICBpZiAobWVtYmVyICE9PSBrZXB0KSBzZXRNZW1iZXJQcmVzZW5jZShwYXJlbnQsIG1lbWJlciwgJ2Rvcm1hbnQnKTtcbiAgfVxuICBmb3IgKGxldCBpID0gb3V0ZXI7IGkgPj0gMDsgaS0tKSB7XG4gICAgY29uc3QgeyBwYXJlbnQsIGtleSB9ID0gcGF0aFtpXTtcbiAgICBzZXRNZW1iZXJQcmVzZW5jZShwYXJlbnQsIGtleSwgJ2FjdGl2ZScpO1xuICAgIGlmIChzdHJ1Y3R1cmFsV3JpdGVzLmRlcHRoKSB7XG4gICAgICBjb25zdCByZWFkZGVkID0gKHN0cnVjdHVyYWxXcml0ZXMucmVhZGRlZCA/Pz0gbmV3IE1hcCgpKTtcbiAgICAgIGxldCBrZXlzID0gcmVhZGRlZC5nZXQocGFyZW50KTtcbiAgICAgIGlmICgha2V5cykgcmVhZGRlZC5zZXQocGFyZW50LCAoa2V5cyA9IG5ldyBNYXAoKSkpO1xuICAgICAga2V5cy5zZXQoa2V5LCArK3N0cnVjdHVyYWxXcml0ZXMuc3RhbXApO1xuICAgIH1cbiAgfVxuICAvLyBBIHJlLWFkZGVkIGxlYWYgaXMgdGhlIHdyaXR0ZW4gbG9jYXRpb24gaXRzZWxmLCBhbmQgaXRzIHdyaXRlciBwdWJsaXNoZXNcbiAgLy8gaXRzIHRva2VuIG9uY2UgKGB3aG9sZS12YWx1ZS1tZW1iZXJzaGlwLnNwZWMudHNgIDE2KS4gQSByZS1hZGRlZCBicmFuY2hcbiAgLy8gaGFzIG5vIHRva2VuOiBpdHMgb2JzZXJ2ZXJzIGFuZCB0aG9zZSBiZWxvdyBpdCBhcmUgd29rZW4gaGVyZS5cbiAgaWYgKCFpc1dyaXRhYmxlTG9jYXRpb24obm9kZSkgfHwgb3V0ZXIgPiAwKVxuICAgIHJlcHVibGlzaE1lbWJlcnMocGF0aFtvdXRlcl0ucGFyZW50LCBbcGF0aFtvdXRlcl0ua2V5XSk7XG4gIGFubm91bmNlPy4oKTtcbiAgcmV0dXJuIHBoeXNpY2FsbHlBYnNlbnQ7XG59XG5cbi8qKlxuICogVGhlIGxpdmVuZXNzIGEgdHJlZSdzIGxlYXZlcyBjb25zdWx0IG9uY2UgYSBtZW1iZXIgb2YgdGhhdCB0cmVlIGhhcyBiZWVuXG4gKiBvbWl0dGVkLiBVbnRpbCB0aGVuIHRoZWlyIHJlYWQgYW5kIHdyaXRlIHBhdGhzIHNlZSBvbmUgZW1wdHkgc2xvdCBhbmQgcnVuXG4gKiBub25lIG9mIGl0IChgTWVtYmVyQWJzZW5jZWAsIHYxNiA4ZSkuXG4gKi9cbmNvbnN0IEFCU0VOQ0U6IE1lbWJlckFic2VuY2UgPSB7XG4gIC8vIEhpc3RvcnkgY2FwdHVyZSByZWFkcyB3aGF0IHN0b3JhZ2UgaG9sZHMgKGBzdG9yZWRSZWFkc2ApLlxuICBpc0Fic2VudDogKG5vZGUpID0+ICFzdG9yZWRSZWFkcy5kZXB0aCAmJiBpc0Fic2VudE1lbWJlcihub2RlKSxcbiAgcmVBZGQ6IHJlYWN0aXZhdGVQYXRoT25Xcml0ZSxcbiAgbmVlZHNBZG1pc3Npb246IChub2RlKSA9PlxuICAgIGdldEFjdGl2ZVdyaXRlQ29udGV4dCgpPy5wYXJ0aWNpcGF0aW9uICE9PSAnaW5zcGVjdGlvbicgJiZcbiAgICBvd25PcmRpbmFyeUFic2VuY2Uobm9kZSksXG59O1xuXG4vKipcbiAqIEBpbnRlcm5hbCBJbnZhbGlkYXRlIHRoZSBPQlNFUlZBVElPTiBvZiBldmVyeSBzY2FsYXIgbWVtYmVyIHVuZGVyIGBwYXJlbnRgXG4gKiBhZnRlciBhIG1lbWJlcnNoaXAgdHJhbnNpdGlvbiwgd2l0aG91dCB3cml0aW5nIGFueXRoaW5nLlxuICpcbiAqIOKaoO+4jyBUSElTIElTIEFOIElOVkFMSURBVElPTiBDQVJSSUVSLCBOT1QgQSBNRU1CRVJTSElQIEFVVEhPUklUWS4gRW51bWVyYWJpbGl0eVxuICogZGVjaWRlcyBtZW1iZXJzaGlwOyB0aGlzIG9ubHkgd2FrZXMgdGhlIGNvbnN1bWVycyBzbyB0aGV5IHJlLXJlYWQgaXQuXG4gKlxuICogSXQgcmV1c2VzIHRoZSBwZXItc2xvdCBwdWJsaWNhdGlvbiB0b2tlbnMgdGhhdCBhbHJlYWR5IGV4aXN0IGFuZCB0aGF0IGVhY2hcbiAqIGxlYWYgQUxSRUFEWSBkZXBlbmRzIG9uIOKAlCBgY3JlYXRlQW5ndWxhckxlYWZgIGNhbGxzIGBwdWJsaWNhdGlvbi5vYnNlcnZlKHNsb3QpYFxuICogSU5TSURFIGl0cyBjb21wdXRhdGlvbiwgc28gdGhlIGRlcGVuZGVuY3kgZWRnZSBpcyBlc3RhYmxpc2hlZCBvbiB0aGUgbGVhZidzXG4gKiBmaXJzdCByZWFkLiBUaGF0IGlzIHdoYXQgbWFrZXMgbWVtYmVyc2hpcCBmcmVlOiBubyBuZXcgcmVhY3RpdmUgc3RhdGUsIGFuZCBub1xuICogZmlyc3QtdHJhbnNpdGlvbiBwcm9ibGVtLiBBIGxhemlseSBjcmVhdGVkIG1lbWJlcnNoaXAgc2lnbmFsIHdvdWxkIE5PVCBiZSBhXG4gKiBkZXBlbmRlbmN5IG9mIGEgY29tcHV0YXRpb24gdGhhdCBoYWQgYWxyZWFkeSBydW4g4oCUIG1lYXN1cmVkLCBhbmQgdGhlIHJlYXNvblxuICogdGhlIHBlci1sZWFmIGRlc2lnbiB3YXMgYWJhbmRvbmVkLlxuICpcbiAqIE1vdmVkIGhlcmUgZnJvbSBgc2lnbmFsLXRyZWUudHNgIGluIHYxNiA4ZTogcGF0aCByZS1hZGRzIGFuZCByZXZlcnNhbHMgY2FsbFxuICogaXQgdG9vLCBhbmQgYSBwb3J0IHRvIHJlYWNoIGl0IGNvc3QgbW9yZSB0aGFuIHRoZSBtb3ZlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVwdWJsaXNoTWVtYmVycyhcbiAgcGFyZW50OiBvYmplY3QsXG4gIGtleXM6IHJlYWRvbmx5IHN0cmluZ1tdXG4pOiB2b2lkIHtcbiAgY29uc3QgcnVudGltZSA9IGdldFRyZWVTY2FsYXJTbG90UnVudGltZShwYXJlbnQpO1xuICBpZiAoIXJ1bnRpbWUpIHJldHVybjtcblxuICAvLyDimqDvuI8gT05MWSBUSEUgU0xPVFMgV0hPU0UgTUVNQkVSU0hJUCBDSEFOR0VELlxuICAvL1xuICAvLyAgICAgY2hhbmdlZFNsb3RzID0gdmFsdWUtY2hhbmdlZCBzbG90cyBVTklPTiBtZW1iZXJzaGlwLWNoYW5nZWQgc2xvdHNcbiAgLy8gICAgIGVhY2ggc2VtYW50aWMgc2xvdCBwdWJsaXNoZWQgT05DRSBwZXIgdHJhbnNpdGlvblxuICAvL1xuICAvLyBTd2VlcGluZyBldmVyeSBzbG90IHVuZGVyIHRoZSBicmFuY2ggcHVibGlzaGVkIHNpYmxpbmdzIHdob3NlIG1lbWJlcnNoaXAgYW5kXG4gIC8vIHZhbHVlIHdlcmUgYm90aCB1bnRvdWNoZWQsIGFuZCBkb3VibGUtcHVibGlzaGVkIHRoZSBvbmUgdGhhdCBkaWQgY2hhbmdlLlxuICBjb25zdCBjaGFuZ2VkU2xvdHM6IG51bWJlcltdID0gW107XG4gIC8vIOKaoO+4jyBBIFNMT1QgSVMgUE9TSVRJT04tQUREUkVTU0FCTEUgT05MWSBVTkRFUiBgcG9zaXRpb24tdG9wb2xvZ3lgLlxuICAvL1xuICAvLyBFdmVyeSB0cmVlIGhhcyBzY2FsYXIgc2xvdHMgc2luY2UgNWVmZWI3ZjUsIGJ1dCBhIGxlYWYgcmVjZWl2ZXMgYSBQb3NpdGlvbklkXG4gIC8vIG9ubHkgd2l0aCB0aGF0IGNhcGFiaWxpdHkgKHRyYW5zYWN0aW9ucywgcmVzdG9yYXRpb24pLiBXaXRob3V0IGl0IHRoZSBzbG90XG4gIC8vIGxvb2t1cCBiZWxvdyBmaW5kcyBub3RoaW5nLCBhbmQgdGhlIGxlYWYgd2FzIHRyZWF0ZWQgYXMgdG9rZW5sZXNzOiBpdHMgb3duXG4gIC8vIHRva2VuIHdhcyBuZXZlciBwdWJsaXNoZWQsIHNvIGEgZGVyaXZlZCwgYSBgc3Vic2NyaWJlYCBsaXN0ZW5lciBhbmQgZXZlcnlcbiAgLy8gbmF0aXZlIGNhcnJpZXIgKEFuZ3VsYXIsIFZ1ZSwgU29saWQpIGtlcHQgdGhlIHJldGFpbmVkIHZhbHVlIGFmdGVyXG4gIC8vIGBwKHsgbmFtZTogJ2EnIH0pYCByZW1vdmVkIGBhZ2VgLiBUaGUgbGVhZidzIGxvY2F0aW9uIGJpbmRpbmcgSVMgdGhhdCB0b2tlblxuICAvLyDigJQgdGhlIG9uZSBpdHMgb3duIHdyaXRlcyBwdWJsaXNoIOKAlCBzbyBpdCBpcyBwdWJsaXNoZWQgaW5zdGVhZC5cbiAgY29uc3QgdW5hZGRyZXNzZWRMZWF2ZXM6IExvY2F0aW9uUHVibGlzaGVyW10gPSBbXTtcbiAgLy8g4pqg77iPIEEgQlJBTkNIIE1FTUJFUidTIFBSRVNFTkNFIElTIEVWRVJZIFBSRVNFTlQgTE9DQVRJT04nUyBCRUxPVyBJVC5cbiAgLy9cbiAgLy8gT21pdHRpbmcgb3IgcmUtYWRkaW5nIGEgYnJhbmNoIGNoYW5nZXMgd2hhdCBlYWNoIHByZXNlbnQgbG9jYXRpb24gdW5kZXJcbiAgLy8gaXQgcmVhZHMsIGJ1dCBub25lIG9mIHRoZW0gd2FzIHdyaXR0ZW4uIE1lYXN1cmVkIGJlZm9yZSB2MTYgOGQ6IGEgaGVsZFxuICAvLyBgY29tcHV0ZWQoKCkgPT4gYm94LmRyb3AoKSlgIGtlcHQgYHt2OjJ9YCBhZnRlciBgYm94KHtrZWVwfSlgIG9taXR0ZWRcbiAgLy8gYGRyb3BgLCBhbmQgaGVsZCByZWFkcyB1bmRlciBhbiBvbWl0dGVkIGBhYCBrZXB0IHJldGFpbmVkIHN0b3JhZ2UuIEVhY2hcbiAgLy8gcHJlc2VudCBicmFuY2ggYmVsb3cgcmUtcmVhZHMgdGhyb3VnaCBpdHMgbWVtYmVyc2hpcCByZXZpc2lvbiwgZWFjaCBsZWFmXG4gIC8vIHRocm91Z2ggaXRzIG93biB0b2tlbi4gRG9ybWFudCBtZW1iZXJzIGJlbG93IGFyZSBza2lwcGVkOiB0aGV5IHJlYWRcbiAgLy8gYWJzZW50IGJlZm9yZSBhbmQgYWZ0ZXIuXG4gIGNvbnN0IGJyYW5jaGVzOiBvYmplY3RbXSA9IFtdO1xuICAvLyBQdWJsaXNoIGEgbWVtYmVyJ3Mgb3duIHRva2VuOyBhIGJyYW5jaCBoYXMgbm9uZSwgc28gaXRzIHN1YnRyZWUgaXNcbiAgLy8gdmlzaXRlZCBpbnN0ZWFkLiBUcnVlIGZvciBhIHRva2VuLWNhcnJ5aW5nIG1lbWJlci5cbiAgY29uc3QgcHVibGlzaCA9IChjaGlsZDogdW5rbm93bik6IGJvb2xlYW4gPT4ge1xuICAgIGNvbnN0IHBvc2l0aW9uSWQgPSBnZXRPd25lZFBvc2l0aW9uSWRzKGNoaWxkKT8uWzBdO1xuICAgIGNvbnN0IHNsb3QgPVxuICAgICAgcG9zaXRpb25JZCA9PT0gdW5kZWZpbmVkXG4gICAgICAgID8gdW5kZWZpbmVkXG4gICAgICAgIDogcnVudGltZS5yZXNvbHZlU2NhbGFyU2xvdChwb3NpdGlvbklkKTtcbiAgICBpZiAoc2xvdCAhPT0gdW5kZWZpbmVkKSByZXR1cm4gY2hhbmdlZFNsb3RzLnB1c2goc2xvdCkgPiAwO1xuICAgIGNvbnN0IHB1Ymxpc2hlciA9IHdyaXRhYmxlTG9jYXRpb25QdWJsaXNoZXIoY2hpbGQpO1xuICAgIGlmIChwdWJsaXNoZXIpIHJldHVybiB1bmFkZHJlc3NlZExlYXZlcy5wdXNoKHB1Ymxpc2hlcikgPiAwO1xuICAgIG1lbWJlcnNoaXBIb29rKGNoaWxkKT8uKCk7XG4gICAgaWYgKGlzTm9kZUFjY2Vzc29yKGNoaWxkKSkge1xuICAgICAgYnJhbmNoZXMucHVzaChjaGlsZCk7XG4gICAgICBmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyhjaGlsZCkpXG4gICAgICAgIHB1Ymxpc2goKGNoaWxkIGFzIHVua25vd24gYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4pW2tleV0pO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG4gIGxldCB0b2tlbkNhcnJ5aW5nID0gMDtcbiAgZm9yIChjb25zdCBrZXkgb2Yga2V5cylcbiAgICBpZiAocHVibGlzaCgocGFyZW50IGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+KVtrZXldKSkgdG9rZW5DYXJyeWluZysrO1xuXG4gIC8vIOKaoO+4jyBQVUJMSVNIRUQgSU5ERVBFTkRFTlRMWSBPRiBWQUxVRSBFUVVBTElUWS5cbiAgLy9cbiAgLy8gICAgIFNFTUFOVElDIE1FTUJFUlNISVAgQ0hBTkdFIElTIEFOIE9CU0VSVkFCTEUgU0xPVCBDSEFOR0UgRVZFTiBXSEVOIFRIRVxuICAvLyAgICAgUkVUQUlORUQgVkFMVUUgSVMgSURFTlRJQ0FMLlxuICAvL1xuICAvLyBUaGUgb3JkaW5hcnkgd3JpdGUgcGF0aCBTVVBQUkVTU0VTIGFuIHVuY2hhbmdlZCBjb21taXQg4oCUIGNvcnJlY3RseSwgZm9yIGFcbiAgLy8gdmFsdWUuIEJ1dCByZWludHJvZHVjaW5nIGBhZ2U6IDQyYCBvdmVyIGEgZG9ybWFudCBzbG90IHRoYXQgc3RpbGwgaG9sZHMgNDJcbiAgLy8gY2hhbmdlcyB3aGF0IHRoZSBsZWFmIE9CU0VSVkVTICh1bmRlZmluZWQgLT4gNDIpIHdpdGhvdXQgY2hhbmdpbmcgd2hhdCBpdFxuICAvLyBzdG9yZXMsIHNvIHJvdXRpbmcgbWVtYmVyc2hpcCB0aHJvdWdoIHRoZSB2YWx1ZSBjb21wYXJhdG9yIHdvdWxkIGxlYXZlIGFuXG4gIC8vIGFscmVhZHktc3Vic2NyaWJlZCBjb25zdW1lciBzdHVjayBhdCBgdW5kZWZpbmVkYC5cbiAgLy8g4pqg77iPIEEgQlJBTkNIIE1FTUJFUiBIQVMgTk8gUFVCTElDQVRJT04gVE9LRU4sIHNvIGl0cyBtZW1iZXJzaGlwIHRyYW5zaXRpb24gaXNcbiAgLy8gdW5vYnNlcnZhYmxlIHRocm91Z2ggdGhlIGRlcGVuZGVuY3kgZ3JhcGguXG4gIC8vXG4gIC8vIEEgZG9ybWFudCBMRUFGIGlzIGNhcnJpZWQgYnkgaXRzIHJldGFpbmVkIHBlci1zbG90IHRva2VuOiB0aGUgcGFyZW50J3NcbiAgLy8gZG9ybWFudC1jaGlsZCByZWFkIHJldHVybnMgYSBDSEFOR0VEIHZhbHVlIGFuZCBwcm9wYWdhdGVzLiBBIGRvcm1hbnQgQlJBTkNIXG4gIC8vIHJldHVybnMgYHVuZGVmaW5lZGAgbm93IHRvbywgYnV0IHRoYXQgY2FsbCByZWFkcyBubyBzaWduYWwgd2hvc2UgdmFsdWVcbiAgLy8gY2hhbmdlZCDigJQgdGhlIGNoaWxkJ3Mgb3duIG1lbW8gc3RpbGwgZGVwZW5kcyBvbiB1bmNoYW5nZWQgbGVhZiB0b2tlbnMg4oCUIHNvXG4gIC8vIG5vdGhpbmcgaW52YWxpZGF0ZXMgdGhlIHBhcmVudC4gTWVhc3VyZWQ6IGBkcm9wKClgIGNvcnJlY3RseSBiZWNhbWVcbiAgLy8gYHVuZGVmaW5lZGAgd2hpbGUgYGJveCgpYCBzdGlsbCBsaXN0ZWQgYGRyb3BgLlxuICAvL1xuICAvLyBUaGlzIGlzIHRoZSBTQU1FIHN0cnVjdHVyYWwgY29uZGl0aW9uIGFzIGZpcnN0IGFwcGVhcmFuY2UsIG5vdCBhIGdlbmVyaWNcbiAgLy8gc3RydWN0dXJhbC1lZGl0IGhhbW1lcjpcbiAgLy9cbiAgLy8gICAgIEEgTUVNQkVSU0hJUCBUUkFOU0lUSU9OIFdIT1NFIE1FTUJFUiBDQVJSSUVTIE5PIE9CU0VSVkFCTEUgREVQRU5ERU5DWVxuICAvLyAgICAgTVVTVCBJTlZBTElEQVRFIEFOWSBTTkFQU0hPVCBXSE9TRSBERVBFTkRFTkNZIFNFVCBDT1VMRCBOT1QgUkVGTEVDVCBJVC5cbiAgLy8g4pqg77iPIFRPS0VOTEVTUyBNRUFOUyBOTyBTTE9ULCBOT1QgTk8gUE9TSVRJT04uIEEgYnJhbmNoIG1lbWJlciBET0VTIG93biBhXG4gIC8vIFBvc2l0aW9uSWQg4oCUIGFuIGVhcmxpZXIgdmVyc2lvbiBvZiB0aGlzIGNoZWNrIHRlc3RlZCBmb3Igb25lIGFuZCB0aGVyZWZvcmVcbiAgLy8gbmV2ZXIgZmlyZWQuIFdoYXQgYSBicmFuY2ggbGFja3MgaXMgYSBwZXItc2xvdCBQVUJMSUNBVElPTiBUT0tFTiwgd2hpY2ggaXNcbiAgLy8gd2hhdCB0aGUgZGVwZW5kZW5jeSBncmFwaCBhY3R1YWxseSBjYXJyaWVzLlxuICBpZiAodG9rZW5DYXJyeWluZyA8IGtleXMubGVuZ3RoKSB7XG4gICAgcHVibGlzaE1lbWJlcnNoaXBDaGFuZ2UocGFyZW50KTtcbiAgfSBlbHNlIHtcbiAgICAvLyDimqDvuI8gT1dORVIgSU5WQUxJREFUSU9OIERPRVMgTk9UIERFUEVORCBPTiBXSElDSCBDQVJSSUVSIFdBS0VTIFRIRSBHUkFQSC5cbiAgICAvL1xuICAgIC8vIGBwdWJsaXNoTWVtYmVyc2hpcENoYW5nZWAgYWxzbyBpbnZhbGlkYXRlcyB0aGUgb3duZXIuIFRoaXMgYnJhbmNoIGlzIHRoZVxuICAgIC8vIGNhc2Ugd2hlcmUgaXQgZG9lcyBub3QgcnVuOiBldmVyeSBjaGFuZ2VkIG1lbWJlciBpcyBhIGxlYWYgd2hvc2UgdG9rZW5cbiAgICAvLyBpcyBwdWJsaXNoZWQgYmVsb3cuIEJlZm9yZSB0aGlzIGJyYW5jaCBleGlzdGVkIHRoYXQgd2FzIHRoZSBvcmRpbmFyeVxuICAgIC8vIGNhc2UgdW5kZXIgYHBvc2l0aW9uLXRvcG9sb2d5YCAodHJhbnNhY3Rpb25zLCByZXN0b3JhdGlvbiksIGFuZCB0aGVcbiAgICAvLyBvd25lciB3YXMgbmV2ZXIgdG9sZCDigJQgbWVhc3VyZWQ6IGBwKHsgbmFtZTogJ2EnIH0pYCBvdmVyXG4gICAgLy8gYHsgbmFtZTogJ2EnLCBhZ2U6IDEgfWAgZ2F2ZSAwIGludmFsaWRhdGlvbnMgd2l0aCBlaXRoZXIgZW5oYW5jZXIgYW5kIDFcbiAgICAvLyB3aXRob3V0LCB3aGlsZSBgdHJlZS4kKClgIGFscmVhZHkgcmVhZCB0aGUgcmVtb3ZhbC4gV2l0aG91dCB0aGVcbiAgICAvLyBjYXBhYmlsaXR5IHRoZSBsZWFmIHdhcyBtaXN0YWtlbiBmb3IgdG9rZW5sZXNzLCBzbyB0aGUgYnJhbmNoIGFib3ZlIHJhblxuICAgIC8vIGFuZCBpbnZhbGlkYXRlZCBieSBhY2NpZGVudC5cbiAgICAvL1xuICAgIC8vIFRoZSBjb21taXQgcmV2aXNpb24gaXMgc3RpbGwgTk9UIGFkdmFuY2VkOiBvd25lciBpbnZhbGlkYXRpb24gaXMgYVxuICAgIC8vIHJlcmVhZCByZXF1ZXN0LCBub3QgYSBjb21taXQuIFRoZSBtZW1iZXJzaGlwIHJldmlzaW9uIGlzIG5vdCBidW1wZWRcbiAgICAvLyBlaXRoZXI6IGEgYnJhbmNoIHNuYXBzaG90IHJlLXJlYWRzIGV2ZXJ5IG1lbWJlciBsZWFmLCBzbyB0aGUgbGVhZiB0b2tlbnNcbiAgICAvLyBwdWJsaXNoZWQgYmVsb3cgYXJlIHdoYXQgd2FrZSBpdC4gQSBkb3JtYW50IEJSQU5DSCBtZW1iZXIgaGFzIG5vIHRva2VuIGFuZFxuICAgIC8vIHRha2VzIHRoZSBgcHVibGlzaE1lbWJlcnNoaXBDaGFuZ2VgIHBhdGggYWJvdmUgaW5zdGVhZC5cbiAgICBtYXJrT3duZXJJbnZhbGlkYXRlZEZyb20ocGFyZW50KTtcbiAgfVxuXG4gIGZvciAoY29uc3QgYnJhbmNoIG9mIGJyYW5jaGVzKSBwdWJsaXNoTWVtYmVyc2hpcENoYW5nZShicmFuY2gpO1xuXG4gIGlmIChjaGFuZ2VkU2xvdHMubGVuZ3RoID4gMCkge1xuICAgIC8vIGBhZHZhbmNlUmV2aXNpb25gIGlzIE5PVCB3YW50ZWQ6IG5vdGhpbmcgd2FzIGNvbW1pdHRlZCwgc28gdGhlIHBoeXNpY2FsXG4gICAgLy8gY29tbWl0IGNsb2NrIG11c3Qgbm90IG1vdmUuXG4gICAgcnVudGltZS5wdWJsaXNoUHJlcGFyZWQoeyByZXZpc2lvbjogcnVudGltZS5yZXZpc2lvbigpLCBjaGFuZ2VkU2xvdHMgfSk7XG4gIH1cblxuICBpZiAodW5hZGRyZXNzZWRMZWF2ZXMubGVuZ3RoID4gMCkge1xuICAgIC8vIFRoZSB0cmVlJ3Mgb3duIHJ1bnRpbWUsIHNvIHRoZSBwdWJsaWNhdGlvbiBqb2lucyBpdHMgaW52YWxpZGF0aW9uIGdyb3VwO1xuICAgIC8vIHRoZSBuZXV0cmFsIGZhbGxiYWNrIG1pcnJvcnMgYHB1Ymxpc2hNZW1iZXJzaGlwQ2hhbmdlYC5cbiAgICAoZ2V0TG9jYXRpb25SdW50aW1lKHBhcmVudCkgPz8gTkVVVFJBTF9MT0NBVElPTl9SVU5USU1FKS5wdWJsaXNoKFxuICAgICAgdW5hZGRyZXNzZWRMZWF2ZXNcbiAgICApO1xuICB9XG5cbiAgLy8gVGhlIG5vZGUncyBvd24gc25hcHNob3QgaXMgbWVtb2lzZWQgb3ZlciB0aGUgbWVtYmVycyBpdCBlbnVtZXJhdGVkLCBhbmQgYVxuICAvLyBtZW1iZXJzaGlwIGNoYW5nZSBpcyBpbnZpc2libGUgdG8gdGhhdCBtZW1vIOKAlCBzZWUgcHVibGlzaE1lbWJlcnNoaXBDaGFuZ2UuXG59XG5cbi8qKlxuICogQGludGVybmFsIFJlbW92ZSBga2V5YCBmcm9tIGBwYXJlbnRgJ3MgY3VycmVudCB2YWx1ZS5cbiAqXG4gKiDimqDvuI8gTk8gVkFMVUUgSVMgV1JJVFRFTi4gVGhlIEJSLUEgcHJvYmUgZXhwcmVzc2VkIGFic2VuY2UgYnkgYXNzaWduaW5nXG4gKiBgdW5kZWZpbmVkYCB0byBvbWl0dGVkIGRlc2NlbmRhbnRzIGFuZCBtaXNiZWhhdmVkIHR3aWNlIGZvciBpdCDigJQgYSBzcHVyaW91c1xuICogbXV0YXRpb24gZXZlbnQgcGVyIG9taXR0ZWQga2V5LCBhbmQgdW5rbm93biBrZXlzIGRpc2NhcmRlZCBiZWZvcmUgdGhlXG4gKiB1bmtub3duLWtleSBkaWFnbm9zdGljIGNvdWxkIHNlZSB0aGVtLiBBYnNlbmNlIGlzIGEgbWVtYmVyc2hpcCBjaGFuZ2UsIG5vdCBhXG4gKiB3cml0ZS5cbiAqL1xuZnVuY3Rpb24gZGVhY3RpdmF0ZU9uZShwYXJlbnQ6IG9iamVjdCwga2V5OiBzdHJpbmcpOiBib29sZWFuIHtcbiAgY29uc3QgZGVzY3JpcHRvciA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IocGFyZW50LCBrZXkpO1xuICBpZiAoIWRlc2NyaXB0b3IgfHwgZGVzY3JpcHRvci5lbnVtZXJhYmxlID09PSBmYWxzZSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAoIWRlc2NyaXB0b3IuY29uZmlndXJhYmxlKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHBhcmVudCwga2V5LCB7IC4uLmRlc2NyaXB0b3IsIGVudW1lcmFibGU6IGZhbHNlIH0pO1xuICBtZW1iZXJzaGlwRXBvY2grKztcbiAgbWFya0hhc0Rvcm1hbnQocGFyZW50KTtcbiAgLy8gQW4gb21pc3Npb24gaXMgd2hhdCBpbnN0YWxscyBsaXZlbmVzcyBvbiB0aGUgdHJlZSdzIGxlYXZlcy5cbiAgY29uc3QgcnVudGltZSA9IGdldFRyZWVTY2FsYXJTbG90UnVudGltZShwYXJlbnQpO1xuICBpZiAocnVudGltZSkge1xuICAgIG9taXR0ZWRNZW1iZXJzLnNldChydW50aW1lLCAob21pdHRlZE1lbWJlcnMuZ2V0KHJ1bnRpbWUpID8/IDApICsgMSk7XG4gICAgcnVudGltZS5lbmFibGVBYnNlbmNlPy4oQUJTRU5DRSk7XG4gIH1cbiAgY29uc3QgY2hpbGQgPSAocGFyZW50IGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+KVtrZXldO1xuICBpZiAoaXNUcmF2ZXJzYWJsZU5vZGUoY2hpbGQpKSB7XG4gICAgbGlua01lbWJlcihwYXJlbnQsIGtleSwgY2hpbGQpO1xuICAgIGxpbmtEZXNjZW5kYW50cyhjaGlsZCk7XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbi8qKlxuICogVGhlIGxpbmsgbmFtZXMgdGhlIHBhcmVudCdzIGFjY2Vzc29yIGhhbGYsIHRoZSBvbmUgaXRzIG93biBwYXJlbnQncyBsaW5rXG4gKiBuYW1lcyBpbiB0dXJuLCBzbyBhIHdhbGsgZm9sbG93cyBsaW5rcyB3aXRob3V0IHJlc29sdmluZyBwZWVycy5cbiAqL1xuZnVuY3Rpb24gbGlua01lbWJlcihwYXJlbnQ6IG9iamVjdCwga2V5OiBzdHJpbmcsIGNoaWxkOiBvYmplY3QpOiB2b2lkIHtcbiAgLy8gQSBuZXcgbGluayBsZW5ndGhlbnMgYSB3YWxrIGBpc0Fic2VudE1lbWJlcmAgbWF5IGhhdmUgY2FjaGVkLlxuICBtZW1iZXJzaGlwRXBvY2grKztcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGNoaWxkLCBET1JNQU5ULCB7XG4gICAgdmFsdWU6IHtcbiAgICAgIHBhcmVudDogbm9kZU9mKHBhcmVudCksXG4gICAgICBrZXksXG4gICAgICBlcG9jaDogMCxcbiAgICAgIGFic2VudDogZmFsc2UsXG4gICAgfSBzYXRpc2ZpZXMgRG9ybWFudEJpbmRpbmcsXG4gICAgZW51bWVyYWJsZTogZmFsc2UsXG4gICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgIHdyaXRhYmxlOiB0cnVlLFxuICB9KTtcbn1cblxuLyoqXG4gKiBMaW5rIGV2ZXJ5IHN0YXRlIGxvY2F0aW9uIGJlbG93IGEgbmV3bHkgb21pdHRlZCBtZW1iZXIgdG8gaXRzIHBhcmVudCwgb25jZSxcbiAqIHNvIGEgbG9jYXRpb24gdW5kZXIgaXQgY2FuIGZpbmQgdGhlIG9taXNzaW9uIChgaXNBYnNlbnRNZW1iZXJgKS4gQSBsaW5rZWRcbiAqIGxvY2F0aW9uJ3Mgb3duIHN1YnRyZWUgd2FzIGxpbmtlZCB3aGVuIGl0IHdhcywgc28gaXQgaXMgbm90IHdhbGtlZCBhZ2Fpbi5cbiAqIEFuIGVudGl0eSBjb2xsZWN0aW9uIGlzIGxpbmtlZCBzbyBpdCBjYW4gcmVhZCBhYnNlbnQgKHYxNiA4ZSksIGJ1dCBub3RcbiAqIGVudGVyZWQ6IGl0cyByb3dzIGFyZSBpdHMgb3duIHN0YXRlLiBPdGhlciBtYXJrZXJzIGFyZSBsZWZ0IGFsb25lLlxuICovXG5mdW5jdGlvbiBsaW5rRGVzY2VuZGFudHMobm9kZTogb2JqZWN0KTogdm9pZCB7XG4gIGlmICghaXNOb2RlQWNjZXNzb3Iobm9kZSkpIHJldHVybjtcbiAgZm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMobm9kZSkpIHtcbiAgICBjb25zdCBjaGlsZCA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3Iobm9kZSwga2V5KT8udmFsdWU7XG4gICAgaWYgKFxuICAgICAgKCFpc05vZGVBY2Nlc3NvcihjaGlsZCkgJiZcbiAgICAgICAgIWlzV3JpdGFibGVMb2NhdGlvbihjaGlsZCkgJiZcbiAgICAgICAgIW1lbWJlcnNoaXBIb29rKGNoaWxkKSkgfHxcbiAgICAgIG1lbWJlckJpbmRpbmcoY2hpbGQpXG4gICAgKVxuICAgICAgY29udGludWU7XG4gICAgbGlua01lbWJlcihub2RlLCBrZXksIGNoaWxkIGFzIG9iamVjdCk7XG4gICAgbGlua0Rlc2NlbmRhbnRzKGNoaWxkIGFzIG9iamVjdCk7XG4gIH1cbn1cblxuLyoqXG4gKiBAaW50ZXJuYWwgTGluayBhIG1lbWJlciBhZGRlZCBhZnRlciBjb25zdHJ1Y3Rpb24gd2hlbiBpdHMgYnJhbmNoIGlzIGFscmVhZHlcbiAqIGxpbmtlZCwgc28gYSBsYXRlciBvbWlzc2lvbiBhYm92ZSBpdCBpcyB2aXNpYmxlIHRvIGl0LlxuICovXG5leHBvcnQgZnVuY3Rpb24gbGlua0FkZGVkTWVtYmVyKFxuICBicmFuY2g6IG9iamVjdCxcbiAga2V5OiBzdHJpbmcsXG4gIGNoaWxkOiB1bmtub3duXG4pOiB2b2lkIHtcbiAgaWYgKCFpc1RyYXZlcnNhYmxlTm9kZShjaGlsZCkgfHwgIW1lbWJlckJpbmRpbmcobm9kZU9mKGJyYW5jaCkpKSByZXR1cm47XG4gIGxpbmtNZW1iZXIoYnJhbmNoLCBrZXksIGNoaWxkKTtcbiAgbGlua0Rlc2NlbmRhbnRzKGNoaWxkKTtcbn1cblxuLyoqXG4gKiBAaW50ZXJuYWwgUmVzdG9yZSBga2V5YCB0byBgcGFyZW50YCdzIGN1cnJlbnQgdmFsdWUuXG4gKlxuICogICAgIE1FTUJFUlNISVAgQUNUSVZBVElPTiBJUyBORVZFUiBBIFNUQU5EQUxPTkUgT1BFUkFUSU9OLlxuICogICAgIElUIE1VU1QgQkUgQ09VUExFRCBUTyBBTiBBVVRIT1JJVEFUSVZFIFNVUFBMSUVEIFZBTFVFLlxuICpcbiAqIOKaoO+4jyBDQUxMIFRISVMgT05MWSBBRlRFUiBUSEUgU1VQUExJRUQgVkFMVUUgSEFTIEJFRU4gSU5TVEFMTEVELiBCYXJlXG4gKiByZS1lbnVtZXJhdGlvbiBleHBvc2VzIHdoYXRldmVyIHRoZSBkb3JtYW50IHNsb3Qgc3RpbGwgaG9sZHMg4oCUIG1lYXN1cmVkOiBhXG4gKiBsZWFmIGRvcm1hbnQgYXQgNDIgcmVhZHMgNDIgYWdhaW4gdGhlIGluc3RhbnQgaXQgaXMgcmUtZW51bWVyYXRlZCwgd2l0aFxuICogbm90aGluZyBoYXZpbmcgc3VwcGxpZWQgaXQuIFRoZXJlIGFyZSBleGFjdGx5IHR3byBhZG1pc3NpYmxlIGNhbGxlcnMsIGFuZCBib3RoXG4gKiBpbnN0YWxsIGZpcnN0OlxuICpcbiAqICAgcmVjdXJzaXZlVXBkYXRlICAgICAgICB0aGUgc3VwcGxpZWQta2V5IGxvb3AgaGFzIGFscmVhZHkgd3JpdHRlbiB0aGUgdmFsdWVcbiAqICAgcmVhY3RpdmF0ZVBhdGhPbldyaXRlICB0aGUgbG9jYXRpb24ncyBvd24gd3JpdGUgaXMgdGhlIHN1cHBsaWVkIHZhbHVlXG4gKlxuICogRG8gbm90IGFkZCBhIHRoaXJkIHdpdGhvdXQgYW4gYXV0aG9yaXRhdGl2ZSB2YWx1ZSB0byBjb3VwbGUgaXQgdG8uXG4gKi9cbmZ1bmN0aW9uIGFjdGl2YXRlT25lKHBhcmVudDogb2JqZWN0LCBrZXk6IHN0cmluZyk6IGJvb2xlYW4ge1xuICBjb25zdCBkZXNjcmlwdG9yID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihwYXJlbnQsIGtleSk7XG4gIGlmICghZGVzY3JpcHRvciB8fCBkZXNjcmlwdG9yLmVudW1lcmFibGUgPT09IHRydWUpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKCFkZXNjcmlwdG9yLmNvbmZpZ3VyYWJsZSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShwYXJlbnQsIGtleSwgeyAuLi5kZXNjcmlwdG9yLCBlbnVtZXJhYmxlOiB0cnVlIH0pO1xuICBtZW1iZXJzaGlwRXBvY2grKztcbiAgY29uc3QgcnVudGltZSA9IGdldFRyZWVTY2FsYXJTbG90UnVudGltZShwYXJlbnQpO1xuICBjb25zdCBvbWl0dGVkID0gcnVudGltZSA/IG9taXR0ZWRNZW1iZXJzLmdldChydW50aW1lKSA6IHVuZGVmaW5lZDtcbiAgaWYgKHJ1bnRpbWUgJiYgb21pdHRlZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgb21pdHRlZE1lbWJlcnMuc2V0KHJ1bnRpbWUsIG9taXR0ZWQgLSAxKTtcbiAgICBpZiAob21pdHRlZCA9PT0gMSAmJiAhb3JkaW5hcnlEaXZlcmdlbmNlcy5nZXQocnVudGltZSkpXG4gICAgICBydW50aW1lLmRpc2FibGVBYnNlbmNlPy4oKTtcbiAgfVxuICAvLyDimqDvuI8gVGhlIGJpbmRpbmcgaXMgTk9UIGNsZWFyZWQuIEl0IGxvY2F0ZXMgdGhlIGRlc2NyaXB0b3I7IGl0IGlzIG5vdCBhXG4gIC8vIGRvcm1hbmN5IGZsYWcuIENsZWFyaW5nIGl0IGhlcmUgd291bGQgbWFrZSBcImhhcyBhIGJpbmRpbmdcIiBtZWFuIFwiaXNcbiAgLy8gZG9ybWFudFwiLCB3aGljaCBpcyBleGFjdGx5IHRoZSBzZWNvbmQgbWVtYmVyc2hpcCB0cnV0aCB0aGlzIGRlc2lnbiBmb3JiaWRzLlxuICByZXR1cm4gdHJ1ZTtcbn1cblxuLyoqXG4gKiBIaW50IG9ubHkuIEFuc3dlcnMgXCJkb2VzIHRoaXMgYnJhbmNoIGhhdmUgQU5ZIGRvcm1hbnQgbWVtYmVyXCIsIG5ldmVyIFwiaXMgWCBhXG4gKiBtZW1iZXJcIiDigJQgZW51bWVyYWJpbGl0eSBhbG9uZSBhbnN3ZXJzIHRoYXQuIEEgc3RhbGUgaGludCBjb3N0cyBvbmUgaGFybWxlc3NcbiAqIGV4dHJhIHdhbGs7IGl0IGNhbiBuZXZlciBjb250cmFkaWN0IHRoZSBhdXRob3JpdHkuXG4gKi9cbmNvbnN0IEhBU19ET1JNQU5UID0gU3ltYm9sLmZvcignU2lnbmFsVHJlZTpIYXNEb3JtYW50TWVtYmVycycpO1xuXG4vKiogQGludGVybmFsIENoZWFwIGNoZWNrIHNvIGFuIG9yZGluYXJ5IGJyYW5jaCByZWFkIHBheXMgb25lIHByb3BlcnR5IGxvb2t1cC4gKi9cbmV4cG9ydCBmdW5jdGlvbiBoYXNEb3JtYW50TWVtYmVycyhwYXJlbnQ6IG9iamVjdCk6IGJvb2xlYW4ge1xuICByZXR1cm4gKHBhcmVudCBhcyBSZWNvcmQ8c3ltYm9sLCB1bmtub3duPilbSEFTX0RPUk1BTlRdID09PSB0cnVlO1xufVxuXG5mdW5jdGlvbiBtYXJrSGFzRG9ybWFudChwYXJlbnQ6IG9iamVjdCk6IHZvaWQge1xuICBpZiAoaGFzRG9ybWFudE1lbWJlcnMocGFyZW50KSkgcmV0dXJuO1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkocGFyZW50LCBIQVNfRE9STUFOVCwge1xuICAgIHZhbHVlOiB0cnVlLFxuICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICB3cml0YWJsZTogdHJ1ZSxcbiAgfSk7XG59XG5cbi8qKiBAaW50ZXJuYWwgT3duIGtleXMgb2YgYHBhcmVudGAgdGhhdCBhcmUgTk9UIGN1cnJlbnQgbWVtYmVycy4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkb3JtYW50S2V5cyhwYXJlbnQ6IG9iamVjdCk6IHN0cmluZ1tdIHtcbiAgcmV0dXJuIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHBhcmVudCkuZmlsdGVyKChrZXkpID0+IHtcbiAgICBjb25zdCBkID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihwYXJlbnQsIGtleSk7XG4gICAgcmV0dXJuIGQgIT09IHVuZGVmaW5lZCAmJiBkLmVudW1lcmFibGUgPT09IGZhbHNlICYmICd2YWx1ZScgaW4gZDtcbiAgfSk7XG59XG5cbi8qKiBSZXNvbHZlIHRoZSBvdGhlciBwaHlzaWNhbCBoYWxmIG9mIGEgYnJhbmNoLCBmcm9tIGVpdGhlciBzaWRlLiAqL1xuZnVuY3Rpb24gcGVlck9mKGJyYW5jaDogb2JqZWN0KTogb2JqZWN0IHwgdW5kZWZpbmVkIHtcbiAgY29uc3QgcmVjb3JkID0gYnJhbmNoIGFzIFJlY29yZDxzeW1ib2wsIHVua25vd24+O1xuICBjb25zdCBwZWVyID0gcmVjb3JkW05PREVfU1RPUkVfU1lNQk9MXSA/PyByZWNvcmRbTk9ERV9BQ0NFU1NPUl9QRUVSXTtcbiAgLy8g4pqg77iPIGBpc1RyYXZlcnNhYmxlTm9kZWAsIE5PVCBgdHlwZW9mIHBlZXIgPT09ICdvYmplY3QnYC4gQSBOb2RlQWNjZXNzb3IgaXNcbiAgLy8gQ0FMTEFCTEUsIHNvIHRoZSBvYmplY3Qtb25seSB0ZXN0IHNpbGVudGx5IGRpc2NhcmRlZCBldmVyeSBhY2Nlc3NvciBwZWVyOlxuICAvLyB0aGUgaGVscGVyIHJlc29sdmVkIHN0b3JlLT5hY2Nlc3NvciB0byBgdW5kZWZpbmVkYCBhbmQgY29udmVyZ2VkIG5vdGhpbmdcbiAgLy8gd2hpbGUgc3RpbGwgcmVwb3J0aW5nIGBjaGFuZ2VkID09PSB0cnVlYCBmcm9tIHRoZSBzdG9yZSBzaWRlLiBUaGF0IGlzIHRoZVxuICAvLyBwcmVjaXNlIGZhaWx1cmUgdGhlIHJlcG8ncyBuby1oYW5kLXJvbGxlZC13YWxrZXItZ3VhcmQgbGludCBydWxlIGV4aXN0cyB0b1xuICAvLyBwcmV2ZW50LCBhbmQgd3JpdGluZyBvbmUgaGVyZSByZXByb2R1Y2VkIGl0IGluc2lkZSB0aGUgdmVyeSBoZWxwZXIgbWVhbnQgdG9cbiAgLy8gbWFrZSB0aGlzIGNsYXNzIG9mIGJ1ZyBzdHJ1Y3R1cmFsLlxuICByZXR1cm4gaXNUcmF2ZXJzYWJsZU5vZGUocGVlcikgJiYgcGVlciAhPT0gYnJhbmNoXG4gICAgPyAocGVlciBhcyBvYmplY3QpXG4gICAgOiB1bmRlZmluZWQ7XG59XG5cbi8qKiBAaW50ZXJuYWwgKi9cbmV4cG9ydCB0eXBlIE1lbWJlclByZXNlbmNlID0gJ2FjdGl2ZScgfCAnZG9ybWFudCc7XG5cbi8qKlxuICogQGludGVybmFsIFNldCB3aGV0aGVyIGBrZXlgIGlzIGEgbWVtYmVyIG9mIGBicmFuY2hgLCBPTiBCT1RIIFBIWVNJQ0FMIEhBTFZFUy5cbiAqXG4gKiAgICAgQUNDRVNTT1IvU1RPUkUgQ09IRVJFTkNFIE1VU1QgSEFWRSBPTkUgTVVUQVRJT04gT1dORVIuXG4gKlxuICog4pqg77iPIFRISVMgRVhJU1RTIEJFQ0FVU0UgVEhFIFNQTElUIEJJVCBUSFJFRSBUSU1FUy4gRmlyc3QgYXBwZWFyYW5jZSBoYWQgdG9cbiAqIGRlZmluZSBib3RoOyBkeW5hbWljIHJlYWNxdWlzaXRpb24gaGFkIHRvIGFjdGl2YXRlIGJvdGg7IGFuZCBhIG1lYXN1cmVtZW50XG4gKiB0YWtlbiB3aGlsZSBleHRyYWN0aW5nIHRoaXMgaGVscGVyIGZvdW5kIHRoZSB0aGlyZCBhbmQgd29yc3QgY2FzZSDigJQgTk9cbiAqIGRlYWN0aXZhdGlvbiBwYXRoIGhhZCBldmVyIHRvdWNoZWQgdGhlIGFjY2Vzc29yIGF0IGFsbC4gQWZ0ZXJcbiAqIGB1c2VyKHtuYW1lOiAnQSd9KWAgcmVtb3ZlZCBgYWdlYCwgdGhlIHNuYXBzaG90IGNvcnJlY3RseSBzYWlkIGBbXCJuYW1lXCJdYFxuICogd2hpbGUgYE9iamVjdC5rZXlzKCQudXNlcilgIGFuZCBgey4uLiQudXNlcn1gIGJvdGggc3RpbGwgc2FpZFxuICogYFtcImFnZVwiLFwibmFtZVwiXWAuIFRoYXQgaXMgdGhlIHNlY29uZCBvYnNlcnZhYmxlIHN0YXRlIHRoZSBhcmNoaXRlY3R1cmVcbiAqIGZvcmJpZHM6IFBIWVNJQ0FMIFJFVEVOVElPTiBNVVNUIE5PVCBDUkVBVEUgQSBTRUNPTkQgT0JTRVJWQUJMRSBTVEFURS5cbiAqXG4gKiBUaGUgY2FsbGVycyB3ZXJlIG5vdCBjYXJlbGVzcy4gRWFjaCBoZWxkIHdoaWNoZXZlciBoYWxmIHdhcyBuYXR1cmFsIGF0IGl0c1xuICogb3duIHNpdGUg4oCUIGByZWN1cnNpdmVVcGRhdGVgIHJlY29uY2lsZXMgb3ZlciB0aGUgc3RvcmUsIGR5bmFtaWMgcmVhY3F1aXNpdGlvblxuICogYXJyaXZlcyBhdCB0aGUgYWNjZXNzb3Ig4oCUIGFuZCBcInJlbWVtYmVyIHRvIGFsc28gdXBkYXRlIHRoZSBvdGhlciBvbmVcIiBpcyBub3RcbiAqIGEgcHJvcGVydHkgYSBjYWxsIHNpdGUgY2FuIGJlIHRydXN0ZWQgdG8gY2FycnkuIFNvIHRoZSBoZWxwZXIgcmVzb2x2ZXMgdGhlXG4gKiBwZWVyIGl0c2VsZiwgaW4gZWl0aGVyIGRpcmVjdGlvbiwgYW5kIHRoZSBzaW5nbGUtb2JqZWN0IHByaW1pdGl2ZXMgYXJlIG5vXG4gKiBsb25nZXIgZXhwb3J0ZWQ6IGBhY3RpdmF0ZU1lbWJlcihhY2Nlc3Nvciwga2V5KWAgY29tcGlsZXMsIGxvb2tzIHBsYXVzaWJsZSxcbiAqIGFuZCBpcyBzZW1hbnRpY2FsbHkgaW5jb21wbGV0ZSwgc28gaXQgbXVzdCBub3QgYmUgcmVhY2hhYmxlLlxuICpcbiAqIEVudW1lcmFiaWxpdHkgcmVtYWlucyBwaHlzaWNhbCBhdXRob3JpdHkgb24gYm90aCBoYWx2ZXMuIE9yZGluYXJ5IHByZXNlbmNlXG4gKiBpcyBwcmVwYXJlZCBzZXBhcmF0ZWx5LCBzbyBpbnNwZWN0aW9uLW9ubHkgYWN0aXZhdGlvbiBjYW5ub3QgZXJhc2UgdGhlXG4gKiBvcmRpbmFyeSBhYnNlbmNlIG5lZWRlZCBieSBjYXB0dXJlIGFuZCBpbnZlcnNlIHJlYWxpemF0aW9uLiBUaGUgc291cmNlIGFuZFxuICogbWluaW11bSByZXNwb25zaWJpbGl0eSBpbnN0YWxsIGJlZm9yZSBwdWJsaWNhdGlvbiBjYWxsYmFja3MgY2FuIHJ1bi5cbiAqXG4gKiBAcmV0dXJucyB3aGV0aGVyIG1lbWJlcnNoaXAgYWN0dWFsbHkgY2hhbmdlZCDigJQgT05FIHNlbWFudGljIHJlc3VsdCBmb3IgdGhlXG4gKiBwYWlyLCB0cnVlIGlmIGVpdGhlciBoYWxmIG1vdmVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gc2V0TWVtYmVyUHJlc2VuY2UoXG4gIGJyYW5jaDogb2JqZWN0LFxuICBrZXk6IHN0cmluZyxcbiAgcHJlc2VuY2U6IE1lbWJlclByZXNlbmNlXG4pOiBib29sZWFuIHtcbiAgY29uc3QgYXBwbHkgPSBwcmVzZW5jZSA9PT0gJ2FjdGl2ZScgPyBhY3RpdmF0ZU9uZSA6IGRlYWN0aXZhdGVPbmU7XG4gIGNvbnN0IHBhcmVudCA9IG5vZGVPZihicmFuY2gpLFxuICAgIGRlc2NyaXB0b3IgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHBhcmVudCwga2V5KSxcbiAgICBwZWVyID0gcGVlck9mKGJyYW5jaCk7XG4gIGNvbnN0IGNoaWxkID0gZGVzY3JpcHRvcj8udmFsdWU7XG4gIGlmICghZGVzY3JpcHRvciB8fCAhZGVzY3JpcHRvci5jb25maWd1cmFibGUgfHwgIWlzVHJhdmVyc2FibGVOb2RlKGNoaWxkKSkge1xuICAgIGxldCBjaGFuZ2VkID0gYXBwbHkoYnJhbmNoLCBrZXkpO1xuICAgIGlmIChwZWVyKSBjaGFuZ2VkID0gYXBwbHkocGVlciwga2V5KSB8fCBjaGFuZ2VkO1xuICAgIHJldHVybiBjaGFuZ2VkO1xuICB9XG4gIGNvbnN0IHBoeXNpY2FsQmVmb3JlID0gZGVzY3JpcHRvci5lbnVtZXJhYmxlID09PSB0cnVlLFxuICAgIHByZXNlbnQgPSBwcmVzZW5jZSA9PT0gJ2FjdGl2ZSc7XG4gIGNvbnN0IHByZXZpb3VzID0gb3JkaW5hcnlQcmVzZW5jZVNvdXJjZXMuZ2V0KHBhcmVudCksXG4gICAgc291cmNlID0gcHJldmlvdXMgPz8gbmV3IE9yZGluYXJ5TWVtYmVyUHJlc2VuY2VTb3VyY2UoKTtcbiAgY29uc3QgZWRpdCA9IHNvdXJjZS5wcmVwYXJlKFxuICAgIGtleSxcbiAgICBjaGlsZCxcbiAgICBwaHlzaWNhbEJlZm9yZSxcbiAgICBwcmVzZW50LFxuICAgIGdldEFjdGl2ZVdyaXRlQ29udGV4dCgpPy5wYXJ0aWNpcGF0aW9uID09PSAnaW5zcGVjdGlvbidcbiAgKTtcbiAgY29uc3QgZXBvY2ggPSBtZW1iZXJzaGlwRXBvY2g7XG4gIGNvbnN0IHJlc3BvbnNpYmlsaXR5ID1cbiAgICBlZGl0LmJlZm9yZSAhPT0gZWRpdC5hZnRlclxuICAgICAgPyBnZXRNdXRhdGlvbkNhcHR1cmVSdW50aW1lKHBhcmVudCk/LnByZXBhcmVNZW1iZXJSZXNwb25zaWJpbGl0eT8uKFxuICAgICAgICAgIHBhcmVudCxcbiAgICAgICAgICBrZXksXG4gICAgICAgICAgY2hpbGQsXG4gICAgICAgICAgeyBiZWZvcmU6IGVkaXQuYmVmb3JlLCBhZnRlcjogZWRpdC5hZnRlciB9XG4gICAgICAgIClcbiAgICAgIDogdW5kZWZpbmVkO1xuICBjb25zdCBwcmVwYXJlID0gbWVtYmVyc2hpcFB1YmxpY2F0aW9uUHJlcGFyZXI7XG4gIGNvbnN0IHJlZ2lzdHJ5ID0gcHJlcGFyZSA/IGdldFBvc2l0aW9uUmVnaXN0cnkocGFyZW50KSA6IHVuZGVmaW5lZDtcbiAgY29uc3QgYWRkcmVzcyA9IHJlZ2lzdHJ5ID8gZ2V0Tm9kZUFkZHJlc3MocGFyZW50KSA6IHVuZGVmaW5lZDtcbiAgLy8gQSBjb2xkIHJlbGF0aW9uc2hpcCBtYXkgaGF2ZSBubyBlbGlnaWJsZSBjaGlsZCBwYXlsb2FkIHRvIHVubWFzay4gQ2FycnlcbiAgLy8gdGhlIHNlbGVjdGVkIG5hdGl2ZSBvcmRpbmFyeSB2YWx1ZSwgbm90IGEgbGF0ZXIgcGh5c2ljYWwgY2hpbGQgcmVhZC5cbiAgY29uc3Qgb3JkaW5hcnkgPVxuICAgIHByZXBhcmUgJiYgcmVnaXN0cnkgJiYgYWRkcmVzcyAmJlxuICAgIChlZGl0LmJlZm9yZSAhPT0gZWRpdC5hZnRlciB8fFxuICAgICAgKCFwaHlzaWNhbEJlZm9yZSAmJiBwcmVzZW50ICYmIGdldEFjdGl2ZVdyaXRlQ29udGV4dCgpPy5wYXJ0aWNpcGF0aW9uICE9PSAnaW5zcGVjdGlvbicpKVxuICAgICAgPyBPYmplY3QuZnJlZXplKHtcbiAgICAgICAgICBiZWZvcmU6IGVkaXQuYmVmb3JlXG4gICAgICAgICAgICA/IE9iamVjdC5mcmVlemUoeyBwcmVzZW50OiB0cnVlIGFzIGNvbnN0LCB2YWx1ZTogb3JkaW5hcnlNZW1iZXJTbmFwc2hvdChjaGlsZCkgfSlcbiAgICAgICAgICAgIDogT2JqZWN0LmZyZWV6ZSh7IHByZXNlbnQ6IGZhbHNlIGFzIGNvbnN0IH0pLFxuICAgICAgICAgIGFmdGVyOiBlZGl0LmFmdGVyXG4gICAgICAgICAgICA/IE9iamVjdC5mcmVlemUoeyBwcmVzZW50OiB0cnVlIGFzIGNvbnN0LCB2YWx1ZTogb3JkaW5hcnlNZW1iZXJTbmFwc2hvdChjaGlsZCkgfSlcbiAgICAgICAgICAgIDogT2JqZWN0LmZyZWV6ZSh7IHByZXNlbnQ6IGZhbHNlIGFzIGNvbnN0IH0pLFxuICAgICAgICB9KVxuICAgICAgOiB1bmRlZmluZWQ7XG4gIGNvbnN0IHVuaXQgPVxuICAgIHByZXBhcmUgJiYgcmVnaXN0cnkgJiYgYWRkcmVzc1xuICAgICAgPyBwcmVwYXJlKHsgcmVnaXN0cnksIGJyYW5jaDogcGFyZW50LCBhZGRyZXNzLCBrZXksIGNoaWxkLCBwcmVzZW50LCBvcmRpbmFyeSB9KVxuICAgICAgOiB1bmRlZmluZWQ7XG4gIGlmIChcbiAgICBtZW1iZXJzaGlwRXBvY2ggIT09IGVwb2NoIHx8XG4gICAgb3JkaW5hcnlQcmVzZW5jZVNvdXJjZXMuZ2V0KHBhcmVudCkgIT09IHByZXZpb3VzIHx8XG4gICAgT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihwYXJlbnQsIGtleSk/LnZhbHVlICE9PSBjaGlsZFxuICApXG4gICAgdGhyb3cgbmV3IEVycm9yKCdNZW1iZXJzaGlwIHByZXBhcmF0aW9uIHJlZW50ZXJlZCBpbnN0YWxsYXRpb24nKTtcbiAgc291cmNlLnZhbGlkYXRlKGVkaXQpO1xuICBjb25zdCByZWNvcmRzID0gY29tYmluZVRlcm1pbmFsUmVjb3JkcyhyZXNwb25zaWJpbGl0eSwgdW5pdD8ucmVjb3JkKTtcbiAgbGV0IGZhaWxlZCA9IGZhbHNlO1xuICB0cnkge1xuICAgIGNvbnN0IGRlbHRhID0gc291cmNlLmluc3RhbGwoZWRpdCk7XG4gICAgaWYgKCFwcmV2aW91cyAmJiAoZWRpdC5iZWZvcmUgIT09IGVkaXQuYWZ0ZXIgfHwgcGh5c2ljYWxCZWZvcmUgIT09IHByZXNlbnQpKVxuICAgICAgb3JkaW5hcnlQcmVzZW5jZVNvdXJjZXMuc2V0KHBhcmVudCwgc291cmNlKTtcbiAgICBjb25zdCBydW50aW1lID0gZ2V0VHJlZVNjYWxhclNsb3RSdW50aW1lKHBhcmVudCk7XG4gICAgaWYgKHJ1bnRpbWUgJiYgZGVsdGEpXG4gICAgICBvcmRpbmFyeURpdmVyZ2VuY2VzLnNldChcbiAgICAgICAgcnVudGltZSxcbiAgICAgICAgKG9yZGluYXJ5RGl2ZXJnZW5jZXMuZ2V0KHJ1bnRpbWUpID8/IDApICsgZGVsdGFcbiAgICAgICk7XG4gICAgbGV0IGNoYW5nZWQgPSBhcHBseShicmFuY2gsIGtleSk7XG4gICAgaWYgKHBlZXIpIGNoYW5nZWQgPSBhcHBseShwZWVyLCBrZXkpIHx8IGNoYW5nZWQ7XG4gICAgaWYgKHJlY29yZHMpIGluc3RhbGxUZXJtaW5hbFJlY29yZChyZWNvcmRzKTtcbiAgICBpZiAocnVudGltZSkge1xuICAgICAgaWYgKG9yZGluYXJ5RGl2ZXJnZW5jZXMuZ2V0KHJ1bnRpbWUpKSBydW50aW1lLmVuYWJsZUFic2VuY2U/LihBQlNFTkNFKTtcbiAgICAgIGVsc2UgaWYgKCFvbWl0dGVkTWVtYmVycy5nZXQocnVudGltZSkpIHJ1bnRpbWUuZGlzYWJsZUFic2VuY2U/LigpO1xuICAgIH1cbiAgICBpZiAoY2hhbmdlZCkge1xuICAgICAgbWFya1NuYXBzaG90SW5zdGFsbGVkKHBhcmVudCk7XG4gICAgICAvLyBBIGhlbGQgZGVzY2VuZGFudCBjYW4gaGF2ZSBhIGNhY2hlZCB2YWx1ZSBldmVuIHdpdGhvdXQgYSBkZW1hbmRlZCBwYXJlbnQuXG4gICAgICBjb25zdCB2aXNpdGVkID0gbmV3IFNldDxvYmplY3Q+KCk7XG4gICAgICBjb25zdCBtYXJrID0gKG5vZGU6IHVua25vd24sIGVmZmVjdGl2ZUNoYW5nZWQ6IGJvb2xlYW4pOiB2b2lkID0+IHtcbiAgICAgICAgaWYgKCFpc1RyYXZlcnNhYmxlTm9kZShub2RlKSB8fCB2aXNpdGVkLmhhcyhub2RlKSkgcmV0dXJuO1xuICAgICAgICB2aXNpdGVkLmFkZChub2RlKTtcbiAgICAgICAgLy8gQSBwcmVzZW5jZS1hd2FyZSBtYXJrZXIgaXMgb3BhcXVlLiBJbnZhbGlkYXRlIG9ubHkgaXRzIGV4aXN0aW5nXG4gICAgICAgIC8vIHdyYXBwZXIsIG5ldmVyIGl0cyBwYXlsb2FkIG9yIGl0cyBuYXRpdmUgbWVtYmVyc2hpcCBub3RpZmljYXRpb24uXG4gICAgICAgIGlmIChtZW1iZXJzaGlwSG9vayhub2RlKSkge1xuICAgICAgICAgIGlmIChlZmZlY3RpdmVDaGFuZ2VkKSBtYXJrU25hcHNob3RJbnN0YWxsZWQobm9kZSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmICghaXNOb2RlQWNjZXNzb3Iobm9kZSkpIHJldHVybjtcbiAgICAgICAgbWFya1NuYXBzaG90SW5zdGFsbGVkKG5vZGUpO1xuICAgICAgICBmb3IgKGNvbnN0IGtleSBvZiBSZWZsZWN0Lm93bktleXMobm9kZSkpIHtcbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICBrZXkgPT09ICdjYWxsZXInIHx8IGtleSA9PT0gJ2FyZ3VtZW50cycgfHxcbiAgICAgICAgICAgIGtleSA9PT0gTk9ERV9TVE9SRV9TWU1CT0wgfHwga2V5ID09PSBOT0RFX0FDQ0VTU09SX1BFRVJcbiAgICAgICAgICApIGNvbnRpbnVlO1xuICAgICAgICAgIGNvbnN0IGRlc2NyaXB0b3IgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKG5vZGUsIGtleSk7XG4gICAgICAgICAgaWYgKGRlc2NyaXB0b3IgJiYgJ3ZhbHVlJyBpbiBkZXNjcmlwdG9yKVxuICAgICAgICAgICAgbWFyayhcbiAgICAgICAgICAgICAgZGVzY3JpcHRvci52YWx1ZSxcbiAgICAgICAgICAgICAgZWZmZWN0aXZlQ2hhbmdlZCAmJiBkZXNjcmlwdG9yLmVudW1lcmFibGUgPT09IHRydWVcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICAvLyBBbiBpbmRlcGVuZGVudGx5IG9taXR0ZWQgZWRnZSBrZWVwcyBkZXNjZW5kYW50cyBlZmZlY3RpdmVseSBhYnNlbnQuXG4gICAgICBtYXJrKGNoaWxkLCAhaXNBYnNlbnRNZW1iZXIocGFyZW50KSk7XG4gICAgfVxuICAgIHJldHVybiBjaGFuZ2VkO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGZhaWxlZCA9IHRydWU7XG4gICAgdGhyb3cgZXJyb3I7XG4gIH0gZmluYWxseSB7XG4gICAgaWYgKHVuaXQpXG4gICAgICB0cnkge1xuICAgICAgICBjb21wbGV0ZVByZXBhcmVkUHVibGljYXRpb24odW5pdC5jb21wbGV0aW9uKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGlmICghZmFpbGVkKSB0aHJvdyBlcnJvcjtcbiAgICAgICAgcmVwb3J0Q29udGFpbmVkT2JzZXJ2ZXJFcnJvcih7IGVycm9yLCBvcGVyYXRpb246ICdub3RpZnk6c3Vic2NyaWJlcicgfSk7XG4gICAgICB9XG4gIH1cbn1cblxuLyoqIFByZXBhcmUgdGhlIG9yZGluYXJ5IGV4Y2VwdGlvbiBmb3IgYSBuZXdseSBtYXRlcmlhbGl6ZWQgcGh5c2ljYWwgZWRnZS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwcmVwYXJlRnJlc2hNZW1iZXJQcmVzZW5jZShicmFuY2g6IG9iamVjdCxrZXk6IHN0cmluZyxjaGlsZDogb2JqZWN0KSB7XG4gY29uc3QgcGFyZW50PW5vZGVPZihicmFuY2gpLHByZXZpb3VzPW9yZGluYXJ5UHJlc2VuY2VTb3VyY2VzLmdldChwYXJlbnQpO1xuIGNvbnN0IGRlc2NyaXB0b3I9T2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihwYXJlbnQsa2V5KTtcbiBjb25zdCBzb3VyY2U9cHJldmlvdXM/P25ldyBPcmRpbmFyeU1lbWJlclByZXNlbmNlU291cmNlKCk7XG4gY29uc3QgZWRpdD1zb3VyY2UucHJlcGFyZShrZXksY2hpbGQsZmFsc2UsdHJ1ZSxnZXRBY3RpdmVXcml0ZUNvbnRleHQoKT8ucGFydGljaXBhdGlvbj09PSdpbnNwZWN0aW9uJyk7XG4gcmV0dXJuIHtwcmVzZW50OmVkaXQuYWZ0ZXIsdmFsaWRhdGU6KCk9PntcbiAgaWYob3JkaW5hcnlQcmVzZW5jZVNvdXJjZXMuZ2V0KHBhcmVudCkhPT1wcmV2aW91c3x8T2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihwYXJlbnQsa2V5KT8udmFsdWUhPT1kZXNjcmlwdG9yPy52YWx1ZSl0aHJvdyBuZXcgRXJyb3IoJ0ZyZXNoIG1lbWJlcnNoaXAgcHJlcGFyYXRpb24gcmVlbnRlcmVkIGluc3RhbGxhdGlvbicpO1xuICBzb3VyY2UudmFsaWRhdGUoZWRpdCk7XG4gfSxpbnN0YWxsOigpPT57XG4gIGNvbnN0IGRlbHRhPXNvdXJjZS5pbnN0YWxsKGVkaXQpO29yZGluYXJ5UHJlc2VuY2VTb3VyY2VzLnNldChwYXJlbnQsc291cmNlKTtcbiAgaWYoIWVkaXQuYWZ0ZXIpe21hcmtIYXNEb3JtYW50KHBhcmVudCk7Y29uc3QgcGVlcj1wZWVyT2YocGFyZW50KTtpZihwZWVyKW1hcmtIYXNEb3JtYW50KHBlZXIpO2xpbmtNZW1iZXIocGFyZW50LGtleSxjaGlsZCk7bGlua0Rlc2NlbmRhbnRzKGNoaWxkKTt9XG4gIGNvbnN0IHJ1bnRpbWU9Z2V0VHJlZVNjYWxhclNsb3RSdW50aW1lKHBhcmVudCk7XG4gIGlmKHJ1bnRpbWUmJmRlbHRhKXtvcmRpbmFyeURpdmVyZ2VuY2VzLnNldChydW50aW1lLChvcmRpbmFyeURpdmVyZ2VuY2VzLmdldChydW50aW1lKT8/MCkrZGVsdGEpO3J1bnRpbWUuZW5hYmxlQWJzZW5jZT8uKEFCU0VOQ0UpO31cbiB9fTtcbn1cbiJdLCJmaWxlIjoiL3NyYy9saWIvaW50ZXJuYWxzL21lbWJlci1tZW1iZXJzaGlwLnRzIn0=

//# vitestCache=W3siZmlsZSI6IjEiLCJpZCI6IjEiLCJ1cmwiOiIyIiwiaW1wb3J0ZWRVcmxzIjoiMyIsIm1hcHBpbmdzIjpmYWxzZX0sIi9wcml2YXRlL3RtcC9zdC1jMjgtcjMtc2FtcGxlZC1hbGxvY2F0aW9uL2luZGV4ZWQvY2FuZGlkYXRlL3BhY2thZ2VzL2tlcm5lbC9zcmMvbGliL2ludGVybmFscy9tZW1iZXItbWVtYmVyc2hpcC50cyIsIi9zcmMvbGliL2ludGVybmFscy9tZW1iZXItbWVtYmVyc2hpcC50cyIsW11d
}}