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
