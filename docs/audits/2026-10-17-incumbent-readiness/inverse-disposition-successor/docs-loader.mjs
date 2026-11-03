import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire('/Users/jonathanborgia/code/signaltree/package.json');
export async function resolve(specifier, context, nextResolve) {
 if (specifier === 'semver') return { url: pathToFileURL(require.resolve('semver')).href, shortCircuit: true };
 return nextResolve(specifier, context);
}
