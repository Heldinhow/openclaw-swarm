import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Orchestrator } from './orchestrator.js';
import { ConcurrentWorkflow } from './concurrent-workflow.js';
import { PipelineWorkflow } from './pipeline-workflow.js';
import { IterativeWorkflow } from './iterative-workflow.js';
import { TaskTypeClassifier } from './task-type-classifier.js';
import { WorkflowRegistry, type WorkflowClass } from './workflow-registry.js';
import type { WorkflowConfig } from './workflow.js';

describe('Orchestrator', () => {
  let orchestrator: Orchestrator;

  beforeEach(() => {
    orchestrator = new Orchestrator();
  });

  describe('selectWorkflow', () => {
    it('should select ConcurrentWorkflow for research type', () => {
      const workflow = orchestrator.selectWorkflow('concurrent');

      expect(workflow).toBeInstanceOf(ConcurrentWorkflow);
    });

    it('should select PipelineWorkflow for pipeline type', () => {
      const workflow = orchestrator.selectWorkflow('pipeline');

      expect(workflow).toBeInstanceOf(PipelineWorkflow);
    });

    it('should select IterativeWorkflow for iterative type', () => {
      const workflow = orchestrator.selectWorkflow('iterative');

      expect(workflow).toBeInstanceOf(IterativeWorkflow);
    });

    it('should fallback to ConcurrentWorkflow for unknown type', () => {
      const workflow = orchestrator.selectWorkflow('unknown-type');

      expect(workflow).toBeInstanceOf(ConcurrentWorkflow);
    });
  });

  describe('registerWorkflow', () => {
    it('should register custom workflow', () => {
      const CustomWorkflow: WorkflowClass = class extends ConcurrentWorkflow {
        constructor(cfg: WorkflowConfig) {
          super([], cfg);
        }
      };
      orchestrator.registerWorkflow('custom', CustomWorkflow);

      const workflow = orchestrator.selectWorkflow('custom');

      expect(workflow).toBeInstanceOf(ConcurrentWorkflow);
    });
  });

  describe('execute', () => {
    it('should execute concurrent workflow', async () => {
      const result = await orchestrator.execute({
        id: 'test',
        type: 'concurrent',
        tasks: [
          { id: 'task1', payload: {}, dependencies: [] },
          { id: 'task2', payload: {}, dependencies: [] },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.outputs.size).toBe(2);
    });

    it('should execute pipeline workflow', async () => {
      const result = await orchestrator.execute({
        id: 'test',
        type: 'pipeline',
        tasks: [
          { id: 'task1', payload: {}, dependencies: [] },
          { id: 'task2', payload: {}, dependencies: ['task1'] },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.outputs.size).toBe(2);
    });

    it('should execute iterative workflow', async () => {
      const result = await orchestrator.execute({
        id: 'test',
        type: 'iterative',
        iterativeConfig: { maxIterations: 2 },
        tasks: [{ id: 'task1', payload: {}, dependencies: [] }],
      });

      expect(result.success).toBe(true);
    });

    it('should use task type classification for unknown type', async () => {
      const result = await orchestrator.execute({
        id: 'test',
        type: 'research',
        message: 'research best practices for authentication',
        tasks: [{ id: 'task1', payload: {}, dependencies: [] }],
      });

      expect(result.success).toBe(true);
    });
  });

  describe('getRegisteredTypes', () => {
    it('should return registered types', () => {
      orchestrator.registerWorkflow('custom1', class extends ConcurrentWorkflow {
        constructor(cfg: WorkflowConfig) {
          super([], cfg);
        }
      });
      orchestrator.registerWorkflow('custom2', class extends PipelineWorkflow {
        constructor(cfg: WorkflowConfig) {
          super([], cfg);
        }
      });

      const types = orchestrator.getRegisteredTypes();

      expect(types).toContain('custom1');
      expect(types).toContain('custom2');
    });
  });
});

describe('TaskTypeClassifier', () => {
  let classifier: TaskTypeClassifier;

  beforeEach(() => {
    classifier = new TaskTypeClassifier();
  });

  describe('classify', () => {
    it('should return explicit type with full confidence', () => {
      const result = classifier.classify({
        explicitType: 'iterative',
        message: 'do something',
      });

      expect(result.type).toBe('iterative');
      expect(result.confidence).toBe(1.0);
      expect(result.method).toBe('explicit');
    });

    it('should detect research keywords', () => {
      const result = classifier.classify({
        message: 'research best practices for authentication',
      });

      expect(result.type).toBe('concurrent');
      expect(result.method).toBe('keyword');
    });

    it('should detect code keywords', () => {
      const result = classifier.classify({
        message: 'write a function to parse JSON',
      });

      expect(result.type).toBe('iterative');
      expect(result.method).toBe('keyword');
    });

    it('should detect refactor keywords', () => {
      const result = classifier.classify({
        message: 'refactor this code for better performance',
      });

      expect(result.type).toBe('pipeline');
      expect(result.method).toBe('keyword');
    });

    it('should default to concurrent for unknown messages', () => {
      const result = classifier.classify({
        message: 'do something generic',
      });

      expect(result.type).toBe('concurrent');
      expect(result.method).toBe('default');
    });
  });
});

describe('WorkflowRegistry', () => {
  let registry: WorkflowRegistry;

  beforeEach(() => {
    registry = new WorkflowRegistry();
  });

  describe('register', () => {
    it('should register a workflow type', () => {
      const TestWorkflow: WorkflowClass = class extends ConcurrentWorkflow {
        constructor(cfg: WorkflowConfig) {
          super([], cfg);
        }
      };
      registry.register('test-workflow', TestWorkflow);

      expect(registry.has('test-workflow')).toBe(true);
    });

    it('should allow overwriting with warning', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const TestWorkflow1: WorkflowClass = class extends ConcurrentWorkflow {
        constructor(cfg: WorkflowConfig) {
          super([], cfg);
        }
      };
      const TestWorkflow2: WorkflowClass = class extends PipelineWorkflow {
        constructor(cfg: WorkflowConfig) {
          super([], cfg);
        }
      };

      registry.register('test-workflow', TestWorkflow1);
      registry.register('test-workflow', TestWorkflow2);

      expect(registry.has('test-workflow')).toBe(true);
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('should return registered workflow class', () => {
      const TestWorkflow: WorkflowClass = class extends ConcurrentWorkflow {
        constructor(cfg: WorkflowConfig) {
          super([], cfg);
        }
      };
      registry.register('test-workflow', TestWorkflow);

      const WorkflowClass = registry.get('test-workflow');

      expect(WorkflowClass).toBeDefined();
    });

    it('should return undefined for unknown type', () => {
      const WorkflowClass = registry.get('unknown');

      expect(WorkflowClass).toBeUndefined();
    });
  });

  describe('list', () => {
    it('should list all registered types', () => {
      const TestWorkflow1: WorkflowClass = class extends ConcurrentWorkflow {
        constructor(cfg: WorkflowConfig) {
          super([], cfg);
        }
      };
      const TestWorkflow2: WorkflowClass = class extends PipelineWorkflow {
        constructor(cfg: WorkflowConfig) {
          super([], cfg);
        }
      };

      registry.register('type1', TestWorkflow1);
      registry.register('type2', TestWorkflow2);

      const types = registry.list();

      expect(types).toContain('type1');
      expect(types).toContain('type2');
    });
  });
});
