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

export class ConcurrentWorkflow<T = unknown> implements Workflow {
  readonly type: WorkflowType = "concurrent";

  private tasks: Task<T>[];
  private config: WorkflowConfig;

  constructor(tasks: Task<T>[], config?: Partial<WorkflowConfig>) {
    this.tasks = tasks;
    this.config = createDefaultWorkflowConfig(config);
  }

  validate(): void {
    if (this.tasks.length === 0) {
      throw new Error("ConcurrentWorkflow requires at least 1 task");
    }
    if (this.tasks.length > this.config.maxTasks) {
      throw new Error(
        `ConcurrentWorkflow exceeds max tasks: ${this.tasks.length} > ${this.config.maxTasks}`,
      );
    }

    const taskIds = new Set<string>();
    for (const task of this.tasks) {
      if (taskIds.has(task.id)) {
        throw new Error(`Duplicate task ID: ${task.id}`);
      }
      taskIds.add(task.id);

      for (const dep of task.dependencies) {
        if (!taskIds.has(dep)) {
          throw new Error(`Task ${task.id} depends on ${dep} which is not defined`);
        }
      }
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

    const taskPromises = this.tasks.map(async (task) => {
      const taskStartTime = Date.now();

      try {
        this.publishEvent(context, "task_start", {
          taskId: task.id,
          workflowId: context.sessionKey,
        });

        let result: unknown;
        if (task.handler) {
          result = await this.executeWithTimeout(
            task.handler(task.payload, context),
            task.timeout ?? context.config.defaultTimeout,
          );
        } else {
          result = task.payload;
        }

        const duration = Date.now() - taskStartTime;
        taskDurations.set(task.id, duration);

        outputs.set(task.id, result);

        this.publishEvent(context, "task_complete", {
          taskId: task.id,
          workflowId: context.sessionKey,
          duration,
          success: true,
          result,
        });

        return { taskId: task.id, success: true, result };
      } catch (error) {
        const duration = Date.now() - taskStartTime;
        taskDurations.set(task.id, duration);

        const err = error instanceof Error ? error : new Error(String(error));
        errors.set(task.id, err);

        this.publishEvent(context, "task_error", {
          taskId: task.id,
          workflowId: context.sessionKey,
          duration,
          error: err.message,
        });

        if (context.config.failureStrategy === "fail-fast") {
          return { taskId: task.id, success: false, error: err };
        }

        return { taskId: task.id, success: false, error: err };
      }
    });

    await Promise.all(taskPromises);

    const completedAt = new Date();
    const totalDurationMs = completedAt.getTime() - startedAt.getTime();

    const timings = {
      startedAt,
      completedAt,
      totalDurationMs,
      taskDurations,
    };

    this.publishEvent(context, "workflow_complete", {
      workflowId: context.sessionKey,
      workflowType: this.type,
      taskCount: this.tasks.length,
      completedCount: outputs.size,
      failedCount: errors.size,
      success: errors.size === 0,
    });

    return createWorkflowResult(this.type, this.tasks.length, outputs, errors, timings);
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
