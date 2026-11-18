/**
 * Playwright config for the demo route-smoke suite.
 *
 * Serves the ALREADY-BUILT demo (dist/apps/demo/browser) via the
 * dependency-free serve-dist.mjs and runs route-smoke.spec.ts against it.
 *
 * Local:  npx nx build demo --configuration=production
 *         npm run smoke:routes
 * CI:     validate.yml → demo-route-smoke job
 */
import { defineConfig } from '@playwright/test';

// Separate local worktrees must serve their own artifacts during validation.
const port = Number(process.env['DEMO_PORT'] ?? '4173');
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error('DEMO_PORT must be an integer between 1024 and 65535');
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: '.',
  testMatch: [
    'route-smoke.spec.ts',
    'v16-candidate-workflow.spec.ts',
    'architecture-connectors.spec.ts',
    'benchmarks.spec.ts',
    'demo-production-bundle.spec.ts',
    'hover-language.spec.ts',
    'mobile-layout.spec.ts',
    'layout-system.spec.ts',
    'visual-language.spec.ts',
  ],
  timeout: 60_000,
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['list']],
  // Keep traces/artifacts out of the repo root — an untracked test-results/
  // would fail pre-publish validation's clean-working-dir gate.
  outputDir: '../../test-results/route-smoke',
  use: {
    baseURL,
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `node scripts/playwright/serve-dist.mjs ${port}`,
    cwd: '../..',
    url: baseURL,
    reuseExistingServer: !process.env['CI'],
    timeout: 30_000,
  },
});
