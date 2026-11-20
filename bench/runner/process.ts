import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CHILD_PATH, PRODUCTION_MODE_URL, TMP_DIR } from './paths.ts';

export type ChildMode = 'scenario' | 'isolate';

/**
 * Runs runner/child.ts in a fresh `node --expose-gc` process (Angular in
 * production mode, see production-mode.ts) and returns what
 * it wrote. Requests and replies travel through files in bench/out/tmp, so a
 * child's stdout stays free for logs.
 */
export async function runChild<T>(mode: ChildMode, request: unknown, nodeFlags: readonly string[] = []): Promise<T> {
  mkdirSync(TMP_DIR, { recursive: true });
  const id = randomUUID();
  const requestPath = join(TMP_DIR, `${id}.request.json`);
  const replyPath = join(TMP_DIR, `${id}.reply.json`);
  writeFileSync(requestPath, JSON.stringify(request));
  try {
    const code = await new Promise<number | null>((resolve, reject) => {
      const child = spawn(process.execPath, ['--expose-gc', '--import', PRODUCTION_MODE_URL, ...nodeFlags, CHILD_PATH, mode, requestPath, replyPath], {
        stdio: ['ignore', 'inherit', 'inherit'],
      });
      child.on('error', reject);
      child.on('exit', resolve);
    });
    let reply: { ok: boolean; value?: T; error?: string };
    try {
      reply = JSON.parse(readFileSync(replyPath, 'utf8'));
    } catch {
      throw new Error(`child process (${mode}) exited with code ${code} and no reply`);
    }
    if (!reply.ok) throw new Error(reply.error ?? `child process (${mode}) failed`);
    return reply.value as T;
  } finally {
    rmSync(requestPath, { force: true });
    rmSync(replyPath, { force: true });
  }
}
