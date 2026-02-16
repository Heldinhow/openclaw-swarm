import { Type } from "@sinclair/typebox";
import crypto from "node:crypto";
import type { GatewayMessageChannel } from "../../utils/message-channel.js";
import type { AnyAgentTool } from "./common.js";
import { formatThinkingLevels, normalizeThinkLevel } from "../../auto-reply/thinking.js";
import { loadConfig } from "../../config/config.js";
import { callGateway } from "../../gateway/call.js";
import { normalizeAgentId, parseAgentSessionKey } from "../../routing/session-key.js";
import { normalizeDeliveryContext } from "../../utils/delivery-context.js";
import { resolveAgentConfig } from "../agent-scope.js";
import { AGENT_LANE_SUBAGENT } from "../lanes.js";
import { resolveDefaultModelForAgent } from "../model-selection.js";
import { optionalStringEnum } from "../schema/typebox.js";
import { extractSessionContext, type ContextSharingMode } from "../orchestration/context-bridge.js";
import { buildSubagentSystemPrompt } from "../subagent-announce.js";
import { getSubagentDepthFromSessionStore } from "../subagent-depth.js";
import { countActiveRunsForSession, registerSubagentRun } from "../subagent-registry.js";
import { jsonResult, readStringParam } from "./common.js";
import {
  resolveDisplaySessionKey,
  resolveInternalSessionKey,
  resolveMainSessionAlias,
} from "./sessions-helpers.js";

const SessionsSpawnToolSchema = Type.Object({
  task: Type.String(),
  label: Type.Optional(Type.String()),
  agentId: Type.Optional(Type.String()),
  model: Type.Optional(Type.String()),
  thinking: Type.Optional(Type.String()),
  runTimeoutSeconds: Type.Optional(Type.Number({ minimum: 0 })),
  // Back-compat: older callers used timeoutSeconds for this tool.
  timeoutSeconds: Type.Optional(Type.Number({ minimum: 0 })),
  cleanup: optionalStringEnum(["delete", "keep"] as const),
  // Context sharing options (Phase 1: Context Bridge)
  contextSharing: Type.Optional(
    optionalStringEnum(["none", "summary", "recent", "full"] as const),
  ),
  context: Type.Optional(
    Type.Object({
      includeHistory: Type.Optional(Type.Boolean()),
      includeFiles: Type.Optional(Type.Array(Type.String())),
      maxTokens: Type.Optional(Type.Number({ minimum: 100, maximum: 100000 })),
    }),
  ),
  // Shared context key (Phase 2: Shared Context Store)
  // When provided, subagents with the same sharedKey can access the same namespace
  // in the SharedContextStore, enabling sibling-to-sibling communication.
  sharedKey: Type.Optional(Type.String()),
  // Phase 3: Handoff Support
  // When provided, indicates which agent should run after this subagent completes.
  // Can be a specific agentId or "parent" to return control to parent session.
  handoff: Type.Optional(
    Type.Union([
      Type.String({ description: "Agent ID to hand off to" }),
      Type.Literal("parent", { description: "Return control to parent session" }),
    ]),
  ),
  // Phase 3: Checkpoint/Resume
  // When provided, the subagent will resume from a previous checkpoint state.
  // Format: "sessionKey:checkpointId" or just "checkpointId" (uses current session).
  resumeFrom: Type.Optional(Type.String()),
});

function splitModelRef(ref?: string) {
  if (!ref) {
    return { provider: undefined, model: undefined };
  }
  const trimmed = ref.trim();
  if (!trimmed) {
    return { provider: undefined, model: undefined };
  }
  const [provider, model] = trimmed.split("/", 2);
  if (model) {
    return { provider, model };
  }
  return { provider: undefined, model: trimmed };
}

function normalizeModelSelection(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const primary = (value as { primary?: unknown }).primary;
  if (typeof primary === "string" && primary.trim()) {
    return primary.trim();
  }
  return undefined;
}

export function createSessionsSpawnTool(opts?: {
  agentSessionKey?: string;
  agentChannel?: GatewayMessageChannel;
  agentAccountId?: string;
  agentTo?: string;
  agentThreadId?: string | number;
  agentGroupId?: string | null;
  agentGroupChannel?: string | null;
  agentGroupSpace?: string | null;
  sandboxed?: boolean;
  /** Explicit agent ID override for cron/hook sessions where session key parsing may not work. */
  requesterAgentIdOverride?: string;
}): AnyAgentTool {
  return {
    label: "Sessions",
    name: "sessions_spawn",
    description:
      "Spawn a background sub-agent run in an isolated session and announce the result back to the requester chat.",
    parameters: SessionsSpawnToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const task = readStringParam(params, "task", { required: true });
      const label = typeof params.label === "string" ? params.label.trim() : "";
      const requestedAgentId = readStringParam(params, "agentId");
      const modelOverride = readStringParam(params, "model");
      const thinkingOverrideRaw = readStringParam(params, "thinking");
      const cleanup =
        params.cleanup === "keep" || params.cleanup === "delete" ? params.cleanup : "keep";
      const requesterOrigin = normalizeDeliveryContext({
        channel: opts?.agentChannel,
        accountId: opts?.agentAccountId,
        to: opts?.agentTo,
        threadId: opts?.agentThreadId,
      });
      // Default to 0 (no timeout) when omitted. Sub-agent runs are long-lived
      // by default and should not inherit the main agent 600s timeout.
      const timeoutSecondsCandidate =
        typeof params.runTimeoutSeconds === "number"
          ? params.runTimeoutSeconds
          : typeof params.timeoutSeconds === "number"
            ? params.timeoutSeconds
            : undefined;
      const runTimeoutSeconds =
        typeof timeoutSecondsCandidate === "number" && Number.isFinite(timeoutSecondsCandidate)
          ? Math.max(0, Math.floor(timeoutSecondsCandidate))
          : 0;
      let modelWarning: string | undefined;
      let modelApplied = false;

      const cfg = loadConfig();
      const { mainKey, alias } = resolveMainSessionAlias(cfg);
      const requesterSessionKey = opts?.agentSessionKey;
      const requesterInternalKey = requesterSessionKey
        ? resolveInternalSessionKey({
            key: requesterSessionKey,
            alias,
            mainKey,
          })
        : alias;
      const requesterDisplayKey = resolveDisplaySessionKey({
        key: requesterInternalKey,
        alias,
        mainKey,
      });

      const callerDepth = getSubagentDepthFromSessionStore(requesterInternalKey, { cfg });
      const maxSpawnDepth = cfg.agents?.defaults?.subagents?.maxSpawnDepth ?? 1;
      if (callerDepth >= maxSpawnDepth) {
        return jsonResult({
          status: "forbidden",
          error: `sessions_spawn is not allowed at this depth (current depth: ${callerDepth}, max: ${maxSpawnDepth})`,
        });
      }

      const maxChildren = cfg.agents?.defaults?.subagents?.maxChildrenPerAgent ?? 5;
      const activeChildren = countActiveRunsForSession(requesterInternalKey);
      if (activeChildren >= maxChildren) {
        return jsonResult({
          status: "forbidden",
          error: `sessions_spawn has reached max active children for this session (${activeChildren}/${maxChildren})`,
        });
      }

      const requesterAgentId = normalizeAgentId(
        opts?.requesterAgentIdOverride ?? parseAgentSessionKey(requesterInternalKey)?.agentId,
      );
      const targetAgentId = requestedAgentId
        ? normalizeAgentId(requestedAgentId)
        : requesterAgentId;
      if (targetAgentId !== requesterAgentId) {
        const allowAgents = resolveAgentConfig(cfg, requesterAgentId)?.subagents?.allowAgents ?? [];
        const allowAny = allowAgents.some((value) => value.trim() === "*");
        const normalizedTargetId = targetAgentId.toLowerCase();
        const allowSet = new Set(
          allowAgents
            .filter((value) => value.trim() && value.trim() !== "*")
            .map((value) => normalizeAgentId(value).toLowerCase()),
        );
        if (!allowAny && !allowSet.has(normalizedTargetId)) {
          const allowedText = allowAny
            ? "*"
            : allowSet.size > 0
              ? Array.from(allowSet).join(", ")
              : "none";
          return jsonResult({
            status: "forbidden",
            error: `agentId is not allowed for sessions_spawn (allowed: ${allowedText})`,
          });
        }
      }
      // Shared context key (Phase 2: Shared Context Store)
      const sharedKey = readStringParam(params, "sharedKey");
      
      // Phase 3: Handoff Support
      // Target agent to hand off to when this subagent completes
      const handoff = readStringParam(params, "handoff");
      
      // Phase 3: Checkpoint/Resume
      // Resume from a previous checkpoint state
      const resumeFrom = readStringParam(params, "resumeFrom");
      let checkpointState: Record<string, unknown> | undefined;
      if (resumeFrom) {
        // Parse resumeFrom format: "sessionKey:checkpointId" or "checkpointId"
        const parts = resumeFrom.split(":");
        const checkpointId = parts[parts.length - 1];
        const sessionKeyForCheckpoint = parts.length > 1 
          ? parts.slice(0, -1).join(":")
          : requesterSessionKey;
        
        if (sessionKeyForCheckpoint && checkpointId) {
          try {
            // Import dynamically to avoid circular dependencies
            const { getCheckpoint } = await import("../orchestration/event-handler.js");
            const checkpoint = getCheckpoint(sessionKeyForCheckpoint, checkpointId);
            if (checkpoint && typeof checkpoint === "object") {
              const checkpointData = checkpoint as { state?: Record<string, unknown> };
              checkpointState = checkpointData.state;
              console.log(`[sessions_spawn] Resuming from checkpoint ${checkpointId}`);
            }
          } catch (err) {
            console.warn(`[sessions_spawn] Failed to load checkpoint:`, err);
          }
        }
      }
      
      // Build child session key with optional sharedKey for context store access
      // Format: agent:agentId:subagent:uuid OR agent:agentId:subagent:uuid:shared:sharedKey
      const subagentId = crypto.randomUUID();
      const childSessionKey = sharedKey
        ? `agent:${targetAgentId}:subagent:${subagentId}:shared:${sharedKey}`
        : `agent:${targetAgentId}:subagent:${subagentId}`;
      const childDepth = callerDepth + 1;
      const spawnedByKey = requesterInternalKey;
      const targetAgentConfig = resolveAgentConfig(cfg, targetAgentId);
      const runtimeDefaultModel = resolveDefaultModelForAgent({
        cfg,
        agentId: targetAgentId,
      });
      const resolvedModel =
        normalizeModelSelection(modelOverride) ??
        normalizeModelSelection(targetAgentConfig?.subagents?.model) ??
        normalizeModelSelection(cfg.agents?.defaults?.subagents?.model) ??
        normalizeModelSelection(cfg.agents?.defaults?.model?.primary) ??
        normalizeModelSelection(`${runtimeDefaultModel.provider}/${runtimeDefaultModel.model}`);

      const resolvedThinkingDefaultRaw =
        readStringParam(targetAgentConfig?.subagents ?? {}, "thinking") ??
        readStringParam(cfg.agents?.defaults?.subagents ?? {}, "thinking");

      let thinkingOverride: string | undefined;
      const thinkingCandidateRaw = thinkingOverrideRaw || resolvedThinkingDefaultRaw;
      if (thinkingCandidateRaw) {
        const normalized = normalizeThinkLevel(thinkingCandidateRaw);
        if (!normalized) {
          const { provider, model } = splitModelRef(resolvedModel);
          const hint = formatThinkingLevels(provider, model);
          return jsonResult({
            status: "error",
            error: `Invalid thinking level "${thinkingCandidateRaw}". Use one of: ${hint}.`,
          });
        }
        thinkingOverride = normalized;
      }
      try {
        await callGateway({
          method: "sessions.patch",
          params: { key: childSessionKey, spawnDepth: childDepth },
          timeoutMs: 10_000,
        });
      } catch (err) {
        const messageText =
          err instanceof Error ? err.message : typeof err === "string" ? err : "error";
        return jsonResult({
          status: "error",
          error: messageText,
          childSessionKey,
        });
      }

      if (resolvedModel) {
        try {
          await callGateway({
            method: "sessions.patch",
            params: { key: childSessionKey, model: resolvedModel },
            timeoutMs: 10_000,
          });
          modelApplied = true;
        } catch (err) {
          const messageText =
            err instanceof Error ? err.message : typeof err === "string" ? err : "error";
          const recoverable =
            messageText.includes("invalid model") || messageText.includes("model not allowed");
          if (!recoverable) {
            return jsonResult({
              status: "error",
              error: messageText,
              childSessionKey,
            });
          }
          modelWarning = messageText;
        }
      }
      if (thinkingOverride !== undefined) {
        try {
          await callGateway({
            method: "sessions.patch",
            params: {
              key: childSessionKey,
              thinkingLevel: thinkingOverride === "off" ? null : thinkingOverride,
            },
            timeoutMs: 10_000,
          });
        } catch (err) {
          const messageText =
            err instanceof Error ? err.message : typeof err === "string" ? err : "error";
          return jsonResult({
            status: "error",
            error: messageText,
            childSessionKey,
          });
        }
      }
      // Extract context from requester session for subagent (Phase 1: Context Bridge)
      const contextSharingRaw = readStringParam(params, "contextSharing");
      const contextSharingMode: ContextSharingMode = contextSharingRaw
        ? ["none", "summary", "recent", "full"].includes(contextSharingRaw)
          ? contextSharingRaw as ContextSharingMode
          : "none"
        : "none";

      const contextOptions = params.context as
        | { includeHistory?: boolean; includeFiles?: string[]; maxTokens?: number }
        | undefined;

      let extractedContext = { contextText: "", mode: "none" as ContextSharingMode, messageCount: 0, estimatedTokens: 0 };
      if (contextSharingMode !== "none" && requesterSessionKey) {
        extractedContext = await extractSessionContext(requesterSessionKey, {
          mode: contextSharingMode,
          maxTokens: contextOptions?.maxTokens,
          includeFiles: contextOptions?.includeFiles,
        });
      }

      const childSystemPrompt = buildSubagentSystemPrompt({
        requesterSessionKey,
        requesterOrigin,
        childSessionKey,
        label: label || undefined,
        task,
        childDepth,
        maxSpawnDepth,
        extractedContext: contextSharingMode !== "none" ? extractedContext : undefined,
      });

      // Append checkpoint state to system prompt if resuming
      let finalSystemPrompt = childSystemPrompt;
      if (checkpointState) {
        const checkpointSection = `\n\n## Resumed from Checkpoint\nThe following state was restored from a previous checkpoint:\n\`\`\`json\n${JSON.stringify(checkpointState, null, 2)}\n\`\`\nUse this state to continue the task.\n`;
        finalSystemPrompt = childSystemPrompt + checkpointSection;
      }

      const childIdem = crypto.randomUUID();
      let childRunId: string = childIdem;
      try {
        const response = await callGateway<{ runId: string }>({
          method: "agent",
          params: {
            message: task,
            sessionKey: childSessionKey,
            channel: requesterOrigin?.channel,
            to: requesterOrigin?.to ?? undefined,
            accountId: requesterOrigin?.accountId ?? undefined,
            threadId:
              requesterOrigin?.threadId != null ? String(requesterOrigin.threadId) : undefined,
            idempotencyKey: childIdem,
            deliver: false,
            lane: AGENT_LANE_SUBAGENT,
            extraSystemPrompt: finalSystemPrompt,
            thinking: thinkingOverride,
            timeout: runTimeoutSeconds,
            label: label || undefined,
            spawnedBy: spawnedByKey,
            groupId: opts?.agentGroupId ?? undefined,
            groupChannel: opts?.agentGroupChannel ?? undefined,
            groupSpace: opts?.agentGroupSpace ?? undefined,
          },
          timeoutMs: 10_000,
        });
        if (typeof response?.runId === "string" && response.runId) {
          childRunId = response.runId;
        }
      } catch (err) {
        const messageText =
          err instanceof Error ? err.message : typeof err === "string" ? err : "error";
        return jsonResult({
          status: "error",
          error: messageText,
          childSessionKey,
          runId: childRunId,
        });
      }

      registerSubagentRun({
        runId: childRunId,
        childSessionKey,
        requesterSessionKey: requesterInternalKey,
        requesterOrigin,
        requesterDisplayKey,
        task,
        cleanup,
        label: label || undefined,
        model: resolvedModel,
        runTimeoutSeconds,
        handoff: handoff || undefined,
        checkpointId: resumeFrom ? resumeFrom.split(":").pop() : undefined,
      });

      return jsonResult({
        status: "accepted",
        childSessionKey,
        runId: childRunId,
        modelApplied: resolvedModel ? modelApplied : undefined,
        warning: modelWarning,
        handoff: handoff || undefined,
        resumedFrom: resumeFrom || undefined,
      });
    },
  };
}
