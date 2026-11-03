import {it,expect} from 'vitest';
import * as api from '../index';
import {lifecycleCases,runLifecycle} from '../../tests/entity-registration/lifecycle.mjs';
for(const test of lifecycleCases)it(test.name,async()=>{const result=await runLifecycle(api,test);expect(result.pass,JSON.stringify(result)).toBe(true);});
