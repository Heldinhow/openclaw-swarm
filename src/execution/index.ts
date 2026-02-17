/**
 * Execution Layer - Public API
 * 
 * This module provides a formal abstraction for executing coding tasks.
 * All coding agents must use the CodeExecutor interface - no direct shell execution.
 * 
 * Usage:
 * ```typescript
 * import { OpenCodeExecutor, CodeExecutor } from './execution';
 * 
 * const executor = new OpenCodeExecutor({ model: 'opencode/minimax-m2.1-free' });
 * const result = await executor.run({
 *   id: 'task-1',
 *   instructions: 'Create a hello world function'
 * });
 * ```
 */

// Types
export type {
  ExecutionTask,
  ExecutionContext,
  RetryConfig,
  ExecutionResult,
  ExecutionOutput,
  ExecutionError,
  ExecutionMetrics,
  Artifact,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  TestConfig,
  TestResult,
  TestCaseResult,
  CodeCoverage,
  OpenCodeExecutorConfig,
} from './types.js';

export {
  DEFAULT_RETRY_CONFIG,
  DEFAULT_EXECUTOR_CONFIG,
} from './types.js';

// Interface
export type { CodeExecutor, ExecutorFactory } from './CodeExecutor.js';
export {
  ExecutorRegistry,
  globalExecutorRegistry,
} from './CodeExecutor.js';

// Errors
export {
  ExecutionLayerError,
  ExecutorNotFoundError,
  ExecutionFailedError,
  ExecutionTimeoutError,
  ValidationError as ValidationErrorClass,
  TestFailedError,
  OpenCodeNotFoundError,
  RetryExhaustedError,
} from './errors.js';

// Implementations
export { OpenCodeExecutor } from './OpenCodeExecutor.js';
