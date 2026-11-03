import {it,expect} from 'vitest';
import * as api from '../index';
import {cases,runCase} from '../../tests/entity-registration/cases.mjs';
for(const test of cases)it(test.name,async()=>{const result=await runCase(api,test);expect(result.pass,JSON.stringify(result)).toBe(true);});
