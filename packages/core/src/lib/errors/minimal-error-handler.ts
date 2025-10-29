/**
 * Minimal error handling for SignalTree.
 * Provides basic error logging and simple recovery strategies without
 * the overhead of advanced diagnostics (which is available as an optional enhancer).
 */

export enum ErrorType {
  PROPERTY_DEFINITION_FAILED = 'property_definition_failed',
  SIGNAL_CREATION_FAILED = 'signal_creation_failed',
  UPDATE_FAILED = 'update_failed',
}

export interface TreeError {
  type: ErrorType;
  message: string;
  path?: string;
  context?: Record<string, unknown>;
}

/**
 * Minimal error handler that logs errors and attempts simple recovery.
 * Keeps bundle size small (~0.7KB) while preventing silent failures.
 */
export class MinimalErrorHandler {
  /**
   * Handles an error by logging it and attempting recovery if possible.
   */
  static handle(error: TreeError): {
    recovered: boolean;
    fallbackValue?: unknown;
  } {
    // Log error with context
    if (typeof console !== 'undefined' && console.error) {
      const pathInfo = error.path ? ` at path "${error.path}"` : '';
      console.error(
        `[SignalTree:${error.type}]${pathInfo}`,
        error.message,
        error.context
      );
    }

    // Attempt simple recovery based on error type
    return this.attemptRecovery(error);
  }

  /**
   * Attempts simple recovery strategies based on error type.
   */
  private static attemptRecovery(error: TreeError): {
    recovered: boolean;
    fallbackValue?: unknown;
  } {
    switch (error.type) {
      case ErrorType.PROPERTY_DEFINITION_FAILED: {
        // Try direct assignment as fallback
        const target = error.context?.['target'] as Record<string, unknown>;
        const key = error.context?.['key'] as string;
        const value = error.context?.['value'];

        if (target && key) {
          try {
            target[key] = value;
            return { recovered: true, fallbackValue: value };
          } catch {
            return { recovered: false };
          }
        }
        return { recovered: false };
      }

      case ErrorType.SIGNAL_CREATION_FAILED: {
        // Return a plain value instead of a signal
        return {
          recovered: true,
          fallbackValue: error.context?.['value'],
        };
      }

      case ErrorType.UPDATE_FAILED: {
        // No automatic recovery for update failures
        return { recovered: false };
      }

      default:
        return { recovered: false };
    }
  }
}
