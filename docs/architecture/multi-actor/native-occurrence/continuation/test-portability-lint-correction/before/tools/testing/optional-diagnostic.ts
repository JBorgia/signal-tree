import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

// Test-only: callers serialize eagerly; only disk persistence is optional.
export function writeDiagnostic(
  file: string | undefined,
  text: string,
  append = false,
): void {
  if (!file) return;
  mkdirSync(dirname(file), { recursive: true });
  if (append) appendFileSync(file, text);
  else writeFileSync(file, text);
}
