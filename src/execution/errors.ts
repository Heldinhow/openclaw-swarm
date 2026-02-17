/**
 * Execution Layer - Error Classes
 * 
 * Custom error types for the execution layer.
 */

import { ExecutionError } from './types.js';

/** Base error for execution layer */
export class ExecutionLayerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any,
    public readonly recoverable: boolean = false
  ) {
    super(message);
    this.name = 'ExecutionLayerError';
  }

  toExecutionError(): ExecutionError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      recoverable: this.recoverable,
    };
  }
}

/** Error when executor is not found */
export class ExecutorNotFoundError extends ExecutionLayerError {
  constructor(executorType: string) {
    super(
      `Executor not found: ${executorType}`,
      'EXECUTOR_NOT_FOUND',
      { executorType },
      false
    );
    this.name = 'ExecutorNotFoundError';
  }
}

/** Error when task execution fails */
export class ExecutionFailedError extends ExecutionLayerError {
  constructor(
    message: string,
    public readonly taskId: string,
    public readonly exitCode?: number,
    details?: any
  ) {
    // Non-zero exit codes may be recoverable depending on the error
    const recoverable = exitCode !== undefined && exitCode > 0;
    super(message, 'EXECUTION_FAILED', { taskId, exitCode, ...details }, recoverable);
    this.name = 'ExecutionFailedError';
  }
}

/** Error when execution times out */
export class ExecutionTimeoutError extends ExecutionLayerError {
  constructor(
    public readonly taskId: string,
    public readonly timeoutMs: number
  ) {
    super(
      `Execution timed out after ${timeoutMs}ms`,
      'EXECUTION_TIMEOUT',
      { taskId, timeoutMs },
      true
    );
    this.name = 'ExecutionTimeoutError';
  }
}

/** Error when validation fails */
export class ValidationError extends ExecutionLayerError {
  constructor(
    message: string,
    public readonly errors: Array<{ code: string; message: string; line?: number; column?: number }>
  ) {
    super(message, 'VALIDATION_FAILED', { errors }, false);
    this.name = 'ValidationErrorClass';
  }
}

/** Error when tests fail */
export class TestFailedError extends ExecutionLayerError {
  constructor(
    public readonly taskId: string,
    public readonly totalTests: number,
    public readonly failedTests: number,
    public readonly errors: string[]
  ) {
    super(
      `${failedTests}/${totalTests} tests failed`,
      'TEST_FAILED',
      { taskId, totalTests, failedTests, errors },
      true
    );
    this.name = 'TestFailedError';
  }
}

/** Error when OpenCode CLI is not found */
export class OpenCodeNotFoundError extends ExecutionLayerError {
  constructor(openCodePath: string) {
    super(
      `OpenCode CLI not found at: ${openCodePath}`,
      'OPENCODE_NOT_FOUND',
      { openCodePath },
      false
    );
    this.name = 'OpenCodeNotFoundError';
  }
}

/** Error when retry attempts are exhausted */
export class RetryExhaustedError extends ExecutionLayerError {
  constructor(
    public readonly taskId: string,
    public readonly attempts: number,
    public readonly lastError: ExecutionError
  ) {
    super(
      `Retry attempts exhausted after ${attempts} attempts`,
      'RETRY_EXHAUSTED',
      { taskId, attempts, lastError },
      false
    );
    this.name = 'RetryExhaustedError';
  }
}
