/**
 * TreeView Component
 *
 * Displays orchestration tree with parent-child relationships.
 */

import { html, nothing } from "lit";

export interface TreeNodeProps {
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
  expanded?: boolean;
}

export interface TreeViewProps {
  tree: TreeNodeProps[];
  selectedId?: string;
  onSelect?: (id: string) => void;
}

/**
 * Get status color based on status string
 */
function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case "running":
      return "#22c55e";
    case "completed":
      return "#3b82f6";
    case "failed":
      return "#ef4444";
    case "pending":
    case "spawning":
      return "#f59e0b";
    case "terminating":
      return "#94a3b8";
    default:
      return "#94a3b8";
  }
}

/**
 * Format runtime
 */
function formatRuntime(seconds?: number): string {
  if (seconds === undefined || seconds === 0) {
    return "";
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
 * Render a single tree node recursively
 */
function renderTreeNode(
  node: TreeNodeProps,
  allNodes: Map<string, TreeNodeProps>,
  selectedId: string | undefined,
  onSelect?: (id: string) => void,
  expandedNodes: Set<string> = new Set(),
  depth: number = 0,
): ReturnType<typeof html> {
  const statusColor = getStatusColor(node.status);
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedNodes.has(node.id);
  const isSelected = node.id === selectedId;

  return html`
    <div class="tree-node" style="
      margin-left: ${depth * 20}px;
      position: relative;
    ">
      <!-- Connector line for children -->
      ${
        depth > 0
          ? html`
              <div
                style="position: absolute; left: -12px; top: 0; bottom: 0; width: 1px; background: #334155"
              ></div>
              <div
                style="position: absolute; left: -12px; top: 50%; width: 12px; height: 1px; background: #334155"
              ></div>
            `
          : nothing
      }
      
      <div 
        class="node-content ${isSelected ? "selected" : ""}"
        @click=${() => onSelect?.(node.id)}
        style="
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
          background: ${isSelected ? "#312e81" : "transparent"};
          border: 1px solid ${isSelected ? "#6366f1" : "transparent"};
          transition: all 150ms ease;
          margin-bottom: 2px;
        "
      >
        <!-- Expand/collapse toggle -->
        ${
          hasChildren
            ? html`
          <span 
            class="expand-toggle"
            @click=${(e: Event) => {
              e.stopPropagation();
              // Toggle would be handled by parent state
            }}
            style="
              cursor: pointer;
              color: #64748b;
              font-size: 10px;
              width: 16px;
              display: inline-block;
            "
          >
            ${isExpanded ? "▼" : "▶"}
          </span>
        `
            : html`
                <span style="width: 16px"></span>
              `
        }
        
        <!-- Status indicator -->
        <div style="
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: ${statusColor};
          flex-shrink: 0;
        "></div>
        
        <!-- Node label -->
        <span class="mono" style="
          font-size: 13px;
          color: #e2e8f0;
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        ">
          ${node.label || node.taskId}
        </span>
        
        <!-- Runtime -->
        ${
          node.runtime
            ? html`
          <span style="
            font-size: 11px;
            color: #64748b;
          ">
            ${formatRuntime(node.runtime)}
          </span>
        `
            : nothing
        }
        
        <!-- Children count -->
        ${
          hasChildren
            ? html`
          <span style="
            font-size: 11px;
            color: #64748b;
            background: #1e293b;
            padding: 2px 6px;
            border-radius: 10px;
          ">
            ${node.children.length}
          </span>
        `
            : nothing
        }
      </div>
      
      <!-- Render children if expanded -->
      ${
        hasChildren && isExpanded
          ? html`
        <div class="children">
          ${node.children.map((childId) => {
            const childNode = allNodes.get(childId);
            if (!childNode) {
              return nothing;
            }
            return renderTreeNode(
              childNode,
              allNodes,
              selectedId,
              onSelect,
              expandedNodes,
              depth + 1,
            );
          })}
        </div>
      `
          : nothing
      }
    </div>
  `;
}

/**
 * Main TreeView render function
 */
export function renderTreeView(props: TreeViewProps) {
  const { tree } = props;

  if (!tree || tree.length === 0) {
    return html`
      <div style="text-align: center; padding: 48px; color: #64748b">
        <div style="font-size: 32px; margin-bottom: 12px">🌳</div>
        <div>No orchestration tree</div>
        <div style="font-size: 12px; margin-top: 8px">Spawn subagents to see the tree structure</div>
      </div>
    `;
  }

  // Build node map for quick lookup
  const nodeMap = new Map<string, TreeNodeProps>();
  for (const node of tree) {
    nodeMap.set(node.id, { ...node, expanded: true });
  }

  // Find root nodes (nodes without parentId)
  const rootNodes = tree.filter((n) => !n.parentId);

  // Default expanded nodes (all)
  const expandedNodes = new Set(tree.map((n) => n.id));

  return html`
    <div class="tree-view" style="
      padding: 8px;
      font-family: 'JetBrains Mono', monospace;
    ">
      ${rootNodes.map((node) =>
        renderTreeNode(node, nodeMap, props.selectedId, props.onSelect, expandedNodes, 0),
      )}
    </div>
  `;
}

/**
 * Render simple list for tree-like view when no parent relationships
 */
export function renderSimpleTreeView(
  nodes: TreeNodeProps[],
  selectedId?: string,
  onSelect?: (id: string) => void,
) {
  if (!nodes || nodes.length === 0) {
    return html`
      <div style="text-align: center; padding: 48px; color: #64748b">
        <div style="font-size: 32px; margin-bottom: 12px">🌳</div>
        <div>No active orchestrations</div>
      </div>
    `;
  }

  return html`
    <div class="tree-list" style="display: flex; flex-direction: column; gap: 4px;">
      ${nodes.map((node) => {
        const statusColor = getStatusColor(node.status);
        const isSelected = node.id === selectedId;

        return html`
          <div 
            class="tree-item"
            @click=${() => onSelect?.(node.id)}
            style="
              display: flex;
              align-items: center;
              gap: 12px;
              padding: 10px 14px;
              border-radius: 6px;
              cursor: pointer;
              background: ${isSelected ? "#312e81" : "#1e293b"};
              border: 1px solid ${isSelected ? "#6366f1" : "#334155"};
              transition: all 150ms ease;
            "
          >
            <!-- Indentation based on depth -->
            <div style="
              width: ${node.depth * 16}px;
              flex-shrink: 0;
            "></div>
            
            <!-- Status dot -->
            <div style="
              width: 10px;
              height: 10px;
              border-radius: 50%;
              background: ${statusColor};
              flex-shrink: 0;
            "></div>
            
            <!-- Label -->
            <span style="
              flex: 1;
              font-size: 13px;
              color: #e2e8f0;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            ">
              ${node.label || node.taskId}
            </span>
            
            <!-- Agent ID -->
            <span style="
              font-size: 11px;
              color: #64748b;
            ">
              ${node.agentId}
            </span>
            
            <!-- Runtime -->
            ${
              node.runtime
                ? html`
              <span style="
                font-size: 11px;
                color: #94a3b8;
                background: #0f172a;
                padding: 2px 8px;
                border-radius: 10px;
              ">
                ${formatRuntime(node.runtime)}
              </span>
            `
                : nothing
            }
          </div>
        `;
      })}
    </div>
  `;
}
