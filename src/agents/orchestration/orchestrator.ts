import { ConcurrentWorkflow } from "./concurrent-workflow.js";
import { IterativeWorkflow, type IterativeWorkflowConfig } from "./iterative-workflow.js";
import { PipelineWorkflow } from "./pipeline-workflow.js";
import { TaskTypeClassifier } from "./task-type-classifier.js";
import {
  WorkflowRegistry,
  type WorkflowClass,
  getGlobalWorkflowRegistry,
} from "./workflow-registry.js";
import {
  type Task,
  type TaskContext,
  type Workflow,
  type WorkflowConfig,
  type WorkflowResult,
  createDefaultWorkflowConfig,
} from "./workflow.js";

export interface OrchestratorConfig {
  registry?: WorkflowRegistry;
  classifier?: TaskTypeClassifier;
  defaultWorkflow?: string;
}

export interface OrchestrationTask {
  id: string;
  type: string;
  tasks: Task[];
  config?: Partial<WorkflowConfig>;
  iterativeConfig?: Partial<IterativeWorkflowConfig>;
  message?: string;
}

export class Orchestrator {
  private registry: WorkflowRegistry;
  private classifier: TaskTypeClassifier;
  private defaultWorkflow: string;

  constructor(config?: OrchestratorConfig) {
    this.registry = config?.registry ?? getGlobalWorkflowRegistry();
    this.classifier = config?.classifier ?? new TaskTypeClassifier();
    this.defaultWorkflow = config?.defaultWorkflow ?? "concurrent";
  }

  selectWorkflow(taskType: string, config?: Partial<WorkflowConfig>): Workflow {
    const workflowClass = this.registry.get(taskType);

    if (workflowClass) {
      return new workflowClass(createDefaultWorkflowConfig(config));
    }

    return this.createBuiltInWorkflow(taskType, config);
  }

  private createBuiltInWorkflow(taskType: string, config?: Partial<WorkflowConfig>): Workflow {
    const defaultConfig = createDefaultWorkflowConfig(config);

    switch (taskType) {
      case "concurrent":
        return new ConcurrentWorkflow([], defaultConfig);
      case "pipeline":
        return new PipelineWorkflow([], defaultConfig);
      case "iterative":
        return new IterativeWorkflow({ maxIterations: 1, ...defaultConfig }, []);
      default:
        return new ConcurrentWorkflow([], defaultConfig);
    }
  }

  registerWorkflow(type: string, workflowClass: WorkflowClass): void {
    this.registry.register(type, workflowClass);
  }

  async execute(task: OrchestrationTask): Promise<WorkflowResult> {
    const classification = this.classifier.classify({
      explicitType: task.type,
      message: task.message,
    });

    const workflowType = classification.type;
    let workflow: Workflow;

    if (task.type === "iterative" || workflowType === "iterative") {
      const iterativeConfig: IterativeWorkflowConfig = {
        ...createDefaultWorkflowConfig(task.config),
        maxIterations: task.iterativeConfig?.maxIterations ?? 3,
        stopOnSuccess: task.iterativeConfig?.stopOnSuccess ?? false,
        until: task.iterativeConfig?.until,
      };
      workflow = new IterativeWorkflow(iterativeConfig, task.tasks);
    } else if (task.type === "pipeline" || workflowType === "pipeline") {
      workflow = new PipelineWorkflow(task.tasks, task.config);
    } else {
      workflow = new ConcurrentWorkflow(task.tasks, task.config);
    }

    const mockContext: TaskContext = {
      sessionKey: task.id,
      namespace: `workflow.${task.id}`,
      sharedStore: {
        get: async () => undefined,
        set: async () => {},
        delete: async () => {},
        list: async () => [],
        subscribe: () => () => {},
        broadcast: async () => {},
      } as never,
      eventBus: {
        publish: () => {},
        subscribe: () => () => {},
      } as never,
      swarmController: {
        subscribe: () => () => {},
        trackTask: () => {},
        completeTask: () => {},
        failTask: () => {},
      } as never,
      config: createDefaultWorkflowConfig(task.config),
    };

    return workflow.execute(mockContext);
  }

  getRegisteredTypes(): string[] {
    return this.registry.list();
  }
}

let globalOrchestrator: Orchestrator | null = null;

export function getGlobalOrchestrator(): Orchestrator {
  if (!globalOrchestrator) {
    globalOrchestrator = new Orchestrator();
  }
  return globalOrchestrator;
}

export function resetGlobalOrchestrator(): void {
  globalOrchestrator = null;
}
