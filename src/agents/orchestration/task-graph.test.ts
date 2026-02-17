import { describe, it, expect, beforeEach } from "vitest";
import { TaskGraph } from "./task-graph.js";

describe("TaskGraph", () => {
  let graph: TaskGraph;

  beforeEach(() => {
    graph = new TaskGraph();
  });

  describe("addTask", () => {
    it("should add a task to the graph", () => {
      graph.addTask({ id: "task1", payload: {}, dependencies: [] });
      expect(graph.getTask("task1")).toBeDefined();
      expect(graph.getTaskCount()).toBe(1);
    });

    it("should throw when adding duplicate task", () => {
      graph.addTask({ id: "task1", payload: {}, dependencies: [] });
      expect(() => {
        graph.addTask({ id: "task1", payload: {}, dependencies: [] });
      }).toThrow("Task task1 already exists");
    });

    it("should track dependencies", () => {
      graph.addTask({
        id: "task2",
        payload: {},
        dependencies: ["task1"],
      });
      const task = graph.getTask("task2");
      expect(task?.dependencies).toContain("task1");
    });
  });

  describe("addDependency", () => {
    it("should add dependency between tasks", () => {
      graph.addTask({ id: "task1", payload: {}, dependencies: [] });
      graph.addTask({ id: "task2", payload: {}, dependencies: [] });
      graph.addDependency("task2", "task1");

      const task2 = graph.getTask("task2");
      expect(task2?.dependencies).toContain("task1");
    });

    it("should throw when task not found", () => {
      graph.addTask({ id: "task1", payload: {}, dependencies: [] });
      expect(() => {
        graph.addDependency("task2", "task1");
      }).toThrow("Task task2 not found");
    });

    it("should throw when dependency not found", () => {
      graph.addTask({ id: "task1", payload: {}, dependencies: [] });
      graph.addTask({ id: "task2", payload: {}, dependencies: [] });
      expect(() => {
        graph.addDependency("task2", "task3");
      }).toThrow("Dependency task3 not found");
    });
  });

  describe("detectCycles", () => {
    it("should return null for acyclic graph", () => {
      graph.addTask({ id: "task1", payload: {}, dependencies: [] });
      graph.addTask({ id: "task2", payload: {}, dependencies: ["task1"] });
      graph.addTask({ id: "task3", payload: {}, dependencies: ["task2"] });

      expect(graph.detectCycles()).toBeNull();
    });

    it("should detect cycle", () => {
      graph.addTask({ id: "task1", payload: {}, dependencies: [] });
      graph.addTask({ id: "task2", payload: {}, dependencies: ["task1"] });
      graph.addTask({ id: "task3", payload: {}, dependencies: ["task2"] });
      graph.addDependency("task1", "task3");

      const cycle = graph.detectCycles();
      expect(cycle).not.toBeNull();
    });

    it("should detect self-cycle", () => {
      graph.addTask({ id: "task1", payload: {}, dependencies: ["task1"] });

      const cycle = graph.detectCycles();
      expect(cycle).not.toBeNull();
    });
  });

  describe("getExecutionOrder", () => {
    it("should return correct topological order", () => {
      graph.addTask({ id: "a", payload: {}, dependencies: [] });
      graph.addTask({ id: "b", payload: {}, dependencies: ["a"] });
      graph.addTask({ id: "c", payload: {}, dependencies: ["b"] });

      const order = graph.getExecutionOrder();
      expect(order).toEqual(["a", "b", "c"]);
    });

    it("should handle parallel tasks", () => {
      graph.addTask({ id: "a", payload: {}, dependencies: [] });
      graph.addTask({ id: "b", payload: {}, dependencies: [] });
      graph.addTask({ id: "c", payload: {}, dependencies: ["a", "b"] });

      const order = graph.getExecutionOrder();
      expect(order.indexOf("c")).toBeGreaterThan(order.indexOf("a"));
      expect(order.indexOf("c")).toBeGreaterThan(order.indexOf("b"));
    });

    it("should throw on cycle", () => {
      graph.addTask({ id: "task1", payload: {}, dependencies: [] });
      graph.addTask({ id: "task2", payload: {}, dependencies: ["task1"] });
      graph.addDependency("task1", "task2");

      expect(() => {
        graph.getExecutionOrder();
      }).toThrow("cycle detected");
    });
  });

  describe("getReadyTasks", () => {
    it("should return tasks with no dependencies when nothing completed", () => {
      graph.addTask({ id: "task1", payload: {}, dependencies: [] });
      graph.addTask({ id: "task2", payload: {}, dependencies: [] });

      const ready = graph.getReadyTasks(new Set());
      expect(ready).toContain("task1");
      expect(ready).toContain("task2");
    });

    it("should return tasks with satisfied dependencies", () => {
      graph.addTask({ id: "task1", payload: {}, dependencies: [] });
      graph.addTask({ id: "task2", payload: {}, dependencies: ["task1"] });

      const ready = graph.getReadyTasks(new Set(["task1"]));
      expect(ready).toContain("task2");
    });

    it("should not return completed tasks", () => {
      graph.addTask({ id: "task1", payload: {}, dependencies: [] });
      graph.addTask({ id: "task2", payload: {}, dependencies: [] });

      const ready = graph.getReadyTasks(new Set(["task1", "task2"]));
      expect(ready).toHaveLength(0);
    });
  });

  describe("getAllTasks", () => {
    it("should return all tasks", () => {
      graph.addTask({ id: "task1", payload: { value: 1 }, dependencies: [] });
      graph.addTask({ id: "task2", payload: { value: 2 }, dependencies: [] });

      const tasks = graph.getAllTasks();
      expect(tasks).toHaveLength(2);
      expect(tasks.map((t) => t.id)).toEqual(["task1", "task2"]);
    });
  });

  describe("clear", () => {
    it("should remove all tasks", () => {
      graph.addTask({ id: "task1", payload: {}, dependencies: [] });
      graph.addTask({ id: "task2", payload: {}, dependencies: [] });

      graph.clear();

      expect(graph.getTaskCount()).toBe(0);
    });
  });
});
