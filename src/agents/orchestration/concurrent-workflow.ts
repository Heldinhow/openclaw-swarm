import {
  WorkflowTask,
  WorkflowConfig,
  WorkflowContext,
  WorkflowResult,
  DEFAULT_WORKFLOW_CONFIG,
} from "./workflow.js";
import {
  TaskGraph,
  createTaskGraph,
  getTopologicalOrder,
  hasCycles,
} from "./task-graph.js";

export class ConcurrentWorkflow implements Workflow {
  readonly type = "concurrent";
  readonly config: WorkflowConfig;

  constructor(config: Partial<WorkflowConfig> = {}) {
    this.config = { ...DEFAULT_WORKFLOW_CONFIG, ...config };
  }

  validate(tasks: WorkflowTask[]): boolean {
    if (tasks.length === 0) {
      throw new Error("ConcurrentWorkflow requires at least one task");
    }
    if (tasks.length > this.config.maxTasks) {
      throw new Error(
        `Task count ${tasks.length} exceeds maxTasks ${this.config.maxTasks}`
      );
    }

    const graph = createTaskGraph(tasks);
    if (hasCycles(graph)) {
      throw new Error("Task graph contains cycles");
    }

    return true;
  }

  getGraph(tasks: WorkflowTask[]): TaskGraph {
    return createTaskGraph(tasks);
  }

  async execute(ctx: WorkflowContext): Promise<WorkflowResult> {
    const graph = createTaskGraph(ctx.tasks);
    const completedTasks = new Set<string>();
    const results = new Map<string, unknown>();
    const errors = new Map<string, Error>();
    const startTime = Date.now();

    const batches = getTopologicalOrder(graph);

    for (const batch of batches) {
      const batchPromises = batch.map(async (taskId) => {
        const task = ctx.tasks.find((t) => t.id === taskId);
        if (!task) {
          throw new Error(`Task ${taskId} not found`);
        }

        try {
          const result = await this.executeTask(task, ctx);
          results.set(taskId, result);
          completedTasks.add(taskId);
          return result;
        } catch (error) {
          errors.set(taskId, error as Error);

          if (this.config.failureStrategy === "fail-fast") {
            throw error;
          }
        }
      });

      await Promise.all(batchPromises);
    }

    const duration = Date.now() - startTime;
    const allCompleted = errors.size === 0;

    return {
      workflowId: ctx.workflowId,
      status: allCompleted ? "completed" : errors.size > 0 ? "failed" : "pending",
      completedTasks: Array.from(completedTasks),
      failedTasks: Array.from(errors.keys()),
      results,
      errors,
      duration,
    };
  }

  private async executeTask(
    task: WorkflowTask,
    _ctx: WorkflowContext
  ): Promise<unknown> {
    const payload = task.payload;
    await this.delay(10);
    return { taskId: task.id, payload, success: true };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
