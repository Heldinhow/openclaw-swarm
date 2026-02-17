# OpenClaw Swarm

Fork of OpenClaw with advanced subagent orchestration tools.

## Features

### 1. Context Sharing (`contextSharing`)

Share parent session context with subagents.

```typescript
sessions_spawn({
  label: "my-subagent",
  task: "Do something",
  contextSharing: "recent", // none | summary | recent | full
});
```

- **none**: No context
- **summary**: Compressed summary
- **recent**: Last messages
- **full**: Full history

### 2. Shared Context Store (`context_store`)

Share state between subagents (siblings).

```typescript
// Write
context_store({
  action: "set",
  namespace: "my-project",
  key: "data",
  value: { result: "ok" },
});

// Read
context_store({
  action: "get",
  namespace: "my-project",
  key: "data",
});
```

**Features:**

- TTL (time-to-live)
- Isolated namespaces
- Pub/Sub via `subscribe`/`broadcast`

### 3. Event-Driven Notifications (`context_publish`)

Notify orchestrator when subagents complete.

```typescript
context_publish({
  action: "publish",
  eventType: "task_complete", // task_complete | task_progress | task_error | handoff
  target: "orchestrator",
  data: { result: "ok" },
});
```

**Auto-announce**: System automatically notifies when subagent completes.

```
✅ Sub-agent completed: label
   task: ...
   result: ...
   runtime: Xs
   sessionKey: ...
```

### 4. Parallel Execution (`parallel_spawn`)

Run multiple subagents in parallel with different wait strategies.

```typescript
parallel_spawn({
  tasks: [
    { label: "task1", task: "Do this" },
    { label: "task2", task: "Do that" },
  ],
  wait: "all", // all | any | race | number
});
```

| Strategy | Behavior                         |
| -------- | -------------------------------- |
| `all`    | Wait for all to complete         |
| `any`    | Return on first, others continue |
| `race`   | Return on first, cancel others   |

### 5. Workflow Patterns

Formal Workflow patterns for advanced orchestration.

#### Workflow Types

| Workflow             | Purpose             | Use Case                                        |
| -------------------- | ------------------- | ----------------------------------------------- |
| `ConcurrentWorkflow` | Parallel execution  | Independent tasks (analyze, lint, test)         |
| `PipelineWorkflow`   | Sequential chaining | Multi-step processes (fetch → transform → save) |
| `IterativeWorkflow`  | Loop execution      | Retry until success, refine until acceptable    |

#### Using Orchestrator

```typescript
import { Orchestrator } from "./orchestration/orchestrator.js";

const orchestrator = new Orchestrator();

// Auto-select workflow based on task type
const result = await orchestrator.execute({
  id: "my-workflow",
  type: "research", // → ConcurrentWorkflow
  tasks: [
    { id: "t1", payload: {} },
    { id: "t2", payload: {} },
  ],
});
```

#### Auto-Selection Mapping

| taskType   | Workflow           | Keywords                       |
| ---------- | ------------------ | ------------------------------ |
| `research` | ConcurrentWorkflow | search, find, investigate      |
| `refactor` | PipelineWorkflow   | refactor, restructure, improve |
| `coding`   | IterativeWorkflow  | write, implement, create       |

#### Custom Workflows

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

const registry = new WorkflowRegistry();
registry.register("custom", CustomWorkflow);
```

#### Configuration

```typescript
const config: WorkflowConfig = {
  maxTasks: 50,
  maxNestingDepth: 5,
  defaultTimeout: 300000, // 5 minutes
  failureStrategy: "fail-fast", // fail-fast | continue-others | retry
  maxRetries: 0,
};
```

See [docs/swarm-workflows.md](./docs/swarm-workflows.md) for complete documentation.

## Installation

```bash
# Clone the fork
git clone https://github.com/Heldinhow/openclaw-swarm.git
cd openclaw-swarm

# Build
pnpm install
pnpm build

# Or use the code directly from /usr/lib/node_modules/openclaw/
```

## Status

- ✅ `sessions_spawn` with contextSharing
- ✅ `context_store` (get, set, delete, list, subscribe, broadcast)
- ✅ `context_publish` (task_complete, task_progress, task_error, handoff)
- ✅ Auto-announce for subagents
- ✅ `parallel_spawn` (all, any, race)
- ✅ ConcurrentWorkflow (parallel execution)
- ✅ PipelineWorkflow (sequential chaining)
- ✅ IterativeWorkflow (loop execution)
- ✅ TaskTypeClassifier (auto-detection)
- ✅ WorkflowRegistry (custom workflows)
- ✅ Orchestrator (auto-selection)

## Differences from Original OpenClaw

| Feature                | Original | Swarm |
| ---------------------- | -------- | ----- |
| Context sharing        | ❌       | ✅    |
| Siblings communication | ❌       | ✅    |
| Auto-notify            | ❌       | ✅    |
| Parallel spawn         | ❌       | ✅    |
| Workflow patterns      | ❌       | ✅    |
| Auto-selection         | ❌       | ✅    |

## Author

Helder (@Heldinhow)

## Star the Repo

If you find this useful, please star the repo! ⭐ https://github.com/Heldinhow/openclaw-swarm
