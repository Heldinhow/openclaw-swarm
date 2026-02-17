import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PipelineWorkflow } from './pipeline-workflow.js';
import type { TaskContext } from './workflow.js';
import { EventBus } from './event-bus.js';
import { SwarmController } from './swarm-controller.js';
import { SharedContextStore } from './shared-context-store.js';

describe('PipelineWorkflow', () => {
  let workflow: PipelineWorkflow<{ value: number }>;
  let mockContext: TaskContext;
  let sharedStore: SharedContextStore;

  beforeEach(() => {
    const eventBus = new EventBus();
    const eventLog = {
      log: vi.fn(),
      query: vi.fn().mockResolvedValue([]),
      clear: vi.fn(),
    };
    const swarmController = new SwarmController(eventBus, eventLog as never);
    sharedStore = new SharedContextStore();

    mockContext = {
      sessionKey: 'test-session',
      namespace: 'test',
      sharedStore,
      eventBus,
      swarmController,
      config: {
        maxTasks: 50,
        maxNestingDepth: 5,
        defaultTimeout: 5000,
        failureStrategy: 'fail-fast',
        maxRetries: 0,
      },
    };
  });

  describe('validate', () => {
    it('should throw for empty task list', () => {
      workflow = new PipelineWorkflow([]);
      expect(() => workflow.validate()).toThrow(
        'PipelineWorkflow requires at least 1 task'
      );
    });

    it('should throw for duplicate task IDs', () => {
      workflow = new PipelineWorkflow([
        { id: 'task1', payload: { value: 1 }, dependencies: [] },
        { id: 'task1', payload: { value: 2 }, dependencies: [] },
      ]);
      expect(() => workflow.validate()).toThrow('Duplicate task ID');
    });

    it('should throw for undefined dependencies', () => {
      workflow = new PipelineWorkflow([
        { id: 'task1', payload: { value: 1 }, dependencies: ['task2'] },
      ]);
      expect(() => workflow.validate()).toThrow('not defined');
    });
  });

  describe('execute', () => {
    it('should execute tasks sequentially', async () => {
      const executionOrder: string[] = [];

      workflow = new PipelineWorkflow([
        {
          id: 'task1',
          payload: { value: 1 },
          dependencies: [],
          handler: async () => {
            executionOrder.push('task1-start');
            await new Promise((r) => setTimeout(r, 50));
            executionOrder.push('task1-end');
            return 'result1';
          },
        },
        {
          id: 'task2',
          payload: { value: 2 },
          dependencies: ['task1'],
          handler: async () => {
            executionOrder.push('task2-start');
            await new Promise((r) => setTimeout(r, 50));
            executionOrder.push('task2-end');
            return 'result2';
          },
        },
        {
          id: 'task3',
          payload: { value: 3 },
          dependencies: ['task2'],
          handler: async () => {
            executionOrder.push('task3-start');
            return 'result3';
          },
        },
      ]);

      const result = await workflow.execute(mockContext);

      expect(result.success).toBe(true);
      expect(executionOrder).toEqual([
        'task1-start',
        'task1-end',
        'task2-start',
        'task2-end',
        'task3-start',
      ]);
      expect(result.outputs.get('task1')).toBe('result1');
      expect(result.outputs.get('task2')).toBe('result2');
      expect(result.outputs.get('task3')).toBe('result3');
    });

    it('should stop on first failure', async () => {
      workflow = new PipelineWorkflow([
        {
          id: 'task1',
          payload: { value: 1 },
          dependencies: [],
          handler: async () => 'result1',
        },
        {
          id: 'task2',
          payload: { value: 2 },
          dependencies: ['task1'],
          handler: async () => {
            throw new Error('Task 2 failed');
          },
        },
        {
          id: 'task3',
          payload: { value: 3 },
          dependencies: ['task2'],
          handler: async () => 'result3',
        },
      ]);

      const result = await workflow.execute(mockContext);

      expect(result.success).toBe(false);
      expect(result.errors.size).toBe(1);
      expect(result.outputs.size).toBe(1);
      expect(result.outputs.get('task1')).toBe('result1');
      expect(result.errors.get('task2')).toBeDefined();
      expect(result.outputs.has('task3')).toBe(false);
    });

    it('should store results in shared context', async () => {
      workflow = new PipelineWorkflow([
        {
          id: 'task1',
          payload: { value: 1 },
          dependencies: [],
          handler: async () => ({ data: 'test' }),
        },
      ]);

      await workflow.execute(mockContext);
    });

    it('should handle task without handler', async () => {
      workflow = new PipelineWorkflow([
        { id: 'task1', payload: { value: 42 }, dependencies: [] },
      ]);

      const result = await workflow.execute(mockContext);

      expect(result.success).toBe(true);
      expect(result.outputs.get('task1')).toEqual({ value: 42 });
    });
  });

  describe('getGraph', () => {
    it('should return a TaskGraph with all tasks', () => {
      workflow = new PipelineWorkflow([
        { id: 'task1', payload: { value: 1 }, dependencies: [] },
        { id: 'task2', payload: { value: 2 }, dependencies: ['task1'] },
      ]);

      const graph = workflow.getGraph();

      expect(graph.getAllTasks()).toHaveLength(2);
      expect(graph.getTask('task1')).toBeDefined();
      expect(graph.getTask('task2')).toBeDefined();
    });
  });
});
