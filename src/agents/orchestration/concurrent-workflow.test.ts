import { describe, it, expect, beforeEach, vi } from "vitest";
import type { TaskContext } from "./workflow.js";
import { ConcurrentWorkflow } from "./concurrent-workflow.js";
import { EventBus } from "./event-bus.js";
import { SharedContextStore } from "./shared-context-store.js";
import { SwarmController } from "./swarm-controller.js";

describe("ConcurrentWorkflow", () => {
  let workflow: ConcurrentWorkflow<{ value: number }>;
  let mockContext: TaskContext;

  beforeEach(() => {
    const eventBus = new EventBus();
    const eventLog = {
      log: vi.fn(),
      query: vi.fn().mockResolvedValue([]),
      clear: vi.fn(),
    };
    const swarmController = new SwarmController(eventBus, eventLog as never);
    const sharedStore = new SharedContextStore();

    mockContext = {
      sessionKey: "test-session",
      namespace: "test",
      sharedStore,
      eventBus,
      swarmController,
      config: {
        maxTasks: 50,
        maxNestingDepth: 5,
        defaultTimeout: 5000,
        failureStrategy: "fail-fast",
        maxRetries: 0,
      },
    };
  });

  describe("validate", () => {
    it("should throw for empty task list", () => {
      workflow = new ConcurrentWorkflow([]);
      expect(() => workflow.validate()).toThrow("ConcurrentWorkflow requires at least 1 task");
    });

    it("should throw when exceeding maxTasks", () => {
      const tasks = Array.from({ length: 51 }, (_, i) => ({
        id: `task${i}`,
        payload: { value: i },
        dependencies: [],
      }));
      workflow = new ConcurrentWorkflow(tasks, { maxTasks: 50 });
      expect(() => workflow.validate()).toThrow("exceeds max tasks");
    });

    it("should throw for duplicate task IDs", () => {
      workflow = new ConcurrentWorkflow([
        { id: "task1", payload: { value: 1 }, dependencies: [] },
        { id: "task1", payload: { value: 2 }, dependencies: [] },
      ]);
      expect(() => workflow.validate()).toThrow("Duplicate task ID");
    });

    it("should throw for undefined dependencies", () => {
      workflow = new ConcurrentWorkflow([
        { id: "task1", payload: { value: 1 }, dependencies: ["task2"] },
      ]);
      expect(() => workflow.validate()).toThrow("not defined");
    });
  });

  describe("execute", () => {
    it("should execute all tasks in parallel", async () => {
      const startTime = Date.now();
      let task1Start = 0;
      let task2Start = 0;

      workflow = new ConcurrentWorkflow([
        {
          id: "task1",
          payload: { value: 1 },
          dependencies: [],
          handler: async () => {
            task1Start = Date.now();
            await new Promise((r) => setTimeout(r, 100));
            return "result1";
          },
        },
        {
          id: "task2",
          payload: { value: 2 },
          dependencies: [],
          handler: async () => {
            task2Start = Date.now();
            await new Promise((r) => setTimeout(r, 100));
            return "result2";
          },
        },
      ]);

      const result = await workflow.execute(mockContext);

      expect(result.success).toBe(true);
      expect(result.outputs.size).toBe(2);
      expect(result.outputs.get("task1")).toBe("result1");
      expect(result.outputs.get("task2")).toBe("result2");

      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeLessThan(200);
      expect(Math.abs(task1Start - task2Start)).toBeLessThan(50);
    });

    it("should handle task failures", async () => {
      workflow = new ConcurrentWorkflow([
        {
          id: "task1",
          payload: { value: 1 },
          dependencies: [],
          handler: async () => {
            throw new Error("Task failed");
          },
        },
        {
          id: "task2",
          payload: { value: 2 },
          dependencies: [],
          handler: async () => "result2",
        },
      ]);

      const result = await workflow.execute(mockContext);

      expect(result.success).toBe(false);
      expect(result.errors.size).toBe(1);
      expect(result.outputs.size).toBe(1);
      expect(result.outputs.get("task2")).toBe("result2");
    });

    it("should respect fail-fast strategy", async () => {
      workflow = new ConcurrentWorkflow(
        [
          {
            id: "task1",
            payload: { value: 1 },
            dependencies: [],
            handler: async () => {
              await new Promise((r) => setTimeout(r, 50));
              throw new Error("Task failed");
            },
          },
          {
            id: "task2",
            payload: { value: 2 },
            dependencies: [],
            handler: async () => "result2",
          },
        ],
        { failureStrategy: "fail-fast" },
      );

      const result = await workflow.execute(mockContext);

      expect(result.success).toBe(false);
    });

    it("should use task payload when no handler", async () => {
      workflow = new ConcurrentWorkflow([
        { id: "task1", payload: { value: 42 }, dependencies: [] },
      ]);

      const result = await workflow.execute(mockContext);

      expect(result.success).toBe(true);
      expect(result.outputs.get("task1")).toEqual({ value: 42 });
    });
  });

  describe("getGraph", () => {
    it("should return a TaskGraph with all tasks", () => {
      workflow = new ConcurrentWorkflow([
        { id: "task1", payload: { value: 1 }, dependencies: [] },
        { id: "task2", payload: { value: 2 }, dependencies: [] },
      ]);

      const graph = workflow.getGraph();

      expect(graph.getAllTasks()).toHaveLength(2);
      expect(graph.getTask("task1")).toBeDefined();
      expect(graph.getTask("task2")).toBeDefined();
    });
  });
});
