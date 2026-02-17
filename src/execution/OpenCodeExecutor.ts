/**
 * Execution Layer - OpenCodeExecutor Implementation
 * 
 * Implementation of CodeExecutor that uses the OpenCode CLI.
 * Handles streaming logs, timeouts, and retry strategies.
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

import type {
  ExecutionTask,
  ExecutionResult,
  ExecutionOutput,
  ExecutionError,
  ExecutionMetrics,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  TestResult,
  TestConfig,
  OpenCodeExecutorConfig,
  RetryConfig,
} from './types.js';

import {
  DEFAULT_EXECUTOR_CONFIG,
  DEFAULT_RETRY_CONFIG,
} from './types.js';

import {
  ExecutionLayerError,
  ExecutionFailedError,
  ExecutionTimeoutError,
  OpenCodeNotFoundError,
  RetryExhaustedError,
} from './errors.js';

/**
 * OpenCodeExecutor - Executes coding tasks via OpenCode CLI
 * 
 * This executor provides:
 * - Streaming log capture
 * - Configurable timeouts
 * - Retry with exponential backoff
 * - Structured execution results
 * 
 * Example:
 * ```typescript
 * const executor = new OpenCodeExecutor({ model: 'opencode/minimax-m2.1-free' });
 * const result = await executor.run({
 *   id: 'task-1',
 *   instructions: 'Create a hello world function',
 *   timeout: 60000
 * });
 * ```
 */
export class OpenCodeExecutor {
  private config: Required<OpenCodeExecutorConfig>;

  /**
   * Create a new OpenCodeExecutor
   * 
   * @param config - Optional configuration
   */
  constructor(config: OpenCodeExecutorConfig = {}) {
    this.config = {
      openCodePath: config.openCodePath ?? DEFAULT_EXECUTOR_CONFIG.openCodePath,
      defaultTimeout: config.defaultTimeout ?? DEFAULT_EXECUTOR_CONFIG.defaultTimeout,
      defaultRetry: config.defaultRetry ?? DEFAULT_EXECUTOR_CONFIG.defaultRetry,
      model: config.model ?? DEFAULT_EXECUTOR_CONFIG.model,
      workingDirectory: config.workingDirectory,
    };

    // Validate OpenCode CLI exists
    this.validateOpenCodeExists();
  }

  /**
   * Validate that OpenCode CLI exists
   */
  private validateOpenCodeExists(): void {
    if (!fs.existsSync(this.config.openCodePath)) {
      throw new OpenCodeNotFoundError(this.config.openCodePath);
    }
  }

  /**
   * Execute a coding task
   */
  async run(task: ExecutionTask): Promise<ExecutionResult> {
    const startedAt = new Date();
    const retryConfig = task.retry ?? this.config.defaultRetry;
    let attempts = 0;
    let lastError: ExecutionError | undefined;

    while (attempts < retryConfig.maxAttempts) {
      attempts++;
      
      try {
        const result = await this.executeTask(task);
        
        return {
          success: true,
          taskId: task.id,
          output: result.output,
          metrics: {
            ...result.metrics,
            durationMs: Date.now() - startedAt.getTime(),
          },
          attempts,
          startedAt,
          completedAt: new Date(),
        };
      } catch (error) {
        const execError = this.normalizeError(error, task.id);
        lastError = execError.toExecutionError();

        // Check if we should retry
        if (!execError.recoverable || attempts >= retryConfig.maxAttempts) {
          throw new RetryExhaustedError(task.id, attempts, lastError);
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          retryConfig.initialDelayMs * Math.pow(retryConfig.backoffMultiplier, attempts - 1),
          retryConfig.maxDelayMs
        );

        console.log(`Retry ${attempts}/${retryConfig.maxAttempts} for task ${task.id} after ${delay}ms`);
        await this.sleep(delay);
      }
    }

    // This should never be reached, but TypeScript needs it
    throw new RetryExhaustedError(task.id, attempts, lastError!);
  }

  /**
   * Execute a single task (without retry logic)
   */
  private async executeTask(task: ExecutionTask): Promise<{ output: ExecutionOutput; metrics: Partial<ExecutionMetrics> }> {
    return new Promise((resolve, reject) => {
      const stdoutChunks: string[] = [];
      const stderrChunks: string[] = [];
      let childProcess: ChildProcess | null = null;
      let timeoutId: NodeJS.Timeout | null = null;
      let exitCode: number | null = null;

      // Set up timeout
      const timeout = task.timeout ?? this.config.defaultTimeout;
      timeoutId = setTimeout(() => {
        if (childProcess) {
          childProcess.kill('SIGTERM');
          // Force kill after 5 seconds
          setTimeout(() => {
            if (childProcess) {
              childProcess.kill('SIGKILL');
            }
          }, 5000);
        }
        reject(new ExecutionTimeoutError(task.id, timeout));
      }, timeout);

      // Build command arguments
      const args = this.buildCommandArgs(task);

      // Spawn OpenCode process
      const spawnOptions: {
        stdio: ['pipe', 'pipe', 'pipe'];
        env: Record<string, string | undefined>;
        cwd?: string;
      } = {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          ...task.context?.environment,
        },
      };

      if (task.context?.workingDirectory) {
        spawnOptions.cwd = task.context.workingDirectory;
      } else if (this.config.workingDirectory) {
        spawnOptions.cwd = this.config.workingDirectory;
      }

      try {
        childProcess = spawn(this.config.openCodePath, args, spawnOptions);
      } catch (error) {
        clearTimeout(timeoutId!);
        reject(new ExecutionFailedError(
          `Failed to spawn OpenCode: ${error instanceof Error ? error.message : String(error)}`,
          task.id
        ));
        return;
      }

      // Handle stdout (streaming logs)
      if (childProcess.stdout) {
        const rl = readline.createInterface({
          input: childProcess.stdout,
          crlfDelay: Infinity,
        });

        rl.on('line', (line) => {
          stdoutChunks.push(line);
          // Could emit to a stream for real-time logging
        });
      }

      // Handle stderr
      if (childProcess.stderr) {
        const rl = readline.createInterface({
          input: childProcess.stderr,
          crlfDelay: Infinity,
        });

        rl.on('line', (line) => {
          stderrChunks.push(line);
        });
      }

      // Handle process completion
      childProcess.on('close', (code) => {
        exitCode = code ?? -1;
        clearTimeout(timeoutId!);

        const output: ExecutionOutput = {
          stdout: stdoutChunks.join('\n'),
          stderr: stderrChunks.join('\n'),
          exitCode,
        };

        resolve({
          output,
          metrics: {
            model: this.config.model,
          },
        });
      });

      childProcess.on('error', (error) => {
        clearTimeout(timeoutId!);
        reject(new ExecutionFailedError(
          `OpenCode process error: ${error.message}`,
          task.id,
          exitCode ?? undefined
        ));
      });
    });
  }

  /**
   * Build command arguments for OpenCode CLI
   */
  private buildCommandArgs(task: ExecutionTask): string[] {
    const args: string[] = [];

    // Add model if specified
    if (this.config.model) {
      args.push('--model', this.config.model);
    }

    // Add the instruction
    args.push('run', '--yes', task.instructions);

    return args;
  }

  /**
   * Validate execution output
   */
  async validate(output: ExecutionOutput): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check exit code
    if (output.exitCode !== 0) {
      errors.push({
        code: 'NON_ZERO_EXIT',
        message: `Process exited with code ${output.exitCode}`,
      });
    }

    // Check for common error patterns in stdout
    const errorPatterns = [
      { pattern: /error:/i, code: 'ERROR_IN_OUTPUT' },
      { pattern: /failed/i, code: 'FAILURE_IN_OUTPUT' },
      { pattern: /exception/i, code: 'EXCEPTION_IN_OUTPUT' },
    ];

    for (const { pattern, code } of errorPatterns) {
      if (pattern.test(output.stdout) || pattern.test(output.stderr)) {
        errors.push({
          code,
          message: `Found error pattern in output: ${code}`,
        });
      }
    }

    // Check for warnings
    const warningPatterns = [
      { pattern: /warning:/i, code: 'WARNING_IN_OUTPUT' },
      { pattern: /deprecated/i, code: 'DEPRECATED_USAGE' },
    ];

    for (const { pattern, code } of warningPatterns) {
      if (pattern.test(output.stdout) || pattern.test(output.stderr)) {
        warnings.push({
          code,
          message: `Found warning in output: ${code}`,
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Run tests on code
   */
  async test(code: string, testConfig?: TestConfig): Promise<TestResult> {
    // For now, run OpenCode with test instructions
    const task: ExecutionTask = {
      id: `test-${Date.now()}`,
      instructions: this.buildTestInstructions(code, testConfig),
      timeout: testConfig?.timeout ?? 120000,
      context: {
        workingDirectory: testConfig?.workingDirectory,
        environment: testConfig?.environment,
      },
    };

    try {
      const result = await this.run(task);
      
      // Parse test results from output
      const testResult = this.parseTestOutput(result.output.stdout + result.output.stderr);
      
      if (!testResult.passed) {
        throw new Error(`${testResult.failedTests}/${testResult.totalTests} tests failed`);
      }
      
      return testResult;
    } catch (error) {
      // Return a failed test result
      return {
        passed: false,
        totalTests: 0,
        passedTests: 0,
        failedTests: 1,
        results: [{
          name: 'Execution',
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        }],
      };
    }
  }

  /**
   * Build test instructions for OpenCode
   */
  private buildTestInstructions(code: string, testConfig?: TestConfig): string {
    const framework = testConfig?.framework ?? 'vitest';
    const pattern = testConfig?.pattern ?? '**/*.test.ts';

    return `Run tests for the following code using ${framework} with pattern "${pattern}":
    
${code}

Report the test results including pass/fail status for each test.`;
  }

  /**
   * Parse test output to extract test results
   */
  private parseTestOutput(output: string): TestResult {
    // Try to parse common test output formats
    // This is a simplified implementation
    
    const passedMatch = output.match(/(\d+)\s+passed/i);
    const failedMatch = output.match(/(\d+)\s+failed/i);
    const totalMatch = output.match(/(\d+)\s+tests?/i);

    const passed = passedMatch ? parseInt(passedMatch[1], 10) : 0;
    const failed = failedMatch ? parseInt(failedMatch[1], 10) : 0;
    const total = totalMatch ? parseInt(totalMatch[1], 10) : (passed + failed);

    return {
      passed: failed === 0 && total > 0,
      totalTests: total,
      passedTests: passed,
      failedTests: failed,
      results: [],
    };
  }

  /**
   * Normalize error to ExecutionLayerError
   */
  private normalizeError(error: unknown, taskId: string): ExecutionLayerError {
    if (error instanceof ExecutionLayerError) {
      return error;
    }

    if (error instanceof Error) {
      return new ExecutionFailedError(error.message, taskId);
    }

    return new ExecutionFailedError(String(error), taskId);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
