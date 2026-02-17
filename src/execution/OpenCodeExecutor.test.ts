import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as supervisorModule from "../process/supervisor/index.js";
import { RetryExhaustedError } from "./errors.js";
import { OpenCodeExecutor } from "./OpenCodeExecutor.js";

describe("OpenCodeExecutor", () => {
  let mockSupervisor: { spawn: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockSupervisor = {
      spawn: vi.fn().mockResolvedValue({
        wait: vi.fn().mockResolvedValue({
          exitCode: 0,
          stdout: "success output",
          stderr: "",
          reason: "exit",
          durationMs: 100,
          timedOut: false,
          noOutputTimedOut: false,
          exitSignal: null,
        }),
        cancel: vi.fn(),
      }),
    };
    vi.spyOn(supervisorModule, "getProcessSupervisor").mockReturnValue(
      mockSupervisor as unknown as typeof supervisorModule.getProcessSupervisor extends () => infer R
        ? R
        : never,
    );
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

  it("should throw ExecutionTimeoutError when result.timedOut is true", async () => {
    mockSupervisor.spawn.mockResolvedValue({
      wait: vi.fn().mockResolvedValue({
        exitCode: -1,
        stdout: "",
        stderr: "",
        reason: "timeout",
        durationMs: 5000,
        timedOut: true,
        noOutputTimedOut: false,
        exitSignal: null,
      }),
      cancel: vi.fn(),
    });

    const executor = new OpenCodeExecutor({
      defaultRetry: { maxAttempts: 1, initialDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1 },
    });

    await expect(
      executor.run({
        id: "timeout-task",
        instructions: "long running task",
        timeout: 5000,
      }),
    ).rejects.toThrow(RetryExhaustedError);

    try {
      await executor.run({
        id: "timeout-task",
        instructions: "long running task",
        timeout: 5000,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(RetryExhaustedError);
      expect((error as RetryExhaustedError).lastError.code).toBe("EXECUTION_TIMEOUT");
      expect((error as RetryExhaustedError).lastError.details.taskId).toBe("timeout-task");
      expect((error as RetryExhaustedError).lastError.details.timeoutMs).toBe(5000);
    }
  });

  it("should handle non-zero exit code without throwing", async () => {
    mockSupervisor.spawn.mockResolvedValue({
      wait: vi.fn().mockResolvedValue({
        exitCode: 1,
        stdout: "error output",
        stderr: "error message",
        reason: "exit",
        durationMs: 100,
        timedOut: false,
        noOutputTimedOut: false,
        exitSignal: null,
      }),
      cancel: vi.fn(),
    });

    const executor = new OpenCodeExecutor();

    const result = await executor.run({
      id: "error-task",
      instructions: "failing command",
    });

    expect(result.success).toBe(true);
    expect(result.output.exitCode).toBe(1);
    expect(result.output.stdout).toBe("error output");
    expect(result.output.stderr).toBe("error message");
  });

  it("should throw ExecutionFailedError on spawn failure", async () => {
    mockSupervisor.spawn.mockRejectedValue(new Error("spawn failed"));

    const executor = new OpenCodeExecutor({
      defaultRetry: { maxAttempts: 1, initialDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1 },
    });

    await expect(
      executor.run({
        id: "spawn-fail-task",
        instructions: "command",
      }),
    ).rejects.toThrow(RetryExhaustedError);

    try {
      await executor.run({
        id: "spawn-fail-task",
        instructions: "command",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(RetryExhaustedError);
      expect((error as RetryExhaustedError).lastError.code).toBe("EXECUTION_FAILED");
      expect((error as RetryExhaustedError).lastError.details.taskId).toBe("spawn-fail-task");
    }
  });

  it("should pass streaming callbacks to supervisor spawn options", async () => {
    const onStdout = vi.fn();
    const onStderr = vi.fn();

    mockSupervisor.spawn.mockResolvedValue({
      wait: vi.fn().mockResolvedValue({
        exitCode: 0,
        stdout: "",
        stderr: "",
        reason: "exit",
        durationMs: 100,
        timedOut: false,
        noOutputTimedOut: false,
        exitSignal: null,
      }),
      cancel: vi.fn(),
    });

    const executor = new OpenCodeExecutor();

    await executor.run({
      id: "streaming-task",
      instructions: "echo hello",
      onStdout,
      onStderr,
    });

    expect(mockSupervisor.spawn).toHaveBeenCalledWith(
      expect.objectContaining({
        onStdout: expect.any(Function),
        onStderr: expect.any(Function),
      }),
    );
  });
});
