import type { WorkflowTask, WorkflowContext, WorkflowResult, WorkflowConfig } from "./workflow.js";
import { DEFAULT_WORKFLOW_CONFIG } from "./workflow.js";
import { createTaskGraph, getReadyTasks, hasCycles } from "./task-graph.js";

export type IterationCondition = (results: Map<string, unknown>, iteration: number) => boolean;

export class IterativeWorkflow {
  readonly type = "iterative" as const;
  readonly config: WorkflowConfig;
  private maxIterations: number;
  private condition: IterationCondition;

  constructor(
    condition: IterationCondition,
    maxIterations: number = 10,
    config?: Partial<WorkflowConfig>
  ) {
    this.config = { ...DEFAULT_WORKFLOW_CONFIG, ...config };
    this.maxIterations = maxIterations;
    this.condition = condition;
  }

  validate(tasks: WorkflowTask[]): void {
    if (tasks.length === 0) {
      throw new Error("IterativeWorkflow requires at least one task");
    }
    if (tasks.length > this.config.maxTasks) {
      throw new Error(`Task count exceeds maxTasks: ${this.config.maxTasks}`);
    }
  }

  async execute(
    tasks: WorkflowTask[],
    executor: (task: WorkflowTask) => Promise<unknown>,
    context: WorkflowContext
  ): Promise<WorkflowResult> {
    this.validate(tasks);
    const graph = createTaskGraph(tasks);

    if (hasCycles(graph)) {
      throw new Error("Task graph contains cycles");
    }

    const allResults = new Map<string, unknown[]>();
    const errors = new Map<string, Error>();
    const startTime = Date.now();
    let iteration = 0;

    while (iteration < this.maxIterations) {
      const results = new Map<string, unknown>();
      const completed = new Set<string>();

      while (completed.size < tasks.length) {
        const ready = getReadyTasks(graph, completed);

        if (ready.length === 0) {
          if (errors.size > 0) {break;}
          continue;
        }

        const batchPromises = ready.map(async (taskId) => {
          const task = tasks.find((t) => t.id === taskId)!;
          try {
            const result = await executor(task);
            results.set(taskId, result);
            completed.add(taskId);
          } catch (error) {
            errors.set(taskId, error as Error);
            completed.add(taskId);
          }
        });

        await Promise.all(batchPromises);
      }

      for (const [taskId, result] of results) {
        if (!allResults.has(taskId)) {
          allResults.set(taskId, []);
        }
        allResults.get(taskId)!.push(result);
      }

      iteration++;

      if (!this.condition(allResults, iteration)) {
        break;
      }
    }

    const completedTasks = Array.from(allResults.keys());
    const status = errors.size === 0 ? "completed" : errors.size === tasks.length ? "failed" : "partial";

    return {
      workflowId: context.workflowId,
      status,
      completedTasks,
      failedTasks: Array.from(errors.keys()),
      results: allResults,
      errors,
      duration: Date.now() - startTime,
    };
  }
}
