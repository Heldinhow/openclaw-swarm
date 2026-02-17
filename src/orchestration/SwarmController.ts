/**
 * SwarmController - Agent Orchestration
 * 
 * Coordinates task execution across multiple agents with dependency management.
 */

import { EventEmitter } from 'events';
import { TaskGraph } from './TaskGraph.js';
import { AgentLifecycleManager } from './AgentLifecycleManager.js';
import {
  SwarmRequest,
  SwarmResult,
  TaskInput,
  TaskOutput,
  TaskState,
  ExecutionConfig,
  ExecutionProgress,
  AgentConfig,
  AgentStatus,
  Orchestrator
} from './types.js';

/**
 * Default task executor using AgentLifecycleManager
 */
type TaskExecutor = (task: TaskInput) => Promise<TaskOutput>;

/**
 * SwarmController events
 */
export interface SwarmControllerEvents {
  on(event: 'swarm:started', listener: (request: SwarmRequest) => void): this;
  on(event: 'swarm:progress', listener: (progress: ExecutionProgress) => void): this;
  on(event: 'swarm:complete', listener: (result: SwarmResult) => void): this;
  on(event: 'swarm:error', listener: (error: Error) => void): this;
}

/**
 * SwarmController - orchestrates agent-based task execution
 */
export class SwarmController 
  extends EventEmitter 
  implements Orchestrator, SwarmControllerEvents 
{
  private agentManager: AgentLifecycleManager;
  private graph: TaskGraph;
  private config: ExecutionConfig;
  private taskExecutor?: TaskExecutor;
  private isExecuting: boolean = false;
  private abortController?: AbortController;

  /**
   * Create a new SwarmController
   */
  constructor(
    agentManager: AgentLifecycleManager,
    config: ExecutionConfig = {}
  ) {
    super();
    this.agentManager = agentManager;
    this.config = {
      maxConcurrent: config.maxConcurrent ?? 5,
      stopOnFailure: config.stopOnFailure ?? false,
      progressCallback: config.progressCallback
    };
    
    // Create task graph
    this.graph = new TaskGraph(this.config);
    
    // Set up graph event forwarding
    this.setupGraphEvents();
  }

  /**
   * Set custom task executor
   */
  setTaskExecutor(executor: TaskExecutor): void {
    this.taskExecutor = executor;
    
    // Also set on the graph
    this.graph.setExecutor(async (task) => {
      return executor(task.toInput());
    });
  }

  /**
   * Set progress callback
   */
  setProgressCallback(callback: (progress: ExecutionProgress) => void): void {
    this.config.progressCallback = callback;
  }

  /**
   * Set up graph event forwarding
   */
  private setupGraphEvents(): void {
    this.graph.on('task:started', (task) => {
      this.emit('task:started', task);
    });

    this.graph.on('task:completed', (output) => {
      this.emit('task:completed', output);
    });

    this.graph.on('task:failed', (output) => {
      this.emit('task:failed', output);
    });

    this.graph.on('execution:progress', (progress) => {
      this.emit('swarm:progress', progress);
    });
  }

  /**
   * Prepare a swarm request - add tasks and dependencies to graph
   */
  prepare(request: SwarmRequest): void {
    // Clear existing graph
    this.graph.clear();

    // Add tasks
    for (const taskInput of request.tasks) {
      this.graph.addTask(taskInput);
    }

    // Add dependencies if provided
    if (request.dependencies) {
      for (const [from, to] of request.dependencies) {
        this.graph.addDependency(from, to);
      }
    }
  }

  /**
   * Execute a swarm request
   */
  async execute(request: SwarmRequest): Promise<SwarmResult> {
    if (this.isExecuting) {
      throw new Error('Swarm is already executing');
    }

    this.isExecuting = true;
    this.abortController = new AbortController();

    const startTime = Date.now();

    try {
      // Prepare the graph
      this.prepare(request);
      
      this.emit('swarm:started', request);

      // Execute the graph
      const result = await this.graph.execute();

      // Emit completion
      this.emit('swarm:complete', result);
      this.emit('execution:complete', result);

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.emit('swarm:error', error instanceof Error ? error : new Error(errorMessage));
      
      return {
        success: false,
        outputs: new Map(),
        duration: Date.now() - startTime,
        errors: [errorMessage]
      };

    } finally {
      this.isExecuting = false;
      this.abortController = undefined;
    }
  }

  /**
   * Execute tasks in parallel without dependency graph
   */
  async executeParallel(tasks: TaskInput[]): Promise<SwarmResult> {
    const request: SwarmRequest = {
      tasks,
      config: {
        maxConcurrent: this.config.maxConcurrent
      }
    };

    return this.execute(request);
  }

  /**
   * Execute tasks sequentially
   */
  async executeSequential(tasks: TaskInput[]): Promise<SwarmResult> {
    const request: SwarmRequest = {
      tasks,
      config: {
        maxConcurrent: 1
      }
    };

    return this.execute(request);
  }

  /**
   * Cancel ongoing execution
   */
  async cancel(): Promise<void> {
    if (!this.isExecuting) {
      return;
    }

    this.abortController?.abort();
    
    // Terminate all active agents
    await this.agentManager.terminateAll();
    
    this.isExecuting = false;
    this.emit('swarm:cancelled');
  }

  /**
   * Get current execution progress
   */
  getProgress(): ExecutionProgress {
    return this.graph.getProgress();
  }

  /**
   * Get agent pool statistics
   */
  getAgentStats() {
    return this.agentManager.getStats();
  }

  /**
   * Get all agents
   */
  getAgents() {
    return this.agentManager.getAllAgents();
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string) {
    return this.agentManager.getAgent(agentId);
  }

  /**
   * Spawn a new agent
   */
  async spawnAgent(config: AgentConfig): Promise<void> {
    await this.agentManager.spawnAgent(config);
  }

  /**
   * Terminate an agent
   */
  async terminateAgent(agentId: string): Promise<void> {
    await this.agentManager.terminateAgent(agentId);
  }

  /**
   * Check if currently executing
   */
  get executing(): boolean {
    return this.isExecuting;
  }

  /**
   * Shutdown the controller
   */
  async shutdown(): Promise<void> {
    await this.cancel();
    await this.agentManager.shutdown();
  }
}

/**
 * Builder for SwarmController
 */
export class SwarmControllerBuilder {
  private agentConfig: {
    maxAgents?: number;
    idleTimeout?: number;
    healthCheckInterval?: number;
  } = {};
  
  private executionConfig: ExecutionConfig = {};
  private taskExecutor?: TaskExecutor;

  /**
   * Set maximum concurrent agents
   */
  withMaxAgents(maxAgents: number): this {
    this.agentConfig.maxAgents = maxAgents;
    return this;
  }

  /**
   * Set max concurrent tasks
   */
  withMaxConcurrent(maxConcurrent: number): this {
    this.executionConfig.maxConcurrent = maxConcurrent;
    return this;
  }

  /**
   * Set stop on failure behavior
   */
  withStopOnFailure(stop: boolean = true): this {
    this.executionConfig.stopOnFailure = stop;
    return this;
  }

  /**
   * Set progress callback
   */
  withProgressCallback(callback: (progress: ExecutionProgress) => void): this {
    this.executionConfig.progressCallback = callback;
    return this;
  }

  /**
   * Set custom task executor
   */
  withTaskExecutor(executor: TaskExecutor): this {
    this.taskExecutor = executor;
    return this;
  }

  /**
   * Set idle timeout
   */
  withIdleTimeout(timeoutMs: number): this {
    this.agentConfig.idleTimeout = timeoutMs;
    return this;
  }

  /**
   * Set health check interval
   */
  withHealthCheckInterval(intervalMs: number): this {
    this.agentConfig.healthCheckInterval = intervalMs;
    return this;
  }

  /**
   * Build the SwarmController
   */
  build(): SwarmController {
    const agentManager = new AgentLifecycleManager(this.agentConfig);
    const controller = new SwarmController(agentManager, this.executionConfig);

    if (this.taskExecutor) {
      controller.setTaskExecutor(this.taskExecutor);
    }

    return controller;
  }
}

/**
 * Create a new SwarmController builder
 */
export function createSwarmController(): SwarmControllerBuilder {
  return new SwarmControllerBuilder();
}
