/**
 * Swarm Dashboard Component
 *
 * Main container for the Swarm Monitoring Dashboard.
 */

import { html, nothing } from "lit";
import type { SubagentCardProps } from "./SubagentCard.js";

export interface SwarmStats {
  activeTasks: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  runningTasks: number;
  pendingTasks: number;
}

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

export type ViewType = "list" | "tree" | "graph";

export interface DashboardProps {
  loading: boolean;
  subagents: SubagentCardProps[];
  stats: SwarmStats | null;
  tree: OrchestrationNode[];
  activeView: ViewType;
  selectedSubagentId?: string;
  filter: "all" | "running" | "completed" | "failed";
  lastUpdate: number;
  error: string | null;
  onRefresh: () => void;
  onViewChange: (view: ViewType) => void;
  onFilterChange: (filter: "all" | "running" | "completed" | "failed") => void;
  onSelectSubagent: (id: string) => void;
}

/**
 * Format timestamp to relative time
 */
function formatLastUpdate(timestamp: number): string {
  if (!timestamp) {
    return "Never";
  }

  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 5) {
    return "Just now";
  }
  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

/**
 * Render stats badge
 */
function renderStatsBadge(stats: SwarmStats | null) {
  if (!stats) {
    return html`
      <span class="muted">No data</span>
    `;
  }

  return html`
    <div class="stats-badges" style="display: flex; gap: 12px; flex-wrap: wrap;">
      <div class="stat-badge" style="
        background: #1e293b;
        padding: 4px 12px;
        border-radius: 16px;
        font-size: 12px;
        color: #22c55e;
      ">
        ${stats.activeTasks} active
      </div>
      <div class="stat-badge" style="
        background: #1e293b;
        padding: 4px 12px;
        border-radius: 16px;
        font-size: 12px;
        color: #3b82f6;
      ">
        ${stats.completedTasks} completed
      </div>
      <div class="stat-badge" style="
        background: #1e293b;
        padding: 4px 12px;
        border-radius: 16px;
        font-size: 12px;
        color: #ef4444;
      ">
        ${stats.failedTasks} failed
      </div>
      <div class="stat-badge" style="
        background: #1e293b;
        padding: 4px 12px;
        border-radius: 16px;
        font-size: 12px;
        color: #f59e0b;
      ">
        ${stats.pendingTasks} pending
      </div>
    </div>
  `;
}

/**
 * Render view tabs
 */
function renderViewTabs(activeView: ViewType, onViewChange: (view: ViewType) => void) {
  const views: { id: ViewType; label: string }[] = [
    { id: "list", label: "List View" },
    { id: "tree", label: "Tree View" },
    { id: "graph", label: "Graph View" },
  ];

  return html`
    <div class="view-tabs" style="display: flex; gap: 4px; margin-bottom: 16px;">
      ${views.map(
        (view) => html`
          <button
            class="view-tab ${activeView === view.id ? "active" : ""}"
            @click=${() => onViewChange(view.id)}
            style="
              background: ${activeView === view.id ? "#6366f1" : "transparent"};
              border: 1px solid ${activeView === view.id ? "#6366f1" : "#334155"};
              color: ${activeView === view.id ? "#fff" : "#94a3b8"};
              padding: 8px 16px;
              border-radius: 6px;
              cursor: pointer;
              font-size: 13px;
              transition: all 150ms ease;
            "
          >
            ${view.label}
          </button>
        `,
      )}
    </div>
  `;
}

/**
 * Render filter buttons
 */
function renderFilters(
  filter: "all" | "running" | "completed" | "failed",
  onFilterChange: (filter: "all" | "running" | "completed" | "failed") => void,
) {
  const filters: { id: typeof filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "running", label: "Running" },
    { id: "completed", label: "Completed" },
    { id: "failed", label: "Failed" },
  ];

  return html`
    <div class="filters" style="display: flex; gap: 8px;">
      ${filters.map(
        (f) => html`
          <button
            class="filter-btn ${filter === f.id ? "active" : ""}"
            @click=${() => onFilterChange(f.id)}
            style="
              background: ${filter === f.id ? "#1e293b" : "transparent"};
              border: 1px solid ${filter === f.id ? "#6366f1" : "#334155"};
              color: ${filter === f.id ? "#e2e8f0" : "#64748b"};
              padding: 6px 12px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 12px;
              transition: all 150ms ease;
            "
          >
            ${f.label}
          </button>
        `,
      )}
    </div>
  `;
}

/**
 * Render connection status
 */
function renderConnectionStatus(lastUpdate: number, loading: boolean) {
  return html`
    <div class="connection-status" style="
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #64748b;
    ">
      <div 
        class="status-dot ${loading ? "loading" : ""}"
        style="
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: ${loading ? "#f59e0b" : "#22c55e"};
          ${loading ? "animation: pulse 1s infinite;" : ""}
        "
      ></div>
      <span>${loading ? "Updating..." : `Updated ${formatLastUpdate(lastUpdate)}`}</span>
      
      <style>
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      </style>
    </div>
  `;
}

/**
 * Main render function for the Swarm Dashboard
 */
export function renderSwarmDashboard(props: DashboardProps) {
  return html`
    <section class="card">
      <!-- Header -->
      <div class="row" style="justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <div>
          <div class="card-title">🐜 Swarm Dashboard</div>
          <div class="card-sub">Monitor subagents and orchestration in real-time</div>
        </div>
        <div class="row" style="align-items: center; gap: 16px;">
          ${renderConnectionStatus(props.lastUpdate, props.loading)}
          <button 
            class="btn" 
            ?disabled=${props.loading}
            @click=${props.onRefresh}
            style="
              background: #6366f1;
              color: white;
              border: none;
              padding: 8px 16px;
              border-radius: 6px;
              cursor: pointer;
              font-size: 13px;
            "
          >
            ${props.loading ? "Refresh..." : "Refresh"}
          </button>
        </div>
      </div>
      
      <!-- Stats -->
      <div style="margin-bottom: 16px;">
        ${renderStatsBadge(props.stats)}
      </div>
      
      <!-- Error -->
      ${
        props.error
          ? html`<div class="callout danger" style="margin-bottom: 16px;">${props.error}</div>`
          : nothing
      }
      
      <!-- Filters -->
      <div class="row" style="justify-content: space-between; align-items: center; margin-bottom: 16px;">
        ${renderFilters(props.filter, props.onFilterChange)}
      </div>
      
      <!-- View Tabs -->
      ${renderViewTabs(props.activeView, props.onViewChange)}
      
      <!-- Content -->
      <div class="dashboard-content" style="
        background: #0f172a;
        border-radius: 8px;
        padding: 16px;
        min-height: 300px;
        max-height: 500px;
        overflow-y: auto;
      ">
        ${
          props.activeView === "list"
            ? renderListView(props)
            : props.activeView === "tree"
              ? renderTreeView(props)
              : renderGraphView(props)
        }
      </div>
      
      <!-- Footer -->
      <div class="row" style="justify-content: space-between; margin-top: 16px; font-size: 12px; color: #64748b;">
        <span>Total: ${props.subagents.length} subagents</span>
        <span>Polling interval: 5s</span>
      </div>
    </section>
  `;
}

/**
 * Render list view content
 */
function renderListView(props: DashboardProps) {
  const filteredSubagents = props.subagents.filter((subagent) => {
    if (props.filter === "all") {
      return true;
    }
    return subagent.status.toLowerCase() === props.filter;
  });

  if (filteredSubagents.length === 0) {
    return html`
      <div style="text-align: center; padding: 48px; color: #64748b;">
        <div style="font-size: 32px; margin-bottom: 12px;">🔍</div>
        <div>No ${props.filter === "all" ? "" : props.filter} subagents found</div>
      </div>
    `;
  }

  return html`
    <div class="subagent-list" style="display: flex; flex-direction: column; gap: 4px;">
      ${filteredSubagents.map((subagent) => {
        // Import dynamically in the actual render
        const { renderSubagentCard } = require("./SubagentCard.js");
        return renderSubagentCard({
          ...subagent,
          selected: subagent.id === props.selectedSubagentId,
          onSelect: props.onSelectSubagent,
        });
      })}
    </div>
  `;
}

/**
 * Render tree view content
 */
function renderTreeView(props: DashboardProps) {
  const { renderTreeView: treeRenderer } = require("./TreeView.js");
  return treeRenderer({
    tree: props.tree,
    selectedId: props.selectedSubagentId,
    onSelect: props.onSelectSubagent,
  });
}

/**
 * Render graph view content (placeholder)
 */
function renderGraphView(props: DashboardProps) {
  return html`
    <div style="text-align: center; padding: 48px; color: #64748b;">
      <div style="font-size: 32px; margin-bottom: 12px;">📊</div>
      <div>Graph View</div>
      <div style="font-size: 12px; margin-top: 8px;">
        ${props.tree.length} nodes in orchestration tree
      </div>
    </div>
  `;
}
