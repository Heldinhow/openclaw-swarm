# Specification - OpenClaw Orchestration Fork

## Project Overview

**Project Name:** OpenClaw Orchestration Fork  
**Type:** Software Feature Extension  
**Core Functionality:** Enhance subagent orchestration with context sharing and parallel execution capabilities  
**Target Users:** Developers using OpenClaw for multi-agent workflows  

---

## Problem Statement

Current OpenClaw subagent system has these limitations:
1. **Limited context inheritance** - Subagents receive basic session info but lack rich context from parent
2. **No peer-to-peer context** - Subagents cannot share state directly with siblings
3. **Sequential by default** - Parallel execution is possible but not well-coordinated
4. **Flat hierarchy** - No support for complex agent trees with context propagation

---

## Functional Requirements

### FR-01: Context Propagation System

**FR-01.1** - Subagents shall receive a context snapshot from the orchestrator at spawn time  
- Include: session history (last N messages), memory excerpts, active tool states, variables

**FR-01.2** - Orchestrator shall be able to filter what context is shared (whitelist/blacklist)

**FR-01.3** - Context updates from subagents shall be propagated back to orchestrator
- Use event-driven updates (not polling)
- Support for both final results and incremental updates

**FR-01.4** - Context shall be serializable for persistence and cross-process scenarios

### FR-02: Inter-Subagent Context Sharing

**FR-02.1** - Subagents shall be able to discover sibling subagents (same parent)

**FR-02.2** - Subagents shall be able to read/write to a shared context namespace
- Implement a SharedContext namespace per parent session
- Support read, write, and subscribe operations

**FR-02.3** - Subagents shall be able to send messages directly to siblings
- Use a message bus pattern for inter-agent communication
- Support request/response and fire-and-forget patterns

### FR-03: Parallel Execution Framework

**FR-03.1** - Orchestrator shall be able to spawn multiple subagents simultaneously
- New command: `/parallel` or spawn multiple via API
- Return immediately with a "task group" ID

**FR-03.2** - System shall track parallel task groups and their status
- States: pending, running, completed, failed, partial

**FR-03.3** - Orchestrator shall be able to wait for all parallel tasks or first completion
- `/wait` command for synchronization

**FR-03.4** - Results from parallel tasks shall be aggregatable
- Support aggregation functions: concat, merge, first, last, custom

### FR-04: Enhanced Registry & Relationships

**FR-04.1** - Registry shall track parent-child relationships explicitly
- New field: `parentRunId` in SubagentRunRecord

**FR-04.2** - Registry shall support sibling relationships
- Query: list all subagents with same parent

**FR-04.3** - Support for hierarchical context depth limits
- Prevent infinite context propagation loops

### FR-05: Commands & API

**FR-05.1** - New command `/parallel <spec>` - spawn parallel subagents
```
/parallel
- label: research
  task: Research {topic}
- label: summarize  
  task: Summarize findings
```

**FR-05.2** - New command `/context share <subagent> <key> <value>` - share context

**FR-05.3** - New command `/context read <subagent> <key>` - read shared context

**FR-05.4** - New command `/wait <task-group-id>` - wait for parallel tasks

**FR-05.5** - New command `/broadcast <message>` - send to all siblings

---

## Technical Architecture

### Data Structures

```typescript
// Extended SubagentRunRecord
interface SubagentRunRecord {
  // ... existing fields
  parentRunId?: string;
  taskGroupId?: string;
  contextSnapshot?: ContextSnapshot;
  sharedNamespace?: string;
}

interface ContextSnapshot {
  history: Message[];
  memory: MemoryExcerpt[];
  variables: Record<string, unknown>;
  tools: ToolState[];
  depth: number;
}

interface TaskGroup {
  id: string;
  parentSessionKey: string;
  subagentRunIds: string[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'partial';
  createdAt: number;
  completedAt?: number;
}

interface SharedContext {
  namespace: string;
  data: Record<string, unknown>;
  subscribers: Set<string>;
}
```

### Components

1. **ContextPropagationService** - Handles context snapshot creation and propagation
2. **SharedContextManager** - Manages shared namespaces between siblings
3. **ParallelExecutionCoordinator** - Coordinates parallel task spawning and waiting
4. **TaskGroupRegistry** - Tracks task groups and their status
5. **InterAgentMessageBus** - Message routing between subagents

---

## Acceptance Criteria

### AC-01: Context Propagation
- [ ] Subagent spawned receives last 10 messages from parent context
- [ ] Custom context can be passed via spawn parameters
- [ ] Context updates propagate back to parent within 5 seconds
- [ ] Context serialization works across process restarts

### AC-02: Inter-Subagent Sharing
- [ ] Sibling subagents can discover each other
- [ ] Write to shared namespace is visible to all siblings within 1 second
- [ ] Unsubscribe works correctly

### AC-03: Parallel Execution
- [ ] Spawning 3 subagents in parallel returns immediately
- [ ] Task group shows correct aggregate status
- [ ] Waiting for all completes when all finish
- [ ] Waiting for first completes when one finishes

### AC-04: Backward Compatibility
- [ ] Existing /subagents commands work unchanged
- [ ] Existing /kill, /steer, /tell work unchanged
- [ ] Registry format is backward compatible (optional fields added)

---

## Out of Scope (v1)

- Cross-instance/context subagent communication
- Complex consensus algorithms
- Hierarchical agent teams with role assignment
- Automatic context optimization (LLM-based summarization)
