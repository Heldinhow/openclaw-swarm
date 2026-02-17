# Execution Layer

The execution layer provides a formal abstraction for executing coding tasks in OpenClaw. All coding agents must use implementations of the `CodeExecutor` interface - **no agent should execute shell commands directly**.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Coding Agents                             │
└──────────────────────┬──────────────────────────────────────┘
                       │ uses
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                 CodeExecutor Interface                       │
│  ┌──────────────┬──────────────┬──────────────┐            │
│  │OpenCodeExecutor│DockerExecutor│LocalShellExecutor│      │
│  └──────────────┴──────────────┴──────────────┘            │
└──────────────────────┬──────────────────────────────────────┘
                       │ uses
                       ▼
┌─────────────────────────────────────────────────────────────┐
│               ProcessSupervisor                              │
│         (managed process execution)                          │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Installation

The execution layer is already included in OpenClaw. No additional installation required.

### Basic Usage

```typescript
import { OpenCodeExecutor } from "./execution";

// Create executor with optional config
const executor = new OpenCodeExecutor({
  model: "opencode/minimax-m2.1-free",
  defaultTimeout: 300000, // 5 minutes
  openCodePath: "/root/.opencode/bin/opencode",
});

// Execute a task
const result = await executor.run({
  id: "task-123",
  instructions: "Create a hello world function in TypeScript",
  timeout: 60000, // 1 minute
});

console.log("Success:", result.success);
console.log("Output:", result.output.stdout);
console.log("Exit Code:", result.output.exitCode);
```

### With Streaming Logs

```typescript
const result = await executor.run({
  id: "task-456",
  instructions: "Build the entire project",
  onStdout: (chunk) => process.stdout.write(chunk),
  onStderr: (chunk) => process.stderr.write(chunk),
});
```

### With Retry Strategy

```typescript
const result = await executor.run({
  id: "task-789",
  instructions: "Run tests",
  retry: {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
  },
});
```

### With Custom Context

```typescript
const result = await executor.run({
  id: "task-abc",
  instructions: "Write tests for the new feature",
  context: {
    workingDirectory: "/path/to/project",
    environment: {
      NODE_ENV: "test",
    },
  },
});
```

## API Reference

### OpenCodeExecutor

```typescript
new OpenCodeExecutor(config?: OpenCodeExecutorConfig)
```

#### Config Options

| Option             | Type          | Default                        | Description                   |
| ------------------ | ------------- | ------------------------------ | ----------------------------- |
| `openCodePath`     | `string`      | `/root/.opencode/bin/opencode` | Path to OpenCode CLI          |
| `model`            | `string`      | `opencode/minimax-m2.1-free`   | Model to use                  |
| `defaultTimeout`   | `number`      | `300000`                       | Default timeout in ms (5 min) |
| `defaultRetry`     | `RetryConfig` | See below                      | Default retry config          |
| `workingDirectory` | `string`      | `undefined`                    | Default working directory     |

#### RetryConfig

| Option              | Type     | Default | Description                    |
| ------------------- | -------- | ------- | ------------------------------ |
| `maxAttempts`       | `number` | `3`     | Maximum retry attempts         |
| `initialDelayMs`    | `number` | `1000`  | Initial delay between retries  |
| `maxDelayMs`        | `number` | `30000` | Maximum delay between retries  |
| `backoffMultiplier` | `number` | `2`     | Exponential backoff multiplier |

### ExecutionTask

```typescript
interface ExecutionTask {
  id: string; // Unique task identifier
  instructions: string; // Instructions for the agent
  context?: ExecutionContext; // Execution context
  timeout?: number; // Timeout in ms
  retry?: RetryConfig; // Retry configuration
  onStdout?: (chunk: string) => void; // stdout callback
  onStderr?: (chunk: string) => void; // stderr callback
}
```

### ExecutionResult

```typescript
interface ExecutionResult {
  success: boolean; // Whether execution succeeded
  taskId: string; // Task ID
  output: ExecutionOutput; // stdout, stderr, exitCode
  error?: ExecutionError; // Error details if failed
  metrics: ExecutionMetrics; // Duration, model, tokens
  attempts: number; // Number of attempts (including retries)
  startedAt: Date; // Start timestamp
  completedAt: Date; // Completion timestamp
}
```

### ExecutionOutput

```typescript
interface ExecutionOutput {
  stdout: string; // Standard output
  stderr: string; // Standard error
  exitCode: number; // Process exit code
  files?: Record<string, string>; // Created/modified files
  artifacts?: Artifact[]; // Produced artifacts
}
```

## Error Handling

All errors extend `ExecutionLayerError`:

```typescript
import {
  ExecutionFailedError,
  ExecutionTimeoutError,
  RetryExhaustedError,
  OpenCodeNotFoundError,
} from "./execution";

try {
  const result = await executor.run({ id: "task-1", instructions: "..." });
} catch (error) {
  if (error instanceof ExecutionTimeoutError) {
    console.log(`Task timed out after ${error.timeoutMs}ms`);
  } else if (error instanceof RetryExhaustedError) {
    console.log(`Retries exhausted after ${error.attempts} attempts`);
    console.log("Last error:", error.lastError);
  } else if (error instanceof OpenCodeNotFoundError) {
    console.log(`OpenCode not found at: ${error.openCodePath}`);
  }
}
```

## Validation

```typescript
const result = await executor.run({ id: "task-1", instructions: "..." });

// Validate output
const validation = await executor.validate(result.output);

if (!validation.valid) {
  console.log("Validation errors:", validation.errors);
  console.log("Warnings:", validation.warnings);
}
```

## Testing

```typescript
import { OpenCodeExecutor } from "./execution";

const executor = new OpenCodeExecutor();

// Run tests on code
const testResult = await executor.test(
  `
function add(a, b) {
  return a + b;
}
`,
  {
    framework: "vitest",
    pattern: "**/*.test.ts",
    coverage: true,
  },
);

console.log("Passed:", testResult.passed);
console.log("Tests:", testResult.passedTests, "/", testResult.totalTests);
```

## Executor Factory (Advanced)

For swapping executor implementations:

```typescript
import { createExecutor, getExecutor, registerDefaultExecutors } from "./execution";

// Register default executors
registerDefaultExecutors();

// Create specific executor type
const executor = createExecutor({ type: "opencode" });

// Or get from registry
const cachedExecutor = getExecutor("opencode");
```

### Future Executor Types

The factory supports pluggable executors:

- `opencode` - Uses OpenCode CLI (current)
- `docker` - Docker-based execution (coming soon)
- `localshell` - Local shell execution (coming soon)

## Rules

1. **Always use CodeExecutor**: Never spawn processes directly in coding agents
2. **Use ProcessSupervisor**: The execution layer internally uses ProcessSupervisor
3. **Handle errors**: Catch `ExecutionLayerError` subclasses appropriately
4. **Set timeouts**: Always set reasonable timeouts for tasks
5. **Use streaming**: For long-running tasks, use `onStdout`/`onStderr` callbacks

## File Structure

```
src/execution/
├── index.ts                 # Public API exports
├── types.ts                 # TypeScript interfaces
├── errors.ts               # Error classes
├── CodeExecutor.ts         # CodeExecutor interface
├── OpenCodeExecutor.ts     # OpenCode implementation
└── README.md              # This file
```

## Migration Guide

If you're migrating from direct shell execution:

**Before:**

```typescript
import { spawn } from "child_process";

const child = spawn("opencode", ["run", "--yes", instructions]);
child.stdout.on("data", (chunk) => process.stdout.write(chunk));
```

**After:**

```typescript
import { OpenCodeExecutor } from "./execution";

const executor = new OpenCodeExecutor();
const result = await executor.run({
  id: "task-1",
  instructions,
  onStdout: (chunk) => process.stdout.write(chunk),
});
```

The new approach provides:

- Automatic retry with exponential backoff
- Proper timeout handling
- Structured results
- Error classification
- Metrics collection
