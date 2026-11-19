import {it,expect} from 'vitest';
import * as api from '../index';
import {cases,runCase} from '/private/tmp/st-c28-r3-entity-registration-successor/controls/cases.mjs';
for(const test of cases)it(test.name,async()=>{const result=await runCase(api,test);expect(result.pass,JSON.stringify(result)).toBe(true);});
