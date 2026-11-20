import { fileURLToPath } from 'node:url';

export const BENCH_DIR = fileURLToPath(new URL('..', import.meta.url));
/** Gitignored: results, A/A files, built apps and scratch files. Never committed. */
export const OUT_DIR = fileURLToPath(new URL('../out/', import.meta.url));
export const TMP_DIR = fileURLToPath(new URL('../out/tmp/', import.meta.url));
export const CHILD_PATH = fileURLToPath(new URL('./child.ts', import.meta.url));
export const ANGULAR_APP_DIR = fileURLToPath(new URL('../apps/angular/', import.meta.url));
export const PRODUCTION_MODE_URL = new URL('./production-mode.ts', import.meta.url).href;
