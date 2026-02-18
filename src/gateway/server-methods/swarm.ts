/**
 * Swarm Monitoring Dashboard - Server Methods
 *
 * API endpoints for monitoring subagents and orchestration state.
 */

import type { GatewayRequestHandlers } from "./types.js";
import { getGlobalSwarmController } from "../../agents/orchestration/swarm-controller.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";

/**
 * Subagent state from the SwarmController
 */
export interface SubagentState {
  id: string;
  taskId: string;
  agentId: string;
  projectId?: string;
  status: string;
  startedAt: number;
  eventCount: number;
  runtime?: number;
}

/**
 * Orchestration tree node
 */
export interface OrchestrationNode {
  id: string;
  agentId: string;
  taskId: string;
  label: string;
  status: string;
  depth: number;
  children: string[];
  parentId?: string;
  startedAt: number;
  runtime?: number;
}

/**
 * Dashboard stats
 */
export interface SwarmStats {
  activeTasks: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  runningTasks: number;
  pendingTasks: number;
}

/**
 * Export handlers
 */
export const swarmHandlers: GatewayRequestHandlers = {
  "swarm.subagents": async ({ respond }) => {
    const controller = getGlobalSwarmController();

    const activeTasks = controller.getActiveTasks();
    const subagents: SubagentState[] = activeTasks.map((task) => ({
      id: `${task.agent_id}:${task.task_id}`,
      taskId: task.task_id,
      agentId: task.agent_id,
      projectId: task.project_id,
      status: task.status,
      startedAt: task.started_at,
      eventCount: task.event_count,
      runtime: task.started_at > 0 ? Math.floor((Date.now() - task.started_at) / 1000) : undefined,
    }));

    respond(true, { subagents });
  },

  "swarm.orchestrations": async ({ respond }) => {
    const controller = getGlobalSwarmController();
    const events = controller.getAllEvents();

    const nodes: Map<string, OrchestrationNode> = new Map();

    for (const event of events) {
      const nodeId = `${event.agent_id}:${event.task_id}`;

      if (!nodes.has(nodeId)) {
        nodes.set(nodeId, {
          id: nodeId,
          agentId: event.agent_id,
          taskId: event.task_id,
          label: event.task_id,
          status: event.status || "pending",
          depth: 0,
          children: [],
          parentId: event.parent_task_id,
          startedAt: event.timestamp,
        });
      }

      const node = nodes.get(nodeId)!;
      node.status = event.status || node.status;
    }

    for (const [, node] of nodes) {
      if (node.parentId) {
        const parentNode = nodes.get(node.parentId);
        if (parentNode) {
          parentNode.children.push(node.id);
          node.depth = parentNode.depth + 1;
        }
      }
    }

    for (const node of nodes.values()) {
      if (node.startedAt > 0) {
        node.runtime = Math.floor((Date.now() - node.startedAt) / 1000);
      }
    }

    const tree = Array.from(nodes.values());
    respond(true, { tree, nodeCount: tree.length });
  },

  "swarm.stats": async ({ respond }) => {
    const controller = getGlobalSwarmController();
    const events = controller.getAllEvents();

    const stats: SwarmStats = {
      activeTasks: controller.getActiveTaskCount(),
      totalTasks: events.length,
      completedTasks: 0,
      failedTasks: 0,
      runningTasks: 0,
      pendingTasks: 0,
    };

    const statusCounts = new Map<string, number>();
    for (const event of events) {
      const status = event.status || "unknown";
      statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
    }

    stats.completedTasks = statusCounts.get("completed") || 0;
    stats.failedTasks = statusCounts.get("failed") || 0;
    stats.runningTasks = statusCounts.get("running") || 0;
    stats.pendingTasks = statusCounts.get("pending") || 0;

    respond(true, { stats });
  },

  "swarm.taskEvents": async ({ params, respond }) => {
    const taskId = params.taskId;
    if (typeof taskId !== "string" || !taskId.trim()) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "taskId required"));
      return;
    }

    const controller = getGlobalSwarmController();
    const events = controller.getTaskEvents(taskId);

    respond(true, { events });
  },
};
