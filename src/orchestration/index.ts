/**
 * Swarm-Native Orchestrator Core - Public API
 * 
 * Main entry point for the orchestration library.
 */

// ============================================================================
// Types Re-exports
// ============================================================================

export {
  TaskState,
  AgentStatus,
  ContextSharingMode,
  MergeStrategy
} from './types.js';

export type {
  TaskInput,
  TaskOutput,
  TaskEventData,
  GraphNode,
  GraphEdge,
  ExecutionConfig,
  ExecutionProgress,
  AgentConfig,
  Agent,
  AgentPoolConfig,
  HealthCheckResult,
  SwarmRequest,
  SwarmResult,
  MergeConfig,
  OrchestratorEvents,
  Orchestrator
} from './types.js';

// ============================================================================
// Task & Graph Exports
// ============================================================================

export { Task } from './Task.js';
export { TaskGraph } from './TaskGraph.js';

// ============================================================================
// Agent Management Exports
// ============================================================================

export { 
  AgentLifecycleManager,
  DefaultAgentRunner 
} from './AgentLifecycleManager.js';

export type {
  AgentLifecycleEvents,
  AgentSpawner,
  AgentRunner
} from './AgentLifecycleManager.js';

// ============================================================================
// Controller Exports
// ============================================================================

export { 
  SwarmController,
  createSwarmController,
  SwarmControllerBuilder 
} from './SwarmController.js';

export type {
  SwarmControllerEvents
} from './SwarmController.js';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a simple task input
 */
export function createTaskInput(
  id: string,
  task: string,
  options?: Partial<Omit<TaskInput, 'id' | 'task'>>
): TaskInput {
  return {
    id,
    task,
    ...options
  };
}

/**
 * Create a swarm request from tasks and optional dependencies
 */
export function createSwarmRequest(
  tasks: TaskInput[],
  dependencies?: [string, string][],
  config?: ExecutionConfig
): SwarmRequest {
  return {
    tasks,
    dependencies,
    config
  };
}

/**
 * Validate task inputs for duplicates
 */
export function validateTasks(tasks: TaskInput[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();

  for (const task of tasks) {
    if (!task.id) {
      errors.push('Task missing required id field');
    } else if (ids.has(task.id)) {
      errors.push(`Duplicate task id: ${task.id}`);
    } else {
      ids.add(task.id);
    }

    if (!task.task) {
      errors.push(`Task '${task.id}' missing required task field`);
    }
  }

  return errors;
}

/**
 * Validate dependencies reference valid task ids
 */
export function validateDependencies(
  tasks: TaskInput[],
  dependencies: [string, string][]
): string[] {
  const errors: string[] = [];
  const taskIds = new Set(tasks.map(t => t.id));

  for (const [from, to] of dependencies) {
    if (!taskIds.has(from)) {
      errors.push(`Dependency references non-existent task: ${from}`);
    }
    if (!taskIds.has(to)) {
      errors.push(`Dependency references non-existent task: ${to}`);
    }
  }

  return errors;
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default execution configuration
 */
export const DEFAULT_EXECUTION_CONFIG: ExecutionConfig = {
  maxConcurrent: 5,
  stopOnFailure: false
};

/**
 * Default agent pool configuration
 */
export const DEFAULT_AGENT_POOL_CONFIG: AgentPoolConfig = {
  maxAgents: 10,
  idleTimeout: 300000, // 5 minutes
  healthCheckInterval: 30000, // 30 seconds
  maxRetries: 3
};

// ============================================================================
// Version Information
// ============================================================================

/**
 * Library version
 */
export const VERSION = '1.0.0';

/**
 * Library name
 */
export const NAME = '@openclaw/swarm-native-orchestrator';

/**
 * Library metadata
 */
export const METADATA = {
  name: NAME,
  version: VERSION,
  description: 'Swarm-native agent orchestration core'
};

export default {
  // Core classes
  Task,
  TaskGraph,
  AgentLifecycleManager,
  SwarmController,
  
  // Builder
  createSwarmController,
  
  // Types
  TaskState,
  AgentStatus,
  
  // Utilities
  createTaskInput,
  createSwarmRequest,
  validateTasks,
  validateDependencies,
  
  // Defaults
  DEFAULT_EXECUTION_CONFIG,
  DEFAULT_AGENT_POOL_CONFIG,
  
  // Metadata
  VERSION,
  NAME,
  METADATA
};
