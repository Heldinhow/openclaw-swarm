# API Contracts: Swarm Workflow Patterns

> Note: These are TypeScript interface contracts, not HTTP/REST APIs.

## Core Interfaces

### Workflow Interface

```typescript
interface Workflow {
  readonly type: string;
  validate(): void;
  getGraph(): TaskGraph;
  execute(context: TaskContext): Promise<WorkflowResult>;
}
```

### TaskGraph Interface

```typescript
interface TaskGraph<T = unknown> {
  addTask(task: Task<T>): void;
  addDependency(taskId: string, dependsOn: string): void;
  detectCycles(): string[] | null;
  getExecutionOrder(): string[];
  getReadyTasks(completed: Set<string>): string[];
  getTask(taskId: string): Task<T> | undefined;
  getAllTasks(): Task<T>[];
}
```

### WorkflowResult Interface

```typescript
interface WorkflowResult {
  success: boolean;
  outputs: Map<string, unknown>;
  errors: Map<string, Error>;
  timings: WorkflowTimings;
  metadata: WorkflowMetadata;
}
```

---

## Concrete Workflow Contracts

### ConcurrentWorkflow

```typescript
class ConcurrentWorkflow<T = unknown> implements Workflow {
  readonly type = "concurrent";

  constructor(tasks: Task<T>[], config?: Partial<WorkflowConfig>);

  validate(): void; // Must have ≥1 task
  getGraph(): TaskGraph;
  execute(context: TaskContext): Promise<WorkflowResult>;
}
```

### PipelineWorkflow

```typescript
class PipelineWorkflow<T = unknown> implements Workflow {
  readonly type = "pipeline";

  constructor(tasks: Task<T>[], config?: Partial<WorkflowConfig>);

  validate(): void; // Must have ≥1 task, no cycles
  getGraph(): TaskGraph;
  execute(context: TaskContext): Promise<WorkflowResult>;
  // Output of task N → Input of task N+1 via context
}
```

### IterativeWorkflow

```typescript
interface IterativeWorkflowConfig extends WorkflowConfig {
  maxIterations: number;
  stopOnSuccess?: boolean;
  until?: (results: Map<string, unknown>) => boolean;
}

class IterativeWorkflow<T = unknown> implements Workflow {
  readonly type = "iterative";

  constructor(config: IterativeWorkflowConfig, tasks: Task<T>[]);

  validate(): void; // maxIterations > 0
  getGraph(): TaskGraph;
  execute(context: TaskContext): Promise<WorkflowResult>;
}
```

---

## Orchestrator Contracts

### Orchestrator

```typescript
interface OrchestratorConfig {
  registry?: WorkflowRegistry;
  classifier?: TaskTypeClassifier;
  defaultWorkflow?: string;
}

class Orchestrator {
  constructor(config?: OrchestratorConfig);

  selectWorkflow(taskType: string, config?: Partial<WorkflowConfig>): Workflow;
  registerWorkflow(type: string, workflowClass: WorkflowClass): void;
  execute(task: OrchestrationTask): Promise<WorkflowResult>;
}

interface OrchestrationTask {
  id: string;
  type: string;
  tasks: Task[];
  config?: Partial<WorkflowConfig>;
}
```

---

## WorkflowRegistry Contracts

```typescript
type WorkflowClass = new (config: WorkflowConfig) => Workflow;

class WorkflowRegistry {
  register(type: string, workflowClass: WorkflowClass): void;
  get(type: string): WorkflowClass | undefined;
  has(type: string): boolean;
  list(): string[];
}
```

---

## TaskTypeClassifier Contracts

```typescript
interface ClassificationResult {
  type: string;
  confidence: number;
  method: "explicit" | "keyword" | "pattern" | "default";
  matchedKeywords?: string[];
}

interface ClassificationInput {
  explicitType?: string;
  message?: string;
  context?: Record<string, unknown>;
}

class TaskTypeClassifier {
  classify(input: ClassificationInput): ClassificationResult;

  // Maps to workflow type
  // research → concurrent
  // code → iterative
  // refactor → pipeline
}
```

---

## Event Contracts

### SwarmController Events

```typescript
interface WorkflowEvent {
  workflowId: string;
  workflowType: string;
  timestamp: Date;
}

interface TaskStartEvent extends WorkflowEvent {
  taskId: string;
  taskIndex: number;
}

interface TaskProgressEvent extends WorkflowEvent {
  taskId: string;
  progress: number; // 0-100
}

interface TaskCompleteEvent extends WorkflowEvent {
  taskId: string;
  duration: number;
  success: boolean;
  result?: unknown;
}

interface TaskErrorEvent extends WorkflowEvent {
  taskId: string;
  error: Error;
}

interface WorkflowCompleteEvent extends WorkflowEvent {
  success: boolean;
  taskCount: number;
  completedCount: number;
  failedCount: number;
  totalDuration: number;
}
```
