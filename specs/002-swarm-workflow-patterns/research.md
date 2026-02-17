# Research: Swarm Workflow Patterns

## Phase 0 Research Summary

This document consolidates research findings for implementing formal Workflow patterns in openclaw-swarm.

---

## Research 1: TaskGraph DAG Implementation

### Decision: Adjacency List with Topological Sort

**Chosen Approach**: Use adjacency list with reverse lookup for O(V+E) performance.

### Implementation Details

```typescript
class TaskGraph<T = unknown> {
  private tasks: Map<string, Task<T>> = new Map();
  private adjacencyList: Map<string, Set<string>> = new Map(); // task -> depends on
  private reverseList: Map<string, Set<string>> = new Map(); // task -> required by

  addTask(task: Task<T>): void;
  addDependency(taskId: string, dependsOn: string): void;
  detectCycles(): string[] | null;
  getExecutionOrder(): string[]; // Kahn's algorithm
  getReadyTasks(completed: Set<string>): string[];
}
```

### Rationale

- **Space**: O(V+E) vs O(V²) for matrix
- **Performance**: Sub-millisecond for 50 tasks
- **Cycle detection**: DFS with O(V+E) complexity

### Alternatives Considered

- `graphlib` library - battle-tested but adds dependency
- Custom matrix implementation - unnecessary for 10-50 tasks

---

## Research 2: Workflow Composition Patterns

### Decision: Nested Workflows via Task Interface

**Chosen Approach**: Any `Workflow` can be a "task" in another workflow by implementing a common interface.

### Implementation Pattern

```typescript
interface Workflow {
  readonly type: string;
  validate(): void;
  getGraph(): TaskGraph;
  execute(context: TaskContext): Promise<WorkflowResult>;
}

// Composable - Pipeline contains ConcurrentWorkflow
const pipeline = new PipelineWorkflow([
  new ConcurrentWorkflow([taskA, taskB]), // nested workflow
  new IterativeWorkflow({ maxIterations: 3, tasks: [taskC] }),
]);
```

### Key Design Points

| Aspect                | Implementation                               |
| --------------------- | -------------------------------------------- |
| **Depth limits**      | Use existing `maxSpawnDepth` config          |
| **Context passing**   | Existing `context_store` + `contextSharing`  |
| **Error propagation** | SwarmController events + `context_publish`   |
| **State management**  | SharedContextStore for sibling communication |

### Rationale

- Leverages existing Swarm infrastructure
- Maximum nesting depth: 5 (configurable)
- Aligns with existing tool patterns (`sessions_spawn`, `parallel_spawn`)

---

## Research 3: Task Type Classification

### Decision: Explicit → Keyword Heuristic → Default Fallback

**Chosen Approach**: Priority-based classification with weighted keyword matching.

### Classification Priority

1. **Explicit** (confidence: 1.0) - User provides `taskType` parameter
2. **Keyword** (confidence: 0.3-1.0) - Weighted keyword matching
3. **Pattern** (confidence: 0.7) - Regex fallback
4. **Default** (confidence: 0.5) - ConcurrentWorkflow fallback

### Keyword Mappings

| Task Type  | Keywords                                             |
| ---------- | ---------------------------------------------------- |
| `research` | research, find, search, investigate, explore, gather |
| `code`     | code, write, implement, create, build, develop       |
| `refactor` | refactor, restructure, clean up, improve, optimize   |
| `debug`    | debug, fix, bug, error, issue, problem, broken       |
| `analyze`  | analyze, review, examine, assess, evaluate, check    |

### Workflow Mapping

| Detected Type | Workflow Selected  | Rationale                      |
| ------------- | ------------------ | ------------------------------ |
| `research`    | ConcurrentWorkflow | Parallel information gathering |
| `code`        | IterativeWorkflow  | Implement → test → iterate     |
| `refactor`    | PipelineWorkflow   | Analyze → transform → validate |
| `debug`       | IterativeWorkflow  | Try → fix → verify             |
| `analyze`     | ConcurrentWorkflow | Parallel analysis aspects      |
| _(unknown)_   | ConcurrentWorkflow | Safe default                   |

### Rationale

- Explicit type has highest priority (deterministic)
- Keyword fallback for automation
- Default to safe parallel execution

---

## Key Technical Decisions

| Decision         | Choice             | Rationale                                |
| ---------------- | ------------------ | ---------------------------------------- |
| Graph storage    | Adjacency list     | O(V+E) vs O(V²), sufficient for 50 tasks |
| Cycle detection  | Lazy DFS           | Only when execution order requested      |
| Nested depth     | 5 (configurable)   | Aligns with maxSpawnDepth pattern        |
| Context passing  | context_store      | Existing infrastructure                  |
| Classification   | Priority-based     | Deterministic + fallback                 |
| Default workflow | ConcurrentWorkflow | Safe, parallel is common case            |

---

## Implementation Notes

1. **TaskGraph** will be the core dependency resolution engine
2. **Workflow interface** allows composability - any workflow can be nested
3. **Orchestrator** uses classifier to select workflow strategy
4. **SwarmController integration** via event publishing (task_start, task_progress, task_complete, task_error)

---

## Files to Create

| File                                              | Purpose                      |
| ------------------------------------------------- | ---------------------------- |
| `src/agents/orchestration/workflow.ts`            | Base interface + types       |
| `src/agents/orchestration/task-graph.ts`          | DAG implementation           |
| `src/agents/orchestration/workflow-registry.ts`   | Custom workflow registration |
| `src/agents/orchestration/concurrent-workflow.ts` | Parallel execution           |
| `src/agents/orchestration/pipeline-workflow.ts`   | Sequential chaining          |
| `src/agents/orchestration/iterative-workflow.ts`  | Loop execution               |
| `src/agents/orchestration/orchestrator.ts`        | Strategy selector            |
