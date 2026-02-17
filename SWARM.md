# OpenClaw Swarm Features Guide

This file documents the enhanced subagent orchestration features available in OpenClaw Swarm.

## Installation

```bash
# Clone the fork
git clone https://github.com/Heldinhow/openclaw-swarm.git
cd openclaw-swarm

# Install dependencies
pnpm install

# Build
pnpm build

# Run
pnpm openclaw gateway
```

**Note:** You must build the fork to enable Swarm features. Pre-built binaries are not available yet.

## Configuration

To enable subagent spawning, add to your config:

```json
{
  "agents": {
    "defaults": {
      "subagents": {
        "maxSpawnDepth": 2
      }
    }
  }
}
```

With `maxSpawnDepth: 2`:
- depth 1 subagents can spawn children
- depth 2 subagents are "leaf" (no spawning)

## Overview

OpenClaw Swarm adds 4 new capabilities to OpenClaw for advanced multi-agent workflows:

1. **Context Sharing** - Share parent session context with subagents
2. **Shared Context Store** - Share state between sibling subagents  
3. **Event-Driven Notifications** - Automatic completion notifications
4. **Parallel Execution** - Run multiple subagents simultaneously

---

## 1. Context Sharing

When spawning subagents, share context from the parent session.

### Parameters

| Parameter | Type | Values | Description |
|-----------|------|--------|-------------|
| `contextSharing` | string | `none`, `summary`, `recent`, `full` | How much context to share |

### Values

- **`none`** - No context (default)
- **`summary`** - Compressed summary of conversation
- **`recent`** - Last 10 messages
- **`full`** - Complete history

### Example

```typescript
sessions_spawn({
  label: "analyze-code",
  task: "Review this code for bugs",
  contextSharing: "recent"
})
```

---

## 2. Shared Context Store

Share data between subagents using `context_store`.

### Actions

| Action | Description |
|--------|-------------|
| `set` | Store a value |
| `get` | Retrieve a value |
| `delete` | Remove a value |
| `list` | List all keys in namespace |
| `subscribe` | Subscribe to changes |
| `broadcast` | Broadcast to subscribers |

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | string | Yes | Action to perform |
| `namespace` | string | Yes | Isolated data bucket |
| `key` | string | Yes (except list) | Data key |
| `value` | any | Yes (for set) | Data to store |
| `ttl` | number | No | Time-to-live in ms |

### Examples

**Write:**
```typescript
context_store({
  action: "set",
  namespace: "project-alpha",
  key: "analysis-result",
  value: { bugs: 3, severity: "high" }
})
```

**Read:**
```typescript
context_store({
  action: "get",
  namespace: "project-alpha", 
  key: "analysis-result"
})
```

**List:**
```typescript
context_store({
  action: "list",
  namespace: "project-alpha"
})
```

---

## 3. Event-Driven Notifications

Publish events when subagents complete using `context_publish`.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | string | Yes | Must be `publish` |
| `eventType` | string | Yes | Event type |
| `target` | string | Yes | Target (usually `orchestrator`) |
| `data` | any | Yes | Event payload |

### Event Types

- **`task_complete`** - Subagent finished successfully
- **`task_progress`** - Progress update
- **`task_error`** - Error occurred
- **`handoff`** - Transfer to another agent

### Example

```typescript
context_publish({
  action: "publish",
  eventType: "task_complete",
  target: "orchestrator",
  data: { result: "Found 3 bugs", severity: "high" }
})
```

### Auto-Announce

When a subagent completes, the system automatically announces to the parent:

```
✅ Sub-agent completed: analyze-code
   task: Review this code for bugs
   result: Found 3 bugs, severity: high
   runtime: 12s
   sessionKey: agent:main:subagent:...
```

---

## 4. Parallel Execution

Run multiple subagents in parallel using `parallel_spawn`.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tasks` | array | Yes | Array of task objects |
| `wait` | string | Yes | Wait strategy |

### Task Object

```typescript
{
  label: string,      // Task identifier
  task: string,       // Task description
  model?: string,     // Optional model override
}
```

### Wait Strategies

| Strategy | Behavior |
|----------|----------|
| `all` | Wait for all tasks to complete |
| `any` | Return when first task completes, others continue |
| `race` | Return when first task completes, cancel others |
| `number` | Wait for N tasks to complete |

### Examples

**Wait for all:**
```typescript
parallel_spawn({
  tasks: [
    { label: "task1", task: "Do this" },
    { label: "task2", task: "Do that" }
  ],
  wait: "all"
})
```

**Return on first:**
```typescript
parallel_spawn({
  tasks: [
    { label: "fast", task: "Quick task" },
    { label: "slow", task: "Slow task" }
  ],
  wait: "any"
})
```

---

## Complete Workflow Example

```typescript
// 1. Set shared data
context_store({
  action: "set",
  namespace: "analysis",
  key: "code",
  value: "function add(a,b){return a+b}"
})

// 2. Spawn parallel subagents
parallel_spawn({
  tasks: [
    { 
      label: "syntax-check", 
      task: "Check for syntax errors",
      contextSharing: "recent"
    },
    { 
      label: "security-scan", 
      task: "Check for security issues",
      contextSharing: "recent" 
    }
  ],
  wait: "all"
})

// 3. Subagents use context_store to share results
// 4. Auto-announce when each completes
```

---

## Tool Summary

| Tool | Purpose |
|------|---------|
| `sessions_spawn` | Create subagent with optional context |
| `context_store` | Share state between subagents |
| `context_publish` | Publish completion events |
| `parallel_spawn` | Run multiple subagents in parallel |
