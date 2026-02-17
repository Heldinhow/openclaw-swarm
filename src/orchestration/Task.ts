/**
 * Task Class Implementation
 * 
 * Represents a unit of work with state machine and lifecycle management.
 */

import { EventEmitter } from 'events';
import {
  TaskState,
  TaskInput,
  TaskOutput,
  ContextSharingMode
} from './types.js';

/**
 * Task state machine transitions
 */
const VALID_TRANSITIONS: Record<TaskState, TaskState[]> = {
  [TaskState.PENDING]: [TaskState.RUNNING, TaskState.BLOCKED, TaskState.FAILED],
  [TaskState.RUNNING]: [TaskState.COMPLETED, TaskState.FAILED, TaskState.BLOCKED],
  [TaskState.BLOCKED]: [TaskState.RUNNING, TaskState.FAILED],
  [TaskState.FAILED]: [TaskState.PENDING], // Retry
  [TaskState.COMPLETED]: [] // Terminal state
};

/**
 * Task class with state management
 */
export class Task extends EventEmitter {
  readonly id: string;
  readonly label: string;
  readonly task: string;
  readonly model?: string;
  readonly contextSharing: ContextSharingMode;
  readonly maxRetries: number;
  readonly timeout: number;
  readonly metadata: Record<string, unknown>;
  
  private _state: TaskState;
  private _output?: TaskOutput;
  private _retries: number = 0;
  private _startedAt?: number;
  
  /**
   * Create a new Task
   */
  constructor(input: TaskInput) {
    super();
    
    this.id = input.id;
    this.label = input.label || input.id;
    this.task = input.task;
    this.model = input.model;
    this.contextSharing = input.contextSharing || 'none';
    this.maxRetries = input.maxRetries ?? 3;
    this.timeout = input.timeout ?? 300000; // 5 minutes default
    this.metadata = input.metadata || {};
    this._state = TaskState.PENDING;
  }
  
  /**
   * Get current task state
   */
  get state(): TaskState {
    return this._state;
  }
  
  /**
   * Get task output
   */
  get output(): TaskOutput | undefined {
    return this._output;
  }
  
  /**
   * Get retry count
   */
  get retries(): number {
    return this._retries;
  }
  
  /**
   * Check if task can be retried
   */
  get canRetry(): boolean {
    return this._state === TaskState.FAILED && this._retries < this.maxRetries;
  }
  
  /**
   * Check if task is terminal state
   */
  get isTerminal(): boolean {
    return this._state === TaskState.COMPLETED || this._state === TaskState.FAILED;
  }
  
  /**
   * Transition to a new state
   */
  transition(newState: TaskState, output?: Partial<TaskOutput>): boolean {
    const currentState = this._state;
    
    // Validate transition
    if (!this.isValidTransition(currentState, newState)) {
      this.emit('error', new Error(
        `Invalid state transition: ${currentState} -> ${newState}`
      ));
      return false;
    }
    
    // Update state
    this._state = newState;
    
    // Update output
    if (!this._output) {
      this._output = {
        taskId: this.id,
        status: newState,
        startedAt: this._startedAt || Date.now(),
        retries: this._retries
      };
    }
    
    this._output.status = newState;
    
    if (output) {
      Object.assign(this._output, output);
    }
    
    // Set timestamps
    if (newState === TaskState.RUNNING && !this._startedAt) {
      this._startedAt = Date.now();
      this._output.startedAt = this._startedAt;
    }
    
    if (newState === TaskState.COMPLETED || newState === TaskState.FAILED) {
      this._output.completedAt = Date.now();
    }
    
    // Emit state change event
    this.emit('stateChanged', {
      taskId: this.id,
      previousState: currentState,
      currentState: newState,
      output: this._output,
      error: output?.error ? new Error(output.error as string) : undefined
    });
    
    return true;
  }
  
  /**
   * Validate state transition
   */
  private isValidTransition(from: TaskState, to: TaskState): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
  }
  
  /**
   * Start task execution
   */
  start(): boolean {
    return this.transition(TaskState.RUNNING);
  }
  
  /**
   * Mark task as blocked
   */
  block(): boolean {
    return this.transition(TaskState.BLOCKED);
  }
  
  /**
   * Mark task as completed with result
   */
  complete(result?: unknown): boolean {
    return this.transition(TaskState.COMPLETED, {
      result,
      error: undefined
    });
  }
  
  /**
   * Mark task as failed
   */
  fail(error: string): boolean {
    return this.transition(TaskState.FAILED, {
      error
    });
  }
  
  /**
   * Retry failed task
   */
  retry(): boolean {
    if (!this.canRetry) {
      return false;
    }
    
    this._retries++;
    return this.transition(TaskState.PENDING);
  }
  
  /**
   * Get task as TaskInput
   */
  toInput(): TaskInput {
    return {
      id: this.id,
      label: this.label,
      task: this.task,
      model: this.model,
      contextSharing: this.contextSharing,
      maxRetries: this.maxRetries,
      timeout: this.timeout,
      metadata: this.metadata
    };
  }
  
  /**
   * Get task output
   */
  toOutput(): TaskOutput {
    if (!this._output) {
      throw new Error('Task has not been executed yet');
    }
    return { ...this._output };
  }
  
  /**
   * Serialize to JSON
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      label: this.label,
      task: this.task,
      model: this.model,
      contextSharing: this.contextSharing,
      maxRetries: this.maxRetries,
      timeout: this.timeout,
      metadata: this.metadata,
      state: this._state,
      output: this._output,
      retries: this._retries,
      canRetry: this.canRetry,
      isTerminal: this.isTerminal
    };
  }
  
  /**
   * Create Task from JSON
   */
  static fromJSON(json: Record<string, unknown>): Task {
    const input: TaskInput = {
      id: json.id as string,
      label: json.label as string,
      task: json.task as string,
      model: json.model as string | undefined,
      contextSharing: json.contextSharing as ContextSharingMode | undefined,
      maxRetries: json.maxRetries as number | undefined,
      timeout: json.timeout as number | undefined,
      metadata: json.metadata as Record<string, unknown> | undefined
    };
    
    const task = new Task(input);
    task._retries = (json.retries as number) ?? 0;
    
    if (json.state) {
      task._state = json.state as TaskState;
    }
    
    if (json.output) {
      task._output = json.output as TaskOutput;
    }
    
    return task;
  }
}
