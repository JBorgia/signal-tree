import { openBenchPage, type BenchPage } from '../runner/browser.ts';
import type { RunContext } from '../runner/types.ts';

/** Opens the reference app at the gate's CPU throttle, runs `body`, and always closes the browser. */
export async function withBenchPage<T>(ctx: RunContext, body: (page: BenchPage) => Promise<T>): Promise<T> {
  if (!ctx.appDir) throw new Error('browser scenario without a built reference app');
  const page = await openBenchPage({ appDir: ctx.appDir, cpuThrottlingRate: ctx.cpuThrottlingRate });
  ctx.note('browserVersion', page.browserVersion);
  ctx.note('cpuThrottlingRate', ctx.cpuThrottlingRate);
  try {
    return await body(page);
  } finally {
    await page.close();
  }
}

/** Mounts the S2-shaped collection, loads `rows` rows and renders `rendered` of them. */
export async function loadedGrid(
  page: BenchPage,
  ctx: RunContext,
  shape: { rows: number; fields: number; rendered: number },
  plugins?: Record<string, unknown>,
): Promise<void> {
  await page.invoke('mount.collection', { variant: ctx.variant, plugins });
  await page.invoke('collection.generate', { rows: shape.rows, fields: shape.fields });
  await page.invoke('collection.load');
  await page.invoke('collection.render', { rendered: shape.rendered, fields: shape.fields });
  await page.settle(3);
  await page.drainPerf();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Collection size and rendered window from budgets.json scale (6.2). */
export function collectionShape(ctx: RunContext): { rows: number; fields: number; rendered: number } {
  const scale = ctx.scale as { largestCollection: { rows: number; fields: number }; rowsRenderedAtOnce: number };
  return { rows: scale.largestCollection.rows, fields: scale.largestCollection.fields, rendered: scale.rowsRenderedAtOnce };
}
