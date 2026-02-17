# Swarm-Native Orchestrator Core - Specification

## Overview

Transform the current linear task execution model of openclaw-swarm into a graph-based orchestration system that supports parallel execution, dependency-aware scheduling, and comprehensive agent lifecycle management.

## Scope

This specification covers the creation of:

1. **Task class** - Core unit of work with explicit state machine
2. **TaskGraph engine** - DAG-based execution engine
3. **SwarmController** - Orchestration hub for spawning and managing agents
4. **AgentLifecycleManager** - Full lifecycle management for subagents

## Functional Requirements

### 1. Task Class

**States:**

- `pending` - Task created, not yet started
- `running` - Task is actively being executed
- `blocked` - Task waiting on dependencies
- `failed` - Task completed with error
- `completed` - Task finished successfully

**Properties:**

- `id: string` - Unique identifier
- `name: string` - Human-readable name
- `state: TaskState` - Current state
- `dependencies: string[]` - Array of task IDs this task depends on
- `input: any` - Input data for the task
- `output: any` - Output data from the task
- `error: Error | null` - Error if failed
- `retryCount: number` - Number of retry attempts
- `createdAt: Date` - Creation timestamp
- `startedAt: Date | null` - Start timestamp
- `completedAt: Date | null` - Completion timestamp

**Methods:**

- `transition(newState: TaskState)` - Atomic state transition
- `canTransitionTo(targetState: TaskState)` - Validate state transition
- `markFailed(error: Error)` - Mark as failed with error
- `markCompleted(output: any)` - Mark as completed with output

### 2. TaskGraph Engine

**Responsibilities:**

- Maintain the DAG of tasks
- Determine execution order based on dependencies
- Track which tasks are ready to execute
- Handle parallel execution scheduling

**API:**

```typescript
interface TaskGraph {
  addTask(task: Task): void;
  addDependency(taskId: string, dependsOn: string): void;
  getReadyTasks(): Task[]; // Tasks with all dependencies met
  getBlockedTasks(): Task[]; // Tasks waiting on dependencies
  getTaskById(id: string): Task | undefined;
  getTaskState(id: string): TaskState;
  execute(): Promise<TaskResult[]>;
  onTaskComplete(taskId: string, output: any): void;
  onTaskFail(taskId: string, error: Error): void;
}
```

**Scheduling Algorithm:**

1. Build adjacency list from dependencies
2. Compute in-degree for each node
3. Tasks with in-degree 0 are ready to execute
4. When a task completes, decrement in-degree of dependent tasks
5. Execute ready tasks in parallel up to maxConcurrency

### 3. SwarmController

**Responsibilities:**

- Spawn subagents for task execution
- Manage agent lifecycle (spawn, track, terminate)
- Handle retries and error recovery
- Merge outputs from multiple agents

**API:**

```typescript
interface SwarmController {
  spawnAgent(task: Task, config: AgentConfig): Promise<AgentHandle>;
  getAgentStatus(agentId: string): AgentStatus;
  terminateAgent(agentId: string): Promise<void>;
  retryTask(taskId: string): Promise<void>;
  mergeOutputs(outputs: any[]): any;
  getActiveAgents(): AgentHandle[];
  shutdown(): Promise<void>;
}
```

**Features:**

- Configurable max concurrent agents
- Automatic retry with exponential backoff
- Output merging strategy (merge, concatenate, or last-wins)
- Graceful shutdown handling

### 4. AgentLifecycleManager

**Responsibilities:**

- Track agent state and health
- Handle agent creation and cleanup
- Monitor agent resource usage
- Manage agent timeouts

**API:**

```typescript
interface AgentLifecycleManager {
  createAgent(config: AgentConfig): Promise<Agent>;
  getAgent(id: string): Agent | undefined;
  updateAgentStatus(id: string, status: AgentStatus): void;
  terminateAgent(id: string): Promise<void>;
  getActiveAgents(): Agent[];
  cleanup(): Promise<void>;
}
```

**Agent States:**

- `spawning` - Agent is being created
- `idle` - Agent ready but not assigned
- `busy` - Agent executing a task
- `terminating` - Agent is shutting down
- `dead` - Agent terminated

## Non-Functional Requirements

### Performance

- Support 100+ concurrent tasks
- Sub-100ms task state transitions
- Efficient dependency resolution (O(V+E))

### Reliability

- No lost tasks on system failure (state persisted)
- Automatic retry on transient failures
- Dead agent detection and recovery

### Observability

- Real-time task state updates
- Task execution metrics
- Agent health monitoring

## Acceptance Criteria

1. ✅ Task class implements full state machine with atomic transitions
2. ✅ TaskGraph correctly identifies ready/blocked tasks
3. ✅ Tasks without dependencies execute in parallel
4. ✅ SwarmController spawns and tracks agents
5. ✅ AgentLifecycleManager handles full lifecycle
6. ✅ Retries work with exponential backoff
7. ✅ Output merging preserves all agent results
8. ✅ Graceful shutdown terminates all agents cleanly

## File Structure

```
src/
├── orchestration/
│   ├── Task.ts              # Task class
│   ├── TaskGraph.ts         # DAG execution engine
│   ├── SwarmController.ts  # Agent orchestration
│   ├── AgentLifecycleManager.ts
│   ├── types.ts             # Interfaces and types
│   └── index.ts            # Public API
```
