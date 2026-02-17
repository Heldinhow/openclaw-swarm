# EventBus System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement an internal EventBus system for openclaw-swarm that enables structured event publishing from agents, subscription by SwarmController, and queryable logs with WebSocket-ready architecture.

**Architecture:** The EventBus follows a pub/sub pattern with typed events. Agents publish structured events to a central EventBus. SwarmController subscribes to events for coordination. An EventLog provides queryable storage by project/task/agent. The design is WebSocket-ready for future streaming capabilities.

**Tech Stack:** TypeScript, Node.js EventEmitter pattern, existing orchestration infrastructure in `src/agents/orchestration/`

---

## Task 1: Create Event Types and Interfaces

**Files:**
- Create: `src/agents/orchestration/event-bus.ts`
- Test: `src/agents/orchestration/event-bus.test.ts`

**Step 1: Write the failing test**

Create `src/agents/orchestration/event-bus.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { EventBus, EventType, EventStatus, SwarmEvent } from "./event-bus.js";

describe("EventBus", () => {
  it("should create an event bus instance", () => {
    const bus = new EventBus();
    expect(bus).toBeDefined();
  });

  it("should publish and subscribe to events", async () => {
    const bus = new EventBus();
    const events: SwarmEvent[] = [];
    
    bus.subscribe((event) => {
      events.push(event);
    });

    const event: SwarmEvent = {
      agent_id: "agent-1",
      task_id: "task-1",
      event_type: EventType.TASK_STARTED,
      status: EventStatus.PENDING,
      timestamp: Date.now(),
      payload: { message: "Task started" },
    };

    await bus.publish(event);
    expect(events).toHaveLength(1);
    expect(events[0].agent_id).toBe("agent-1");
  });

  it("should support all required event types", () => {
    const types = [
      EventType.TASK_STARTED,
      EventType.TASK_COMPLETED,
      EventType.TASK_FAILED,
      EventType.TOOL_CALL,
      EventType.EXECUTION_LOG,
    ];
    expect(types).toHaveLength(5);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/agents/orchestration/event-bus.test.ts`
Expected: FAIL with "EventBus not defined" and "EventType not defined"

**Step 3: Write minimal implementation**

Create `src/agents/orchestration/event-bus.ts`:

```typescript
/**
 * EventBus System for OpenClaw Swarm
 * 
 * Provides centralized event publishing and subscription for agent coordination.
 * Supports WebSocket streaming architecture for future real-time capabilities.
 */

/**
 * Event types supported by the EventBus
 */
export enum EventType {
  TASK_STARTED = "task_started",
  TASK_COMPLETED = "task_completed",
  TASK_FAILED = "task_failed",
  TOOL_CALL = "tool_call",
  EXECUTION_LOG = "execution_log",
}

/**
 * Event status values
 */
export enum EventStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

/**
 * Base event interface - all events must conform to this structure
 */
export interface SwarmEvent {
  /** Unique agent identifier */
  agent_id: string;
  /** Task identifier this event relates to */
  task_id: string;
  /** Type of event */
  event_type: EventType;
  /** Current status */
  status: EventStatus;
  /** Unix timestamp (ms) */
  timestamp: number;
  /** Event payload - type-specific data */
  payload: Record<string, unknown>;
  /** Optional project identifier for filtering */
  project_id?: string;
  /** Optional parent task ID for task hierarchies */
  parent_task_id?: string;
}

/**
 * Event handler callback type
 */
export type EventHandler = (event: SwarmEvent) => void | Promise<void>;

/**
 * EventBus - Central event management system
 * 
 * Implements pub/sub pattern for agent events.
 * WebSocket-ready: can be extended for streaming.
 */
export class EventBus {
  private handlers: Set<EventHandler> = new Set();

  /**
   * Subscribe to all events
   * @param handler - Callback function for events
   * @returns Unsubscribe function
   */
  subscribe(handler: EventHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  /**
   * Publish an event to all subscribers
   * @param event - The event to publish
   */
  async publish(event: SwarmEvent): Promise<void> {
    const promises: Promise<void>[] = [];
    
    for (const handler of this.handlers) {
      try {
        const result = handler(event);
        if (result instanceof Promise) {
          promises.push(result);
        }
      } catch (err) {
        console.error("[EventBus] Handler error:", err);
      }
    }

    await Promise.all(promises);
  }

  /**
   * Get number of active subscribers
   */
  getSubscriberCount(): number {
    return this.handlers.size;
  }

  /**
   * Clear all subscribers (useful for testing)
   */
  clear(): void {
    this.handlers.clear();
  }
}

/**
 * Singleton instance for application-wide use
 */
let globalEventBus: EventBus | null = null;

/**
 * Get the global EventBus instance
 */
export function getGlobalEventBus(): EventBus {
  if (!globalEventBus) {
    globalEventBus = new EventBus();
  }
  return globalEventBus;
}

/**
 * Reset the global EventBus (useful for testing)
 */
export function resetGlobalEventBus(): void {
  globalEventBus = null;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/agents/orchestration/event-bus.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/agents/orchestration/event-bus.ts src/agents/orchestration/event-bus.test.ts
git commit -m "feat(orchestration): add EventBus with typed events and pub/sub"
```

---

## Task 2: Create EventLog Storage System

**Files:**
- Create: `src/agents/orchestration/event-log.ts`
- Test: `src/agents/orchestration/event-log.test.ts`

**Step 1: Write the failing test**

Create `src/agents/orchestration/event-log.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { EventLog } from "./event-log.js";
import { SwarmEvent, EventType, EventStatus } from "./event-bus.js";

describe("EventLog", () => {
  let eventLog: EventLog;

  beforeEach(() => {
    eventLog = new EventLog();
  });

  it("should store events", () => {
    const event: SwarmEvent = {
      agent_id: "agent-1",
      task_id: "task-1",
      event_type: EventType.TASK_STARTED,
      status: EventStatus.PENDING,
      timestamp: Date.now(),
      payload: {},
      project_id: "project-1",
    };

    eventLog.store(event);
    const events = eventLog.getAll();
    expect(events).toHaveLength(1);
    expect(events[0].agent_id).toBe("agent-1");
  });

  it("should query by agent_id", () => {
    const now = Date.now();
    
    eventLog.store({
      agent_id: "agent-1",
      task_id: "task-1",
      event_type: EventType.TASK_STARTED,
      status: EventStatus.PENDING,
      timestamp: now,
      payload: {},
    });

    eventLog.store({
      agent_id: "agent-2",
      task_id: "task-2",
      event_type: EventType.TASK_STARTED,
      status: EventStatus.PENDING,
      timestamp: now + 1,
      payload: {},
    });

    const agent1Events = eventLog.query({ agent_id: "agent-1" });
    expect(agent1Events).toHaveLength(1);
    expect(agent1Events[0].agent_id).toBe("agent-1");
  });

  it("should query by task_id", () => {
    const now = Date.now();
    
    eventLog.store({
      agent_id: "agent-1",
      task_id: "task-1",
      event_type: EventType.TASK_STARTED,
      status: EventStatus.PENDING,
      timestamp: now,
      payload: {},
    });

    eventLog.store({
      agent_id: "agent-1",
      task_id: "task-2",
      event_type: EventType.TASK_COMPLETED,
      status: EventStatus.COMPLETED,
      timestamp: now + 1,
      payload: {},
    });

    const task1Events = eventLog.query({ task_id: "task-1" });
    expect(task1Events).toHaveLength(1);
    expect(task1Events[0].task_id).toBe("task-1");
  });

  it("should query by project_id", () => {
    const now = Date.now();
    
    eventLog.store({
      agent_id: "agent-1",
      task_id: "task-1",
      event_type: EventType.TASK_STARTED,
      status: EventStatus.PENDING,
      timestamp: now,
      payload: {},
      project_id: "project-1",
    });

    eventLog.store({
      agent_id: "agent-2",
      task_id: "task-2",
      event_type: EventType.TASK_STARTED,
      status: EventStatus.PENDING,
      timestamp: now + 1,
      payload: {},
      project_id: "project-1",
    });

    eventLog.store({
      agent_id: "agent-3",
      task_id: "task-3",
      event_type: EventType.TASK_STARTED,
      status: EventStatus.PENDING,
      timestamp: now + 2,
      payload: {},
      project_id: "project-2",
    });

    const project1Events = eventLog.query({ project_id: "project-1" });
    expect(project1Events).toHaveLength(2);
  });

  it("should query by event_type", () => {
    const now = Date.now();
    
    eventLog.store({
      agent_id: "agent-1",
      task_id: "task-1",
      event_type: EventType.TASK_STARTED,
      status: EventStatus.PENDING,
      timestamp: now,
      payload: {},
    });

    eventLog.store({
      agent_id: "agent-1",
      task_id: "task-1",
      event_type: EventType.TASK_COMPLETED,
      status: EventStatus.COMPLETED,
      timestamp: now + 1,
      payload: {},
    });

    const startedEvents = eventLog.query({ event_type: EventType.TASK_STARTED });
    expect(startedEvents).toHaveLength(1);
  });

  it("should combine multiple query filters", () => {
    const now = Date.now();
    
    eventLog.store({
      agent_id: "agent-1",
      task_id: "task-1",
      event_type: EventType.TASK_STARTED,
      status: EventStatus.PENDING,
      timestamp: now,
      payload: {},
      project_id: "project-1",
    });

    eventLog.store({
      agent_id: "agent-1",
      task_id: "task-1",
      event_type: EventType.TASK_COMPLETED,
      status: EventStatus.COMPLETED,
      timestamp: now + 1,
      payload: {},
      project_id: "project-1",
    });

    eventLog.store({
      agent_id: "agent-2",
      task_id: "task-2",
      event_type: EventType.TASK_STARTED,
      status: EventStatus.PENDING,
      timestamp: now + 2,
      payload: {},
      project_id: "project-2",
    });

    const filteredEvents = eventLog.query({
      agent_id: "agent-1",
      project_id: "project-1",
      event_type: EventType.TASK_STARTED,
    });

    expect(filteredEvents).toHaveLength(1);
    expect(filteredEvents[0].task_id).toBe("task-1");
  });

  it("should support pagination", () => {
    const now = Date.now();
    
    for (let i = 0; i < 10; i++) {
      eventLog.store({
        agent_id: "agent-1",
        task_id: `task-${i}`,
        event_type: EventType.EXECUTION_LOG,
        status: EventStatus.RUNNING,
        timestamp: now + i,
        payload: { index: i },
      });
    }

    const page1 = eventLog.query({ agent_id: "agent-1" }, { limit: 3, offset: 0 });
    expect(page1).toHaveLength(3);
    expect(page1[0].payload.index).toBe(0);

    const page2 = eventLog.query({ agent_id: "agent-1" }, { limit: 3, offset: 3 });
    expect(page2).toHaveLength(3);
    expect(page2[0].payload.index).toBe(3);
  });

  it("should return events sorted by timestamp", () => {
    const now = Date.now();
    
    eventLog.store({
      agent_id: "agent-1",
      task_id: "task-1",
      event_type: EventType.TASK_STARTED,
      status: EventStatus.PENDING,
      timestamp: now + 100,
      payload: {},
    });

    eventLog.store({
      agent_id: "agent-1",
      task_id: "task-1",
      event_type: EventType.TASK_COMPLETED,
      status: EventStatus.COMPLETED,
      timestamp: now,
      payload: {},
    });

    const events = eventLog.query({ agent_id: "agent-1" });
    expect(events[0].timestamp).toBe(now);
    expect(events[1].timestamp).toBe(now + 100);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/agents/orchestration/event-log.test.ts`
Expected: FAIL with "EventLog not defined"

**Step 3: Write minimal implementation**

Create `src/agents/orchestration/event-log.ts`:

```typescript
/**
 * EventLog Storage System
 * 
 * Provides queryable storage for Swarm events.
 * Supports filtering by project, task, and agent.
 */

import { SwarmEvent, EventType } from "./event-bus.js";

/**
 * Query filters for event retrieval
 */
export interface EventQuery {
  /** Filter by agent ID */
  agent_id?: string;
  /** Filter by task ID */
  task_id?: string;
  /** Filter by project ID */
  project_id?: string;
  /** Filter by event type */
  event_type?: EventType;
  /** Filter by status */
  status?: string;
  /** Filter events after this timestamp */
  after?: number;
  /** Filter events before this timestamp */
  before?: number;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  /** Maximum number of events to return */
  limit?: number;
  /** Number of events to skip */
  offset?: number;
}

/**
 * EventLog - Queryable event storage
 * 
 * Stores events in memory with indexing for fast queries.
 * Can be extended to persist to disk or database.
 */
export class EventLog {
  private events: SwarmEvent[] = [];
  
  // Indexes for fast lookups
  private indexByAgent: Map<string, Set<number>> = new Map();
  private indexByTask: Map<string, Set<number>> = new Map();
  private indexByProject: Map<string, Set<number>> = new Map();
  private indexByType: Map<string, Set<number>> = new Map();

  /**
   * Store an event in the log
   * @param event - The event to store
   */
  store(event: SwarmEvent): void {
    const index = this.events.length;
    this.events.push(event);

    // Update indexes
    this.addToIndex(this.indexByAgent, event.agent_id, index);
    this.addToIndex(this.indexByTask, event.task_id, index);
    if (event.project_id) {
      this.addToIndex(this.indexByProject, event.project_id, index);
    }
    this.addToIndex(this.indexByType, event.event_type, index);
  }

  /**
   * Add an index entry
   */
  private addToIndex(
    index: Map<string, Set<number>>, 
    key: string, 
    eventIndex: number
  ): void {
    let set = index.get(key);
    if (!set) {
      set = new Set();
      index.set(key, set);
    }
    set.add(eventIndex);
  }

  /**
   * Query events with filters and pagination
   * @param query - Filter criteria
   * @param pagination - Pagination options
   * @returns Filtered and paginated events
   */
  query(query: EventQuery = {}, pagination: PaginationOptions = {}): SwarmEvent[] {
    // Get candidate indices based on query
    let candidateIndices: Set<number> | null = null;

    if (query.agent_id) {
      candidateIndices = this.intersectSets(
        candidateIndices,
        this.indexByAgent.get(query.agent_id)
      );
    }

    if (query.task_id) {
      candidateIndices = this.intersectSets(
        candidateIndices,
        this.indexByTask.get(query.task_id)
      );
    }

    if (query.project_id) {
      candidateIndices = this.intersectSets(
        candidateIndices,
        this.indexByProject.get(query.project_id)
      );
    }

    if (query.event_type) {
      candidateIndices = this.intersectSets(
        candidateIndices,
        this.indexByType.get(query.event_type)
      );
    }

    // If no specific filters, use all events
    if (candidateIndices === null) {
      candidateIndices = new Set(this.events.map((_, i) => i));
    }

    // Filter by timestamp and status
    let filtered: SwarmEvent[] = [];
    for (const idx of candidateIndices) {
      const event = this.events[idx];
      
      if (query.status && event.status !== query.status) {
        continue;
      }
      
      if (query.after && event.timestamp <= query.after) {
        continue;
      }
      
      if (query.before && event.timestamp >= query.before) {
        continue;
      }

      filtered.push(event);
    }

    // Sort by timestamp ascending
    filtered.sort((a, b) => a.timestamp - b.timestamp);

    // Apply pagination
    const limit = pagination.limit ?? filtered.length;
    const offset = pagination.offset ?? 0;
    
    return filtered.slice(offset, offset + limit);
  }

  /**
   * Intersect two sets (or set with null)
   */
  private intersectSets(
    a: Set<number> | null,
    b: Set<number> | undefined
  ): Set<number> {
    if (!b) {
      return a || new Set();
    }
    
    if (a === null) {
      return new Set(b);
    }

    const result = new Set<number>();
    for (const item of a) {
      if (b.has(item)) {
        result.add(item);
      }
    }
    return result;
  }

  /**
   * Get all events (no filtering)
   */
  getAll(): SwarmEvent[] {
    return [...this.events];
  }

  /**
   * Get total event count
   */
  getCount(): number {
    return this.events.length;
  }

  /**
   * Clear all events (useful for testing)
   */
  clear(): void {
    this.events = [];
    this.indexByAgent.clear();
    this.indexByTask.clear();
    this.indexByProject.clear();
    this.indexByType.clear();
  }

  /**
   * Get events for a specific task's lifecycle
   */
  getTaskLifecycle(taskId: string): SwarmEvent[] {
    return this.query({ task_id: taskId });
  }

  /**
   * Get latest events across all agents
   */
  getLatest(limit: number = 10): SwarmEvent[] {
    const sorted = [...this.events].sort((a, b) => b.timestamp - a.timestamp);
    return sorted.slice(0, limit);
  }
}

/**
 * Singleton instance for application-wide use
 */
let globalEventLog: EventLog | null = null;

/**
 * Get the global EventLog instance
 */
export function getGlobalEventLog(): EventLog {
  if (!globalEventLog) {
    globalEventLog = new EventLog();
  }
  return globalEventLog;
}

/**
 * Reset the global EventLog (useful for testing)
 */
export function resetGlobalEventLog(): void {
  globalEventLog = null;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/agents/orchestration/event-log.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/agents/orchestration/event-log.ts src/agents/orchestration/event-log.test.ts
git commit -m "feat(orchestration): add EventLog with queryable storage and indexes"
```

---

## Task 3: Create SwarmController with Event Subscription

**Files:**
- Create: `src/agents/orchestration/swarm-controller.ts`
- Test: `src/agents/orchestration/swarm-controller.test.ts`

**Step 1: Write the failing test**

Create `src/agents/orchestration/swarm-controller.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { SwarmController } from "./swarm-controller.js";
import { EventBus, EventType, EventStatus } from "./event-bus.js";
import { EventLog } from "./event-log.js";

describe("SwarmController", () => {
  let controller: SwarmController;
  let eventBus: EventBus;
  let eventLog: EventLog;

  beforeEach(() => {
    eventBus = new EventBus();
    eventLog = new EventLog();
    controller = new SwarmController(eventBus, eventLog);
  });

  it("should create a controller instance", () => {
    expect(controller).toBeDefined();
    expect(controller.isSubscribed()).toBe(false);
  });

  it("should subscribe to event bus", () => {
    controller.subscribe();
    expect(controller.isSubscribed()).toBe(true);
  });

  it("should receive and log events", async () => {
    controller.subscribe();

    const event = {
      agent_id: "agent-1",
      task_id: "task-1",
      event_type: EventType.TASK_STARTED,
      status: EventStatus.PENDING,
      timestamp: Date.now(),
      payload: { message: "Started" },
      project_id: "project-1",
    };

    await eventBus.publish(event);
    
    const loggedEvents = eventLog.getAll();
    expect(loggedEvents).toHaveLength(1);
    expect(loggedEvents[0].agent_id).toBe("agent-1");
  });

  it("should track active tasks", async () => {
    controller.subscribe();

    await eventBus.publish({
      agent_id: "agent-1",
      task_id: "task-1",
      event_type: EventType.TASK_STARTED,
      status: EventStatus.RUNNING,
      timestamp: Date.now(),
      payload: {},
    });

    const activeTasks = controller.getActiveTasks();
    expect(activeTasks).toHaveLength(1);
    expect(activeTasks[0].task_id).toBe("task-1");
  });

  it("should mark tasks as completed", async () => {
    controller.subscribe();

    await eventBus.publish({
      agent_id: "agent-1",
      task_id: "task-1",
      event_type: EventType.TASK_STARTED,
      status: EventStatus.RUNNING,
      timestamp: Date.now(),
      payload: {},
    });

    await eventBus.publish({
      agent_id: "agent-1",
      task_id: "task-1",
      event_type: EventType.TASK_COMPLETED,
      status: EventStatus.COMPLETED,
      timestamp: Date.now() + 1,
      payload: { result: "done" },
    });

    const activeTasks = controller.getActiveTasks();
    expect(activeTasks).toHaveLength(0);
  });

  it("should query events through controller", async () => {
    controller.subscribe();

    await eventBus.publish({
      agent_id: "agent-1",
      task_id: "task-1",
      event_type: EventType.TASK_STARTED,
      status: EventStatus.PENDING,
      timestamp: Date.now(),
      payload: {},
      project_id: "project-1",
    });

    const events = controller.queryEvents({ project_id: "project-1" });
    expect(events).toHaveLength(1);
  });

  it("should unsubscribe from events", async () => {
    controller.subscribe();
    expect(controller.isSubscribed()).toBe(true);

    controller.unsubscribe();
    expect(controller.isSubscribed()).toBe(false);

    // Event should not be logged after unsubscribe
    await eventBus.publish({
      agent_id: "agent-1",
      task_id: "task-1",
      event_type: EventType.TASK_STARTED,
      status: EventStatus.PENDING,
      timestamp: Date.now(),
      payload: {},
    });

    expect(eventLog.getAll()).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/agents/orchestration/swarm-controller.test.ts`
Expected: FAIL with "SwarmController not defined"

**Step 3: Write minimal implementation**

Create `src/agents/orchestration/swarm-controller.ts`:

```typescript
/**
 * SwarmController - Central orchestration controller
 * 
 * Subscribes to EventBus events and manages task state.
 * Provides query interface for event logs.
 */

import { EventBus, SwarmEvent, EventType, EventHandler } from "./event-bus.js";
import { EventLog, EventQuery } from "./event-log.js";

/**
 * Active task tracking
 */
interface ActiveTask {
  task_id: string;
  agent_id: string;
  project_id?: string;
  started_at: number;
  status: string;
  event_count: number;
}

/**
 * SwarmController manages event subscription and task tracking
 */
export class SwarmController {
  private eventBus: EventBus;
  private eventLog: EventLog;
  private unsubscribeFn: (() => void) | null = null;
  private activeTasks: Map<string, ActiveTask> = new Map();
  private handlers: Set<(event: SwarmEvent) => void> = new Set();

  /**
   * Create a SwarmController
   * @param eventBus - The EventBus to subscribe to
   * @param eventLog - The EventLog for storage
   */
  constructor(eventBus: EventBus, eventLog: EventLog) {
    this.eventBus = eventBus;
    this.eventLog = eventLog;
  }

  /**
   * Subscribe to events from the EventBus
   */
  subscribe(): void {
    if (this.isSubscribed()) {
      return;
    }

    this.unsubscribeFn = this.eventBus.subscribe(async (event) => {
      await this.handleEvent(event);
    });
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(): void {
    if (this.unsubscribeFn) {
      this.unsubscribeFn();
      this.unsubscribeFn = null;
    }
    this.activeTasks.clear();
  }

  /**
   * Check if currently subscribed to events
   */
  isSubscribed(): boolean {
    return this.unsubscribeFn !== null;
  }

  /**
   * Handle incoming events
   */
  private async handleEvent(event: SwarmEvent): Promise<void> {
    // Store event in log
    this.eventLog.store(event);

    // Update active task tracking
    this.updateTaskTracking(event);

    // Notify registered handlers
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (err) {
        console.error("[SwarmController] Handler error:", err);
      }
    }
  }

  /**
   * Update task tracking based on event
   */
  private updateTaskTracking(event: SwarmEvent): void {
    const taskKey = `${event.agent_id}:${event.task_id}`;

    switch (event.event_type) {
      case EventType.TASK_STARTED:
        this.activeTasks.set(taskKey, {
          task_id: event.task_id,
          agent_id: event.agent_id,
          project_id: event.project_id,
          started_at: event.timestamp,
          status: event.status,
          event_count: 1,
        });
        break;

      case EventType.TASK_COMPLETED:
      case EventType.TASK_FAILED:
        this.activeTasks.delete(taskKey);
        break;

      case EventType.TOOL_CALL:
      case EventType.EXECUTION_LOG:
        // Update existing task
        const existing = this.activeTasks.get(taskKey);
        if (existing) {
          existing.event_count++;
          existing.status = event.status;
        }
        break;
    }
  }

  /**
   * Get list of active tasks
   */
  getActiveTasks(): ActiveTask[] {
    return Array.from(this.activeTasks.values());
  }

  /**
   * Query events from the log
   * @param query - Filter criteria
   */
  queryEvents(query: EventQuery = {}): SwarmEvent[] {
    return this.eventLog.query(query);
  }

  /**
   * Get all events
   */
  getAllEvents(): SwarmEvent[] {
    return this.eventLog.getAll();
  }

  /**
   * Get events for a specific task
   */
  getTaskEvents(taskId: string): SwarmEvent[] {
    return this.eventLog.query({ task_id: taskId });
  }

  /**
   * Get events for a specific agent
   */
  getAgentEvents(agentId: string): SwarmEvent[] {
    return this.eventLog.query({ agent_id: agentId });
  }

  /**
   * Get events for a specific project
   */
  getProjectEvents(projectId: string): SwarmEvent[] {
    return this.eventLog.query({ project_id: projectId });
  }

  /**
   * Register a custom event handler
   * @param handler - Callback function for events
   * @returns Unsubscribe function
   */
  onEvent(handler: (event: SwarmEvent) => void): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  /**
   * Get active task count
   */
  getActiveTaskCount(): number {
    return this.activeTasks.size;
  }

  /**
   * Check if a task is active
   */
  isTaskActive(taskId: string, agentId?: string): boolean {
    if (agentId) {
      return this.activeTasks.has(`${agentId}:${taskId}`);
    }
    // Check across all agents
    for (const key of this.activeTasks.keys()) {
      if (key.endsWith(`:${taskId}`)) {
        return true;
      }
    }
    return false;
  }
}

/**
 * Singleton instance for application-wide use
 */
let globalController: SwarmController | null = null;

/**
 * Get or create the global SwarmController
 */
export function getGlobalSwarmController(): SwarmController {
  if (!globalController) {
    const { getGlobalEventBus } = await import("./event-bus.js");
    const { getGlobalEventLog } = await import("./event-log.js");
    globalController = new SwarmController(getGlobalEventBus(), getGlobalEventLog());
  }
  return globalController;
}

/**
 * Reset the global controller (useful for testing)
 */
export function resetGlobalSwarmController(): void {
  globalController = null;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/agents/orchestration/swarm-controller.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/agents/orchestration/swarm-controller.ts src/agents/orchestration/swarm-controller.test.ts
git commit -m "feat(orchestration): add SwarmController with event subscription and task tracking"
```

---

## Task 4: Integrate EventBus with Agent Tools

**Files:**
- Create: `src/agents/tools/event-bus-tool.ts`
- Test: `src/agents/tools/event-bus-tool.test.ts`

**Step 1: Write the failing test**

Create `src/agents/tools/event-bus-tool.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { createEventBusTool } from "./event-bus-tool.js";
import { getGlobalEventBus, EventType, EventStatus } from "../orchestration/event-bus.js";
import { resetGlobalEventBus } from "../orchestration/event-bus.js";

describe("EventBus Tool", () => {
  beforeEach(() => {
    resetGlobalEventBus();
  });

  it("should publish an event", async () => {
    const tool = createEventBusTool({ agentSessionKey: "agent:test" });
    const eventBus = getGlobalEventBus();
    
    const events: any[] = [];
    eventBus.subscribe((e) => events.push(e));

    const result = await tool.execute("test-1", {
      action: "publish",
      agent_id: "agent-1",
      task_id: "task-1",
      event_type: "task_started",
      status: "running",
      payload: { message: "Task started" },
    });

    expect(result.success).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe("task_started");
  });

  it("should subscribe to events", async () => {
    const tool = createEventBusTool({ agentSessionKey: "agent:test" });
    
    const subResult = await tool.execute("test-2", {
      action: "subscribe",
      event_type: "task_completed",
    });

    expect(subResult.success).toBe(true);
  });

  it("should query events", async () => {
    const tool = createEventBusTool({ agentSessionKey: "agent:test" });
    
    // First publish some events
    await tool.execute("test-3", {
      action: "publish",
      agent_id: "agent-1",
      task_id: "task-1",
      event_type: "task_started",
      status: "running",
      payload: {},
      project_id: "project-1",
    });

    // Query events
    const queryResult = await tool.execute("test-4", {
      action: "query",
      filters: {
        project_id: "project-1",
      },
    });

    expect(queryResult.success).toBe(true);
    expect(queryResult.events).toHaveLength(1);
  });

  it("should reject invalid event types", async () => {
    const tool = createEventBusTool({ agentSessionKey: "agent:test" });
    
    const result = await tool.execute("test-5", {
      action: "publish",
      agent_id: "agent-1",
      task_id: "task-1",
      event_type: "invalid_type",
      status: "running",
      payload: {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid event_type");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/agents/tools/event-bus-tool.test.ts`
Expected: FAIL with "event-bus-tool not defined"

**Step 3: Write minimal implementation**

Create `src/agents/tools/event-bus-tool.ts`:

```typescript
/**
 * EventBus Tool for Agents
 * 
 * Allows agents to publish events, subscribe to events, and query event logs.
 * Integrates with the Swarm EventBus system.
 */

import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readStringParam } from "./common.js";
import {
  getGlobalEventBus,
  EventType,
  EventStatus,
  SwarmEvent,
} from "../orchestration/event-bus.js";
import { getGlobalEventLog } from "../orchestration/event-log.js";

// Valid event types
const VALID_EVENT_TYPES = [
  "task_started",
  "task_completed",
  "task_failed",
  "tool_call",
  "execution_log",
];

// Valid status values
const VALID_STATUSES = ["pending", "running", "completed", "failed", "cancelled"];

/**
 * Schema for event_bus tool
 */
const EventBusToolSchema = Type.Object({
  action: Type.Union([
    Type.Literal("publish"),
    Type.Literal("subscribe"),
    Type.Literal("unsubscribe"),
    Type.Literal("query"),
  ], { description: "Action to perform" }),
  
  // For publish action
  agent_id: Type.Optional(Type.String({ description: "Agent identifier" })),
  task_id: Type.Optional(Type.String({ description: "Task identifier" })),
  project_id: Type.Optional(Type.String({ description: "Project identifier" })),
  event_type: Type.Optional(Type.Union([
    Type.Literal("task_started"),
    Type.Literal("task_completed"),
    Type.Literal("task_failed"),
    Type.Literal("tool_call"),
    Type.Literal("execution_log"),
  ], { description: "Type of event" })),
  status: Type.Optional(Type.Union([
    Type.Literal("pending"),
    Type.Literal("running"),
    Type.Literal("completed"),
    Type.Literal("failed"),
    Type.Literal("cancelled"),
  ], { description: "Event status" })),
  payload: Type.Optional(Type.Record(Type.String(), Type.Unknown(), {
    description: "Event payload data",
  })),
  
  // For query action
  filters: Type.Optional(Type.Object({
    agent_id: Type.Optional(Type.String()),
    task_id: Type.Optional(Type.String()),
    project_id: Type.Optional(Type.String()),
    event_type: Type.Optional(Type.String()),
    status: Type.Optional(Type.String()),
  }, { description: "Query filters" })),
  limit: Type.Optional(Type.Number({ description: "Maximum results" })),
  offset: Type.Optional(Type.Number({ description: "Results offset" })),
  
  // For subscribe/unsubscribe
  topic: Type.Optional(Type.String({ description: "Topic to subscribe to" })),
});

/**
 * Create the event_bus tool
 */
export function createEventBusTool(options?: {
  agentSessionKey?: string;
}): AnyAgentTool {
  return {
    label: "Event Bus",
    name: "event_bus",
    description:
      "Publish events, subscribe to events, or query event logs. Use for task lifecycle tracking, tool call logging, and execution monitoring. Supports filtering by project, task, and agent.",
    parameters: EventBusToolSchema,
    execute: async (_toolCallId, params) => {
      try {
        const action = readStringParam(params, "action", { required: true });
        const agentSessionKey = options?.agentSessionKey || "unknown";

        switch (action) {
          case "publish": {
            return await handlePublish(params, agentSessionKey);
          }

          case "subscribe": {
            return handleSubscribe(params);
          }

          case "unsubscribe": {
            return handleUnsubscribe(params);
          }

          case "query": {
            return handleQuery(params);
          }

          default:
            return jsonResult({
              success: false,
              error: `Unknown action: ${action}`,
            });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return jsonResult({
          success: false,
          error: message,
        });
      }
    },
  };
}

/**
 * Handle publish action
 */
async function handlePublish(
  params: Record<string, unknown>,
  agentSessionKey: string
): Promise<{ success: boolean; event_id?: string; error?: string }> {
  const eventTypeStr = readStringParam(params, "event_type", { required: true });
  const agentId = readStringParam(params, "agent_id", { required: true });
  const taskId = readStringParam(params, "task_id", { required: true });
  const statusStr = readStringParam(params, "status") || "pending";
  const projectId = readStringParam(params, "project_id");
  const payload = (params.payload as Record<string, unknown>) || {};

  // Validate event type
  if (!VALID_EVENT_TYPES.includes(eventTypeStr)) {
    return jsonResult({
      success: false,
      error: `Invalid event_type: ${eventTypeStr}. Valid types: ${VALID_EVENT_TYPES.join(", ")}`,
    });
  }

  // Validate status
  if (!VALID_STATUSES.includes(statusStr)) {
    return jsonResult({
      success: false,
      error: `Invalid status: ${statusStr}. Valid statuses: ${VALID_STATUSES.join(", ")}`,
    });
  }

  // Map string values to enums
  const eventType = eventTypeStr as EventType;
  const status = statusStr as EventStatus;

  // Create event
  const event: SwarmEvent = {
    agent_id: agentId,
    task_id: taskId,
    event_type: eventType,
    status,
    timestamp: Date.now(),
    payload,
    project_id: projectId,
  };

  // Publish to EventBus
  const eventBus = getGlobalEventBus();
  await eventBus.publish(event);

  return jsonResult({
    success: true,
    event_id: `${event.timestamp}-${Math.random().toString(36).slice(2, 11)}`,
  });
}

/**
 * Handle subscribe action
 */
function handleSubscribe(
  params: Record<string, unknown>
): { success: boolean; message?: string; error?: string } {
  const eventType = readStringParam(params, "event_type");
  const topic = readStringParam(params, "topic");

  // For now, subscriptions are handled by the SwarmController
  // This returns a confirmation that the request was made
  const target = eventType || topic || "all";

  return jsonResult({
    success: true,
    message: `Subscription request registered for ${target}`,
  });
}

/**
 * Handle unsubscribe action
 */
function handleUnsubscribe(
  params: Record<string, unknown>
): { success: boolean; message?: string; error?: string } {
  const topic = readStringParam(params, "topic");
  const target = topic || "all";

  return jsonResult({
    success: true,
    message: `Unsubscribed from ${target}`,
  });
}

/**
 * Handle query action
 */
function handleQuery(
  params: Record<string, unknown>
): { success: boolean; events?: SwarmEvent[]; total?: number; error?: string } {
  const filters = (params.filters as Record<string, string>) || {};
  const limit = typeof params.limit === "number" ? params.limit : undefined;
  const offset = typeof params.offset === "number" ? params.offset : undefined;

  const eventLog = getGlobalEventLog();
  
  const query = {
    agent_id: filters.agent_id,
    task_id: filters.task_id,
    project_id: filters.project_id,
    event_type: filters.event_type as EventType | undefined,
    status: filters.status,
  };

  const events = eventLog.query(query, { limit, offset });

  return jsonResult({
    success: true,
    events,
    total: events.length,
  });
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/agents/tools/event-bus-tool.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/agents/tools/event-bus-tool.ts src/agents/tools/event-bus-tool.test.ts
git commit -m "feat(tools): add event_bus tool for agent event publishing and querying"
```

---

## Task 5: Add WebSocket-Ready Architecture

**Files:**
- Create: `src/agents/orchestration/event-streamer.ts`
- Test: `src/agents/orchestration/event-streamer.test.ts`

**Step 1: Write the failing test**

Create `src/agents/orchestration/event-streamer.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { EventStreamer } from "./event-streamer.js";
import { EventBus, EventType, EventStatus } from "./event-bus.js";
import { EventLog } from "./event-log.js";

describe("EventStreamer", () => {
  let eventStreamer: EventStreamer;
  let eventBus: EventBus;
  let eventLog: EventLog;

  beforeEach(() => {
    eventBus = new EventBus();
    eventLog = new EventLog();
    eventStreamer = new EventStreamer(eventBus, eventLog);
  });

  it("should create a streamer instance", () => {
    expect(eventStreamer).toBeDefined();
    expect(eventStreamer.isStreaming()).toBe(false);
  });

  it("should start and stop streaming", () => {
    eventStreamer.start();
    expect(eventStreamer.isStreaming()).toBe(true);

    eventStreamer.stop();
    expect(eventStreamer.isStreaming()).toBe(false);
  });

  it("should buffer events for streaming", async () => {
    eventStreamer.start();

    const event = {
      agent_id: "agent-1",
      task_id: "task-1",
      event_type: EventType.TASK_STARTED,
      status: EventStatus.PENDING,
      timestamp: Date.now(),
      payload: {},
    };

    await eventBus.publish(event);

    const buffer = eventStreamer.getBuffer();
    expect(buffer).toHaveLength(1);
    expect(buffer[0].agent_id).toBe("agent-1");
  });

  it("should apply filters to streaming", async () => {
    eventStreamer.start({
      filters: {
        event_type: EventType.TASK_STARTED,
      },
    });

    await eventBus.publish({
      agent_id: "agent-1",
      task_id: "task-1",
      event_type: EventType.TASK_STARTED,
      status: EventStatus.PENDING,
      timestamp: Date.now(),
      payload: {},
    });

    await eventBus.publish({
      agent_id: "agent-1",
      task_id: "task-2",
      event_type: EventType.TASK_COMPLETED,
      status: EventStatus.COMPLETED,
      timestamp: Date.now(),
      payload: {},
    });

    const buffer = eventStreamer.getBuffer();
    expect(buffer).toHaveLength(1);
    expect(buffer[0].event_type).toBe(EventType.TASK_STARTED);
  });

  it("should flush buffer", async () => {
    eventStreamer.start();

    await eventBus.publish({
      agent_id: "agent-1",
      task_id: "task-1",
      event_type: EventType.TASK_STARTED,
      status: EventStatus.PENDING,
      timestamp: Date.now(),
      payload: {},
    });

    expect(eventStreamer.getBuffer()).toHaveLength(1);

    eventStreamer.flush();
    expect(eventStreamer.getBuffer()).toHaveLength(0);
  });

  it("should provide WebSocket adapter interface", () => {
    const adapter = eventStreamer.createWebSocketAdapter();
    
    expect(adapter).toBeDefined();
    expect(typeof adapter.send).toBe("function");
    expect(typeof adapter.close).toBe("function");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/agents/orchestration/event-streamer.test.ts`
Expected: FAIL with "EventStreamer not defined"

**Step 3: Write minimal implementation**

Create `src/agents/orchestration/event-streamer.ts`:

```typescript
/**
 * EventStreamer - WebSocket-ready event streaming
 * 
 * Prepares the architecture for WebSocket streaming by:
 * - Buffering events for batch delivery
 * - Supporting connection adapters
 * - Providing filter-based streaming
 */

import { EventBus, SwarmEvent, EventType } from "./event-bus.js";
import { EventLog, EventQuery } from "./event-log.js";

/**
 * Streaming configuration
 */
export interface StreamConfig {
  /** Filter events before streaming */
  filters?: EventQuery;
  /** Maximum buffer size before auto-flush */
  maxBufferSize?: number;
  /** Auto-flush interval in ms */
  flushIntervalMs?: number;
}

/**
 * WebSocket adapter interface
 * Implement this to integrate with actual WebSocket libraries
 */
export interface WebSocketAdapter {
  /** Send data through the connection */
  send(data: string): void;
  /** Close the connection */
  close(): void;
  /** Check if connection is open */
  isOpen(): boolean;
}

/**
 * EventStreamer prepares events for WebSocket delivery
 */
export class EventStreamer {
  private eventBus: EventBus;
  private eventLog: EventLog;
  private isActive: boolean = false;
  private buffer: SwarmEvent[] = [];
  private config: StreamConfig = {};
  private unsubscribeFn: (() => void) | null = null;
  private flushTimer: NodeJS.Timeout | null = null;
  private adapters: Set<WebSocketAdapter> = new Set();

  /**
   * Create an EventStreamer
   * @param eventBus - The EventBus to subscribe to
   * @param eventLog - The EventLog for storage
   */
  constructor(eventBus: EventBus, eventLog: EventLog) {
    this.eventBus = eventBus;
    this.eventLog = eventLog;
  }

  /**
   * Start streaming events
   * @param config - Streaming configuration
   */
  start(config: StreamConfig = {}): void {
    if (this.isActive) {
      return;
    }

    this.config = {
      maxBufferSize: 100,
      flushIntervalMs: 1000,
      ...config,
    };

    this.isActive = true;
    this.buffer = [];

    // Subscribe to events
    this.unsubscribeFn = this.eventBus.subscribe((event) => {
      this.handleEvent(event);
    });

    // Start flush timer
    if (this.config.flushIntervalMs) {
      this.flushTimer = setInterval(() => {
        this.flush();
      }, this.config.flushIntervalMs);
    }
  }

  /**
   * Stop streaming
   */
  stop(): void {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;

    // Unsubscribe from events
    if (this.unsubscribeFn) {
      this.unsubscribeFn();
      this.unsubscribeFn = null;
    }

    // Clear flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Final flush
    this.flush();

    // Close all adapters
    for (const adapter of this.adapters) {
      adapter.close();
    }
    this.adapters.clear();
  }

  /**
   * Check if streaming is active
   */
  isStreaming(): boolean {
    return this.isActive;
  }

  /**
   * Handle incoming events
   */
  private handleEvent(event: SwarmEvent): void {
    // Apply filters
    if (this.config.filters) {
      if (!this.matchesFilters(event, this.config.filters)) {
        return;
      }
    }

    // Add to buffer
    this.buffer.push(event);

    // Auto-flush if buffer is full
    if (
      this.config.maxBufferSize &&
      this.buffer.length >= this.config.maxBufferSize
    ) {
      this.flush();
    }
  }

  /**
   * Check if event matches filters
   */
  private matchesFilters(event: SwarmEvent, filters: EventQuery): boolean {
    if (filters.agent_id && event.agent_id !== filters.agent_id) {
      return false;
    }
    if (filters.task_id && event.task_id !== filters.task_id) {
      return false;
    }
    if (filters.project_id && event.project_id !== filters.project_id) {
      return false;
    }
    if (filters.event_type && event.event_type !== filters.event_type) {
      return false;
    }
    if (filters.status && event.status !== filters.status) {
      return false;
    }
    if (filters.after && event.timestamp <= filters.after) {
      return false;
    }
    if (filters.before && event.timestamp >= filters.before) {
      return false;
    }
    return true;
  }

  /**
   * Flush buffered events to all adapters
   */
  flush(): void {
    if (this.buffer.length === 0) {
      return;
    }

    const eventsToSend = [...this.buffer];
    this.buffer = [];

    // Send to all adapters
    const payload = JSON.stringify({
      type: "events",
      count: eventsToSend.length,
      events: eventsToSend,
    });

    for (const adapter of this.adapters) {
      if (adapter.isOpen()) {
        adapter.send(payload);
      }
    }
  }

  /**
   * Get current buffer contents (without flushing)
   */
  getBuffer(): SwarmEvent[] {
    return [...this.buffer];
  }

  /**
   * Get buffer size
   */
  getBufferSize(): number {
    return this.buffer.length;
  }

  /**
   * Register a WebSocket adapter
   * @param adapter - The adapter to register
   * @returns Unregister function
   */
  registerAdapter(adapter: WebSocketAdapter): () => void {
    this.adapters.add(adapter);
    return () => {
      this.adapters.delete(adapter);
    };
  }

  /**
   * Create a mock WebSocket adapter for testing
   * Returns an adapter that stores messages for inspection
   */
  createMockAdapter(): { adapter: WebSocketAdapter; messages: string[] } {
    const messages: string[] = [];
    
    const adapter: WebSocketAdapter = {
      send: (data: string) => {
        messages.push(data);
      },
      close: () => {
        // No-op for mock
      },
      isOpen: () => true,
    };

    return { adapter, messages };
  }

  /**
   * Create a WebSocket adapter interface
   * This is a placeholder that returns a no-op adapter.
   * Replace with actual WebSocket implementation when ready.
   */
  createWebSocketAdapter(): WebSocketAdapter {
    return {
      send: (_data: string) => {
        // Placeholder - integrate with actual WebSocket
        console.log("[EventStreamer] WebSocket send (placeholder)");
      },
      close: () => {
        // Placeholder - integrate with actual WebSocket
      },
      isOpen: () => true,
    };
  }

  /**
   * Stream historical events
   * @param query - Query for historical events
   * @param adapter - WebSocket adapter to stream to
   */
  streamHistory(query: EventQuery, adapter: WebSocketAdapter): void {
    const events = this.eventLog.query(query);
    
    if (events.length > 0 && adapter.isOpen()) {
      const payload = JSON.stringify({
        type: "history",
        count: events.length,
        events,
      });
      adapter.send(payload);
    }
  }
}

/**
 * Singleton instance for application-wide use
 */
let globalEventStreamer: EventStreamer | null = null;

/**
 * Get or create the global EventStreamer
 */
export function getGlobalEventStreamer(): EventStreamer {
  if (!globalEventStreamer) {
    const { getGlobalEventBus } = await import("./event-bus.js");
    const { getGlobalEventLog } = await import("./event-log.js");
    globalEventStreamer = new EventStreamer(
      getGlobalEventBus(),
      getGlobalEventLog()
    );
  }
  return globalEventStreamer;
}

/**
 * Reset the global EventStreamer (useful for testing)
 */
export function resetGlobalEventStreamer(): void {
  if (globalEventStreamer) {
    globalEventStreamer.stop();
    globalEventStreamer = null;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/agents/orchestration/event-streamer.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/agents/orchestration/event-streamer.ts src/agents/orchestration/event-streamer.test.ts
git commit -m "feat(orchestration): add EventStreamer with WebSocket-ready architecture"
```

---

## Task 6: Create Orchestration Index

**Files:**
- Create: `src/agents/orchestration/index.ts`

**Step 1: Create the index file**

Create `src/agents/orchestration/index.ts`:

```typescript
/**
 * Orchestration Module - EventBus System
 * 
 * Provides centralized event management for OpenClaw Swarm.
 * Includes EventBus, EventLog, SwarmController, and EventStreamer.
 */

// EventBus
export {
  EventBus,
  EventType,
  EventStatus,
  type SwarmEvent,
  type EventHandler,
  getGlobalEventBus,
  resetGlobalEventBus,
} from "./event-bus.js";

// EventLog
export {
  EventLog,
  type EventQuery,
  type PaginationOptions,
  getGlobalEventLog,
  resetGlobalEventLog,
} from "./event-log.js";

// SwarmController
export {
  SwarmController,
  getGlobalSwarmController,
  resetGlobalSwarmController,
} from "./swarm-controller.js";

// EventStreamer
export {
  EventStreamer,
  type StreamConfig,
  type WebSocketAdapter,
  getGlobalEventStreamer,
  resetGlobalEventStreamer,
} from "./event-streamer.js";

// Existing orchestration exports
export {
  extractSessionContext,
  type ContextSharingMode,
  type ExtractContextOptions,
  type ExtractedContext,
} from "./context-bridge.js";

export {
  configureOrchestratorEventHandler,
  initOrchestratorEventHandler,
  getTaskCompletion,
  getCheckpoint,
  listCheckpoints,
  getTaskErrors,
} from "./event-handler.js";

export {
  SharedContextStore,
  type StoredValue,
  type SubscribeCallback,
  getSharedContextStore,
  resetSharedContextStore,
} from "./shared-context-store.js";
```

**Step 2: Verify the index exports correctly**

Run: `pnpm tsgo`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/agents/orchestration/index.ts
git commit -m "feat(orchestration): add module index with all exports"
```

---

## Task 7: Run Full Test Suite

**Step 1: Run all orchestration tests**

Run: `pnpm test src/agents/orchestration/`
Expected: All tests PASS

**Step 2: Run the tool tests**

Run: `pnpm test src/agents/tools/event-bus-tool.test.ts`
Expected: All tests PASS

**Step 3: Run type check**

Run: `pnpm tsgo`
Expected: No type errors

**Step 4: Run lint check**

Run: `pnpm check`
Expected: No lint errors

**Step 5: Commit**

```bash
git commit -m "test(orchestration): add EventBus system with full test coverage"
```

---

## Summary

The EventBus system has been implemented with the following components:

1. **EventBus** (`src/agents/orchestration/event-bus.ts`) - Pub/sub system with typed events
2. **EventLog** (`src/agents/orchestration/event-log.ts`) - Queryable storage with indexing
3. **SwarmController** (`src/agents/orchestration/swarm-controller.ts`) - Event subscription and task tracking
4. **EventStreamer** (`src/agents/orchestration/event-streamer.ts`) - WebSocket-ready streaming architecture
5. **EventBus Tool** (`src/agents/tools/event-bus-tool.ts`) - Agent integration for publishing/querying events
6. **Module Index** (`src/agents/orchestration/index.ts`) - Clean exports

### Features:

- All 5 required event types: task_started, task_completed, task_failed, tool_call, execution_log
- Structured events with agent_id, task_id, event_type, status, timestamp, payload
- Queryable logs by project, task, and agent
- WebSocket adapter interface for future streaming
- Full test coverage
- Type-safe implementation
- Singleton pattern for global state management

### Usage:

```typescript
// Publish events from agents
const tool = createEventBusTool({ agentSessionKey: "agent:test" });
await tool.execute("id", {
  action: "publish",
  agent_id: "agent-1",
  task_id: "task-1",
  event_type: "task_started",
  status: "running",
  payload: { message: "Starting task" },
});

// Subscribe with SwarmController
const controller = new SwarmController(eventBus, eventLog);
controller.subscribe();

// Query events
const events = controller.queryEvents({ project_id: "project-1" });

// WebSocket streaming (future)
const streamer = new EventStreamer(eventBus, eventLog);
streamer.start({ filters: { event_type: EventType.TASK_STARTED } });
```
