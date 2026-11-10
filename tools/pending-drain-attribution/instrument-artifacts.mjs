import { readFile, writeFile, readdir, mkdir, cp, realpath, stat } from 'node:fs/promises';
import { resolve, relative, join, dirname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const F = ts.factory;
const sha = source => createHash('sha256').update(source).digest('hex');
const assert = (value, message) => { if (!value) throw new Error(message); };
const nameOf = node => node?.name && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) ? node.name.text : undefined;
const call = (method, args) => F.createCallExpression(F.createPropertyAccessExpression(F.createIdentifier('__pda'), method), undefined, args);
const text = value => F.createStringLiteral(value);
const number = value => F.createNumericLiteral(value);
const prop = (base, key) => F.createPropertyAccessExpression(base, key);
const ident = value => F.createIdentifier(value);
function hit(label, values = []) { return F.createExpressionStatement(call('hit', [text(label), ...values])); }
const nativeMethods = ['prepare', 'complete', 'prepareRetirement', 'retire'];
const candidateNativeMethods = ['preparePoint', 'expose'];
const lifecycleNames = ['prepareNativeRequirement', 'finalizeNativeRequirement', 'deliverNativeRequirementReady', 'ownerTransition', 'ownerWake', 'wake', 'queueOwnerObserver', 'notifyOwnerTransition', 'onOwnerCellTransition', 'notifyRequirement', 'finish', 'refresh', 'abandonOwnerSource'];

export function instrumentText(source, file, { candidate, probeUrl, omitSourceComplete = false } = {}) {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  assert(sf.parseDiagnostics.length === 0, `Cannot parse ${file}`);
  const clean = file.split(sep).join('/'), sourceModule = clean.endsWith('/lib/internals/entity-publication.js'), nativeModule = clean.endsWith('/lib/experimental-publication/entity.js'), lifecycleModule = clean.endsWith('/lib/experimental-publication/lifecycle.js');
  const anchors = new Map(), counts = {}, schedulerSites = [], metadata = new Map();
  const anchor = (node, label) => { assert(node.body && ts.isBlock(node.body), `Missing block at ${label}`); anchors.set(node, label); counts[label] = (counts[label] ?? 0) + 1; };
  function scan(node) {
    if (sourceModule && ts.isClassDeclaration(node) && node.name?.text === 'EntityPublicationSource') {
      for (const method of ['prepare', 'complete', 'requestRetirement', 'retire']) {
        const members = node.members.filter(member => ts.isMethodDeclaration(member) && nameOf(member) === method);
        assert(members.length === 1, `Expected one Source.${method} anchor in ${file}`);
        if (!(omitSourceComplete && method === 'complete')) anchor(members[0], `Source.${method}`);
        if (method === 'prepare') {
          const parameter = members[0].parameters[0]?.name;
          assert(parameter && ts.isIdentifier(parameter), 'Source.prepare must have one named packet parameter');
          const admission = members[0].body.statements.filter(statement => ts.isExpressionStatement(statement) && ts.isBinaryExpression(statement.expression) &&
            statement.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken && statement.expression.left.getText(sf) === parameter.text &&
            ts.isCallExpression(statement.expression.right) && statement.expression.right.expression.getText(sf) === 'this.admission.prepare');
          assert(admission.length === 1, 'Missing/duplicate exact Source.prepare admission assignment');
          metadata.set(admission[0], parameter.text);
        }
      }
    }
    if (nativeModule && ts.isObjectLiteralExpression(node)) {
      const names = new Set(node.properties.map(nameOf));
      if (nativeMethods.every(name => names.has(name))) {
        for (const name of [...nativeMethods, ...(candidate ? candidateNativeMethods : [])]) {
          const methods = node.properties.filter(member => ts.isMethodDeclaration(member) && nameOf(member) === name);
          assert(methods.length === 1, `Expected one Native.${name} anchor`); anchor(methods[0], `Native.${name}`);
        }
        if (!candidate) assert(!names.has('preparePoint') && !names.has('expose'), 'Frozen module unexpectedly has candidate native methods');
      }
    }
    if (lifecycleModule && ts.isFunctionDeclaration(node) && lifecycleNames.includes(node.name?.text)) anchor(node, `Lifecycle.${node.name.text}`);
    ts.forEachChild(node, scan);
  }
  scan(sf);
  if (sourceModule) for (const label of ['Source.prepare', 'Source.requestRetirement', 'Source.retire', ...(omitSourceComplete ? [] : ['Source.complete'])]) assert(counts[label] === 1, `Mandatory ${label} missing/duplicated in ${file}`);
  if (nativeModule) for (const name of [...nativeMethods, ...(candidate ? candidateNativeMethods : [])]) assert(counts[`Native.${name}`] === 1, `Mandatory Native.${name} missing/duplicated in ${file}`);
  if (lifecycleModule) for (const name of lifecycleNames) assert(counts[`Lifecycle.${name}`] === 1, `Mandatory Lifecycle.${name} missing/duplicated in ${file}`);
  let changed = anchors.size > 0;
  const transformer = context => {
    const visitor = original => {
      let node = ts.visitEachChild(original, visitor, context);
      if (anchors.has(original)) {
        const body = F.updateBlock(node.body, [hit(anchors.get(original)), ...node.body.statements]);
        if (ts.isMethodDeclaration(node)) node = F.updateMethodDeclaration(node, node.modifiers, node.asteriskToken, node.name, node.questionToken, node.typeParameters, node.parameters, node.type, body);
        else if (ts.isFunctionDeclaration(node)) node = F.updateFunctionDeclaration(node, node.modifiers, node.asteriskToken, node.name, node.typeParameters, node.parameters, node.type, body);
      }
      if (metadata.has(original)) {
        const packet = ident(metadata.get(original));
        // Source-owned admitted metadata; report only scalar counts/flags.
        const values = [prop(prop(F.createThis(), 'recipients'), 'size'),
          F.createConditionalExpression(prop(packet, 'prepareResponsibility'), undefined, number(1), undefined, number(0)),
          prop(prop(packet, 'ordinary'), 'length'), prop(prop(packet, 'physical'), 'length')];
        return [node, hit('Source.prepare.metadata', values)];
      }
      if (ts.isCallExpression(original) && !original.questionDotToken) {
        const expr = original.expression;
        let kind, receiver;
        if (ts.isIdentifier(expr)) { kind = expr.text; receiver = F.createVoidZero(); }
        else if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression) && expr.expression.text === 'globalThis') { kind = expr.name.text; receiver = ident('globalThis'); }
        const scheduled = ['queueMicrotask', 'setTimeout', 'setImmediate'].includes(kind), cancelled = ['clearTimeout', 'clearImmediate'].includes(kind);
        if (scheduled || cancelled) {
          const position = sf.getLineAndCharacterOfPosition(original.getStart(sf)), label = `${clean}:${position.line + 1}:${position.character + 1}`;
          schedulerSites.push({ kind, label, operation: scheduled ? 'schedule' : 'cancel' }); changed = true;
          return call(scheduled ? 'schedule' : 'cancel', [text(label), text(kind), receiver, node.expression, ...node.arguments]);
        }
      }
      return node;
    };
    return root => ts.visitNode(root, visitor);
  };
  const result = ts.transform(sf, [transformer]);
  try {
    const output = changed ? `import * as __pda from ${JSON.stringify(probeUrl)};\n${ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }).printFile(result.transformed[0])}` : source;
    return { output, changed, anchors: counts, schedulerSites };
  } finally { result.dispose(); }
}
async function listJs(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    assert(!entry.isSymbolicLink(), `Artifact symlink refused: ${path}`);
    if (entry.isDirectory()) found.push(...await listJs(path)); else if (entry.isFile() && entry.name.endsWith('.js')) found.push(path);
  }
  return found.sort();
}
export async function instrumentArtifact(inputDirectory, outputDirectory, { candidate, probePath, expectedJs = 193, omitSourceComplete = false } = {}) {
  const input = await realpath(inputDirectory), output = resolve(outputDirectory), probe = await realpath(probePath);
  assert(output !== input && !output.startsWith(input + sep) && !input.startsWith(output + sep), 'Output must be a distinct external copied artifact directory');
  try { await stat(output); throw new Error(`Output already exists: ${output}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const files = await listJs(input); assert(files.length === expectedJs, `Expected ${expectedJs} JS files, got ${files.length}`);
  for (const suffix of ['/lib/internals/entity-publication.js', '/lib/experimental-publication/entity.js', '/lib/experimental-publication/lifecycle.js']) assert(files.filter(path => path.split(sep).join('/').endsWith(suffix)).length === 1, `Missing/duplicate module ${suffix}`);
  const prepared = [], totals = {}, schedulerSites = [];
  for (const file of files) {
    const original = await readFile(file, 'utf8'), path = relative(input, file);
    const instrumented = instrumentText(original, '/' + path.split(sep).join('/'), { candidate, probeUrl: pathToFileURL(probe).href, omitSourceComplete });
    for (const [label, count] of Object.entries(instrumented.anchors)) totals[label] = (totals[label] ?? 0) + count;
    schedulerSites.push(...instrumented.schedulerSites);
    prepared.push({ path, original, ...instrumented });
  }
  assert(schedulerSites.some(site => site.kind === 'queueMicrotask' && site.label.includes('/lib/experimental-publication/lifecycle.js:')), 'Mandatory lifecycle queueMicrotask sites missing');
  assert(schedulerSites.some(site => site.kind === 'queueMicrotask' && site.label.includes('/lib/internals/entity-publication.js:')), 'Mandatory source retirement microtask site missing');
  await mkdir(dirname(output), { recursive: true }); await cp(input, output, { recursive: true, errorOnExist: true, force: false });
  const manifest = { schema: 'v16-pending-drain-instrumented-1', candidate: !!candidate, diagnosticOnly: true, originalSourceMapsApplyToInstrumentedCode: false,
    input, output, expectedJs, probe: { path: probe, sha256: sha(await readFile(probe)) }, mutant: omitSourceComplete ? 'omit-Source.complete' : null, anchors: totals, schedulerSites, files: [] };
  for (const file of prepared) {
    if (file.changed) await writeFile(join(output, file.path), file.output);
    manifest.files.push({ path: file.path, changed: file.changed, originalSha256: sha(file.original), instrumentedSha256: sha(file.output) });
  }
  await writeFile(join(output, 'PDA-INSTRUMENTATION.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}
async function main() {
  const args = process.argv.slice(2), option = name => { const at = args.indexOf(name); return at < 0 ? undefined : args[at + 1]; };
  const before = option('--before'), candidate = option('--candidate'), output = option('--output');
  assert(before && candidate && output, 'Usage: --before DIR --candidate DIR --output NEW_DIR [--probe FILE] [--expected-js 193] [--omit-source-complete]');
  const probePath = option('--probe') ?? resolve(dirname(new URL(import.meta.url).pathname), 'trace-probe.mjs');
  const options = { probePath, expectedJs: Number(option('--expected-js') ?? 193), omitSourceComplete: args.includes('--omit-source-complete') };
  const beforeManifest = await instrumentArtifact(before, join(output, 'before'), { ...options, candidate: false });
  const candidateManifest = await instrumentArtifact(candidate, join(output, 'candidate'), { ...options, candidate: true });
  process.stdout.write(JSON.stringify({ before: beforeManifest.output, candidate: candidateManifest.output, files: [beforeManifest.files.length, candidateManifest.files.length] }) + '\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
