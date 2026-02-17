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
    const filtered: SwarmEvent[] = [];
    for (const idx of candidateIndices) {
      const event = this.events[idx];
      
      if (query.status && String(event.status) !== query.status) {
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
    const sorted = [...this.events].toSorted((a, b) => b.timestamp - a.timestamp);
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
