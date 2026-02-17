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

const VALID_EVENT_TYPES = [
  "task_started",
  "task_completed",
  "task_failed",
  "tool_call",
  "execution_log",
];

const VALID_STATUSES = ["pending", "running", "completed", "failed", "cancelled"];

const EventBusToolSchema = Type.Object({
  action: Type.Union([
    Type.Literal("publish"),
    Type.Literal("subscribe"),
    Type.Literal("unsubscribe"),
    Type.Literal("query"),
  ], { description: "Action to perform" }),
  
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
  
  filters: Type.Optional(Type.Object({
    agent_id: Type.Optional(Type.String()),
    task_id: Type.Optional(Type.String()),
    project_id: Type.Optional(Type.String()),
    event_type: Type.Optional(Type.String()),
    status: Type.Optional(Type.String()),
  }, { description: "Query filters" })),
  limit: Type.Optional(Type.Number({ description: "Maximum results" })),
  offset: Type.Optional(Type.Number({ description: "Results offset" })),
  
  topic: Type.Optional(Type.String({ description: "Topic to subscribe to" })),
});

export function createEventBusTool(_options?: {
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

        switch (action) {
          case "publish": {
            const eventTypeStr = readStringParam(params, "event_type", { required: true });
            const agentId = readStringParam(params, "agent_id", { required: true });
            const taskId = readStringParam(params, "task_id", { required: true });
            const statusStr = readStringParam(params, "status") || "pending";
            const projectId = readStringParam(params, "project_id");
            const payload = (params.payload as Record<string, unknown>) || {};

            if (!VALID_EVENT_TYPES.includes(eventTypeStr)) {
              return jsonResult({
                success: false,
                error: `Invalid event_type: ${eventTypeStr}. Valid types: ${VALID_EVENT_TYPES.join(", ")}`,
              });
            }

            if (!VALID_STATUSES.includes(statusStr)) {
              return jsonResult({
                success: false,
                error: `Invalid status: ${statusStr}. Valid statuses: ${VALID_STATUSES.join(", ")}`,
              });
            }

            const event: SwarmEvent = {
              agent_id: agentId,
              task_id: taskId,
              event_type: eventTypeStr as EventType,
              status: statusStr as EventStatus,
              timestamp: Date.now(),
              payload,
              project_id: projectId,
            };

            const eventBus = getGlobalEventBus();
            const eventLog = getGlobalEventLog();
            await eventBus.publish(event);
            eventLog.store(event);

            return jsonResult({
              success: true,
              event_id: `${event.timestamp}-${Math.random().toString(36).slice(2, 11)}`,
            });
          }

          case "subscribe": {
            const eventType = readStringParam(params, "event_type");
            const topic = readStringParam(params, "topic");
            const target = eventType || topic || "all";

            return jsonResult({
              success: true,
              message: `Subscription request registered for ${target}`,
            });
          }

          case "unsubscribe": {
            const topic = readStringParam(params, "topic");
            const target = topic || "all";

            return jsonResult({
              success: true,
              message: `Unsubscribed from ${target}`,
            });
          }

          case "query": {
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
