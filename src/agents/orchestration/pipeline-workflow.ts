import type { WorkflowTask, WorkflowContext, WorkflowResult, WorkflowConfig } from "./workflow.js";
import { DEFAULT_WORKFLOW_CONFIG } from "./workflow.js";
import { createTaskGraph, getReadyTasks, hasCycles } from "./task-graph.js";

export class PipelineWorkflow {
  readonly type = "pipeline" as const;
  readonly config: WorkflowConfig;

  constructor(config: Partial<WorkflowConfig> = {}) {
    this.config = { ...DEFAULT_WORKFLOW_CONFIG, ...config };
  }

  validate(tasks: WorkflowTask[]): void {
    if (tasks.length === 0) {
      throw new Error("PipelineWorkflow requires at least one task");
    }
    if (tasks.length > this.config.maxTasks) {
      throw new Error(`Task count exceeds maxTasks: ${this.config.maxTasks}`);
    }
  }

  getExecutionOrder(tasks: WorkflowTask[]): string[][] {
    const graph = createTaskGraph(tasks);
    if (hasCycles(graph)) {
      throw new Error("Task graph contains cycles");
    }
    const order: string[][] = [];
    const completed = new Set<string>();

    while (completed.size < tasks.length) {
      const ready = getReadyTasks(graph, completed);
      if (ready.length === 0 && completed.size < tasks.length) {
        throw new Error("No ready tasks but not all completed");
      }
      order.push(ready);
      ready.forEach((id) => completed.add(id));
    }

    return order;
  }

  async execute(
    tasks: WorkflowTask[],
    executor: (task: WorkflowTask, previousResults: Map<string, unknown>) => Promise<unknown>,
    context: WorkflowContext
  ): Promise<WorkflowResult> {
    this.validate(tasks);
    const graph = createTaskGraph(tasks);

    if (hasCycles(graph)) {
      throw new Error("Task graph contains cycles");
    }

    const results = new Map<string, unknown>();
    const errors = new Map<string, Error>();
    const completed = new Set<string>();
    const startTime = Date.now();

    while (completed.size < tasks.length) {
      const ready = getReadyTasks(graph, completed);

      if (ready.length === 0) {
        if (errors.size > 0) {break;}
        continue;
      }

      for (const taskId of ready) {
        const task = tasks.find((t) => t.id === taskId)!;
        try {
          const result = await executor(task, results);
          results.set(taskId, result);
          completed.add(taskId);
        } catch (error) {
          errors.set(taskId, error as Error);
          completed.add(taskId);

          if (this.config.failureStrategy === "fail-fast") {
            break;
          }
        }
      }

      if (this.config.failureStrategy === "fail-fast" && errors.size > 0) {
        break;
      }
    }

    const status = errors.size === 0 ? "completed" : errors.size === tasks.length ? "failed" : "partial";

    return {
      workflowId: context.workflowId,
      status,
      completedTasks: Array.from(completed),
      failedTasks: Array.from(errors.keys()),
      results,
      errors,
      duration: Date.now() - startTime,
    };
  }
}
