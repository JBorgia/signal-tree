import { sealedInput } from './sealed-input.mjs';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, transform } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const repository = resolve(here, '../../../..');
const experiment = dirname(here);
const sealed = await sealedInput(process.argv.slice(2));
const active = sealed?.input.candidate ?? resolve(process.argv[2] ?? '/Users/jonathanborgia/.codex/worktrees/v16-incumbent-readiness/signaltree');
const head = '5727cd8fcf701128358674411400c019b137a5e4';
const git = (...args) => execFileSync('git', ['-C', active, ...args], { encoding: 'utf8' }).trim();
if (!sealed && git('rev-parse', 'HEAD') !== head) throw new Error('Unexpected active source HEAD');
if (process.version !== 'v24.15.0') throw new Error('Use .nvmrc Node v24.15.0');
const work = mkdtempSync('/private/tmp/st-installed-review-');
const logs = join(work, 'logs'); mkdirSync(logs);
const manifest = { sourceHead: sealed ? null : head, ...(sealed ? { sealedInput: sealed.input } : {}), work, commands: [], hashes: {}, results: {}, limits: ['Kernel only; no framework or full release qualification', 'Root tool dependencies reused; exact dependency lockfile equivalence is not claimed'] };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hashFile = path => { manifest.hashes[relative(work, path)] = sha(readFileSync(path)); };
function save() { writeFileSync(join(work, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n'); }
function run(name, command, args, cwd, allowedFailure = false) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, NX_DAEMON: 'false', NX_ISOLATE_PLUGINS: 'false', npm_config_cache: join(work, 'npm-cache'), npm_config_update_notifier: 'false' } });
  writeFileSync(join(logs, name + '.log'), `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? String(result.error) : ''}`);
  manifest.commands.push({ name, command, args, cwd, exit: result.status, signal: result.signal }); save();
  if (result.status !== 0 && !allowedFailure) throw new Error(`${name} failed; preserved ${join(logs, name + '.log')}`);
  return result;
}
function files(folder) { return readdirSync(folder, { withFileTypes: true }).flatMap(item => item.isDirectory() ? files(join(folder, item.name)) : [join(folder, item.name)]); }
console.log(`Evidence directory: ${work}`);
try {
  const source = sealed ? active : join(work, 'source');
  if (!sealed) {
    mkdirSync(source);
    run('archive', 'git', ['-C', active, 'archive', head, '-o', join(work, 'source.tar')], work); hashFile(join(work, 'source.tar'));
    run('extract', 'tar', ['-xf', join(work, 'source.tar'), '-C', source], work);
    symlinkSync(join(repository, 'node_modules'), join(source, 'node_modules'), 'dir');
  }
  manifest.toolVersions = { node: process.version, pnpm: execFileSync('pnpm', ['--version'], {encoding:'utf8'}).trim() };
  if (manifest.toolVersions.pnpm !== '10.17.0') throw new Error('Use pinned pnpm 10.17.0');
  const require = createRequire(join(repository, 'package.json'));
  for (const name of ['typescript','esbuild','nx','rollup','tslib']) manifest.toolVersions[name] = require(name + '/package.json').version;
  if (!sealed) run('build-kernel', 'pnpm', ['nx', 'build', 'kernel', '--skip-nx-cache'], source);
  sealed?.verify();
  const dist = join(source, 'dist/packages/kernel');
  for (const file of files(dist)) hashFile(file);
  const packs = join(work, 'packs'); mkdirSync(packs);
  run('pack-kernel', 'npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', packs], dist);
  // Locally pack the sole peer dependency to avoid network or inherited runtime resolution.
  run('pack-tslib', 'npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', packs], dirname(require.resolve('tslib/package.json')));
  const tarballs = files(packs).filter(f => f.endsWith('.tgz')); tarballs.forEach(hashFile);
  const consumer = join(work, 'consumer'); mkdirSync(consumer);
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({name:'st-installed-operation-consumer',version:'0.0.0',private:true,type:'module'}));
  run('install', 'npm', ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', ...tarballs], consumer);
  hashFile(join(consumer, 'package-lock.json'));
  const consumerRequire = createRequire(join(consumer, 'package.json'));
  const installed = dirname(consumerRequire.resolve('@signal-tree/kernel/package.json'));
  if (!realpathSync(installed).startsWith(consumer + '/')) throw new Error('Kernel escaped installed consumer');
  for (const file of files(installed)) {
    const counterpart=join(dist,relative(installed,file));
    if(!existsSync(counterpart) || sha(readFileSync(file))!==sha(readFileSync(counterpart))) throw new Error(`Packed bytes differ: ${file}`);
    hashFile(file);
  }
  for(const entry of ['.','./adapter','./internals']) {
    const key=entry==='.'?'@signal-tree/kernel':'@signal-tree/kernel/'+entry.slice(2);
    manifest.results[key]=consumerRequire.resolve(key);
  }
  for (const name of ['consumer.ts', 'operation-consumer.ts', 'coordinator.d.mts', 'dispatch-fixture.d.mts']) cpSync(join(here, name), join(consumer, name));
  for (const name of ['coordinator.mjs', 'dispatch-fixture.mjs', 'cleanup.mjs']) cpSync(join(experiment, name), join(consumer, name));
  const tsc = require.resolve('typescript/bin/tsc');
  for (const [resolution,module] of [['bundler','ESNext'],['node16','Node16']]) {
    const config = `tsconfig.${resolution}.json`;
    writeFileSync(join(consumer,config), JSON.stringify({ compilerOptions:{target:'ES2022',module,moduleResolution:resolution,strict:true,skipLibCheck:false,noEmit:true,types:[],lib:['ES2022','DOM']},files:['consumer.ts','operation-consumer.ts']},null,2));
    run(`types-${resolution}`,process.execPath,[tsc,'-p',config],consumer,true);
  }
  const operationJs=await transform(readFileSync(join(consumer,'operation-consumer.ts'),'utf8'),{loader:'ts',format:'esm',target:'node24'});
  writeFileSync(join(consumer,'operation-consumer.mjs'),operationJs.code);
  run('typed-operation-runtime',process.execPath,['operation-consumer.mjs'],consumer,true);
  // Freeze all cooperating source inputs before runtime checks; do not rewrite other workers' files.
  for(const name of ['coordinator.mjs','dispatch-fixture.mjs','cleanup.mjs']) cpSync(join(experiment,name),join(consumer,name));
  mkdirSync(join(consumer,'native-probe'));
  for(const name of ['probe','workflow','settlement']) {
    const original=join(experiment,'native-probe',name+'.ts');
    const copy=join(consumer,'native-probe',name+'.ts'); cpSync(original,copy);hashFile(copy);
    const transformed=await transform(readFileSync(copy,'utf8'),{loader:'ts',format:'esm',target:'node24',sourcefile:name+'.ts'});
    writeFileSync(join(consumer,'native-probe',name+'.mjs'),transformed.code);
    run(`runtime-${name}`,process.execPath,[`native-probe/${name}.mjs`],consumer,true);
    // Default sideEffects / annotation handling: no source aliases, no ignoreAnnotations.
    const bundle=await build({entryPoints:[join(consumer,'native-probe',name+'.ts')],outfile:join(consumer,`${name}.bundle.mjs`),bundle:true,platform:'node',format:'esm',target:'node24',metafile:true});
    writeFileSync(join(work,`${name}.metafile.json`),JSON.stringify(bundle.metafile,null,2));
    if(Object.keys(bundle.metafile.inputs).some(p=>p.includes('worktrees/')||p.includes('source/packages/')))throw new Error('Consumer bundle used source instead of installed package');
    run(`bundled-${name}`,process.execPath,[`${name}.bundle.mjs`],consumer,true);
  }
  for(const name of ['coordinator.mjs','dispatch-fixture.mjs','cleanup.mjs','consumer.ts','operation-consumer.ts','coordinator.d.mts','dispatch-fixture.d.mts']) hashFile(join(consumer,name));
  manifest.results.failedChecks=manifest.commands.filter(c=>c.exit!==0).map(c=>c.name);
  sealed?.verify();
  save(); console.log(JSON.stringify({work,failedChecks:manifest.results.failedChecks},null,2));
  process.exitCode=manifest.results.failedChecks.length?1:0;
} catch(error) { manifest.error=String(error);save();console.error(error);process.exitCode=1; }

// Recheck even when a consumer failed; a failure must not conceal input drift.
finally {
  try { sealed?.verify(); } catch (error) { manifest.integrityError=String(error); save(); console.error(error); process.exitCode=1; }
}
