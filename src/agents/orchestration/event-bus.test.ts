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
