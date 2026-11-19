/**
 * One fresh process: either one run of one scenario, or one isolated
 * measurement a scenario asked for. Invoked only by runner/process.ts:
 *   node --expose-gc runner/child.ts <scenario|isolate> <request.json> <reply.json>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { findDefinition } from '../scenarios/index.ts';
import { loadSubject } from '../subjects/index.ts';
import { runChild } from './process.ts';
import type { RunContext, Variant } from './types.ts';

export interface ScenarioRequest {
  readonly scenario: string;
  readonly subject: string;
  readonly variant: Variant;
  readonly runIndex: number;
  readonly params: Record<string, unknown>;
  readonly scale: Record<string, unknown>;
  readonly cpuThrottlingRate: number;
  readonly appDir: string | undefined;
  readonly s5Compressed: boolean;
}

export interface ScenarioReply {
  readonly metrics: Record<string, number>;
  readonly notes: Record<string, string | number>;
}

export interface IsolateRequest {
  readonly moduleUrl: string;
  readonly exportName: string;
  readonly args: unknown;
}

async function runScenario(request: ScenarioRequest): Promise<ScenarioReply> {
  const definition = findDefinition(request.scenario);
  if (definition.kind !== 'scenario') throw new Error(`${request.scenario} is not a runnable scenario`);
  const subject = await loadSubject(request.subject);
  const notes: Record<string, string | number> = {};
  const context: RunContext = {
    subject,
    params: request.params,
    scale: request.scale,
    variant: request.variant,
    runIndex: request.runIndex,
    cpuThrottlingRate: request.cpuThrottlingRate,
    appDir: request.appDir,
    s5Compressed: request.s5Compressed,
    isolate: (moduleUrl, exportName, args, nodeFlags) => runChild('isolate', { moduleUrl, exportName, args } satisfies IsolateRequest, nodeFlags),
    note: (key, value) => {
      notes[key] = value;
    },
    log: (message) => process.stderr.write(`[${request.scenario}] ${message}\n`),
  };
  const metrics = await definition.run(context);
  return { metrics, notes };
}

async function runIsolate(request: IsolateRequest): Promise<unknown> {
  const module = (await import(request.moduleUrl)) as Record<string, (args: unknown) => Promise<unknown>>;
  const fn = module[request.exportName];
  if (typeof fn !== 'function') throw new Error(`${request.moduleUrl} has no export ${request.exportName}`);
  return fn(request.args);
}

const [mode, requestPath, replyPath] = process.argv.slice(2);
if (!mode || !requestPath || !replyPath) throw new Error('usage: child.ts <scenario|isolate> <request.json> <reply.json>');
const request = JSON.parse(readFileSync(requestPath, 'utf8'));
try {
  const value = mode === 'isolate' ? await runIsolate(request) : await runScenario(request);
  writeFileSync(replyPath, JSON.stringify({ ok: true, value }));
} catch (error) {
  writeFileSync(replyPath, JSON.stringify({ ok: false, error: error instanceof Error ? (error.stack ?? error.message) : String(error) }));
  process.exitCode = 1;
}
