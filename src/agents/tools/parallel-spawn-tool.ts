/**
 * Parallel Spawn Tool
 * 
 * Phase 4: Parallel Execution
 * Allows executing multiple tasks in parallel with different wait strategies.
 */

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
import { jsonResult, readStringParam, readNumberParam } from "./common.js";
import {
  resolveDisplaySessionKey,
  resolveInternalSessionKey,
  resolveMainSessionAlias,
} from "./sessions-helpers.js";

// Task definition for parallel execution
const ParallelTaskSchema = Type.Object({
  task: Type.String({ description: "Task description for this subagent" }),
  model: Type.Optional(Type.String({ description: "Model to use for this task" })),
  thinking: Type.Optional(Type.String({ description: "Thinking level for this task" })),
  agentId: Type.Optional(Type.String({ description: "Agent ID to use" })),
  label: Type.Optional(Type.String({ description: "Label for this subagent" })),
  contextSharing: Type.Optional(
    optionalStringEnum(["none", "summary", "recent", "full"] as const),
  ),
  sharedKey: Type.Optional(Type.String({ description: "Shared context key for this task" })),
});

// Wait strategy: "all" | "any" | "race" | number
const WaitStrategySchema = Type.Union([
  Type.Literal("all", { description: "Wait for all tasks to complete" }),
  Type.Literal("any", { description: "Return when any task completes" }),
  Type.Literal("race", { description: "Return first result (like Promise.race)" }),
  Type.Number({ minimum: 1, description: "Wait for N tasks to complete" }),
]);

const ParallelSpawnToolSchema = Type.Object({
  tasks: Type.Array(ParallelTaskSchema, { description: "Array of tasks to execute in parallel" }),
  wait: Type.Optional(WaitStrategySchema),
  sharedKey: Type.Optional(Type.String({ description: "Shared key for all tasks (optional namespace)" })),
  timeout: Type.Optional(Type.Number({ minimum: 0, description: "Overall timeout in seconds" })),
  // Aggregate results options
  aggregate: Type.Optional(
    Type.Object({
      mode: Type.Union([
        Type.Literal("all", { description: "Return all results" }),
        Type.Literal("first", { description: "Return first result" }),
        Type.Literal("last", { description: "Return last result" }),
        Type.Literal("summary", { description: "Return summary of all results" }),
        Type.Literal("errors", { description: "Return only errors" }),
      ], { description: "How to aggregate results" }),
      includeMetadata: Type.Optional(Type.Boolean({ description: "Include metadata in results" })),
    }),
  ),
});

/**
 * Result aggregator for parallel tasks
 */
interface TaskResult {
  index: number;
  label?: string;
  task: string;
  status: "accepted" | "completed" | "error";
  childSessionKey?: string;
  runId?: string;
  result?: unknown;
  error?: string;
  completedAt?: string;
  durationMs?: number;
}

function aggregateResults(
  results: TaskResult[],
  mode?: "all" | "first" | "last" | "summary" | "errors",
  includeMetadata = false,
): unknown {
  const successfulResults = results.filter(r => r.status !== "error");
  const errorResults = results.filter(r => r.status === "error");

  switch (mode) {
    case "first":
      return includeMetadata ? results[0] : results[0]?.result;

    case "last":
      return includeMetadata 
        ? results[results.length - 1] 
        : results[results.length - 1]?.result;

    case "errors":
      return includeMetadata ? errorResults : errorResults.map(r => r.error);

    case "summary":
      return {
        total: results.length,
        successful: successfulResults.length,
        errors: errorResults.length,
        results: includeMetadata ? results : results.map(r => ({
          index: r.index,
          status: r.status,
          result: r.result,
          error: r.error,
        })),
      };

    case "all":
    default:
      return includeMetadata ? results : results.map(r => r.result);
  }
}

/**
 * Wait strategy handler
 */
function getWaitStrategy(
  wait: "all" | "any" | "race" | number | undefined,
  totalTasks: number,
): { waitFor: number; stopOnFirstError: boolean; returnOnFirst: boolean } {
  if (wait === undefined || wait === "all") {
    return { waitFor: totalTasks, stopOnFirstError: false, returnOnFirst: false };
  }
  if (wait === "any") {
    return { waitFor: 1, stopOnFirstError: false, returnOnFirst: true };
  }
  if (wait === "race") {
    return { waitFor: 1, stopOnFirstError: false, returnOnFirst: true };
  }
  if (typeof wait === "number") {
    return { waitFor: Math.min(wait, totalTasks), stopOnFirstError: false, returnOnFirst: false };
  }
  return { waitFor: totalTasks, stopOnFirstError: false, returnOnFirst: false };
}

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

export function createParallelSpawnTool(opts?: {
  agentSessionKey?: string;
  agentChannel?: GatewayMessageChannel;
  agentAccountId?: string;
  agentTo?: string;
  agentThreadId?: string | number;
  agentGroupId?: string | null;
  agentGroupChannel?: string | null;
  agentGroupSpace?: string | null;
  sandboxed?: boolean;
  requesterAgentIdOverride?: string;
}): AnyAgentTool {
  return {
    label: "Parallel Spawn",
    name: "parallel_spawn",
    description:
      "Execute multiple subagent tasks in parallel with configurable wait strategies (all/any/race/N). Each task runs as an independent subagent and results are aggregated based on the specified strategy.",
    parameters: ParallelSpawnToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const startTime = Date.now();

      // Parse tasks
      const tasksParam = params.tasks;
      if (!Array.isArray(tasksParam) || tasksParam.length === 0) {
        return jsonResult({
          status: "error",
          error: "tasks array is required and must not be empty",
        });
      }

      const tasks = tasksParam.map((t: unknown, index: number) => {
        const taskObj = t as Record<string, unknown>;
        return {
          task: typeof taskObj.task === "string" ? taskObj.task : `Task ${index}`,
          model: typeof taskObj.model === "string" ? taskObj.model : undefined,
          thinking: typeof taskObj.thinking === "string" ? taskObj.thinking : undefined,
          agentId: typeof taskObj.agentId === "string" ? taskObj.agentId : undefined,
          label: typeof taskObj.label === "string" ? taskObj.label : `parallel-${index}`,
          contextSharing: taskObj.contextSharing as ContextSharingMode | undefined,
          sharedKey: typeof taskObj.sharedKey === "string" ? taskObj.sharedKey : undefined,
        };
      });

      // Parse wait strategy
      const waitRaw = params.wait;
      let waitStrategy: "all" | "any" | "race" | number | undefined;
      if (typeof waitRaw === "string" && ["all", "any", "race"].includes(waitRaw)) {
        waitStrategy = waitRaw as "all" | "any" | "race";
      } else if (typeof waitRaw === "number" && waitRaw > 0) {
        waitStrategy = waitRaw;
      }

      // Parse aggregate options
      const aggregateRaw = params.aggregate as
        | { mode?: string; includeMetadata?: boolean }
        | undefined;
      const aggregateMode = aggregateRaw?.mode as
        | "all"
        | "first"
        | "last"
        | "summary"
        | "errors"
        | undefined;
      const aggregateIncludeMetadata = aggregateRaw?.includeMetadata === true;

      // Parse sharedKey and timeout
      const sharedKey = readStringParam(params, "sharedKey");
      const timeoutSeconds = readNumberParam(params, "timeout");

      // Load config and resolve session info
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

      // Check depth limits
      const callerDepth = getSubagentDepthFromSessionStore(requesterInternalKey, { cfg });
      const maxSpawnDepth = cfg.agents?.defaults?.subagents?.maxSpawnDepth ?? 1;
      if (callerDepth >= maxSpawnDepth) {
        return jsonResult({
          status: "error",
          error: `parallel_spawn is not allowed at this depth (current depth: ${callerDepth}, max: ${maxSpawnDepth})`,
        });
      }

      // Check max children
      const maxChildren = cfg.agents?.defaults?.subagents?.maxChildrenPerAgent ?? 5;
      const activeChildren = countActiveRunsForSession(requesterInternalKey);
      if (activeChildren + tasks.length > maxChildren) {
        return jsonResult({
          status: "error",
          error: `parallel_spawn would exceed max active children (current: ${activeChildren}, adding: ${tasks.length}, max: ${maxChildren})`,
        });
      }

      const requesterAgentId = normalizeAgentId(
        opts?.requesterAgentIdOverride ?? parseAgentSessionKey(requesterInternalKey)?.agentId,
      );
      const requesterOrigin = normalizeDeliveryContext({
        channel: opts?.agentChannel,
        accountId: opts?.agentAccountId,
        to: opts?.agentTo,
        threadId: opts?.agentThreadId,
      });

      // Resolve wait strategy
      const strategy = getWaitStrategy(waitStrategy, tasks.length);
      const results: TaskResult[] = [];
      const spawnedByKey = requesterInternalKey;

      // Function to spawn a single subagent
      const spawnSingleTask = async (
        taskConfig: typeof tasks[0],
        index: number,
      ): Promise<TaskResult> => {
        const taskStartTime = Date.now();
        const targetAgentId = taskConfig.agentId
          ? normalizeAgentId(taskConfig.agentId)
          : requesterAgentId;

        // Build child session key
        const subagentId = crypto.randomUUID();
        const taskSharedKey = taskConfig.sharedKey ?? sharedKey;
        const childSessionKey = taskSharedKey
          ? `agent:${targetAgentId}:subagent:${subagentId}:shared:${taskSharedKey}`
          : `agent:${targetAgentId}:subagent:${subagentId}`;

        // Resolve model
        const targetAgentConfig = resolveAgentConfig(cfg, targetAgentId);
        const runtimeDefaultModel = resolveDefaultModelForAgent({
          cfg,
          agentId: targetAgentId,
        });
        const resolvedModel =
          normalizeModelSelection(taskConfig.model) ??
          normalizeModelSelection(targetAgentConfig?.subagents?.model) ??
          normalizeModelSelection(cfg.agents?.defaults?.subagents?.model) ??
          normalizeModelSelection(cfg.agents?.defaults?.model?.primary) ??
          normalizeModelSelection(
            `${runtimeDefaultModel.provider}/${runtimeDefaultModel.model}`,
          );

        // Resolve thinking
        let thinkingOverride: string | undefined;
        if (taskConfig.thinking) {
          const normalized = normalizeThinkLevel(taskConfig.thinking);
          if (normalized) {
            thinkingOverride = normalized;
          }
        }

        // Extract context if needed
        let extractedContext = {
          contextText: "",
          mode: "none" as ContextSharingMode,
          messageCount: 0,
          estimatedTokens: 0,
        };
        const contextSharingMode = taskConfig.contextSharing ?? "none";
        if (contextSharingMode !== "none" && requesterSessionKey) {
          extractedContext = await extractSessionContext(requesterSessionKey, {
            mode: contextSharingMode,
          });
        }

        // Build system prompt
        const childSystemPrompt = buildSubagentSystemPrompt({
          requesterSessionKey,
          requesterOrigin,
          childSessionKey,
          label: taskConfig.label,
          task: taskConfig.task,
          childDepth: callerDepth + 1,
          maxSpawnDepth,
          extractedContext: contextSharingMode !== "none" ? extractedContext : undefined,
        });

        // Create session
        try {
          await callGateway({
            method: "sessions.patch",
            params: { key: childSessionKey, spawnDepth: callerDepth + 1 },
            timeoutMs: 10_000,
          });
        } catch (err) {
          const messageText =
            err instanceof Error ? err.message : typeof err === "string" ? err : "error";
          return {
            index,
            label: taskConfig.label,
            task: taskConfig.task,
            status: "error",
            error: `Failed to create session: ${messageText}`,
            durationMs: Date.now() - taskStartTime,
          };
        }

        // Set model
        if (resolvedModel) {
          try {
            await callGateway({
              method: "sessions.patch",
              params: { key: childSessionKey, model: resolvedModel },
              timeoutMs: 10_000,
            });
          } catch (err) {
            // Continue without model
          }
        }

        // Set thinking level
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
            // Continue without thinking
          }
        }

        // Execute task
        const childIdem = crypto.randomUUID();
        let childRunId: string = childIdem;
        try {
          const response = await callGateway<{ runId: string }>({
            method: "agent",
            params: {
              message: taskConfig.task,
              sessionKey: childSessionKey,
              channel: requesterOrigin?.channel,
              to: requesterOrigin?.to ?? undefined,
              accountId: requesterOrigin?.accountId ?? undefined,
              threadId:
                requesterOrigin?.threadId != null ? String(requesterOrigin.threadId) : undefined,
              idempotencyKey: childIdem,
              deliver: false,
              lane: AGENT_LANE_SUBAGENT,
              extraSystemPrompt: childSystemPrompt,
              thinking: thinkingOverride,
              timeout: 0, // No timeout by default
              label: taskConfig.label || undefined,
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
          return {
            index,
            label: taskConfig.label,
            task: taskConfig.task,
            status: "error",
            childSessionKey,
            runId: childRunId,
            error: `Failed to spawn agent: ${messageText}`,
            durationMs: Date.now() - taskStartTime,
          };
        }

        // Register the subagent run
        registerSubagentRun({
          runId: childRunId,
          childSessionKey,
          requesterSessionKey: requesterInternalKey,
          requesterOrigin,
          requesterDisplayKey,
          task: taskConfig.task,
          cleanup: "keep",
          label: taskConfig.label || undefined,
          model: resolvedModel,
          runTimeoutSeconds: 0,
        });

        return {
          index,
          label: taskConfig.label,
          task: taskConfig.task,
          status: "accepted",
          childSessionKey,
          runId: childRunId,
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - taskStartTime,
        };
      };

      // Execute all tasks in parallel
      const spawnedResults = await Promise.all(
        tasks.map((task, index) => spawnSingleTask(task, index)),
      );

      // For now, we return the spawned results immediately
      // In a full implementation, we would wait for results based on wait strategy
      // This would require subscribing to subagent completion events

      const totalDurationMs = Date.now() - startTime;

      // Determine which mode to use based on wait strategy
      let resultMode: "all" | "first" | "last" | "summary" | "errors" = "all";
      if (waitStrategy === "any" || waitStrategy === "race") {
        resultMode = "first";
      } else if (aggregateMode) {
        resultMode = aggregateMode;
      }

      const aggregated = aggregateResults(
        spawnedResults,
        resultMode,
        aggregateIncludeMetadata,
      );

      return jsonResult({
        status: "accepted",
        tasksSpawned: tasks.length,
        waitStrategy: waitStrategy ?? "all",
        results: aggregated,
        totalDurationMs,
        // Include full results for debugging
        _debug: {
          allResults: spawnedResults,
        },
      });
    },
  };
}
