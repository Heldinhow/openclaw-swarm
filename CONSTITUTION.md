# Swarm-Native Orchestrator Core - Constitution

## Core Principles

### 1. Graph-Based Execution Model

- All tasks are nodes in a directed acyclic graph (DAG)
- Dependencies between tasks are explicit and enforceable
- Parallel execution is first-class, not an afterthought

### 2. State-Driven Task Lifecycle

- Tasks transition through well-defined states: `pending` → `running` → `blocked` → `failed` → `completed`
- State transitions are atomic and observable
- Blocked tasks automatically unblock when dependencies complete

### 3. Swarm Intelligence

- Multiple agents can execute simultaneously
- The swarm adapts to available resources
- Agent lifecycle is fully managed by the orchestrator

### 4. Modular Architecture

- Clear separation of concerns: TaskGraph, SwarmController, AgentLifecycleManager
- Each component has a single, well-defined responsibility
- Interfaces define contracts, implementations are swappable

### 5. Resilience by Design

- Automatic retries with exponential backoff
- Graceful degradation on agent failures
- Output merging preserves all work

## Design Values

| Value                       | Description                             |
| --------------------------- | --------------------------------------- |
| **Explicit > Implicit**     | Dependencies are declared, not inferred |
| **Parallel > Sequential**   | Execute independent tasks concurrently  |
| **Observable > Opaque**     | State is tracked and reported           |
| **Resilient > Fragile**     | Failures are handled gracefully         |
| **Composable > Monolithic** | Components can be reused and combined   |

## Anti-Patterns to Avoid

1. **Linear execution chains** - Tasks should not be forced into sequence unless truly dependent
2. **Hidden dependencies** - If task B needs task A's output, this must be explicit
3. **Silent failures** - All failures must be observable and reportable
4. **Global state** - Each component manages its own state; shared state is explicit
5. **Tight coupling** - Components communicate through well-defined interfaces
