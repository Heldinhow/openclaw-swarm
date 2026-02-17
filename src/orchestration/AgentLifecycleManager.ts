/**
 * AgentLifecycleManager - Agent Lifecycle Management
 * 
 * Manages agent spawning, execution, health checks, and termination.
 */

import { EventEmitter } from 'events';
import {
  Agent,
  AgentConfig,
  AgentStatus,
  AgentPoolConfig,
  HealthCheckResult,
  TaskOutput
} from './types.js';

/**
 * Agent lifecycle manager events
 */
export interface AgentLifecycleEvents {
  on(event: 'agent:spawning', listener: (config: AgentConfig) => void): this;
  on(event: 'agent:spawned', listener: (agent: Agent) => void): this;
  on(event: 'agent:running', listener: (agent: Agent) => void): this;
  on(event: 'agent:terminating', listener: (agent: Agent) => void): this;
  on(event: 'agent:terminated', listener: (agent: Agent) => void): this;
  on(event: 'agent:error', listener: (agent: Agent, error: Error) => void): this;
  on(event: 'healthcheck', listener: (result: HealthCheckResult) => void): this;
}

/**
 * Agent spawner function type
 */
export type AgentSpawner = (config: AgentConfig) => Promise<AgentRunner>;

/**
 * Agent runner interface - represents a running agent process
 */
export interface AgentRunner {
  execute(task: string): Promise<TaskOutput>;
  terminate(): Promise<void>;
  getStatus(): AgentStatus;
  isHealthy(): boolean;
}

/**
 * AgentLifecycleManager - manages agent pool and lifecycle
 */
export class AgentLifecycleManager 
  extends EventEmitter 
  implements AgentLifecycleEvents 
{
  private agents: Map<string, Agent> = new Map();
  private runtimes: Map<string, AgentRunner> = new Map();
  private spawner?: AgentSpawner;
  private config: AgentPoolConfig;
  private healthCheckTimer?: NodeJS.Timeout;
  private terminated: boolean = false;

  /**
   * Create a new AgentLifecycleManager
   */
  constructor(config: AgentPoolConfig = {}) {
    super();
    this.config = {
      maxAgents: config.maxAgents ?? 10,
      idleTimeout: config.idleTimeout ?? 300000, // 5 minutes
      healthCheckInterval: config.healthCheckInterval ?? 30000, // 30 seconds
      maxRetries: config.maxRetries ?? 3
    };
  }

  /**
   * Set the agent spawner function
   */
  setSpawner(spawner: AgentSpawner): void {
    this.spawner = spawner;
  }

  /**
   * Create and register a new agent
   */
  async createAgent(config: AgentConfig): Promise<Agent> {
    // Check pool capacity
    if (this.agents.size >= (this.config.maxAgents ?? 10)) {
      throw new Error(`Agent pool full: max ${this.config.maxAgents} agents`);
    }

    // Check if agent already exists
    if (this.agents.has(config.id)) {
      throw new Error(`Agent '${config.id}' already exists`);
    }

    const agent: Agent = {
      id: config.id,
      sessionKey: `session_${config.id}_${Date.now()}`,
      label: config.label || config.id,
      status: AgentStatus.SPAWNING,
      config,
      createdAt: Date.now()
    };

    this.agents.set(config.id, agent);
    this.emit('agent:spawning', config);

    return agent;
  }

  /**
   * Spawn and start an agent
   */
  async spawnAgent(config: AgentConfig): Promise<Agent> {
    if (!this.spawner) {
      throw new Error('No spawner configured. Call setSpawner() first.');
    }

    const agent = await this.createAgent(config);

    try {
      // Spawn the runtime
      const runner = await this.spawner(config);
      this.runtimes.set(agent.id, runner);

      // Update agent status
      agent.status = AgentStatus.RUNNING;
      agent.startedAt = Date.now();

      this.emit('agent:spawned', agent);
      this.emit('agent:running', agent);

      return agent;

    } catch (error) {
      agent.status = AgentStatus.ERROR;
      agent.error = error instanceof Error ? error.message : String(error);
      
      this.emit('agent:error', agent, error instanceof Error ? error : new Error(String(error)));
      
      // Cleanup
      this.agents.delete(config.id);
      throw error;
    }
  }

  /**
   * Get agent by ID
   */
  getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  /**
   * Get all agents
   */
  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agents by status
   */
  getAgentsByStatus(status: AgentStatus): Agent[] {
    return this.getAllAgents().filter(agent => agent.status === status);
  }

  /**
   * Get idle agents
   */
  getIdleAgents(): Agent[] {
    return this.getAgentsByStatus(AgentStatus.IDLE);
  }

  /**
   * Execute a task on an agent
   */
  async executeOnAgent(agentId: string, task: string): Promise<TaskOutput> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent '${agentId}' not found`);
    }

    const runner = this.runtimes.get(agentId);
    if (!runner) {
      throw new Error(`Agent runtime '${agentId}' not running`);
    }

    if (agent.status !== AgentStatus.RUNNING) {
      throw new Error(`Agent '${agentId}' is not in RUNNING state: ${agent.status}`);
    }

    try {
      const output = await runner.execute(task);
      
      // Update agent with result
      agent.result = output.result;
      
      return output;

    } catch (error) {
      agent.error = error instanceof Error ? error.message : String(error);
      this.emit('agent:error', agent, error instanceof Error ? error : new Error(String(error)));
      
      throw error;
    }
  }

  /**
   * Terminate an agent
   */
  async terminateAgent(agentId: string, force: boolean = false): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return; // Already gone
    }

    agent.status = AgentStatus.TERMINATING;
    this.emit('agent:terminating', agent);

    try {
      // Terminate runtime
      const runner = this.runtimes.get(agentId);
      if (runner) {
        await runner.terminate();
        this.runtimes.delete(agentId);
      }

    } catch (error) {
      // Log but continue cleanup
      console.error(`Error terminating agent ${agentId}:`, error);
      
    } finally {
      // Update agent state
      agent.status = AgentStatus.TERMINATED;
      agent.terminatedAt = Date.now();
      
      // Remove from active agents
      this.agents.delete(agentId);
      
      this.emit('agent:terminated', agent);
    }
  }

  /**
   * Terminate all agents
   */
  async terminateAll(): Promise<void> {
    const agentIds = Array.from(this.agents.keys());
    
    await Promise.all(
      agentIds.map(id => this.terminateAgent(id, true))
    );
  }

  /**
   * Perform health check on all agents
   */
  async healthCheck(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];

    for (const [agentId, runner] of this.runtimes) {
      const agent = this.agents.get(agentId);
      
      const result: HealthCheckResult = {
        agentId,
        healthy: runner.isHealthy(),
        lastCheck: Date.now(),
        issues: runner.isHealthy() ? undefined : ['Agent unhealthy']
      };

      if (agent) {
        agent.status = result.healthy ? AgentStatus.RUNNING : AgentStatus.ERROR;
      }

      results.push(result);
      this.emit('healthcheck', result);
    }

    return results;
  }

  /**
   * Start periodic health checks
   */
  startHealthChecks(): void {
    if (this.healthCheckTimer) {
      return; // Already running
    }

    const interval = this.config.healthCheckInterval ?? 30000;
    
    this.healthCheckTimer = setInterval(() => {
      this.healthCheck().catch(error => {
        console.error('Health check failed:', error);
      });
    }, interval);

    // Don't prevent process exit
    this.healthCheckTimer.unref();
  }

  /**
   * Stop periodic health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    total: number;
    running: number;
    idle: number;
    terminated: number;
    error: number;
  } {
    const agents = this.getAllAgents();
    
    return {
      total: agents.length,
      running: agents.filter(a => a.status === AgentStatus.RUNNING).length,
      idle: agents.filter(a => a.status === AgentStatus.IDLE).length,
      terminated: agents.filter(a => a.status === AgentStatus.TERMINATED).length,
      error: agents.filter(a => a.status === AgentStatus.ERROR).length
    };
  }

  /**
   * Shutdown the manager
   */
  async shutdown(): Promise<void> {
    if (this.terminated) {
      return;
    }

    this.terminated = true;
    
    this.stopHealthChecks();
    await this.terminateAll();
  }
}

/**
 * Default agent runner implementation
 * 
 * This is a placeholder that should be replaced with actual agent runtime
 */
export class DefaultAgentRunner implements AgentRunner {
  private status: AgentStatus = AgentStatus.RUNNING;
  private healthy: boolean = true;

  async execute(task: string): Promise<TaskOutput> {
    this.status = AgentStatus.RUNNING;
    
    // Simulate task execution
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      taskId: task,
      status: 'completed' as any,
      result: { message: 'Task executed' },
      startedAt: Date.now(),
      completedAt: Date.now(),
      retries: 0
    };
  }

  async terminate(): Promise<void> {
    this.status = AgentStatus.TERMINATED;
  }

  getStatus(): AgentStatus {
    return this.status;
  }

  isHealthy(): boolean {
    return this.healthy;
  }
}
