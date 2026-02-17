import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as supervisorModule from "../process/supervisor/index.js";
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
});
