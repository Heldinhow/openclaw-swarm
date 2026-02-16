# OpenClaw Orchestration Fork - Technical Plan

## Overview

This plan outlines the implementation steps for enhancing OpenClaw's subagent orchestration capabilities. The fork adds context sharing and parallel execution while maintaining backward compatibility.

---

## Phase 1: Context Bridge (Orchestrator ↔ Subagent)

### Goal
Enable subagents to access relevant context from the orchestrator's session.

### Tasks

#### Task 1.1: Context Extraction Module
**Location:** `src/agents/orchestration/context-bridge.ts`

**Description:** Create a module to extract and compress context from the orchestrator's session.

**Implementation:**
- Extract conversation history from session store
- Implement message filtering (by time, tokens, content type)
- Add context compression using summarization
- Token budgeting to stay within limits

**Deliverables:**
- `extractSessionContext(sessionKey, options)` function
- `compressContext(messages, maxTokens)` function
- Unit tests

#### Task 1.2: Enhanced System Prompt Builder
**Location:** `src/agents/subagent-announce.ts` (modify)

**Description:** Extend `buildSubagentSystemPrompt` to inject context.

**Implementation:**
- Add `includeContext` parameter
- Generate context section in prompt
- Handle context overflow gracefully

**Deliverables:**
- Updated prompt builder
- E2E test for context injection

#### Task 1.3: sessions_spawn Tool Update
**Location:** `src/agents/tools/sessions-spawn-tool.ts`

**Description:** Add `contextSharing` options to the spawn tool.

**Implementation:**
- Add new parameters to schema
- Wire context extraction to spawn flow
- Add configuration validation

**Deliverables:**
- Updated tool with new options
- Documentation of new parameters

---

## Phase 2: Shared Context Store (Inter-Subagent)

### Goal
Enable sibling subagents to communicate and share data.

### Tasks

#### Task 2.1: Shared Context Store
**Location:** `src/agents/orchestration/shared-context-store.ts`

**Description:** Create a key-value store accessible by subagents with the same `sharedKey`.

**Implementation:**
- In-memory store with TTL support
- Persistence layer for crash recovery
- Access control (only same sharedKey can access)
- Event emission for real-time updates

**Deliverables:**
- `SharedContextStore` class
- `get`, `set`, `delete`, `subscribe` methods
- TTL cleanup mechanism

#### Task 2.2: Context Tool
**Location:** `src/agents/tools/context-tool.ts`

**Description:** Create tool for subagents to interact with shared context.

**Implementation:**
- `read` - Read shared data
- `write` - Write shared data
- `subscribe` - Subscribe to changes
- `broadcast` - Send event to subscribers

**Deliverables:**
- New `context` tool
- Tool schema and validation

#### Task 2.3: Subagent Registry Enhancement
**Location:** `src/agents/subagent-registry.ts`

**Description:** Track sharedKey relationships between subagents.

**Implementation:**
- Add `sharedKey` to `SubagentRunRecord`
- Query subagents by sharedKey
- Cleanup on parent completion

**Deliverables:**
- Updated registry
- List subagents by sharedKey

---

## Phase 3: Parallel Execution

### Goal
Enable spawning and coordinating multiple subagents for parallel work.

### Tasks

#### Task 3.1: Parallel Spawn Tool
**Location:** `src/agents/tools/parallel-spawn-tool.ts`

**Description:** Create tool to spawn multiple subagents simultaneously.

**Implementation:**
- Accept array of task definitions
- Spawn all tasks in parallel
- Implement wait strategies (all, any, race, count)
- Handle timeouts and errors

**Deliverables:**
- New `parallel_spawn` tool
- Schema with wait strategies

#### Task 3.2: Task Graph (Optional Enhancement)
**Location:** `src/agents/orchestration/task-graph.ts`

**Description:** Support task dependencies for complex workflows.

**Implementation:**
- Define tasks with dependencies
- Execute in topological order
- Pass outputs as inputs to dependent tasks

**Deliverables:**
- Task graph class
- Dependency resolution

#### Task 3.3: Result Aggregator
**Location:** `src/agents/orchestration/result-aggregator.ts`

**Description:** Combine results from parallel subagents.

**Implementation:**
- Aggregation strategies (concat, merge, custom)
- Error handling strategies
- Timeout handling

**Deliverables:**
- Aggregator functions
- Built-in combiners

---

## Phase 4: Configuration & Defaults

### Goal
Add configuration options for new features.

### Tasks

#### Task 4.1: Config Schema Updates
**Location:** `src/config/schema.ts` or similar

**Description:** Add new configuration options.

**Implementation:**
- Add `subagents.parallelMax`
- Add `subagents.contextSharing.*`
- Add `subagents.sharedContext.*`

**Deliverables:**
- Updated config schema
- Default values

#### Task 4.2: Documentation
**Description:** Document new features and configuration.

**Deliverables:**
- API documentation
- Configuration guide

---

## Implementation Order

```
Phase 1 (Context Bridge)
├── 1.1 Context Extraction Module
├── 1.2 System Prompt Enhancement  
└── 1.3 sessions_spawn Update

Phase 2 (Shared Context)
├── 2.1 Shared Context Store
├── 2.2 Context Tool
└── 2.3 Registry Enhancement

Phase 3 (Parallel Execution)
├── 3.1 Parallel Spawn Tool
├── 3.2 Task Graph (optional)
└── 3.3 Result Aggregator

Phase 4 (Configuration)
├── 4.1 Config Schema
└── 4.2 Documentation
```

---

## Technical Considerations

### Performance
- Context extraction should be lazy (only when needed)
- Shared context store should use efficient data structures
- Parallel spawn should limit concurrent executions

### Security
- Context sharing should respect privacy settings
- Shared context should be isolated by sharedKey
- No cross-session data leakage

### Backward Compatibility
- All new options have safe defaults
- Existing behavior unchanged without explicit opt-in
- Deprecation warnings for future changes

---

## Files to Modify

1. `src/agents/subagent-announce.ts` - Context injection
2. `src/agents/tools/sessions-spawn-tool.ts` - New parameters
3. `src/agents/subagent-registry.ts` - Track sharedKey

---

## Files to Create

1. `src/agents/orchestration/context-bridge.ts` ⭐
2. `src/agents/orchestration/shared-context-store.ts` ⭐
3. `src/agents/orchestration/parallel-executor.ts` ⭐
4. `src/agents/orchestration/task-graph.ts`
5. `src/agents/orchestration/result-aggregator.ts` ⭐
6. `src/agents/tools/context-tool.ts` ⭐
7. `src/agents/tools/parallel-spawn-tool.ts` ⭐
8. `src/config/agents-subagents.schema.ts` (or extend existing)

---

## Testing Plan

### Unit Tests
- Context extraction and compression
- Shared context CRUD operations
- Parallel spawn orchestration
- Result aggregation

### E2E Tests
- Context sharing between orchestrator and subagent
- Inter-subagent communication via sharedKey
- Parallel execution with various wait strategies
- Error handling and recovery

### Integration Tests
- Full workflow from spawn to result aggregation
- Performance under load
- Configuration validation

---

## Success Criteria

1. ✅ Subagents can access orchestrator context (configurable mode)
2. ✅ Sibling subagents share data via sharedKey
3. ✅ Multiple subagents execute in parallel
4. ✅ Results are aggregated correctly
5. ✅ All existing tests pass
6. ✅ No breaking changes to existing functionality
