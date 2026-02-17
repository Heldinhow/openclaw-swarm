import type { EventBus } from "./event-bus.js";
import type { SharedContextStore } from "./shared-context-store.js";
import type { SwarmController } from "./swarm-controller.js";

export type WorkflowType = string;

export interface WorkflowConfig {
  maxTasks: number;
  maxNestingDepth: number;
  defaultTimeout: number;
  failureStrategy: "fail-fast" | "continue-others" | "retry";
  maxRetries: number;
}

export const DEFAULT_WORKFLOW_CONFIG: WorkflowConfig = {
  maxTasks: 50,
  maxNestingDepth: 5,
  defaultTimeout: 300000,
  failureStrategy: "fail-fast",
  maxRetries: 0,
};

export interface Task<T = unknown> {
  id: string;
  payload: T;
  dependencies: string[];
  handler?: TaskHandler<T>;
  timeout?: number;
  retries?: number;
}

export type TaskHandler<T> = (payload: T, context: TaskContext) => Promise<unknown>;

export interface TaskContext {
  sessionKey: string;
  namespace: string;
  sharedStore: SharedContextStore;
  eventBus: EventBus;
  swarmController: SwarmController;
  config: WorkflowConfig;
}

export interface WorkflowTimings {
  startedAt: Date;
  completedAt: Date;
  totalDurationMs: number;
  taskDurations: Map<string, number>;
}

export interface WorkflowMetadata {
  workflowType: WorkflowType;
  taskCount: number;
  completedCount: number;
  failedCount: number;
}

export interface WorkflowResult {
  success: boolean;
  outputs: Map<string, unknown>;
  errors: Map<string, Error>;
  timings: WorkflowTimings;
  metadata: WorkflowMetadata;
}

export interface Workflow {
  readonly type: WorkflowType;
  validate(): void;
  getGraph(): TaskGraph;
  execute(context: TaskContext): Promise<WorkflowResult>;
}

export interface TaskGraph<T = unknown> {
  addTask(task: Task<T>): void;
  addDependency(taskId: string, dependsOn: string): void;
  detectCycles(): string[] | null;
  getExecutionOrder(): string[];
  getReadyTasks(completed: Set<string>): string[];
  getTask(taskId: string): Task<T> | undefined;
  getAllTasks(): Task<T>[];
}

export function createDefaultWorkflowConfig(overrides?: Partial<WorkflowConfig>): WorkflowConfig {
  return {
    ...DEFAULT_WORKFLOW_CONFIG,
    ...overrides,
  };
}

export function createWorkflowResult(
  workflowType: WorkflowType,
  taskCount: number,
  outputs: Map<string, unknown>,
  errors: Map<string, Error>,
  timings: WorkflowTimings,
): WorkflowResult {
  const completedCount = outputs.size;
  const failedCount = errors.size;
  const success = failedCount === 0 && completedCount === taskCount;

  return {
    success,
    outputs,
    errors,
    timings,
    metadata: {
      workflowType,
      taskCount,
      completedCount,
      failedCount,
    },
  };
}
