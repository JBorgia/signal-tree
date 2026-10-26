import { registerHooks, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire('/private/tmp/link-a1-installed-operations/package.json');
const semverUrl = pathToFileURL(require.resolve('semver')).href;
registerHooks({ resolve(specifier, context, nextResolve) {
  return specifier === 'semver' ? { url: semverUrl, shortCircuit: true } : nextResolve(specifier, context);
} });
