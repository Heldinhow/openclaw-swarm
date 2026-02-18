/**
 * SubagentCard Component
 *
 * Displays a single subagent's status, runtime, and key info.
 */

import { html } from "lit";

export interface SubagentCardProps {
  id: string;
  label: string;
  agentId: string;
  taskId: string;
  status: string;
  startedAt: number;
  runtime?: number;
  eventCount: number;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

/**
 * Get status color based on status string
 */
function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case "running":
      return "#22c55e"; // green
    case "completed":
      return "#3b82f6"; // blue
    case "failed":
      return "#ef4444"; // red
    case "pending":
    case "spawning":
      return "#f59e0b"; // amber
    case "terminating":
      return "#94a3b8"; // slate
    default:
      return "#94a3b8";
  }
}

/**
 * Get status icon based on status string
 */
function getStatusIcon(status: string): string {
  switch (status.toLowerCase()) {
    case "running":
      return "▶";
    case "completed":
      return "✓";
    case "failed":
      return "✕";
    case "pending":
      return "○";
    case "spawning":
      return "◐";
    case "terminating":
      return "◑";
    default:
      return "○";
  }
}

/**
 * Format runtime in human-readable format
 */
function formatRuntime(seconds?: number): string {
  if (seconds === undefined || seconds === 0) {
    return "-";
  }

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

/**
 * Render the SubagentCard component
 */
export function renderSubagentCard(props: SubagentCardProps) {
  const statusColor = getStatusColor(props.status);
  const statusIcon = getStatusIcon(props.status);

  return html`
    <div 
      class="subagent-card ${props.selected ? "selected" : ""}"
      @click=${() => props.onSelect?.(props.id)}
      style="
        background: #1e293b;
        border: 1px solid ${props.selected ? "#6366f1" : "#334155"};
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 8px;
        cursor: pointer;
        transition: all 150ms ease;
      "
    >
      <div class="row" style="justify-content: space-between; align-items: center;">
        <div class="row" style="align-items: center; gap: 12px;">
          <div 
            class="status-indicator"
            style="
              width: 10px;
              height: 10px;
              border-radius: 50%;
              background: ${statusColor};
              ${props.status.toLowerCase() === "running" ? "animation: pulse 2s infinite;" : ""}
            "
          ></div>
          <span class="mono" style="font-size: 14px; color: #e2e8f0;">
            ${statusIcon} ${props.label || props.taskId}
          </span>
        </div>
        <div class="mono" style="font-size: 12px; color: #94a3b8;">
          ${formatRuntime(props.runtime)}
        </div>
      </div>
      
      <div class="row" style="margin-top: 8px; gap: 16px; font-size: 12px; color: #64748b;">
        <span>Agent: <span class="mono">${props.agentId}</span></span>
        <span>Events: ${props.eventCount}</span>
      </div>
      
      <style>
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        .subagent-card:hover {
          border-color: #6366f1 !important;
          transform: translateY(-1px);
        }
        
        .subagent-card.selected {
          background: #312e81 !important;
        }
      </style>
    </div>
  `;
}

/**
 * Render a grid of subagent cards
 */
export function renderSubagentGrid(
  subagents: SubagentCardProps[],
  selectedId?: string,
  onSelect?: (id: string) => void,
) {
  if (subagents.length === 0) {
    return html`
      <div class="empty-state" style="text-align: center; padding: 48px 24px; color: #64748b">
        <div style="font-size: 48px; margin-bottom: 16px">🐜</div>
        <div style="font-size: 16px; margin-bottom: 8px">No active subagents</div>
        <div style="font-size: 14px">Spawn subagents using sessions_spawn or parallel_spawn</div>
      </div>
    `;
  }

  return html`
    <div class="subagent-grid" style="display: flex; flex-direction: column; gap: 4px;">
      ${subagents.map((subagent) =>
        renderSubagentCard({
          ...subagent,
          selected: subagent.id === selectedId,
          onSelect,
        }),
      )}
    </div>
  `;
}
