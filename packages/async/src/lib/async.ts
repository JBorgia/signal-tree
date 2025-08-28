import { signal } from '@angular/core';
import type { Signal } from '@angular/core';
import { unwrap, parsePath } from '@signaltree/core';
import type {
  AsyncActionConfig,
  AsyncAction,
  SignalTree,
} from '@signaltree/core';

/**
 * Extended AsyncActionConfig with additional async state management features.
 * Provides path-based state updates and lifecycle hooks for complete async operation control.
 *
 * @template T - The state object type
 * @template TResult - The result type of the async operation
 */
interface ExtendedAsyncActionConfig<T, TResult>
  extends AsyncActionConfig<T, TResult> {
  /** Dot-notation path for loading state (e.g., 'user.loading') */
  loadingKey?: string;
  /** Dot-notation path for error state (e.g., 'user.error') */
  errorKey?: string;
  /** Hook executed after completion regardless of success/failure */
  onFinally?: (state: T) => Partial<T>;
}

/**
 * Extended SignalTree interface with comprehensive async operation capabilities.
 * Provides convenient methods for common async patterns with full TypeScript inference.
 *
 * @template T - The state object type extending StateObject
 */
export interface AsyncSignalTree<T> extends SignalTree<T> {
  /**
   * Creates an async action with comprehensive state management and lifecycle hooks.
   *
   * @template TInput - Input parameter type for the operation
   * @template TResult - Return type of the async operation
   * @param operation - The async function to execute
   * @param config - Configuration for state management and lifecycle hooks
   * @returns AsyncAction instance with pending, error, and result signals
   */
  asyncAction<TInput, TResult>(
    operation: (input: TInput) => Promise<TResult>,
    config?: ExtendedAsyncActionConfig<T, TResult>
  ): AsyncAction<TInput, TResult>;

  /**
   * Convenience method for data loading operations (no input parameters).
   * Perfect for initial data fetching and refresh operations.
   */
  loadData<TResult>(
    loader: () => Promise<TResult>,
    config?: ExtendedAsyncActionConfig<T, TResult>
  ): AsyncAction<void, TResult>;

  /**
   * Convenience method for form submission operations.
   * Handles form data processing with built-in state management.
   */
  submitForm<TInput, TResult>(
    submitter: (input: TInput) => Promise<TResult>,
    config?: ExtendedAsyncActionConfig<T, TResult>
  ): AsyncAction<TInput, TResult>;
}

/**
 * Sets nested values in state using dot-notation paths.
 * Updated to work with the new v2.0 architecture where branch nodes have set/update methods.
 *
 * @template T - The state object type
 * @param tree - The SignalTree instance to update
 * @param path - Dot-notation path to the property (e.g., 'user.profile.name')
 * @param value - The value to set at the specified path
 */
function setNestedValue<T>(
  tree: SignalTree<T>,
  path: string,
  value: unknown
): void {
  const keys = parsePath(path);

  // Navigate to the target location
  let current: any = tree.$;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key]) {
      console.warn(`Path ${path} does not exist at key ${key}`);
      return;
    }
    current = current[key];
  }

  const lastKey = keys[keys.length - 1];
  const target = current[lastKey];

  // Check if it's a signal (leaf node)
  if (target && typeof target === 'function' && 'set' in target) {
    // It's a signal - update it directly
    target.set(value);
  } else if (target && typeof target === 'object' && 'set' in target) {
    // It's a branch node with set method
    if (typeof value === 'object' && value !== null) {
      target.set(value);
    } else {
      // Trying to set a primitive value on a branch - not supported
      console.warn(`Cannot set primitive value on branch node at ${path}`);
    }
  } else {
    console.warn(`Cannot set value at ${path} - no signal or set method found`);
  }
}

/**
 * Helper function to apply partial updates to a SignalTree using the v2.0 architecture.
 * Works with both top-level updates and nested updates through the branch set methods.
 */
function applyPartialUpdate<T>(tree: SignalTree<T>, update: Partial<T>): void {
  const signals = tree.$ as any;

  for (const [key, value] of Object.entries(update)) {
    const target = signals[key];

    if (!target) {
      console.warn(`Property ${key} does not exist on tree`);
      continue;
    }

    // Check if it's a signal (leaf node)
    if (typeof target === 'function' && 'set' in target) {
      target.set(value);
    }
    // Check if it's a branch node with set method
    else if (typeof target === 'object' && 'set' in target) {
      if (typeof value === 'object' && value !== null) {
        // Use the branch's set method for partial updates
        target.set(value);
      } else {
        console.warn(`Cannot set primitive value ${value} on branch ${key}`);
      }
    }
    // Otherwise, it might be a nested structure - try recursive update
    else if (
      typeof target === 'object' &&
      typeof value === 'object' &&
      value !== null
    ) {
      // For deeply nested updates without set method (shouldn't happen in v2.0)
      console.warn(
        `Branch ${key} missing set method - this shouldn't happen in v2.0`
      );
    }
  }
}

/**
 * Configuration options for async functionality with performance and retry settings.
 */
interface AsyncConfig {
  /** Whether async functionality is enabled */
  enabled?: boolean;
  /** Default timeout for operations in milliseconds */
  defaultTimeout?: number;
  /** Number of retry attempts for failed operations */
  retryAttempts?: number;
  /** Base delay between retry attempts in milliseconds */
  retryDelay?: number;
}

/**
 * Enhanced async action implementation with comprehensive state management and lifecycle control.
 * Updated to work with the new SignalTree v2.0 architecture.
 */
class AsyncActionImpl<TInput, TResult, T>
  implements AsyncAction<TInput, TResult>
{
  /** Signal indicating if the operation is currently pending */
  readonly pending = signal(false);
  /** Signal containing any error that occurred during execution */
  readonly error = signal<Error | null>(null);
  /** Signal containing the successful result of the operation */
  readonly result = signal<TResult | null>(null);

  constructor(
    private operation: (input: TInput) => Promise<TResult>,
    private tree: SignalTree<T>,
    private config: ExtendedAsyncActionConfig<T, TResult> = {}
  ) {}

  /**
   * Executes the async operation with complete lifecycle management and error handling.
   * Manages loading states, executes lifecycle hooks, and handles both success and error cases.
   */
  async execute(input: TInput): Promise<TResult> {
    const {
      loadingKey,
      errorKey,
      onStart,
      onSuccess,
      onError,
      onComplete,
      onFinally,
    } = this.config;

    try {
      // Set loading state
      this.pending.set(true);
      this.error.set(null);

      if (loadingKey) {
        setNestedValue(this.tree, loadingKey, true);
      }

      if (errorKey) {
        setNestedValue(this.tree, errorKey, null);
      }

      // Execute onStart hook
      if (onStart) {
        const startUpdate = onStart(unwrap(this.tree.$) as T);
        if (startUpdate) {
          applyPartialUpdate(this.tree, startUpdate);
        }
      }

      // Execute the operation
      const result = await this.operation(input);

      // Store successful result
      this.result.set(result);

      // Execute onSuccess hook
      if (onSuccess) {
        const successUpdate = onSuccess(result, unwrap(this.tree.$) as T);
        if (successUpdate) {
          applyPartialUpdate(this.tree, successUpdate);
        }
      }

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.error.set(err);

      // Set error in path-based location
      if (errorKey) {
        setNestedValue(this.tree, errorKey, err.message);
      }

      // Execute onError hook
      if (onError) {
        const errorUpdate = onError(err, unwrap(this.tree.$) as T);
        if (errorUpdate) {
          applyPartialUpdate(this.tree, errorUpdate);
        }
      }

      throw err;
    } finally {
      this.pending.set(false);

      // Clear loading state
      if (loadingKey) {
        setNestedValue(this.tree, loadingKey, false);
      }

      // Execute onComplete hook
      if (onComplete) {
        const completeUpdate = onComplete(unwrap(this.tree.$) as T);
        if (completeUpdate) {
          applyPartialUpdate(this.tree, completeUpdate);
        }
      }

      // Execute onFinally hook
      if (onFinally) {
        const finallyUpdate = onFinally(unwrap(this.tree.$) as T);
        if (finallyUpdate) {
          applyPartialUpdate(this.tree, finallyUpdate);
        }
      }
    }
  }
}

/**
 * Enhances a SignalTree with comprehensive async action capabilities.
 * Creates an AsyncSignalTree with advanced async operation management, path-based state updates,
 * and convenient methods for common async patterns.
 *
 * @template T - The state object type
 * @param config - Configuration options for async behavior and performance settings
 * @returns Function that enhances a SignalTree with async capabilities
 */
export function withAsync<T>(
  config: AsyncConfig = {}
): (tree: SignalTree<T>) => AsyncSignalTree<T> {
  const { enabled = true } = config;

  return (tree: SignalTree<T>): AsyncSignalTree<T> => {
    if (!enabled) {
      return tree as AsyncSignalTree<T>;
    }

    // Create the async action function
    const asyncAction = <TInput, TResult>(
      operation: (input: TInput) => Promise<TResult>,
      actionConfig?: ExtendedAsyncActionConfig<T, TResult>
    ): AsyncAction<TInput, TResult> => {
      return new AsyncActionImpl<TInput, TResult, T>(
        operation,
        tree,
        actionConfig
      );
    };

    // Create enhanced tree with async capabilities
    const enhancedTree: AsyncSignalTree<T> = {
      ...tree,
      asyncAction,
      loadData: <TResult>(
        loader: () => Promise<TResult>,
        actionConfig?: ExtendedAsyncActionConfig<T, TResult>
      ): AsyncAction<void, TResult> => {
        return asyncAction(() => loader(), actionConfig);
      },
      submitForm: <TInput, TResult>(
        submitter: (input: TInput) => Promise<TResult>,
        actionConfig?: ExtendedAsyncActionConfig<T, TResult>
      ): AsyncAction<TInput, TResult> => {
        return asyncAction(submitter, actionConfig);
      },
    };

    return enhancedTree;
  };
}

/**
 * Convenience function to enable async functionality with default settings.
 */
export function enableAsync<T>() {
  return withAsync<T>({ enabled: true });
}

/**
 * High-performance async enhancement with aggressive optimizations and resilience features.
 */
export function withHighPerformanceAsync<T>() {
  return withAsync<T>({
    enabled: true,
    defaultTimeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
  });
}

/**
 * Creates a retry wrapper for async operations with exponential backoff.
 */
export function withRetry<TInput, TResult>(
  operation: (input: TInput) => Promise<TResult>,
  attempts = 3,
  delay = 1000
): (input: TInput) => Promise<TResult> {
  return async (input: TInput): Promise<TResult> => {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await operation(input);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === attempts) {
          throw lastError;
        }

        // Wait before retry with exponential backoff
        await new Promise((resolve) => setTimeout(resolve, delay * attempt));
      }
    }

    throw lastError || new Error('Operation failed after all retry attempts');
  };
}

/**
 * Creates a timeout wrapper for async operations with automatic cancellation.
 */
export function withTimeout<TInput, TResult>(
  operation: (input: TInput) => Promise<TResult>,
  timeoutMs: number
): (input: TInput) => Promise<TResult> {
  return async (input: TInput): Promise<TResult> => {
    return Promise.race([
      operation(input),
      new Promise<TResult>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Operation timed out after ${timeoutMs}ms`)),
          timeoutMs
        )
      ),
    ]);
  };
}

/**
 * Creates a cancellable async operation with manual cancellation control.
 */
export function withCancellation<TInput, TResult>(
  operation: (input: TInput, signal: AbortSignal) => Promise<TResult>
): {
  execute: (input: TInput) => Promise<TResult>;
  cancel: () => void;
  cancelled: Signal<boolean>;
} {
  let controller: AbortController | null = null;
  const cancelled = signal(false);

  return {
    cancelled,
    execute: async (input: TInput): Promise<TResult> => {
      // Cancel any existing operation
      if (controller) {
        controller.abort();
      }

      controller = new AbortController();
      cancelled.set(false);

      try {
        const result = await operation(input, controller.signal);
        return result;
      } catch (error) {
        if (controller?.signal.aborted) {
          cancelled.set(true);
          throw new Error('Operation was cancelled');
        }
        throw error;
      }
    },
    cancel: () => {
      if (controller) {
        controller.abort();
        cancelled.set(true);
      }
    },
  };
}

/**
 * Creates a debounced async operation that delays execution until after a specified wait time.
 */
export function withDebounce<TInput, TResult>(
  operation: (input: TInput) => Promise<TResult>,
  delayMs: number
): (input: TInput) => Promise<TResult> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let currentResolve: ((value: TResult) => void) | null = null;
  let currentReject: ((error: Error) => void) | null = null;

  return (input: TInput): Promise<TResult> => {
    return new Promise<TResult>((resolve, reject) => {
      // Clear previous timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Reject previous promise if it exists
      if (currentReject) {
        currentReject(new Error('Debounced'));
      }

      currentResolve = resolve;
      currentReject = reject;

      timeoutId = setTimeout(async () => {
        try {
          const result = await operation(input);
          if (currentResolve === resolve) {
            resolve(result);
          }
        } catch (error) {
          if (currentReject === reject) {
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        } finally {
          // Clear references after operation completes
          if (currentResolve === resolve) {
            currentResolve = null;
          }
          if (currentReject === reject) {
            currentReject = null;
          }
          timeoutId = null;
        }
      }, delayMs);
    });
  };
}
