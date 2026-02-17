import { describe, it, expect } from "vitest";
import {
  DEFAULT_WORKFLOW_CONFIG,
  createDefaultWorkflowConfig,
  createWorkflowResult,
  type WorkflowType,
} from "./workflow.js";

describe("Workflow Types", () => {
  describe("DEFAULT_WORKFLOW_CONFIG", () => {
    it("should have correct default values", () => {
      expect(DEFAULT_WORKFLOW_CONFIG.maxTasks).toBe(50);
      expect(DEFAULT_WORKFLOW_CONFIG.maxNestingDepth).toBe(5);
      expect(DEFAULT_WORKFLOW_CONFIG.defaultTimeout).toBe(300000);
      expect(DEFAULT_WORKFLOW_CONFIG.failureStrategy).toBe("fail-fast");
      expect(DEFAULT_WORKFLOW_CONFIG.maxRetries).toBe(0);
    });
  });

  describe("createDefaultWorkflowConfig", () => {
    it("should return defaults when no overrides", () => {
      const config = createDefaultWorkflowConfig();
      expect(config).toEqual(DEFAULT_WORKFLOW_CONFIG);
    });

    it("should merge overrides correctly", () => {
      const config = createDefaultWorkflowConfig({
        maxTasks: 100,
        failureStrategy: "continue-others",
      });
      expect(config.maxTasks).toBe(100);
      expect(config.failureStrategy).toBe("continue-others");
      expect(config.maxNestingDepth).toBe(DEFAULT_WORKFLOW_CONFIG.maxNestingDepth);
    });
  });

  describe("createWorkflowResult", () => {
    it("should create successful result", () => {
      const outputs = new Map<string, unknown>([["task1", "result1"]]);
      const errors = new Map<string, Error>();
      const timings = {
        startedAt: new Date("2026-01-01T00:00:00Z"),
        completedAt: new Date("2026-01-01T00:01:00Z"),
        totalDurationMs: 60000,
        taskDurations: new Map([["task1", 60000]]),
      };

      const result = createWorkflowResult(
        "concurrent" as WorkflowType,
        1,
        outputs,
        errors,
        timings,
      );

      expect(result.success).toBe(true);
      expect(result.metadata.workflowType).toBe("concurrent");
      expect(result.metadata.taskCount).toBe(1);
      expect(result.metadata.completedCount).toBe(1);
      expect(result.metadata.failedCount).toBe(0);
    });

    it("should create failed result", () => {
      const outputs = new Map<string, unknown>();
      const errors = new Map<string, Error>([["task1", new Error("Failed")]]);
      const timings = {
        startedAt: new Date("2026-01-01T00:00:00Z"),
        completedAt: new Date("2026-01-01T00:01:00Z"),
        totalDurationMs: 60000,
        taskDurations: new Map([["task1", 60000]]),
      };

      const result = createWorkflowResult("pipeline" as WorkflowType, 1, outputs, errors, timings);

      expect(result.success).toBe(false);
      expect(result.metadata.completedCount).toBe(0);
      expect(result.metadata.failedCount).toBe(1);
    });
  });
});
