import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * v16 slice 8g: the production build deletes every
 * `recordProductionSubstrateStat(...)` statement from the source
 * (`rollup.custom.mjs`, `signaltree-strip-production-stats-calls`). A call
 * that is the unbraced body of an `if`, `for` or `while` leaves that statement
 * without its body, and the next statement becomes the body: guarded by
 * `PRODUCTION_SUBSTRATE_STATS_ENABLED` (false in production), it would never
 * run. 868bc9b8 did this; the build only failed where the next statement was
 * a declaration, and in `isAbsentMember` it would have compiled silently into
 * a cache that is never filled. Every such call stands in braces.
 */
describe('production stats calls', () => {
  it('are never the unbraced body of a control statement', () => {
    const root = join(__dirname, '..');
    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (name.endsWith('.ts') && !name.includes('.spec.'))
          files.push(path);
      }
    };
    walk(root);
    const offenders: string[] = [];
    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        // The call on the same line as its control statement.
        if (
          /^(if|for|while)\s*\(.*\)\s*recordProductionSubstrateStat\(/.test(
            trimmed
          )
        )
          offenders.push(`${relative(root, file)}:${index + 1}`);
        // The call on the line after a control statement with no brace.
        if (trimmed.startsWith('recordProductionSubstrateStat(')) {
          const previous = (lines[index - 1] ?? '').trim();
          if (
            /^(\}\s*else\s+)?(if|for|while)\b.*\)$/.test(previous) ||
            previous === 'else'
          )
            offenders.push(`${relative(root, file)}:${index + 1}`);
        }
      });
    }
    expect(files.length).toBeGreaterThan(50);
    expect(offenders).toEqual([]);
  });
});
