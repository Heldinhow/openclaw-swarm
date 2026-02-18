/**
 * Swarm Monitoring Dashboard - Server Methods
 *
 * API endpoints for monitoring subagents and orchestration state.
 */

import type { GatewayRequestHandlers, RespondFn } from "./types.js";
import { getGlobalSwarmController } from "../../agents/orchestration/swarm-controller.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import { assertValidParams } from "./validation.js";

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
 * Get all subagents from the swarm controller
 */
async function getSubagents(params: Record<string, unknown>, respond: RespondFn): Promise<void> {
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
}

/**
 * Get orchestration tree from events
 */
async function getOrchestrations(
  params: Record<string, unknown>,
  respond: RespondFn,
): Promise<void> {
  const controller = getGlobalSwarmController();
  const events = controller.getAllEvents();

  // Build tree from events
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

  // Build parent-child relationships
  for (const [id, node] of nodes) {
    if (node.parentId) {
      const parentNode = nodes.get(node.parentId);
      if (parentNode) {
        parentNode.children.push(id);
        node.depth = parentNode.depth + 1;
      }
    }
  }

  // Calculate runtime
  for (const node of nodes.values()) {
    if (node.startedAt > 0) {
      node.runtime = Math.floor((Date.now() - node.startedAt) / 1000);
    }
  }

  const tree = Array.from(nodes.values());
  respond(true, { tree, nodeCount: tree.length });
}

/**
 * Get swarm statistics
 */
async function getSwarmStats(params: Record<string, unknown>, respond: RespondFn): Promise<void> {
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

  // Count by status
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
}

/**
 * Get events for a specific task
 */
async function getTaskEvents(params: Record<string, unknown>, respond: RespondFn): Promise<void> {
  const valid = assertValidParams(params, ["taskId"]);
  if (!valid) {
    respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "taskId required"));
    return;
  }

  const { taskId } = params;
  const controller = getGlobalSwarmController();
  const events = controller.getTaskEvents(taskId as string);

  respond(true, { events });
}

/**
 * Export handlers
 */
export const swarmHandlers: GatewayRequestHandlers = {
  "swarm.subagents": getSubagents,
  "swarm.orchestrations": getOrchestrations,
  "swarm.stats": getSwarmStats,
  "swarm.taskEvents": getTaskEvents,
};
