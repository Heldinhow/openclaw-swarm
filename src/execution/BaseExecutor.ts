/**
 * Base Executor - Abstract base class for all executors
 *
 * Provides common functionality like retry logic, timeout handling,
 * and result formatting. Concrete executors only need to implement
 * the executeTask method.
 */

import type { CodeExecutor } from "./CodeExecutor.js";
import type {
  ExecutionTask,
  ExecutionResult,
  ExecutionOutput,
  ValidationResult,
  TestResult,
  TestConfig,
  RetryConfig,
} from "./types.js";
import { ExecutionLayerError, ExecutionFailedError } from "./errors.js";
import { DEFAULT_RETRY_CONFIG } from "./types.js";

export interface BaseExecutorConfig {
  defaultTimeout?: number;
  defaultRetry?: RetryConfig;
}

export abstract class BaseExecutor implements CodeExecutor {
  protected config: Required<BaseExecutorConfig>;

  constructor(config: BaseExecutorConfig = {}) {
    this.config = {
      defaultTimeout: config.defaultTimeout ?? 300000,
      defaultRetry: config.defaultRetry ?? DEFAULT_RETRY_CONFIG,
    };
  }

  abstract run(task: ExecutionTask): Promise<ExecutionResult>;
  abstract validate(output: ExecutionOutput): Promise<ValidationResult>;
  abstract test(code: string, testConfig?: TestConfig): Promise<TestResult>;

  protected normalizeError(error: unknown, taskId: string): ExecutionLayerError {
    if (error instanceof ExecutionLayerError) {
      return error;
    }

    if (error instanceof Error) {
      return new ExecutionFailedError(error.message, taskId);
    }

    return new ExecutionFailedError(String(error), taskId);
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
