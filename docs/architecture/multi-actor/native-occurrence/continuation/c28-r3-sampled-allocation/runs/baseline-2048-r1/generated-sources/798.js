'use strict';async (__vite_ssr_exports__,__vite_ssr_import_meta__,__vite_ssr_import__,__vite_ssr_dynamic_import__,__vite_ssr_exportAll__,__vite_ssr_exportName__,__filename,__dirname,module,exports,require)=>{{Object.defineProperty(__vite_ssr_exports__, "isWritableLocation", { enumerable: true, configurable: true, get(){ try { return isWritableLocation } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "writableLocationPublisher", { enumerable: true, configurable: true, get(){ try { return writableLocationPublisher } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "replaceLocation", { enumerable: true, configurable: true, get(){ try { return replaceLocation } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "replaceSelectedLocation", { enumerable: true, configurable: true, get(){ try { return replaceSelectedLocation } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "deriveLocation", { enumerable: true, configurable: true, get(){ try { return deriveLocation } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "registerWritableLocationBinding", { enumerable: true, configurable: true, get(){ try { return registerWritableLocationBinding } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "interceptLocationWrites", { enumerable: true, configurable: true, get(){ try { return interceptLocationWrites } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "createWritableProjection", { enumerable: true, configurable: true, get(){ try { return createWritableProjection } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "bindLocationRuntime", { enumerable: true, configurable: true, get(){ try { return bindLocationRuntime } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "getLocationRuntime", { enumerable: true, configurable: true, get(){ try { return getLocationRuntime } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "createLocationRuntime", { enumerable: true, configurable: true, get(){ try { return createLocationRuntime } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "NEUTRAL_LOCATION_RUNTIME", { enumerable: true, configurable: true, get(){ try { return NEUTRAL_LOCATION_RUNTIME } catch {} }});
Object.defineProperty(__vite_ssr_exports__, "needsLocationAuthorityAdmission", { enumerable: true, configurable: true, get(){ try { return needsLocationAuthorityAdmission } catch {} }});
const __vite_ssr_import_0__ = await __vite_ssr_import__("/src/lib/internals/snapshot-installation.ts", {"importedNames":["markSnapshotInstalled"]});
const __vite_ssr_import_1__ = await __vite_ssr_import__("/src/lib/internals/selected-write-operation.ts", {"importedNames":["openSelected","closeSelected","failSelected","consumeSelected","selectedProceed"]});
const __vite_ssr_import_2__ = await __vite_ssr_import__("/src/lib/internals/entity-publication.ts", {"importedNames":["withEntityBoundPublicationInput"]});
const __vite_ssr_import_3__ = await __vite_ssr_import__("/src/lib/internals/cell-identity.ts", {"importedNames":["markTreeCell"]});
const __vite_ssr_import_4__ = await __vite_ssr_import__("/src/lib/leaf.ts", {"importedNames":["isLeafDefinition","leafDefinitionValue"]});
const __vite_ssr_import_5__ = await __vite_ssr_import__("/src/lib/internals/observation-adapter.ts", {"importedNames":["NEUTRAL_OBSERVATION_ADAPTER"]});


const __vite_ssr_import_6__ = await __vite_ssr_import__("/src/lib/internals/production-substrate-stats.ts", {"importedNames":["PRODUCTION_SUBSTRATE_STATS_ENABLED","recordProductionSubstrateStat"]});



const __vite_ssr_import_7__ = await __vite_ssr_import__("/src/lib/internals/intrinsic-mutation.ts", {"importedNames":["combineTerminalRecords","registerIntrinsicMutationSource"]});
const __vite_ssr_import_8__ = await __vite_ssr_import__("/src/lib/internals/error-reporter.ts", {"importedNames":["reportContainedObserverError"]});
const WRITABLE_LOCATION_BINDINGS = /* @__PURE__ */ new WeakMap();
const writableLocationBinding = (location) => {
  const binding = WRITABLE_LOCATION_BINDINGS.get(location);
  if (!binding) throw new Error("Expected a writable SignalTree location");
  return binding;
};
function isWritableLocation(value) {
  return WRITABLE_LOCATION_BINDINGS.has(value);
};
function writableLocationPublisher(value) {
  return WRITABLE_LOCATION_BINDINGS.get(value);
};
function replaceLocation(location, value) {
  writableLocationBinding(location).replace(value);
};
function replaceSelectedLocation(location, value, selection) {
  const binding = writableLocationBinding(location);
  if (!binding.replaceSelected) throw new Error("Selected replacement has no private projection continuation");
  const outcome = { failed: false };
  const invocation = (0,__vite_ssr_import_1__.openSelected)(value, selection, outcome);
  try {
    binding.replaceSelected(invocation);
    if (outcome.failed) throw outcome.error;
    if (invocation.phase === "open") throw new Error("Selected continuation did not prepare");
  } finally {
    (0,__vite_ssr_import_1__.closeSelected)(invocation);
    outcome.error = void 0;
  }
};
function deriveLocation(location, update) {
  writableLocationBinding(location).derive(update);
};
function registerWritableLocationBinding(binding) {
  WRITABLE_LOCATION_BINDINGS.set(
    binding.location,
    binding
  );
};
const synchronizeNativeWriters = (binding) => {
  const cell = binding.location;
  if (typeof cell.set !== "function" || typeof cell.update !== "function") {
    return;
  };
  cell.set = binding.replace;
  cell.update = binding.derive;
};
function interceptLocationWrites(location, intercept) {
  const binding = writableLocationBinding(location);
  const previousReplace = binding.replace;
  const previousDerive = binding.derive;
  const previousSelected = binding.replaceSelected;
  const wrappedSelected = previousSelected ? (invocation) => {
    if (invocation.phase !== "open" || !invocation.request) throw new Error("Selected continuation is closed");
    try {
      intercept({ intent: "replace", value: invocation.request.value }, (0,__vite_ssr_import_1__.selectedProceed)(invocation, previousSelected));
    } catch (error) {
      (0,__vite_ssr_import_1__.failSelected)(invocation, error);
      throw error;
    }
  } : void 0;
  const wrappedReplace = (value) => intercept({ intent: "replace", value }, () => previousReplace(value));
  const wrappedDerive = (update) => intercept({ intent: "derive", update }, () => previousDerive(update));
  binding.replace = wrappedReplace;
  binding.replaceSelected = wrappedSelected;
  binding.derive = wrappedDerive;
  synchronizeNativeWriters(binding);
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    if (binding.replace === wrappedReplace) binding.replace = previousReplace;
    if (binding.replaceSelected === wrappedSelected) binding.replaceSelected = previousSelected;
    if (binding.derive === wrappedDerive) binding.derive = previousDerive;
    synchronizeNativeWriters(binding);
  };
};
function createWritableProjection(source, write) {
  const location = (0,__vite_ssr_import_3__.markTreeCell)(function(value) {
    if (arguments.length === 0) return source();
    if (typeof value === "function") {
      binding.derive(value);
    } else if ((0,__vite_ssr_import_4__.isLeafDefinition)(value)) {
      binding.replace((0,__vite_ssr_import_4__.leafDefinitionValue)(value));
    } else {
      binding.replace(value);
    };
    return void 0;
  });
  const mutationSource1 = (0,__vite_ssr_import_7__.registerIntrinsicMutationSource)(
    location
  );
  const replace = (value, selection) => {
    const observer = mutationSource1.observer;
    const before = observer ? source.peek() : void 0;
    write(value, "replace", selection);
    const deliver = () => {
      if (observer) {
        const after = source.peek();
        observer({
          intent: "replace",
          before,
          after,
          changed: !Object.is(before, after)
        });
      }
    };
    if (selection?.preparation) selection.preparation.defer(deliver);
    else deliver();
  };
  const binding = {
    location,
    notify: () => void 0,
    replace: (value) => replace(value),
    replaceSelected: (invocation) => {
      const request = (0,__vite_ssr_import_1__.consumeSelected)(invocation);
      replace(request.value, request.selection);
    },
    derive: (update) => {
      const before = source.peek();
      (0,__vite_ssr_import_2__.withEntityBoundPublicationInput)(location, () => write(update(before), "derive"));
      const observer = mutationSource1.observer;
      if (observer) {
        const after = source.peek();
        observer({
          intent: "derive",
          before,
          after,
          changed: !Object.is(before, after)
        });
      }
    }
  };
  WRITABLE_LOCATION_BINDINGS.set(
    location,
    binding
  );
  location.peek = source.peek;
  location.subscribe = source.subscribe;
  location.asReadonly = () => location;
  return location;
};
let activeConsumer;
let publicationDepth = 0;
const pendingConsumers = /* @__PURE__ */ new Set();
const dependencyFinalizer = new FinalizationRegistry((dependencies) => {
  for (const [node, edge] of dependencies) {
    node.consumers.delete(edge.reference);
  }
});
const flushConsumers = () => {
  const errors = [];
  while (pendingConsumers.size > 0) {
    const consumer = [...pendingConsumers].sort(
      (left, right) => left.level - right.level
    )[0];
    pendingConsumers.delete(consumer);
    try {
      consumer.settle();
    } catch (error) {
      errors.push(error);
    }
  };
  return errors;
};
const NO_LISTENERS = /* @__PURE__ */ new Set();
const notifyObservers = (token, listeners) => {
  let failure;
  let hasFailure = false;
  try {
    token?.invalidate();
  } catch (error) {
    failure = error;
    hasFailure = true;
  };
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch {
    }
  };
  if (hasFailure) throw failure;
};
const trackDependency = (node, token) => {
  if (activeConsumer) {
    let edge = activeConsumer.dependencies.get(node);
    if (!edge) {
      const reference = new WeakRef(activeConsumer);
      edge = { reference, version: node.version };
      node.consumers.add(reference);
      activeConsumer.dependencies.set(node, edge);
    } else {
      edge.version = node.version;
    };
    activeConsumer.level = Math.max(activeConsumer.level, node.level + 1);
    return;
  };
  if (__vite_ssr_import_6__.PRODUCTION_SUBSTRATE_STATS_ENABLED) {
    (0,__vite_ssr_import_6__.recordProductionSubstrateStat)("publicationDependencyReads");
  };
  token().observe();
};
const notifyDependents = (node) => {
  for (const reference of node.consumers) {
    const consumer = reference.deref();
    if (consumer) consumer.invalidate();
    else node.consumers.delete(reference);
  }
};
const NODE_LOCATION_RUNTIMES = /* @__PURE__ */ new WeakMap();
function bindLocationRuntime(node, runtime) {
  NODE_LOCATION_RUNTIMES.set(node, runtime);
};
function getLocationRuntime(node) {
  return NODE_LOCATION_RUNTIMES.get(node);
};
function createLocationRuntime(realization) {
  const hasReactiveObservation = realization !== __vite_ssr_import_5__.NEUTRAL_OBSERVATION_ADAPTER;
  let invalidationGroupDepth = 0;
  const groupedPublishers = /* @__PURE__ */ new Set();
  const deliver = (publishers) => {
    const errors = [];
    realization.runInvalidationGroup(() => {
      publicationDepth += 1;
      try {
        for (const publisher of publishers) {
          try {
            publisher.notify();
          } catch (error) {
            errors.push(error);
          }
        };
        if (publicationDepth === 1) errors.push(...flushConsumers());
      } finally {
        publicationDepth -= 1;
        if (publicationDepth === 0) pendingConsumers.clear();
      }
    });
    if (errors.length > 0) throw errors[0];
  };
  const publish = (publishers) => {
    if (invalidationGroupDepth > 0) {
      for (const publisher of publishers) groupedPublishers.add(publisher);
      return;
    };
    deliver(publishers);
  };
  const runInvalidationGroup = (run) => {
    let failure;
    let hasFailure = false;
    invalidationGroupDepth += 1;
    try {
      run();
    } catch (error) {
      failure = error;
      hasFailure = true;
    } finally {
      invalidationGroupDepth -= 1;
      if (invalidationGroupDepth === 0 && groupedPublishers.size > 0) {
        const publishers = [...groupedPublishers];
        groupedPublishers.clear();
        try {
          deliver(publishers);
        } catch (error) {
          if (!hasFailure) {
            failure = error;
            hasFailure = true;
          }
        }
      }
    };
    if (hasFailure) throw failure;
  };
  const createWritable = (read, write) => {
    let observationToken;
    const listeners = /* @__PURE__ */ new Set();
    const token = () => observationToken ??= realization.createToken();
    const node = {
      consumers: /* @__PURE__ */ new Set(),
      level: 0,
      version: 0,
      refresh: () => void 0
    };
    const location = (0,__vite_ssr_import_3__.markTreeCell)(function(value) {
      if (arguments.length === 0) {
        trackDependency(node, token);
        return read();
      };
      if (typeof value === "function") {
        binding.derive(value);
      } else if ((0,__vite_ssr_import_4__.isLeafDefinition)(value)) {
        binding.replace((0,__vite_ssr_import_4__.leafDefinitionValue)(value));
      } else {
        binding.replace(value);
      };
      return void 0;
    });
    const mutationSource2 = (0,__vite_ssr_import_7__.registerIntrinsicMutationSource)(
      location
    );
    const binding = {
      location,
      notify: () => {
        node.version += 1;
        notifyDependents(node);
        notifyObservers(observationToken, listeners);
      },
      replace: (next) => {
        const observer = mutationSource2.observer;
        const publicationPrepare = mutationSource2.preparePublication;
        const publicationComplete = mutationSource2.completePublication;
        const before = observer || publicationPrepare ? read(true) : void 0;
        let unit;
        let terminal;
        const preparePublication = (changed, retained = before, physicalChanged = changed) => {
          unit = publicationPrepare?.({ intent: "replace", before, after: changed ? next : retained, changed, physicalChanged, preparedTerminal: terminal });
          return unit?.record;
        };
        let failed = false;
        try {
          const result = write(next, "replace", (physicalChanged2) => (0,__vite_ssr_import_7__.combineTerminalRecords)(
            terminal = mutationSource2.prepareTerminal?.({ intent: "replace", before, after: next, changed: true }),
            preparePublication(true, before, physicalChanged2)
          ), publicationPrepare ? (current, physicalChanged2) => preparePublication(false, current, physicalChanged2) : void 0);
          const changed = typeof result === "boolean" ? result : result.changed;
          const physicalChanged = typeof result === "boolean" ? result : result.physicalChanged;
          if (typeof result === "boolean" && physicalChanged) (0,__vite_ssr_import_0__.markSnapshotInstalled)(location);
          if (observer) observer({ intent: "replace", before, after: changed ? next : before, changed, coveredRecipients: unit?.coveredRecipients });
          if (physicalChanged) publish([binding]);
        } catch (error) {
          failed = true;
          throw error;
        } finally {
          if (unit && publicationComplete) {
            try {
              publicationComplete(unit.completion);
            } catch (error) {
              if (!failed) throw error;
              (0,__vite_ssr_import_8__.reportContainedObserverError)({ error, operation: "notify:subscriber" });
            }
          }
        }
      },
      derive: (update) => {
        const publicationInput = mutationSource2.capturePublicationInput?.();
        const current = read();
        const publicationPrepare = mutationSource2.preparePublication;
        const publicationComplete = mutationSource2.completePublication;
        const before = mutationSource2.observer || publicationPrepare ? read(true) : current;
        const next = update(current);
        let unit;
        let terminal;
        const preparePublication = (changed, retained = before, physicalChanged = changed) => {
          unit = publicationPrepare?.({ intent: "derive", before, after: changed ? next : retained, changed, physicalChanged, preparedTerminal: terminal }, publicationInput);
          return unit?.record;
        };
        let failed = false;
        try {
          const result = write(next, "derive", (physicalChanged2) => (0,__vite_ssr_import_7__.combineTerminalRecords)(
            terminal = mutationSource2.prepareTerminal?.({ intent: "derive", before, after: next, changed: true }),
            preparePublication(true, before, physicalChanged2)
          ), publicationPrepare ? (current2, physicalChanged2) => preparePublication(false, current2, physicalChanged2) : void 0);
          const changed = typeof result === "boolean" ? result : result.changed;
          const physicalChanged = typeof result === "boolean" ? result : result.physicalChanged;
          if (typeof result === "boolean" && physicalChanged) (0,__vite_ssr_import_0__.markSnapshotInstalled)(location);
          mutationSource2.observer?.({ intent: "derive", before, after: changed ? next : before, changed, coveredRecipients: unit?.coveredRecipients });
          if (physicalChanged) publish([binding]);
        } catch (error) {
          failed = true;
          throw error;
        } finally {
          if (unit && publicationComplete) {
            try {
              publicationComplete(unit.completion);
            } catch (error) {
              if (!failed) throw error;
              (0,__vite_ssr_import_8__.reportContainedObserverError)({ error, operation: "notify:subscriber" });
            }
          }
        }
      }
    };
    registerWritableLocationBinding(binding);
    location.peek = () => read();
    location.subscribe = (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    };
    location.asReadonly = () => location;
    return binding;
  };
  const createCell = (initial, equal = Object.is) => {
    let value = initial;
    const binding = createWritable(
      () => value,
      (next) => {
        if (equal(value, next)) return false;
        value = next;
        return true;
      }
    );
    return binding.location;
  };
  const createDerived = (compute) => {
    let initialized = false;
    let dirty = true;
    let computationFailed = false;
    let value;
    let observationToken;
    const listeners = /* @__PURE__ */ new Set();
    const node = {
      consumers: /* @__PURE__ */ new Set(),
      level: 0,
      version: 0,
      refresh: () => void 0
    };
    const token = () => observationToken ??= realization.createToken();
    const consumer = {
      dependencies: /* @__PURE__ */ new Map(),
      level: 1,
      invalidate: () => {
        if (dirty) {
          if (listeners.size > 0 || hasReactiveObservation && observationToken) {
            pendingConsumers.add(consumer);
          };
          return;
        };
        dirty = true;
        notifyDependents(node);
        if (listeners.size > 0 || hasReactiveObservation && observationToken) {
          pendingConsumers.add(consumer);
        }
      },
      settle: () => {
        if (!dirty) return;
        const previous = value;
        const wasInitialized = initialized;
        readCurrent();
        if (wasInitialized && !Object.is(previous, value)) {
          publisher.notify();
        }
      }
    };
    dependencyFinalizer.register(consumer, consumer.dependencies);
    const publisher = {
      notify: () => {
        notifyObservers(observationToken, listeners);
      }
    };
    const readCurrent = () => {
      if (!dirty && initialized) return value;
      if (initialized && !computationFailed) {
        let changed = false;
        for (const [dependency, edge] of consumer.dependencies) {
          dependency.refresh();
          if (dependency.version !== edge.version) changed = true;
        };
        if (!changed) {
          dirty = false;
          return value;
        }
      };
      for (const [dependency, edge] of consumer.dependencies) {
        dependency.consumers.delete(edge.reference);
      };
      consumer.dependencies.clear();
      consumer.level = 1;
      const previous = value;
      const wasInitialized = initialized;
      const previousConsumer = activeConsumer;
      activeConsumer = consumer;
      try {
        value = compute();
        node.level = consumer.level;
        initialized = true;
        dirty = false;
        computationFailed = false;
        if (wasInitialized && !Object.is(previous, value)) {
          node.version += 1;
        };
        return value;
      } catch (error) {
        computationFailed = true;
        throw error;
      } finally {
        activeConsumer = previousConsumer;
      }
    };
    node.refresh = () => {
      if (dirty) readCurrent();
    };
    const location = (0,__vite_ssr_import_3__.markTreeCell)((() => {
      const current = readCurrent();
      trackDependency(node, token);
      return current;
    }));
    location.peek = readCurrent;
    location.subscribe = (listener) => {
      readCurrent();
      listeners.add(listener);
      return () => listeners.delete(listener);
    };
    return location;
  };
  const createEpoch = () => {
    let observationToken;
    let version = 0;
    const token = () => observationToken ??= realization.createToken();
    const node = {
      consumers: /* @__PURE__ */ new Set(),
      level: 0,
      version: 0,
      refresh: () => void 0
    };
    const publisher = {
      notify: () => {
        node.version += 1;
        notifyDependents(node);
        notifyObservers(observationToken, NO_LISTENERS);
      }
    };
    const epoch = (() => {
      trackDependency(node, token);
      return version;
    });
    epoch.set = (next) => {
      if (next === version) return;
      version = next;
      publish([publisher]);
    };
    epoch.update = (fn) => epoch.set(fn(version));
    epoch.asReadonly = () => epoch;
    return epoch;
  };
  const advanceEpoch = (handle) => {
    handle.update((v) => v + 1);
  };
  return {
    createCell,
    createDerived,
    createCurrentReadonly: (read) => realization.createCurrentReadonlyCell ? realization.createCurrentReadonlyCell(read) : read,
    createWritable,
    createEpoch,
    advanceEpoch,
    publish,
    runInvalidationGroup
  };
};
const NEUTRAL_LOCATION_RUNTIME = createLocationRuntime(
  (0,__vite_ssr_import_5__.NEUTRAL_OBSERVATION_ADAPTER)
);
function needsLocationAuthorityAdmission(value) {
  return WRITABLE_LOCATION_BINDINGS.get(value)?.needsAuthorityAdmission?.() ?? false;
}
//# sourceMappingSource=vite-generated
//# sourceMappingURL=data:application/json;base64,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QUFBQyxTQUFPLDJCQUEyQixJQUFJLEtBQUssR0FBRywwQkFBMEIsS0FBSztBQUFNIiwibmFtZXMiOlsicGh5c2ljYWxDaGFuZ2VkIiwiY3VycmVudCJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlcyI6WyJsb2NhdGlvbi1ydW50aW1lLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IG1hcmtTbmFwc2hvdEluc3RhbGxlZCB9IGZyb20gJy4vc25hcHNob3QtaW5zdGFsbGF0aW9uJztcbmltcG9ydCB7b3BlblNlbGVjdGVkLGNsb3NlU2VsZWN0ZWQsZmFpbFNlbGVjdGVkLGNvbnN1bWVTZWxlY3RlZCxzZWxlY3RlZFByb2NlZWQsdHlwZSBTZWxlY3RlZEludm9jYXRpb24sdHlwZSBTZWxlY3RlZE91dGNvbWV9IGZyb20gJy4vc2VsZWN0ZWQtd3JpdGUtb3BlcmF0aW9uJztcbmltcG9ydCB0eXBlIHsgQ2xhaW1lZEZpZWxkRW5kcG9pbnQgfSBmcm9tICcuL25hdGl2ZS1maWVsZC1zZWxlY3Rpb24nO1xuaW1wb3J0IHsgd2l0aEVudGl0eUJvdW5kUHVibGljYXRpb25JbnB1dCB9IGZyb20gJy4vZW50aXR5LXB1YmxpY2F0aW9uJztcbmltcG9ydCB7IG1hcmtUcmVlQ2VsbCB9IGZyb20gJy4vY2VsbC1pZGVudGl0eSc7XG5pbXBvcnQgeyBpc0xlYWZEZWZpbml0aW9uLCBsZWFmRGVmaW5pdGlvblZhbHVlIH0gZnJvbSAnLi4vbGVhZic7XG5pbXBvcnQgdHlwZSB7XG4gIExvY2F0aW9uLFxuICBSZWFkb25seUxvY2F0aW9uLFxuICBSZWFkYWJsZUNlbGwsXG4gIFdyaXRhYmxlQ2VsbCxcbn0gZnJvbSAnLi9jZWxsLXJ1bnRpbWUnO1xuaW1wb3J0IHR5cGUge1xuICBPYnNlcnZhdGlvbkFkYXB0ZXIsXG4gIE9ic2VydmF0aW9uVG9rZW4sXG59IGZyb20gJy4vb2JzZXJ2YXRpb24tYWRhcHRlcic7XG5pbXBvcnQge1xuICBORVVUUkFMX09CU0VSVkFUSU9OX0FEQVBURVIsXG4gIHR5cGUgRXBvY2hIYW5kbGUsXG59IGZyb20gJy4vb2JzZXJ2YXRpb24tYWRhcHRlcic7XG5pbXBvcnQge1xuICBQUk9EVUNUSU9OX1NVQlNUUkFURV9TVEFUU19FTkFCTEVELFxuICByZWNvcmRQcm9kdWN0aW9uU3Vic3RyYXRlU3RhdCxcbn0gZnJvbSAnLi9wcm9kdWN0aW9uLXN1YnN0cmF0ZS1zdGF0cyc7XG5pbXBvcnQgeyB0eXBlIFRlcm1pbmFsUmVjb3JkUGxhbiwgdHlwZSBQcmVwYXJlZFB1YmxpY2F0aW9uVW5pdCwgY29tYmluZVRlcm1pbmFsUmVjb3JkcywgcmVnaXN0ZXJJbnRyaW5zaWNNdXRhdGlvblNvdXJjZSB9IGZyb20gJy4vaW50cmluc2ljLW11dGF0aW9uJztcbmltcG9ydCB7IHJlcG9ydENvbnRhaW5lZE9ic2VydmVyRXJyb3IgfSBmcm9tICcuL2Vycm9yLXJlcG9ydGVyJztcblxuaW50ZXJmYWNlIERlcGVuZGVuY3lDb25zdW1lciB7XG4gIHJlYWRvbmx5IGRlcGVuZGVuY2llczogTWFwPERlcGVuZGVuY3lOb2RlLCBEZXBlbmRlbmN5RWRnZT47XG4gIGxldmVsOiBudW1iZXI7XG4gIGludmFsaWRhdGUoKTogdm9pZDtcbiAgc2V0dGxlKCk6IHZvaWQ7XG59XG5cbmludGVyZmFjZSBEZXBlbmRlbmN5RWRnZSB7XG4gIHJlYWRvbmx5IHJlZmVyZW5jZTogV2Vha1JlZjxEZXBlbmRlbmN5Q29uc3VtZXI+O1xuICB2ZXJzaW9uOiBudW1iZXI7XG59XG5cbmludGVyZmFjZSBEZXBlbmRlbmN5Tm9kZSB7XG4gIHJlYWRvbmx5IGNvbnN1bWVyczogU2V0PFdlYWtSZWY8RGVwZW5kZW5jeUNvbnN1bWVyPj47XG4gIGxldmVsOiBudW1iZXI7XG4gIHZlcnNpb246IG51bWJlcjtcbiAgcmVmcmVzaCgpOiB2b2lkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIExvY2F0aW9uUHVibGlzaGVyIHtcbiAgbm90aWZ5KCk6IHZvaWQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgV3JpdGFibGVMb2NhdGlvbkJpbmRpbmc8VD4gZXh0ZW5kcyBMb2NhdGlvblB1Ymxpc2hlciB7XG4gIG5lZWRzQXV0aG9yaXR5QWRtaXNzaW9uPygpOmJvb2xlYW47XG4gIHJlYWRvbmx5IGxvY2F0aW9uOiBMb2NhdGlvbjxUPjtcbiAgcmVwbGFjZSh2YWx1ZTogVCk6IHZvaWQ7XG4gIHJlcGxhY2VTZWxlY3RlZD8oaW52b2NhdGlvbjogU2VsZWN0ZWRJbnZvY2F0aW9uKTogdm9pZDtcbiAgZGVyaXZlKHVwZGF0ZTogKGN1cnJlbnQ6IFQpID0+IFQpOiB2b2lkO1xufVxuXG5jb25zdCBXUklUQUJMRV9MT0NBVElPTl9CSU5ESU5HUyA9IG5ldyBXZWFrTWFwPFxuICBvYmplY3QsXG4gIFdyaXRhYmxlTG9jYXRpb25CaW5kaW5nPHVua25vd24+XG4+KCk7XG5cbmNvbnN0IHdyaXRhYmxlTG9jYXRpb25CaW5kaW5nID0gPFQ+KFxuICBsb2NhdGlvbjogTG9jYXRpb248VD5cbik6IFdyaXRhYmxlTG9jYXRpb25CaW5kaW5nPFQ+ID0+IHtcbiAgY29uc3QgYmluZGluZyA9IFdSSVRBQkxFX0xPQ0FUSU9OX0JJTkRJTkdTLmdldChsb2NhdGlvbiBhcyBvYmplY3QpIGFzXG4gICAgfCBXcml0YWJsZUxvY2F0aW9uQmluZGluZzxUPlxuICAgIHwgdW5kZWZpbmVkO1xuICBpZiAoIWJpbmRpbmcpIHRocm93IG5ldyBFcnJvcignRXhwZWN0ZWQgYSB3cml0YWJsZSBTaWduYWxUcmVlIGxvY2F0aW9uJyk7XG4gIHJldHVybiBiaW5kaW5nO1xufTtcblxuZXhwb3J0IGZ1bmN0aW9uIGlzV3JpdGFibGVMb2NhdGlvbih2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIExvY2F0aW9uPHVua25vd24+IHtcbiAgcmV0dXJuIFdSSVRBQkxFX0xPQ0FUSU9OX0JJTkRJTkdTLmhhcyh2YWx1ZSBhcyBvYmplY3QpO1xufVxuXG4vKipcbiAqIEBpbnRlcm5hbCBUaGUgcHVibGlzaGVyIGEgd3JpdGFibGUgbG9jYXRpb24ncyBvd24gd3JpdGVzIGFscmVhZHkgcHVibGlzaFxuICogdGhyb3VnaC4gRXhwb3NlZCBzbyBhIG1lbWJlcnNoaXAgdHJhbnNpdGlvbiBjYW4gd2FrZSBhIGxvY2F0aW9uJ3Mgb2JzZXJ2ZXJzXG4gKiB3aXRob3V0IHdyaXRpbmcgaXQ7IGl0IGNyZWF0ZXMgbm8gcmVhY3RpdmUgc3RhdGUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB3cml0YWJsZUxvY2F0aW9uUHVibGlzaGVyKFxuICB2YWx1ZTogdW5rbm93blxuKTogTG9jYXRpb25QdWJsaXNoZXIgfCB1bmRlZmluZWQge1xuICByZXR1cm4gV1JJVEFCTEVfTE9DQVRJT05fQklORElOR1MuZ2V0KHZhbHVlIGFzIG9iamVjdCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZXBsYWNlTG9jYXRpb248VD4obG9jYXRpb246IExvY2F0aW9uPFQ+LCB2YWx1ZTogVCk6IHZvaWQge1xuICB3cml0YWJsZUxvY2F0aW9uQmluZGluZyhsb2NhdGlvbikucmVwbGFjZSh2YWx1ZSk7XG59XG5cbi8qKiBQcml2YXRlIGludmVyc2UgZGlzcGF0Y2g7IGZvbGxvd3MgdGhlIHNhbWUgaW5zdGFsbGVkIGludGVyY2VwdG9yIGNoYWluLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlcGxhY2VTZWxlY3RlZExvY2F0aW9uPFQ+KGxvY2F0aW9uOiBMb2NhdGlvbjxUPiwgdmFsdWU6IFQsIHNlbGVjdGlvbjogQ2xhaW1lZEZpZWxkRW5kcG9pbnQpOiB2b2lkIHtcbiAgY29uc3QgYmluZGluZyA9IHdyaXRhYmxlTG9jYXRpb25CaW5kaW5nKGxvY2F0aW9uKTtcbiAgaWYgKCFiaW5kaW5nLnJlcGxhY2VTZWxlY3RlZCkgdGhyb3cgbmV3IEVycm9yKCdTZWxlY3RlZCByZXBsYWNlbWVudCBoYXMgbm8gcHJpdmF0ZSBwcm9qZWN0aW9uIGNvbnRpbnVhdGlvbicpO1xuICBjb25zdCBvdXRjb21lOlNlbGVjdGVkT3V0Y29tZT17ZmFpbGVkOmZhbHNlfTtcbiAgY29uc3QgaW52b2NhdGlvbj1vcGVuU2VsZWN0ZWQodmFsdWUsc2VsZWN0aW9uLG91dGNvbWUpO1xuICB0cnl7YmluZGluZy5yZXBsYWNlU2VsZWN0ZWQoaW52b2NhdGlvbik7aWYob3V0Y29tZS5mYWlsZWQpdGhyb3cgb3V0Y29tZS5lcnJvcjtpZihpbnZvY2F0aW9uLnBoYXNlPT09J29wZW4nKXRocm93IG5ldyBFcnJvcignU2VsZWN0ZWQgY29udGludWF0aW9uIGRpZCBub3QgcHJlcGFyZScpO31maW5hbGx5e2Nsb3NlU2VsZWN0ZWQoaW52b2NhdGlvbik7b3V0Y29tZS5lcnJvcj11bmRlZmluZWQ7fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVyaXZlTG9jYXRpb248VD4oXG4gIGxvY2F0aW9uOiBMb2NhdGlvbjxUPixcbiAgdXBkYXRlOiAoY3VycmVudDogVCkgPT4gVFxuKTogdm9pZCB7XG4gIHdyaXRhYmxlTG9jYXRpb25CaW5kaW5nKGxvY2F0aW9uKS5kZXJpdmUodXBkYXRlKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlZ2lzdGVyV3JpdGFibGVMb2NhdGlvbkJpbmRpbmc8VD4oXG4gIGJpbmRpbmc6IFdyaXRhYmxlTG9jYXRpb25CaW5kaW5nPFQ+XG4pOiB2b2lkIHtcbiAgV1JJVEFCTEVfTE9DQVRJT05fQklORElOR1Muc2V0KFxuICAgIGJpbmRpbmcubG9jYXRpb24gYXMgb2JqZWN0LFxuICAgIGJpbmRpbmcgYXMgV3JpdGFibGVMb2NhdGlvbkJpbmRpbmc8dW5rbm93bj5cbiAgKTtcbn1cblxuZXhwb3J0IHR5cGUgTG9jYXRpb25Xcml0ZU9wZXJhdGlvbjxUPiA9XG4gIHwgeyByZWFkb25seSBpbnRlbnQ6ICdyZXBsYWNlJzsgcmVhZG9ubHkgdmFsdWU6IFQgfVxuICB8IHsgcmVhZG9ubHkgaW50ZW50OiAnZGVyaXZlJzsgcmVhZG9ubHkgdXBkYXRlOiAoY3VycmVudDogVCkgPT4gVCB9O1xuXG5jb25zdCBzeW5jaHJvbml6ZU5hdGl2ZVdyaXRlcnMgPSA8VD4oXG4gIGJpbmRpbmc6IFdyaXRhYmxlTG9jYXRpb25CaW5kaW5nPFQ+XG4pOiB2b2lkID0+IHtcbiAgY29uc3QgY2VsbCA9IGJpbmRpbmcubG9jYXRpb24gYXMgdW5rbm93biBhcyB7XG4gICAgc2V0PzogKHZhbHVlOiBUKSA9PiB2b2lkO1xuICAgIHVwZGF0ZT86ICh1cGRhdGU6IChjdXJyZW50OiBUKSA9PiBUKSA9PiB2b2lkO1xuICB9O1xuICBpZiAodHlwZW9mIGNlbGwuc2V0ICE9PSAnZnVuY3Rpb24nIHx8IHR5cGVvZiBjZWxsLnVwZGF0ZSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHJldHVybjtcbiAgfVxuICBjZWxsLnNldCA9IGJpbmRpbmcucmVwbGFjZTtcbiAgY2VsbC51cGRhdGUgPSBiaW5kaW5nLmRlcml2ZTtcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBpbnRlcmNlcHRMb2NhdGlvbldyaXRlczxUPihcbiAgbG9jYXRpb246IExvY2F0aW9uPFQ+LFxuICBpbnRlcmNlcHQ6IChvcGVyYXRpb246IExvY2F0aW9uV3JpdGVPcGVyYXRpb248VD4sIHByb2NlZWQ6ICgpID0+IHZvaWQpID0+IHZvaWRcbik6ICgpID0+IHZvaWQge1xuICBjb25zdCBiaW5kaW5nID0gd3JpdGFibGVMb2NhdGlvbkJpbmRpbmcobG9jYXRpb24pO1xuXG4gIGNvbnN0IHByZXZpb3VzUmVwbGFjZSA9IGJpbmRpbmcucmVwbGFjZTtcbiAgY29uc3QgcHJldmlvdXNEZXJpdmUgPSBiaW5kaW5nLmRlcml2ZTtcbiAgY29uc3QgcHJldmlvdXNTZWxlY3RlZCA9IGJpbmRpbmcucmVwbGFjZVNlbGVjdGVkO1xuICBjb25zdCB3cmFwcGVkU2VsZWN0ZWQgPSBwcmV2aW91c1NlbGVjdGVkID8gKGludm9jYXRpb246IFNlbGVjdGVkSW52b2NhdGlvbik6IHZvaWQgPT4ge1xuICAgIGlmKGludm9jYXRpb24ucGhhc2UhPT0nb3Blbid8fCFpbnZvY2F0aW9uLnJlcXVlc3QpdGhyb3cgbmV3IEVycm9yKCdTZWxlY3RlZCBjb250aW51YXRpb24gaXMgY2xvc2VkJyk7XG4gICAgdHJ5e2ludGVyY2VwdCh7aW50ZW50OidyZXBsYWNlJyx2YWx1ZTppbnZvY2F0aW9uLnJlcXVlc3QudmFsdWUgYXMgVH0sc2VsZWN0ZWRQcm9jZWVkKGludm9jYXRpb24scHJldmlvdXNTZWxlY3RlZCkpO31jYXRjaChlcnJvcil7ZmFpbFNlbGVjdGVkKGludm9jYXRpb24sZXJyb3IpO3Rocm93IGVycm9yO31cbiAgfSA6IHVuZGVmaW5lZDtcbiAgY29uc3Qgd3JhcHBlZFJlcGxhY2UgPSAodmFsdWU6IFQpOiB2b2lkID0+XG4gICAgaW50ZXJjZXB0KHsgaW50ZW50OiAncmVwbGFjZScsIHZhbHVlIH0sICgpID0+IHByZXZpb3VzUmVwbGFjZSh2YWx1ZSkpO1xuICBjb25zdCB3cmFwcGVkRGVyaXZlID0gKHVwZGF0ZTogKGN1cnJlbnQ6IFQpID0+IFQpOiB2b2lkID0+XG4gICAgaW50ZXJjZXB0KHsgaW50ZW50OiAnZGVyaXZlJywgdXBkYXRlIH0sICgpID0+IHByZXZpb3VzRGVyaXZlKHVwZGF0ZSkpO1xuICBiaW5kaW5nLnJlcGxhY2UgPSB3cmFwcGVkUmVwbGFjZTtcbiAgYmluZGluZy5yZXBsYWNlU2VsZWN0ZWQgPSB3cmFwcGVkU2VsZWN0ZWQ7XG4gIGJpbmRpbmcuZGVyaXZlID0gd3JhcHBlZERlcml2ZTtcbiAgc3luY2hyb25pemVOYXRpdmVXcml0ZXJzKGJpbmRpbmcpO1xuXG4gIGxldCBhY3RpdmUgPSB0cnVlO1xuICByZXR1cm4gKCkgPT4ge1xuICAgIGlmICghYWN0aXZlKSByZXR1cm47XG4gICAgYWN0aXZlID0gZmFsc2U7XG4gICAgaWYgKGJpbmRpbmcucmVwbGFjZSA9PT0gd3JhcHBlZFJlcGxhY2UpIGJpbmRpbmcucmVwbGFjZSA9IHByZXZpb3VzUmVwbGFjZTtcbiAgICBpZiAoYmluZGluZy5yZXBsYWNlU2VsZWN0ZWQgPT09IHdyYXBwZWRTZWxlY3RlZCkgYmluZGluZy5yZXBsYWNlU2VsZWN0ZWQgPSBwcmV2aW91c1NlbGVjdGVkO1xuICAgIGlmIChiaW5kaW5nLmRlcml2ZSA9PT0gd3JhcHBlZERlcml2ZSkgYmluZGluZy5kZXJpdmUgPSBwcmV2aW91c0Rlcml2ZTtcbiAgICBzeW5jaHJvbml6ZU5hdGl2ZVdyaXRlcnMoYmluZGluZyk7XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVXcml0YWJsZVByb2plY3Rpb248VD4oXG4gIHNvdXJjZTogUmVhZG9ubHlMb2NhdGlvbjxUPixcbiAgd3JpdGU6ICh2YWx1ZTogVCwgaW50ZW50OiAncmVwbGFjZScgfCAnZGVyaXZlJywgc2VsZWN0aW9uPzogQ2xhaW1lZEZpZWxkRW5kcG9pbnQpID0+IHZvaWRcbik6IExvY2F0aW9uPFQ+IHtcbiAgY29uc3QgbG9jYXRpb24gPSBtYXJrVHJlZUNlbGwoZnVuY3Rpb24gKHZhbHVlPzogdW5rbm93bikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSByZXR1cm4gc291cmNlKCk7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgYmluZGluZy5kZXJpdmUodmFsdWUgYXMgKGN1cnJlbnQ6IFQpID0+IFQpO1xuICAgIH0gZWxzZSBpZiAoaXNMZWFmRGVmaW5pdGlvbih2YWx1ZSkpIHtcbiAgICAgIGJpbmRpbmcucmVwbGFjZShsZWFmRGVmaW5pdGlvblZhbHVlKHZhbHVlKSBhcyBUKTtcbiAgICB9IGVsc2Uge1xuICAgICAgYmluZGluZy5yZXBsYWNlKHZhbHVlIGFzIFQpO1xuICAgIH1cbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9IGFzIExvY2F0aW9uPFQ+KTtcbiAgY29uc3QgbXV0YXRpb25Tb3VyY2UxID0gcmVnaXN0ZXJJbnRyaW5zaWNNdXRhdGlvblNvdXJjZTxUPihcbiAgICBsb2NhdGlvbiBhcyBvYmplY3RcbiAgKTtcblxuICBjb25zdCByZXBsYWNlID0gKHZhbHVlOiBULCBzZWxlY3Rpb24/OiBDbGFpbWVkRmllbGRFbmRwb2ludCk6IHZvaWQgPT4ge1xuICAgICAgY29uc3Qgb2JzZXJ2ZXIgPSBtdXRhdGlvblNvdXJjZTEub2JzZXJ2ZXI7XG4gICAgICBjb25zdCBiZWZvcmUgPSBvYnNlcnZlciA/IHNvdXJjZS5wZWVrKCkgOiB1bmRlZmluZWQ7XG4gICAgICB3cml0ZSh2YWx1ZSwgJ3JlcGxhY2UnLCBzZWxlY3Rpb24pO1xuICAgICAgY29uc3QgZGVsaXZlciA9ICgpID0+IHsgaWYgKG9ic2VydmVyKSB7XG4gICAgICAgIGNvbnN0IGFmdGVyID0gc291cmNlLnBlZWsoKTtcbiAgICAgICAgb2JzZXJ2ZXIoe1xuICAgICAgICAgIGludGVudDogJ3JlcGxhY2UnLFxuICAgICAgICAgIGJlZm9yZTogYmVmb3JlIGFzIFQsXG4gICAgICAgICAgYWZ0ZXIsXG4gICAgICAgICAgY2hhbmdlZDogIU9iamVjdC5pcyhiZWZvcmUsIGFmdGVyKSxcbiAgICAgICAgfSk7XG4gICAgICB9fTtcbiAgICAgIGlmKHNlbGVjdGlvbj8ucHJlcGFyYXRpb24pc2VsZWN0aW9uLnByZXBhcmF0aW9uLmRlZmVyKGRlbGl2ZXIpO2Vsc2UgZGVsaXZlcigpO1xuICAgIH07XG4gIGNvbnN0IGJpbmRpbmc6IFdyaXRhYmxlTG9jYXRpb25CaW5kaW5nPFQ+ID0ge1xuICAgIGxvY2F0aW9uLFxuICAgIG5vdGlmeTogKCkgPT4gdW5kZWZpbmVkLFxuICAgIHJlcGxhY2U6IHZhbHVlID0+IHJlcGxhY2UodmFsdWUpLFxuICAgIHJlcGxhY2VTZWxlY3RlZDogaW52b2NhdGlvbiA9PiB7Y29uc3QgcmVxdWVzdD1jb25zdW1lU2VsZWN0ZWQoaW52b2NhdGlvbik7cmVwbGFjZShyZXF1ZXN0LnZhbHVlIGFzIFQscmVxdWVzdC5zZWxlY3Rpb24pO30sXG4gICAgZGVyaXZlOiAodXBkYXRlKSA9PiB7XG4gICAgICBjb25zdCBiZWZvcmUgPSBzb3VyY2UucGVlaygpO1xuICAgICAgd2l0aEVudGl0eUJvdW5kUHVibGljYXRpb25JbnB1dChsb2NhdGlvbiBhcyBvYmplY3QsKCk9PndyaXRlKHVwZGF0ZShiZWZvcmUpLCAnZGVyaXZlJykpO1xuICAgICAgY29uc3Qgb2JzZXJ2ZXIgPSBtdXRhdGlvblNvdXJjZTEub2JzZXJ2ZXI7XG4gICAgICBpZiAob2JzZXJ2ZXIpIHtcbiAgICAgICAgY29uc3QgYWZ0ZXIgPSBzb3VyY2UucGVlaygpO1xuICAgICAgICBvYnNlcnZlcih7XG4gICAgICAgICAgaW50ZW50OiAnZGVyaXZlJyxcbiAgICAgICAgICBiZWZvcmUsXG4gICAgICAgICAgYWZ0ZXIsXG4gICAgICAgICAgY2hhbmdlZDogIU9iamVjdC5pcyhiZWZvcmUsIGFmdGVyKSxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSxcbiAgfTtcbiAgV1JJVEFCTEVfTE9DQVRJT05fQklORElOR1Muc2V0KFxuICAgIGxvY2F0aW9uIGFzIG9iamVjdCxcbiAgICBiaW5kaW5nIGFzIFdyaXRhYmxlTG9jYXRpb25CaW5kaW5nPHVua25vd24+XG4gICk7XG4gIGxvY2F0aW9uLnBlZWsgPSBzb3VyY2UucGVlaztcbiAgbG9jYXRpb24uc3Vic2NyaWJlID0gc291cmNlLnN1YnNjcmliZTtcbiAgbG9jYXRpb24uYXNSZWFkb25seSA9ICgpID0+IGxvY2F0aW9uO1xuICByZXR1cm4gbG9jYXRpb247XG59XG5cbmxldCBhY3RpdmVDb25zdW1lcjogRGVwZW5kZW5jeUNvbnN1bWVyIHwgdW5kZWZpbmVkO1xubGV0IHB1YmxpY2F0aW9uRGVwdGggPSAwO1xuY29uc3QgcGVuZGluZ0NvbnN1bWVycyA9IG5ldyBTZXQ8RGVwZW5kZW5jeUNvbnN1bWVyPigpO1xuY29uc3QgZGVwZW5kZW5jeUZpbmFsaXplciA9IG5ldyBGaW5hbGl6YXRpb25SZWdpc3RyeTxcbiAgTWFwPERlcGVuZGVuY3lOb2RlLCBEZXBlbmRlbmN5RWRnZT5cbj4oKGRlcGVuZGVuY2llcykgPT4ge1xuICBmb3IgKGNvbnN0IFtub2RlLCBlZGdlXSBvZiBkZXBlbmRlbmNpZXMpIHtcbiAgICBub2RlLmNvbnN1bWVycy5kZWxldGUoZWRnZS5yZWZlcmVuY2UpO1xuICB9XG59KTtcblxuY29uc3QgZmx1c2hDb25zdW1lcnMgPSAoKTogdW5rbm93bltdID0+IHtcbiAgY29uc3QgZXJyb3JzOiB1bmtub3duW10gPSBbXTtcbiAgd2hpbGUgKHBlbmRpbmdDb25zdW1lcnMuc2l6ZSA+IDApIHtcbiAgICBjb25zdCBjb25zdW1lciA9IFsuLi5wZW5kaW5nQ29uc3VtZXJzXS5zb3J0KFxuICAgICAgKGxlZnQsIHJpZ2h0KSA9PiBsZWZ0LmxldmVsIC0gcmlnaHQubGV2ZWxcbiAgICApWzBdO1xuICAgIHBlbmRpbmdDb25zdW1lcnMuZGVsZXRlKGNvbnN1bWVyKTtcbiAgICB0cnkge1xuICAgICAgY29uc3VtZXIuc2V0dGxlKCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGVycm9ycy5wdXNoKGVycm9yKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGVycm9ycztcbn07XG5cbi8qKiBTaGFyZWQ6IGFuIGVwb2NoIGhhcyBubyBgc3Vic2NyaWJlYCBzdXJmYWNlLCBzbyBpdCBoYXMgbm8gbGlzdGVuZXJzLiAqL1xuY29uc3QgTk9fTElTVEVORVJTOiBSZWFkb25seVNldDwoKSA9PiB2b2lkPiA9IG5ldyBTZXQ8KCkgPT4gdm9pZD4oKTtcblxuY29uc3Qgbm90aWZ5T2JzZXJ2ZXJzID0gKFxuICB0b2tlbjogT2JzZXJ2YXRpb25Ub2tlbiB8IHVuZGVmaW5lZCxcbiAgbGlzdGVuZXJzOiBSZWFkb25seVNldDwoKSA9PiB2b2lkPlxuKTogdm9pZCA9PiB7XG4gIGxldCBmYWlsdXJlOiB1bmtub3duO1xuICBsZXQgaGFzRmFpbHVyZSA9IGZhbHNlO1xuICB0cnkge1xuICAgIHRva2VuPy5pbnZhbGlkYXRlKCk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgZmFpbHVyZSA9IGVycm9yO1xuICAgIGhhc0ZhaWx1cmUgPSB0cnVlO1xuICB9XG4gIGZvciAoY29uc3QgbGlzdGVuZXIgb2YgWy4uLmxpc3RlbmVyc10pIHtcbiAgICB0cnkge1xuICAgICAgbGlzdGVuZXIoKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIC8vIE9uZSBvYnNlcnZlciBjYW5ub3Qgc3RhcnZlIGxhdGVyIG9ic2VydmVycyBvZiBjb21taXR0ZWQgdHJ1dGguXG4gICAgfVxuICB9XG4gIGlmIChoYXNGYWlsdXJlKSB0aHJvdyBmYWlsdXJlO1xufTtcblxuY29uc3QgdHJhY2tEZXBlbmRlbmN5ID0gKFxuICBub2RlOiBEZXBlbmRlbmN5Tm9kZSxcbiAgdG9rZW46ICgpID0+IE9ic2VydmF0aW9uVG9rZW5cbik6IHZvaWQgPT4ge1xuICBpZiAoYWN0aXZlQ29uc3VtZXIpIHtcbiAgICBsZXQgZWRnZSA9IGFjdGl2ZUNvbnN1bWVyLmRlcGVuZGVuY2llcy5nZXQobm9kZSk7XG4gICAgaWYgKCFlZGdlKSB7XG4gICAgICBjb25zdCByZWZlcmVuY2UgPSBuZXcgV2Vha1JlZihhY3RpdmVDb25zdW1lcik7XG4gICAgICBlZGdlID0geyByZWZlcmVuY2UsIHZlcnNpb246IG5vZGUudmVyc2lvbiB9O1xuICAgICAgbm9kZS5jb25zdW1lcnMuYWRkKHJlZmVyZW5jZSk7XG4gICAgICBhY3RpdmVDb25zdW1lci5kZXBlbmRlbmNpZXMuc2V0KG5vZGUsIGVkZ2UpO1xuICAgIH0gZWxzZSB7XG4gICAgICBlZGdlLnZlcnNpb24gPSBub2RlLnZlcnNpb247XG4gICAgfVxuICAgIGFjdGl2ZUNvbnN1bWVyLmxldmVsID0gTWF0aC5tYXgoYWN0aXZlQ29uc3VtZXIubGV2ZWwsIG5vZGUubGV2ZWwgKyAxKTtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKFBST0RVQ1RJT05fU1VCU1RSQVRFX1NUQVRTX0VOQUJMRUQpIHtcbiAgICByZWNvcmRQcm9kdWN0aW9uU3Vic3RyYXRlU3RhdCgncHVibGljYXRpb25EZXBlbmRlbmN5UmVhZHMnKTtcbiAgfVxuICB0b2tlbigpLm9ic2VydmUoKTtcbn07XG5cbmNvbnN0IG5vdGlmeURlcGVuZGVudHMgPSAobm9kZTogRGVwZW5kZW5jeU5vZGUpOiB2b2lkID0+IHtcbiAgZm9yIChjb25zdCByZWZlcmVuY2Ugb2Ygbm9kZS5jb25zdW1lcnMpIHtcbiAgICBjb25zdCBjb25zdW1lciA9IHJlZmVyZW5jZS5kZXJlZigpO1xuICAgIGlmIChjb25zdW1lcikgY29uc3VtZXIuaW52YWxpZGF0ZSgpO1xuICAgIGVsc2Ugbm9kZS5jb25zdW1lcnMuZGVsZXRlKHJlZmVyZW5jZSk7XG4gIH1cbn07XG5cbmV4cG9ydCBpbnRlcmZhY2UgTG9jYXRpb25SdW50aW1lIHtcbiAgY3JlYXRlQ2VsbDxUPihcbiAgICBpbml0aWFsOiBULFxuICAgIGVxdWFsPzogKGxlZnQ6IFQsIHJpZ2h0OiBUKSA9PiBib29sZWFuXG4gICk6IExvY2F0aW9uPFQ+O1xuICBjcmVhdGVEZXJpdmVkPFQ+KGNvbXB1dGU6ICgpID0+IFQpOiBSZWFkb25seUxvY2F0aW9uPFQ+O1xuICBjcmVhdGVDdXJyZW50UmVhZG9ubHk8VD4ocmVhZDogKCkgPT4gVCk6IFJlYWRhYmxlQ2VsbDxUPjtcbiAgY3JlYXRlV3JpdGFibGU8VD4oXG4gICAgLyoqXG4gICAgICogVGhlIGxvY2F0aW9uJ3MgcmVhZC4gYHN0b3JlZGAgYXNrcyBmb3IgdGhlIHN0b3JlZCB2YWx1ZSB3aGF0ZXZlciB0aGVcbiAgICAgKiBsb2NhdGlvbidzIHByZXNlbmNlOiB3aGF0IGEgd3JpdGUncyBoaXN0b3J5IHJlY29yZHMgYXMgaXRzIGJlZm9yZVxuICAgICAqIHZhbHVlLCBzbyBhIHJldmVyc2FsIHJlc3RvcmVzIHN0b3JhZ2UgYXMgaXQgd2FzICh2MTYgOGUpLlxuICAgICAqL1xuICAgIHJlYWQ6IChzdG9yZWQ/OiBib29sZWFuKSA9PiBULFxuICAgIHdyaXRlOiAodmFsdWU6IFQsIGludGVudDogJ3JlcGxhY2UnIHwgJ2Rlcml2ZScsIHByZXBhcmU/OiAocGh5c2ljYWxDaGFuZ2VkPzpib29sZWFuKSA9PiBUZXJtaW5hbFJlY29yZFBsYW4gfCB1bmRlZmluZWQsIHByZXBhcmVVbmNoYW5nZWQ/OiAoY3VycmVudDogVCxwaHlzaWNhbENoYW5nZWQ/OmJvb2xlYW4pID0+IFRlcm1pbmFsUmVjb3JkUGxhbiB8IHVuZGVmaW5lZCkgPT4gYm9vbGVhbiB8IHtjaGFuZ2VkOmJvb2xlYW47cGh5c2ljYWxDaGFuZ2VkOmJvb2xlYW59XG4gICk6IFdyaXRhYmxlTG9jYXRpb25CaW5kaW5nPFQ+O1xuICBjcmVhdGVXcml0YWJsZVByb2plY3Rpb24/PFQ+KFxuICAgIGNvbXB1dGU6ICgpID0+IFQsXG4gICAgd3JpdGU6ICh2YWx1ZTogVCwgaW50ZW50OiAncmVwbGFjZScgfCAnZGVyaXZlJywgc2VsZWN0aW9uPzogQ2xhaW1lZEZpZWxkRW5kcG9pbnQpID0+IHZvaWRcbiAgKTogTG9jYXRpb248VD47XG4gIC8qKlxuICAgKiBgU1VCSkVDVC1FUE9DSC0wYC4gQSBzdGFibGUgcmVhY3RpdmUgYW5jaG9yIGFuZCBub3RoaW5nIGVsc2U6IGNhbGwgaXQgdG9cbiAgICogdGFrZSBhIGRlcGVuZGVuY3ksIGB1cGRhdGVgIGl0IHRvIGludmFsaWRhdGUgZXZlcnlvbmUgd2hvIGRpZC5cbiAgICpcbiAgICogSXQgZXhpc3RzIGJlY2F1c2UgYSBmdWxsIGBMb2NhdGlvbmAgaXMgdGhlIHdyb25nIHNoYXBlIGZvciB0aGUgam9iLiBBXG4gICAqIGBMb2NhdGlvbmAgaXMgZHVyYWJsZSBhdXRob3JpdHkg4oCUIHZhbHVlLCBtdXRhdGlvbiBvYnNlcnZhdGlvbiwgd3JpdGVcbiAgICogYmluZGluZ3MsIGEgcmVnaXN0cnkgZW50cnkg4oCUIGFuZCBhbiBlcG9jaCBjYXJyaWVzIG5vIGF1dGhvcml0eSBhdCBhbGwuIFRoZVxuICAgKiB2YWx1ZSBpdCBob2xkcyBpcyBhIGNvdW50ZXIgbm9ib2R5IHJlYWRzOyB0aGUgdHJ1dGggc3RheXMgaW5cbiAgICogYEVudGl0eVZhbHVlU3RvcmVgIGFuZCBgU3RydWN0dXJhbFN0b3JlYC4gTWVhc3VyZWQsIHRoYXQgZGlzdGluY3Rpb24gaXMgdGhlXG4gICAqIHdob2xlIGNvc3Q6IGEgYmFyZSBuYXRpdmUgY2VsbCBpbiBhIGBNYXBgIGlzIDU2MiBCL2VudGl0eSBhZ2FpbnN0IDEsMjQ4IEJcbiAgICogZm9yIHRoZSBgTG9jYXRpb25gIHN0YWNrIGFyb3VuZCBpdCwgYW5kIHdyYXBwaW5nIHRoZSBjZWxsIGJhY2sgdXAgaW4gYW5cbiAgICogb2JqZWN0IHdpdGggbWV0aG9kcyBjb3N0cyBhbm90aGVyIDE5MiBCLCB3aGljaCBpcyB3aHkgdGhpcyByZXR1cm5zIHRoZVxuICAgKiBjZWxsIGl0c2VsZiByYXRoZXIgdGhhbiBhbiBgeyByZWFkLCBidW1wIH1gIGZhY2FkZS5cbiAgICovXG4gIGNyZWF0ZUVwb2NoPygpOiBFcG9jaEhhbmRsZTtcbiAgLyoqXG4gICAqIEFkdmFuY2UgYW4gZXBvY2ggY3JlYXRlZCBieSBUSElTIHJ1bnRpbWUuIFNlcGFyYXRlIGZyb20gdGhlIGhhbmRsZSBzbyBhXG4gICAqIGZyYW1ld29yay1vd25lZCBoYW5kbGUgaXMgbmV2ZXIgd3JpdHRlbiB0byBieSB0aGUga2VybmVsIOKAlCBzZWVcbiAgICogYE9ic2VydmF0aW9uQWRhcHRlci5jcmVhdGVFcG9jaGAuXG4gICAqL1xuICBhZHZhbmNlRXBvY2g/KGVwb2NoOiBFcG9jaEhhbmRsZSk6IHZvaWQ7XG4gIHB1Ymxpc2gocHVibGlzaGVyczogcmVhZG9ubHkgTG9jYXRpb25QdWJsaXNoZXJbXSk6IHZvaWQ7XG4gIHJ1bkludmFsaWRhdGlvbkdyb3VwKHJ1bjogKCkgPT4gdm9pZCk6IHZvaWQ7XG59XG5cbmNvbnN0IE5PREVfTE9DQVRJT05fUlVOVElNRVMgPSBuZXcgV2Vha01hcDxvYmplY3QsIExvY2F0aW9uUnVudGltZT4oKTtcblxuZXhwb3J0IGZ1bmN0aW9uIGJpbmRMb2NhdGlvblJ1bnRpbWUoXG4gIG5vZGU6IG9iamVjdCxcbiAgcnVudGltZTogTG9jYXRpb25SdW50aW1lXG4pOiB2b2lkIHtcbiAgTk9ERV9MT0NBVElPTl9SVU5USU1FUy5zZXQobm9kZSwgcnVudGltZSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRMb2NhdGlvblJ1bnRpbWUobm9kZTogb2JqZWN0KTogTG9jYXRpb25SdW50aW1lIHwgdW5kZWZpbmVkIHtcbiAgcmV0dXJuIE5PREVfTE9DQVRJT05fUlVOVElNRVMuZ2V0KG5vZGUpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTG9jYXRpb25SdW50aW1lKFxuICByZWFsaXphdGlvbjogT2JzZXJ2YXRpb25BZGFwdGVyXG4pOiBMb2NhdGlvblJ1bnRpbWUge1xuICBjb25zdCBoYXNSZWFjdGl2ZU9ic2VydmF0aW9uID0gcmVhbGl6YXRpb24gIT09IE5FVVRSQUxfT0JTRVJWQVRJT05fQURBUFRFUjtcbiAgbGV0IGludmFsaWRhdGlvbkdyb3VwRGVwdGggPSAwO1xuICBjb25zdCBncm91cGVkUHVibGlzaGVycyA9IG5ldyBTZXQ8TG9jYXRpb25QdWJsaXNoZXI+KCk7XG5cbiAgY29uc3QgZGVsaXZlciA9IChwdWJsaXNoZXJzOiByZWFkb25seSBMb2NhdGlvblB1Ymxpc2hlcltdKTogdm9pZCA9PiB7XG4gICAgY29uc3QgZXJyb3JzOiB1bmtub3duW10gPSBbXTtcbiAgICByZWFsaXphdGlvbi5ydW5JbnZhbGlkYXRpb25Hcm91cCgoKSA9PiB7XG4gICAgICBwdWJsaWNhdGlvbkRlcHRoICs9IDE7XG4gICAgICB0cnkge1xuICAgICAgICBmb3IgKGNvbnN0IHB1Ymxpc2hlciBvZiBwdWJsaXNoZXJzKSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHB1Ymxpc2hlci5ub3RpZnkoKTtcbiAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgZXJyb3JzLnB1c2goZXJyb3IpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAocHVibGljYXRpb25EZXB0aCA9PT0gMSkgZXJyb3JzLnB1c2goLi4uZmx1c2hDb25zdW1lcnMoKSk7XG4gICAgICB9IGZpbmFsbHkge1xuICAgICAgICBwdWJsaWNhdGlvbkRlcHRoIC09IDE7XG4gICAgICAgIGlmIChwdWJsaWNhdGlvbkRlcHRoID09PSAwKSBwZW5kaW5nQ29uc3VtZXJzLmNsZWFyKCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgaWYgKGVycm9ycy5sZW5ndGggPiAwKSB0aHJvdyBlcnJvcnNbMF07XG4gIH07XG5cbiAgY29uc3QgcHVibGlzaCA9IChwdWJsaXNoZXJzOiByZWFkb25seSBMb2NhdGlvblB1Ymxpc2hlcltdKTogdm9pZCA9PiB7XG4gICAgaWYgKGludmFsaWRhdGlvbkdyb3VwRGVwdGggPiAwKSB7XG4gICAgICBmb3IgKGNvbnN0IHB1Ymxpc2hlciBvZiBwdWJsaXNoZXJzKSBncm91cGVkUHVibGlzaGVycy5hZGQocHVibGlzaGVyKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZGVsaXZlcihwdWJsaXNoZXJzKTtcbiAgfTtcblxuICBjb25zdCBydW5JbnZhbGlkYXRpb25Hcm91cCA9IChydW46ICgpID0+IHZvaWQpOiB2b2lkID0+IHtcbiAgICBsZXQgZmFpbHVyZTogdW5rbm93bjtcbiAgICBsZXQgaGFzRmFpbHVyZSA9IGZhbHNlO1xuICAgIGludmFsaWRhdGlvbkdyb3VwRGVwdGggKz0gMTtcbiAgICB0cnkge1xuICAgICAgcnVuKCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGZhaWx1cmUgPSBlcnJvcjtcbiAgICAgIGhhc0ZhaWx1cmUgPSB0cnVlO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBpbnZhbGlkYXRpb25Hcm91cERlcHRoIC09IDE7XG4gICAgICBpZiAoaW52YWxpZGF0aW9uR3JvdXBEZXB0aCA9PT0gMCAmJiBncm91cGVkUHVibGlzaGVycy5zaXplID4gMCkge1xuICAgICAgICBjb25zdCBwdWJsaXNoZXJzID0gWy4uLmdyb3VwZWRQdWJsaXNoZXJzXTtcbiAgICAgICAgZ3JvdXBlZFB1Ymxpc2hlcnMuY2xlYXIoKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBkZWxpdmVyKHB1Ymxpc2hlcnMpO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIGlmICghaGFzRmFpbHVyZSkge1xuICAgICAgICAgICAgZmFpbHVyZSA9IGVycm9yO1xuICAgICAgICAgICAgaGFzRmFpbHVyZSA9IHRydWU7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChoYXNGYWlsdXJlKSB0aHJvdyBmYWlsdXJlO1xuICB9O1xuXG4gIGNvbnN0IGNyZWF0ZVdyaXRhYmxlID0gPFQ+KFxuICAgIHJlYWQ6IChzdG9yZWQ/OiBib29sZWFuKSA9PiBULFxuICAgIHdyaXRlOiAodmFsdWU6IFQsIGludGVudDogJ3JlcGxhY2UnIHwgJ2Rlcml2ZScsIHByZXBhcmU/OiAocGh5c2ljYWxDaGFuZ2VkPzpib29sZWFuKSA9PiBUZXJtaW5hbFJlY29yZFBsYW4gfCB1bmRlZmluZWQsIHByZXBhcmVVbmNoYW5nZWQ/OiAoY3VycmVudDogVCxwaHlzaWNhbENoYW5nZWQ/OmJvb2xlYW4pID0+IFRlcm1pbmFsUmVjb3JkUGxhbiB8IHVuZGVmaW5lZCkgPT4gYm9vbGVhbiB8IHtjaGFuZ2VkOmJvb2xlYW47cGh5c2ljYWxDaGFuZ2VkOmJvb2xlYW59XG4gICk6IFdyaXRhYmxlTG9jYXRpb25CaW5kaW5nPFQ+ID0+IHtcbiAgICBsZXQgb2JzZXJ2YXRpb25Ub2tlbjogT2JzZXJ2YXRpb25Ub2tlbiB8IHVuZGVmaW5lZDtcbiAgICBjb25zdCBsaXN0ZW5lcnMgPSBuZXcgU2V0PCgpID0+IHZvaWQ+KCk7XG4gICAgY29uc3QgdG9rZW4gPSAoKSA9PiAob2JzZXJ2YXRpb25Ub2tlbiA/Pz0gcmVhbGl6YXRpb24uY3JlYXRlVG9rZW4oKSk7XG4gICAgY29uc3Qgbm9kZTogRGVwZW5kZW5jeU5vZGUgPSB7XG4gICAgICBjb25zdW1lcnM6IG5ldyBTZXQoKSxcbiAgICAgIGxldmVsOiAwLFxuICAgICAgdmVyc2lvbjogMCxcbiAgICAgIHJlZnJlc2g6ICgpID0+IHVuZGVmaW5lZCxcbiAgICB9O1xuICAgIGNvbnN0IGxvY2F0aW9uID0gbWFya1RyZWVDZWxsKGZ1bmN0aW9uICh2YWx1ZT86IHVua25vd24pIHtcbiAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHRyYWNrRGVwZW5kZW5jeShub2RlLCB0b2tlbik7XG4gICAgICAgIHJldHVybiByZWFkKCk7XG4gICAgICB9XG5cbiAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgYmluZGluZy5kZXJpdmUodmFsdWUgYXMgKGN1cnJlbnQ6IFQpID0+IFQpO1xuICAgICAgfSBlbHNlIGlmIChpc0xlYWZEZWZpbml0aW9uKHZhbHVlKSkge1xuICAgICAgICBiaW5kaW5nLnJlcGxhY2UobGVhZkRlZmluaXRpb25WYWx1ZSh2YWx1ZSkgYXMgVCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBiaW5kaW5nLnJlcGxhY2UodmFsdWUgYXMgVCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH0gYXMgTG9jYXRpb248VD4pO1xuICAgIGNvbnN0IG11dGF0aW9uU291cmNlMiA9IHJlZ2lzdGVySW50cmluc2ljTXV0YXRpb25Tb3VyY2U8VD4oXG4gICAgICBsb2NhdGlvbiBhcyBvYmplY3RcbiAgICApO1xuICAgIGNvbnN0IGJpbmRpbmc6IFdyaXRhYmxlTG9jYXRpb25CaW5kaW5nPFQ+ID0ge1xuICAgICAgbG9jYXRpb24sXG4gICAgICBub3RpZnk6ICgpID0+IHtcbiAgICAgICAgbm9kZS52ZXJzaW9uICs9IDE7XG4gICAgICAgIG5vdGlmeURlcGVuZGVudHMobm9kZSk7XG4gICAgICAgIG5vdGlmeU9ic2VydmVycyhvYnNlcnZhdGlvblRva2VuLCBsaXN0ZW5lcnMpO1xuICAgICAgfSxcbiAgICAgIHJlcGxhY2U6IChuZXh0KSA9PiB7XG4gICAgICAgIGNvbnN0IG9ic2VydmVyID0gbXV0YXRpb25Tb3VyY2UyLm9ic2VydmVyO1xuICAgICAgICBjb25zdCBwdWJsaWNhdGlvblByZXBhcmUgPSBtdXRhdGlvblNvdXJjZTIucHJlcGFyZVB1YmxpY2F0aW9uO1xuICAgICAgICBjb25zdCBwdWJsaWNhdGlvbkNvbXBsZXRlID0gbXV0YXRpb25Tb3VyY2UyLmNvbXBsZXRlUHVibGljYXRpb247XG4gICAgICAgIGNvbnN0IGJlZm9yZSA9IG9ic2VydmVyIHx8IHB1YmxpY2F0aW9uUHJlcGFyZSA/IHJlYWQodHJ1ZSkgOiB1bmRlZmluZWQ7XG4gICAgICAgIGxldCB1bml0OiBQcmVwYXJlZFB1YmxpY2F0aW9uVW5pdCB8IHVuZGVmaW5lZDtcbiAgICAgICAgbGV0IHRlcm1pbmFsOiBUZXJtaW5hbFJlY29yZFBsYW4gfCB1bmRlZmluZWQ7XG4gICAgICAgIGNvbnN0IHByZXBhcmVQdWJsaWNhdGlvbiA9IChjaGFuZ2VkOiBib29sZWFuLCByZXRhaW5lZDogVCA9IGJlZm9yZSBhcyBULHBoeXNpY2FsQ2hhbmdlZD1jaGFuZ2VkKSA9PiB7XG4gICAgICAgICAgdW5pdCA9IHB1YmxpY2F0aW9uUHJlcGFyZT8uKHtpbnRlbnQ6J3JlcGxhY2UnLGJlZm9yZTpiZWZvcmUgYXMgVCxhZnRlcjpjaGFuZ2VkID8gbmV4dCA6IHJldGFpbmVkLGNoYW5nZWQscGh5c2ljYWxDaGFuZ2VkLHByZXBhcmVkVGVybWluYWw6dGVybWluYWx9KTtcbiAgICAgICAgICByZXR1cm4gdW5pdD8ucmVjb3JkO1xuICAgICAgICB9O1xuICAgICAgICBsZXQgZmFpbGVkID0gZmFsc2U7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgcmVzdWx0ID0gd3JpdGUobmV4dCwgJ3JlcGxhY2UnLCBwaHlzaWNhbENoYW5nZWQgPT4gY29tYmluZVRlcm1pbmFsUmVjb3JkcyhcbiAgICAgICAgICAgIHRlcm1pbmFsID0gbXV0YXRpb25Tb3VyY2UyLnByZXBhcmVUZXJtaW5hbD8uKHtpbnRlbnQ6J3JlcGxhY2UnLGJlZm9yZTpiZWZvcmUgYXMgVCxhZnRlcjpuZXh0LGNoYW5nZWQ6dHJ1ZX0pLFxuICAgICAgICAgICAgcHJlcGFyZVB1YmxpY2F0aW9uKHRydWUsYmVmb3JlIGFzIFQscGh5c2ljYWxDaGFuZ2VkKVxuICAgICAgICAgICksIHB1YmxpY2F0aW9uUHJlcGFyZSA/IChjdXJyZW50LHBoeXNpY2FsQ2hhbmdlZCkgPT4gcHJlcGFyZVB1YmxpY2F0aW9uKGZhbHNlLGN1cnJlbnQscGh5c2ljYWxDaGFuZ2VkKSA6IHVuZGVmaW5lZCk7XG4gICAgICAgICAgY29uc3QgY2hhbmdlZD10eXBlb2YgcmVzdWx0PT09J2Jvb2xlYW4nP3Jlc3VsdDpyZXN1bHQuY2hhbmdlZDtcbiAgICAgICAgICBjb25zdCBwaHlzaWNhbENoYW5nZWQ9dHlwZW9mIHJlc3VsdD09PSdib29sZWFuJz9yZXN1bHQ6cmVzdWx0LnBoeXNpY2FsQ2hhbmdlZDtcbiAgICAgICAgICBpZiAodHlwZW9mIHJlc3VsdCA9PT0gJ2Jvb2xlYW4nICYmIHBoeXNpY2FsQ2hhbmdlZCkgbWFya1NuYXBzaG90SW5zdGFsbGVkKGxvY2F0aW9uKTtcbiAgICAgICAgICBpZiAob2JzZXJ2ZXIpIG9ic2VydmVyKHtpbnRlbnQ6J3JlcGxhY2UnLGJlZm9yZTpiZWZvcmUgYXMgVCxhZnRlcjpjaGFuZ2VkID8gbmV4dCA6IGJlZm9yZSBhcyBULGNoYW5nZWQsY292ZXJlZFJlY2lwaWVudHM6dW5pdD8uY292ZXJlZFJlY2lwaWVudHN9KTtcbiAgICAgICAgICBpZiAocGh5c2ljYWxDaGFuZ2VkKSBwdWJsaXNoKFtiaW5kaW5nXSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7IGZhaWxlZCA9IHRydWU7IHRocm93IGVycm9yOyB9XG4gICAgICAgIGZpbmFsbHkge1xuICAgICAgICAgIGlmICh1bml0ICYmIHB1YmxpY2F0aW9uQ29tcGxldGUpIHtcbiAgICAgICAgICAgIHRyeSB7IHB1YmxpY2F0aW9uQ29tcGxldGUodW5pdC5jb21wbGV0aW9uKTsgfVxuICAgICAgICAgICAgY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgIGlmICghZmFpbGVkKSB0aHJvdyBlcnJvcjtcbiAgICAgICAgICAgICAgcmVwb3J0Q29udGFpbmVkT2JzZXJ2ZXJFcnJvcih7ZXJyb3Isb3BlcmF0aW9uOidub3RpZnk6c3Vic2NyaWJlcid9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBkZXJpdmU6ICh1cGRhdGUpID0+IHtcbiAgICAgICAgLy8gTmF0aXZlIHVwZGF0ZXIgaW5wdXQgYW5kIG9yZGluYXJ5IHJlY29yZGVkIHRydXRoIHN0YXkgc2VwYXJhdGUuXG4gICAgICAgIGNvbnN0IHB1YmxpY2F0aW9uSW5wdXQgPSBtdXRhdGlvblNvdXJjZTIuY2FwdHVyZVB1YmxpY2F0aW9uSW5wdXQ/LigpO1xuICAgICAgICBjb25zdCBjdXJyZW50ID0gcmVhZCgpO1xuICAgICAgICBjb25zdCBwdWJsaWNhdGlvblByZXBhcmUgPSBtdXRhdGlvblNvdXJjZTIucHJlcGFyZVB1YmxpY2F0aW9uO1xuICAgICAgICBjb25zdCBwdWJsaWNhdGlvbkNvbXBsZXRlID0gbXV0YXRpb25Tb3VyY2UyLmNvbXBsZXRlUHVibGljYXRpb247XG4gICAgICAgIGNvbnN0IGJlZm9yZSA9IG11dGF0aW9uU291cmNlMi5vYnNlcnZlciB8fCBwdWJsaWNhdGlvblByZXBhcmUgPyByZWFkKHRydWUpIDogY3VycmVudDtcbiAgICAgICAgY29uc3QgbmV4dCA9IHVwZGF0ZShjdXJyZW50KTtcbiAgICAgICAgbGV0IHVuaXQ6IFByZXBhcmVkUHVibGljYXRpb25Vbml0IHwgdW5kZWZpbmVkO1xuICAgICAgICBsZXQgdGVybWluYWw6IFRlcm1pbmFsUmVjb3JkUGxhbiB8IHVuZGVmaW5lZDtcbiAgICAgICAgY29uc3QgcHJlcGFyZVB1YmxpY2F0aW9uID0gKGNoYW5nZWQ6IGJvb2xlYW4sIHJldGFpbmVkOiBUID0gYmVmb3JlIGFzIFQscGh5c2ljYWxDaGFuZ2VkPWNoYW5nZWQpID0+IHtcbiAgICAgICAgICB1bml0ID0gcHVibGljYXRpb25QcmVwYXJlPy4oe2ludGVudDonZGVyaXZlJyxiZWZvcmUsYWZ0ZXI6Y2hhbmdlZCA/IG5leHQgOiByZXRhaW5lZCxjaGFuZ2VkLHBoeXNpY2FsQ2hhbmdlZCxwcmVwYXJlZFRlcm1pbmFsOnRlcm1pbmFsfSwgcHVibGljYXRpb25JbnB1dCk7XG4gICAgICAgICAgcmV0dXJuIHVuaXQ/LnJlY29yZDtcbiAgICAgICAgfTtcbiAgICAgICAgbGV0IGZhaWxlZCA9IGZhbHNlO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IHdyaXRlKG5leHQsICdkZXJpdmUnLCBwaHlzaWNhbENoYW5nZWQgPT4gY29tYmluZVRlcm1pbmFsUmVjb3JkcyhcbiAgICAgICAgICAgIHRlcm1pbmFsID0gbXV0YXRpb25Tb3VyY2UyLnByZXBhcmVUZXJtaW5hbD8uKHtpbnRlbnQ6J2Rlcml2ZScsYmVmb3JlLGFmdGVyOm5leHQsY2hhbmdlZDp0cnVlfSksXG4gICAgICAgICAgICBwcmVwYXJlUHVibGljYXRpb24odHJ1ZSxiZWZvcmUgYXMgVCxwaHlzaWNhbENoYW5nZWQpXG4gICAgICAgICAgKSwgcHVibGljYXRpb25QcmVwYXJlID8gKGN1cnJlbnQscGh5c2ljYWxDaGFuZ2VkKSA9PiBwcmVwYXJlUHVibGljYXRpb24oZmFsc2UsY3VycmVudCxwaHlzaWNhbENoYW5nZWQpIDogdW5kZWZpbmVkKTtcbiAgICAgICAgICBjb25zdCBjaGFuZ2VkPXR5cGVvZiByZXN1bHQ9PT0nYm9vbGVhbic/cmVzdWx0OnJlc3VsdC5jaGFuZ2VkO1xuICAgICAgICAgIGNvbnN0IHBoeXNpY2FsQ2hhbmdlZD10eXBlb2YgcmVzdWx0PT09J2Jvb2xlYW4nP3Jlc3VsdDpyZXN1bHQucGh5c2ljYWxDaGFuZ2VkO1xuICAgICAgICAgIGlmICh0eXBlb2YgcmVzdWx0ID09PSAnYm9vbGVhbicgJiYgcGh5c2ljYWxDaGFuZ2VkKSBtYXJrU25hcHNob3RJbnN0YWxsZWQobG9jYXRpb24pO1xuICAgICAgICAgIG11dGF0aW9uU291cmNlMi5vYnNlcnZlcj8uKHtpbnRlbnQ6J2Rlcml2ZScsYmVmb3JlLGFmdGVyOmNoYW5nZWQgPyBuZXh0IDogYmVmb3JlLGNoYW5nZWQsY292ZXJlZFJlY2lwaWVudHM6dW5pdD8uY292ZXJlZFJlY2lwaWVudHN9KTtcbiAgICAgICAgICBpZiAocGh5c2ljYWxDaGFuZ2VkKSBwdWJsaXNoKFtiaW5kaW5nXSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7IGZhaWxlZCA9IHRydWU7IHRocm93IGVycm9yOyB9XG4gICAgICAgIGZpbmFsbHkge1xuICAgICAgICAgIGlmICh1bml0ICYmIHB1YmxpY2F0aW9uQ29tcGxldGUpIHtcbiAgICAgICAgICAgIHRyeSB7IHB1YmxpY2F0aW9uQ29tcGxldGUodW5pdC5jb21wbGV0aW9uKTsgfVxuICAgICAgICAgICAgY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgIGlmICghZmFpbGVkKSB0aHJvdyBlcnJvcjtcbiAgICAgICAgICAgICAgcmVwb3J0Q29udGFpbmVkT2JzZXJ2ZXJFcnJvcih7ZXJyb3Isb3BlcmF0aW9uOidub3RpZnk6c3Vic2NyaWJlcid9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgfTtcbiAgICByZWdpc3RlcldyaXRhYmxlTG9jYXRpb25CaW5kaW5nKGJpbmRpbmcpO1xuXG4gICAgLy8gTmV2ZXIgdGhlIHN0b3JlZCByZWFkOiBgcGVla2AgaXMgcHVibGljIGFuZCB0YWtlcyBubyBhcmd1bWVudC5cbiAgICBsb2NhdGlvbi5wZWVrID0gKCkgPT4gcmVhZCgpO1xuICAgIGxvY2F0aW9uLnN1YnNjcmliZSA9IChsaXN0ZW5lcikgPT4ge1xuICAgICAgbGlzdGVuZXJzLmFkZChsaXN0ZW5lcik7XG4gICAgICByZXR1cm4gKCkgPT4gbGlzdGVuZXJzLmRlbGV0ZShsaXN0ZW5lcik7XG4gICAgfTtcbiAgICBsb2NhdGlvbi5hc1JlYWRvbmx5ID0gKCkgPT4gbG9jYXRpb247XG4gICAgcmV0dXJuIGJpbmRpbmc7XG4gIH07XG5cbiAgY29uc3QgY3JlYXRlQ2VsbCA9IDxUPihcbiAgICBpbml0aWFsOiBULFxuICAgIGVxdWFsOiAobGVmdDogVCwgcmlnaHQ6IFQpID0+IGJvb2xlYW4gPSBPYmplY3QuaXNcbiAgKTogTG9jYXRpb248VD4gPT4ge1xuICAgIGxldCB2YWx1ZSA9IGluaXRpYWw7XG4gICAgY29uc3QgYmluZGluZyA9IGNyZWF0ZVdyaXRhYmxlKFxuICAgICAgKCkgPT4gdmFsdWUsXG4gICAgICAobmV4dCkgPT4ge1xuICAgICAgICBpZiAoZXF1YWwodmFsdWUsIG5leHQpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHZhbHVlID0gbmV4dDtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgKTtcbiAgICByZXR1cm4gYmluZGluZy5sb2NhdGlvbjtcbiAgfTtcblxuICBjb25zdCBjcmVhdGVEZXJpdmVkID0gPFQ+KGNvbXB1dGU6ICgpID0+IFQpOiBSZWFkb25seUxvY2F0aW9uPFQ+ID0+IHtcbiAgICBsZXQgaW5pdGlhbGl6ZWQgPSBmYWxzZTtcbiAgICBsZXQgZGlydHkgPSB0cnVlO1xuICAgIGxldCBjb21wdXRhdGlvbkZhaWxlZCA9IGZhbHNlO1xuICAgIGxldCB2YWx1ZTogVDtcbiAgICBsZXQgb2JzZXJ2YXRpb25Ub2tlbjogT2JzZXJ2YXRpb25Ub2tlbiB8IHVuZGVmaW5lZDtcbiAgICBjb25zdCBsaXN0ZW5lcnMgPSBuZXcgU2V0PCgpID0+IHZvaWQ+KCk7XG4gICAgY29uc3Qgbm9kZTogRGVwZW5kZW5jeU5vZGUgPSB7XG4gICAgICBjb25zdW1lcnM6IG5ldyBTZXQoKSxcbiAgICAgIGxldmVsOiAwLFxuICAgICAgdmVyc2lvbjogMCxcbiAgICAgIHJlZnJlc2g6ICgpID0+IHVuZGVmaW5lZCxcbiAgICB9O1xuICAgIGNvbnN0IHRva2VuID0gKCkgPT4gKG9ic2VydmF0aW9uVG9rZW4gPz89IHJlYWxpemF0aW9uLmNyZWF0ZVRva2VuKCkpO1xuICAgIGNvbnN0IGNvbnN1bWVyOiBEZXBlbmRlbmN5Q29uc3VtZXIgPSB7XG4gICAgICBkZXBlbmRlbmNpZXM6IG5ldyBNYXAoKSxcbiAgICAgIGxldmVsOiAxLFxuICAgICAgaW52YWxpZGF0ZTogKCkgPT4ge1xuICAgICAgICBpZiAoZGlydHkpIHtcbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICBsaXN0ZW5lcnMuc2l6ZSA+IDAgfHxcbiAgICAgICAgICAgIChoYXNSZWFjdGl2ZU9ic2VydmF0aW9uICYmIG9ic2VydmF0aW9uVG9rZW4pXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICBwZW5kaW5nQ29uc3VtZXJzLmFkZChjb25zdW1lcik7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBkaXJ0eSA9IHRydWU7XG4gICAgICAgIG5vdGlmeURlcGVuZGVudHMobm9kZSk7XG4gICAgICAgIGlmIChcbiAgICAgICAgICBsaXN0ZW5lcnMuc2l6ZSA+IDAgfHxcbiAgICAgICAgICAoaGFzUmVhY3RpdmVPYnNlcnZhdGlvbiAmJiBvYnNlcnZhdGlvblRva2VuKVxuICAgICAgICApIHtcbiAgICAgICAgICBwZW5kaW5nQ29uc3VtZXJzLmFkZChjb25zdW1lcik7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBzZXR0bGU6ICgpID0+IHtcbiAgICAgICAgaWYgKCFkaXJ0eSkgcmV0dXJuO1xuICAgICAgICBjb25zdCBwcmV2aW91cyA9IHZhbHVlO1xuICAgICAgICBjb25zdCB3YXNJbml0aWFsaXplZCA9IGluaXRpYWxpemVkO1xuICAgICAgICByZWFkQ3VycmVudCgpO1xuICAgICAgICBpZiAod2FzSW5pdGlhbGl6ZWQgJiYgIU9iamVjdC5pcyhwcmV2aW91cywgdmFsdWUpKSB7XG4gICAgICAgICAgcHVibGlzaGVyLm5vdGlmeSgpO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgIH07XG4gICAgZGVwZW5kZW5jeUZpbmFsaXplci5yZWdpc3Rlcihjb25zdW1lciwgY29uc3VtZXIuZGVwZW5kZW5jaWVzKTtcbiAgICBjb25zdCBwdWJsaXNoZXI6IExvY2F0aW9uUHVibGlzaGVyID0ge1xuICAgICAgbm90aWZ5OiAoKSA9PiB7XG4gICAgICAgIG5vdGlmeU9ic2VydmVycyhvYnNlcnZhdGlvblRva2VuLCBsaXN0ZW5lcnMpO1xuICAgICAgfSxcbiAgICB9O1xuXG4gICAgY29uc3QgcmVhZEN1cnJlbnQgPSAoKTogVCA9PiB7XG4gICAgICBpZiAoIWRpcnR5ICYmIGluaXRpYWxpemVkKSByZXR1cm4gdmFsdWU7XG5cbiAgICAgIGlmIChpbml0aWFsaXplZCAmJiAhY29tcHV0YXRpb25GYWlsZWQpIHtcbiAgICAgICAgbGV0IGNoYW5nZWQgPSBmYWxzZTtcbiAgICAgICAgZm9yIChjb25zdCBbZGVwZW5kZW5jeSwgZWRnZV0gb2YgY29uc3VtZXIuZGVwZW5kZW5jaWVzKSB7XG4gICAgICAgICAgZGVwZW5kZW5jeS5yZWZyZXNoKCk7XG4gICAgICAgICAgaWYgKGRlcGVuZGVuY3kudmVyc2lvbiAhPT0gZWRnZS52ZXJzaW9uKSBjaGFuZ2VkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIWNoYW5nZWQpIHtcbiAgICAgICAgICBkaXJ0eSA9IGZhbHNlO1xuICAgICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBmb3IgKGNvbnN0IFtkZXBlbmRlbmN5LCBlZGdlXSBvZiBjb25zdW1lci5kZXBlbmRlbmNpZXMpIHtcbiAgICAgICAgZGVwZW5kZW5jeS5jb25zdW1lcnMuZGVsZXRlKGVkZ2UucmVmZXJlbmNlKTtcbiAgICAgIH1cbiAgICAgIGNvbnN1bWVyLmRlcGVuZGVuY2llcy5jbGVhcigpO1xuICAgICAgY29uc3VtZXIubGV2ZWwgPSAxO1xuICAgICAgY29uc3QgcHJldmlvdXMgPSB2YWx1ZTtcbiAgICAgIGNvbnN0IHdhc0luaXRpYWxpemVkID0gaW5pdGlhbGl6ZWQ7XG4gICAgICBjb25zdCBwcmV2aW91c0NvbnN1bWVyID0gYWN0aXZlQ29uc3VtZXI7XG4gICAgICBhY3RpdmVDb25zdW1lciA9IGNvbnN1bWVyO1xuICAgICAgdHJ5IHtcbiAgICAgICAgdmFsdWUgPSBjb21wdXRlKCk7XG4gICAgICAgIG5vZGUubGV2ZWwgPSBjb25zdW1lci5sZXZlbDtcbiAgICAgICAgaW5pdGlhbGl6ZWQgPSB0cnVlO1xuICAgICAgICBkaXJ0eSA9IGZhbHNlO1xuICAgICAgICBjb21wdXRhdGlvbkZhaWxlZCA9IGZhbHNlO1xuICAgICAgICBpZiAod2FzSW5pdGlhbGl6ZWQgJiYgIU9iamVjdC5pcyhwcmV2aW91cywgdmFsdWUpKSB7XG4gICAgICAgICAgbm9kZS52ZXJzaW9uICs9IDE7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29tcHV0YXRpb25GYWlsZWQgPSB0cnVlO1xuICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgIH0gZmluYWxseSB7XG4gICAgICAgIGFjdGl2ZUNvbnN1bWVyID0gcHJldmlvdXNDb25zdW1lcjtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgbm9kZS5yZWZyZXNoID0gKCkgPT4ge1xuICAgICAgaWYgKGRpcnR5KSByZWFkQ3VycmVudCgpO1xuICAgIH07XG5cbiAgICBjb25zdCBsb2NhdGlvbiA9IG1hcmtUcmVlQ2VsbCgoKCkgPT4ge1xuICAgICAgY29uc3QgY3VycmVudCA9IHJlYWRDdXJyZW50KCk7XG4gICAgICB0cmFja0RlcGVuZGVuY3kobm9kZSwgdG9rZW4pO1xuICAgICAgcmV0dXJuIGN1cnJlbnQ7XG4gICAgfSkgYXMgUmVhZG9ubHlMb2NhdGlvbjxUPik7XG4gICAgbG9jYXRpb24ucGVlayA9IHJlYWRDdXJyZW50O1xuICAgIGxvY2F0aW9uLnN1YnNjcmliZSA9IChsaXN0ZW5lcikgPT4ge1xuICAgICAgcmVhZEN1cnJlbnQoKTtcbiAgICAgIGxpc3RlbmVycy5hZGQobGlzdGVuZXIpO1xuICAgICAgcmV0dXJuICgpID0+IGxpc3RlbmVycy5kZWxldGUobGlzdGVuZXIpO1xuICAgIH07XG4gICAgcmV0dXJuIGxvY2F0aW9uO1xuICB9O1xuXG4gIC8qKlxuICAgKiBgU1VCSkVDVC1FUE9DSC0wYCwgbmV1dHJhbCBpbXBsZW1lbnRhdGlvbi5cbiAgICpcbiAgICogVGhpcyBzdGFydGVkIGFzIGEgd3JhcHBlciBhcm91bmQgYGNyZWF0ZUNlbGxgLCBhbmQgdGhhdCB3YXMgd3JvbmcgZm9yIGFcbiAgICogcmVhc29uIHdvcnRoIHJlY29yZGluZzogUkVBQ1QgVVNFUyBUSElTIFJVTlRJTUUuIEl0IGhhcyBubyBmcmFtZXdvcmstbmF0aXZlXG4gICAqIHBlcnNpc3RlbnQgc2lnbmFscyBieSBkZXNpZ24sIHNvIGJhY2tpbmcgYW4gZXBvY2ggd2l0aCBhIGZ1bGwgYExvY2F0aW9uYFxuICAgKiBjb3N0IFJlYWN0ICszMDQgQi9lbnRpdHkgd2hpbGUgQW5ndWxhciBhbmQgVnVlIHdlcmUgd2lubmluZyDigJQgcGF5aW5nIGZvciBhblxuICAgKiBlcG9jaCBvbiB0b3Agb2YgbG9zaW5nIG5vdGhpbmcuXG4gICAqXG4gICAqIEEgZGVwZW5kZW5jeSBub2RlLCBhIHZlcnNpb24sIGFuZCBhIHB1Ymxpc2hlciBpcyB0aGUgd2hvbGUgcmVxdWlyZW1lbnQuIE5vXG4gICAqIHdyaXRlIGJpbmRpbmcsIG5vIGJpbmRpbmcgcmVnaXN0cnkgZW50cnksIG5vIG11dGF0aW9uIHNvdXJjZSwgbm9cbiAgICogcGVlay9zdWJzY3JpYmUgc3VyZmFjZS4gSXQgc3RpbGwgcm91dGVzIHRoZSBhZHZhbmNlIHRocm91Z2ggYHB1Ymxpc2hgIHNvIGFuXG4gICAqIGludmFsaWRhdGlvbiBncm91cCBiYXRjaGVzIGl0IGV4YWN0bHkgbGlrZSBldmVyeSBvdGhlciBwdWJsaWNhdGlvbi5cbiAgICovXG4gIGNvbnN0IGNyZWF0ZUVwb2NoID0gKCk6IEVwb2NoSGFuZGxlID0+IHtcbiAgICBsZXQgb2JzZXJ2YXRpb25Ub2tlbjogT2JzZXJ2YXRpb25Ub2tlbiB8IHVuZGVmaW5lZDtcbiAgICBsZXQgdmVyc2lvbiA9IDA7XG4gICAgY29uc3QgdG9rZW4gPSAoKSA9PiAob2JzZXJ2YXRpb25Ub2tlbiA/Pz0gcmVhbGl6YXRpb24uY3JlYXRlVG9rZW4oKSk7XG4gICAgY29uc3Qgbm9kZTogRGVwZW5kZW5jeU5vZGUgPSB7XG4gICAgICBjb25zdW1lcnM6IG5ldyBTZXQoKSxcbiAgICAgIGxldmVsOiAwLFxuICAgICAgdmVyc2lvbjogMCxcbiAgICAgIHJlZnJlc2g6ICgpID0+IHVuZGVmaW5lZCxcbiAgICB9O1xuICAgIGNvbnN0IHB1Ymxpc2hlcjogTG9jYXRpb25QdWJsaXNoZXIgPSB7XG4gICAgICBub3RpZnk6ICgpID0+IHtcbiAgICAgICAgbm9kZS52ZXJzaW9uICs9IDE7XG4gICAgICAgIG5vdGlmeURlcGVuZGVudHMobm9kZSk7XG4gICAgICAgIG5vdGlmeU9ic2VydmVycyhvYnNlcnZhdGlvblRva2VuLCBOT19MSVNURU5FUlMpO1xuICAgICAgfSxcbiAgICB9O1xuICAgIGNvbnN0IGVwb2NoID0gKCgpID0+IHtcbiAgICAgIHRyYWNrRGVwZW5kZW5jeShub2RlLCB0b2tlbik7XG4gICAgICByZXR1cm4gdmVyc2lvbjtcbiAgICB9KSBhcyBXcml0YWJsZUNlbGw8bnVtYmVyPjtcbiAgICBlcG9jaC5zZXQgPSAobmV4dDogbnVtYmVyKSA9PiB7XG4gICAgICBpZiAobmV4dCA9PT0gdmVyc2lvbikgcmV0dXJuO1xuICAgICAgdmVyc2lvbiA9IG5leHQ7XG4gICAgICBwdWJsaXNoKFtwdWJsaXNoZXJdKTtcbiAgICB9O1xuICAgIGVwb2NoLnVwZGF0ZSA9IChmbjogKGN1cnJlbnQ6IG51bWJlcikgPT4gbnVtYmVyKSA9PiBlcG9jaC5zZXQoZm4odmVyc2lvbikpO1xuICAgIGVwb2NoLmFzUmVhZG9ubHkgPSAoKSA9PiBlcG9jaDtcbiAgICByZXR1cm4gZXBvY2ggYXMgdW5rbm93biBhcyBFcG9jaEhhbmRsZTtcbiAgfTtcblxuICBjb25zdCBhZHZhbmNlRXBvY2ggPSAoaGFuZGxlOiBFcG9jaEhhbmRsZSk6IHZvaWQgPT4ge1xuICAgIChoYW5kbGUgYXMgdW5rbm93biBhcyBXcml0YWJsZUNlbGw8bnVtYmVyPikudXBkYXRlKCh2KSA9PiB2ICsgMSk7XG4gIH07XG5cbiAgcmV0dXJuIHtcbiAgICBjcmVhdGVDZWxsLFxuICAgIGNyZWF0ZURlcml2ZWQsXG4gICAgY3JlYXRlQ3VycmVudFJlYWRvbmx5OiA8VD4ocmVhZDogKCkgPT4gVCk6IFJlYWRhYmxlQ2VsbDxUPiA9PlxuICAgICAgcmVhbGl6YXRpb24uY3JlYXRlQ3VycmVudFJlYWRvbmx5Q2VsbFxuICAgICAgICA/IHJlYWxpemF0aW9uLmNyZWF0ZUN1cnJlbnRSZWFkb25seUNlbGwocmVhZClcbiAgICAgICAgOiByZWFkLFxuICAgIGNyZWF0ZVdyaXRhYmxlLFxuICAgIGNyZWF0ZUVwb2NoLFxuICAgIGFkdmFuY2VFcG9jaCxcbiAgICBwdWJsaXNoLFxuICAgIHJ1bkludmFsaWRhdGlvbkdyb3VwLFxuICB9O1xufVxuXG5leHBvcnQgY29uc3QgTkVVVFJBTF9MT0NBVElPTl9SVU5USU1FID0gY3JlYXRlTG9jYXRpb25SdW50aW1lKFxuICBORVVUUkFMX09CU0VSVkFUSU9OX0FEQVBURVJcbik7XG5cbmV4cG9ydCBmdW5jdGlvbiBuZWVkc0xvY2F0aW9uQXV0aG9yaXR5QWRtaXNzaW9uKHZhbHVlOm9iamVjdCk6Ym9vbGVhbiB7cmV0dXJuIFdSSVRBQkxFX0xPQ0FUSU9OX0JJTkRJTkdTLmdldCh2YWx1ZSk/Lm5lZWRzQXV0aG9yaXR5QWRtaXNzaW9uPy4oKSA/PyBmYWxzZTt9XG4iXSwiZmlsZSI6Ii9zcmMvbGliL2ludGVybmFscy9sb2NhdGlvbi1ydW50aW1lLnRzIn0=

//# vitestCache=W3siZmlsZSI6IjEiLCJpZCI6IjEiLCJ1cmwiOiIyIiwiaW1wb3J0ZWRVcmxzIjoiMyIsIm1hcHBpbmdzIjpmYWxzZX0sIi9wcml2YXRlL3RtcC9zdC1jMjgtcjMtc2FtcGxlZC1hbGxvY2F0aW9uL2Jhc2VsaW5lL2NhbmRpZGF0ZS9wYWNrYWdlcy9rZXJuZWwvc3JjL2xpYi9pbnRlcm5hbHMvbG9jYXRpb24tcnVudGltZS50cyIsIi9zcmMvbGliL2ludGVybmFscy9sb2NhdGlvbi1ydW50aW1lLnRzIixbXV0=
}}