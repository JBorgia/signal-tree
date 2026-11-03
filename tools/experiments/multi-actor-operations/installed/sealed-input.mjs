import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const packages = ['kernel', 'angular', 'react', 'vue', 'solid'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

// No flags means the historical replay. Partial/unknown opt-in never falls back.
export async function sealedInput(args) {
  if (!args.some(arg => arg.startsWith('--'))) return null;
  const options = {};
  const names = ['--candidate', '--manifest', '--manifest-sha256', '--sealed-build'];
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i], value = args[i + 1];
    if (!names.includes(key) || options[key] || !value || value.startsWith('--'))
      throw new Error('Expected exactly --candidate PATH --manifest PATH --manifest-sha256 SHA256 --sealed-build PATH');
    options[key] = value;
  }
  if (names.some(key => !options[key]) || !/^[a-f0-9]{64}$/.test(options['--manifest-sha256']))
    throw new Error('Missing or invalid sealed input manifest/seal arguments');
  const input = {
    candidate: realpathSync(resolve(options['--candidate'])),
    manifestPath: resolve(options['--manifest']),
    manifestSha256: options['--manifest-sha256'],
    buildReceiptPath: resolve(options['--sealed-build']),
  };
  const manifestBytes = readFileSync(input.manifestPath);
  if (sha(manifestBytes) !== input.manifestSha256) throw new Error('Source manifest digest differs');
  const hashes = JSON.parse(manifestBytes);
  if (!hashes || Array.isArray(hashes) || typeof hashes !== 'object' || !Object.keys(hashes).length)
    throw new Error('Invalid source manifest map');
  const checkSource = () => {
    if (sha(readFileSync(input.manifestPath)) !== input.manifestSha256) throw new Error('Source manifest changed');
    for (const [name, hash] of Object.entries(hashes)) {
      if (isAbsolute(name) || name.split(/[\\/]/).some(part => !part || part === '.' || part === '..') || !/^[a-f0-9]{64}$/.test(hash))
        throw new Error(`Invalid source manifest entry: ${name}`);
      const file = join(input.candidate, name);
      if (!lstatSync(file).isFile() || realpathSync(file) !== file || !file.startsWith(input.candidate + sep) || sha(readFileSync(file)) !== hash)
        throw new Error(`Source differs: ${name}`);
    }
  };
  const integrityModule = 'scripts/publish-artifact-integrity.mjs';
  for (const required of [integrityModule, 'package.json', 'pnpm-lock.yaml', ...packages.map(name => `packages/${name}/package.json`)])
    if (!Object.hasOwn(hashes, required)) throw new Error(`Source manifest missing ${required}`);
  checkSource(); // Validate candidate code before importing its integrity implementation.
  const receiptBytes = readFileSync(input.buildReceiptPath);
  const receipt = JSON.parse(receiptBytes);
  if (!receipt || typeof receipt.root !== 'string' || realpathSync(receipt.root) !== input.candidate ||
      JSON.stringify(receipt.packages) !== JSON.stringify(packages) || !/^sha256-[a-f0-9]{64}$/.test(receipt.seal))
    throw new Error('Invalid sealed build receipt/root/package set');
  input.buildReceiptSha256 = sha(receiptBytes);
  input.artifactIntegrity = receipt.seal;
  const { buildIntegrity } = await import(pathToFileURL(join(input.candidate, integrityModule)).href);
  function verify() {
    checkSource();
    if (sha(readFileSync(input.buildReceiptPath)) !== input.buildReceiptSha256) throw new Error('Build receipt changed');
    if (buildIntegrity(input.candidate, packages) !== input.artifactIntegrity) throw new Error('Sealed artifacts differ');
  }
  verify();
  return { input, verify };
}
