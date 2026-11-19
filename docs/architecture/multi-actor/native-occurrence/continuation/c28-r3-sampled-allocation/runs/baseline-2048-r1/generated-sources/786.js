'use strict';async (__vite_ssr_exports__,__vite_ssr_import_meta__,__vite_ssr_import__,__vite_ssr_dynamic_import__,__vite_ssr_exportAll__,__vite_ssr_exportName__,__filename,__dirname,module,exports,require)=>{{const __vite_ssr_import_0__ = await __vite_ssr_import__("/@fs/private/tmp/st-c28-r3-sampled-allocation/harness.mjs", {"importedNames":["start","stop","close"]});
const __vite_ssr_import_1__ = await __vite_ssr_import__("/@id/__vite-browser-external:node:fs", {"importedNames":["default"]});const __vite_ssr_import_2__ = await __vite_ssr_import__("/@id/__vite-browser-external:node:v8", {"importedNames":["default"]});const __vite_ssr_import_3__ = await __vite_ssr_import__("/@fs/Users/jonathanborgia/code/signaltree/node_modules/.pnpm/vitest@4.1.9_@edge-runtime+vm@3.2.0_@types+node@22.18.1_@vitest+coverage-v8@4.1.9_@vite_befef5c16c68f3fca6dbca1818f521f8/node_modules/vitest/dist/index.js", {"importedNames":["describe","expect","it"]});const __vite_ssr_import_4__ = await __vite_ssr_import__("/src/lib/signal-tree.ts", {"importedNames":["signalTree"]});const __vite_ssr_import_5__ = await __vite_ssr_import__("/src/lib/markers/entity-map.ts", {"importedNames":["entityMap"]});const __vite_ssr_import_6__ = await __vite_ssr_import__("/src/lib/undoable.ts", {"importedNames":["undoable"]});const __vite_ssr_import_7__ = await __vite_ssr_import__("/src/lib/internals/entity-membership-view.ts", {"importedNames":["entityMembershipReader"]});const __vite_ssr_import_8__ = await __vite_ssr_import__("/src/enhancers/restoration/restoration.ts", {"importedNames":["restoration"]}); const appendMemoryRow = __vite_ssr_import_1__.default["appendFileSync"];
 const memoryHeapStatistics = __vite_ssr_import_2__.default["getHeapStatistics"];
function memoryStage(stage) {
  const sink = process.env["ST_MEMORY_OUTPUT"];
  if (!sink) throw new Error("ST_MEMORY_OUTPUT is required");
  const usage = process.memoryUsage(), v8 = memoryHeapStatistics();
  appendMemoryRow(sink, JSON.stringify({ stage, at: Date.now(), pid: process.pid, node: process.version, execArgv: process.execArgv, size: LARGE, ...usage, heapSizeLimit: v8.heap_size_limit, totalAvailableSize: v8.total_available_size, usedHeapSize: v8.used_heap_size, numberOfNativeContexts: v8.number_of_native_contexts, numberOfDetachedContexts: v8.number_of_detached_contexts }) + "\n");
}






const rows = (count, offset = 0) => Array.from({ length: count }, (_, i) => ({ id: i + offset, n: i }));
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const LARGE = 2048;
(0,__vite_ssr_import_3__.describe)("entity batches larger than the argument limit", () => {
  (0,__vite_ssr_import_3__.it)("setAll, replace and clear with membership observed", () => {
    memoryStage("membership:before-create");
    const tree = (0,__vite_ssr_import_4__.signalTree)({ rows: (0,__vite_ssr_import_5__.entityMap)() });
    memoryStage("membership:after-create");
    const reader = (0,__vite_ssr_import_7__.entityMembershipReader)(tree);
    let events = 0;
    const stop = reader.subscribe(() => events++);
    try {
      memoryStage("membership:before-seed");
      tree.$.rows.setAll(rows(LARGE));
      memoryStage("membership:after-seed");
      memoryStage("membership:before-replace");
      tree.$.rows.setAll(rows(LARGE, LARGE));
      memoryStage("membership:after-replace");
      memoryStage("membership:before-clear");
      tree.$.rows.setAll([]);
      memoryStage("membership:after-clear");
      (0,__vite_ssr_import_3__.expect)(tree.$.rows.count()).toBe(0);
      (0,__vite_ssr_import_3__.expect)(events).toBeGreaterThan(0);
      memoryStage("membership:after-original-assertions");
    } finally {
      memoryStage("membership:before-stop");
      stop();
      memoryStage("membership:after-stop");
      memoryStage("membership:before-destroy");
      tree.destroy();
      memoryStage("membership:after-destroy");
    }
  }, 6e4);
  (0,__vite_ssr_import_3__.it)("undo and redo of a setAll that replaced every row", async () => {
    memoryStage("restoration:before-create");
    const tree = (0,__vite_ssr_import_4__.signalTree)(
      { rows: (0,__vite_ssr_import_5__.entityMap)() },
      { enhancers: [(0,__vite_ssr_import_8__.restoration)()] }
    );
    memoryStage("restoration:after-create");
    try {
      memoryStage("restoration:before-seed");
      tree.$.rows.setAll(rows(LARGE));
      memoryStage("restoration:after-seed");
      await flush();
      memoryStage("restoration:after-original-drain");
      memoryStage("restoration:before-replace");
      (0,__vite_ssr_import_0__.start)("replacement");
      (0,__vite_ssr_import_6__.undoable)(() => tree.$.rows.setAll(rows(LARGE, LARGE)));
      await flush();
      (0,__vite_ssr_import_0__.stop)("replacement");
      memoryStage("restoration:after-original-drain");
      memoryStage("restoration:before-undo");
      (0,__vite_ssr_import_0__.start)("undo");
      tree.undo();
      (0,__vite_ssr_import_0__.stop)("undo");
      memoryStage("restoration:after-undo");
      (0,__vite_ssr_import_3__.expect)(tree.$.rows.count()).toBe(LARGE);
      (0,__vite_ssr_import_3__.expect)(tree.$.rows.ids()[0]).toBe(0);
      memoryStage("restoration:after-undo-assertions");
      memoryStage("restoration:before-redo");
      (0,__vite_ssr_import_0__.start)("redo");
      tree.redo();
      (0,__vite_ssr_import_0__.stop)("redo");
      memoryStage("restoration:after-redo");
      (0,__vite_ssr_import_3__.expect)(tree.$.rows.ids()[0]).toBe(LARGE);
      memoryStage("restoration:after-redo-assertion");
    } finally {
      memoryStage("restoration:before-destroy");
      tree.destroy();
      memoryStage("restoration:after-destroy");
      (0,__vite_ssr_import_0__.close)();
    }
  }, 12e4);
});
function findIndexVisits(action) {
  const original = Array.prototype.findIndex;
  let visits = 0;
  Array.prototype.findIndex = function(predicate, thisArg) {
    return original.call(this, (value, index, array) => {
      visits += 1;
      return predicate.call(thisArg, value, index, array);
    });
  };
  try {
    action();
    return visits;
  } finally {
    Array.prototype.findIndex = original;
  }
}
(0,__vite_ssr_import_3__.describe)("setAll removal neighbour search work", () => {
  (0,__vite_ssr_import_3__.it)("counts predicate visits and restores instrumentation even on failure", () => {
    const original = Array.prototype.findIndex;
    const values = [10, 20, 30];
    const context = { target: 20 };
    let found = -1;
    const visits = findIndexVisits(() => {
      found = values.findIndex(function(value) {
        return value === this.target;
      }, context);
    });
    (0,__vite_ssr_import_3__.expect)(found).toBe(1);
    (0,__vite_ssr_import_3__.expect)(visits).toBe(2);
    (0,__vite_ssr_import_3__.expect)(Array.prototype.findIndex).toBe(original);
    const error = new Error("instrumented predicate failed");
    (0,__vite_ssr_import_3__.expect)(
      () => findIndexVisits(() => {
        values.findIndex(() => {
          throw error;
        });
      })
    ).toThrow(error);
    (0,__vite_ssr_import_3__.expect)(Array.prototype.findIndex).toBe(original);
  });
  __vite_ssr_import_3__.describe.each(["plain", "observed"])("%s tree", (mode) => {
    const check = async (count, replacement) => {
      const initial = rows(count);
      const initialIds = initial.map((row) => row.id);
      const replacementIds = replacement.map((row) => row.id);
      const tree = (0,__vite_ssr_import_4__.signalTree)(
        { rows: (0,__vite_ssr_import_5__.entityMap)() },
        { enhancers: mode === "observed" ? [(0,__vite_ssr_import_8__.restoration)()] : [] }
      );
      try {
        tree.$.rows.setAll(initial);
        await flush();
        const apply = () => tree.$.rows.setAll(replacement);
        const visits = findIndexVisits(() => {
          if (mode === "observed") (0,__vite_ssr_import_6__.undoable)(apply);
          else apply();
        });
        (0,__vite_ssr_import_3__.expect)(
          visits,
          "findIndex predicate visits during setAll"
        ).toBeLessThanOrEqual(count);
        (0,__vite_ssr_import_3__.expect)(tree.$.rows.ids()).toEqual(replacementIds);
        if (mode === "observed") {
          await flush();
          tree.undo();
          (0,__vite_ssr_import_3__.expect)(tree.$.rows.ids()).toEqual(initialIds);
        }
      } finally {
        tree.destroy();
      }
    };
    __vite_ssr_import_3__.it.each([256, 1024])("replacing every id (%i rows)", async (count) => {
      await check(count, rows(count, count));
    });
    __vite_ssr_import_3__.it.each([256, 1024])(
      "clearing with setAll([]) (%i rows)",
      async (count) => {
        await check(count, []);
      }
    );
  });
});
//# sourceMappingSource=vite-generated
//# sourceMappingURL=data:application/json;base64,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QixjQUFNLE1BQU07QUFDWixjQUFNLFFBQVEsTUFBTSxLQUFLLEVBQUUsS0FBSyxPQUFPLFdBQVc7QUFDbEQsY0FBTSxTQUFTLGdCQUFnQixNQUFNO0FBQ25DLGNBQUksU0FBUyxXQUFZLG9DQUFTLEtBQUs7QUFBQSxjQUNsQyxPQUFNO0FBQUEsUUFDYixDQUFDO0FBQ0Q7QUFBQSxVQUNFO0FBQUEsVUFDQTtBQUFBLFFBQ0YsRUFBRSxvQkFBb0IsS0FBSztBQUMzQix5Q0FBTyxLQUFLLEVBQUUsS0FBSyxJQUFJLENBQUMsRUFBRSxRQUFRLGNBQWM7QUFDaEQsWUFBSSxTQUFTLFlBQVk7QUFJdkIsZ0JBQU0sTUFBTTtBQUNaLGVBQUssS0FBSztBQUNWLDJDQUFPLEtBQUssRUFBRSxLQUFLLElBQUksQ0FBQyxFQUFFLFFBQVEsVUFBVTtBQUFBLFFBQzlDO0FBQUEsTUFDRixVQUFFO0FBQ0EsYUFBSyxRQUFRO0FBQUEsTUFDZjtBQUFBLElBQ0Y7QUFFQSw2QkFBRyxLQUFLLENBQUMsS0FBSyxJQUFLLENBQUMsRUFBRSxnQ0FBZ0MsT0FBTyxVQUFVO0FBQ3JFLFlBQU0sTUFBTSxPQUFPLEtBQUssT0FBTyxLQUFLLENBQUM7QUFBQSxJQUN2QyxDQUFDO0FBRUQsNkJBQUcsS0FBSyxDQUFDLEtBQUssSUFBSyxDQUFDO0FBQUEsTUFDbEI7QUFBQSxNQUNBLE9BQU8sVUFBVTtBQUNmLGNBQU0sTUFBTSxPQUFPLENBQUMsQ0FBQztBQUFBLE1BQ3ZCO0FBQUEsSUFDRjtBQUFBLEVBQ0YsQ0FBQztBQUNILENBQUMiLCJuYW1lcyI6W10sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VzIjpbImVudGl0eS1sYXJnZS1iYXRjaGVzLnNwZWMudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtzdGFydCBhcyBzYW1wbGVTdGFydCxzdG9wIGFzIHNhbXBsZVN0b3AsY2xvc2UgYXMgc2FtcGxlQ2xvc2V9IGZyb20gJy9wcml2YXRlL3RtcC9zdC1jMjgtcjMtc2FtcGxlZC1hbGxvY2F0aW9uL2hhcm5lc3MubWpzJzsgLy8gU0FNUExJTkctT05MWVxuLy8gQkVHSU4gTUVNT1JZLU9OTFkgSU5TVFJVTUVOVEFUSU9OXG5pbXBvcnQgeyBhcHBlbmRGaWxlU3luYyBhcyBhcHBlbmRNZW1vcnlSb3cgfSBmcm9tICdub2RlOmZzJztcbmltcG9ydCB7IGdldEhlYXBTdGF0aXN0aWNzIGFzIG1lbW9yeUhlYXBTdGF0aXN0aWNzIH0gZnJvbSAnbm9kZTp2OCc7XG5mdW5jdGlvbiBtZW1vcnlTdGFnZShzdGFnZTogc3RyaW5nKTogdm9pZCB7XG4gIGNvbnN0IHNpbms9cHJvY2Vzcy5lbnZbJ1NUX01FTU9SWV9PVVRQVVQnXTtcbiAgaWYoIXNpbmspdGhyb3cgbmV3IEVycm9yKCdTVF9NRU1PUllfT1VUUFVUIGlzIHJlcXVpcmVkJyk7XG4gIGNvbnN0IHVzYWdlPXByb2Nlc3MubWVtb3J5VXNhZ2UoKSx2OD1tZW1vcnlIZWFwU3RhdGlzdGljcygpO1xuICBhcHBlbmRNZW1vcnlSb3coc2luayxKU09OLnN0cmluZ2lmeSh7c3RhZ2UsYXQ6RGF0ZS5ub3coKSxwaWQ6cHJvY2Vzcy5waWQsbm9kZTpwcm9jZXNzLnZlcnNpb24sZXhlY0FyZ3Y6cHJvY2Vzcy5leGVjQXJndixzaXplOkxBUkdFLC4uLnVzYWdlLGhlYXBTaXplTGltaXQ6djguaGVhcF9zaXplX2xpbWl0LHRvdGFsQXZhaWxhYmxlU2l6ZTp2OC50b3RhbF9hdmFpbGFibGVfc2l6ZSx1c2VkSGVhcFNpemU6djgudXNlZF9oZWFwX3NpemUsbnVtYmVyT2ZOYXRpdmVDb250ZXh0czp2OC5udW1iZXJfb2ZfbmF0aXZlX2NvbnRleHRzLG51bWJlck9mRGV0YWNoZWRDb250ZXh0czp2OC5udW1iZXJfb2ZfZGV0YWNoZWRfY29udGV4dHN9KSsnXFxuJyk7XG59XG4vLyBFTkQgTUVNT1JZLU9OTFkgSU5TVFJVTUVOVEFUSU9OXG5pbXBvcnQgeyBkZXNjcmliZSwgZXhwZWN0LCBpdCB9IGZyb20gJ3ZpdGVzdCc7XG5pbXBvcnQgeyBzaWduYWxUcmVlIH0gZnJvbSAnLi9zaWduYWwtdHJlZSc7XG5pbXBvcnQgeyBlbnRpdHlNYXAgfSBmcm9tICcuL21hcmtlcnMvZW50aXR5LW1hcCc7XG5pbXBvcnQgeyB1bmRvYWJsZSB9IGZyb20gJy4vdW5kb2FibGUnO1xuaW1wb3J0IHsgZW50aXR5TWVtYmVyc2hpcFJlYWRlciB9IGZyb20gJy4vaW50ZXJuYWxzL2VudGl0eS1tZW1iZXJzaGlwLXZpZXcnO1xuaW1wb3J0IHsgcmVzdG9yYXRpb24gfSBmcm9tICcuLi9lbmhhbmNlcnMvcmVzdG9yYXRpb24vcmVzdG9yYXRpb24nO1xuXG4vLyBgYXJyYXkucHVzaCguLi5pdGVtcylgIHBhc3NlcyBldmVyeSBpdGVtIGFzIGFuIGFyZ3VtZW50LCBhbmQgVjggdGhyb3dzXG4vLyBcIk1heGltdW0gY2FsbCBzdGFjayBzaXplIGV4Y2VlZGVkXCIgcGFzdCB+MTBeNSBhcmd1bWVudHMuIEZvdW5kIGJ5IHRoZVxuLy8gMjAyNi0wOS0zMCBwZXJmb3JtYW5jZSBhdWRpdDogYSAyMDBrLXJvdyBzZXRBbGwgdGhyZXcgd2hpbGUgbWVtYmVyc2hpcCB3YXNcbi8vIG9ic2VydmVkIChTdHVkaW8ncyBlbnRpdHkgZXZpZGVuY2UpLlxuLy9cbi8vIENhcnJpZWQgZnJvbSB2MTUgMDEyZmQxMWQgKHYxNiBpbnRlZ3JhdGlvbiBzbGljZSA1KS4gVGhlIGRvbm9yJ3MgZmlyc3QgY2FzZVxuLy8gb2JzZXJ2ZXMgbWVtYmVyc2hpcCB0aHJvdWdoIGBlbnRpdHlNZW1iZXJzaGlwUmVhZGVyYDsgcHJlc2VydmVkIGluIHNsaWNlIDVcbi8vIChwcmVzZXJ2ZWQvZW50aXR5LWxhcmdlLWJhdGNoZXMuc3BlYy50cy50eHQpLCBpdCBpcyByZXN0b3JlZCB1bmNoYW5nZWQgd2l0aFxuLy8gdGhlIHJlYWRlciBpbiBzbGljZSA2LiB2MTYncyBvd24gbGFyZ2UtYmF0Y2ggY2FsbCBzaXRlcyAobm90aWZpZXIgZGVsaXZlcnksIHRyYW5zYWN0aW9uIHJvbGxiYWNrLFxuLy8gcmVzdG9yYXRpb24gdHVybiBjb21wb3NpdGlvbikgYXJlIGNvdmVyZWQgYnlcbi8vIGVudGl0eS1sYXJnZS1iYXRjaGVzLXYxNi1jb250cm9scy5zcGVjLnRzLlxudHlwZSBSb3cgPSB7IGlkOiBudW1iZXI7IG46IG51bWJlciB9O1xuY29uc3Qgcm93cyA9IChjb3VudDogbnVtYmVyLCBvZmZzZXQgPSAwKTogUm93W10gPT5cbiAgQXJyYXkuZnJvbSh7IGxlbmd0aDogY291bnQgfSwgKF8sIGkpID0+ICh7IGlkOiBpICsgb2Zmc2V0LCBuOiBpIH0pKTtcbmNvbnN0IGZsdXNoID0gYXN5bmMgKCkgPT4ge1xuICBmb3IgKGxldCBpID0gMDsgaSA8IDEyOyBpKyspIGF3YWl0IFByb21pc2UucmVzb2x2ZSgpO1xufTtcbi8vIFBhc3QgVjgncyB+MS4yZTUgYXJndW1lbnQgbGltaXQsIHNtYWxsIGVub3VnaCBmb3IgYSByZXN0b3JhdGlvbi1lbmFibGVkIHVuZG8uXG5jb25zdCBMQVJHRSA9IDIwNDg7XG5cbmRlc2NyaWJlKCdlbnRpdHkgYmF0Y2hlcyBsYXJnZXIgdGhhbiB0aGUgYXJndW1lbnQgbGltaXQnLCAoKSA9PiB7XG4gIC8vIFRpbWVvdXQgYWRkZWQgb24gdjE2IChubyBhc3NlcnRpb24gY2hhbmdlZCk6IHdpdGhvdXQgc2xpY2UgOSdzIGRlbWFuZFxuICAvLyBnYXRlIHYxNiBidWlsZHMgZXZlcnkgcm93J3Mgbm90aWZpY2F0aW9uIHBheWxvYWQsIHNvIHRoaXMgY2FzZSBtZWFzdXJlZFxuICAvLyB+MeKAkzIuNSBzIGFsb25lIGFuZCA3IHMgdW5kZXIgcGFyYWxsZWwgbG9hZCAodjE1OiB+MC43IHMpOyBtZW1iZXJzaGlwXG4gIC8vIG9ic2VydmF0aW9uIGl0c2VsZiBhZGRzIGxpdHRsZSAocHJvYmVzL3BlcmYubG9nKS5cbiAgaXQoJ3NldEFsbCwgcmVwbGFjZSBhbmQgY2xlYXIgd2l0aCBtZW1iZXJzaGlwIG9ic2VydmVkJywgKCkgPT4ge1xuICAgIG1lbW9yeVN0YWdlKCdtZW1iZXJzaGlwOmJlZm9yZS1jcmVhdGUnKTsgLy8gTUVNT1JZLU9OTFlcbiAgICBjb25zdCB0cmVlID0gc2lnbmFsVHJlZSh7IHJvd3M6IGVudGl0eU1hcDxSb3csIG51bWJlcj4oKSB9KTtcbiAgICBtZW1vcnlTdGFnZSgnbWVtYmVyc2hpcDphZnRlci1jcmVhdGUnKTsgLy8gTUVNT1JZLU9OTFlcbiAgICBjb25zdCByZWFkZXIgPSBlbnRpdHlNZW1iZXJzaGlwUmVhZGVyKHRyZWUpITtcbiAgICBsZXQgZXZlbnRzID0gMDtcbiAgICBjb25zdCBzdG9wID0gcmVhZGVyLnN1YnNjcmliZSgoKSA9PiBldmVudHMrKyk7XG4gICAgdHJ5IHtcbiAgICBtZW1vcnlTdGFnZSgnbWVtYmVyc2hpcDpiZWZvcmUtc2VlZCcpOyAvLyBNRU1PUlktT05MWVxuICAgICAgdHJlZS4kLnJvd3Muc2V0QWxsKHJvd3MoTEFSR0UpKTtcbiAgICBtZW1vcnlTdGFnZSgnbWVtYmVyc2hpcDphZnRlci1zZWVkJyk7IC8vIE1FTU9SWS1PTkxZXG4gICAgbWVtb3J5U3RhZ2UoJ21lbWJlcnNoaXA6YmVmb3JlLXJlcGxhY2UnKTsgLy8gTUVNT1JZLU9OTFlcbiAgICAgIHRyZWUuJC5yb3dzLnNldEFsbChyb3dzKExBUkdFLCBMQVJHRSkpO1xuICAgIG1lbW9yeVN0YWdlKCdtZW1iZXJzaGlwOmFmdGVyLXJlcGxhY2UnKTsgLy8gTUVNT1JZLU9OTFlcbiAgICBtZW1vcnlTdGFnZSgnbWVtYmVyc2hpcDpiZWZvcmUtY2xlYXInKTsgLy8gTUVNT1JZLU9OTFlcbiAgICAgIHRyZWUuJC5yb3dzLnNldEFsbChbXSk7XG4gICAgbWVtb3J5U3RhZ2UoJ21lbWJlcnNoaXA6YWZ0ZXItY2xlYXInKTsgLy8gTUVNT1JZLU9OTFlcbiAgICAgIGV4cGVjdCh0cmVlLiQucm93cy5jb3VudCgpKS50b0JlKDApO1xuICAgICAgZXhwZWN0KGV2ZW50cykudG9CZUdyZWF0ZXJUaGFuKDApO1xuICAgIG1lbW9yeVN0YWdlKCdtZW1iZXJzaGlwOmFmdGVyLW9yaWdpbmFsLWFzc2VydGlvbnMnKTsgLy8gTUVNT1JZLU9OTFlcbiAgICB9IGZpbmFsbHkge1xuICAgIG1lbW9yeVN0YWdlKCdtZW1iZXJzaGlwOmJlZm9yZS1zdG9wJyk7IC8vIE1FTU9SWS1PTkxZXG4gICAgICBzdG9wKCk7XG4gICAgbWVtb3J5U3RhZ2UoJ21lbWJlcnNoaXA6YWZ0ZXItc3RvcCcpOyAvLyBNRU1PUlktT05MWVxuICAgIG1lbW9yeVN0YWdlKCdtZW1iZXJzaGlwOmJlZm9yZS1kZXN0cm95Jyk7IC8vIE1FTU9SWS1PTkxZXG4gICAgICB0cmVlLmRlc3Ryb3koKTtcbiAgICBtZW1vcnlTdGFnZSgnbWVtYmVyc2hpcDphZnRlci1kZXN0cm95Jyk7IC8vIE1FTU9SWS1PTkxZXG4gICAgfVxuICB9LCA2MF8wMDApO1xuXG4gIGl0KCd1bmRvIGFuZCByZWRvIG9mIGEgc2V0QWxsIHRoYXQgcmVwbGFjZWQgZXZlcnkgcm93JywgYXN5bmMgKCkgPT4ge1xuICAgIG1lbW9yeVN0YWdlKCdyZXN0b3JhdGlvbjpiZWZvcmUtY3JlYXRlJyk7IC8vIE1FTU9SWS1PTkxZXG4gICAgY29uc3QgdHJlZSA9IHNpZ25hbFRyZWUoXG4gICAgICB7IHJvd3M6IGVudGl0eU1hcDxSb3csIG51bWJlcj4oKSB9LFxuICAgICAgeyBlbmhhbmNlcnM6IFtyZXN0b3JhdGlvbigpXSB9XG4gICAgKTtcbiAgICBtZW1vcnlTdGFnZSgncmVzdG9yYXRpb246YWZ0ZXItY3JlYXRlJyk7IC8vIE1FTU9SWS1PTkxZXG4gICAgdHJ5IHtcbiAgICBtZW1vcnlTdGFnZSgncmVzdG9yYXRpb246YmVmb3JlLXNlZWQnKTsgLy8gTUVNT1JZLU9OTFlcbiAgICAgIHRyZWUuJC5yb3dzLnNldEFsbChyb3dzKExBUkdFKSk7XG4gICAgbWVtb3J5U3RhZ2UoJ3Jlc3RvcmF0aW9uOmFmdGVyLXNlZWQnKTsgLy8gTUVNT1JZLU9OTFlcbiAgICAgIGF3YWl0IGZsdXNoKCk7XG4gICAgbWVtb3J5U3RhZ2UoJ3Jlc3RvcmF0aW9uOmFmdGVyLW9yaWdpbmFsLWRyYWluJyk7IC8vIE1FTU9SWS1PTkxZXG4gICAgbWVtb3J5U3RhZ2UoJ3Jlc3RvcmF0aW9uOmJlZm9yZS1yZXBsYWNlJyk7IC8vIE1FTU9SWS1PTkxZXG4gICAgc2FtcGxlU3RhcnQoJ3JlcGxhY2VtZW50Jyk7IC8vIFNBTVBMSU5HLU9OTFlcbiAgICAgIHVuZG9hYmxlKCgpID0+IHRyZWUuJC5yb3dzLnNldEFsbChyb3dzKExBUkdFLCBMQVJHRSkpKTtcbiAgICAgIGF3YWl0IGZsdXNoKCk7XG4gICAgc2FtcGxlU3RvcCgncmVwbGFjZW1lbnQnKTsgLy8gU0FNUExJTkctT05MWVxuICAgIG1lbW9yeVN0YWdlKCdyZXN0b3JhdGlvbjphZnRlci1vcmlnaW5hbC1kcmFpbicpOyAvLyBNRU1PUlktT05MWVxuICAgIG1lbW9yeVN0YWdlKCdyZXN0b3JhdGlvbjpiZWZvcmUtdW5kbycpOyAvLyBNRU1PUlktT05MWVxuICAgIHNhbXBsZVN0YXJ0KCd1bmRvJyk7IC8vIFNBTVBMSU5HLU9OTFlcbiAgICAgIHRyZWUudW5kbygpO1xuICAgIHNhbXBsZVN0b3AoJ3VuZG8nKTsgLy8gU0FNUExJTkctT05MWVxuICAgIG1lbW9yeVN0YWdlKCdyZXN0b3JhdGlvbjphZnRlci11bmRvJyk7IC8vIE1FTU9SWS1PTkxZXG4gICAgICBleHBlY3QodHJlZS4kLnJvd3MuY291bnQoKSkudG9CZShMQVJHRSk7XG4gICAgICBleHBlY3QodHJlZS4kLnJvd3MuaWRzKClbMF0pLnRvQmUoMCk7XG4gICAgbWVtb3J5U3RhZ2UoJ3Jlc3RvcmF0aW9uOmFmdGVyLXVuZG8tYXNzZXJ0aW9ucycpOyAvLyBNRU1PUlktT05MWVxuICAgIG1lbW9yeVN0YWdlKCdyZXN0b3JhdGlvbjpiZWZvcmUtcmVkbycpOyAvLyBNRU1PUlktT05MWVxuICAgIHNhbXBsZVN0YXJ0KCdyZWRvJyk7IC8vIFNBTVBMSU5HLU9OTFlcbiAgICAgIHRyZWUucmVkbygpO1xuICAgIHNhbXBsZVN0b3AoJ3JlZG8nKTsgLy8gU0FNUExJTkctT05MWVxuICAgIG1lbW9yeVN0YWdlKCdyZXN0b3JhdGlvbjphZnRlci1yZWRvJyk7IC8vIE1FTU9SWS1PTkxZXG4gICAgICBleHBlY3QodHJlZS4kLnJvd3MuaWRzKClbMF0pLnRvQmUoTEFSR0UpO1xuICAgIG1lbW9yeVN0YWdlKCdyZXN0b3JhdGlvbjphZnRlci1yZWRvLWFzc2VydGlvbicpOyAvLyBNRU1PUlktT05MWVxuICAgIH0gZmluYWxseSB7XG4gICAgbWVtb3J5U3RhZ2UoJ3Jlc3RvcmF0aW9uOmJlZm9yZS1kZXN0cm95Jyk7IC8vIE1FTU9SWS1PTkxZXG4gICAgICB0cmVlLmRlc3Ryb3koKTtcbiAgICBtZW1vcnlTdGFnZSgncmVzdG9yYXRpb246YWZ0ZXItZGVzdHJveScpOyAvLyBNRU1PUlktT05MWVxuICAgIHNhbXBsZUNsb3NlKCk7IC8vIFNBTVBMSU5HLU9OTFlcbiAgICB9XG4gIH0sIDEyMF8wMDApO1xufSk7XG5cbi8vIEd1YXJkIHRoZSBoaXN0b3JpY2FsIHBlci1yZW1vdmFsIGZpbmRJbmRleCBzZWFyY2gsIG5vdCB3YWxsLWNsb2NrIHRpbWUgb3Jcbi8vIGV2ZXJ5IHBvc3NpYmxlIHF1YWRyYXRpYyBpbXBsZW1lbnRhdGlvbi4gQWxsb3cgb25lIGZ1bGwgc2NhbiBwZXIgc2V0QWxsO1xuLy8gc2VhcmNoaW5nIGZyb20gdGhlIHN0YXJ0IGZvciBlYWNoIHJlbW92ZWQgcm93IHZpc2l0cyBuICogKG4gKyAxKSAvIDIgaXRlbXMuXG4vLyBGaXh0dXJlcyBhcmUgYnVpbHQgYmVmb3JlIGNvdW50aW5nLiBPbmx5IHN5bmNocm9ub3VzIHNldEFsbCB3b3JrIGlzIGNvdW50ZWQ7XG4vLyBubyBhd2FpdCBvciBhc3NlcnRpb24gcnVucyB3aXRoIHRoZSBwcm90b3R5cGUgaW5zdHJ1bWVudGVkLiBEbyBub3QgbWFrZSB0aGVzZVxuLy8gdGVzdHMgY29uY3VycmVudC4gT3RoZXIgVml0ZXN0IGZpbGVzIHJ1biBpbiBpc29sYXRlZCB3b3JrZXJzLlxuZnVuY3Rpb24gZmluZEluZGV4VmlzaXRzKGFjdGlvbjogKCkgPT4gdm9pZCk6IG51bWJlciB7XG4gIGNvbnN0IG9yaWdpbmFsID0gQXJyYXkucHJvdG90eXBlLmZpbmRJbmRleDtcbiAgbGV0IHZpc2l0cyA9IDA7XG4gIEFycmF5LnByb3RvdHlwZS5maW5kSW5kZXggPSBmdW5jdGlvbiA8VD4oXG4gICAgdGhpczogVFtdLFxuICAgIHByZWRpY2F0ZTogKHZhbHVlOiBULCBpbmRleDogbnVtYmVyLCBhcnJheTogVFtdKSA9PiB1bmtub3duLFxuICAgIHRoaXNBcmc/OiB1bmtub3duXG4gICk6IG51bWJlciB7XG4gICAgcmV0dXJuIG9yaWdpbmFsLmNhbGwodGhpcywgKHZhbHVlOiBULCBpbmRleDogbnVtYmVyLCBhcnJheTogVFtdKSA9PiB7XG4gICAgICB2aXNpdHMgKz0gMTtcbiAgICAgIHJldHVybiBwcmVkaWNhdGUuY2FsbCh0aGlzQXJnLCB2YWx1ZSwgaW5kZXgsIGFycmF5KTtcbiAgICB9KTtcbiAgfTtcbiAgdHJ5IHtcbiAgICBhY3Rpb24oKTtcbiAgICByZXR1cm4gdmlzaXRzO1xuICB9IGZpbmFsbHkge1xuICAgIEFycmF5LnByb3RvdHlwZS5maW5kSW5kZXggPSBvcmlnaW5hbDtcbiAgfVxufVxuXG5kZXNjcmliZSgnc2V0QWxsIHJlbW92YWwgbmVpZ2hib3VyIHNlYXJjaCB3b3JrJywgKCkgPT4ge1xuICBpdCgnY291bnRzIHByZWRpY2F0ZSB2aXNpdHMgYW5kIHJlc3RvcmVzIGluc3RydW1lbnRhdGlvbiBldmVuIG9uIGZhaWx1cmUnLCAoKSA9PiB7XG4gICAgY29uc3Qgb3JpZ2luYWwgPSBBcnJheS5wcm90b3R5cGUuZmluZEluZGV4O1xuICAgIGNvbnN0IHZhbHVlcyA9IFsxMCwgMjAsIDMwXTtcbiAgICBjb25zdCBjb250ZXh0ID0geyB0YXJnZXQ6IDIwIH07XG4gICAgbGV0IGZvdW5kID0gLTE7XG4gICAgY29uc3QgdmlzaXRzID0gZmluZEluZGV4VmlzaXRzKCgpID0+IHtcbiAgICAgIGZvdW5kID0gdmFsdWVzLmZpbmRJbmRleChmdW5jdGlvbiAodGhpczogdHlwZW9mIGNvbnRleHQsIHZhbHVlKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZSA9PT0gdGhpcy50YXJnZXQ7XG4gICAgICB9LCBjb250ZXh0KTtcbiAgICB9KTtcbiAgICBleHBlY3QoZm91bmQpLnRvQmUoMSk7XG4gICAgZXhwZWN0KHZpc2l0cykudG9CZSgyKTtcbiAgICBleHBlY3QoQXJyYXkucHJvdG90eXBlLmZpbmRJbmRleCkudG9CZShvcmlnaW5hbCk7XG4gICAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoJ2luc3RydW1lbnRlZCBwcmVkaWNhdGUgZmFpbGVkJyk7XG4gICAgZXhwZWN0KCgpID0+XG4gICAgICBmaW5kSW5kZXhWaXNpdHMoKCkgPT4ge1xuICAgICAgICB2YWx1ZXMuZmluZEluZGV4KCgpID0+IHtcbiAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgfSk7XG4gICAgICB9KVxuICAgICkudG9UaHJvdyhlcnJvcik7XG4gICAgZXhwZWN0KEFycmF5LnByb3RvdHlwZS5maW5kSW5kZXgpLnRvQmUob3JpZ2luYWwpO1xuICB9KTtcblxuICBkZXNjcmliZS5lYWNoKFsncGxhaW4nLCAnb2JzZXJ2ZWQnXSBhcyBjb25zdCkoJyVzIHRyZWUnLCAobW9kZSkgPT4ge1xuICAgIGNvbnN0IGNoZWNrID0gYXN5bmMgKGNvdW50OiBudW1iZXIsIHJlcGxhY2VtZW50OiBSb3dbXSkgPT4ge1xuICAgICAgY29uc3QgaW5pdGlhbCA9IHJvd3MoY291bnQpO1xuICAgICAgY29uc3QgaW5pdGlhbElkcyA9IGluaXRpYWwubWFwKChyb3cpID0+IHJvdy5pZCk7XG4gICAgICBjb25zdCByZXBsYWNlbWVudElkcyA9IHJlcGxhY2VtZW50Lm1hcCgocm93KSA9PiByb3cuaWQpO1xuICAgICAgY29uc3QgdHJlZSA9IHNpZ25hbFRyZWUoXG4gICAgICAgIHsgcm93czogZW50aXR5TWFwPFJvdywgbnVtYmVyPigpIH0sXG4gICAgICAgIHsgZW5oYW5jZXJzOiBtb2RlID09PSAnb2JzZXJ2ZWQnID8gW3Jlc3RvcmF0aW9uKCldIDogW10gfVxuICAgICAgKTtcbiAgICAgIHRyeSB7XG4gICAgICAgIHRyZWUuJC5yb3dzLnNldEFsbChpbml0aWFsKTtcbiAgICAgICAgYXdhaXQgZmx1c2goKTtcbiAgICAgICAgY29uc3QgYXBwbHkgPSAoKSA9PiB0cmVlLiQucm93cy5zZXRBbGwocmVwbGFjZW1lbnQpO1xuICAgICAgICBjb25zdCB2aXNpdHMgPSBmaW5kSW5kZXhWaXNpdHMoKCkgPT4ge1xuICAgICAgICAgIGlmIChtb2RlID09PSAnb2JzZXJ2ZWQnKSB1bmRvYWJsZShhcHBseSk7XG4gICAgICAgICAgZWxzZSBhcHBseSgpO1xuICAgICAgICB9KTtcbiAgICAgICAgZXhwZWN0KFxuICAgICAgICAgIHZpc2l0cyxcbiAgICAgICAgICAnZmluZEluZGV4IHByZWRpY2F0ZSB2aXNpdHMgZHVyaW5nIHNldEFsbCdcbiAgICAgICAgKS50b0JlTGVzc1RoYW5PckVxdWFsKGNvdW50KTtcbiAgICAgICAgZXhwZWN0KHRyZWUuJC5yb3dzLmlkcygpKS50b0VxdWFsKHJlcGxhY2VtZW50SWRzKTtcbiAgICAgICAgaWYgKG1vZGUgPT09ICdvYnNlcnZlZCcpIHtcbiAgICAgICAgICAvLyBSZXN0b3JhdGlvbiByZWNlaXZlcyB0aGUgc3RydWN0dXJhbCByZW1vdmFsIHBheWxvYWRzLiBWZXJpZnkgaXRcbiAgICAgICAgICAvLyBhY3R1YWxseSBjYXB0dXJlZCB0aGUgb3BlcmF0aW9uIHNvIGRlbWFuZCBnYXRpbmcgY2Fubm90IG1ha2UgdGhpc1xuICAgICAgICAgIC8vIHBhdGggdmFjdW91czsgdW5kbyBhbHNvIGNoZWNrcyBhbGwgcHJlLXN0YXRlIG5laWdoYm91ciBwb3NpdGlvbnMuXG4gICAgICAgICAgYXdhaXQgZmx1c2goKTtcbiAgICAgICAgICB0cmVlLnVuZG8oKTtcbiAgICAgICAgICBleHBlY3QodHJlZS4kLnJvd3MuaWRzKCkpLnRvRXF1YWwoaW5pdGlhbElkcyk7XG4gICAgICAgIH1cbiAgICAgIH0gZmluYWxseSB7XG4gICAgICAgIHRyZWUuZGVzdHJveSgpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBpdC5lYWNoKFsyNTYsIDFfMDI0XSkoJ3JlcGxhY2luZyBldmVyeSBpZCAoJWkgcm93cyknLCBhc3luYyAoY291bnQpID0+IHtcbiAgICAgIGF3YWl0IGNoZWNrKGNvdW50LCByb3dzKGNvdW50LCBjb3VudCkpO1xuICAgIH0pO1xuXG4gICAgaXQuZWFjaChbMjU2LCAxXzAyNF0pKFxuICAgICAgJ2NsZWFyaW5nIHdpdGggc2V0QWxsKFtdKSAoJWkgcm93cyknLFxuICAgICAgYXN5bmMgKGNvdW50KSA9PiB7XG4gICAgICAgIGF3YWl0IGNoZWNrKGNvdW50LCBbXSk7XG4gICAgICB9XG4gICAgKTtcbiAgfSk7XG59KTtcbiJdLCJmaWxlIjoiL3NyYy9saWIvZW50aXR5LWxhcmdlLWJhdGNoZXMuc3BlYy50cyJ9

//# vitestCache=W3siZmlsZSI6IjEiLCJpZCI6IjEiLCJ1cmwiOiIyIiwiaW1wb3J0ZWRVcmxzIjoiMyIsIm1hcHBpbmdzIjpmYWxzZX0sIi9wcml2YXRlL3RtcC9zdC1jMjgtcjMtc2FtcGxlZC1hbGxvY2F0aW9uL2Jhc2VsaW5lL2NhbmRpZGF0ZS9wYWNrYWdlcy9rZXJuZWwvc3JjL2xpYi9lbnRpdHktbGFyZ2UtYmF0Y2hlcy5zcGVjLnRzIiwiL3NyYy9saWIvZW50aXR5LWxhcmdlLWJhdGNoZXMuc3BlYy50cyIsW11d
}}