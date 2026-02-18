/**
 * SwarmController - Central orchestration controller
 *
 * Subscribes to EventBus events and manages task state.
 * Provides query interface for event logs.
 */

import { EventBus, SwarmEvent, EventType, getGlobalEventBus } from "./event-bus.js";
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
        // eslint-disable-next-line no-case-declarations
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
let globalEventLogForController: EventLog | null = null;

/**
 * Get or create the global SwarmController
 */
export function getGlobalSwarmController(): SwarmController {
  if (!globalController) {
    if (!globalEventLogForController) {
      globalEventLogForController = new EventLog();
    }
    globalController = new SwarmController(getGlobalEventBus(), globalEventLogForController);
    globalController.subscribe();
  }
  return globalController;
}

/**
 * Reset the global controller (useful for testing)
 */
export function resetGlobalSwarmController(): void {
  globalController = null;
}
