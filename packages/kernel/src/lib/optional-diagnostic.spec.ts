import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { writeDiagnostic } from '../../test/optional-diagnostic';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    mkdirSync: vi.fn(actual.mkdirSync),
    appendFileSync: vi.fn(actual.appendFileSync),
    writeFileSync: vi.fn(actual.writeFileSync),
  };
});

let directory: string | undefined;
beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => {
  if (directory) fs.rmSync(directory, { recursive: true, force: true });
  directory = undefined;
});

it('an unset or empty sink performs no filesystem operations', () => {
  writeDiagnostic(undefined, 'already serialized\n');
  writeDiagnostic(undefined, 'already serialized\n', true);
  writeDiagnostic('', 'already serialized\n', true);
  expect(fs.mkdirSync).not.toHaveBeenCalled();
  expect(fs.appendFileSync).not.toHaveBeenCalled();
  expect(fs.writeFileSync).not.toHaveBeenCalled();
});

it('creates nested parents and preserves exact append and replace bytes', () => {
  directory = fs.mkdtempSync(join(tmpdir(), 'st-optional-diagnostic-'));
  const file = join(directory, 'nested', 'deeper', 'trace.jsonl');
  writeDiagnostic(file, '{"n":1}\n', true);
  writeDiagnostic(file, '{"n":2}\n', true);
  expect(fs.readFileSync(file, 'utf8')).toBe('{"n":1}\n{"n":2}\n');
  writeDiagnostic(file, 'replacement without newline');
  expect(fs.readFileSync(file, 'utf8')).toBe('replacement without newline');
});

it('propagates filesystem failures for an explicit sink', () => {
  directory = fs.mkdtempSync(join(tmpdir(), 'st-optional-diagnostic-'));
  const blocker = join(directory, 'file-not-directory');
  fs.writeFileSync(blocker, 'occupied');
  expect(() => writeDiagnostic(join(blocker, 'trace.json'), '{}')).toThrow();
  expect(() => writeDiagnostic(directory, '{}', true)).toThrow();
  expect(() => writeDiagnostic(directory, '{}')).toThrow();
});
