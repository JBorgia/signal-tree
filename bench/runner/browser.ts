/**
 * Browser side of the harness: serves the built reference app, launches the
 * Chromium build that @playwright/test 1.64.1 pins (ruling 6: the version comes
 * from the Playwright lock, not from whatever Chrome is installed), throttles
 * the CPU through CDP Emulation.setCPUThrottlingRate, and collects long
 * animation frames, event timing and the `signal-tree:` turn measures.
 */
import { chromium, type Browser, type CDPSession, type Page } from '@playwright/test';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize } from 'node:path';

export interface LoafEntry {
  readonly startTime: number;
  readonly duration: number;
  readonly blockingDuration: number;
  readonly scripts: readonly { readonly invoker: string; readonly sourceURL: string; readonly duration: number }[];
}

export interface EventEntry {
  readonly name: string;
  readonly startTime: number;
  readonly duration: number;
  readonly processingStart: number;
  readonly processingEnd: number;
  readonly interactionId: number;
}

export interface TurnEntry {
  readonly label: string;
  readonly startTime: number;
  readonly duration: number;
}

export interface KeyEstimate {
  readonly start: number;
  readonly nextFrame: number;
}

export interface PerfDrain {
  readonly loaf: LoafEntry[];
  readonly events: EventEntry[];
  readonly turns: TurnEntry[];
  readonly keys: KeyEstimate[];
}

/** Installed before any app script runs. */
const INIT_SCRIPT = `(() => {
  const perf = { loaf: [], events: [], keys: [] };
  Object.defineProperty(window, '__benchPerf', { value: perf });
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) perf.loaf.push({
      startTime: e.startTime, duration: e.duration, blockingDuration: e.blockingDuration,
      scripts: (e.scripts || []).map((s) => ({ invoker: s.invoker, sourceURL: s.sourceURL, duration: s.duration })),
    });
  }).observe({ type: 'long-animation-frame', buffered: true });
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) perf.events.push({
      name: e.name, startTime: e.startTime, duration: e.duration,
      processingStart: e.processingStart, processingEnd: e.processingEnd, interactionId: e.interactionId,
    });
  }).observe({ type: 'event', durationThreshold: 16, buffered: true });
  addEventListener('keydown', (e) => {
    const start = e.timeStamp;
    requestAnimationFrame(() => setTimeout(() => perf.keys.push({ start, nextFrame: performance.now() }), 0));
  }, true);
})();`;

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
};

function serve(root: string): Promise<Server> {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const relative = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
    let file = join(root, relative);
    if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
    response.writeHead(200, {
      'content-type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
      // Cross-origin isolation: Chrome coarsens performance.now() to 100 µs
      // without it and to 5 µs with it; store turns are sub-millisecond.
      'cross-origin-opener-policy': 'same-origin',
      'cross-origin-embedder-policy': 'require-corp',
    });
    createReadStream(file).pipe(response);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

export interface BenchPage {
  readonly page: Page;
  readonly cdp: CDPSession;
  readonly browserVersion: string;
  invoke<T = Record<string, number>>(op: string, args?: Record<string, unknown>): Promise<T>;
  /** Forces a full GC through CDP, then returns the JS heap in use (bytes). */
  heapUsed(): Promise<number>;
  /** CDP Performance.getMetrics TaskDuration: main-thread task time so far, in ms. */
  mainThreadTaskMs(): Promise<number>;
  /** Returns and clears the in-page long animation frames, event timings, key estimates and turn measures. */
  drainPerf(): Promise<PerfDrain>;
  settle(frames?: number): Promise<void>;
  close(): Promise<void>;
}

export interface OpenOptions {
  readonly appDir: string;
  readonly cpuThrottlingRate: number;
}

export async function openBenchPage(options: OpenOptions): Promise<BenchPage> {
  const server = await serve(options.appDir);
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({
      // The full Chromium build Playwright pins, in new headless mode.
      channel: 'chromium',
      headless: true,
      args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
    });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: options.cpuThrottlingRate });
    await cdp.send('Performance.enable', { timeDomain: 'timeTicks' });
    await page.addInitScript(INIT_SCRIPT);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    const port = (server.address() as AddressInfo).port;
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
    await page.waitForFunction(() => '__bench' in window || '__benchBootError' in window, undefined, { timeout: 60_000 });
    const bootError = await page.evaluate(() => (window as unknown as { __benchBootError?: string }).__benchBootError);
    if (bootError) throw new Error(`reference app failed to boot: ${bootError}`);
    if (!(await page.evaluate(() => crossOriginIsolated))) throw new Error('page is not cross-origin isolated; timer resolution would be 100 µs');
    const opened = browser;
    return {
      page,
      cdp,
      browserVersion: opened.version(),
      async invoke<T>(op: string, args: Record<string, unknown> = {}) {
        if (errors.length) throw new Error(`page error: ${errors.join('; ')}`);
        return (await page.evaluate(
          ([name, payload]) => (window as unknown as { __bench: { invoke(op: string, args: unknown): Promise<unknown> } }).__bench.invoke(name, payload),
          [op, args] as const,
        )) as T;
      },
      async heapUsed() {
        await cdp.send('HeapProfiler.collectGarbage');
        await cdp.send('HeapProfiler.collectGarbage');
        const usage = await cdp.send('Runtime.getHeapUsage');
        return usage.usedSize;
      },
      async mainThreadTaskMs() {
        const { metrics } = await cdp.send('Performance.getMetrics');
        const task = metrics.find((metric) => metric.name === 'TaskDuration');
        if (!task) throw new Error('CDP Performance.getMetrics returned no TaskDuration');
        return task.value * 1000;
      },
      async drainPerf() {
        return page.evaluate(() => {
          const perf = (window as unknown as { __benchPerf: { loaf: unknown[]; events: unknown[]; keys: unknown[] } }).__benchPerf;
          const turns = (performance.getEntriesByName('signal-tree:turn') as PerformanceMeasure[]).map((entry) => ({
            label: String(entry.detail),
            startTime: entry.startTime,
            duration: entry.duration,
          }));
          performance.clearMeasures('signal-tree:turn');
          const out = { loaf: perf.loaf.splice(0), events: perf.events.splice(0), keys: perf.keys.splice(0), turns };
          return out;
        }) as Promise<PerfDrain>;
      },
      async settle(frames = 2) {
        await page.evaluate(async (count) => {
          for (let i = 0; i < count; i++) await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
        }, frames);
      },
      async close() {
        await opened.close();
        await new Promise((resolve) => server.close(resolve));
      },
    };
  } catch (error) {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
    throw error;
  }
}

/** Long animation frames that overlap at least one turn measure (ruling 7). */
export function framesOverlappingTurns(frames: readonly LoafEntry[], turns: readonly TurnEntry[]): LoafEntry[] {
  return frames.filter((frame) =>
    turns.some((turn) => turn.startTime < frame.startTime + frame.duration && frame.startTime < turn.startTime + turn.duration),
  );
}

/**
 * Interaction latency of one keystroke (`key`, default the first one drained):
 * Event Timing (the longest entry sharing the keydown's interactionId, as INP
 * does), or, when no entry passed the API's 16 ms reporting floor, the in-page
 * keydown-to-next-frame estimate.
 */
export function keystrokeLatency(perf: PerfDrain, key: KeyEstimate | undefined = perf.keys[0]): { ms: number; source: 'event-timing' | 'next-frame-estimate'; processingMs: number } {
  if (!key) throw new Error('no keystroke was observed');
  const keydown = perf.events.find((event) => event.name === 'keydown' && event.interactionId > 0 && Math.abs(event.startTime - key.start) < 1);
  if (keydown) {
    const group = perf.events.filter((event) => event.interactionId === keydown.interactionId);
    return {
      ms: Math.max(...group.map((event) => event.duration)),
      source: 'event-timing',
      processingMs: Math.max(...group.map((event) => event.processingEnd)) - keydown.startTime,
    };
  }
  return { ms: key.nextFrame - key.start, source: 'next-frame-estimate', processingMs: Number.NaN };
}
