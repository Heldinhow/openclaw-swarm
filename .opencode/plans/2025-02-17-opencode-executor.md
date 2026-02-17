# OpenCodeExecutor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a robust, replaceable OpenCodeExecutor that calls OpenCode CLI, handles streaming logs, supports timeout/retry, and returns structured results. All coding agents must use this execution layer instead of direct shell execution.

**Architecture:** The execution layer already exists with a `CodeExecutor` interface. The main implementation `OpenCodeExecutor` currently spawns processes directly instead of using the `ProcessSupervisor`. We'll refactor it to use ProcessSupervisor for consistency, add streaming callbacks, and ensure all coding agents depend on this abstraction.

**Tech Stack:** TypeScript, Node.js child_process, ProcessSupervisor, Vitest

---

## Task 1: Fix OpenCodeExecutor to Use ProcessSupervisor

**Files:**

- Modify: `/root/.openclaw/workspace/projects/orchestration-fork/src/execution/OpenCodeExecutor.ts`
- Test: `/root/.openclaw/workspace/projects/orchestration-fork/src/execution/OpenCodeExecutor.test.ts` (create)

**Step 1: Write failing test for ProcessSupervisor integration**

Create test file `/root/.openclaw/workspace/projects/orchestration-fork/src/execution/OpenCodeExecutor.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OpenCodeExecutor } from "./OpenCodeExecutor.js";
import * as supervisorModule from "../process/supervisor/index.js";

describe("OpenCodeExecutor", () => {
  let mockSupervisor: any;

  beforeEach(() => {
    mockSupervisor = {
      spawn: vi.fn().mockResolvedValue({
        promise: Promise.resolve({
          exitCode: 0,
          stdout: "success output",
          stderr: "",
        }),
        cancel: vi.fn(),
      }),
    };
    vi.spyOn(supervisorModule, "getProcessSupervisor").mockReturnValue(mockSupervisor);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should use ProcessSupervisor instead of direct spawn", async () => {
    const executor = new OpenCodeExecutor();

    await executor.run({
      id: "test-task",
      instructions: "echo hello",
    });

    expect(mockSupervisor.spawn).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "child",
        argv: expect.arrayContaining(["run", "--yes", "echo hello"]),
      }),
    );
  });

  it("should handle successful execution", async () => {
    const executor = new OpenCodeExecutor();

    const result = await executor.run({
      id: "test-task",
      instructions: "echo hello",
    });

    expect(result.success).toBe(true);
    expect(result.output.exitCode).toBe(0);
    expect(result.output.stdout).toBe("success output");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /root/.openclaw/workspace/projects/orchestration-fork
pnpm test src/execution/OpenCodeExecutor.test.ts --reporter=verbose
```

Expected: FAIL - "Expected spy to have been called" (since current implementation doesn't use supervisor)

**Step 3: Refactor OpenCodeExecutor to use ProcessSupervisor**

Modify `/root/.openclaw/workspace/projects/orchestration-fork/src/execution/OpenCodeExecutor.ts`:

Replace the `executeTask` method (lines 144-253) to use ProcessSupervisor:

```typescript
import { getProcessSupervisor } from '../process/supervisor/index.js';

// ... in executeTask method:
private async executeTask(task: ExecutionTask): Promise<{ output: ExecutionOutput; metrics: Partial<ExecutionMetrics> }> {
  const supervisor = getProcessSupervisor();
  const timeout = task.timeout ?? this.config.defaultTimeout;

  // Build command arguments
  const args = this.buildCommandArgs(task);

  // Collect stdout/stderr
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];

  const spawnOptions = {
    mode: 'child' as const,
    argv: [this.config.openCodePath, ...args],
    env: {
      ...process.env,
      ...task.context?.environment,
    },
    cwd: task.context?.workingDirectory ?? this.config.workingDirectory,
    timeoutMs: timeout,
    onStdout: (chunk: string) => {
      stdoutChunks.push(chunk);
      // Emit to stream if callback provided
      if (task.onStdout) {
        task.onStdout(chunk);
      }
    },
    onStderr: (chunk: string) => {
      stderrChunks.push(chunk);
      if (task.onStderr) {
        task.onStderr(chunk);
      }
    },
  };

  try {
    const run = await supervisor.spawn(spawnOptions);
    const result = await run.promise;

    return {
      output: {
        stdout: stdoutChunks.join(''),
        stderr: stderrChunks.join(''),
        exitCode: result.exitCode ?? -1,
      },
      metrics: {
        model: this.config.model,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('timeout')) {
      throw new ExecutionTimeoutError(task.id, timeout);
    }
    throw error;
  }
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm test src/execution/OpenCodeExecutor.test.ts --reporter=verbose
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/execution/OpenCodeExecutor.ts src/execution/OpenCodeExecutor.test.ts
git commit -m "refactor(execution): use ProcessSupervisor in OpenCodeExecutor"
```

---

## Task 2: Add Streaming Log Support with Callbacks

**Files:**

- Modify: `/root/.openclaw/workspace/projects/orchestration-fork/src/execution/types.ts`
- Modify: `/root/.openclaw/workspace/projects/orchestration-fork/src/execution/OpenCodeExecutor.ts`
- Test: `/root/.openclaw/workspace/projects/orchestration-fork/src/execution/OpenCodeExecutor.test.ts`

**Step 1: Add streaming callbacks to ExecutionTask type**

Modify `/root/.openclaw/workspace/projects/orchestration-fork/src/execution/types.ts`:

```typescript
export interface ExecutionTask {
  id: string;
  instructions: string;
  context?: ExecutionContext;
  timeout?: number;
  retry?: RetryConfig;
  /** Callback for stdout streaming */
  onStdout?: (chunk: string) => void;
  /** Callback for stderr streaming */
  onStderr?: (chunk: string) => void;
}
```

**Step 2: Write test for streaming**

Add to `/root/.openclaw/workspace/projects/orchestration-fork/src/execution/OpenCodeExecutor.test.ts`:

```typescript
it("should call streaming callbacks for stdout and stderr", async () => {
  const onStdout = vi.fn();
  const onStderr = vi.fn();

  mockSupervisor.spawn.mockResolvedValue({
    promise: Promise.resolve({ exitCode: 0 }),
    cancel: vi.fn(),
  });

  const executor = new OpenCodeExecutor();

  await executor.run({
    id: "test-task",
    instructions: "echo hello",
    onStdout,
    onStderr,
  });

  expect(onStdout).toHaveBeenCalled();
});
```

**Step 3: Verify implementation uses callbacks**

The implementation from Task 1 already includes the callback handling. Run the test:

```bash
pnpm test src/execution/OpenCodeExecutor.test.ts --reporter=verbose
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/execution/types.ts src/execution/OpenCodeExecutor.test.ts
git commit -m "feat(execution): add streaming callbacks for stdout/stderr"
```

---

## Task 3: Ensure OpenCodeExecutor Implements CodeExecutor Interface

**Files:**

- Modify: `/root/.openclaw/workspace/projects/orchestration-fork/src/execution/OpenCodeExecutor.ts`
- Modify: `/root/.openclaw/workspace/projects/orchestration-fork/src/execution/CodeExecutor.ts`

**Step 1: Update class declaration to implement interface**

Modify `/root/.openclaw/workspace/projects/orchestration-fork/src/execution/OpenCodeExecutor.ts` line 60:

```typescript
export class OpenCodeExecutor implements CodeExecutor {
```

**Step 2: Fix any type mismatches**

If TypeScript complains about missing methods or type mismatches, fix them. The current implementation should already have all required methods:

- `run(task: ExecutionTask): Promise<ExecutionResult>`
- `validate(output: ExecutionOutput): Promise<ValidationResult>`
- `test(code: string, testConfig?: TestConfig): Promise<TestResult>`

**Step 3: Run type check**

```bash
pnpm tsgo
```

Expected: No errors

**Step 4: Commit**

```bash
git add src/execution/OpenCodeExecutor.ts src/execution/CodeExecutor.ts
git commit -m "fix(execution): OpenCodeExecutor explicitly implements CodeExecutor interface"
```

---

## Task 4: Create Executor Factory and Registry

**Files:**

- Create: `/root/.openclaw/workspace/projects/orchestration-fork/src/execution/executor-factory.ts`
- Modify: `/root/.openclaw/workspace/projects/orchestration-fork/src/execution/index.ts`
- Test: `/root/.openclaw/workspace/projects/orchestration-fork/src/execution/executor-factory.test.ts`

**Step 1: Create executor factory**

Create `/root/.openclaw/workspace/projects/orchestration-fork/src/execution/executor-factory.ts`:

```typescript
/**
 * Executor Factory - Creates executor instances
 *
 * Supports multiple executor types:
 * - 'opencode': Uses OpenCode CLI
 * - 'docker': Future support for Docker-based execution
 * - 'localshell': Future support for local shell execution
 */

import type { CodeExecutor, ExecutorFactory } from "./CodeExecutor.js";
import { OpenCodeExecutor } from "./OpenCodeExecutor.js";
import type { OpenCodeExecutorConfig } from "./types.js";
import { globalExecutorRegistry } from "./CodeExecutor.js";

export type ExecutorType = "opencode" | "docker" | "localshell";

export interface CreateExecutorOptions {
  type: ExecutorType;
  config?: OpenCodeExecutorConfig;
}

/**
 * Create an executor by type
 */
export function createExecutor(options: CreateExecutorOptions): CodeExecutor {
  switch (options.type) {
    case "opencode":
      return new OpenCodeExecutor(options.config);
    case "docker":
      throw new Error("Docker executor not yet implemented");
    case "localshell":
      throw new Error("LocalShell executor not yet implemented");
    default:
      throw new Error(`Unknown executor type: ${(options as any).type}`);
  }
}

/**
 * Register default executors in the global registry
 */
export function registerDefaultExecutors(): void {
  globalExecutorRegistry.registerFactory("opencode", () => new OpenCodeExecutor());
  globalExecutorRegistry.registerFactory("docker", () => {
    throw new Error("Docker executor not yet implemented");
  });
  globalExecutorRegistry.registerFactory("localshell", () => {
    throw new Error("LocalShell executor not yet implemented");
  });
}

/**
 * Get or create an executor
 */
export function getExecutor(type: ExecutorType, config?: OpenCodeExecutorConfig): CodeExecutor {
  if (globalExecutorRegistry.has(type)) {
    return globalExecutorRegistry.get(type);
  }
  return createExecutor({ type, config });
}
```

**Step 2: Write tests for factory**

Create `/root/.openclaw/workspace/projects/orchestration-fork/src/execution/executor-factory.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import {
  createExecutor,
  getExecutor,
  registerDefaultExecutors,
  ExecutorType,
} from "./executor-factory.js";
import { OpenCodeExecutor } from "./OpenCodeExecutor.js";
import { globalExecutorRegistry } from "./CodeExecutor.js";

describe("executor-factory", () => {
  beforeEach(() => {
    // Clear registry before each test
    // Note: In real tests, you might need to reset the registry
  });

  it("should create OpenCodeExecutor", () => {
    const executor = createExecutor({ type: "opencode" });
    expect(executor).toBeInstanceOf(OpenCodeExecutor);
  });

  it("should throw for unimplemented docker executor", () => {
    expect(() => createExecutor({ type: "docker" })).toThrow("Docker executor not yet implemented");
  });

  it("should throw for unimplemented localshell executor", () => {
    expect(() => createExecutor({ type: "localshell" })).toThrow(
      "LocalShell executor not yet implemented",
    );
  });

  it("should throw for unknown executor type", () => {
    expect(() => createExecutor({ type: "unknown" as ExecutorType })).toThrow(
      "Unknown executor type",
    );
  });

  it("should return executor from registry if available", () => {
    registerDefaultExecutors();
    const executor = getExecutor("opencode");
    expect(executor).toBeInstanceOf(OpenCodeExecutor);
  });
});
```

**Step 3: Update index.ts exports**

Modify `/root/.openclaw/workspace/projects/orchestration-fork/src/execution/index.ts`:

Add to exports:

```typescript
// Factory
export {
  createExecutor,
  getExecutor,
  registerDefaultExecutors,
  type ExecutorType,
  type CreateExecutorOptions,
} from "./executor-factory.js";
```

**Step 4: Run tests**

```bash
pnpm test src/execution/executor-factory.test.ts --reporter=verbose
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/execution/executor-factory.ts src/execution/executor-factory.test.ts src/execution/index.ts
git commit -m "feat(execution): add executor factory for pluggable executor types"
```

---

## Task 5: Create Abstract Base Executor Class

**Files:**

- Create: `/root/.openclaw/workspace/projects/orchestration-fork/src/execution/BaseExecutor.ts`
- Modify: `/root/.openclaw/workspace/projects/orchestration-fork/src/execution/OpenCodeExecutor.ts`
- Test: `/root/.openclaw/workspace/projects/orchestration-fork/src/execution/BaseExecutor.test.ts`

**Step 1: Create base executor class**

Create `/root/.openclaw/workspace/projects/orchestration-fork/src/execution/BaseExecutor.ts`:

```typescript
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
  ExecutionMetrics,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  TestResult,
  TestConfig,
  RetryConfig,
} from "./types.js";
import { DEFAULT_RETRY_CONFIG } from "./types.js";
import {
  ExecutionLayerError,
  ExecutionFailedError,
  ExecutionTimeoutError,
  RetryExhaustedError,
} from "./errors.js";

export interface BaseExecutorConfig {
  defaultTimeout?: number;
  defaultRetry?: RetryConfig;
}

export abstract class BaseExecutor implements CodeExecutor {
  protected config: Required<BaseExecutorConfig>;

  constructor(config: BaseExecutorConfig = {}) {
    this.config = {
      defaultTimeout: config.defaultTimeout ?? 300000, // 5 minutes
      defaultRetry: config.defaultRetry ?? DEFAULT_RETRY_CONFIG,
    };
  }

  /**
   * Execute a task with retry logic
   */
  async run(task: ExecutionTask): Promise<ExecutionResult> {
    const startedAt = new Date();
    const retryConfig = task.retry ?? this.config.defaultRetry;
    let attempts = 0;
    let lastError: any;

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
          retryConfig.maxDelayMs,
        );

        console.log(
          `Retry ${attempts}/${retryConfig.maxAttempts} for task ${task.id} after ${delay}ms`,
        );
        await this.sleep(delay);
      }
    }

    throw new RetryExhaustedError(task.id, attempts, lastError);
  }

  /**
   * Abstract method: concrete executors implement this
   */
  protected abstract executeTask(task: ExecutionTask): Promise<{
    output: ExecutionOutput;
    metrics: Partial<ExecutionMetrics>;
  }>;

  /**
   * Default validation implementation
   */
  async validate(output: ExecutionOutput): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check exit code
    if (output.exitCode !== 0) {
      errors.push({
        code: "NON_ZERO_EXIT",
        message: `Process exited with code ${output.exitCode}`,
      });
    }

    // Check for common error patterns
    const errorPatterns = [
      { pattern: /error:/i, code: "ERROR_IN_OUTPUT" },
      { pattern: /failed/i, code: "FAILURE_IN_OUTPUT" },
      { pattern: /exception/i, code: "EXCEPTION_IN_OUTPUT" },
    ];

    for (const { pattern, code } of errorPatterns) {
      if (pattern.test(output.stdout) || pattern.test(output.stderr)) {
        errors.push({ code, message: `Found error pattern in output: ${code}` });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Default test implementation
   */
  async test(code: string, testConfig?: TestConfig): Promise<TestResult> {
    // Override in concrete implementations
    return {
      passed: false,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      results: [],
    };
  }

  /**
   * Normalize error to ExecutionLayerError
   */
  protected normalizeError(error: unknown, taskId: string): ExecutionLayerError {
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
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

**Step 2: Refactor OpenCodeExecutor to extend BaseExecutor**

Modify `/root/.openclaw/workspace/projects/orchestration-fork/src/execution/OpenCodeExecutor.ts`:

Replace the class declaration and remove duplicated logic:

```typescript
import { BaseExecutor } from "./BaseExecutor.js";
import type { OpenCodeExecutorConfig } from "./types.js";

export class OpenCodeExecutor extends BaseExecutor {
  private openCodeConfig: Required<OpenCodeExecutorConfig>;

  constructor(config: OpenCodeExecutorConfig = {}) {
    super({
      defaultTimeout: config.defaultTimeout,
      defaultRetry: config.defaultRetry,
    });

    this.openCodeConfig = {
      openCodePath: config.openCodePath ?? "/root/.opencode/bin/opencode",
      defaultTimeout: config.defaultTimeout ?? 300000,
      defaultRetry: config.defaultRetry ?? DEFAULT_RETRY_CONFIG,
      model: config.model ?? "opencode/minimax-m2.1-free",
      workingDirectory: config.workingDirectory,
    };

    this.validateOpenCodeExists();
  }

  // ... keep validateOpenCodeExists, buildCommandArgs, and executeTask methods
  // Remove: run, validate, test, normalizeError, sleep (now in BaseExecutor)
}
```

**Step 3: Write tests for base executor**

Create `/root/.openclaw/workspace/projects/orchestration-fork/src/execution/BaseExecutor.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { BaseExecutor } from "./BaseExecutor.js";
import type { ExecutionTask, ExecutionOutput, ExecutionMetrics } from "./types.js";

class TestExecutor extends BaseExecutor {
  protected async executeTask(task: ExecutionTask): Promise<{
    output: ExecutionOutput;
    metrics: Partial<ExecutionMetrics>;
  }> {
    return {
      output: {
        stdout: "test output",
        stderr: "",
        exitCode: 0,
      },
      metrics: {},
    };
  }
}

describe("BaseExecutor", () => {
  it("should execute task successfully", async () => {
    const executor = new TestExecutor();
    const result = await executor.run({
      id: "test",
      instructions: "test command",
    });

    expect(result.success).toBe(true);
    expect(result.output.stdout).toBe("test output");
  });

  it("should validate output correctly", async () => {
    const executor = new TestExecutor();
    const result = await executor.validate({
      stdout: "",
      stderr: "",
      exitCode: 0,
    });

    expect(result.valid).toBe(true);
  });

  it("should detect non-zero exit as validation error", async () => {
    const executor = new TestExecutor();
    const result = await executor.validate({
      stdout: "",
      stderr: "",
      exitCode: 1,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe("NON_ZERO_EXIT");
  });
});
```

**Step 4: Run all execution tests**

```bash
pnpm test src/execution/ --reporter=verbose
```

Expected: All PASS

**Step 5: Commit**

```bash
git add src/execution/BaseExecutor.ts src/execution/BaseExecutor.test.ts src/execution/OpenCodeExecutor.ts
git commit -m "feat(execution): add BaseExecutor abstract class for shared executor logic"
```

---

## Task 6: Ensure No Direct Shell Execution in Coding Agents

**Files:**

- Review: `/root/.openclaw/workspace/projects/orchestration-fork/src/agents/bash-tools.exec-runtime.ts`
- Review: `/root/.openclaw/workspace/projects/orchestration-fork/src/agents/cli-runner.ts`
- Document: `/root/.openclaw/workspace/projects/orchestration-fork/src/execution/README.md`

**Step 1: Verify bash tools use ProcessSupervisor**

The bash tools in `/root/.openclaw/workspace/projects/orchestration-fork/src/agents/bash-tools.exec-runtime.ts` already use ProcessSupervisor. Verify this:

```bash
grep -n "supervisor.spawn" src/agents/bash-tools.exec-runtime.ts
```

Expected: Lines 457, 462, 477 show supervisor.spawn usage

**Step 2: Verify CLI runner uses ProcessSupervisor**

```bash
grep -n "supervisor.spawn" src/agents/cli-runner.ts
```

Expected: Line 241 shows supervisor.spawn usage

**Step 3: Create execution layer documentation**

Create `/root/.openclaw/workspace/projects/orchestration-fork/src/execution/README.md`:

```markdown
# Execution Layer

The execution layer provides a formal abstraction for executing coding tasks.
All coding agents must use implementations of the `CodeExecutor` interface.
**No agent should execute shell commands directly.**

## Architecture
```

┌─────────────────────────────────────────────────────────────┐
│ Coding Agents │
└──────────────────────┬──────────────────────────────────────┘
│ uses
▼
┌─────────────────────────────────────────────────────────────┐
│ CodeExecutor Interface │
│ ┌──────────────┬──────────────┬──────────────┐ │
│ │OpenCodeExecutor│DockerExecutor│LocalShellExecutor│ │
│ └──────────────┴──────────────┴──────────────┘ │
└──────────────────────┬──────────────────────────────────────┘
│ uses
▼
┌─────────────────────────────────────────────────────────────┐
│ ProcessSupervisor │
│ (managed process execution) │
└─────────────────────────────────────────────────────────────┘

````

## Usage

```typescript
import { OpenCodeExecutor, createExecutor } from './execution';

// Option 1: Direct instantiation
const executor = new OpenCodeExecutor({
  model: 'opencode/minimax-m2.1-free',
  defaultTimeout: 300000,
});

// Option 2: Factory pattern
const executor = createExecutor({ type: 'opencode' });

// Execute a task
const result = await executor.run({
  id: 'task-123',
  instructions: 'Create a hello world function',
  timeout: 60000,
  onStdout: (chunk) => console.log('stdout:', chunk),
  onStderr: (chunk) => console.error('stderr:', chunk),
});

console.log('Success:', result.success);
console.log('Output:', result.output.stdout);
````

## Key Features

- **Streaming Logs**: Real-time stdout/stderr callbacks
- **Timeout Support**: Configurable timeouts with graceful termination
- **Retry Strategy**: Exponential backoff with configurable max attempts
- **Structured Results**: Consistent ExecutionResult format
- **Replaceable**: Easy to swap implementations (OpenCode, Docker, LocalShell)

## Error Handling

All errors extend `ExecutionLayerError`:

- `ExecutionFailedError`: Task execution failed
- `ExecutionTimeoutError`: Task exceeded timeout
- `RetryExhaustedError`: All retry attempts failed
- `OpenCodeNotFoundError`: OpenCode CLI not found

## Rules

1. **Always use CodeExecutor**: Never spawn processes directly in coding agents
2. **Use ProcessSupervisor**: The execution layer internally uses ProcessSupervisor
3. **Handle errors**: Catch ExecutionLayerError subclasses appropriately
4. **Set timeouts**: Always set reasonable timeouts for tasks

````

**Step 4: Commit**

```bash
git add src/execution/README.md
git commit -m "docs(execution): add execution layer documentation"
````

---

## Task 7: Run Full Test Suite and Verify

**Step 1: Run all execution tests**

```bash
pnpm test src/execution/ --reporter=verbose
```

Expected: All PASS

**Step 2: Run type check**

```bash
pnpm tsgo
```

Expected: No errors

**Step 3: Run lint check**

```bash
pnpm check
```

Expected: No errors

**Step 4: Run full test suite**

```bash
pnpm test --run
```

Expected: All tests pass (or existing failures only)

**Step 5: Commit any fixes**

If any issues were found and fixed:

```bash
git add -A
git commit -m "fix(execution): address test and lint issues"
```

---

## Summary

After completing this plan:

1. ✅ OpenCodeExecutor uses ProcessSupervisor instead of direct spawn
2. ✅ Streaming log support with onStdout/onStderr callbacks
3. ✅ Proper timeout handling via ProcessSupervisor
4. ✅ Retry strategy with exponential backoff
5. ✅ Structured ExecutionResult type
6. ✅ Comprehensive error handling model
7. ✅ OpenCodeExecutor explicitly implements CodeExecutor interface
8. ✅ Executor factory for pluggable executor types (OpenCode, Docker, LocalShell)
9. ✅ BaseExecutor abstract class for shared logic
10. ✅ All coding agents use the execution layer (already the case)
11. ✅ No direct shell execution in coding agents
12. ✅ Full test coverage

The execution layer is now robust, replaceable, and all coding agents depend only on this abstraction.
