import { SessionManager } from "@mariozechner/pi-coding-agent";
import path from "node:path";
import { loadConfig } from "../../config/config.js";
import {
  loadSessionStore,
  resolveAgentIdFromSessionKey,
  resolveSessionFilePath,
  resolveStorePath,
} from "../../config/sessions.js";

/**
 * Context sharing modes for orchestrator → subagent communication.
 */
export type ContextSharingMode = "none" | "summary" | "recent" | "full";

/**
 * Options for extracting session context.
 */
export interface ExtractContextOptions {
  /** Context sharing mode (default: "none" for backward compatibility). */
  mode?: ContextSharingMode;
  /** Maximum number of recent messages to include (for "recent" mode). */
  maxRecentMessages?: number;
  /** Maximum tokens to use for compressed context (for "summary" mode). */
  maxTokens?: number;
  /** Include file contents specified by paths. */
  includeFiles?: string[];
}

/**
 * Result of context extraction.
 */
export interface ExtractedContext {
  /** The extracted context in text form. */
  contextText: string;
  /** Mode used for extraction. */
  mode: ContextSharingMode;
  /** Number of messages included. */
  messageCount: number;
  /** Estimated token count. */
  estimatedTokens: number;
}

/**
 * Load session entry and transcript for context extraction.
 */
function loadSessionData(sessionKey: string) {
  const cfg = loadConfig();
  const agentId = resolveAgentIdFromSessionKey(sessionKey);
  const storePath = resolveStorePath(cfg.session?.store, { agentId });
  const store = loadSessionStore(storePath);
  const entry = store[sessionKey];

  if (!entry?.sessionId) {
    return { entry: null, sessionFile: null, messages: [] };
  }

  let sessionFile: string | null = null;
  try {
    sessionFile = resolveSessionFilePath(entry.sessionId, entry, {
      agentId,
      sessionsDir: path.dirname(storePath),
    });
  } catch {
    // Session file may not exist
  }

  const messages: Array<{ role: string; content: string; timestamp?: number }> = [];
  if (sessionFile) {
    try {
      const manager = SessionManager.open(sessionFile);
      const entries = manager.getEntries();
      for (const entry of entries) {
        if (entry.type === "message") {
          const msg = (entry as { message: { role: string; content: Array<{ type: string; text?: string }> } }).message;
          const textContent = msg.content
            .filter((c) => c.type === "text")
            .map((c) => c.text ?? "")
            .join("\n");
          if (textContent.trim()) {
            messages.push({
              role: msg.role,
              content: textContent,
              timestamp: Number(entry.timestamp),
            });
          }
        }
      }
    } catch {
      // Failed to load session messages
    }
  }

  return { entry, sessionFile, messages };
}

/**
 * Estimate token count from text (rough approximation: ~4 chars per token).
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Compress context by summarizing messages.
 * Uses simple extraction-based summarization for now.
 */
function compressContext(
  messages: Array<{ role: string; content: string; timestamp?: number }>,
  maxTokens: number,
): string {
  if (messages.length === 0) {
    return "";
  }

  const lines: string[] = ["## Session History Summary\n"];
  let currentTokens = estimateTokens(lines.join("\n"));

  // Take most recent messages first, but prioritize system/user messages
  const sorted = [...messages].toSorted((a, b) => {
    // System and user messages first
    if (a.role === "system" && b.role !== "system") {return -1;}
    if (b.role === "system" && a.role !== "system") {return 1;}
    if (a.role === "user" && b.role === "assistant") {return -1;}
    if (b.role === "user" && a.role === "assistant") {return 1;}
    // Then by timestamp (most recent first)
    return (b.timestamp ?? 0) - (a.timestamp ?? 0);
  });

  for (const msg of sorted) {
    const msgTokens = estimateTokens(msg.content);
    if (currentTokens + msgTokens > maxTokens) {
      // Truncate if needed
      const remainingTokens = maxTokens - currentTokens;
      if (remainingTokens > 50) {
        const chars = remainingTokens * 4;
        const truncated = msg.content.slice(-chars);
        lines.push(`[${msg.role}]: ${truncated}...`);
        currentTokens = maxTokens;
      }
      break;
    }
    lines.push(`[${msg.role}]: ${msg.content}`);
    currentTokens += msgTokens;
  }

  return lines.join("\n");
}

/**
 * Get recent messages as formatted text.
 */
function formatRecentMessages(
  messages: Array<{ role: string; content: string; timestamp?: number }>,
  maxMessages: number,
): string {
  if (messages.length === 0) {
    return "";
  }

  const recent = messages.slice(-maxMessages);
  const lines: string[] = ["## Recent Session Messages\n"];

  for (const msg of recent) {
    const preview = msg.content.length > 500 ? msg.content.slice(0, 500) + "..." : msg.content;
    lines.push(`**[${msg.role}]**: ${preview}`);
  }

  return lines.join("\n");
}

/**
 * Get full transcript as formatted text.
 */
function formatFullTranscript(
  messages: Array<{ role: string; content: string; timestamp?: number }>,
  maxTokens?: number,
): string {
  if (messages.length === 0) {
    return "";
  }

  let text = "## Full Session Transcript\n";
  let tokens = estimateTokens(text);

  for (const msg of messages) {
    const msgTokens = estimateTokens(msg.content);
    if (maxTokens && tokens + msgTokens > maxTokens) {
      text += `\n[... ${messages.length} messages total, truncated for context ...]`;
      break;
    }
    text += `\n**[${msg.role}]**: ${msg.content}`;
    tokens += msgTokens;
  }

  return text;
}

/**
 * Load file contents for context inclusion.
 */
async function loadIncludedFiles(paths: string[]): Promise<string> {
  if (paths.length === 0) {
    return "";
  }

  const lines: string[] = ["## Included Files\n"];
  const fs = await import("node:fs");

  for (const filePath of paths) {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        const preview = content.length > 2000 ? content.slice(0, 2000) + "\n..." : content;
        lines.push(`### ${filePath}\n\`\`\`\n${preview}\n\`\`\n`);
      } else {
        lines.push(`### ${filePath}\n_File not found_\n`);
      }
    } catch {
      lines.push(`### ${filePath}\n_Error reading file_\n`);
    }
  }

  return lines.join("\n");
}

/**
 * Extract session context for passing to subagents.
 *
 * @param sessionKey - The session key to extract context from
 * @param options - Extraction options
 * @returns Extracted context ready for injection into subagent prompt
 */
export async function extractSessionContext(
  sessionKey: string,
  options: ExtractContextOptions = {},
): Promise<ExtractedContext> {
  const mode = options.mode ?? "none";

  // Fast path for no context
  if (mode === "none") {
    return {
      contextText: "",
      mode: "none",
      messageCount: 0,
      estimatedTokens: 0,
    };
  }

  const { messages } = loadSessionData(sessionKey);

  let contextText = "";
  let estimatedTokens = 0;

  switch (mode) {
    case "summary": {
      const maxTokens = options.maxTokens ?? 2000;
      contextText = compressContext(messages, maxTokens);
      estimatedTokens = estimateTokens(contextText);
      break;
    }
    case "recent": {
      const maxMessages = options.maxRecentMessages ?? 10;
      contextText = formatRecentMessages(messages, maxMessages);
      estimatedTokens = estimateTokens(contextText);
      break;
    }
    case "full": {
      contextText = formatFullTranscript(messages, options.maxTokens);
      estimatedTokens = estimateTokens(contextText);
      break;
    }
  }

  // Add included files if specified
  if (options.includeFiles && options.includeFiles.length > 0) {
    const filesContent = await loadIncludedFiles(options.includeFiles);
    contextText += "\n\n" + filesContent;
    estimatedTokens += estimateTokens(filesContent);
  }

  return {
    contextText,
    mode,
    messageCount: messages.length,
    estimatedTokens,
  };
}
