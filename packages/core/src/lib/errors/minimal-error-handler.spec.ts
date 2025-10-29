import { ErrorType, MinimalErrorHandler } from './minimal-error-handler';

describe('MinimalErrorHandler', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should log errors with context', () => {
    MinimalErrorHandler.handle({
      type: ErrorType.PROPERTY_DEFINITION_FAILED,
      message: 'Failed to define property',
      path: 'user.name',
      context: { key: 'name' },
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[SignalTree:property_definition_failed]'),
      expect.any(String),
      expect.any(Object)
    );
  });

  it('should attempt recovery for property definition failures', () => {
    const target = {};
    const result = MinimalErrorHandler.handle({
      type: ErrorType.PROPERTY_DEFINITION_FAILED,
      message: 'Test failure',
      context: {
        target,
        key: 'testProp',
        value: 'testValue',
      },
    });

    expect(result.recovered).toBe(true);
    expect((target as Record<string, unknown>)['testProp']).toBe('testValue');
  });

  it('should handle signal creation failures', () => {
    const result = MinimalErrorHandler.handle({
      type: ErrorType.SIGNAL_CREATION_FAILED,
      message: 'Signal creation failed',
      context: { value: 42 },
    });

    expect(result.recovered).toBe(true);
    expect(result.fallbackValue).toBe(42);
  });

  it('should not recover from update failures', () => {
    const result = MinimalErrorHandler.handle({
      type: ErrorType.UPDATE_FAILED,
      message: 'Update failed',
    });

    expect(result.recovered).toBe(false);
  });

  it('should handle errors without context gracefully', () => {
    const result = MinimalErrorHandler.handle({
      type: ErrorType.PROPERTY_DEFINITION_FAILED,
      message: 'Test error',
    });

    expect(result.recovered).toBe(false);
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('should include path information in error logs', () => {
    MinimalErrorHandler.handle({
      type: ErrorType.PROPERTY_DEFINITION_FAILED,
      message: 'Test error',
      path: 'deeply.nested.path',
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('at path "deeply.nested.path"'),
      expect.any(String),
      undefined
    );
  });

  it('should handle failed recovery attempts', () => {
    const frozenTarget = Object.freeze({});
    const result = MinimalErrorHandler.handle({
      type: ErrorType.PROPERTY_DEFINITION_FAILED,
      message: 'Test error',
      context: {
        target: frozenTarget,
        key: 'cantAdd',
        value: 'value',
      },
    });

    expect(result.recovered).toBe(false);
  });
});
