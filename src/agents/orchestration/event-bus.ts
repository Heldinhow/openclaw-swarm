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
