# Swarm-Native Orchestrator Core - Technical Plan

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     SwarmController                              │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │  TaskGraph      │  │ AgentLifecycle   │  │ Output Merge  │  │
│  │  Engine         │  │ Manager          │  │ Strategy      │  │
│  └────────┬────────┘  └────────┬─────────┘  └───────┬───────┘  │
│           │                    │                    │           │
│           ▼                    ▼                    ▼           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                      Task Class                           │  │
│  │  States: pending → running → blocked → failed/completed   │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. Task Class (Task.ts)

**State Machine:**

```
                    ┌─────────────┐
         ┌─────────▶│   pending   │◀────────┐
         │          └──────┬──────┘         │
         │                 │                │
         │                 ▼                │
    ┌────┴────┐     ┌───────────┐     ┌────┴────┐
    │ running │────▶│  blocked  │────▶│ failed  │
    └────┬────┘     └───────────┘     └─────────┘
         │
         ▼
   ┌───────────┐
   │completed │
   └───────────┘
```

**Implementation Details:**

- Use TypeScript enums for states
- Private setters for state to enforce transition rules
- Event emitter for state change notifications
- JSON serialization support for persistence

### 2. TaskGraph Engine (TaskGraph.ts)

**Data Structures:**

```typescript
// Adjacency list for dependencies
dependencies: Map<string, Set<string>>; // taskId -> Set of taskIds it depends on
reverseGraph: Map<string, Set<string>>; // taskId -> Set of tasks depending on it

// In-degree tracking for topological sort
inDegree: Map<string, number>;
```

**Execution Flow:**

1. `execute()` method returns a promise
2. Internal event loop processes ready tasks
3. Uses Promise.allSettled for parallel execution
4. Updates in-degree on task completion
5. Continues until all tasks processed

**Concurrency Control:**

- Configurable `maxConcurrent` (default: 10)
- Semaphore pattern for task scheduling

### 3. SwarmController (SwarmController.ts)

**Agent Spawning:**

- Uses OpenClaw's sessions_spawn API
- Wraps spawned agents with lifecycle tracking
- Maintains agent-to-task mapping

**Retry Logic:**

```typescript
retryConfig: {
  maxRetries: number; // default: 3
  initialDelayMs: number; // default: 1000
  maxDelayMs: number; // default: 30000
  backoffMultiplier: number; // default: 2
}
```

**Output Merging:**

- Strategies: `merge` (deep merge), `concat` (array), `lastWins`
- Configurable per execution

### 4. AgentLifecycleManager (AgentLifecycleManager.ts)

**Agent Pool:**

- Maintains pool of active agents
- Implements worker queue pattern
- Health check polling

**Cleanup:**

- Tracks pending cleanup operations
- Force terminates stuck agents after timeout

## Integration Points

### With OpenClaw Core

- Uses `sessions_spawn` for agent creation
- Uses `context_publish` for task completion events
- Uses `context_store` for shared state

### With Existing openclaw-swarm

- Compatible with existing task definitions
- Gradual migration path (parallel support optional)

## Error Handling

| Scenario            | Strategy                           |
| ------------------- | ---------------------------------- |
| Agent crash         | Retry with backoff, then fail task |
| Dependency failure  | Blocked tasks automatically fail   |
| Timeout             | Terminate agent, retry             |
| Resource exhaustion | Queue tasks, wait for capacity     |

## Testing Strategy

1. **Unit Tests:** Task state machine, graph algorithms
2. **Integration Tests:** SwarmController + TaskGraph interaction
3. **E2E Tests:** Full execution with mock agents

## Migration Path

1. Create new `orchestration/` module
2. Implement Task and TaskGraph
3. Implement SwarmController
4. Implement AgentLifecycleManager
5. Add integration tests
6. Update existing code to use new system
