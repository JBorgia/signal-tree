import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { SUBJECTS } from '../subjects/index.ts';
import { ANGULAR_APP_DIR, OUT_DIR } from './paths.ts';

/** Builds the Angular reference app with `configuration` into `outputPath`; returns the served directory. */
export function buildAngularConfiguration(configuration: string, outputPath: string): string {
  const require = createRequire(join(ANGULAR_APP_DIR, 'package.json'));
  const ng = join(dirname(require.resolve('@angular/cli/package.json')), 'bin', 'ng.js');
  const result = spawnSync(process.execPath, [ng, 'build', `--configuration=${configuration}`, `--output-path=${outputPath}`], {
    cwd: ANGULAR_APP_DIR,
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, NG_CLI_ANALYTICS: 'false', NG_FORCE_TTY: 'false' },
  });
  if (result.status !== 0) throw new Error(`reference app build failed (exit ${result.status})`);
  return join(outputPath, 'browser');
}

/** Builds the Angular reference app against `subjectId` with the bench flag on; returns the served directory. */
export function buildAngularApp(subjectId: string, { skip = false } = {}): string {
  const entry = SUBJECTS[subjectId];
  if (!entry) throw new Error(`unknown subject ${subjectId}`);
  const outputPath = join(OUT_DIR, 'apps', 'angular', subjectId);
  if (skip) return join(outputPath, 'browser');
  return buildAngularConfiguration(entry.angularConfiguration, outputPath);
}
