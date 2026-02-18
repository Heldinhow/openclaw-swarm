import type { GatewayBrowserClient } from "../gateway.ts";

export type SubagentState = {
  id: string;
  taskId: string;
  agentId: string;
  projectId?: string;
  status: string;
  startedAt: number;
  eventCount: number;
  runtime?: number;
};

export type SwarmStats = {
  activeTasks: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  runningTasks: number;
  pendingTasks: number;
};

export type SwarmState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  swarmLoading: boolean;
  swarmError: string | null;
  subagents: SubagentState[];
  stats: SwarmStats | null;
  filter: "all" | "running" | "completed";
};

export async function loadSwarm(state: SwarmState) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.swarmLoading) {
    return;
  }
  state.swarmLoading = true;
  state.swarmError = null;
  try {
    // Load subagents and stats in parallel
    const [subagentsRes, statsRes] = await Promise.all([
      state.client.request<{ subagents?: SubagentState[] }>("swarm.subagents", {}),
      state.client.request<{ stats?: SwarmStats }>("swarm.stats", {}),
    ]);

    // Handle both naming conventions: subagents (SwarmState) and swarmSubagents (App state)
    if (subagentsRes && Array.isArray(subagentsRes.subagents)) {
      if ("subagents" in state) {
        state.subagents = subagentsRes.subagents;
      } else if ("swarmSubagents" in state) {
        (state as unknown as { swarmSubagents: SubagentState[] }).swarmSubagents =
          subagentsRes.subagents;
      }
    } else {
      if ("subagents" in state) {
        state.subagents = [];
      } else if ("swarmSubagents" in state) {
        (state as unknown as { swarmSubagents: SubagentState[] }).swarmSubagents = [];
      }
    }

    if (statsRes && statsRes.stats) {
      if ("stats" in state) {
        state.stats = statsRes.stats;
      } else if ("swarmStats" in state) {
        (state as unknown as { swarmStats: SwarmStats }).swarmStats = statsRes.stats;
      }
    }
  } catch (err) {
    state.swarmError = String(err);
  } finally {
    state.swarmLoading = false;
  }
}

export function setSwarmFilter(state: SwarmState, filter: "all" | "running" | "completed") {
  state.filter = filter;
}

export function getFilteredSubagents(state: SwarmState): SubagentState[] {
  const filter = state.filter;
  return state.subagents.filter((subagent) => {
    if (filter === "all") {
      return true;
    }
    if (filter === "running") {
      return subagent.status === "running" || subagent.status === "pending";
    }
    if (filter === "completed") {
      return subagent.status === "completed" || subagent.status === "failed";
    }
    return true;
  });
}
