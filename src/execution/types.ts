/**
 * Execution Layer - Type Definitions
 * 
 * Provides types for the code execution abstraction layer.
 * All coding tasks should go through the CodeExecutor interface.
 */

// ============================================================================
// Task Types
// ============================================================================

/** Task definition for execution */
export interface ExecutionTask {
  /** Unique identifier for the task */
  id: string;
  /** Instructions for the coding agent */
  instructions: string;
  /** Context for execution */
  context?: ExecutionContext;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Retry configuration */
  retry?: RetryConfig;
}

/** Context passed to the executor */
export interface ExecutionContext {
  /** Files to include in the execution context */
  files?: Record<string, string>;
  /** Working directory for execution */
  workingDirectory?: string;
  /** Environment variables */
  environment?: Record<string, string>;
}

/** Retry configuration for failed executions */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Initial delay between retries in ms */
  initialDelayMs: number;
  /** Maximum delay between retries in ms */
  maxDelayMs: number;
  /** Backoff multiplier for exponential backoff */
  backoffMultiplier: number;
}

// ============================================================================
// Result Types
// ============================================================================

/** Result of a code execution */
export interface ExecutionResult {
  /** Whether the execution succeeded */
  success: boolean;
  /** The task ID */
  taskId: string;
  /** Standard output and error */
  output: ExecutionOutput;
  /** Error details if failed */
  error?: ExecutionError;
  /** Execution metrics */
  metrics: ExecutionMetrics;
  /** Number of attempts (including retries) */
  attempts: number;
  /** When execution started */
  startedAt: Date;
  /** When execution completed */
  completedAt: Date;
}

/** Standard output from execution */
export interface ExecutionOutput {
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Exit code */
  exitCode: number;
  /** Files created or modified */
  files?: Record<string, string>;
  /** Artifacts produced */
  artifacts?: Artifact[];
}

/** Error information from execution */
export interface ExecutionError {
  /** Error code */
  code: string;
  /** Human-readable message */
  message: string;
  /** Additional error details */
  details?: any;
  /** Whether the error is recoverable (can retry) */
  recoverable: boolean;
}

/** Metrics about the execution */
export interface ExecutionMetrics {
  /** Duration in milliseconds */
  durationMs: number;
  /** Tokens used (if available) */
  tokensUsed?: number;
  /** Model used for execution */
  model?: string;
}

/** File or directory artifact */
export interface Artifact {
  /** Path to the artifact */
  path: string;
  /** Type of artifact */
  type: 'file' | 'directory' | 'image' | 'other';
  /** Size in bytes */
  size?: number;
}

// ============================================================================
// Validation Types
// ============================================================================

/** Result of output validation */
export interface ValidationResult {
  /** Whether the output is valid */
  valid: boolean;
  /** Validation errors */
  errors: ValidationError[];
  /** Validation warnings */
  warnings: ValidationWarning[];
}

/** Validation error */
export interface ValidationError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Line number (if applicable) */
  line?: number;
  /** Column number (if applicable) */
  column?: number;
}

/** Validation warning */
export interface ValidationWarning {
  /** Warning code */
  code: string;
  /** Warning message */
  message: string;
  /** Suggested fix */
  suggestion?: string;
}

// ============================================================================
// Test Types
// ============================================================================

/** Configuration for running tests */
export interface TestConfig {
  /** Test framework to use */
  framework?: 'jest' | 'vitest' | 'mocha' | 'pytest' | 'custom';
  /** Test files pattern */
  pattern?: string;
  /** Working directory for tests */
  workingDirectory?: string;
  /** Environment variables */
  environment?: Record<string, string>;
  /** Timeout for tests */
  timeout?: number;
  /** Whether to collect coverage */
  coverage?: boolean;
}

/** Result of test execution */
export interface TestResult {
  /** Whether all tests passed */
  passed: boolean;
  /** Total number of tests */
  totalTests: number;
  /** Number of passed tests */
  passedTests: number;
  /** Number of failed tests */
  failedTests: number;
  /** Individual test results */
  results: TestCaseResult[];
  /** Code coverage information */
  coverage?: CodeCoverage;
}

/** Individual test case result */
export interface TestCaseResult {
  /** Test name */
  name: string;
  /** Test status */
  status: 'passed' | 'failed' | 'skipped';
  /** Test duration in ms */
  durationMs?: number;
  /** Error message if failed */
  error?: string;
}

/** Code coverage information */
export interface CodeCoverage {
  /** Total lines */
  lines: number;
  /** Covered lines */
  linesCovered: number;
  /** Percentage of lines covered */
  linesPercent: number;
}

// ============================================================================
// Executor Configuration
// ============================================================================

/** Configuration for OpenCodeExecutor */
export interface OpenCodeExecutorConfig {
  /** Path to OpenCode CLI binary */
  openCodePath?: string;
  /** Default timeout in ms */
  defaultTimeout?: number;
  /** Default retry configuration */
  defaultRetry?: RetryConfig;
  /** Model to use */
  model?: string;
  /** Working directory */
  workingDirectory?: string;
}

// ============================================================================
// Default Values
// ============================================================================

/** Default retry configuration */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

/** Default executor configuration */
export const DEFAULT_EXECUTOR_CONFIG: OpenCodeExecutorConfig = {
  openCodePath: '/root/.opencode/bin/opencode',
  defaultTimeout: 300000, // 5 minutes
  defaultRetry: DEFAULT_RETRY_CONFIG,
  model: 'opencode/minimax-m2.1-free',
};
