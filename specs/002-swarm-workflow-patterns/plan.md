# Implementation Plan: Swarm Workflow Patterns

**Branch**: `002-swarm-workflow-patterns` | **Date**: 2026-02-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-swarm-workflow-patterns/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add formal Workflow patterns to openclaw-swarm with three implementations (ConcurrentWorkflow, PipelineWorkflow, IterativeWorkflow). Each workflow builds a TaskGraph to define execution order and integrates with the existing SwarmController for event publishing. The Orchestrator auto-selects workflow strategy based on task type (coding→Iterative, research→Concurrent, refactor→Pipeline). Architecture supports custom workflows via registry.

## Technical Context

**Language/Version**: TypeScript (ESM), Node.js 22+  
**Primary Dependencies**: Existing orchestration modules (EventBus, EventLog, SwarmController, context_store)  
**Storage**: N/A (in-memory workflow state with context_store for inter-task data)  
**Testing**: Vitest (per AGENTS.md)  
**Target Platform**: Node.js (server-side orchestration)  
**Project Type**: Single project - TypeScript module extension under `src/agents/orchestration/`  
**Performance Goals**: Sub-second workflow initiation; parallel tasks complete within 120% of longest single task  
**Constraints**: Max 50 tasks per workflow, max 5 nested workflow depth (configurable)  
**Scale/Scope**: 3 workflow types + registry for custom; ~6 new source files

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

**Note**: No constitution.md found in this repository. Skipping constitution gates.

## Project Structure

### Documentation (this feature)

```
specs/002-swarm-workflow-patterns/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
src/agents/orchestration/
├── workflow.ts                    # Base Workflow interface
├── task-graph.ts                 # TaskGraph DAG class
├── workflow-registry.ts          # Custom workflow registry
├── concurrent-workflow.ts         # Parallel execution pattern
├── pipeline-workflow.ts           # Sequential chaining pattern
├── iterative-workflow.ts         # Loop pattern
├── orchestrator.ts               # Workflow strategy selector
└── index.ts                     # Module exports

tests/
└── orchestration/
    ├── workflow.test.ts
    ├── task-graph.test.ts
    ├── concurrent-workflow.test.ts
    ├── pipeline-workflow.test.ts
    ├── iterative-workflow.test.ts
    └── orchestrator.test.ts
```

**Structure Decision**: Extending existing `src/agents/orchestration/` module with new workflow classes. Tests colocated in `tests/orchestration/` following existing pattern.

## Phase 0: Research

### Research Tasks

1. **TaskGraph DAG implementation patterns** - Research best practices for directed acyclic graph implementations in TypeScript/Node.js
2. **Workflow composition patterns** - Research how to compose nested workflows (pipeline containing concurrent)
3. **Task type classification heuristics** - Research keyword-based task type detection for fallback when explicit taskType not provided
