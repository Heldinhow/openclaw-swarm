/**
 * Orchestrator Event Handler
 * 
 * Phase 3: Event-Driven & Autonomy
 * Handles events published by subagents, specifically:
 * - task_complete: notification when a subagent finishes
 * - handoff: request to transfer control to another agent
 * - checkpoint: save state for resume
 * - custom events
 */

import { callGateway } from "../../gateway/call.js";
import { resolveAgentIdFromSessionKey, normalizeAgentId } from "../../routing/session-key.js";
import { getSharedContextStore } from "./shared-context-store.js";
import { registerEventHandler, type ContextPublishEvent, type ContextPublishEventType } from "../tools/context-publish-tool.js";

export interface OrchestratorEventHandlerConfig {
  /** Enable event-driven notifications */
  enabled: boolean;
  /** Auto-notify via sessions_send when subagent completes */
  notifyOnTaskComplete: boolean;
  /** Enable handoff support */
  enableHandoff: boolean;
  /** Enable checkpoint/resume */
  enableCheckpoint: boolean;
}

/**
 * Default configuration
 */
const defaultConfig: OrchestratorEventHandlerConfig = {
  enabled: true,
  notifyOnTaskComplete: true,
  enableHandoff: true,
  enableCheckpoint: true,
};

let config: OrchestratorEventHandlerConfig = { ...defaultConfig };
let handlerInitialized = false;

/**
 * Configure the orchestrator event handler
 */
export function configureOrchestratorEventHandler(
  overrides: Partial<OrchestratorEventHandlerConfig>,
): void {
  config = { ...config, ...overrides };
}

/**
 * Initialize the orchestrator event handler
 * This sets up listeners for events from subagents
 */
export function initOrchestratorEventHandler(): void {
  if (handlerInitialized) {
    return;
  }
  handlerInitialized = true;

  // Register handler for orchestrator events
  registerEventHandler("orchestrator", handleOrchestratorEvent);
  
  // Register handler for broadcast events
  registerEventHandler("broadcast", handleBroadcastEvent);
  
  console.log("[OrchestratorEventHandler] Initialized");
}

/**
 * Main event handler for orchestrator-targeted events
 */
async function handleOrchestratorEvent(event: ContextPublishEvent): Promise<void> {
  if (!config.enabled) {
    return;
  }

  console.log(`[OrchestratorEventHandler] Received event: ${event.eventType} from ${event.sourceSessionKey}`);

  switch (event.eventType) {
    case "task_complete":
      await handleTaskComplete(event);
      break;
    case "handoff":
      await handleHandoff(event);
      break;
    case "checkpoint":
      await handleCheckpoint(event);
      break;
    case "task_progress":
      await handleTaskProgress(event);
      break;
    case "task_error":
      await handleTaskError(event);
      break;
    default:
      await handleCustomEvent(event);
  }
}

/**
 * Handler for broadcast events
 */
async function handleBroadcastEvent(event: ContextPublishEvent): Promise<void> {
  // Broadcast events are logged but not automatically acted upon
  console.log(`[OrchestratorEventHandler] Broadcast event: ${event.eventType} from ${event.sourceSessionKey}`);
  
  // Store in broadcast history
  const store = getSharedContextStore();
  store.set("broadcast_events", event.id, event, 60000); // Keep for 1 minute
}

/**
 * Handle task_complete event
 * Notifies the parent/orchestrator that a subagent has finished
 */
async function handleTaskComplete(event: ContextPublishEvent): Promise<void> {
  if (!config.notifyOnTaskComplete) {
    return;
  }

  const { sourceSessionKey, data } = event;
  
  // Extract requester session key from the source session key
  // Format: agent:agentId:subagent:uuid or agent:agentId:subagent:uuid:shared:sharedKey
  const parts = sourceSessionKey.split(":");
  const subagentIdx = parts.indexOf("subagent");
  if (subagentIdx < 0) {
    console.log("[OrchestratorEventHandler] Cannot determine parent for task_complete");
    return;
  }
  
  // Build parent session key: agent:agentId
  const parentParts = parts.slice(0, subagentIdx);
  const parentSessionKey = parentParts.join(":");
  
  if (!parentSessionKey) {
    return;
  }

  // Prepare notification message
  const taskData = (data as Record<string, unknown>) || {};
  const status = taskData.status || "completed";
  const result = taskData.result;
  const label = taskData.label;
  
  let message = `📋 **Subagent Task Complete**\n\n`;
  message += `**Status:** ${status}\n`;
  
  if (label) {
    message += `**Label:** ${label}\n`;
  }
  
  if (result) {
    message += `**Result:** ${JSON.stringify(result)}\n`;
  }
  
  // Check for handoff request in the completion data
  const handoff = taskData.handoff as string | undefined;
  if (handoff && config.enableHandoff) {
    message += `\n🔄 **Handoff to:** ${handoff}`;
  }
  
  // Check for checkpoint data
  const checkpoint = taskData.checkpoint as Record<string, unknown> | undefined;
  if (checkpoint && config.enableCheckpoint) {
    message += `\n💾 **Checkpoint available for resume**`;
  }

  // Send notification to parent session
  try {
    await callGateway({
      method: "sessions.send",
      params: {
        sessionKey: parentSessionKey,
        message,
        channel: "internal",
      },
      timeoutMs: 5000,
    });
    
    console.log(`[OrchestratorEventHandler] Notified parent ${parentSessionKey} of task completion`);
  } catch (err) {
    console.error(`[OrchestratorEventHandler] Failed to notify parent:`, err);
  }
  
  // Store the completion event for later retrieval
  const store = getSharedContextStore();
  store.set("task_completions", sourceSessionKey, {
    event,
    parentSessionKey,
    completedAt: Date.now(),
  });
}

/**
 * Handle handoff event
 * Transfer control to another agent
 */
async function handleHandoff(event: ContextPublishEvent): Promise<void> {
  if (!config.enableHandoff) {
    console.log("[OrchestratorEventHandler] Handoff disabled");
    return;
  }

  const { sourceSessionKey, data } = event;
  const handoffData = (data as Record<string, unknown>) || {};
  
  const targetAgent = handoffData.target as string;
  const task = handoffData.task as string;
  const context = handoffData.context;
  
  if (!targetAgent) {
    console.error("[OrchestratorEventHandler] Handoff missing target agent");
    return;
  }

  // Determine parent session for spawning next agent
  const parts = sourceSessionKey.split(":");
  const subagentIdx = parts.indexOf("subagent");
  const parentParts = parts.slice(0, subagentIdx);
  const parentSessionKey = parentParts.join(":");
  
  if (!parentSessionKey) {
    console.error("[OrchestratorEventHandler] Cannot determine parent for handoff");
    return;
  }

  // Spawn the next agent (handoff)
  try {
    const spawnParams: Record<string, unknown> = {
      task: task || "Continue with handoff task",
      label: `handoff-${Date.now()}`,
    };
    
    if (targetAgent !== "parent") {
      spawnParams.agentId = targetAgent;
    }
    
    // Include context from handoff
    if (context) {
      spawnParams.context = context;
    }

    await callGateway({
      method: "sessions.spawn",
      params: spawnParams,
      timeoutMs: 10000,
    });
    
    console.log(`[OrchestratorEventHandler] Handed off to ${targetAgent}`);
  } catch (err) {
    console.error(`[OrchestratorEventHandler] Failed to spawn handoff agent:`, err);
  }
}

/**
 * Handle checkpoint event
 * Save state for later resume
 */
async function handleCheckpoint(event: ContextPublishEvent): Promise<void> {
  if (!config.enableCheckpoint) {
    return;
  }

  const { sourceSessionKey, data } = event;
  const checkpointData = (data as Record<string, unknown>) || {};
  
  const checkpointId = checkpointData.id as string || `checkpoint-${Date.now()}`;
  const state = checkpointData.state;
  const metadata = checkpointData.metadata;
  
  if (!state) {
    console.error("[OrchestratorEventHandler] Checkpoint missing state");
    return;
  }

  // Store checkpoint in context store
  const store = getSharedContextStore();
  const namespace = `checkpoints:${sourceSessionKey}`;
  
  store.set(namespace, checkpointId, {
    id: checkpointId,
    sourceSessionKey,
    state,
    metadata,
    createdAt: Date.now(),
  }, checkpointData.ttl as number); // Optional TTL

  console.log(`[OrchestratorEventHandler] Saved checkpoint ${checkpointId} for ${sourceSessionKey}`);
}

/**
 * Handle task_progress event
 */
async function handleTaskProgress(event: ContextPublishEvent): Promise<void> {
  const { sourceSessionKey, data } = event;
  const progressData = (data as Record<string, unknown>) || {};
  
  const percent = progressData.percent;
  const message = progressData.message;
  
  console.log(`[OrchestratorEventHandler] Progress from ${sourceSessionKey}: ${percent}% - ${message}`);
  
  // Store progress for monitoring
  const store = getSharedContextStore();
  store.set("task_progress", sourceSessionKey, {
    event,
    lastUpdate: Date.now(),
  });
}

/**
 * Handle task_error event
 */
async function handleTaskError(event: ContextPublishEvent): Promise<void> {
  const { sourceSessionKey, data } = event;
  const errorData = (data as Record<string, unknown>) || {};
  
  const error = errorData.error as string;
  const recoverable = errorData.recoverable as boolean;
  
  console.error(`[OrchestratorEventHandler] Task error from ${sourceSessionKey}: ${error}`);
  
  // Store error for later retrieval
  const store = getSharedContextStore();
  store.set("task_errors", sourceSessionKey, {
    event,
    error,
    recoverable,
    occurredAt: Date.now(),
  });
  
  // Could also notify parent session of the error
  const parts = sourceSessionKey.split(":");
  const subagentIdx = parts.indexOf("subagent");
  if (subagentIdx >= 0) {
    const parentParts = parts.slice(0, subagentIdx);
    const parentSessionKey = parentParts.join(":");
    
    if (parentSessionKey) {
      try {
        await callGateway({
          method: "sessions.send",
          params: {
            sessionKey: parentSessionKey,
            message: `⚠️ **Subagent Error**\n\n${error}`,
            channel: "internal",
          },
          timeoutMs: 5000,
        });
      } catch {
        // Ignore notification failures
      }
    }
  }
}

/**
 * Handle custom events
 */
async function handleCustomEvent(event: ContextPublishEvent): Promise<void> {
  const { sourceSessionKey, data, target } = event;
  
  console.log(`[OrchestratorEventHandler] Custom event from ${sourceSessionKey}:`, data);
  
  // Store custom event
  const store = getSharedContextStore();
  store.set("custom_events", event.id, {
    event,
    target,
    receivedAt: Date.now(),
  });
}

/**
 * Get task completion for a session
 */
export function getTaskCompletion(sessionKey: string): unknown {
  const store = getSharedContextStore();
  return store.get("task_completions", sessionKey);
}

/**
 * Get checkpoint for a session
 */
export function getCheckpoint(sessionKey: string, checkpointId: string): unknown {
  const store = getSharedContextStore();
  const namespace = `checkpoints:${sessionKey}`;
  return store.get(namespace, checkpointId);
}

/**
 * List checkpoints for a session
 */
export function listCheckpoints(sessionKey: string): string[] {
  const store = getSharedContextStore();
  const namespace = `checkpoints:${sessionKey}`;
  return store.list(namespace);
}

/**
 * Get task errors
 */
export function getTaskErrors(sessionKey: string): unknown {
  const store = getSharedContextStore();
  return store.get("task_errors", sessionKey);
}
