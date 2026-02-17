# Execution Layer - Specification

## Overview

The Execution Layer provides a formal abstraction for executing coding tasks through external AI coding agents (primarily OpenCode). This layer ensures all code execution goes through a centralized, observable, and replaceable executor.

## Problem Statement

Current implementation allows agents to execute shell commands directly, which:
1. Creates security risks and inconsistent behavior
2. Makes execution hard to observe and debug
3. Prevents retry logic and timeout handling
4. Doesn't support structured output parsing

## Requirements

### 1. CodeExecutor Interface

**Location:** `src/execution/CodeExecutor.ts`

```typescript
interface CodeExecutor {
  /**
   * Execute a coding task
   * @param task - Task definition with instructions and context
   * @returns ExecutionResult with structured output
   */
  run(task: ExecutionTask): Promise<ExecutionResult>;

  /**
   * Validate execution output
   * @param output - Output to validate
   * @returns ValidationResult with pass/fail and details
   */
  validate(output: ExecutionOutput): Promise<ValidationResult>;

  /**
   * Run tests on code
   * @param code - Code to test
   * @param testConfig - Test configuration
   * @returns TestResult with test outcomes
   */
  test(code: string, testConfig?: TestConfig): Promise<TestResult>;
}
```

### 2. ExecutionTask Type

```typescript
interface ExecutionTask {
  id: string;
  instructions: string;
  context?: {
    files?: Record<string, string>;
    workingDirectory?: string;
    environment?: Record<string, string>;
  };
  timeout?: number; // ms
  retry?: RetryConfig;
}

interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}
```

### 3. ExecutionResult Type

```typescript
interface ExecutionResult {
  success: boolean;
  taskId: string;
  output: ExecutionOutput;
  error?: ExecutionError;
  metrics: ExecutionMetrics;
  attempts: number;
  startedAt: Date;
  completedAt: Date;
}

interface ExecutionOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
  files?: Record<string, string>; // Files created/modified
  artifacts?: Artifact[];
}

interface ExecutionError {
  code: string;
  message: string;
  details?: any;
  recoverable: boolean;
}

interface ExecutionMetrics {
  durationMs: number;
  tokensUsed?: number;
  model?: string;
}

interface Artifact {
  path: string;
  type: 'file' | 'directory' | 'image' | 'other';
  size?: number;
}
```

### 4. OpenCodeExecutor Implementation

**Location:** `src/execution/OpenCodeExecutor.ts`

Features:
- Calls OpenCode CLI (`/root/.opencode/bin/opencode`)
- Handles streaming logs via process stdout/stderr
- Supports configurable timeout
- Supports retry strategy with exponential backoff
- Returns structured ExecutionResult

```typescript
class OpenCodeExecutor implements CodeExecutor {
  constructor(config: OpenCodeExecutorConfig);
  run(task: ExecutionTask): Promise<ExecutionResult>;
  validate(output: ExecutionOutput): Promise<ValidationResult>;
  test(code: string, testConfig?: TestConfig): Promise<TestResult>;
}
```

### 5. Dependency Injection

The executor must be replaceable. Usage:

```typescript
// Registration
container.register<CodeExecutor>('CodeExecutor', { useClass: OpenCodeExecutor });

// Usage
const executor = container.resolve<CodeExecutor>('CodeExecutor');
const result = await executor.run(task);
```

### 6. ValidationResult Type

```typescript
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface ValidationError {
  code: string;
  message: string;
  line?: number;
  column?: number;
}

interface ValidationWarning {
  code: string;
  message: string;
  suggestion?: string;
}
```

### 7. TestResult Type

```typescript
interface TestResult {
  passed: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  results: TestCaseResult[];
  coverage?: CodeCoverage;
}

interface TestCaseResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  durationMs?: number;
  error?: string;
}

interface CodeCoverage {
  lines: number;
  linesCovered: number;
  linesPercent: number;
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CodeExecutor (interface)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │    run()    │  │  validate  │  │    test()   │           │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘           │
└─────────┼────────────────┼────────────────┼──────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                  OpenCodeExecutor                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │  opencode   │  │   timeout   │  │    retry    │           │
│  │    CLI      │  │   handler   │  │   strategy  │           │
│  └─────────────┘  └─────────────┘  └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

```
src/
├── execution/
│   ├── types.ts           # All type definitions
│   ├── CodeExecutor.ts    # Interface
│   ├── OpenCodeExecutor.ts # Implementation
│   ├── errors.ts          # Error classes
│   └── index.ts           # Public exports
```

## Acceptance Criteria

1. ✅ CodeExecutor interface defines run, validate, test methods
2. ✅ OpenCodeExecutor calls OpenCode CLI correctly
3. ✅ Streaming logs are captured and returned
4. ✅ Timeout is enforced
5. ✅ Retry strategy works with exponential backoff
6. ✅ ExecutionResult is structured and complete
7. ✅ Executor is replaceable via dependency injection
8. ✅ No agent executes shell commands directly
9. ✅ All coding agents use this executor
