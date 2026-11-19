import assert from 'node:assert/strict';
import {test} from 'node:test';
export const it=Object.assign((name,fn)=>test(name,fn),{each:values=>(name,fn)=>{for(const value of values)test(name.replace('%s',String(value)),()=>fn(value));}});
export const expect=value=>({toBe:expected=>assert.ok(Object.is(value,expected),`expected Object.is(${String(value)}, ${String(expected)})`),toEqual:expected=>assert.deepStrictEqual(value,expected),toBeGreaterThan:expected=>assert.ok(value>expected),toThrow:expected=>assert.throws(value,error=>error===expected)});
