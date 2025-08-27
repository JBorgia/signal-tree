/*
Local pack-and-report script
- Packs `@signaltree/core` from dist (builds it first), creates a tarball via npm pack,
- Installs the tarball into the workspace (pnpm add), builds dependent packages, runs size report,
- Cleans up the installed tarball.

This is a low-friction, CI-appropriate flow for reproducible size reports without a registry.
*/
const { execSync } = require('child_process');
const { existsSync, rmSync } = require('fs');
const path = require('path');

const root = process.cwd();
const corePkg = path.join(root, 'packages', 'core');
const distCore = path.join(root, 'dist', 'packages', 'core');

function run(cmd) {
  console.log('>', cmd);
  execSync(cmd, { stdio: 'inherit' });
}

try {
  // Build core dist
  run('npx ng-packagr -p packages/core/ng-package.json');

  // Create tarball from dist and capture produced filename
  const cwd = distCore;
  if (!existsSync(cwd)) throw new Error('dist for core not found: ' + cwd);
  console.log('Packing core dist...');
  // ng-packagr sometimes writes a generated package.json with a 'files' entry
  // that points back to 'dist/packages/core' which makes npm pack include
  // only package.json/README when packing from the dist folder. Fix that
  // by normalizing the generated package.json to include the fesm2022 and d.ts
  // artifacts before packing.
  const generatedPkg = path.join(cwd, 'package.json');
  try {
    const pkgJson = JSON.parse(
      require('fs').readFileSync(generatedPkg, 'utf8')
    );
    // Ensure files includes the runtime entrypoints
    pkgJson.files = pkgJson.files || [];
    ['fesm2022', 'index.d.ts', 'README.md'].forEach((p) => {
      if (!pkgJson.files.includes(p)) pkgJson.files.push(p);
    });
    require('fs').writeFileSync(
      generatedPkg,
      JSON.stringify(pkgJson, null, 2),
      'utf8'
    );
  } catch (err) {
    console.warn('Could not patch generated package.json:', err && err.message);
  }
  const packOutput = execSync('npm pack', { cwd, encoding: 'utf8' }).trim();
  const tarName = packOutput.split(/\r?\n/).pop();
  if (!tarName || !tarName.endsWith('.tgz'))
    throw new Error('npm pack did not produce a tarball: ' + packOutput);
  const tarball = path.join(cwd, tarName);
  console.log('Tarball:', tarball);

  // Install tarball into workspace (pnpm add)
  run('pnpm add ' + JSON.stringify(tarball));

  // Build dependent packages (batching, devtools, middleware)
  run('npx ng-packagr -p packages/batching/ng-package.json');
  run('npx ng-packagr -p packages/devtools/ng-package.json');
  run('npx ng-packagr -p packages/middleware/ng-package.json');

  // Run size report
  run('node scripts/bundle-size-report.js');

  // Cleanup: remove installed tarball package
  run('pnpm remove @signaltree/core');

  // Remove tarball file if present
  try {
    if (existsSync(tarball)) rmSync(tarball);
  } catch (e) {
    console.warn('failed to remove tarball', e && e.message);
  }

  console.log('local-pack-and-report: completed');
} catch (err) {
  console.error('local-pack-and-report failed', err);
  process.exit(1);
}
