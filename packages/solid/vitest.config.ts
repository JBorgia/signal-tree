import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import solid from 'vite-plugin-solid';

export default defineConfig({
  root: import.meta.dirname,
  // Solid's reactivity needs its compiler: without this a plain createEffect
  // never runs and every reactivity assertion passes vacuously.
  plugins: [solid()],
  resolve: {
    // Solid ships a client runtime AND an SSR build, selected by export
    // conditions. Under `environment: 'node'` the SSR build wins, and there
    // `createEffect` is a no-op -- every reactivity test would pass vacuously
    // by observing nothing. These conditions select the real runtime.
    conditions: ['development', 'browser'],
    // One Solid instance. Two copies means `unwrap` from one cannot recognise
    // a store created by the other, and the construction guard silently stops
    // detecting store proxies.
    dedupe: ['solid-js', 'solid-js/store'],
    alias: {
      '@signal-tree/kernel/adapter': fileURLToPath(
        new URL('../kernel/src/adapter.ts', import.meta.url)
      ),
      '@signal-tree/kernel': fileURLToPath(
        new URL('../kernel/src/index.ts', import.meta.url)
      ),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    server: { deps: { inline: [/solid-js/] } },
    exclude: ['**/*typing*.spec.ts'],
  },
});
