# Feature Specification: Swarm Workflow Patterns

**Feature Branch**: `002-swarm-workflow-patterns`  
**Created**: 2026-02-17  
**Status**: Draft  
**Input**: User description: "Add formal Workflow patterns to openclaw-swarm. Implement: 1) ConcurrentWorkflow 2) PipelineWorkflow 3) IterativeWorkflow. Each workflow must: - Build TaskGraph - Define execution order - Integrate with SwarmController. Workflows must be composable. The Orchestrator should select workflow strategy based on task type (coding, research, refactor, etc). Ensure architecture allows future custom workflows."

## User Scenarios & Testing

### User Story 1 - Execute Independent Tasks in Parallel (Priority: P1)

As an agent, I want to run multiple independent sub-tasks simultaneously so that I can reduce total execution time when tasks have no dependencies.

**Why this priority**: Parallel execution is fundamental to swarm orchestration and provides immediate performance benefits for common workflows.

**Independent Test**: Can be tested by spawning 3 independent code analysis tasks and verifying all complete within the time of the longest single task (vs sum of all).

**Acceptance Scenarios**:

1. **Given** I have 3 independent tasks (analyze, lint, security), **When** I execute them via ConcurrentWorkflow, **Then** all tasks run in parallel and complete with aggregated results.

2. **Given** I have a task that fails during concurrent execution, **When** the workflow is running, **Then** other parallel tasks continue and the failure is reported with final results.

---

### User Story 2 - Chain Tasks with Data Dependencies (Priority: P1)

As an agent, I want to execute tasks in sequence where each task's output feeds into the next, so I can create processing pipelines (e.g., analyze → transform → validate).

**Why this priority**: Pipeline workflows are essential for multi-step processing chains common in coding and research tasks.

**Independent Test**: Can be tested by creating a pipeline: taskA writes to context, taskB reads from context, taskC verifies both outputs exist.

**Acceptance Scenarios**:

1. **Given** I have 3 tasks that must run sequentially (A→B→C), **When** I execute via PipelineWorkflow, **Then** B starts only after A completes, C starts only after B completes.

2. **Given** task B in a pipeline fails, **When** the pipeline is executing, **Then** task C is never started and failure is reported with partial results.

---

### User Story 3 - Repeat Task Until Condition Met (Priority: P2)

As an agent, I want to repeatedly execute a task or task set until a condition is satisfied (e.g., max iterations, success condition, or external signal), so I can handle iterative refinement scenarios.

**Why this priority**: Iterative workflows enable scenarios like "retry until success", "refine until acceptable", or "explore until found".

**Independent Test**: Can be tested by setting a 3-iteration limit and verifying exactly 3 executions occur.

**Acceptance Scenarios**:

1. **Given** I have a task that should run up to 5 times, **When** executed via IterativeWorkflow with maxIterations=5, **Then** the task executes up to 5 times.

2. **Given** an iterative workflow with stopOnSuccess=true, **When** a task returns success, **Then** subsequent iterations are cancelled.

---

### User Story 4 - Orchestrator Auto-Selects Workflow (Priority: P1)

As an agent, I want the system to automatically select the appropriate workflow strategy based on task type, so I don't have to manually choose between concurrent/pipeline/iterative patterns.

**Why this priority**: Automatic workflow selection simplifies agent interaction and ensures optimal execution patterns.

**Independent Test**: Can be tested by submitting tasks with different taskType values and verifying correct workflow is selected.

**Acceptance Scenarios**:

1. **Given** I submit a task with taskType="research", **When** the orchestrator processes it, **Then** a ConcurrentWorkflow is selected (parallel information gathering).

2. **Given** I submit a task with taskType="refactor", **When** the orchestrator processes it, **Then** a PipelineWorkflow is selected (analyze→transform→validate).

3. **Given** I submit a task with taskType="coding", **When** the orchestrator processes it, **Then** an IterativeWorkflow is selected (implement→test→iterate).

---

### User Story 5 - Compose Complex Workflows (Priority: P2)

As an agent, I want to nest workflows within each other (e.g., pipeline containing concurrent tasks), so I can model complex real-world processes.

**Why this priority**: Composability enables sophisticated orchestration patterns without requiring new workflow types.

**Independent Test**: Can be tested by creating a pipeline where stage 1 is concurrent (taskA, taskB), stage 2 is iterative (taskC), and verifying execution order.

**Acceptance Scenarios**:

1. **Given** I compose a ConcurrentWorkflow inside a PipelineWorkflow, **When** the outer pipeline executes, **Then** concurrent tasks run in parallel as a single pipeline stage.

2. **Given** I register a custom workflow type, **When** the orchestrator encounters a matching task type, **Then** the custom workflow is selected.

---

### Edge Cases

- What happens when workflow receives empty task list?
- How does system handle circular dependencies in composed workflows?
- What is the maximum nesting depth for composed workflows?
- How does workflow handle subagent failures (partial vs full failure)?
- What happens when context_store data expires during pipeline execution?

## Requirements

### Functional Requirements

- **FR-001**: System MUST provide a base Workflow interface that defines execute(), validate(), and getGraph() methods.

- **FR-002**: System MUST implement ConcurrentWorkflow that executes all tasks in parallel and aggregates results when all complete.

- **FR-003**: System MUST implement PipelineWorkflow that chains tasks sequentially, passing output of each as input to the next.

- **FR-004**: System MUST implement IterativeWorkflow that executes tasks repeatedly until a termination condition is met.

- **FR-005**: System MUST provide a TaskGraph class that represents task dependencies as a directed acyclic graph (DAG).

- **FR-006**: System MUST integrate each workflow with SwarmController for event publishing (task_start, task_progress, task_complete, task_error).

- **FR-007**: Workflows MUST be composable, allowing any workflow to be nested as a task within another workflow.

- **FR-008**: System MUST provide a WorkflowRegistry that allows registering custom workflow types for future extensibility.

- **FR-009**: System MUST provide an Orchestrator class that selects workflow strategy based on taskType field.

- **FR-010**: System MUST map taskType "research" to ConcurrentWorkflow (parallel information gathering).

- **FR-011**: System MUST map taskType "refactor" to PipelineWorkflow (sequential analysis→transform→validate).

- **FR-012**: System MUST map taskType "coding" to IterativeWorkflow (implement→test→iterate).

- **FR-013**: System MUST support explicit taskType parameter in spawn calls for deterministic workflow selection.

- **FR-014**: System MUST support fallback to default workflow (ConcurrentWorkflow) when taskType is unrecognized.

### Key Entities

- **Workflow**: Abstract base class defining workflow execution contract
- **TaskGraph**: Directed acyclic graph representing task dependencies and execution order
- **WorkflowResult**: Standard result object containing success status, outputs, errors, and timing
- **WorkflowRegistry**: Registry mapping taskType strings to Workflow class implementations
- **Orchestrator**: Service that receives tasks and orchestrates appropriate workflow execution
- **TaskContext**: Shared execution context passed through workflow (contains context_store reference)

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can complete 3 independent research tasks in parallel within 120% of the longest single task time (vs 300% for sequential).

- **SC-002**: Pipeline workflow correctly enforces sequential execution - task N+1 never starts before task N completes.

- **SC-003**: Iterative workflow respects maxIterations boundary - never exceeds configured iteration count.

- **SC-004**: Orchestrator correctly selects workflow for all three built-in taskTypes (research, refactor, coding) with 100% accuracy.

- **SC-005**: Custom workflow registration via WorkflowRegistry is functional and selectable by the orchestrator.

- **SC-006**: Composed workflows (nested workflows) execute with correct dependency ordering.

- **SC-007**: All workflows integrate with SwarmController and emit appropriate events for monitoring.

---

## Assumptions

1. **Task Type Detection**: We assume explicit taskType parameter (Option A) for deterministic behavior. Users specify taskType when spawning; fallback to keyword heuristic for auto-detection if needed.

2. **Configuration Method**: We assume JSON-based configuration for workflow definitions (matches existing tool patterns), with programmatic override capability for complex cases.

3. **Context Sharing**: Workflows use existing context_store for inter-task data passing. Pipeline passes output→input via context_store keys.

4. **Failure Handling**: Workflows have configurable failure strategies: "fail-fast" (default), "continue-others", "retry".

5. **Maximum Limits**: Default max tasks per workflow: 50. Max nested depth: 5. These are configurable via SwarmController options.
