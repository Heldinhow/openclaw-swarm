# Quickstart: Swarm Workflow Patterns

## Installation

Workflow patterns are included in the orchestration module. No additional installation required.

```typescript
import {
  Workflow,
  TaskGraph,
  ConcurrentWorkflow,
  PipelineWorkflow,
  IterativeWorkflow,
  Orchestrator,
  WorkflowRegistry,
} from "./agents/orchestration/index.js";
```

---

## Basic Usage

### 1. Concurrent Workflow (Parallel Tasks)

```typescript
import { ConcurrentWorkflow, TaskGraph } from "./orchestration/workflow.js";

const workflow = new ConcurrentWorkflow([
  { id: "analyze", payload: { task: "Analyze code" } },
  { id: "lint", payload: { task: "Lint code" } },
  { id: "test", payload: { task: "Run tests" } },
]);

const result = await workflow.execute(context);
console.log(result.success); // true
console.log(result.outputs); // Map with all task results
```

### 2. Pipeline Workflow (Sequential Tasks)

```typescript
import { PipelineWorkflow } from "./orchestration/workflow.js";

const workflow = new PipelineWorkflow([
  {
    id: "fetch",
    payload: { source: "api" },
    handler: async (p) => fetchData(p.source),
  },
  {
    id: "transform",
    payload: { format: "json" },
    handler: async (p, ctx) => transformData(ctx.get("fetch")),
  },
  {
    id: "save",
    payload: { target: "db" },
    handler: async (p, ctx) => saveData(ctx.get("transform")),
  },
]);

const result = await workflow.execute(context);
// Output of 'fetch' → input of 'transform' → input of 'save'
```

### 3. Iterative Workflow (Loop Until Condition)

```typescript
import { IterativeWorkflow } from "./orchestration/workflow.js";

const workflow = new IterativeWorkflow({
  maxIterations: 5,
  stopOnSuccess: true,
  tasks: [
    {
      id: "implement",
      payload: { action: "implement" },
      handler: async (p) => implementFeature(),
    },
    {
      id: "test",
      payload: { action: "test" },
      handler: async (p, ctx) => runTests(),
    },
  ],
  until: (results) => results.get("test")?.success === true,
});

const result = await workflow.execute(context);
```

---

## Orchestrator (Auto-Select Workflow)

The Orchestrator automatically selects the appropriate workflow based on task type:

```typescript
import { Orchestrator } from "./orchestration/orchestrator.js";

const orchestrator = new Orchestrator();

// Auto-selects ConcurrentWorkflow for research tasks
const researchResult = await orchestrator.execute({
  id: "research-task",
  type: "research",
  tasks: [
    { id: "t1", payload: {} },
    { id: "t2", payload: {} },
  ],
});

// Auto-selects PipelineWorkflow for refactor tasks
const refactorResult = await orchestrator.execute({
  id: "refactor-task",
  type: "refactor",
  tasks: [
    { id: "t1", payload: {} },
    { id: "t2", payload: {} },
  ],
});

// Auto-selects IterativeWorkflow for coding tasks
const codingResult = await orchestrator.execute({
  id: "coding-task",
  type: "coding",
  tasks: [{ id: "t1", payload: {} }],
});
```

---

## Task Type Mapping

| Task Type   | Workflow           | Keywords                       |
| ----------- | ------------------ | ------------------------------ |
| `research`  | ConcurrentWorkflow | search, find, investigate      |
| `code`      | IterativeWorkflow  | write, implement, create       |
| `refactor`  | PipelineWorkflow   | refactor, restructure, improve |
| `debug`     | IterativeWorkflow  | fix, bug, error                |
| _(default)_ | ConcurrentWorkflow | -                              |

---

## Custom Workflow Registration

Register custom workflow types for extensibility:

```typescript
import { WorkflowRegistry, Workflow } from "./orchestration/workflow.js";

class CustomWorkflow implements Workflow {
  readonly type = "custom";

  validate() {
    /* ... */
  }
  getGraph() {
    /* ... */
  }
  async execute(ctx) {
    /* ... */
  }
}

// Register custom workflow
const registry = new WorkflowRegistry();
registry.register("custom", CustomWorkflow);

// Use with orchestrator
const orchestrator = new Orchestrator({ registry });
const result = await orchestrator.execute({
  id: "custom-task",
  type: "custom",
  tasks: [],
});
```

---

## Integration with SwarmController

Workflows emit events for monitoring:

```typescript
import { getGlobalSwarmController } from "./orchestration/index.js";

const controller = getGlobalSwarmController();

// Subscribe to workflow events
controller.subscribe("task_start", (event) => {
  console.log(`Task started: ${event.taskId}`);
});

controller.subscribe("task_complete", (event) => {
  console.log(`Task completed: ${event.taskId} in ${event.duration}ms`);
});

controller.subscribe("task_error", (event) => {
  console.error(`Task failed: ${event.taskId}`, event.error);
});
```

---

## Configuration

```typescript
import { WorkflowConfig } from "./orchestration/workflow.js";

const config: WorkflowConfig = {
  maxTasks: 50, // Max tasks per workflow
  maxNestingDepth: 5, // Max nested workflow depth
  defaultTimeout: 300000, // 5 minutes
  failureStrategy: "fail-fast", // 'fail-fast' | 'continue-others' | 'retry'
  maxRetries: 0,
};

const workflow = new ConcurrentWorkflow(tasks, config);
```

---

## Next Steps

- See [data-model.md](./data-model.md) for entity definitions
- See [research.md](./research.md) for implementation research
- See [spec.md](./spec.md) for full feature requirements
