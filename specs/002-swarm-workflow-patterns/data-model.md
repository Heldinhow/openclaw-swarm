# Data Model: Swarm Workflow Patterns

## Entities

### 1. Workflow (Abstract Base)

```typescript
interface Workflow {
  readonly type: WorkflowType;
  validate(): void;
  getGraph(): TaskGraph;
  execute(context: TaskContext): Promise<WorkflowResult>;
}

type WorkflowType = "concurrent" | "pipeline" | "iterative" | string;
```

### 2. TaskGraph

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

### 3. Task

```typescript
interface Task<T = unknown> {
  id: string;
  payload: T;
  dependencies: string[]; // task IDs this depends on
  handler?: TaskHandler<T>;
  timeout?: number;
  retries?: number;
}

type TaskHandler<T> = (payload: T, context: TaskContext) => Promise<unknown>;
```

### 4. WorkflowResult

```typescript
interface WorkflowResult {
  success: boolean;
  outputs: Map<string, unknown>;
  errors: Map<string, Error>;
  timings: WorkflowTimings;
  metadata: WorkflowMetadata;
}

interface WorkflowTimings {
  startedAt: Date;
  completedAt: Date;
  totalDurationMs: number;
  taskDurations: Map<string, number>;
}

interface WorkflowMetadata {
  workflowType: WorkflowType;
  taskCount: number;
  completedCount: number;
  failedCount: number;
}
```

### 5. TaskContext

```typescript
interface TaskContext {
  sessionKey: string;
  namespace: string;
  sharedStore: SharedContextStore;
  eventBus: EventBus;
  swarmController: SwarmController;
  config: WorkflowConfig;
}
```

### 6. WorkflowConfig

```typescript
interface WorkflowConfig {
  maxTasks: number; // default: 50
  maxNestingDepth: number; // default: 5
  defaultTimeout: number; // default: 300000ms
  failureStrategy: "fail-fast" | "continue-others" | "retry";
  maxRetries: number; // default: 0
}
```

### 7. WorkflowRegistry

```typescript
interface WorkflowRegistry {
  register(type: string, workflowClass: WorkflowClass): void;
  get(type: string): WorkflowClass | undefined;
  has(type: string): boolean;
  list(): string[];
}

type WorkflowClass = new (config: WorkflowConfig) => Workflow;
```

### 8. Orchestrator

```typescript
interface Orchestrator {
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

### 9. TaskTypeClassifier

```typescript
interface ClassificationResult {
  type: string;
  confidence: number;
  method: "explicit" | "keyword" | "pattern" | "default";
  matchedKeywords?: string[];
}

interface TaskTypeClassifier {
  classify(input: ClassificationInput): ClassificationResult;
}

interface ClassificationInput {
  explicitType?: string;
  message?: string;
  context?: Record<string, unknown>;
}
```

---

## Relationships

```
Orchestrator
    │
    ├── uses ───▶ WorkflowRegistry
    │                    │
    │                    └── registers ───▶ Workflow (concrete class)
    │
    └── selects ───▶ Workflow (via classifier)
                           │
                           ├── contains ───▶ TaskGraph
                           │                    │
                           │                    └── contains ───▶ Task[]
                           │
                           └── executes with ───▶ TaskContext
                                                    │
                                                    ├── uses ───▶ SharedContextStore
                                                    ├── uses ───▶ EventBus
                                                    └── uses ───▶ SwarmController
```

---

## Validation Rules

| Entity         | Rule                                                |
| -------------- | --------------------------------------------------- |
| TaskGraph      | Must not contain cycles (detectCycles returns null) |
| Task           | ID must be unique within graph                      |
| Task           | Dependencies must reference existing task IDs       |
| Workflow       | Must have at least 1 task                           |
| WorkflowConfig | maxTasks must be > 0 and ≤ 100                      |
| WorkflowConfig | maxNestingDepth must be > 0 and ≤ 10                |
| WorkflowConfig | maxRetries must be ≥ 0                              |
| Orchestrator   | Unknown taskType defaults to 'concurrent'           |

---

## State Transitions

### Task State Machine

```
PENDING → RUNNING → COMPLETED
    │         │
    │         ↓
    │       FAILED
    │         │
    └─────────┘ (retry)
```

### Workflow State Machine

```
INITIALIZED → VALIDATING → EXECUTING → COMPLETING → COMPLETED
                │              │            │
                │              │            ↓
                │              │          FAILED
                │              ↓
                └──────────────┘ (cancel)
```
