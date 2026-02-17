/**
 * OpenCodeExecutor with ACP support
 * Uses Agent Client Protocol for persistent sessions
 */
import * as http from "http";
import { getProcessSupervisor } from "../process/supervisor/index.js";
import type {
  ExecutionTask,
  ExecutionResult,
  ExecutionOutput,
  ExecutionMetrics,
  OpenCodeExecutorConfig,
} from "./types.js";
import { DEFAULT_EXECUTOR_CONFIG } from "./types.js";
import { BaseExecutor } from "./BaseExecutor.js";
import {
  ExecutionLayerError,
  ExecutionTimeoutError,
  OpenCodeNotFoundError,
} from "./errors.js";

interface ACPConfig {
  port: number;
  hostname: string;
  workingDirectory: string;
}

export class OpenCodeExecutor extends BaseExecutor {
  private config: Required<Omit<OpenCodeExecutorConfig, "workingDirectory">> &
    Pick<OpenCodeExecutorConfig, "workingDirectory">;
  
  private acpServerUrl: string | null = null;
  private acpProcess: any = null;
  private sessionId: string | null = null;

  /**
   * Create a new OpenCodeExecutor with ACP support
   */
  constructor(config: OpenCodeExecutorConfig = {}) {
    super({
      defaultTimeout: config.defaultTimeout,
      defaultRetry: config.defaultRetry,
    });
    
    this.config = {
      openCodePath: config.openCodePath ?? DEFAULT_EXECUTOR_CONFIG.openCodePath!,
      defaultTimeout: config.defaultTimeout ?? DEFAULT_EXECUTOR_CONFIG.defaultTimeout!,
      defaultRetry: config.defaultRetry ?? DEFAULT_EXECUTOR_CONFIG.defaultRetry!,
      model: config.model ?? DEFAULT_EXECUTOR_CONFIG.model!,
      workingDirectory: config.workingDirectory,
    };

    this.validateOpenCodeExists();
  }

  /**
   * Validate that OpenCode CLI exists
   */
  private validateOpenCodeExists(): void {
    try {
      require("fs").accessSync(this.config.openCodePath);
    } catch {
      throw new OpenCodeNotFoundError(this.config.openCodePath);
    }
  }

  /**
   * Start the ACP server
   */
  async startAcpServer(): Promise<void> {
    if (this.acpServerUrl) {
      return; // Already running
    }

    const supervisor = getProcessSupervisor();
    const port = await this.findAvailablePort();
    
    const run = await supervisor.spawn({
      mode: "child" as const,
      argv: [
        this.config.openCodePath,
        "serve",
        "--port",
        String(port),
        "--hostname",
        "127.0.0.1",
      ],
      cwd: this.config.workingDirectory ?? process.cwd(),
      timeoutMs: 0, // No timeout for server
    });

    this.acpProcess = run;
    this.acpServerUrl = `http://127.0.0.1:${port}`;
    
    // Wait for server to be ready
    await this.waitForServer(5000);
  }

  /**
   * Stop the ACP server
   */
  async stopAcpServer(): Promise<void> {
    if (this.acpProcess) {
      this.acpProcess.cancel();
      this.acpServerUrl = null;
      this.acpProcess = null;
      this.sessionId = null;
    }
  }

  /**
   * Find an available port
   */
  private async findAvailablePort(): Promise<number> {
    return new Promise((resolve) => {
      const server = http.createServer();
      server.listen(0, () => {
        const address = server.address();
        server.close();
        resolve((address as any).port);
      });
    });
  }

  /**
   * Wait for ACP server to be ready
   */
  private async waitForServer(timeoutMs: number): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        await this.httpRequest("/health", "GET");
        return;
      } catch {
        await this.sleep(100);
      }
    }
    throw new Error("ACP server failed to start");
  }

  /**
   * Make HTTP request to ACP server
   */
  private async httpRequest(
    path: string,
    method: string,
    body?: any
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.acpServerUrl) {
        reject(new Error("ACP server not running"));
        return;
      }

      const url = new URL(path, this.acpServerUrl);
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method,
        headers: {
          "Content-Type": "application/json",
        },
      };

      const req = http.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        });
      });

      req.on("error", reject);
      if (body) {req.write(JSON.stringify(body));}
      req.end();
    });
  }

  /**
   * Create a new session via ACP
   */
  async createSession(model?: string): Promise<string> {
    if (!this.acpServerUrl) {
      await this.startAcpServer();
    }

    const response = await this.httpRequest("/session", "POST", {
      model: model ?? this.config.model,
    });

    this.sessionId = response.sessionId;
    return this.sessionId;
  }

  /**
   * Execute a task via ACP
   */
  async run(task: ExecutionTask): Promise<ExecutionResult> {
    const startedAt = new Date();

    try {
      // Ensure ACP server is running
      if (!this.acpServerUrl) {
        await this.startAcpServer();
      }

      // Create session if needed
      if (!this.sessionId) {
        await this.createSession(task.context?.model);
      }

      // Send task via ACP
      const result = await this.executeViaACP(task);

      return {
        success: true,
        taskId: task.id,
        output: {
          stdout: result.message?.content?.[0]?.text ?? "",
          stderr: "",
          exitCode: 0,
        },
        metrics: {
          model: this.config.model,
          durationMs: Date.now() - startedAt.getTime(),
        },
        attempts: 1,
        startedAt,
        completedAt: new Date(),
      };
    } catch (error: any) {
      return {
        success: false,
        taskId: task.id,
        output: {
          stdout: "",
          stderr: error.message,
          exitCode: -1,
        },
        metrics: {
          model: this.config.model,
          durationMs: Date.now() - startedAt.getTime(),
        },
        attempts: 1,
        startedAt,
        completedAt: new Date(),
      };
    }
  }

  /**
   * Execute task via ACP protocol
   */
  private async executeViaACP(task: ExecutionTask): Promise<any> {
    const response = await this.httpRequest(
      `/session/${this.sessionId}/prompt`,
      "POST",
      {
        message: task.instructions,
      }
    );

    return response;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Cleanup
   */
  async dispose(): Promise<void> {
    await this.stopAcpServer();
  }
}
