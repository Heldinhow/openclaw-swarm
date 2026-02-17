/**
 * Execution Layer - CodeExecutor Interface
 * 
 * Abstract interface for code execution.
 * All coding agents must use implementations of this interface.
 * No agent should execute shell commands directly.
 */

import type {
  ExecutionTask,
  ExecutionResult,
  ExecutionOutput,
  ValidationResult,
  TestResult,
  TestConfig,
} from './types.js';

/**
 * Interface for code execution.
 * 
 * Implementations provide a standardized way to execute coding tasks,
 * validate outputs, and run tests. The executor handles all the
 * complexities of process spawning, streaming, timeouts, and retries.
 * 
 * Usage:
 * ```typescript
 * const executor = new OpenCodeExecutor(config);
 * const result = await executor.run(task);
 * ```
 */
export interface CodeExecutor {
  /**
   * Execute a coding task.
   * 
   * @param task - Task definition with instructions and context
   * @returns ExecutionResult with structured output
   * @throws ExecutionFailedError if execution fails
   * @throws ExecutionTimeoutError if execution times out
   * @throws RetryExhaustedError if retries are exhausted
   */
  run(task: ExecutionTask): Promise<ExecutionResult>;

  /**
   * Validate execution output.
   * 
   * Checks the output for common issues like errors, warnings,
   * or unexpected patterns. Use this to validate that the
   * execution produced acceptable results.
   * 
   * @param output - Output to validate
   * @returns ValidationResult with pass/fail and details
   */
  validate(output: ExecutionOutput): Promise<ValidationResult>;

  /**
   * Run tests on code.
   * 
   * Executes the provided code against a test suite.
   * The implementation handles test framework detection and execution.
   * 
   * @param code - Code to test (or path to test)
   * @param testConfig - Optional test configuration
   * @returns TestResult with test outcomes
   * @throws TestFailedError if tests fail
   */
  test(code: string, testConfig?: TestConfig): Promise<TestResult>;
}

/**
 * Factory function type for creating executors.
 */
export type ExecutorFactory<T extends CodeExecutor = CodeExecutor> = (
  config?: any
) => T;

/**
 * Registry for executor implementations.
 * Allows for dependency injection and executor swapping.
 */
export class ExecutorRegistry {
  private executors = new Map<string, CodeExecutor>();
  private factories = new Map<string, ExecutorFactory>();

  /**
   * Register an executor instance.
   */
  register(name: string, executor: CodeExecutor): void {
    this.executors.set(name, executor);
  }

  /**
   * Register an executor factory.
   */
  registerFactory(name: string, factory: ExecutorFactory): void {
    this.factories.set(name, factory);
  } /**
   * Get an executor by name.
   * If a factory is registered, it will create a new instance.
   */
  get(name: string): CodeExecutor {
    const executor = this.executors.get(name);
    if (executor) {
      return executor;
    }

    const factory = this.factories.get(name);
    if (factory) {
      const instance = factory();
      this.executors.set(name, instance);
      return instance;
    }

    throw new Error(`Executor not found: ${name}`);
  }

  /**
   * Check if an executor exists.
   */
  has(name: string): boolean {
    return this.executors.has(name) || this.factories.has(name);
  }

  /**
   * List all registered executors.
   */
  list(): string[] {
    return [
      ...Array.from(this.executors.keys()),
      ...Array.from(this.factories.keys()),
    ];
  }
}

// Default global registry
export const globalExecutorRegistry = new ExecutorRegistry();
