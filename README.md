# OpenClaw Swarm

Fork of OpenClaw with advanced subagent orchestration tools.

## Features

### 1. Context Sharing (`contextSharing`)

Share parent session context with subagents.

```typescript
sessions_spawn({
  label: "my-subagent",
  task: "Do something",
  contextSharing: "recent" // none | summary | recent | full
})
```

- **none**: No context
- **summary**: Compressed summary
- **recent**: Last messages
- **full**: Full history

### 2. Shared Context Store (`context_store`)

Share state between subagents (siblings).

```typescript
// Write
context_store({
  action: "set",
  namespace: "my-project",
  key: "data",
  value: { result: "ok" }
})

// Read
context_store({
  action: "get",
  namespace: "my-project",
  key: "data"
})
```

**Features:**
- TTL (time-to-live)
- Isolated namespaces
- Pub/Sub via `subscribe`/`broadcast`

### 3. Event-Driven Notifications (`context_publish`)

Notify orchestrator when subagents complete.

```typescript
context_publish({
  action: "publish",
  eventType: "task_complete", // task_complete | task_progress | task_error | handoff
  target: "orchestrator",
  data: { result: "ok" }
})
```

**Auto-announce**: System automatically notifies when subagent completes.

```
✅ Sub-agent completed: label
   task: ...
   result: ...
   runtime: Xs
   sessionKey: ...
```

### 4. Parallel Execution (`parallel_spawn`)

Run multiple subagents in parallel with different wait strategies.

```typescript
parallel_spawn({
  tasks: [
    { label: "task1", task: "Do this" },
    { label: "task2", task: "Do that" }
  ],
  wait: "all" // all | any | race | number
})
```

| Strategy | Behavior |
|---------|----------|
| `all` | Wait for all to complete |
| `any` | Return on first, others continue |
| `race` | Return on first |

## Installation

```bash
# Clone the fork
git clone https://github.com/Heldinhow/openclaw-swarm.git
cd openclaw-swarm

# Build
pnpm install
pnpm build

# Or use the code directly from /usr/lib/node_modules/openclaw/
```

## Status

- ✅ `sessions_spawn` with contextSharing
- ✅ `context_store` (get, set, delete, list, subscribe, broadcast)
- ✅ `context_publish` (task_complete, task_progress, task_error, handoff)
- ✅ Auto-announce for subagents
- ✅ `parallel_spawn` (all, any, race)

## Differences from Original OpenClaw

| Feature | Original | Swarm |
|---------|----------|-------|
| Context sharing | ❌ | ✅ |
| Siblings communication | ❌ | ✅ |
| Auto-notify | ❌ | ✅ |
| Parallel spawn | ❌ | ✅ |

## Author

Helder (@Heldinhow)
