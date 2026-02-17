# Swarm-Native Orchestrator Core - Task Breakdown

## Phase 1: Foundation

### Task 1.1: Types and Interfaces

**File:** `src/orchestration/types.ts`

- Define TaskState enum
- Define Task interface
- Define TaskGraph interface
- Define SwarmController interface
- Define AgentLifecycleManager interface
- Define AgentStatus enum

### Task 1.2: Task Class Implementation

**File:** `src/orchestration/Task.ts`

- Implement TaskState enum
- Implement Task class
- Implement state machine with validation
- Implement transition methods
- Add event emission for state changes
- Add JSON serialization

## Phase 2: TaskGraph Engine

### Task 2.1: TaskGraph Core

**File:** `src/orchestration/TaskGraph.ts`

- Implement addTask() method
- Implement addDependency() method
- Implement getReadyTasks() - O(V+E) algorithm
- Implement getBlockedTasks() method
- Implement getTaskById() method

### Task 2.2: TaskGraph Execution

**File:** `src/orchestration/TaskGraph.ts`

- Implement execute() with parallel execution
- Implement onTaskComplete() - updates in-degree
- Implement onTaskFail() - propagates failure
- Add concurrency control (maxConcurrent)
- Add progress tracking and events

## Phase 3: Agent Lifecycle Management

### Task 3.1: AgentLifecycleManager

**File:** `src/orchestration/AgentLifecycleManager.ts`

- Implement createAgent() - agent factory
- Implement getAgent() - lookup
- Implement updateAgentStatus()
- Implement terminateAgent()
- Implement getActiveAgents()
- Implement cleanup() - resource disposal

### Task 3.2: Agent Pool and Health

**File:** `src/orchestration/AgentLifecycleManager.ts`

- Implement agent pool management
- Add health check polling
- Add agent timeout handling
- Add force terminate for stuck agents

## Phase 4: Swarm Controller

### Task 4.1: SwarmController Core

**File:** `src/orchestration/SwarmController.ts`

- Implement spawnAgent() - calls sessions_spawn
- Implement getAgentStatus()
- Implement terminateAgent()
- Implement retryTask() with exponential backoff

### Task 4.2: Output and Execution

**File:** `src/orchestration/SwarmController.ts`

- Implement mergeOutputs() - configurable strategy
- Implement getActiveAgents()
- Implement executeGraph() - orchestrates TaskGraph
- Implement shutdown() - graceful termination

## Phase 5: Integration and Exports

### Task 5.1: Module Exports

**File:** `src/orchestration/index.ts`

- Export all public types
- Export all classes
- Create convenience factory functions

### Task 5.2: Integration Tests

**File:** `test/orchestration/`

- Test Task state machine
- Test TaskGraph parallel execution
- Test SwarmController spawning
- Test AgentLifecycleManager cleanup
- Test retry logic and backoff

## Implementation Order

```
Phase 1 (Foundation)
  ├── Task 1.1: Types → 1h
  └── Task 1.2: Task → 2h

Phase 2 (TaskGraph)
  ├── Task 2.1: Core → 3h
  └── Task 2.2: Execution → 3h

Phase 3 (Agent Lifecycle)
  ├── Task 3.1: Manager → 2h
  └── Task 3.2: Pool/Health → 2h

Phase 4 (Swarm Controller)
  ├── Task 4.1: Core → 2h
  └── Task 4.2: Output → 2h

Phase 5 (Integration)
  ├── Task 5.1: Exports → 0.5h
  └── Task 5.2: Tests → 4h

Total: ~21.5 hours
```

## Parallel Implementation Notes

Tasks 1.1 and 1.2 can run in parallel (different files).

Tasks 2.1 and 2.2 depend on Task 1.2.

Tasks 3.1 and 3.2 can run in parallel.

Tasks 4.1 and 4.2 depend on Tasks 2.x and 3.x.

Task 5.2 depends on all implementation tasks.
