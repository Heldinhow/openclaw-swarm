# OpenClaw Orchestration Fork - Specification

## Project Overview

**Project Name:** OpenClaw Orchestration Fork  
**Type:** Feature Extension (Fork)  
**Core Functionality:** Enhanced subagent orchestration with shared context and parallel execution  
**Target Users:** Power users and developers who need complex multi-agent workflows

---

## Problem Statement

Current OpenClaw `sessions_spawn` has limitations:
1. **Isolated Context**: Subagents start fresh with no access to orchestrator's context
2. **No Inter-Subagent Communication**: Subagents cannot share results mid-execution
3. **Sequential by Nature**: Only one subagent runs at a time; results block next spawns
4. **No Dependency Management**: Cannot express "run A and B in parallel, then combine results"

---

## Functional Requirements

### FR-1: Context Injection (Orchestrator → Subagent)

**Description:** Allow the orchestrator to inject context into subagents at spawn time.

**Parameters (new in sessions_spawn):**
- `context?: ContextInjection`
  - `includeHistory?: boolean` - Include recent conversation history
  - `includeFiles?: string[]` - Specific files to inject
  - `includeMemory?: string` - Named memory/context to inject
  - `maxTokens?: number` - Context window budget

**Behavior:**
- Context is injected as a system message at the start of the subagent session
- Includes orchestrator's current task context and relevant findings
- Respects token limits; uses summarization if needed

---

### FR-2: Context Publication (Subagent → Orchestrator)

**Description:** Subagents can publish context/results during execution.

**New Tool: `context_publish`**
```typescript
{
  target: "orchestrator" | "session:<key>" | "broadcast",
  data: any,  // Serializable context
  priority?: "low" | "normal" | "high",
  persistent?: boolean  // Store in shared context store
}
```

**Behavior:**
- Published data goes to the orchestrator's inbox
- Orchestrator can subscribe to subagent events
- Optional persistence allows later retrieval

---

### FR-3: Shared Context Store

**Description:** A key-value store accessible by all participants in an orchestration.

**New Tool: `context_store`**
```typescript
{
  action: "get" | "set" | "delete" | "list",
  namespace: string,  // Orchestration scope
  key: string,
  value?: any,
  ttl?: number  // Time to live in seconds
}
```

**Storage:**
- In-memory with optional persistence
- Scoped to orchestration (namespace)
- TTL for automatic cleanup

---

### FR-4: Parallel Execution Groups

**Description:** Spawn multiple subagents that run concurrently.

**New Parameter for sessions_spawn (batch mode):**
```typescript
{
  task: string | TaskGroup,
  // TaskGroup:
  {
    parallel: SubagentTask[],  // Run concurrently
    then?: SubagentTask | TaskGroup  // Run after all parallel complete
  }
}

interface SubagentTask {
  id: string,  // Unique identifier for result lookup
  task: string,
  label?: string,
  model?: string,
  context?: ContextInjection,
  dependsOn?: string[]  // Wait for these task IDs
}
```

**Behavior:**
- `parallel` array: All tasks start simultaneously
- `dependsOn`: Task waits for specified tasks to complete before starting
- `then`: Runs after all parallel tasks complete (receives their results)

---

### FR-5: Aggregation of Results

**Description:** Automatically combine results from parallel subagents.

**Behavior:**
- Results are collected and keyed by task `id`
- Passed to `then` tasks as structured input
- Aggregator can be customized (concat, merge, custom function)

---

### FR-6: Real-time Status Tracking

**Description:** Track status of all subagents in an orchestration.

**Enhanced sessions_list:**
- Filter: `orchestrationId?: string`
- New fields: `parentId`, `orchestrationStatus`, `dependsOn`

**New Tool: `orchestration_status`**
```typescript
{
  orchestrationId: string,
  // Returns:
  {
    status: "running" | "completed" | "failed" | "partial",
    tasks: TaskStatus[],
    aggregatedResult?: any
  }
}
```

---

## Configuration

### New Config Section

```json
{
  "orchestration": {
    "enabled": true,
    "maxParallel": 5,
    "defaultContextTokens": 8000,
    "resultAggregation": "merge",
    "sharedStore": {
      "enabled": true,
      "maxSize": "10mb",
      "ttl": 3600
    }
  }
}
```

---

## API Changes

### Modified Tools

| Tool | Change |
|------|--------|
| `sessions_spawn` | New params: `context`, `id`, `dependsOn`, `parallel`, `then` |
| `sessions_list` | New filters: `orchestrationId`; new fields in response |
| `sessions_send` | New param: `orchestrationId` for context routing |

### New Tools

| Tool | Purpose |
|------|---------|
| `context_publish` | Publish context to orchestrator/other sessions |
| `context_store` | Shared key-value store for orchestration |
| `orchestration_status` | Get status of orchestration run |

---

## User Experience

### Before (Current)
```
User: "Research three topics and summarize"
Agent: Spawns subagent 1 → waits → spawns subagent 2 → waits → spawns subagent 3 → waits → combines
```

### After (New)
```
User: "Research three topics and summarize"
Agent: Spawns 3 parallel subagents → all run simultaneously → collects results → summarizes
```

### Context Flow
```
┌─────────────┐     context injection      ┌─────────────┐
│ Orchestrator│ ──────────────────────────→│  Subagent A │
│             │ ←─── context publication ──│             │
└─────────────┘                             └─────────────┘
       │                                           │
       │         shared context store              │
       └──────────────── ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
                           │
       ┌───────────────────┼───────────────────┐
       ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Subagent B │     │  Subagent C │     │  Subagent D │
│             │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
```

---

## Acceptance Criteria

### AC-1: Context Injection Works
- [ ] Subagent receives injected context at spawn
- [ ] Context includes files, history, and named context
- [ ] Token limits are respected

### AC-2: Context Publication Works
- [ ] Subagent can publish to orchestrator
- [ ] Orchestrator receives published context
- [ ] Published data is accessible via context_store

### AC-3: Parallel Execution Works
- [ ] Multiple subagents run simultaneously
- [ ] Dependencies are respected
- [ ] Results are aggregated correctly

### AC-4: Backward Compatibility
- [ ] Existing sessions_spawn calls work unchanged
- [ ] No breaking changes to other tools

### AC-5: Performance
- [ ] Parallel execution doesn't block main agent
- [ ] Context sharing adds <500ms latency
- [ ] Memory usage is bounded

---

## Out of Scope

- Multi-agent debates or consensus mechanisms
- Hierarchical agent structures (agents spawning agents)
- Cross-orchestration context sharing
- Persistent orchestration state beyond session scope
