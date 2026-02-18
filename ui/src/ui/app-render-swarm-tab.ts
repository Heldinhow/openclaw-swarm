import { html, nothing } from "lit";
import type { AppViewState } from "./app-view-state.ts";
import { loadSwarm } from "./controllers/swarm.ts";

function formatRuntime(startedAt: number, runtime?: number): string {
  const runTime = runtime ?? Date.now() - startedAt;
  const totalSeconds = Math.floor(runTime / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(minutes / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function getStatusChipClass(status: string): string {
  switch (status.toLowerCase()) {
    case "running":
      return "chip-ok";
    case "pending":
    case "spawning":
      return "chip-warn";
    case "failed":
      return "chip-danger";
    case "completed":
      return "chip";
    default:
      return "chip";
  }
}

export function renderSwarmTab(state: AppViewState) {
  if (state.tab !== "swarm") {
    return nothing;
  }

  const subagents = state.swarmSubagents ?? [];
  const stats = state.swarmStats;
  const loading = state.swarmLoading;
  const error = state.swarmError;

  const activeCount = stats?.runningTasks ?? subagents.filter((s) => s.status === "running").length;
  const completedCount =
    stats?.completedTasks ?? subagents.filter((s) => s.status === "completed").length;
  const failedCount = stats?.failedTasks ?? subagents.filter((s) => s.status === "failed").length;

  const handleRefresh = async () => {
    await loadSwarm(state as unknown as Parameters<typeof loadSwarm>[0]);
  };

  return html`
    <section class="card">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">Subagents</div>
          <div class="card-sub">Spawned subagents and orchestration state.</div>
        </div>
        <button class="btn" ?disabled=${loading} @click=${handleRefresh}>
          ${loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      ${
        error ? html`<div class="callout danger" style="margin-top: 14px;">${error}</div>` : nothing
      }

      <div class="agents-overview-grid" style="margin-top: 16px;">
        <div class="stat stat-card">
          <div class="stat-label">Total</div>
          <div class="stat-value">${subagents.length}</div>
        </div>
        <div class="stat stat-card">
          <div class="stat-label">Running</div>
          <div class="stat-value ok">${activeCount}</div>
        </div>
        <div class="stat stat-card">
          <div class="stat-label">Completed</div>
          <div class="stat-value">${completedCount}</div>
        </div>
        <div class="stat stat-card">
          <div class="stat-label">Failed</div>
          <div class="stat-value" style="color: var(--danger);">${failedCount}</div>
        </div>
      </div>

      ${
        subagents.length === 0 && !loading
          ? html`
              <div class="callout info" style="margin-top: 16px">
                No subagents found. Spawn subagents using
                <code>sessions_spawn</code> or <code>parallel_spawn</code> to see them here.
              </div>
            `
          : nothing
      }

      ${
        subagents.length > 0
          ? html`
              <div class="list" style="margin-top: 16px;">
                ${subagents.map(
                  (subagent) => html`
                    <div class="list-item">
                      <div class="list-main">
                        <div class="list-title">${subagent.taskId}</div>
                        <div class="list-sub">
                          <span class="mono">${subagent.agentId}</span>
                          ${
                            subagent.projectId
                              ? html` · <span class="mono">${subagent.projectId}</span>`
                              : nothing
                          }
                          ${subagent.eventCount ? html` · ${subagent.eventCount} events` : nothing}
                        </div>
                      </div>
                      <div class="list-meta">
                        <span class="chip ${getStatusChipClass(subagent.status)}">${subagent.status}</span>
                        <div class="muted">${formatTime(subagent.startedAt)}</div>
                        <div class="muted">${formatRuntime(subagent.startedAt, subagent.runtime)}</div>
                      </div>
                    </div>
                  `,
                )}
              </div>
            `
          : nothing
      }
    </section>
  `;
}
