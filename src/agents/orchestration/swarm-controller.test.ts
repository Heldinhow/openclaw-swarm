import { describe, it, expect, beforeEach } from "vitest";
import { SwarmController } from "./swarm-controller.js";
import { EventBus, EventType, EventStatus } from "./event-bus.js";
import { EventLog } from "./event-log.js";

describe("SwarmController", () => {
  let controller: SwarmController;
  let eventBus: EventBus;
  let eventLog: EventLog;

  beforeEach(() => {
    eventBus = new EventBus();
    eventLog = new EventLog();
    controller = new SwarmController(eventBus, eventLog);
  });

  it("should create a controller instance", () => {
    expect(controller).toBeDefined();
    expect(controller.isSubscribed()).toBe(false);
  });

  it("should subscribe to event bus", () => {
    controller.subscribe();
    expect(controller.isSubscribed()).toBe(true);
  });

  it("should receive and log events", async () => {
    controller.subscribe();

    const event = {
      agent_id: "agent-1",
      task_id: "task-1",
      event_type: EventType.TASK_STARTED,
      status: EventStatus.PENDING,
      timestamp: Date.now(),
      payload: { message: "Started" },
      project_id: "project-1",
    };

    await eventBus.publish(event);
    
    const loggedEvents = eventLog.getAll();
    expect(loggedEvents).toHaveLength(1);
    expect(loggedEvents[0].agent_id).toBe("agent-1");
  });

  it("should track active tasks", async () => {
    controller.subscribe();

    await eventBus.publish({
      agent_id: "agent-1",
      task_id: "task-1",
      event_type: EventType.TASK_STARTED,
      status: EventStatus.RUNNING,
      timestamp: Date.now(),
      payload: {},
    });

    const activeTasks = controller.getActiveTasks();
    expect(activeTasks).toHaveLength(1);
    expect(activeTasks[0].task_id).toBe("task-1");
  });

  it("should mark tasks as completed", async () => {
    controller.subscribe();

    await eventBus.publish({
      agent_id: "agent-1",
      task_id: "task-1",
      event_type: EventType.TASK_STARTED,
      status: EventStatus.RUNNING,
      timestamp: Date.now(),
      payload: {},
    });

    await eventBus.publish({
      agent_id: "agent-1",
      task_id: "task-1",
      event_type: EventType.TASK_COMPLETED,
      status: EventStatus.COMPLETED,
      timestamp: Date.now() + 1,
      payload: { result: "done" },
    });

    const activeTasks = controller.getActiveTasks();
    expect(activeTasks).toHaveLength(0);
  });

  it("should query events through controller", async () => {
    controller.subscribe();

    await eventBus.publish({
      agent_id: "agent-1",
      task_id: "task-1",
      event_type: EventType.TASK_STARTED,
      status: EventStatus.PENDING,
      timestamp: Date.now(),
      payload: {},
      project_id: "project-1",
    });

    const events = controller.queryEvents({ project_id: "project-1" });
    expect(events).toHaveLength(1);
  });

  it("should unsubscribe from events", async () => {
    controller.subscribe();
    expect(controller.isSubscribed()).toBe(true);

    controller.unsubscribe();
    expect(controller.isSubscribed()).toBe(false);

    // Event should not be logged after unsubscribe
    await eventBus.publish({
      agent_id: "agent-1",
      task_id: "task-1",
      event_type: EventType.TASK_STARTED,
      status: EventStatus.PENDING,
      timestamp: Date.now(),
      payload: {},
    });

    expect(eventLog.getAll()).toHaveLength(0);
  });
});
