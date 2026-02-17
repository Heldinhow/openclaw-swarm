import { EventType, EventStatus } from "./event-bus.js";
import { TaskGraph as TaskGraphImpl } from "./task-graph.js";
import {
  type Task,
  type TaskContext,
  type Workflow,
  type WorkflowConfig,
  type WorkflowResult,
  type WorkflowType,
  type TaskGraph,
  createDefaultWorkflowConfig,
  createWorkflowResult,
} from "./workflow.js";

export interface IterativeWorkflowConfig extends WorkflowConfig {
  maxIterations: number;
  stopOnSuccess?: boolean;
  until?: (results: Map<string, unknown>) => boolean;
}

export class IterativeWorkflow<T = unknown> implements Workflow {
  readonly type: WorkflowType = "iterative";

  private tasks: Task<T>[];
  private config: IterativeWorkflowConfig;

  constructor(config: IterativeWorkflowConfig, tasks: Task<T>[]) {
    this.config = {
      ...createDefaultWorkflowConfig(config),
      maxIterations: config.maxIterations,
      stopOnSuccess: config.stopOnSuccess ?? false,
      until: config.until,
    };
    this.tasks = tasks;
  }

  validate(): void {
    if (this.tasks.length === 0) {
      throw new Error("IterativeWorkflow requires at least 1 task");
    }
    if (this.tasks.length > this.config.maxTasks) {
      throw new Error(
        `IterativeWorkflow exceeds max tasks: ${this.tasks.length} > ${this.config.maxTasks}`,
      );
    }
    if (this.config.maxIterations <= 0) {
      throw new Error("maxIterations must be greater than 0");
    }

    const taskIds = new Set<string>();
    for (const task of this.tasks) {
      if (taskIds.has(task.id)) {
        throw new Error(`Duplicate task ID: ${task.id}`);
      }
      taskIds.add(task.id);
    }
  }

  getGraph(): TaskGraph {
    const graph = new TaskGraphImpl();
    for (const task of this.tasks) {
      graph.addTask(task as Task);
    }
    return graph;
  }

  async execute(context: TaskContext): Promise<WorkflowResult> {
    this.validate();

    const startedAt = new Date();
    const outputs = new Map<string, unknown>();
    const errors = new Map<string, Error>();
    const taskDurations = new Map<string, number>();

    let iteration = 0;
    let successAtIteration: number | undefined;

    while (iteration < this.config.maxIterations) {
      iteration++;
      const iterationOutputs = new Map<string, unknown>();
      const iterationErrors = new Map<string, Error>();

      this.publishEvent(context, "iteration_start", {
        workflowId: context.sessionKey,
        iteration,
        maxIterations: this.config.maxIterations,
      });

      for (const task of this.tasks) {
        const taskStartTime = Date.now();

        try {
          this.publishEvent(context, "task_start", {
            taskId: task.id,
            workflowId: context.sessionKey,
            iteration,
          });

          let result: unknown;
          if (task.handler) {
            result = await this.executeWithTimeout(
              task.handler(task.payload, {
                ...context,
                sharedStore: context.sharedStore,
              }),
              task.timeout ?? context.config.defaultTimeout,
            );
          } else {
            result = task.payload;
          }

          const duration = Date.now() - taskStartTime;
          taskDurations.set(`${task.id}_${iteration}`, duration);
          iterationOutputs.set(task.id, result);

          this.publishEvent(context, "task_complete", {
            taskId: task.id,
            workflowId: context.sessionKey,
            duration,
            success: true,
            result,
            iteration,
          });
        } catch (error) {
          const duration = Date.now() - taskStartTime;
          taskDurations.set(`${task.id}_${iteration}`, duration);

          const err = error instanceof Error ? error : new Error(String(error));
          iterationErrors.set(task.id, err);

          this.publishEvent(context, "task_error", {
            taskId: task.id,
            workflowId: context.sessionKey,
            duration,
            error: err.message,
            iteration,
          });
        }
      }

      for (const [key, value] of iterationOutputs) {
        outputs.set(`${key}_${iteration}`, value);
      }
      for (const [key, value] of iterationErrors) {
        errors.set(`${key}_${iteration}`, value);
      }

      if (iterationErrors.size === 0 && this.config.stopOnSuccess) {
        successAtIteration = iteration;
        break;
      }

      if (this.config.until && this.config.until(iterationOutputs)) {
        successAtIteration = iteration;
        break;
      }

      this.publishEvent(context, "iteration_complete", {
        workflowId: context.sessionKey,
        iteration,
        success: iterationErrors.size === 0,
      });
    }

    const completedAt = new Date();
    const totalDurationMs = completedAt.getTime() - startedAt.getTime();

    const timings = {
      startedAt,
      completedAt,
      totalDurationMs,
      taskDurations,
    };

    const success = errors.size === 0 && successAtIteration !== undefined;

    this.publishEvent(context, "workflow_complete", {
      workflowId: context.sessionKey,
      workflowType: this.type,
      taskCount: this.tasks.length * iteration,
      completedCount: outputs.size,
      failedCount: errors.size,
      iterations: iteration,
      successAtIteration,
      success,
    });

    return createWorkflowResult(this.type, this.tasks.length * iteration, outputs, errors, timings);
  }

  private async executeWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout>;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Task timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId!);
    }
  }

  private publishEvent(
    context: TaskContext,
    eventType: string,
    data: Record<string, unknown>,
  ): void {
    try {
      void context.eventBus.publish({
        agent_id: context.sessionKey,
        task_id: (data.taskId as string) ?? "workflow",
        event_type: eventType as EventType,
        status: EventStatus.RUNNING,
        timestamp: Date.now(),
        payload: data,
      });
    } catch {
      // Event publishing should not break workflow execution
    }
  }
}
