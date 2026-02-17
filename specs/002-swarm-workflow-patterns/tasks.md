# Tasks: Swarm Workflow Patterns

**Feature**: Swarm Workflow Patterns  
**Branch**: `002-swarm-workflow-patterns`  
**Generated**: 2026-02-17

---

## Summary

| Metric                 | Count |
| ---------------------- | ----- |
| Total Tasks            | 28    |
| User Stories           | 5     |
| Parallel Opportunities | 8     |
| Estimated Phases       | 8     |

---

## Phase 1: Setup

Project initialization and environment verification.

- [x] T001 Verify Node.js 22+ and pnpm installed (`node --version`, `pnpm --version`)
- [x] T002 Verify existing orchestration dependencies (`ls src/agents/orchestration/`)
- [x] T003 Run existing tests to ensure baseline passes (`pnpm test -- tests/orchestration/`)

---

## Phase 2: Foundational

Core interfaces and data structures required by all workflow types.

**Goal**: Implement base abstractions that all workflows depend on.

**Independent Test Criteria**: All foundational code compiles and unit tests pass.

### Implementation

- [x] T004 [P] Create Workflow base interface in `src/agents/orchestration/workflow.ts`
- [x] T005 [P] Create TaskGraph DAG class in `src/agents/orchestration/task-graph.ts`
- [x] T006 [P] Create WorkflowConfig interface in `src/agents/orchestration/workflow.ts`
- [x] T007 [P] Create WorkflowResult types in `src/agents/orchestration/workflow.ts`
- [x] T008 Create TaskContext interface in `src/agents/orchestration/workflow.ts`
- [x] T009 Create unit tests for TaskGraph in `tests/orchestration/task-graph.test.ts`
- [x] T010 Create unit tests for base Workflow interface in `tests/orchestration/workflow.test.ts`

---

## Phase 3: User Story 1 - ConcurrentWorkflow

Execute independent tasks in parallel.

**Story Goal**: Implement parallel task execution with aggregated results.

**Independent Test Criteria**: 3 independent tasks complete within 120% of longest single task time.

### Implementation

- [x] T011 [P] [US1] Implement ConcurrentWorkflow class in `src/agents/orchestration/concurrent-workflow.ts`
- [x] T012 [P] [US1] Add execute() method with Promise.all for parallel execution
- [x] T013 [US1] Add result aggregation logic (combine outputs from all tasks)
- [x] T014 [US1] Add failure handling (continue-others strategy per config)
- [x] T015 [US1] Integrate with SwarmController for event publishing
- [x] T016 [US1] Create unit tests in `tests/orchestration/concurrent-workflow.test.ts`

---

## Phase 4: User Story 2 - PipelineWorkflow

Chain tasks with data dependencies.

**Story Goal**: Sequential execution where each task's output feeds the next.

**Independent Test Criteria**: Task N+1 never starts before task N completes; pipeline fails if any task fails.

### Implementation

- [X] T017 [P] [US2] Implement PipelineWorkflow class in `src/agents/orchestration/pipeline-workflow.ts`
- [X] T018 [P] [US2] Add sequential execution with output→input chaining via context_store
- [X] T019 [US2] Add early termination on failure (task C never starts if B fails)
- [X] T020 [US2] Add partial result collection for failed pipelines
- [X] T021 [US2] Integrate with SwarmController for event publishing
- [X] T022 [US2] Create unit tests in `tests/orchestration/pipeline-workflow.test.ts`

---

## Phase 5: User Story 3 - IterativeWorkflow

Repeat tasks until condition met.

**Story Goal**: Loop execution with maxIterations and stopOnSuccess options.

**Independent Test Criteria**: Exactly maxIterations executions occur; stops early if stopOnSuccess=true and condition met.

### Implementation

- [X] T023 [P] [US3] Implement IterativeWorkflow class in `src/agents/orchestration/iterative-workflow.ts`
- [X] T024 [P] [US3] Add iteration loop with maxIterations boundary
- [X] T025 [US3] Add stopOnSuccess condition checking
- [X] T026 [US3] Add until() function support for custom termination
- [X] T027 [US3] Add iteration result tracking (total iterations, success at iteration)
- [X] T028 [US3] Integrate with SwarmController for event publishing
- [X] T029 [US3] Create unit tests in `tests/orchestration/iterative-workflow.test.ts`

---

## Phase 6: User Story 4 - Orchestrator

Auto-select workflow based on task type.

**Story Goal**: Orchestrator selects correct workflow for taskType (research→Concurrent, refactor→Pipeline, coding→Iterative).

**Independent Test Criteria**: 100% accuracy in workflow selection for all three built-in taskTypes.

### Implementation

- [X] T030 [P] [US4] Implement TaskTypeClassifier in `src/agents/orchestration/task-type-classifier.ts`
- [X] T031 [P] [US4] Add keyword-based classification logic
- [X] T032 [US4] Implement taskType→workflow mapping (research→concurrent, refactor→pipeline, coding→iterative)
- [X] T033 [US4] Implement Orchestrator class in `src/agents/orchestration/orchestrator.ts`
- [X] T034 [US4] Add explicit taskType parameter support
- [X] T035 [US4] Add fallback to ConcurrentWorkflow for unknown types
- [X] T036 [US4] Create unit tests in `tests/orchestration/orchestrator.test.ts`

---

## Phase 7: User Story 5 - Custom Workflows & Composition

Compose complex workflows and register custom types.

**Story Goal**: Nest workflows within each other; register custom workflow types.

**Independent Test Criteria**: Pipeline with nested ConcurrentWorkflow executes correctly; custom workflow selectable via registry.

### Implementation

- [X] T037 [P] [US5] Implement WorkflowRegistry class in `src/agents/orchestration/workflow-registry.ts`
- [X] T038 [P] [US5] Add register(), get(), has(), list() methods
- [X] T039 [US5] Update Orchestrator to use registry for workflow selection
- [ ] T040 [US5] Add nested workflow execution support (Workflow as Task handler)
- [ ] T041 [US5] Add maxNestingDepth validation (default 5)
- [ ] T042 [US5] Create integration test for composed workflows in `tests/orchestration/composed-workflow.test.ts`

---

## Phase 8: Integration & Polish

Cross-cutting concerns and final integration.

**Goal**: Complete integration with existing orchestration module, export all types.

### Implementation

- [X] T043 Update `src/agents/orchestration/index.ts` to export all new types and classes
- [X] T044 Add integration test covering all workflows with SwarmController events
- [X] T045 Run full test suite (`pnpm test -- tests/orchestration/`)
- [X] T046 Run typecheck (`pnpm tsgo`)
- [X] T047 Run lint/format check (`pnpm check`)

---

## Dependency Graph

```
Phase 1 (Setup)
    │
    ▼
Phase 2 (Foundational) ◄──────────────┐
    │                                  │
    ├── T004-T008                      │
    │                                  │
    ▼                                  │
Phase 3 (US1: Concurrent)             │
    ├── T011-T016                      │
    │                                  │
    ▼                                  │
Phase 4 (US2: Pipeline) ───────────────┤
    ├── T017-T022                      │
    │                                  │
    ▼                                  │
Phase 5 (US3: Iterative) ──────────────┤
    ├── T023-T029                      │
    │                                  │
    ▼                                  │
Phase 6 (US4: Orchestrator) ───────────┤
    ├── T030-T036                      │
    │                                  │
    ▼                                  │
Phase 7 (US5: Custom) ◄─────────────────┘
    ├── T037-T042
    │
    ▼
Phase 8 (Integration)
    └── T043-T047
```

---

## Parallel Execution Opportunities

| Tasks     | Reason                                  |
| --------- | --------------------------------------- |
| T004-T008 | Independent type definitions in Phase 2 |
| T011-T012 | ConcurrentWorkflow core implementation  |
| T023-T024 | IterativeWorkflow core implementation   |
| T030-T031 | Classifier and keyword logic            |
| T037-T038 | Registry implementation                 |
| T017-T018 | PipelineWorkflow core implementation    |

---

## MVP Scope (Recommended)

**MVP**: Phase 3 (US1: ConcurrentWorkflow) - T011-T016

This provides the foundational parallel execution capability with immediate value. It:

- Works independently without other phases
- Has clear test criteria (120% of longest task time)
- Is the most commonly used pattern
- Validates the base Workflow interface and TaskGraph

---

## Validation Checklist

- [x] All tasks have checkbox prefix (`- [ ]`)
- [x] All tasks have Task ID (T001, T002, etc.)
- [x] User story tasks have [US1], [US2], etc. labels
- [x] Parallel tasks marked with [P]
- [x] All tasks have exact file paths
- [x] Tasks organized by phase (Setup → Foundational → User Stories → Integration)
- [x] Each user story has independent test criteria
- [x] Dependency graph shows completion order
- [x] MVP scope identified (Phase 3: US1)
