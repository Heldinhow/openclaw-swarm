import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IterativeWorkflow, type IterativeWorkflowConfig } from './iterative-workflow.js';
import type { TaskContext } from './workflow.js';
import { EventBus } from './event-bus.js';
import { SwarmController } from './swarm-controller.js';
import { SharedContextStore } from './shared-context-store.js';

const createConfig = (overrides: Partial<IterativeWorkflowConfig> = {}): IterativeWorkflowConfig =>
  ({
    maxTasks: 50,
    maxNestingDepth: 5,
    defaultTimeout: 5000,
    failureStrategy: 'fail-fast',
    maxRetries: 0,
    maxIterations: 3,
    ...overrides,
  }) as IterativeWorkflowConfig;

describe('IterativeWorkflow', () => {
  let workflow: IterativeWorkflow<{ iteration: number }>;
  let mockContext: TaskContext;

  beforeEach(() => {
    const eventBus = new EventBus();
    const eventLog = {
      log: vi.fn(),
      query: vi.fn().mockResolvedValue([]),
      clear: vi.fn(),
    };
    const swarmController = new SwarmController(eventBus, eventLog as never);
    const sharedStore = new SharedContextStore();

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
      workflow = new IterativeWorkflow(createConfig({ maxIterations: 3 }), []);
      expect(() => workflow.validate()).toThrow(
        'IterativeWorkflow requires at least 1 task'
      );
    });

    it('should throw for invalid maxIterations', () => {
      workflow = new IterativeWorkflow(createConfig({ maxIterations: 0 }), [
        { id: 'task1', payload: { iteration: 1 }, dependencies: [] },
      ]);
      expect(() => workflow.validate()).toThrow('maxIterations must be greater than 0');
    });

    it('should throw for duplicate task IDs', () => {
      workflow = new IterativeWorkflow(
        createConfig({ maxIterations: 3 }),
        [
          { id: 'task1', payload: { iteration: 1 }, dependencies: [] },
          { id: 'task1', payload: { iteration: 2 }, dependencies: [] },
        ]
      );
      expect(() => workflow.validate()).toThrow('Duplicate task ID');
    });
  });

  describe('execute', () => {
    it('should execute exactly maxIterations times', async () => {
      let executionCount = 0;

      workflow = new IterativeWorkflow(
        createConfig({ maxIterations: 3 }),
        [
          {
            id: 'task1',
            payload: { iteration: 1 },
            dependencies: [],
            handler: async () => {
              executionCount++;
              return `iteration-${executionCount}`;
            },
          },
        ]
      );

      const result = await workflow.execute(mockContext);

      expect(executionCount).toBe(3);
      expect(result.metadata.taskCount).toBe(3);
    });

    it('should run all iterations when stopOnSuccess is false', async () => {
      let executionCount = 0;

      workflow = new IterativeWorkflow(
        createConfig({ maxIterations: 5, stopOnSuccess: false }),
        [
          {
            id: 'task1',
            payload: { iteration: 1 },
            dependencies: [],
            handler: async () => {
              executionCount++;
              return 'continue';
            },
          },
        ]
      );

      await workflow.execute(mockContext);

      expect(executionCount).toBe(5);
    });

    it('should stop early when until() returns true', async () => {
      let iterationResults: number[] = [];

      workflow = new IterativeWorkflow(
        createConfig({
          maxIterations: 10,
          until: (results) => {
            const lastResult = results.get('task1');
            return lastResult !== undefined && Number(lastResult) >= 5;
          },
        }),
        [
          {
            id: 'task1',
            payload: { iteration: 1 },
            dependencies: [],
            handler: async () => {
              iterationResults.push(iterationResults.length + 1);
              return iterationResults.length;
            },
          },
        ]
      );

      await workflow.execute(mockContext);

      expect(iterationResults).toEqual([1, 2, 3, 4, 5]);
    });

    it('should continue all iterations on task failure', async () => {
      let executionCount = 0;

      workflow = new IterativeWorkflow(
        createConfig({ maxIterations: 3, stopOnSuccess: false }),
        [
          {
            id: 'task1',
            payload: { iteration: 1 },
            dependencies: [],
            handler: async () => {
              executionCount++;
              if (executionCount === 2) {
                throw new Error('Task failed');
              }
              return 'ok';
            },
          },
        ]
      );

      const result = await workflow.execute(mockContext);

      expect(executionCount).toBe(3);
      expect(result.errors.size).toBe(1);
    });

    it('should handle task without handler', async () => {
      workflow = new IterativeWorkflow(
        createConfig({ maxIterations: 2 }),
        [{ id: 'task1', payload: { iteration: 1 }, dependencies: [] }]
      );

      const result = await workflow.execute(mockContext);

      expect(result.success).toBe(true);
      expect(result.outputs.size).toBe(2);
    });
  });

  describe('getGraph', () => {
    it('should return a TaskGraph with all tasks', () => {
      workflow = new IterativeWorkflow(
        createConfig({ maxIterations: 3 }),
        [
          { id: 'task1', payload: { iteration: 1 }, dependencies: [] },
          { id: 'task2', payload: { iteration: 2 }, dependencies: [] },
        ]
      );

      const graph = workflow.getGraph();

      expect(graph.getAllTasks()).toHaveLength(2);
    });
  });
});
