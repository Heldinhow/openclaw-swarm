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
  private flushTimer: ReturnType<typeof setInterval> | null = null;
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
    if (filters.status && String(event.status) !== filters.status) {
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
let globalEventBusForStreamer: EventBus | null = null;
let globalEventLogForStreamer: EventLog | null = null;

/**
 * Get or create the global EventStreamer
 */
export function getGlobalEventStreamer(): EventStreamer {
  if (!globalEventStreamer) {
    if (!globalEventBusForStreamer) {
      globalEventBusForStreamer = new EventBus();
    }
    if (!globalEventLogForStreamer) {
      globalEventLogForStreamer = new EventLog();
    }
    globalEventStreamer = new EventStreamer(globalEventBusForStreamer, globalEventLogForStreamer);
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
