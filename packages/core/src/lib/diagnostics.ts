/**
 * SignalTreeDiagnostics - Error tracking and recovery
 */

export enum ErrorSeverity {
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export enum ErrorType {
  SIGNAL_CREATION_FAILED = 'signal_creation_failed',
  PROPERTY_DEFINITION_FAILED = 'property_definition_failed',
  UPDATE_FAILED = 'update_failed',
  MEMORY_PRESSURE = 'memory_pressure',
  VALIDATION_FAILED = 'validation_failed',
  SERIALIZATION_FAILED = 'serialization_failed',
}

export interface TreeError {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  path?: string;
  context?: any;
  timestamp: number;
  stack?: string;
}

export interface DiagnosticsConfig {
  enableTelemetry?: boolean;
  consoleOutput?: boolean;
  maxErrors?: number;
  errorRetention?: number;
}

export class SignalTreeDiagnostics {
  private errors = new Map<string, TreeError[]>();
  private errorHandlers = new Map<ErrorType, ((error: TreeError) => void)[]>();
  private config: Required<DiagnosticsConfig>;

  constructor(config: DiagnosticsConfig = {}) {
    this.config = {
      enableTelemetry: config.enableTelemetry ?? false,
      consoleOutput: config.consoleOutput ?? true,
      maxErrors: config.maxErrors ?? 100,
      errorRetention: config.errorRetention ?? 60000,
    };
  }

  recordError(error: TreeError): void {
    const key = `${error.type}:${error.path || 'global'}`;

    if (!this.errors.has(key)) {
      this.errors.set(key, []);
    }

    const errorList = this.errors.get(key)!;
    errorList.push(error);

    // Limit errors
    if (errorList.length > this.config.maxErrors) {
      errorList.shift();
    }

    // Notify handlers
    this.notifyHandlers(error);

    // Log if configured
    if (this.config.consoleOutput) {
      this.logError(error);
    }

    // Schedule cleanup
    setTimeout(() => {
      const index = errorList.indexOf(error);
      if (index > -1) {
        errorList.splice(index, 1);
      }
    }, this.config.errorRetention);
  }

  private logError(error: TreeError): void {
    const prefix = `[SignalTree:${error.type}]`;

    switch (error.severity) {
      case ErrorSeverity.WARNING:
        if (process.env['NODE_ENV'] === 'development') {
          console.warn(prefix, error.message, error);
        }
        break;
      case ErrorSeverity.ERROR:
        console.error(prefix, error.message, error);
        break;
      case ErrorSeverity.CRITICAL:
        console.error(`🔴 CRITICAL ${prefix}`, error.message, error);
        break;
    }
  }

  private notifyHandlers(error: TreeError): void {
    const handlers = this.errorHandlers.get(error.type) || [];
    handlers.forEach((handler) => handler(error));
  }

  onError(type: ErrorType, handler: (error: TreeError) => void): () => void {
    if (!this.errorHandlers.has(type)) {
      this.errorHandlers.set(type, []);
    }

    this.errorHandlers.get(type)!.push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.errorHandlers.get(type);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  getErrors(): TreeError[] {
    const allErrors: TreeError[] = [];
    for (const errors of this.errors.values()) {
      allErrors.push(...errors);
    }
    return allErrors;
  }

  clearErrors(): void {
    this.errors.clear();
  }
}
