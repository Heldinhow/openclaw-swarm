/**
 * Swarm-Native Orchestrator Core - Type Definitions
 * 
 * Core types for task management, graph execution, and agent orchestration.
 */

import { EventEmitter } from 'events';

// ============================================================================
// Task State Types
// ============================================================================

/**
 * Task lifecycle states
 */
export enum TaskState {
  PENDING = 'pending',
  RUNNING = 'running',
  BLOCKED = 'blocked',
  FAILED = 'failed',
  COMPLETED = 'completed'
}

/**
 * Agent lifecycle states
 */
export enum AgentStatus {
  IDLE = 'idle',
  SPAWNING = 'spawning',
  RUNNING = 'running',
  TERMINATING = 'terminating',
  TERMINATED = 'terminated',
  ERROR = 'error'
}

// ============================================================================
// Task Types
// ============================================================================

/**
 * Task input configuration
 */
export interface TaskInput {
  id: string;
  label?: string;
  task: string;
  model?: string;
  contextSharing?: ContextSharingMode;
  maxRetries?: number;
  timeout?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Task output result
 */
export interface TaskOutput {
  taskId: string;
  status: TaskState;
  result?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
  startedAt: number;
  completedAt?: number;
  retries: number;
}

/**
 * Context sharing modes
 */
export type ContextSharingMode = 'none' | 'summary' | 'recent' | 'full';

/**
 * Task event data
 */
export interface TaskEventData {
  taskId: string;
  previousState: TaskState;
  currentState: TaskState;
  output?: TaskOutput;
  error?: Error;
}

// ============================================================================
// TaskGraph Types
// ============================================================================

/**
 * Graph node representation
 */
export interface GraphNode {
  id: string;
  task: TaskInput;
  state: TaskState;
  dependencies: Set<string>;
  dependents: Set<string>;
  inDegree: number;
  output?: TaskOutput;
}

/**
 * Graph edge representation
 */
export interface GraphEdge {
  from: string;
  to: string;
}

/**
 * Execution configuration
 */
export interface ExecutionConfig {
  maxConcurrent?: number;
  stopOnFailure?: boolean;
  progressCallback?: (progress: ExecutionProgress) => void;
}

/**
 * Execution progress
 */
export interface ExecutionProgress {
  total: number;
  completed: number;
  failed: number;
  running: number;
  blocked: number;
  currentTasks: string[];
}

// ============================================================================
// Agent Lifecycle Types
// ============================================================================

/**
 * Agent configuration
 */
export interface AgentConfig {
  id: string;
  label?: string;
  task: string;
  model?: string;
  contextSharing?: ContextSharingMode;
  maxRetries?: number;
  timeout?: number;
}

/**
 * Agent instance
 */
export interface Agent {
  id: string;
  sessionKey: string;
  label: string;
  status: AgentStatus;
  config: AgentConfig;
  createdAt: number;
  startedAt?: number;
  terminatedAt?: number;
  result?: unknown;
  error?: string;
}

/**
 * Agent pool configuration
 */
export interface AgentPoolConfig {
  maxAgents?: number;
  idleTimeout?: number;
  healthCheckInterval?: number;
  maxRetries?: number;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  agentId: string;
  healthy: boolean;
  lastCheck: number;
  issues?: string[];
}

// ============================================================================
// Swarm Controller Types
// ============================================================================

/**
 * Swarm execution request
 */
export interface SwarmRequest {
  tasks: TaskInput[];
  dependencies?: [string, string][];
  config?: ExecutionConfig;
}

/**
 * Swarm execution result
 */
export interface SwarmResult {
  success: boolean;
  outputs: Map<string, TaskOutput>;
  duration: number;
  errors: string[];
}

/**
 * Output merge strategy
 */
export type MergeStrategy = 'first' | 'last' | 'combine' | 'aggregate';

/**
 * Output merge configuration
 */
export interface MergeConfig {
  strategy: MergeStrategy;
  reducer?: (results: unknown[]) => unknown;
}

// ============================================================================
// Events
// ============================================================================

/**
 * Orchestrator events emitter interface
 */
export interface OrchestratorEvents {
  on(event: 'task:stateChanged', listener: (data: TaskEventData) => void): this;
  on(event: 'task:completed', listener: (output: TaskOutput) => void): this;
  on(event: 'task:failed', listener: (output: TaskOutput) => void): this;
  on(event: 'agent:spawned', listener: (agent: Agent) => void): this;
  on(event: 'agent:terminated', listener: (agent: Agent) => void): this;
  on(event: 'execution:progress', listener: (progress: ExecutionProgress) => void): this;
  on(event: 'execution:complete', listener: (result: SwarmResult) => void): this;
}

/**
 * Base orchestrator class interface
 */
export abstract class Orchestrator extends EventEmitter implements OrchestratorEvents {
  abstract execute(request: SwarmRequest): Promise<SwarmResult>;
  abstract shutdown(): Promise<void>;
}
