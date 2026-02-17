/**
 * TaskGraph - DAG Execution Engine
 * 
 * Manages task dependencies and parallel execution.
 */

import { EventEmitter } from 'events';
import { Task } from './Task.js';
import {
  TaskState,
  TaskInput,
  TaskOutput,
  GraphNode,
  ExecutionConfig,
  ExecutionProgress,
  SwarmResult
} from './types.js';

/**
 * TaskGraph - Directed Acyclic Graph execution engine
 */
export class TaskGraph extends EventEmitter {
  private nodes: Map<string, GraphNode> = new Map();
  private adjacencyList: Map<string, Set<string>> = new Map();
  private config: ExecutionConfig;
  
  // Execution state
  private runningTasks: Set<string> = new Set();
  private completedTasks: Set<string> = new Set();
  private failedTasks: Set<string> = new Set();
  private executionOrder: string[] = [];
  
  // Callbacks
  private taskExecutor?: (task: Task) => Promise<TaskOutput>;
  
  /**
   * Create a new TaskGraph
   */
  constructor(config: ExecutionConfig = {}) {
    super();
    this.config = {
      maxConcurrent: config.maxConcurrent ?? 5,
      stopOnFailure: config.stopOnFailure ?? false,
      progressCallback: config.progressCallback
    };
  }
  
  /**
   * Set task executor callback
   */
  setExecutor(executor: (task: Task) => Promise<TaskOutput>): void {
    this.taskExecutor = executor;
  }
  
  /**
   * Add a task to the graph
   */
  addTask(input: TaskInput): Task {
    if (this.nodes.has(input.id)) {
      throw new Error(`Task with id '${input.id}' already exists`);
    }
    
    const task = new Task(input);
    const node: GraphNode = {
      id: input.id,
      task: input,
      state: TaskState.PENDING,
      dependencies: new Set(),
      dependents: new Set(),
      inDegree: 0
    };
    
    this.nodes.set(input.id, node);
    this.adjacencyList.set(input.id, new Set());
    
    // Emit task added event
    this.emit('task:added', task);
    
    return task;
  }
  
  /**
   * Add dependency between tasks
   * @param from Task that must complete first
   * @param to Task that depends on 'from'
   */
  addDependency(from: string, to: string): void {
    const fromNode = this.nodes.get(from);
    const toNode = this.nodes.get(to);
    
    if (!fromNode) {
      throw new Error(`Source task '${from}' not found`);
    }
    
    if (!toNode) {
      throw new Error(`Target task '${to}' not found`);
    }
    
    // Check for cycle (simplified)
    if (this.wouldCreateCycle(from, to)) {
      throw new Error(`Adding dependency '${from}' -> '${to}' would create a cycle`);
    }
    
    // Add edge
    fromNode.dependents.add(to);
    toNode.dependencies.add(from);
    toNode.inDegree++;
    
    const edges = this.adjacencyList.get(from);
    if (edges) {
      edges.add(to);
    }
    
    // Emit dependency added event
    this.emit('dependency:added', { from, to });
  }
  
  /**
   * Check if adding a dependency would create a cycle
   */
  private wouldCreateCycle(from: string, to: string): boolean {
    // DFS from 'to' to see if we can reach 'from'
    const visited = new Set<string>();
    const stack = [to];
    
    while (stack.length > 0) {
      const current = stack.pop()!;
      
      if (current === from) {
        return true;
      }
      
      if (visited.has(current)) {
        continue;
      }
      
      visited.add(current);
      
      const edges = this.adjacencyList.get(current);
      if (edges) {
        stack.push(...edges);
      }
    }
    
    return false;
  }
  
  /**
   * Get all tasks ready to execute (dependencies satisfied)
   */
  getReadyTasks(): Task[] {
    const ready: Task[] = [];
    
    for (const [id, node] of this.nodes) {
      if (node.state !== TaskState.PENDING) {
        continue;
      }
      
      // Check if all dependencies are satisfied
      const depsSatisfied = Array.from(node.dependencies).every(
        depId => this.completedTasks.has(depId)
      );
      
      if (depsSatisfied) {
        ready.push(new Task(node.task));
      }
    }
    
    return ready;
  }
  
  /**
   * Get tasks that are blocked (dependencies not met)
   */
  getBlockedTasks(): Task[] {
    const blocked: Task[] = [];
    
    for (const [id, node] of this.nodes) {
      if (node.state !== TaskState.PENDING) {
        continue;
      }
      
      const unsatisfiedDeps = Array.from(node.dependencies).filter(
        depId => !this.completedTasks.has(depId)
      );
      
      if (unsatisfiedDeps.length > 0) {
        const task = new Task(node.task);
        task.block();
        blocked.push(task);
      }
    }
    
    return blocked;
  }
  
  /**
   * Get task by ID
   */
  getTaskById(id: string): Task | undefined {
    const node = this.nodes.get(id);
    return node ? new Task(node.task) : undefined;
  }
  
  /**
   * Get node by ID
   */
  getNodeById(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }
  
  /**
   * Get current progress
   */
  getProgress(): ExecutionProgress {
    return {
      total: this.nodes.size,
      completed: this.completedTasks.size,
      failed: this.failedTasks.size,
      running: this.runningTasks.size,
      blocked: this.getBlockedTasks().length,
      currentTasks: Array.from(this.runningTasks)
    };
  }
  
  /**
   * Execute all tasks in the graph
   */
  async execute(): Promise<SwarmResult> {
    const startTime = Date.now();
    const outputs = new Map<string, TaskOutput>();
    const errors: string[] = [];
    
    this.executionOrder = [];
    this.completedTasks.clear();
    this.failedTasks.clear();
    this.runningTasks.clear();
    
    // Initialize all nodes
    for (const [id, node] of this.nodes) {
      node.state = TaskState.PENDING;
    }
    
    // Execute until all done
    while (this.hasIncompleteTasks()) {
      // Check for failure stop
      if (this.config.stopOnFailure && this.failedTasks.size > 0) {
        break;
      }
      
      // Get ready tasks respecting concurrency
      const readyTasks = this.getReadyTasks();
      const availableSlots = (this.config.maxConcurrency ?? 5) - this.runningTasks.size;
      
      const tasksToRun = readyTasks.slice(0, Math.max(0, availableSlots));
      
      if (tasksToRun.length === 0 && this.runningTasks.size === 0) {
        // Deadlock - no tasks can proceed
        const blocked = this.getBlockedTasks();
        if (blocked.length > 0) {
          errors.push('Deadlock detected: No tasks can proceed');
        }
        break;
      }
      
      // Execute ready tasks in parallel
      const promises = tasksToRun.map(async (task) => {
        return this.executeTask(task);
      });
      
      const results = await Promise.allSettled(promises);
      
      // Process results
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const task = tasksToRun[i];
        
        if (result.status === 'fulfilled') {
          const output = result.value;
          outputs.set(task.id, output);
          
          if (output.status === TaskState.COMPLETED) {
            this.completedTasks.add(task.id);
            this.executionOrder.push(task.id);
          } else if (output.status === TaskState.FAILED) {
            this.failedTasks.add(task.id);
            errors.push(`Task ${task.id}: ${output.error || 'Unknown error'}`);
          }
        } else {
          this.failedTasks.add(task.id);
          errors.push(`Task ${task.id}: ${result.reason}`);
        }
        
        this.runningTasks.delete(task.id);
      }
      
      // Report progress
      if (this.config.progressCallback) {
        this.config.progressCallback(this.getProgress());
      }
      
      this.emit('execution:progress', this.getProgress());
    }
    
    const duration = Date.now() - startTime;
    const success = this.failedTasks.size === 0 && errors.length === 0;
    
    const result: SwarmResult = {
      success,
      outputs,
      duration,
      errors
    };
    
    this.emit('execution:complete', result);
    
    return result;
  }
  
  /**
   * Execute a single task
   */
  private async executeTask(task: Task): Promise<TaskOutput> {
    const node = this.nodes.get(task.id);
    if (!node) {
      throw new Error(`Task node '${task.id}' not found`);
    }
    
    // Mark as running
    node.state = TaskState.RUNNING;
    this.runningTasks.add(task.id);
    task.start();
    
    this.emit('task:started', task);
    
    try {
      // Execute via callback if provided
      if (this.taskExecutor) {
        const output = await this.taskExecutor(task);
        node.output = output;
        
        if (output.status === TaskState.COMPLETED) {
          node.state = TaskState.COMPLETED;
          task.complete(output.result);
          this.emit('task:completed', output);
        } else {
          node.state = TaskState.FAILED;
          task.fail(output.error || 'Task failed');
          this.emit('task:failed', output);
        }
        
        return output;
      }
      
      // No executor provided - mark as completed
      const output: TaskOutput = {
        taskId: task.id,
        status: TaskState.COMPLETED,
        startedAt: Date.now(),
        completedAt: Date.now(),
        retries: 0
      };
      
      node.state = TaskState.COMPLETED;
      node.output = output;
      task.complete();
      
      this.emit('task:completed', output);
      
      return output;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      const output: TaskOutput = {
        taskId: task.id,
        status: TaskState.FAILED,
        error: errorMessage,
        startedAt: Date.now(),
        completedAt: Date.now(),
        retries: task.retries
      };
      
      node.state = TaskState.FAILED;
      node.output = output;
      task.fail(errorMessage);
      
      this.emit('task:failed', output);
      
      return output;
    }
  }
  
  /**
   * Handle task completion - update in-degrees
   */
  onTaskComplete(taskId: string): void {
    const node = this.nodes.get(taskId);
    if (!node) return;
    
    // Update dependent nodes
    for (const dependentId of node.dependents) {
      const dependentNode = this.nodes.get(dependentId);
      if (dependentNode) {
        dependentNode.inDegree--;
        
        // If all dependencies satisfied, task becomes ready
        if (dependentNode.inDegree === 0 && dependentNode.state === TaskState.PENDING) {
          this.emit('task:ready', dependentId);
        }
      }
    }
  }
  
  /**
   * Handle task failure - propagate to dependents
   */
  onTaskFail(taskId: string): void {
    if (!this.config.stopOnFailure) return;
    
    const node = this.nodes.get(taskId);
    if (!node) return;
    
    // Block all dependents
    for (const dependentId of node.dependents) {
      const dependentNode = this.nodes.get(dependentId);
      if (dependentNode && dependentNode.state === TaskState.PENDING) {
        dependentNode.state = TaskState.BLOCKED;
        this.emit('task:blocked', { taskId: dependentId, reason: `Dependency '${taskId}' failed` });
      }
    }
  }
  
  /**
   * Check if there are incomplete tasks
   */
  private hasIncompleteTasks(): boolean {
    const allDone = Array.from(this.nodes.values()).every(
      node => node.state === TaskState.COMPLETED || node.state === TaskState.FAILED
    );
    return !allDone;
  }
  
  /**
   * Get all nodes
   */
  getNodes(): Map<string, GraphNode> {
    return new Map(this.nodes);
  }
  
  /**
   * Get node count
   */
  get nodeCount(): number {
    return this.nodes.size;
  }
  
  /**
   * Clear the graph
   */
  clear(): void {
    this.nodes.clear();
    this.adjacencyList.clear();
    this.runningTasks.clear();
    this.completedTasks.clear();
    this.failedTasks.clear();
    this.executionOrder = [];
  }
  
  /**
   * Get topological sort order
   */
  getExecutionOrder(): string[] {
    if (this.executionOrder.length > 0) {
      return [...this.executionOrder];
    }
    
    // Compute topological sort
    const inDegrees = new Map<string, number>();
    const result: string[] = [];
    const queue: string[] = [];
    
    // Initialize in-degrees
    for (const [id, node] of this.nodes) {
      inDegrees.set(id, node.inDegree);
      if (node.inDegree === 0) {
        queue.push(id);
      }
    }
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);
      
      const edges = this.adjacencyList.get(current);
      if (edges) {
        for (const neighbor of edges) {
          const newDegree = (inDegrees.get(neighbor) ?? 1) - 1;
          inDegrees.set(neighbor, newDegree);
          if (newDegree === 0) {
            queue.push(neighbor);
          }
        }
      }
    }
    
    return result;
  }
}
