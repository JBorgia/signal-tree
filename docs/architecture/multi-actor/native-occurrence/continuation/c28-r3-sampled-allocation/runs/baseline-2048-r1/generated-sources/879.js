'use strict';async (__vite_ssr_exports__,__vite_ssr_import_meta__,__vite_ssr_import__,__vite_ssr_dynamic_import__,__vite_ssr_exportAll__,__vite_ssr_exportName__,__filename,__dirname,module,exports,require)=>{{Object.defineProperty(__vite_ssr_exports__, "interceptLeafSignals", { enumerable: true, configurable: true, get(){ try { return interceptLeafSignals } catch {} }});
const __vite_ssr_import_0__ = await __vite_ssr_import__("/src/lib/internals/scalar-publication-coverage.ts", {"importedNames":["withScalarPublicationCoverage"]});
const __vite_ssr_import_1__ = await __vite_ssr_import__("/src/lib/internals/node-shape.ts", {"importedNames":["isTraversableNode"]});
const __vite_ssr_import_2__ = await __vite_ssr_import__("/src/lib/internals/materialize-markers.ts", {"importedNames":["getNodeProcessor","snapshotMarkerNode"]});
const __vite_ssr_import_3__ = await __vite_ssr_import__("/src/lib/internals/owned-metadata.ts", {"importedNames":["getOwnedOwnerPath","getOwnedPositionIds","getOwnedSubjectIds","hasIntrinsicMutationEmitter"]});





const __vite_ssr_import_4__ = await __vite_ssr_import__("/src/lib/write-context.ts", {"importedNames":["getActiveWriteContext"]});
const __vite_ssr_import_5__ = await __vite_ssr_import__("/src/lib/internals/location-runtime.ts", {"importedNames":["isWritableLocation"]});
const __vite_ssr_import_6__ = await __vite_ssr_import__("/src/lib/internals/intrinsic-mutation.ts", {"importedNames":["prepareTerminalMutations","observeIntrinsicMutations"]});
const __vite_ssr_import_7__ = await __vite_ssr_import__("/src/lib/internals/visit-tree.ts", {"importedNames":["visitTree"]});
function interceptLeafSignals(root, onWrite, options = {}) {
  const restorers = [];
  const maxDepth = options.maxDepth ?? 32;
  const withMutationIntent = (meta, mutationIntent) => ({
    ...meta ?? {},
    mutationIntent
  });
  const getOwnerPath = (node, path) => {
    return (0,__vite_ssr_import_3__.getOwnedOwnerPath)(node) ?? path;
  };
  const getSubjectIds = (node) => {
    return (0,__vite_ssr_import_3__.getOwnedSubjectIds)(node);
  };
  const getPositionIds = (node) => {
    return (0,__vite_ssr_import_3__.getOwnedPositionIds)(node);
  };
  const wrapWritableSignal = (node, path, ownerPathOverride) => {
    const original = node;
    const originalSet = original.set.bind(original);
    const originalUpdate = original.update.bind(original);
    restorers.push(() => {
      original.set = originalSet;
      original.update = originalUpdate;
    });
    original.set = (value) => {
      const prev = original();
      originalSet(value);
      const next = original();
      const ownerPath = ownerPathOverride ?? getOwnerPath(node, path);
      const subjectIds = getSubjectIds(node);
      const positionIds = getPositionIds(node);
      if (next !== prev) {
        onWrite(
          path,
          next,
          prev,
          withMutationIntent((0,__vite_ssr_import_4__.getActiveWriteContext)(), "replace"),
          ownerPath,
          subjectIds,
          positionIds
        );
      }
    };
    original.update = (updater) => {
      const prev = original();
      originalUpdate(updater);
      const next = original();
      const ownerPath = ownerPathOverride ?? getOwnerPath(node, path);
      const subjectIds = getSubjectIds(node);
      const positionIds = getPositionIds(node);
      if (next !== prev) {
        onWrite(
          path,
          next,
          prev,
          withMutationIntent((0,__vite_ssr_import_4__.getActiveWriteContext)(), "derive"),
          ownerPath,
          subjectIds,
          positionIds
        );
      }
    };
  };
  const observeLocation = (node, path, ownerPathOverride, normal = true) => {
    const release = normal ? (0,__vite_ssr_import_6__.observeIntrinsicMutations)(node, (mutation) => {
      if (!mutation.changed) return;
      onWrite(
        path,
        mutation.after,
        mutation.before,
        (0,__vite_ssr_import_0__.withScalarPublicationCoverage)(withMutationIntent((0,__vite_ssr_import_4__.getActiveWriteContext)(), mutation.intent), mutation.coveredRecipients),
        ownerPathOverride ?? getOwnerPath(node, path),
        getSubjectIds(node),
        getPositionIds(node)
      );
    }) : void 0;
    const terminalRecord = options.terminalRecord;
    if (terminalRecord) {
      const terminalRelease = (0,__vite_ssr_import_6__.prepareTerminalMutations)(node, (mutation) => {
        if (!mutation.changed) return;
        return terminalRecord.call(options, path, mutation.after, mutation.before, withMutationIntent((0,__vite_ssr_import_4__.getActiveWriteContext)(), mutation.intent), ownerPathOverride ?? getOwnerPath(node, path), getSubjectIds(node), getPositionIds(node));
      });
      if (terminalRelease) restorers.push(terminalRelease);
    };
    const beforePublication = options.beforePublication;
    if (beforePublication) {
      const captureRelease = (0,__vite_ssr_import_6__.observeIntrinsicMutations)(node, (mutation) => {
        if (!mutation.changed) return;
        beforePublication.call(
          options,
          path,
          mutation.after,
          mutation.before,
          (0,__vite_ssr_import_0__.withScalarPublicationCoverage)(withMutationIntent((0,__vite_ssr_import_4__.getActiveWriteContext)(), mutation.intent), mutation.coveredRecipients),
          ownerPathOverride ?? getOwnerPath(node, path),
          getSubjectIds(node),
          getPositionIds(node)
        );
      }, true);
      if (captureRelease) restorers.push(captureRelease);
    };
    if (release) restorers.push(release);
  };
  const wrapOwnedFieldAccessors = (node, basePath, ownerPath, seen = /* @__PURE__ */ new WeakSet()) => {
    if (!(0,__vite_ssr_import_1__.isTraversableNode)(node)) {
      return;
    };
    const ref = node;
    if (seen.has(ref)) return;
    seen.add(ref);
    const isWritableSignal = typeof node === "function" && "set" in node && "update" in node && // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeof node.set === "function" && // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeof node.update === "function";
    if (isWritableSignal) {
      wrapWritableSignal(node, basePath, ownerPath);
    };
    for (const key of Object.keys(node)) {
      const child = node[key];
      if (child !== null && typeof child === "object" && !(Array.isArray(child) || child instanceof Date || child instanceof Map || child instanceof Set)) {
        wrapOwnedFieldAccessors(child, `${basePath}.${key}`, ownerPath, seen);
      } else if (typeof child === "function") {
        wrapOwnedFieldAccessors(child, `${basePath}.${key}`, ownerPath, seen);
      }
    }
  };
  const wrapMutator = (target, method, path) => {
    if (typeof target[method] !== "function") return;
    const originalMethod = target[method].bind(target);
    restorers.push(() => {
      target[method] = originalMethod;
    });
    target[method] = (...args) => {
      const canSnapshotMutatorState = typeof target.__findKeyBySubjectId !== "function";
      const prevSnapshot = canSnapshotMutatorState ? (0,__vite_ssr_import_2__.snapshotMarkerNode)(target)?.value : void 0;
      const result = originalMethod(...args);
      const nextSnapshot = canSnapshotMutatorState ? (0,__vite_ssr_import_2__.snapshotMarkerNode)(target)?.value : void 0;
      onWrite(
        path,
        nextSnapshot,
        prevSnapshot,
        (0,__vite_ssr_import_4__.getActiveWriteContext)(),
        path,
        getSubjectIds(target),
        getPositionIds(target)
      );
      return result;
    };
  };
  try {
    (0,__vite_ssr_import_7__.visitTree)(
      root,
      (node, path) => {
        if (path === "") return true;
        if ((0,__vite_ssr_import_5__.isWritableLocation)(node)) {
          if (!(0,__vite_ssr_import_3__.hasIntrinsicMutationEmitter)(node) || options.beforePublication) {
            observeLocation(node, path, void 0, !(0,__vite_ssr_import_3__.hasIntrinsicMutationEmitter)(node));
          };
          return false;
        };
        const isWritableSignal = typeof node === "function" && "set" in node && "update" in node && // eslint-disable-next-line @typescript-eslint/no-explicit-any
        typeof node.set === "function" && // eslint-disable-next-line @typescript-eslint/no-explicit-any
        typeof node.update === "function";
        if (isWritableSignal) {
          const isEntityCollection = "add" in node || "remove" in node;
          if (isEntityCollection) return false;
          const hasOwnedMutationEmitter = (0,__vite_ssr_import_3__.hasIntrinsicMutationEmitter)(node);
          if (hasOwnedMutationEmitter) {
            return false;
          };
          wrapWritableSignal(node, path);
          const proc2 = (0,__vite_ssr_import_2__.getNodeProcessor)(node);
          if (proc2 && (0,__vite_ssr_import_1__.isTraversableNode)(node)) {
            for (const method of ["clear", "reload", "reset", "refresh"]) {
              wrapMutator(node, method, path);
            }
          };
          return false;
        };
        const proc = (0,__vite_ssr_import_2__.getNodeProcessor)(node);
        if (proc && (0,__vite_ssr_import_3__.hasIntrinsicMutationEmitter)(node)) {
          return false;
        };
        if (proc && (0,__vite_ssr_import_1__.isTraversableNode)(node)) {
          const marker = node;
          const MUTATORS = [
            "set",
            "patch",
            "setAll",
            "addOne",
            "addMany",
            "prependMany",
            "updateOne",
            "updateMany",
            "upsertOne",
            "upsertMany",
            "changeId",
            "removeOne",
            "removeMany",
            "clear",
            "setLoading",
            "setLoaded",
            "setError",
            "setNotLoaded",
            "start",
            "setSuccess",
            "succeed",
            "fail",
            "refresh",
            "rerun",
            "reset"
          ];
          for (const method of MUTATORS) {
            wrapMutator(marker, method, path);
          };
          const fields = marker.$;
          if (fields && (0,__vite_ssr_import_1__.isTraversableNode)(fields)) {
            wrapOwnedFieldAccessors(fields, path, path);
          };
          return false;
        };
        if (typeof node === "object" && (Array.isArray(node) || node instanceof Date || node instanceof Map || node instanceof Set)) {
          return false;
        };
        return true;
      },
      { maxDepth }
    );
  } catch {
  };
  return () => {
    for (const restore of restorers) {
      try {
        restore();
      } catch {
      }
    };
    restorers.length = 0;
  };
}
//# sourceMappingSource=vite-generated
//# sourceMappingURL=data:application/json;base64,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WUFDQTtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsVUFDRjtBQUNBLHFCQUFXLFVBQVUsVUFBVTtBQUM3Qix3QkFBWSxRQUFtQyxRQUFRLElBQUk7QUFBQSxVQUM3RDtBQUNBLGdCQUFNLFNBQVMsT0FBTztBQUN0QixjQUFJLGFBQVUseUNBQWtCLE1BQU0sR0FBRztBQUN2QyxvQ0FBd0IsUUFBUSxNQUFNLElBQUk7QUFBQSxVQUM1QztBQUNBLGlCQUFPO0FBQUEsUUFDVDtBQUdBLFlBQ0UsT0FBTyxTQUFTLGFBQ2YsTUFBTSxRQUFRLElBQUksS0FDakIsZ0JBQWdCLFFBQ2hCLGdCQUFnQixPQUNoQixnQkFBZ0IsTUFDbEI7QUFDQSxpQkFBTztBQUFBLFFBQ1Q7QUFFQSxlQUFPO0FBQUEsTUFDVDtBQUFBLE1BQ0EsRUFBRSxTQUFTO0FBQUEsSUFDYjtBQUFBLEVBQ0YsUUFBUTtBQUFBLEVBRVI7QUFFQSxTQUFPLE1BQU07QUFDWCxlQUFXLFdBQVcsV0FBVztBQUMvQixVQUFJO0FBQ0YsZ0JBQVE7QUFBQSxNQUNWLFFBQVE7QUFBQSxNQUVSO0FBQUEsSUFDRjtBQUNBLGNBQVUsU0FBUztBQUFBLEVBQ3JCO0FBQ0YiLCJuYW1lcyI6WyJwcm9jIl0sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VzIjpbImludGVyY2VwdC1sZWFmLXNpZ25hbHMudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgd2l0aFNjYWxhclB1YmxpY2F0aW9uQ292ZXJhZ2UgfSBmcm9tICcuL3NjYWxhci1wdWJsaWNhdGlvbi1jb3ZlcmFnZSc7XG5pbXBvcnQgdHlwZSB7IFdyaXRlTWV0YWRhdGEgfSBmcm9tICcuLi9tdXRhdGlvbi10eXBlcyc7XG5pbXBvcnQgeyBpc1RyYXZlcnNhYmxlTm9kZSB9IGZyb20gJy4vbm9kZS1zaGFwZSc7XG5pbXBvcnQgeyBnZXROb2RlUHJvY2Vzc29yLCBzbmFwc2hvdE1hcmtlck5vZGUgfSBmcm9tICcuL21hdGVyaWFsaXplLW1hcmtlcnMnO1xuaW1wb3J0IHtcbiAgZ2V0T3duZWRPd25lclBhdGgsXG4gIGdldE93bmVkUG9zaXRpb25JZHMsXG4gIGdldE93bmVkU3ViamVjdElkcyxcbiAgaGFzSW50cmluc2ljTXV0YXRpb25FbWl0dGVyLFxufSBmcm9tICcuL293bmVkLW1ldGFkYXRhJztcbmltcG9ydCB7IGdldEFjdGl2ZVdyaXRlQ29udGV4dCB9IGZyb20gJy4uL3dyaXRlLWNvbnRleHQnO1xuaW1wb3J0IHsgaXNXcml0YWJsZUxvY2F0aW9uIH0gZnJvbSAnLi9sb2NhdGlvbi1ydW50aW1lJztcbmltcG9ydCB7IHByZXBhcmVUZXJtaW5hbE11dGF0aW9ucywgdHlwZSBUZXJtaW5hbFJlY29yZFBsYW4sIG9ic2VydmVJbnRyaW5zaWNNdXRhdGlvbnMgfSBmcm9tICcuL2ludHJpbnNpYy1tdXRhdGlvbic7XG5cbmltcG9ydCB7IHZpc2l0VHJlZSB9IGZyb20gJy4vdmlzaXQtdHJlZSc7XG5cbi8qKlxuICogUmVjdXJzaXZlbHkgd2FsayBhIGxvY2F0aW9uIHRyZWUgYW5kIG9ic2VydmUgZXZlcnkgd3JpdGFibGUgbG9jYXRpb24nc1xuICogaW50cmluc2ljIG11dGF0aW9uIGNoYW5uZWwgc28gY2FsbGVycyBjYW4gb2JzZXJ2ZSBkaXJlY3Qgd3JpdGVzLlxuICpcbiAqIEJhY2tncm91bmQ6IFNpZ25hbFRyZWUncyByZWN1cnNpdmUgdXBkYXRlIHBpcGVsaW5lIHdyaXRlcyB0byBsb2NhdGlvbnNcbiAqIGRpcmVjdGx5IHdpdGhvdXQgaW52b2tpbmcgUGF0aE5vdGlmaWVyLiBFbnRpdHkgY29sbGVjdGlvbnMgbm90aWZ5IHRocm91Z2hcbiAqIHRoZWlyIG93biBpbnRlcm5hbHMsIGJ1dCBhIGRpcmVjdCBjYWxsIGxpa2UgYHRyZWUuJC51c2VyLnByb2ZpbGUubmFtZSh4KWBcbiAqIG5ldmVyIHByb2R1Y2VzIGEgUGF0aE5vdGlmaWVyIGV2ZW50IGJ5IGl0c2VsZi4gRW5oYW5jZXJzIHRoYXQgbmVlZCB0b1xuICogb2JzZXJ2ZSBldmVyeSBtdXRhdGlvbiAoRGV2VG9vbHMsIHJlc3RvcmF0aW9uLCBldGMuKSBtdXN0IGludGVyY2VwdCB0aG9zZVxuICogbGVhZiB3cml0ZXMgdGhlbXNlbHZlcyDigJQgdGhpcyBoZWxwZXIgY2VudHJhbGl6ZXMgdGhhdCB0cmF2ZXJzYWwuXG4gKlxuICogVGhlIGBvbldyaXRlYCBjYWxsYmFjayByZWNlaXZlcyBhbiBvcHRpb25hbCBgbWV0YTogV3JpdGVNZXRhZGF0YWAgY2FwdHVyZWRcbiAqIHN5bmNocm9ub3VzbHkgZnJvbSB0aGUgYWN0aXZlIGB3aXRoV3JpdGVDb250ZXh0YCBmcmFtZSAoaWYgYW55KS4gRXhpc3RpbmdcbiAqIDMtYXJnIGNhbGxiYWNrcyBgKHBhdGgsIG5leHQsIHByZXYpID0+IHZvaWRgIGNvbnRpbnVlIHRvIHdvcmsgc2luY2UgdGhlXG4gKiB0cmFpbGluZyBgbWV0YWAgYW5kIGBvd25lclBhdGhgIHBhcmFtZXRlcnMgYXJlIG9wdGlvbmFsLlxuICpcbiAqIFNraXBzOlxuICogICAtIEVudGl0eS1jb2xsZWN0aW9uIHNpZ25hbHMgKGhhdmUgYGFkZGAvYHJlbW92ZWAgYW5kIGFscmVhZHkgbm90aWZ5KS5cbiAqICAgLSBCdWlsdC1pbnMgKERhdGUsIE1hcCwgU2V0KSBhbmQgYXJyYXlzIOKAlCB0aGV5IGFyZW4ndCBOb2RlQWNjZXNzb3JzLlxuICogICAtIEFscmVhZHktdmlzaXRlZCBub2RlcyAoY3ljbGUgcHJvdGVjdGlvbiB2aWEgV2Vha1NldCkuXG4gKlxuICogVGhlIHJldHVybmVkIGNsZWFudXAgZnVuY3Rpb24gcmVtb3ZlcyBldmVyeSBpbnN0YWxsZWQgb2JzZXJ2ZXIuXG4gKlxuICogQHB1YmxpYyDigJQgRW5oYW5jZXItYXV0aG9yIEFQSS4gVXNlZCBieSBgQHNpZ25hbC10cmVlL2tlcm5lbGAncyBidWlsdC1pblxuICogICBkZXZ0b29scyAvIHJlc3RvcmF0aW9uIGVuaGFuY2Vycy4gQXBwbGljYXRpb24gY29kZSBzaG91bGQgbm90IHVzZSB0aGlzXG4gKiAgIGRpcmVjdGx5LCBhbmQgMTUuMCByZW1vdmVkIGl0cyBsYXN0IGV4dGVybmFsIGNvbnN1bWVyOiBtZWFzdXJlZCBhZ2FpbnN0XG4gKiAgIHBsYWluIEFuZ3VsYXIgYGNvbXB1dGVkYCBvYnNlcnZhdGlvbiBpdCBzaG93ZWQgbm8gY2FwYWJpbGl0eSBhZHZhbnRhZ2Ug4oCUXG4gKiAgIGl0IG1pc3NlcyB3cml0ZXMgcGFzdCBgbWF4RGVwdGhgIGFuZCBtaXNzZXMgYXJyYXktdmFsdWVkIGxlYXZlcyBlbnRpcmVseVxuICogICAoUkVMRUFTRS0xLjAubWQsIEFORy1WMCkuIEl0IGlzIHF1ZXVlZCBmb3IgaG9zdGlsZSBhdWRpdCB1bmRlciBNVVQ7IGRvIG5vdFxuICogICBidWlsZCBuZXcgY29uc3VtZXJzIG9uIGl0LlxuICovXG5leHBvcnQgZnVuY3Rpb24gaW50ZXJjZXB0TGVhZlNpZ25hbHMoXG4gIHJvb3Q6IHVua25vd24sXG4gIG9uV3JpdGU6IChcbiAgICBwYXRoOiBzdHJpbmcsXG4gICAgbmV4dDogdW5rbm93bixcbiAgICBwcmV2OiB1bmtub3duLFxuICAgIG1ldGE/OiBXcml0ZU1ldGFkYXRhLFxuICAgIG93bmVyUGF0aD86IHN0cmluZyxcbiAgICBzdWJqZWN0SWRzPzogbnVtYmVyW10sXG4gICAgcG9zaXRpb25JZHM/OiBudW1iZXJbXVxuICApID0+IHZvaWQsXG4gIG9wdGlvbnM6IHsgbWF4RGVwdGg/OiBudW1iZXI7IGJlZm9yZVB1YmxpY2F0aW9uPzogdHlwZW9mIG9uV3JpdGU7IHRlcm1pbmFsUmVjb3JkPzogKC4uLmFyZ3M6IFBhcmFtZXRlcnM8dHlwZW9mIG9uV3JpdGU+KSA9PiBUZXJtaW5hbFJlY29yZFBsYW4gfCB1bmRlZmluZWQgfSA9IHt9XG4pOiAoKSA9PiB2b2lkIHtcbiAgY29uc3QgcmVzdG9yZXJzOiBBcnJheTwoKSA9PiB2b2lkPiA9IFtdO1xuICBjb25zdCBtYXhEZXB0aCA9IG9wdGlvbnMubWF4RGVwdGggPz8gMzI7XG5cbiAgY29uc3Qgd2l0aE11dGF0aW9uSW50ZW50ID0gKFxuICAgIG1ldGE6IFdyaXRlTWV0YWRhdGEgfCB1bmRlZmluZWQsXG4gICAgbXV0YXRpb25JbnRlbnQ6ICdyZXBsYWNlJyB8ICdkZXJpdmUnXG4gICk6IFdyaXRlTWV0YWRhdGEgPT4gKHtcbiAgICAuLi4obWV0YSA/PyB7fSksXG4gICAgbXV0YXRpb25JbnRlbnQsXG4gIH0pO1xuXG4gIGNvbnN0IGdldE93bmVyUGF0aCA9IChub2RlOiB1bmtub3duLCBwYXRoOiBzdHJpbmcpOiBzdHJpbmcgPT4ge1xuICAgIHJldHVybiBnZXRPd25lZE93bmVyUGF0aChub2RlKSA/PyBwYXRoO1xuICB9O1xuXG4gIGNvbnN0IGdldFN1YmplY3RJZHMgPSAobm9kZTogdW5rbm93bik6IG51bWJlcltdIHwgdW5kZWZpbmVkID0+IHtcbiAgICByZXR1cm4gZ2V0T3duZWRTdWJqZWN0SWRzKG5vZGUpO1xuICB9O1xuXG4gIGNvbnN0IGdldFBvc2l0aW9uSWRzID0gKG5vZGU6IHVua25vd24pOiBudW1iZXJbXSB8IHVuZGVmaW5lZCA9PiB7XG4gICAgcmV0dXJuIGdldE93bmVkUG9zaXRpb25JZHMobm9kZSk7XG4gIH07XG5cbiAgY29uc3Qgd3JhcFdyaXRhYmxlU2lnbmFsID0gKFxuICAgIG5vZGU6IHVua25vd24sXG4gICAgcGF0aDogc3RyaW5nLFxuICAgIG93bmVyUGF0aE92ZXJyaWRlPzogc3RyaW5nXG4gICk6IHZvaWQgPT4ge1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgY29uc3Qgb3JpZ2luYWwgPSBub2RlIGFzIGFueTtcbiAgICBjb25zdCBvcmlnaW5hbFNldCA9IG9yaWdpbmFsLnNldC5iaW5kKG9yaWdpbmFsKTtcbiAgICBjb25zdCBvcmlnaW5hbFVwZGF0ZSA9IG9yaWdpbmFsLnVwZGF0ZS5iaW5kKG9yaWdpbmFsKTtcblxuICAgIHJlc3RvcmVycy5wdXNoKCgpID0+IHtcbiAgICAgIG9yaWdpbmFsLnNldCA9IG9yaWdpbmFsU2V0O1xuICAgICAgb3JpZ2luYWwudXBkYXRlID0gb3JpZ2luYWxVcGRhdGU7XG4gICAgfSk7XG5cbiAgICBvcmlnaW5hbC5zZXQgPSAodmFsdWU6IHVua25vd24pID0+IHtcbiAgICAgIGNvbnN0IHByZXYgPSBvcmlnaW5hbCgpO1xuICAgICAgb3JpZ2luYWxTZXQodmFsdWUpO1xuICAgICAgY29uc3QgbmV4dCA9IG9yaWdpbmFsKCk7XG4gICAgICBjb25zdCBvd25lclBhdGggPSBvd25lclBhdGhPdmVycmlkZSA/PyBnZXRPd25lclBhdGgobm9kZSwgcGF0aCk7XG4gICAgICBjb25zdCBzdWJqZWN0SWRzID0gZ2V0U3ViamVjdElkcyhub2RlKTtcbiAgICAgIGNvbnN0IHBvc2l0aW9uSWRzID0gZ2V0UG9zaXRpb25JZHMobm9kZSk7XG4gICAgICBpZiAobmV4dCAhPT0gcHJldikge1xuICAgICAgICBvbldyaXRlKFxuICAgICAgICAgIHBhdGgsXG4gICAgICAgICAgbmV4dCxcbiAgICAgICAgICBwcmV2LFxuICAgICAgICAgIHdpdGhNdXRhdGlvbkludGVudChnZXRBY3RpdmVXcml0ZUNvbnRleHQoKSwgJ3JlcGxhY2UnKSxcbiAgICAgICAgICBvd25lclBhdGgsXG4gICAgICAgICAgc3ViamVjdElkcyxcbiAgICAgICAgICBwb3NpdGlvbklkc1xuICAgICAgICApO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBvcmlnaW5hbC51cGRhdGUgPSAodXBkYXRlcjogKHY6IHVua25vd24pID0+IHVua25vd24pID0+IHtcbiAgICAgIGNvbnN0IHByZXYgPSBvcmlnaW5hbCgpO1xuICAgICAgb3JpZ2luYWxVcGRhdGUodXBkYXRlcik7XG4gICAgICBjb25zdCBuZXh0ID0gb3JpZ2luYWwoKTtcbiAgICAgIGNvbnN0IG93bmVyUGF0aCA9IG93bmVyUGF0aE92ZXJyaWRlID8/IGdldE93bmVyUGF0aChub2RlLCBwYXRoKTtcbiAgICAgIGNvbnN0IHN1YmplY3RJZHMgPSBnZXRTdWJqZWN0SWRzKG5vZGUpO1xuICAgICAgY29uc3QgcG9zaXRpb25JZHMgPSBnZXRQb3NpdGlvbklkcyhub2RlKTtcbiAgICAgIGlmIChuZXh0ICE9PSBwcmV2KSB7XG4gICAgICAgIG9uV3JpdGUoXG4gICAgICAgICAgcGF0aCxcbiAgICAgICAgICBuZXh0LFxuICAgICAgICAgIHByZXYsXG4gICAgICAgICAgd2l0aE11dGF0aW9uSW50ZW50KGdldEFjdGl2ZVdyaXRlQ29udGV4dCgpLCAnZGVyaXZlJyksXG4gICAgICAgICAgb3duZXJQYXRoLFxuICAgICAgICAgIHN1YmplY3RJZHMsXG4gICAgICAgICAgcG9zaXRpb25JZHNcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9O1xuICB9O1xuXG4gIGNvbnN0IG9ic2VydmVMb2NhdGlvbiA9IChcbiAgICBub2RlOiBvYmplY3QsXG4gICAgcGF0aDogc3RyaW5nLFxuICAgIG93bmVyUGF0aE92ZXJyaWRlPzogc3RyaW5nLFxuICAgIG5vcm1hbCA9IHRydWVcbiAgKTogdm9pZCA9PiB7XG4gICAgY29uc3QgcmVsZWFzZSA9IG5vcm1hbCA/IG9ic2VydmVJbnRyaW5zaWNNdXRhdGlvbnMobm9kZSwgKG11dGF0aW9uKSA9PiB7XG4gICAgICBpZiAoIW11dGF0aW9uLmNoYW5nZWQpIHJldHVybjtcbiAgICAgIG9uV3JpdGUoXG4gICAgICAgIHBhdGgsXG4gICAgICAgIG11dGF0aW9uLmFmdGVyLFxuICAgICAgICBtdXRhdGlvbi5iZWZvcmUsXG4gICAgICAgIHdpdGhTY2FsYXJQdWJsaWNhdGlvbkNvdmVyYWdlKHdpdGhNdXRhdGlvbkludGVudChnZXRBY3RpdmVXcml0ZUNvbnRleHQoKSwgbXV0YXRpb24uaW50ZW50KSwgbXV0YXRpb24uY292ZXJlZFJlY2lwaWVudHMpLFxuICAgICAgICBvd25lclBhdGhPdmVycmlkZSA/PyBnZXRPd25lclBhdGgobm9kZSwgcGF0aCksXG4gICAgICAgIGdldFN1YmplY3RJZHMobm9kZSksXG4gICAgICAgIGdldFBvc2l0aW9uSWRzKG5vZGUpXG4gICAgICApO1xuICAgIH0pIDogdW5kZWZpbmVkO1xuICAgIGNvbnN0IHRlcm1pbmFsUmVjb3JkID0gb3B0aW9ucy50ZXJtaW5hbFJlY29yZDtcbiAgICBpZih0ZXJtaW5hbFJlY29yZCl7XG4gICAgICBjb25zdCB0ZXJtaW5hbFJlbGVhc2U9cHJlcGFyZVRlcm1pbmFsTXV0YXRpb25zKG5vZGUsKG11dGF0aW9uKT0+e1xuICAgICAgICBpZighbXV0YXRpb24uY2hhbmdlZClyZXR1cm47XG4gICAgICAgIHJldHVybiB0ZXJtaW5hbFJlY29yZC5jYWxsKG9wdGlvbnMscGF0aCxtdXRhdGlvbi5hZnRlcixtdXRhdGlvbi5iZWZvcmUsd2l0aE11dGF0aW9uSW50ZW50KGdldEFjdGl2ZVdyaXRlQ29udGV4dCgpLG11dGF0aW9uLmludGVudCksb3duZXJQYXRoT3ZlcnJpZGUgPz8gZ2V0T3duZXJQYXRoKG5vZGUscGF0aCksZ2V0U3ViamVjdElkcyhub2RlKSxnZXRQb3NpdGlvbklkcyhub2RlKSk7XG4gICAgICB9KTtcbiAgICAgIGlmKHRlcm1pbmFsUmVsZWFzZSlyZXN0b3JlcnMucHVzaCh0ZXJtaW5hbFJlbGVhc2UpO1xuICAgIH1cbiAgICBjb25zdCBiZWZvcmVQdWJsaWNhdGlvbiA9IG9wdGlvbnMuYmVmb3JlUHVibGljYXRpb247XG4gICAgaWYgKGJlZm9yZVB1YmxpY2F0aW9uKSB7XG4gICAgY29uc3QgY2FwdHVyZVJlbGVhc2UgPSBvYnNlcnZlSW50cmluc2ljTXV0YXRpb25zKG5vZGUsIChtdXRhdGlvbikgPT4ge1xuICAgICAgaWYgKCFtdXRhdGlvbi5jaGFuZ2VkKSByZXR1cm47XG4gICAgICBiZWZvcmVQdWJsaWNhdGlvbi5jYWxsKG9wdGlvbnMsXG4gICAgICAgIHBhdGgsXG4gICAgICAgIG11dGF0aW9uLmFmdGVyLFxuICAgICAgICBtdXRhdGlvbi5iZWZvcmUsXG4gICAgICAgIHdpdGhTY2FsYXJQdWJsaWNhdGlvbkNvdmVyYWdlKHdpdGhNdXRhdGlvbkludGVudChnZXRBY3RpdmVXcml0ZUNvbnRleHQoKSwgbXV0YXRpb24uaW50ZW50KSwgbXV0YXRpb24uY292ZXJlZFJlY2lwaWVudHMpLFxuICAgICAgICBvd25lclBhdGhPdmVycmlkZSA/PyBnZXRPd25lclBhdGgobm9kZSwgcGF0aCksXG4gICAgICAgIGdldFN1YmplY3RJZHMobm9kZSksXG4gICAgICAgIGdldFBvc2l0aW9uSWRzKG5vZGUpXG4gICAgICApO1xuICAgIH0sIHRydWUpO1xuICAgICAgaWYgKGNhcHR1cmVSZWxlYXNlKSByZXN0b3JlcnMucHVzaChjYXB0dXJlUmVsZWFzZSk7XG4gICAgfVxuICAgIGlmIChyZWxlYXNlKSByZXN0b3JlcnMucHVzaChyZWxlYXNlKTtcbiAgfTtcblxuICBjb25zdCB3cmFwT3duZWRGaWVsZEFjY2Vzc29ycyA9IChcbiAgICBub2RlOiB1bmtub3duLFxuICAgIGJhc2VQYXRoOiBzdHJpbmcsXG4gICAgb3duZXJQYXRoOiBzdHJpbmcsXG4gICAgc2VlbiA9IG5ldyBXZWFrU2V0PG9iamVjdD4oKVxuICApOiB2b2lkID0+IHtcbiAgICBpZiAoIWlzVHJhdmVyc2FibGVOb2RlKG5vZGUpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHJlZiA9IG5vZGUgYXMgb2JqZWN0O1xuICAgIGlmIChzZWVuLmhhcyhyZWYpKSByZXR1cm47XG4gICAgc2Vlbi5hZGQocmVmKTtcblxuICAgIGNvbnN0IGlzV3JpdGFibGVTaWduYWwgPVxuICAgICAgdHlwZW9mIG5vZGUgPT09ICdmdW5jdGlvbicgJiZcbiAgICAgICdzZXQnIGluIG5vZGUgJiZcbiAgICAgICd1cGRhdGUnIGluIG5vZGUgJiZcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgICB0eXBlb2YgKG5vZGUgYXMgYW55KS5zZXQgPT09ICdmdW5jdGlvbicgJiZcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgICB0eXBlb2YgKG5vZGUgYXMgYW55KS51cGRhdGUgPT09ICdmdW5jdGlvbic7XG5cbiAgICBpZiAoaXNXcml0YWJsZVNpZ25hbCkge1xuICAgICAgd3JhcFdyaXRhYmxlU2lnbmFsKG5vZGUsIGJhc2VQYXRoLCBvd25lclBhdGgpO1xuICAgIH1cblxuICAgIGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5rZXlzKG5vZGUgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4pKSB7XG4gICAgICBjb25zdCBjaGlsZCA9IChub2RlIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+KVtrZXldO1xuICAgICAgaWYgKFxuICAgICAgICBjaGlsZCAhPT0gbnVsbCAmJlxuICAgICAgICB0eXBlb2YgY2hpbGQgPT09ICdvYmplY3QnICYmXG4gICAgICAgICEoQXJyYXkuaXNBcnJheShjaGlsZCkgfHwgY2hpbGQgaW5zdGFuY2VvZiBEYXRlIHx8IGNoaWxkIGluc3RhbmNlb2YgTWFwIHx8IGNoaWxkIGluc3RhbmNlb2YgU2V0KVxuICAgICAgKSB7XG4gICAgICAgIHdyYXBPd25lZEZpZWxkQWNjZXNzb3JzKGNoaWxkLCBgJHtiYXNlUGF0aH0uJHtrZXl9YCwgb3duZXJQYXRoLCBzZWVuKTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGNoaWxkID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHdyYXBPd25lZEZpZWxkQWNjZXNzb3JzKGNoaWxkLCBgJHtiYXNlUGF0aH0uJHtrZXl9YCwgb3duZXJQYXRoLCBzZWVuKTtcbiAgICAgIH1cbiAgICB9XG4gIH07XG5cbiAgY29uc3Qgd3JhcE11dGF0b3IgPSAoXG4gICAgdGFyZ2V0OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICBtZXRob2Q6IHN0cmluZyxcbiAgICBwYXRoOiBzdHJpbmdcbiAgKTogdm9pZCA9PiB7XG4gICAgaWYgKHR5cGVvZiB0YXJnZXRbbWV0aG9kXSAhPT0gJ2Z1bmN0aW9uJykgcmV0dXJuO1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgY29uc3Qgb3JpZ2luYWxNZXRob2QgPSAodGFyZ2V0IGFzIGFueSlbbWV0aG9kXS5iaW5kKHRhcmdldCk7XG4gICAgcmVzdG9yZXJzLnB1c2goKCkgPT4ge1xuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgICh0YXJnZXQgYXMgYW55KVttZXRob2RdID0gb3JpZ2luYWxNZXRob2Q7XG4gICAgfSk7XG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAodGFyZ2V0IGFzIGFueSlbbWV0aG9kXSA9ICguLi5hcmdzOiB1bmtub3duW10pID0+IHtcbiAgICAgIGNvbnN0IGNhblNuYXBzaG90TXV0YXRvclN0YXRlID1cbiAgICAgICAgdHlwZW9mICh0YXJnZXQgYXMgeyBfX2ZpbmRLZXlCeVN1YmplY3RJZD86IHVua25vd24gfSlcbiAgICAgICAgICAuX19maW5kS2V5QnlTdWJqZWN0SWQgIT09ICdmdW5jdGlvbic7XG4gICAgICBjb25zdCBwcmV2U25hcHNob3QgPSBjYW5TbmFwc2hvdE11dGF0b3JTdGF0ZVxuICAgICAgICA/IHNuYXBzaG90TWFya2VyTm9kZSh0YXJnZXQpPy52YWx1ZVxuICAgICAgICA6IHVuZGVmaW5lZDtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IG9yaWdpbmFsTWV0aG9kKC4uLmFyZ3MpO1xuICAgICAgY29uc3QgbmV4dFNuYXBzaG90ID0gY2FuU25hcHNob3RNdXRhdG9yU3RhdGVcbiAgICAgICAgPyBzbmFwc2hvdE1hcmtlck5vZGUodGFyZ2V0KT8udmFsdWVcbiAgICAgICAgOiB1bmRlZmluZWQ7XG4gICAgICBvbldyaXRlKFxuICAgICAgICBwYXRoLFxuICAgICAgICBuZXh0U25hcHNob3QsXG4gICAgICAgIHByZXZTbmFwc2hvdCxcbiAgICAgICAgZ2V0QWN0aXZlV3JpdGVDb250ZXh0KCksXG4gICAgICAgIHBhdGgsXG4gICAgICAgIGdldFN1YmplY3RJZHModGFyZ2V0KSxcbiAgICAgICAgZ2V0UG9zaXRpb25JZHModGFyZ2V0KVxuICAgICAgKTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfTtcbiAgfTtcblxuICAvLyBUcmF2ZXJzYWwgaXMgdGhlIHNoYXJlZCBgdmlzaXRUcmVlYCBza2VsZXRvbjsgdGhpcyB2aXNpdG9yIHN1cHBsaWVzIG9ubHlcbiAgLy8gdGhlIGxlYWYgYWN0aW9uICh3cmFwIGAuc2V0YC9gLnVwZGF0ZWAgdG8gb2JzZXJ2ZSB3cml0ZXMpIGFuZCB0aGUgcmVjdXJzZVxuICAvLyBkZWNpc2lvbi4gQmVoYXZpb3IgcHJlc2VydmVkIHZzIHRoZSBmb3JtZXIgaGFuZC1yb2xsZWQgd2Fsazogd3JhcCBwbGFpblxuICAvLyB3cml0YWJsZSBsZWF2ZXMgb25seSwgc2tpcCBlbnRpdHkgY29sbGVjdGlvbnMgKHRoZXkgbm90aWZ5IHRoZW1zZWx2ZXMpLFxuICAvLyBkb24ndCBkZXNjZW5kIGludG8gYnVpbHQtaW5zL2FycmF5cywgYW5kIG5ldmVyIHdyYXAgdGhlIHJvb3Qgbm9kZSBpdHNlbGYuXG4gIHRyeSB7XG4gICAgdmlzaXRUcmVlKFxuICAgICAgcm9vdCxcbiAgICAgIChub2RlLCBwYXRoKSA9PiB7XG4gICAgICAgIC8vIFRoZSByb290IGlzIGFsd2F5cyBhIGJyYW5jaCBoZXJlICh0cmVlLiQpOyBuZXZlciB0cmVhdCBpdCBhcyBhIGxlYWYuXG4gICAgICAgIGlmIChwYXRoID09PSAnJykgcmV0dXJuIHRydWU7XG5cbiAgICAgICAgaWYgKGlzV3JpdGFibGVMb2NhdGlvbihub2RlKSkge1xuICAgICAgICAgIGlmICghaGFzSW50cmluc2ljTXV0YXRpb25FbWl0dGVyKG5vZGUpIHx8IG9wdGlvbnMuYmVmb3JlUHVibGljYXRpb24pIHtcbiAgICAgICAgICAgIG9ic2VydmVMb2NhdGlvbihub2RlIGFzIG9iamVjdCwgcGF0aCwgdW5kZWZpbmVkLCAhaGFzSW50cmluc2ljTXV0YXRpb25FbWl0dGVyKG5vZGUpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaXNXcml0YWJsZVNpZ25hbCA9XG4gICAgICAgICAgdHlwZW9mIG5vZGUgPT09ICdmdW5jdGlvbicgJiZcbiAgICAgICAgICAnc2V0JyBpbiBub2RlICYmXG4gICAgICAgICAgJ3VwZGF0ZScgaW4gbm9kZSAmJlxuICAgICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgICAgICAgdHlwZW9mIChub2RlIGFzIGFueSkuc2V0ID09PSAnZnVuY3Rpb24nICYmXG4gICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgICAgICB0eXBlb2YgKG5vZGUgYXMgYW55KS51cGRhdGUgPT09ICdmdW5jdGlvbic7XG5cbiAgICAgICAgaWYgKGlzV3JpdGFibGVTaWduYWwpIHtcbiAgICAgICAgICBjb25zdCBpc0VudGl0eUNvbGxlY3Rpb24gPSAnYWRkJyBpbiBub2RlIHx8ICdyZW1vdmUnIGluIG5vZGU7XG4gICAgICAgICAgaWYgKGlzRW50aXR5Q29sbGVjdGlvbikgcmV0dXJuIGZhbHNlOyAvLyBjb2xsZWN0aW9uIG5vdGlmaWVzIGl0c2VsZlxuXG4gICAgICAgICAgY29uc3QgaGFzT3duZWRNdXRhdGlvbkVtaXR0ZXIgPSBoYXNJbnRyaW5zaWNNdXRhdGlvbkVtaXR0ZXIobm9kZSk7XG4gICAgICAgICAgaWYgKGhhc093bmVkTXV0YXRpb25FbWl0dGVyKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgd3JhcFdyaXRhYmxlU2lnbmFsKG5vZGUsIHBhdGgpO1xuICAgICAgICAgIGNvbnN0IHByb2MgPSBnZXROb2RlUHJvY2Vzc29yKG5vZGUpO1xuICAgICAgICAgIGlmIChwcm9jICYmIGlzVHJhdmVyc2FibGVOb2RlKG5vZGUpKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IG1ldGhvZCBvZiBbJ2NsZWFyJywgJ3JlbG9hZCcsICdyZXNldCcsICdyZWZyZXNoJ10pIHtcbiAgICAgICAgICAgICAgd3JhcE11dGF0b3Iobm9kZSBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiwgbWV0aG9kLCBwYXRoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGZhbHNlOyAvLyBsZWFmIOKAlCBkb24ndCByZWN1cnNlIGludG8gaXRcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEEgTUFURVJJQUxJU0VEIE1BUktFUiB3aG9zZSBub2RlIGlzIG5vdCBhIHdyaXRhYmxlIHNpZ25hbC5cbiAgICAgICAgLy9cbiAgICAgICAgLy8gYGlzV3JpdGFibGVTaWduYWxgIGFib3ZlIHJlcXVpcmVzIEJPVEggYHNldGAgYW5kIGB1cGRhdGVgLiBBIGBmb3JtKClgXG4gICAgICAgIC8vIG5vZGUgaGFzIGBzZXRgIGFuZCBgcGF0Y2hgIOKAlCBubyBgdXBkYXRlYCDigJQgc28gaXQgZmFpbGVkIHRoYXQgdGVzdCBhbmRcbiAgICAgICAgLy8gd2FzIG5ldmVyIHdyYXBwZWQsIHdoaWNoIG1lYW50IGl0cyB3cml0ZXMgd2VyZSBpbnZpc2libGUgaGVyZS4gVGhlXG4gICAgICAgIC8vIGNvbnNlcXVlbmNlIHdhcyBub3Qgc3VidGxlOiBgcmVzdG9yYXRpb25gIHNldHMgaXRzIHNlbGYtZGlydHkgZmxhZyBmcm9tXG4gICAgICAgIC8vIFRISVMgY2FsbGJhY2ssIHNvIGEgZm9ybSBlZGl0IG5ldmVyIG1hcmtlZCB0aGUgdHJlZSBkaXJ0eSBhbmQgd2FzXG4gICAgICAgIC8vIG5ldmVyIHJlY29yZGVkLiBNZWFzdXJlZDogdGhyZWUgd3JpdGVzIChmb3JtLCBsZWFmLCBmb3JtKSBwcm9kdWNlZCB0d29cbiAgICAgICAgLy8gaGlzdG9yeSBlbnRyaWVzLCB0aGUgbGFzdCBmb3JtIGVkaXQgc2ltcGx5IGFic2VudCDigJQgc28gdW5kbyBjb3VsZCBub3RcbiAgICAgICAgLy8gcmVzdG9yZSB3aGF0IHdhcyBuZXZlciBjYXB0dXJlZC5cbiAgICAgICAgLy9cbiAgICAgICAgLy8gQ29sbGVjdGlvbnMgYXJlIGV4Y2x1ZGVkIG9uIHB1cnBvc2UgYWJvdmU6IGBlbnRpdHlNYXBgIG5vdGlmaWVzIGZvclxuICAgICAgICAvLyBpdHNlbGYsIHdoaWNoIGlzIGV4YWN0bHkgd2h5IGl0cyB1bmRvIHdvcmtlZCB3aGlsZSB0aGUgZm9ybSdzIGRpZCBub3QuXG4gICAgICAgIGNvbnN0IHByb2MgPSBnZXROb2RlUHJvY2Vzc29yKG5vZGUpO1xuICAgICAgICBpZiAocHJvYyAmJiBoYXNJbnRyaW5zaWNNdXRhdGlvbkVtaXR0ZXIobm9kZSkpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgLy8gTk9UIGB0eXBlb2Ygbm9kZSA9PT0gJ2Z1bmN0aW9uJ2A6IG1hcmtlcnMgbWF0ZXJpYWxpc2UgdG8gZGlmZmVyZW50XG4gICAgICAgIC8vIHNoYXBlcyDigJQgYGZvcm1gIGlzIGEgY2FsbGFibGUsIGBlbnRpdHlNYXBgIGFuZCBgc3RhdHVzYCBhcmUgcGxhaW5cbiAgICAgICAgLy8gb2JqZWN0cyDigJQgYW5kIHJlcXVpcmluZyBjYWxsYWJpbGl0eSBzaWxlbnRseSBza2lwcGVkIHRoZSB0d28gdGhhdCBhcmVcbiAgICAgICAgLy8gbm90LiBUaGUgcmVnaXN0cnkgc3RhbXAgaXMgdGhlIHJlbGlhYmxlIHRlc3QuXG4gICAgICAgIGlmIChwcm9jICYmIGlzVHJhdmVyc2FibGVOb2RlKG5vZGUpKSB7XG4gICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgICAgICBjb25zdCBtYXJrZXIgPSBub2RlIGFzIGFueTtcbiAgICAgICAgICAvLyBFdmVyeSBtdXRhdG9yIGEgYnVpbHQtaW4gbWFya2VyIGV4cG9zZXMuIEEgbWFya2VyIHRoYXQgbm90aWZpZXMgdGhlXG4gICAgICAgICAgLy8gZ2xvYmFsIFBhdGhOb3RpZmllciBpdHNlbGYgaXMgTk9UIGVub3VnaDogYHJlc3RvcmF0aW9uYCBzZXRzIGl0c1xuICAgICAgICAgIC8vIHNlbGYtZGlydHkgZmxhZyBmcm9tIFRISVMgY2FsbGJhY2ssIGFuZCB0aGUgbm90aWZpZXIgaXMgZ2xvYmFsIHNvIGFcbiAgICAgICAgICAvLyBub3RpZmljYXRpb24gY2FycmllcyBubyBvd25lcnNoaXAuIEFuIGVudGl0eU1hcC1vbmx5IGVkaXQgd2FzXG4gICAgICAgICAgLy8gdGhlcmVmb3JlIG5ldmVyIHJlY29yZGVkIOKAlCB2ZXJpZmllZCwgaGlzdG9yeSBzdGF5ZWQgYXQgW1wiSU5JVFwiXS5cbiAgICAgICAgICAvL1xuICAgICAgICAgIC8vIFRoYXQgZGVmZWN0IGhpZCBiZWhpbmQgYSB0ZXN0IHRoYXQgYWxzbyB3cm90ZSBhIHNjYWxhcjogdGhlIHNjYWxhclxuICAgICAgICAgIC8vIG1hcmtlZCB0aGUgdHJlZSBkaXJ0eSBhbmQgdGhlIGNvbGxlY3Rpb24gcm9kZSBhbG9uZyBpbiB0aGVcbiAgICAgICAgICAvLyBzbmFwc2hvdCwgc28gdW5kbyBhcHBlYXJlZCB0byB3b3JrLiBDb2xsZWN0aW9uLW9ubHkgZWRpdHMgZGlkIG5vdC5cbiAgICAgICAgICBjb25zdCBNVVRBVE9SUyA9IFtcbiAgICAgICAgICAgICdzZXQnLFxuICAgICAgICAgICAgJ3BhdGNoJyxcbiAgICAgICAgICAgICdzZXRBbGwnLFxuICAgICAgICAgICAgJ2FkZE9uZScsXG4gICAgICAgICAgICAnYWRkTWFueScsXG4gICAgICAgICAgICAncHJlcGVuZE1hbnknLFxuICAgICAgICAgICAgJ3VwZGF0ZU9uZScsXG4gICAgICAgICAgICAndXBkYXRlTWFueScsXG4gICAgICAgICAgICAndXBzZXJ0T25lJyxcbiAgICAgICAgICAgICd1cHNlcnRNYW55JyxcbiAgICAgICAgICAgICdjaGFuZ2VJZCcsXG4gICAgICAgICAgICAncmVtb3ZlT25lJyxcbiAgICAgICAgICAgICdyZW1vdmVNYW55JyxcbiAgICAgICAgICAgICdjbGVhcicsXG4gICAgICAgICAgICAnc2V0TG9hZGluZycsXG4gICAgICAgICAgICAnc2V0TG9hZGVkJyxcbiAgICAgICAgICAgICdzZXRFcnJvcicsXG4gICAgICAgICAgICAnc2V0Tm90TG9hZGVkJyxcbiAgICAgICAgICAgICdzdGFydCcsXG4gICAgICAgICAgICAnc2V0U3VjY2VzcycsXG4gICAgICAgICAgICAnc3VjY2VlZCcsXG4gICAgICAgICAgICAnZmFpbCcsXG4gICAgICAgICAgICAncmVmcmVzaCcsXG4gICAgICAgICAgICAncmVydW4nLFxuICAgICAgICAgICAgJ3Jlc2V0JyxcbiAgICAgICAgICBdIGFzIGNvbnN0O1xuICAgICAgICAgIGZvciAoY29uc3QgbWV0aG9kIG9mIE1VVEFUT1JTKSB7XG4gICAgICAgICAgICB3cmFwTXV0YXRvcihtYXJrZXIgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4sIG1ldGhvZCwgcGF0aCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IGZpZWxkcyA9IG1hcmtlci4kIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+IHwgdW5kZWZpbmVkO1xuICAgICAgICAgIGlmIChmaWVsZHMgJiYgaXNUcmF2ZXJzYWJsZU5vZGUoZmllbGRzKSkge1xuICAgICAgICAgICAgd3JhcE93bmVkRmllbGRBY2Nlc3NvcnMoZmllbGRzLCBwYXRoLCBwYXRoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGZhbHNlOyAvLyBsZWFmIOKAlCBkbyBub3QgcmVjdXJzZSBpbnRvIGEgbWFya2VyIG5vZGVcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEJ1aWx0LWlucy9hcnJheXMgYXJlIHN0b3JlZCBhcyBzaW5nbGUgc2lnbmFscywgbm90IG5lc3RlZCB0cmVlcy5cbiAgICAgICAgaWYgKFxuICAgICAgICAgIHR5cGVvZiBub2RlID09PSAnb2JqZWN0JyAmJlxuICAgICAgICAgIChBcnJheS5pc0FycmF5KG5vZGUpIHx8XG4gICAgICAgICAgICBub2RlIGluc3RhbmNlb2YgRGF0ZSB8fFxuICAgICAgICAgICAgbm9kZSBpbnN0YW5jZW9mIE1hcCB8fFxuICAgICAgICAgICAgbm9kZSBpbnN0YW5jZW9mIFNldClcbiAgICAgICAgKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRydWU7IC8vIGJyYW5jaCBhY2Nlc3NvciAvIHBsYWluIG5lc3RlZCBvYmplY3Qg4oCUIHJlY3Vyc2VcbiAgICAgIH0sXG4gICAgICB7IG1heERlcHRoIH1cbiAgICApO1xuICB9IGNhdGNoIHtcbiAgICAvLyBJZ25vcmUgdHJhdmVyc2FsIGVycm9yczsgcGFydGlhbCBpbnRlcmNlcHRpb24gaXMgc3RpbGwgdXNlZnVsLlxuICB9XG5cbiAgcmV0dXJuICgpID0+IHtcbiAgICBmb3IgKGNvbnN0IHJlc3RvcmUgb2YgcmVzdG9yZXJzKSB7XG4gICAgICB0cnkge1xuICAgICAgICByZXN0b3JlKCk7XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgLy8gaWdub3JlXG4gICAgICB9XG4gICAgfVxuICAgIHJlc3RvcmVycy5sZW5ndGggPSAwO1xuICB9O1xufVxuIl0sImZpbGUiOiIvc3JjL2xpYi9pbnRlcm5hbHMvaW50ZXJjZXB0LWxlYWYtc2lnbmFscy50cyJ9

//# vitestCache=W3siZmlsZSI6IjEiLCJpZCI6IjEiLCJ1cmwiOiIyIiwiaW1wb3J0ZWRVcmxzIjoiMyIsIm1hcHBpbmdzIjpmYWxzZX0sIi9wcml2YXRlL3RtcC9zdC1jMjgtcjMtc2FtcGxlZC1hbGxvY2F0aW9uL2Jhc2VsaW5lL2NhbmRpZGF0ZS9wYWNrYWdlcy9rZXJuZWwvc3JjL2xpYi9pbnRlcm5hbHMvaW50ZXJjZXB0LWxlYWYtc2lnbmFscy50cyIsIi9zcmMvbGliL2ludGVybmFscy9pbnRlcmNlcHQtbGVhZi1zaWduYWxzLnRzIixbXV0=
}}