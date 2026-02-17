export type TaskType = "research" | "refactor" | "coding" | "custom" | "unknown";

export type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface TaskPayload {
  [key: string]: unknown;
}

export interface WorkflowTask {
  id: string;
  type?: TaskType;
  payload: TaskPayload;
  dependencies?: string[];
  timeout?: number;
  retries?: number;
  metadata?: Record<string, unknown>;
}

export interface WorkflowConfig {
  maxTasks: number;
  maxNestingDepth: number;
  defaultTimeout: number;
  failureStrategy: "fail-fast" | "continue-others" | "retry";
  maxRetries: number;
}

export interface WorkflowResult {
  workflowId: string;
  status: TaskStatus;
  completedTasks: string[];
  failedTasks: string[];
  results: Map<string, unknown>;
  errors: Map<string, Error>;
  duration: number;
}

export interface WorkflowContext {
  workflowId: string;
  config: WorkflowConfig;
  tasks: WorkflowTask[];
  results: Map<string, unknown>;
  errors: Map<string, Error>;
  startTime: number;
  eventBus?: EventBus;
}

export interface Workflow {
  readonly type: string;
  readonly config: WorkflowConfig;

  validate(tasks: WorkflowTask[]): boolean;
  getGraph(tasks: WorkflowTask[]): TaskGraph;
  execute(ctx: WorkflowContext): Promise<WorkflowResult>;
}

export interface WorkflowExecutor {
  (tasks: WorkflowTask[], ctx: WorkflowContext): Promise<Map<string, unknown>>;
}

export const DEFAULT_WORKFLOW_CONFIG: WorkflowConfig = {
  maxTasks: 50,
  maxNestingDepth: 5,
  defaultTimeout: 300000,
  failureStrategy: "fail-fast",
  maxRetries: 0,
};

export function createWorkflowContext(
  workflowId: string,
  tasks: WorkflowTask[],
  config: WorkflowConfig = DEFAULT_WORKFLOW_CONFIG,
  eventBus?: EventBus
): WorkflowContext {
  return {
    workflowId,
    config,
    tasks,
    results: new Map(),
    errors: new Map(),
    startTime: Date.now(),
    eventBus,
  };
}

export async function publishWorkflowEvent(
  eventBus: EventBus,
  eventType: EventType,
  status: EventStatus,
  data: Record<string, unknown>
): Promise<void> {
  const event: SwarmEvent = {
    id: `workflow-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: eventType,
    status,
    timestamp: Date.now(),
    data,
  };
  await eventBus.publish(event);
}
