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
