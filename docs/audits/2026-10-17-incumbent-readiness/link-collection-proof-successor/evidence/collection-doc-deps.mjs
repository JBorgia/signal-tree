import {registerHooks,createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire('/private/tmp/link-collection-proof-successor/package.json');
const semver=pathToFileURL(require.resolve('semver')).href;
registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==='semver')return {url:semver,shortCircuit:true};
 return nextResolve(specifier,context);
}});
