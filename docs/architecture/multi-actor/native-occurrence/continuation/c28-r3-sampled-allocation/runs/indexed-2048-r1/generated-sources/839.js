'use strict';async (__vite_ssr_exports__,__vite_ssr_import_meta__,__vite_ssr_import__,__vite_ssr_dynamic_import__,__vite_ssr_exportAll__,__vite_ssr_exportName__,__filename,__dirname,module,exports,require)=>{{Object.defineProperty(__vite_ssr_exports__, "createPreparedPlacementVisibility", { enumerable: true, configurable: true, get(){ try { return createPreparedPlacementVisibility } catch {} }});
function createPreparedPlacementVisibility(physical, isVisible, entries) {
  const overrides = /* @__PURE__ */ new Map();
  const positions = /* @__PURE__ */ new Map();
  let built = false;
  const visible = (id) => overrides.get(id) ?? isVisible(id);
  function build() {
    if (built) return;
    built = true;
    const present = new Map(
      (entries ?? [...physical.patch]).filter(
        (entry) => entry[1].present
      )
    );
    const visited = /* @__PURE__ */ new Set();
    for (const [id, row] of present) {
      if (visited.has(id) || row.beforeSubject !== void 0 && present.has(row.beforeSubject))
        continue;
      const ids = [];
      let next = id;
      while (next !== void 0 && present.has(next) && !visited.has(next)) {
        visited.add(next);
        ids.push(next);
        next = present.get(next)?.afterSubject;
      };
      let size = 1;
      while (size < ids.length) size *= 2;
      const run = { ids, size, counts: new Array(size * 2).fill(0) };
      ids.forEach((subject, at) => {
        positions.set(subject, { run, at });
        run.counts[size + at] = Number(visible(subject));
      });
      for (let i = size - 1; i > 0; i--)
        run.counts[i] = run.counts[i * 2] + run.counts[i * 2 + 1];
    }
  }
  function find(run, lo, hi, reverse, node = 1, left = 0, right = run.size - 1) {
    if (lo > right || hi < left || run.counts[node] === 0) return void 0;
    if (left === right) return left;
    const mid = left + right >>> 1;
    const first = reverse ? find(run, lo, hi, reverse, node * 2 + 1, mid + 1, right) : find(run, lo, hi, reverse, node * 2, left, mid);
    return first ?? (reverse ? find(run, lo, hi, reverse, node * 2, left, mid) : find(run, lo, hi, reverse, node * 2 + 1, mid + 1, right));
  }
  return {
    setVisible(subject, value) {
      overrides.set(subject, value);
      const at = positions.get(subject);
      if (!at) return;
      let n = at.run.size + at.at;
      at.run.counts[n] = Number(value);
      while (n > 1) {
        n >>>= 1;
        at.run.counts[n] = at.run.counts[n * 2] + at.run.counts[n * 2 + 1];
      }
    },
    resolve(start, direction, excluded) {
      build();
      let subject = start;
      const seen = /* @__PURE__ */ new Set();
      while (subject !== void 0 && subject !== excluded && !seen.has(subject)) {
        seen.add(subject);
        const indexed = positions.get(subject);
        if (indexed) {
          const { run, at } = indexed;
          const stop = excluded === void 0 ? void 0 : positions.get(excluded);
          const reverse = direction === "before";
          const bound = stop?.run === run ? stop.at : void 0;
          const lo = reverse ? bound !== void 0 && bound <= at ? bound + 1 : 0 : at;
          const hi = reverse ? at : bound !== void 0 && bound >= at ? bound - 1 : run.ids.length - 1;
          const found = find(run, lo, hi, reverse);
          if (found !== void 0) return run.ids[found];
          if (bound !== void 0 && (reverse ? bound <= at : bound >= at))
            return void 0;
          const edge = physical.patch.get(
            run.ids[reverse ? 0 : run.ids.length - 1]
          );
          subject = edge?.present ? reverse ? edge.beforeSubject : edge.afterSubject : void 0;
        } else {
          if (visible(subject)) return subject;
          const row = physical.read(subject);
          if (!row.present) return void 0;
          subject = direction === "before" ? row.beforeSubject : row.afterSubject;
        }
      };
      return void 0;
    }
  };
}
//# sourceMappingSource=vite-generated
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6IkFBQUEsQ0FBQTtBQU9PLFNBQVMsa0NBQ2QsVUFDQSxXQUNBLFNBQ0E7QUFDQSxRQUFNLFlBQVksb0JBQUksSUFBcUI7QUFDM0MsUUFBTSxZQUFZLG9CQUFJLElBQXNDO0FBQzVELE1BQUksUUFBUTtBQUNaLFFBQU0sVUFBVSxDQUFDLE9BQWUsVUFBVSxJQUFJLEVBQUUsS0FBSyxVQUFVLEVBQUU7QUFDakUsV0FBUyxRQUFRO0FBQ2YsUUFBSSxNQUFPO0FBQ1gsWUFBUTtBQUNSLFVBQU0sVUFBVSxJQUFJO0FBQUEsT0FDakIsV0FBVyxDQUFDLEdBQUcsU0FBUyxLQUFLLEdBQUc7QUFBQSxRQUMvQixDQUNFLFVBSUcsTUFBTSxDQUFDLEVBQUU7QUFBQSxNQUNoQjtBQUFBLElBQ0Y7QUFDQSxVQUFNLFVBQVUsb0JBQUksSUFBWTtBQUNoQyxlQUFXLENBQUMsSUFBSSxHQUFHLEtBQUssU0FBUztBQUMvQixVQUNFLFFBQVEsSUFBSSxFQUFFLEtBQ2IsSUFBSSxrQkFBa0IsVUFBYSxRQUFRLElBQUksSUFBSSxhQUFhO0FBRWpFO0FBQ0YsWUFBTSxNQUFnQixDQUFDO0FBQ3ZCLFVBQUksT0FBMkI7QUFDL0IsYUFBTyxTQUFTLFVBQWEsUUFBUSxJQUFJLElBQUksS0FBSyxDQUFDLFFBQVEsSUFBSSxJQUFJLEdBQUc7QUFDcEUsZ0JBQVEsSUFBSSxJQUFJO0FBQ2hCLFlBQUksS0FBSyxJQUFJO0FBQ2IsZUFBTyxRQUFRLElBQUksSUFBSSxHQUFHO0FBQUEsTUFDNUI7QUFDQSxVQUFJLE9BQU87QUFDWCxhQUFPLE9BQU8sSUFBSSxPQUFRLFNBQVE7QUFDbEMsWUFBTSxNQUFXLEVBQUUsS0FBSyxNQUFNLFFBQVEsSUFBSSxNQUFNLE9BQU8sQ0FBQyxFQUFFLEtBQUssQ0FBQyxFQUFFO0FBQ2xFLFVBQUksUUFBUSxDQUFDLFNBQVMsT0FBTztBQUMzQixrQkFBVSxJQUFJLFNBQVMsRUFBRSxLQUFLLEdBQUcsQ0FBQztBQUNsQyxZQUFJLE9BQU8sT0FBTyxFQUFFLElBQUksT0FBTyxRQUFRLE9BQU8sQ0FBQztBQUFBLE1BQ2pELENBQUM7QUFDRCxlQUFTLElBQUksT0FBTyxHQUFHLElBQUksR0FBRztBQUM1QixZQUFJLE9BQU8sQ0FBQyxJQUFJLElBQUksT0FBTyxJQUFJLENBQUMsSUFBSSxJQUFJLE9BQU8sSUFBSSxJQUFJLENBQUM7QUFBQSxJQUM1RDtBQUFBLEVBRUY7QUFDQSxXQUFTLEtBQ1AsS0FDQSxJQUNBLElBQ0EsU0FDQSxPQUFPLEdBQ1AsT0FBTyxHQUNQLFFBQVEsSUFBSSxPQUFPLEdBQ0M7QUFDcEIsUUFBSSxLQUFLLFNBQVMsS0FBSyxRQUFRLElBQUksT0FBTyxJQUFJLE1BQU0sRUFBRyxRQUFPO0FBQzlELFFBQUksU0FBUyxNQUFPLFFBQU87QUFDM0IsVUFBTSxNQUFPLE9BQU8sVUFBVztBQUMvQixVQUFNLFFBQVEsVUFDVixLQUFLLEtBQUssSUFBSSxJQUFJLFNBQVMsT0FBTyxJQUFJLEdBQUcsTUFBTSxHQUFHLEtBQUssSUFDdkQsS0FBSyxLQUFLLElBQUksSUFBSSxTQUFTLE9BQU8sR0FBRyxNQUFNLEdBQUc7QUFDbEQsV0FDRSxVQUNDLFVBQ0csS0FBSyxLQUFLLElBQUksSUFBSSxTQUFTLE9BQU8sR0FBRyxNQUFNLEdBQUcsSUFDOUMsS0FBSyxLQUFLLElBQUksSUFBSSxTQUFTLE9BQU8sSUFBSSxHQUFHLE1BQU0sR0FBRyxLQUFLO0FBQUEsRUFFL0Q7QUFDQSxTQUFPO0FBQUEsSUFDTCxXQUFXLFNBQWlCLE9BQWdCO0FBQzFDLGdCQUFVLElBQUksU0FBUyxLQUFLO0FBQzVCLFlBQU0sS0FBSyxVQUFVLElBQUksT0FBTztBQUNoQyxVQUFJLENBQUMsR0FBSTtBQUNULFVBQUksSUFBSSxHQUFHLElBQUksT0FBTyxHQUFHO0FBQ3pCLFNBQUcsSUFBSSxPQUFPLENBQUMsSUFBSSxPQUFPLEtBQUs7QUFDL0IsYUFBTyxJQUFJLEdBQUc7QUFDWixlQUFPO0FBQ1AsV0FBRyxJQUFJLE9BQU8sQ0FBQyxJQUFJLEdBQUcsSUFBSSxPQUFPLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxPQUFPLElBQUksSUFBSSxDQUFDO0FBQUEsTUFDbkU7QUFBQSxJQUNGO0FBQUEsSUFDQSxRQUNFLE9BQ0EsV0FDQSxVQUNvQjtBQUNwQixZQUFNO0FBQ04sVUFBSSxVQUFVO0FBQ2QsWUFBTSxPQUFPLG9CQUFJLElBQVk7QUFDN0IsYUFDRSxZQUFZLFVBQ1osWUFBWSxZQUNaLENBQUMsS0FBSyxJQUFJLE9BQU8sR0FDakI7QUFDQSxhQUFLLElBQUksT0FBTztBQUNoQixjQUFNLFVBQVUsVUFBVSxJQUFJLE9BQU87QUFDckMsWUFBSSxTQUFTO0FBQ1gsZ0JBQU0sRUFBRSxLQUFLLEdBQUcsSUFBSTtBQUNwQixnQkFBTSxPQUNKLGFBQWEsU0FBWSxTQUFZLFVBQVUsSUFBSSxRQUFRO0FBQzdELGdCQUFNLFVBQVUsY0FBYztBQUM5QixnQkFBTSxRQUFRLE1BQU0sUUFBUSxNQUFNLEtBQUssS0FBSztBQUM1QyxnQkFBTSxLQUFLLFVBQ1AsVUFBVSxVQUFhLFNBQVMsS0FDOUIsUUFBUSxJQUNSLElBQ0Y7QUFDSixnQkFBTSxLQUFLLFVBQ1AsS0FDQSxVQUFVLFVBQWEsU0FBUyxLQUNoQyxRQUFRLElBQ1IsSUFBSSxJQUFJLFNBQVM7QUFDckIsZ0JBQU0sUUFBUSxLQUFLLEtBQUssSUFBSSxJQUFJLE9BQU87QUFDdkMsY0FBSSxVQUFVLE9BQVcsUUFBTyxJQUFJLElBQUksS0FBSztBQUM3QyxjQUFJLFVBQVUsV0FBYyxVQUFVLFNBQVMsS0FBSyxTQUFTO0FBQzNELG1CQUFPO0FBQ1QsZ0JBQU0sT0FBTyxTQUFTLE1BQU07QUFBQSxZQUMxQixJQUFJLElBQUksVUFBVSxJQUFJLElBQUksSUFBSSxTQUFTLENBQUM7QUFBQSxVQUMxQztBQUNBLG9CQUFVLE1BQU0sVUFDWixVQUNFLEtBQUssZ0JBQ0wsS0FBSyxlQUNQO0FBQUEsUUFDTixPQUFPO0FBQ0wsY0FBSSxRQUFRLE9BQU8sRUFBRyxRQUFPO0FBQzdCLGdCQUFNLE1BQU0sU0FBUyxLQUFLLE9BQU87QUFDakMsY0FBSSxDQUFDLElBQUksUUFBUyxRQUFPO0FBQ3pCLG9CQUNFLGNBQWMsV0FBVyxJQUFJLGdCQUFnQixJQUFJO0FBQUEsUUFDckQ7QUFBQSxNQUNGO0FBQ0EsYUFBTztBQUFBLElBQ1Q7QUFBQSxFQUNGO0FBQ0YiLCJuYW1lcyI6W10sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VzIjpbInByZXBhcmVkLXBsYWNlbWVudC12aXNpYmlsaXR5LnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB0eXBlIHtcbiAgRW50aXR5UGxhY2VtZW50U3RhZ2UsXG4gIFByZXBhcmVkUGxhY2VtZW50RW50cmllcyxcbn0gZnJvbSAnLi9lbnRpdHktcGxhY2VtZW50LXN0YWdlJztcbnR5cGUgRGlyZWN0aW9uID0gJ2JlZm9yZScgfCAnYWZ0ZXInO1xudHlwZSBSdW4gPSB7IGlkczogbnVtYmVyW107IHNpemU6IG51bWJlcjsgY291bnRzOiBudW1iZXJbXSB9O1xuLyoqIFRyYW5zaWVudCBxdWVyeSBpbmRleCBvdmVyIG9uZSBmaXhlZCBwaHlzaWNhbCBwcmVwYXJhdGlvbiwgbmV2ZXIgc3RhdGUgYXV0aG9yaXR5LiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVByZXBhcmVkUGxhY2VtZW50VmlzaWJpbGl0eTxLPihcbiAgcGh5c2ljYWw6IEVudGl0eVBsYWNlbWVudFN0YWdlPEs+LFxuICBpc1Zpc2libGU6IChzdWJqZWN0OiBudW1iZXIpID0+IGJvb2xlYW4sXG4gIGVudHJpZXM/OiBQcmVwYXJlZFBsYWNlbWVudEVudHJpZXM8Sz5cbikge1xuICBjb25zdCBvdmVycmlkZXMgPSBuZXcgTWFwPG51bWJlciwgYm9vbGVhbj4oKTtcbiAgY29uc3QgcG9zaXRpb25zID0gbmV3IE1hcDxudW1iZXIsIHsgcnVuOiBSdW47IGF0OiBudW1iZXIgfT4oKTtcbiAgbGV0IGJ1aWx0ID0gZmFsc2U7XG4gIGNvbnN0IHZpc2libGUgPSAoaWQ6IG51bWJlcikgPT4gb3ZlcnJpZGVzLmdldChpZCkgPz8gaXNWaXNpYmxlKGlkKTtcbiAgZnVuY3Rpb24gYnVpbGQoKSB7XG4gICAgaWYgKGJ1aWx0KSByZXR1cm47XG4gICAgYnVpbHQgPSB0cnVlO1xuICAgIGNvbnN0IHByZXNlbnQgPSBuZXcgTWFwKFxuICAgICAgKGVudHJpZXMgPz8gWy4uLnBoeXNpY2FsLnBhdGNoXSkuZmlsdGVyKFxuICAgICAgICAoXG4gICAgICAgICAgZW50cnlcbiAgICAgICAgKTogZW50cnkgaXMgcmVhZG9ubHkgW1xuICAgICAgICAgIG51bWJlcixcbiAgICAgICAgICBFeHRyYWN0PCh0eXBlb2YgZW50cnkpWzFdLCB7IHByZXNlbnQ6IHRydWUgfT5cbiAgICAgICAgXSA9PiBlbnRyeVsxXS5wcmVzZW50XG4gICAgICApXG4gICAgKTtcbiAgICBjb25zdCB2aXNpdGVkID0gbmV3IFNldDxudW1iZXI+KCk7XG4gICAgZm9yIChjb25zdCBbaWQsIHJvd10gb2YgcHJlc2VudCkge1xuICAgICAgaWYgKFxuICAgICAgICB2aXNpdGVkLmhhcyhpZCkgfHxcbiAgICAgICAgKHJvdy5iZWZvcmVTdWJqZWN0ICE9PSB1bmRlZmluZWQgJiYgcHJlc2VudC5oYXMocm93LmJlZm9yZVN1YmplY3QpKVxuICAgICAgKVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIGNvbnN0IGlkczogbnVtYmVyW10gPSBbXTtcbiAgICAgIGxldCBuZXh0OiBudW1iZXIgfCB1bmRlZmluZWQgPSBpZDtcbiAgICAgIHdoaWxlIChuZXh0ICE9PSB1bmRlZmluZWQgJiYgcHJlc2VudC5oYXMobmV4dCkgJiYgIXZpc2l0ZWQuaGFzKG5leHQpKSB7XG4gICAgICAgIHZpc2l0ZWQuYWRkKG5leHQpO1xuICAgICAgICBpZHMucHVzaChuZXh0KTtcbiAgICAgICAgbmV4dCA9IHByZXNlbnQuZ2V0KG5leHQpPy5hZnRlclN1YmplY3Q7XG4gICAgICB9XG4gICAgICBsZXQgc2l6ZSA9IDE7XG4gICAgICB3aGlsZSAoc2l6ZSA8IGlkcy5sZW5ndGgpIHNpemUgKj0gMjtcbiAgICAgIGNvbnN0IHJ1bjogUnVuID0geyBpZHMsIHNpemUsIGNvdW50czogbmV3IEFycmF5KHNpemUgKiAyKS5maWxsKDApIH07XG4gICAgICBpZHMuZm9yRWFjaCgoc3ViamVjdCwgYXQpID0+IHtcbiAgICAgICAgcG9zaXRpb25zLnNldChzdWJqZWN0LCB7IHJ1biwgYXQgfSk7XG4gICAgICAgIHJ1bi5jb3VudHNbc2l6ZSArIGF0XSA9IE51bWJlcih2aXNpYmxlKHN1YmplY3QpKTtcbiAgICAgIH0pO1xuICAgICAgZm9yIChsZXQgaSA9IHNpemUgLSAxOyBpID4gMDsgaS0tKVxuICAgICAgICBydW4uY291bnRzW2ldID0gcnVuLmNvdW50c1tpICogMl0gKyBydW4uY291bnRzW2kgKiAyICsgMV07XG4gICAgfVxuICAgIC8vIENvbXBvbmVudHMgd2l0aG91dCBhIHN0YXJ0IGFyZSBjeWNsaWM6IHByZXNlcnZlIG9yaWdpbmFsIGd1YXJkZWQgdHJhdmVyc2FsLlxuICB9XG4gIGZ1bmN0aW9uIGZpbmQoXG4gICAgcnVuOiBSdW4sXG4gICAgbG86IG51bWJlcixcbiAgICBoaTogbnVtYmVyLFxuICAgIHJldmVyc2U6IGJvb2xlYW4sXG4gICAgbm9kZSA9IDEsXG4gICAgbGVmdCA9IDAsXG4gICAgcmlnaHQgPSBydW4uc2l6ZSAtIDFcbiAgKTogbnVtYmVyIHwgdW5kZWZpbmVkIHtcbiAgICBpZiAobG8gPiByaWdodCB8fCBoaSA8IGxlZnQgfHwgcnVuLmNvdW50c1tub2RlXSA9PT0gMCkgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICBpZiAobGVmdCA9PT0gcmlnaHQpIHJldHVybiBsZWZ0O1xuICAgIGNvbnN0IG1pZCA9IChsZWZ0ICsgcmlnaHQpID4+PiAxO1xuICAgIGNvbnN0IGZpcnN0ID0gcmV2ZXJzZVxuICAgICAgPyBmaW5kKHJ1biwgbG8sIGhpLCByZXZlcnNlLCBub2RlICogMiArIDEsIG1pZCArIDEsIHJpZ2h0KVxuICAgICAgOiBmaW5kKHJ1biwgbG8sIGhpLCByZXZlcnNlLCBub2RlICogMiwgbGVmdCwgbWlkKTtcbiAgICByZXR1cm4gKFxuICAgICAgZmlyc3QgPz9cbiAgICAgIChyZXZlcnNlXG4gICAgICAgID8gZmluZChydW4sIGxvLCBoaSwgcmV2ZXJzZSwgbm9kZSAqIDIsIGxlZnQsIG1pZClcbiAgICAgICAgOiBmaW5kKHJ1biwgbG8sIGhpLCByZXZlcnNlLCBub2RlICogMiArIDEsIG1pZCArIDEsIHJpZ2h0KSlcbiAgICApO1xuICB9XG4gIHJldHVybiB7XG4gICAgc2V0VmlzaWJsZShzdWJqZWN0OiBudW1iZXIsIHZhbHVlOiBib29sZWFuKSB7XG4gICAgICBvdmVycmlkZXMuc2V0KHN1YmplY3QsIHZhbHVlKTtcbiAgICAgIGNvbnN0IGF0ID0gcG9zaXRpb25zLmdldChzdWJqZWN0KTtcbiAgICAgIGlmICghYXQpIHJldHVybjtcbiAgICAgIGxldCBuID0gYXQucnVuLnNpemUgKyBhdC5hdDtcbiAgICAgIGF0LnJ1bi5jb3VudHNbbl0gPSBOdW1iZXIodmFsdWUpO1xuICAgICAgd2hpbGUgKG4gPiAxKSB7XG4gICAgICAgIG4gPj4+PSAxO1xuICAgICAgICBhdC5ydW4uY291bnRzW25dID0gYXQucnVuLmNvdW50c1tuICogMl0gKyBhdC5ydW4uY291bnRzW24gKiAyICsgMV07XG4gICAgICB9XG4gICAgfSxcbiAgICByZXNvbHZlKFxuICAgICAgc3RhcnQ6IG51bWJlciB8IHVuZGVmaW5lZCxcbiAgICAgIGRpcmVjdGlvbjogRGlyZWN0aW9uLFxuICAgICAgZXhjbHVkZWQ/OiBudW1iZXJcbiAgICApOiBudW1iZXIgfCB1bmRlZmluZWQge1xuICAgICAgYnVpbGQoKTtcbiAgICAgIGxldCBzdWJqZWN0ID0gc3RhcnQ7XG4gICAgICBjb25zdCBzZWVuID0gbmV3IFNldDxudW1iZXI+KCk7XG4gICAgICB3aGlsZSAoXG4gICAgICAgIHN1YmplY3QgIT09IHVuZGVmaW5lZCAmJlxuICAgICAgICBzdWJqZWN0ICE9PSBleGNsdWRlZCAmJlxuICAgICAgICAhc2Vlbi5oYXMoc3ViamVjdClcbiAgICAgICkge1xuICAgICAgICBzZWVuLmFkZChzdWJqZWN0KTtcbiAgICAgICAgY29uc3QgaW5kZXhlZCA9IHBvc2l0aW9ucy5nZXQoc3ViamVjdCk7XG4gICAgICAgIGlmIChpbmRleGVkKSB7XG4gICAgICAgICAgY29uc3QgeyBydW4sIGF0IH0gPSBpbmRleGVkO1xuICAgICAgICAgIGNvbnN0IHN0b3AgPVxuICAgICAgICAgICAgZXhjbHVkZWQgPT09IHVuZGVmaW5lZCA/IHVuZGVmaW5lZCA6IHBvc2l0aW9ucy5nZXQoZXhjbHVkZWQpO1xuICAgICAgICAgIGNvbnN0IHJldmVyc2UgPSBkaXJlY3Rpb24gPT09ICdiZWZvcmUnO1xuICAgICAgICAgIGNvbnN0IGJvdW5kID0gc3RvcD8ucnVuID09PSBydW4gPyBzdG9wLmF0IDogdW5kZWZpbmVkO1xuICAgICAgICAgIGNvbnN0IGxvID0gcmV2ZXJzZVxuICAgICAgICAgICAgPyBib3VuZCAhPT0gdW5kZWZpbmVkICYmIGJvdW5kIDw9IGF0XG4gICAgICAgICAgICAgID8gYm91bmQgKyAxXG4gICAgICAgICAgICAgIDogMFxuICAgICAgICAgICAgOiBhdDtcbiAgICAgICAgICBjb25zdCBoaSA9IHJldmVyc2VcbiAgICAgICAgICAgID8gYXRcbiAgICAgICAgICAgIDogYm91bmQgIT09IHVuZGVmaW5lZCAmJiBib3VuZCA+PSBhdFxuICAgICAgICAgICAgPyBib3VuZCAtIDFcbiAgICAgICAgICAgIDogcnVuLmlkcy5sZW5ndGggLSAxO1xuICAgICAgICAgIGNvbnN0IGZvdW5kID0gZmluZChydW4sIGxvLCBoaSwgcmV2ZXJzZSk7XG4gICAgICAgICAgaWYgKGZvdW5kICE9PSB1bmRlZmluZWQpIHJldHVybiBydW4uaWRzW2ZvdW5kXTtcbiAgICAgICAgICBpZiAoYm91bmQgIT09IHVuZGVmaW5lZCAmJiAocmV2ZXJzZSA/IGJvdW5kIDw9IGF0IDogYm91bmQgPj0gYXQpKVxuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgICBjb25zdCBlZGdlID0gcGh5c2ljYWwucGF0Y2guZ2V0KFxuICAgICAgICAgICAgcnVuLmlkc1tyZXZlcnNlID8gMCA6IHJ1bi5pZHMubGVuZ3RoIC0gMV1cbiAgICAgICAgICApO1xuICAgICAgICAgIHN1YmplY3QgPSBlZGdlPy5wcmVzZW50XG4gICAgICAgICAgICA/IHJldmVyc2VcbiAgICAgICAgICAgICAgPyBlZGdlLmJlZm9yZVN1YmplY3RcbiAgICAgICAgICAgICAgOiBlZGdlLmFmdGVyU3ViamVjdFxuICAgICAgICAgICAgOiB1bmRlZmluZWQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKHZpc2libGUoc3ViamVjdCkpIHJldHVybiBzdWJqZWN0O1xuICAgICAgICAgIGNvbnN0IHJvdyA9IHBoeXNpY2FsLnJlYWQoc3ViamVjdCk7XG4gICAgICAgICAgaWYgKCFyb3cucHJlc2VudCkgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgICBzdWJqZWN0ID1cbiAgICAgICAgICAgIGRpcmVjdGlvbiA9PT0gJ2JlZm9yZScgPyByb3cuYmVmb3JlU3ViamVjdCA6IHJvdy5hZnRlclN1YmplY3Q7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfSxcbiAgfTtcbn1cbiJdLCJmaWxlIjoiL3NyYy9saWIvcGh5c2ljYWwvcHJlcGFyZWQtcGxhY2VtZW50LXZpc2liaWxpdHkudHMifQ==

//# vitestCache=W3siZmlsZSI6IjEiLCJpZCI6IjEiLCJ1cmwiOiIyIiwiaW1wb3J0ZWRVcmxzIjoiMyIsIm1hcHBpbmdzIjpmYWxzZX0sIi9wcml2YXRlL3RtcC9zdC1jMjgtcjMtc2FtcGxlZC1hbGxvY2F0aW9uL2luZGV4ZWQvY2FuZGlkYXRlL3BhY2thZ2VzL2tlcm5lbC9zcmMvbGliL3BoeXNpY2FsL3ByZXBhcmVkLXBsYWNlbWVudC12aXNpYmlsaXR5LnRzIiwiL3NyYy9saWIvcGh5c2ljYWwvcHJlcGFyZWQtcGxhY2VtZW50LXZpc2liaWxpdHkudHMiLFtdXQ==
}}