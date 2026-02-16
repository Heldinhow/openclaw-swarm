/**
 * Context Publish Tool
 * 
 * Phase 3: Event-Driven & Autonomy
 * Allows subagents to publish events/messages to the orchestrator or other sessions,
 * eliminating the need for constant polling.
 */

import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "./common.js";
import { getSharedContextStore } from "../orchestration/shared-context-store.js";
import { jsonResult, readStringParam } from "./common.js";

// Event types for context_publish
export type ContextPublishEventType = 
  | "task_complete" 
  | "task_progress" 
  | "task_error" 
  | "handoff" 
  | "checkpoint" 
  | "custom";

export type ContextPublishTarget = 
  | "orchestrator" 
  | `session:${string}` 
  | "broadcast";

export type ContextPublishPriority = "low" | "normal" | "high";

// Schema for context_publish action
const ContextPublishSchema = Type.Object({
  action: Type.Union([
    Type.Literal("publish"),
    Type.Literal("subscribe"),
    Type.Literal("unsubscribe"),
  ], { description: "Action to perform: publish, subscribe, or unsubscribe" }),
  // Target for the message/event
  target: Type.Union([
    Type.Literal("orchestrator"),
    Type.String({ pattern: "^session:.*" }),
    Type.Literal("broadcast"),
  ], { description: "Target: 'orchestrator', 'session:<key>', or 'broadcast'" }),
  // Event type
  eventType: Type.Optional(Type.Union([
    Type.Literal("task_complete"),
    Type.Literal("task_progress"),
    Type.Literal("task_error"),
    Type.Literal("handoff"),
    Type.Literal("checkpoint"),
    Type.Literal("custom"),
  ], { description: "Type of event being published" })),
  // Data payload for the event
  data: Type.Optional(Type.Unknown({ description: "Event data payload" })),
  // Priority level
  priority: Type.Optional(Type.Union([
    Type.Literal("low"),
    Type.Literal("normal"),
    Type.Literal("high"),
  ], { description: "Event priority" })),
  // Whether to persist the event in the store
  persistent: Type.Optional(Type.Boolean({ description: "Persist event in store for later retrieval" })),
  // TTL for persistent events (in milliseconds)
  ttl: Type.Optional(Type.Number({ description: "TTL for persistent events in ms" })),
  // Topic/channel for subscriptions
  topic: Type.Optional(Type.String({ description: "Topic for subscribe/unsubscribe" })),
});

// Store for pending event handlers (set by the orchestrator)
type EventHandler = (event: ContextPublishEvent) => void | Promise<void>;
const eventHandlers = new Map<string, Set<EventHandler>>();
const pendingEvents: ContextPublishEvent[] = [];

/**
 * Context Publish Event
 */
export interface ContextPublishEvent {
  id: string;
  sourceSessionKey: string;
  target: ContextPublishTarget;
  eventType: ContextPublishEventType;
  data: unknown;
  priority: ContextPublishPriority;
  timestamp: number;
  persistent: boolean;
}

/**
 * Register an event handler for a specific target/topic
 */
export function registerEventHandler(
  target: string,
  handler: EventHandler,
): () => void {
  let handlers = eventHandlers.get(target);
  if (!handlers) {
    handlers = new Set();
    eventHandlers.set(target, handlers);
  }
  handlers.add(handler);
  
  // Return unsubscribe function
  return () => {
    handlers?.delete(handler);
    if (handlers?.size === 0) {
      eventHandlers.delete(target);
    }
  };
}

/**
 * Process a published event - deliver to registered handlers
 */
async function processEvent(event: ContextPublishEvent): Promise<void> {
  const { target } = event;
  
  // Get handlers for specific target
  const targetHandlers = eventHandlers.get(target) || new Set();
  // Get handlers for "orchestrator" if target is session-specific
  const orchestratorHandlers = eventHandlers.get("orchestrator") || new Set();
  // Get handlers for "broadcast"
  const broadcastHandlers = eventHandlers.get("broadcast") || new Set();
  
  const allHandlers = new Set([
    ...targetHandlers,
    ...orchestratorHandlers,
    ...broadcastHandlers,
  ]);
  
  // Deliver to all handlers
  const promises: Promise<void>[] = [];
  for (const handler of allHandlers) {
    try {
      const result = handler(event);
      if (result instanceof Promise) {
        promises.push(result);
      }
    } catch (err) {
      console.error(`Error in event handler:`, err);
    }
  }
  
  await Promise.all(promises);
}

/**
 * Publish an event to the context store and notify handlers
 */
export async function publishEvent(
  sourceSessionKey: string,
  target: ContextPublishTarget,
  eventType: ContextPublishEventType,
  data: unknown,
  priority: ContextPublishPriority = "normal",
  persistent: boolean = false,
  ttl?: number,
): Promise<ContextPublishEvent> {
  const event: ContextPublishEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    sourceSessionKey,
    target,
    eventType,
    data,
    priority,
    timestamp: Date.now(),
    persistent,
  };
  
  // Store persistently if requested
  if (persistent) {
    const store = getSharedContextStore();
    const namespace = target === "orchestrator" 
      ? "orchestrator_events" 
      : target === "broadcast"
        ? "broadcast_events"
        : `session_events:${target.replace("session:", "")}`;
    
    store.set(namespace, event.id, event, ttl);
  }
  
  // Process through handlers
  await processEvent(event);
  
  return event;
}

/**
 * Get pending events for a target
 */
export function getPendingEvents(target: string): ContextPublishEvent[] {
  return pendingEvents.filter(e => 
    e.target === target || 
    e.target === "broadcast" ||
    (target === "orchestrator" && e.target === "orchestrator")
  );
}

/**
 * Clear pending events
 */
export function clearPendingEvents(target?: string): void {
  if (target) {
    const idx = pendingEvents.findIndex(e => e.target === target);
    if (idx >= 0) {
      pendingEvents.splice(idx, 1);
    }
  } else {
    pendingEvents.length = 0;
  }
}

export function createContextPublishTool(options?: {
  /** Agent session key for deriving source */
  agentSessionKey?: string;
}): AnyAgentTool {
  return {
    label: "Context Publish",
    name: "context_publish",
    description:
      "Publish events/messages to the orchestrator, other sessions, or broadcast to all. Use for task_complete notifications, handoffs, checkpoints, and custom events. Eliminates need for polling.",
    parameters: ContextPublishSchema,
    execute: async (_toolCallId, params) => {
      try {
        const action = readStringParam(params, "action", { required: true });
        const target = readStringParam(params, "target", { required: true }) as ContextPublishTarget;
        const eventTypeRaw = readStringParam(params, "eventType") as ContextPublishEventType | undefined;
        const data = params.data;
        const priorityRaw = readStringParam(params, "priority") as ContextPublishPriority | undefined;
        const priority: ContextPublishPriority = priorityRaw || "normal";
        const persistent = params.persistent === true;
        const ttl = typeof params.ttl === "number" ? params.ttl : undefined;
        const topic = readStringParam(params, "topic");
        
        const sourceSessionKey = options?.agentSessionKey || "unknown";
        
        // Determine event type
        let eventType: ContextPublishEventType;
        if (eventTypeRaw) {
          eventType = eventTypeRaw;
        } else if (action === "publish") {
          // Default to custom if not specified
          eventType = "custom";
        } else {
          eventType = "custom";
        }

        switch (action) {
          case "publish": {
            // Publish the event
            const event = await publishEvent(
              sourceSessionKey,
              target,
              eventType,
              data,
              priority,
              persistent,
              ttl,
            );
            
            return jsonResult({
              success: true,
              eventId: event.id,
              target: event.target,
              eventType: event.eventType,
              timestamp: event.timestamp,
              persistent: event.persistent,
            });
          }

          case "subscribe": {
            // Subscribe to events for a target/topic
            if (!topic && target === "orchestrator") {
              return jsonResult({
                success: false,
                error: "topic is required for subscription",
              });
            }
            
            const subscribeTarget = topic || target;
            // Note: Actual subscription is handled by the orchestrator
            // This returns a confirmation that the subscription request was made
            
            return jsonResult({
              success: true,
              message: `Subscription request registered for ${subscribeTarget}`,
              target: subscribeTarget,
            });
          }

          case "unsubscribe": {
            // Unsubscribe from events
            const unsubscribeTarget = topic || target;
            
            return jsonResult({
              success: true,
              message: `Unsubscribed from ${unsubscribeTarget}`,
              target: unsubscribeTarget,
            });
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
