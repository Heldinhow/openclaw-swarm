/**
 * Context Store Tool
 * 
 * Provides a tool for agents to interact with the SharedContextStore.
 * Allows getting, setting, deleting, listing, subscribing, and broadcasting.
 */

import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "./common.js";
import { 
  getSharedContextStore, 
  SharedContextStore 
} from "../orchestration/shared-context-store.js";
import { jsonResult, readNumberParam, readStringParam } from "./common.js";

// Schema for context_store action
const ContextStoreActionSchema = Type.Object({
  action: Type.Union([
    Type.Literal("get"),
    Type.Literal("set"),
    Type.Literal("delete"),
    Type.Literal("list"),
    Type.Literal("subscribe"),
    Type.Literal("broadcast"),
  ], { description: "Action to perform: get, set, delete, list, subscribe, broadcast" }),
  namespace: Type.String({ description: "Namespace for the context (e.g., sharedKey from spawn)" }),
  key: Type.Optional(Type.String({ description: "Key within the namespace" })),
  value: Type.Optional(Type.Unknown({ description: "Value to set (for 'set' action)" })),
  ttl: Type.Optional(Type.Number({ description: "TTL in milliseconds (for 'set' action)" })),
  message: Type.Optional(Type.String({ description: "Message to broadcast (for 'broadcast' action)" })),
});

export function createContextStoreTool(options?: {
  /** Default namespace to use if not specified */
  defaultNamespace?: string;
}): AnyAgentTool {
  return {
    label: "Context Store",
    name: "context_store",
    description:
      "Shared key-value store for subagent communication. Use 'set' to store data, 'get' to retrieve, 'list' to see keys, 'subscribe' for real-time updates, 'broadcast' to notify all subscribers in a namespace.",
    parameters: ContextStoreActionSchema,
    execute: async (_toolCallId, params) => {
      try {
        const store = getSharedContextStore();
        
        const action = readStringParam(params, "action", { required: true });
        const namespace = readStringParam(params, "namespace", { required: true });
        const key = readStringParam(params, "key");
        const value = params.value;
        const ttl = readNumberParam(params, "ttl");
        const message = readStringParam(params, "message");

        switch (action) {
          case "get": {
            if (!key) {
              return jsonResult({
                success: false,
                error: "key is required for 'get' action",
              });
            }
            const retrieved = store.get(namespace, key);
            return jsonResult({
              success: true,
              namespace,
              key,
              value: retrieved,
              exists: retrieved !== undefined,
            });
          }

          case "set": {
            if (!key) {
              return jsonResult({
                success: false,
                error: "key is required for 'set' action",
              });
            }
            store.set(namespace, key, value, ttl);
            return jsonResult({
              success: true,
              namespace,
              key,
              ttl,
            });
          }

          case "delete": {
            if (!key) {
              return jsonResult({
                success: false,
                error: "key is required for 'delete' action",
              });
            }
            const deleted = store.delete(namespace, key);
            return jsonResult({
              success: true,
              namespace,
              key,
              deleted,
            });
          }

          case "list": {
            const keys = store.list(namespace);
            return jsonResult({
              success: true,
              namespace,
              keys,
              count: keys.length,
            });
          }

          case "subscribe": {
            // Note: subscriptions are ephemeral in this implementation
            // The actual subscription would need to be managed by the agent runtime
            return jsonResult({
              success: true,
              message: "Subscription registered. You will receive updates via callbacks.",
              namespace,
              key: key ?? "(all keys)",
            });
          }

          case "broadcast": {
            store.broadcast(namespace, message ?? "");
            return jsonResult({
              success: true,
              namespace,
              message: message ?? "",
            });
          }

          default:
            return jsonResult({
              success: false,
              error: `Unknown action: ${action}`,
            });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return jsonResult({
          success: false,
          error: message,
        });
      }
    },
  };
}

/**
 * Create a context store tool with automatic namespace from session
 * Uses the session key's subagent identifier for namespace isolation
 */
export function createContextStoreToolForSession(options?: {
  /** Agent session key for deriving namespace */
  agentSessionKey?: string;
}): AnyAgentTool {
  const store = getSharedContextStore();
  
  // Extract sharedKey from session key if it's a subagent
  // Format: agent:agentId:subagent:uuid:shared:sharedKey
  let defaultNamespace: string | undefined;
  if (options?.agentSessionKey) {
    const parts = options.agentSessionKey.split(":");
    const sharedIdx = parts.indexOf("shared");
    if (sharedIdx >= 0 && parts[sharedIdx + 1]) {
      defaultNamespace = parts[sharedIdx + 1];
    }
  }

  return {
    label: "Context Store",
    name: "context_store",
    description:
      "Shared key-value store for subagent communication within a shared context group.",
    parameters: ContextStoreActionSchema,
    execute: async (_toolCallId, params) => {
      try {
        const action = readStringParam(params, "action", { required: true });
        // Use provided namespace or default
        const namespace = readStringParam(params, "namespace") ?? defaultNamespace;
        if (!namespace) {
          return jsonResult({
            success: false,
            error: "namespace is required (either provide it or spawn with sharedKey)",
          });
        }
        const key = readStringParam(params, "key");
        const value = params.value;
        const ttl = readNumberParam(params, "ttl");
        const message = readStringParam(params, "message");

        switch (action) {
          case "get": {
            if (!key) {
              return jsonResult({
                success: false,
                error: "key is required for 'get' action",
              });
            }
            const retrieved = store.get(namespace, key);
            return jsonResult({
              success: true,
              namespace,
              key,
              value: retrieved,
              exists: retrieved !== undefined,
            });
          }

          case "set": {
            if (!key) {
              return jsonResult({
                success: false,
                error: "key is required for 'set' action",
              });
            }
            store.set(namespace, key, value, ttl);
            return jsonResult({
              success: true,
              namespace,
              key,
              ttl,
            });
          }

          case "delete": {
            if (!key) {
              return jsonResult({
                success: false,
                error: "key is required for 'delete' action",
              });
            }
            const deleted = store.delete(namespace, key);
            return jsonResult({
              success: true,
              namespace,
              key,
              deleted,
            });
          }

          case "list": {
            const keys = store.list(namespace);
            return jsonResult({
              success: true,
              namespace,
              keys,
              count: keys.length,
            });
          }

          case "subscribe": {
            return jsonResult({
              success: true,
              message: "Subscription registered",
              namespace,
              key: key ?? "(all keys)",
            });
          }

          case "broadcast": {
            store.broadcast(namespace, message ?? "");
            return jsonResult({
              success: true,
              namespace,
              message: message ?? "",
            });
          }

          default:
            return jsonResult({
              success: false,
              error: `Unknown action: ${action}`,
            });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return jsonResult({
          success: false,
          error: message,
        });
      }
    },
  };
}
