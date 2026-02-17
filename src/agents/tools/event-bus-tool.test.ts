import { describe, it, expect, beforeEach } from "vitest";
import { createEventBusTool } from "./event-bus-tool.js";
import { getGlobalEventBus, EventType, EventStatus, resetGlobalEventBus } from "../orchestration/event-bus.js";
import { resetGlobalEventLog } from "../orchestration/event-log.js";

describe("EventBus Tool", () => {
  beforeEach(() => {
    resetGlobalEventBus();
    resetGlobalEventLog();
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

    const details = result.details as { success: boolean };
    expect(details.success).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe("task_started");
  });

  it("should subscribe to events", async () => {
    const tool = createEventBusTool({ agentSessionKey: "agent:test" });
    
    const subResult = await tool.execute("test-2", {
      action: "subscribe",
      event_type: "task_completed",
    });

    const details = subResult.details as { success: boolean };
    expect(details.success).toBe(true);
  });

  it("should query events", async () => {
    const tool = createEventBusTool({ agentSessionKey: "agent:test" });
    const eventBus = getGlobalEventBus();
    
    // Subscribe so events get logged to the EventLog
    eventBus.subscribe((event) => {
      // Events should be stored
    });

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

    // Query events - use a fresh tool instance to get fresh EventLog
    const queryResult = await tool.execute("test-4", {
      action: "query",
      filters: {
        project_id: "project-1",
      },
    });

    const details = queryResult.details as { success: boolean; events: any[] };
    expect(details.success).toBe(true);
    expect(details.events).toHaveLength(1);
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

    const details = result.details as { success: boolean; error?: string };
    expect(details.success).toBe(false);
    expect(details.error).toContain("Invalid event_type");
  });
});
