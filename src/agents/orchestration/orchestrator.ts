import type { Workflow, WorkflowTask, WorkflowConfig, WorkflowContext, WorkflowResult } from "./workflow.js";
import { DEFAULT_WORKFLOW_CONFIG } from "./workflow.js";
import { ConcurrentWorkflow } from "./concurrent-workflow.js";
import { PipelineWorkflow } from "./pipeline-workflow.js";
import { IterativeWorkflow } from "./iterative-workflow.js";
import { TaskTypeClassifier, classifyTaskType } from "./task-type-classifier.js";
import { WorkflowRegistry, globalWorkflowRegistry } from "./workflow-registry.js";

export type WorkflowSelector = (tasks: WorkflowTask[]) => string;

const TASK_TYPE_TO_WORKFLOW: Record<string, string> = {
  research: "concurrent",
  refactor: "pipeline",
  coding: "iterative",
};

export class Orchestrator {
  private config: WorkflowConfig;
  private classifier: TaskTypeClassifier;
  private registry: WorkflowRegistry;
  private customSelector?: WorkflowSelector;

  constructor(
    config: Partial<WorkflowConfig> = {},
    classifier?: TaskTypeClassifier,
    registry?: WorkflowRegistry
  ) {
    this.config = { ...DEFAULT_WORKFLOW_CONFIG, ...config };
    this.classifier = classifier ?? new TaskTypeClassifier();
    this.registry = registry ?? globalWorkflowRegistry;
    this.registerDefaultWorkflows();
  }

  private registerDefaultWorkflows(): void {
    this.registry.register("concurrent", ConcurrentWorkflow as any);
    this.registry.register("pipeline", PipelineWorkflow as any);
    this.registry.register("iterative", IterativeWorkflow as any);
  }

  setSelector(selector: WorkflowSelector): void {
    this.customSelector = selector;
  }

  selectWorkflow(tasks: WorkflowTask[]): string {
    if (this.customSelector) {
      return this.customSelector(tasks);
    }

    const taskTypes = tasks.map((t) => this.classifier.classify(t));
    const typeCounts = new Map<string, number>();

    for (const type of taskTypes) {
      typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
    }

    const dominantType = Array.from(typeCounts.entries()).toSorted((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";
    return TASK_TYPE_TO_WORKFLOW[dominantType] ?? "concurrent";
  }

  async execute(
    tasks: WorkflowTask[],
    executor: (task: WorkflowTask) => Promise<unknown>
  ): Promise<WorkflowResult> {
    const workflowType = this.selectWorkflow(tasks);
    const workflowConstructor = this.registry.get(workflowType as any);

    if (!workflowConstructor) {
      throw new Error(`No workflow registered for type: ${workflowType}`);
    }

    const context: WorkflowContext = {
      workflowId: `workflow-${Date.now()}`,
      tasks,
      config: this.config,
      results: new Map(),
      errors: new Map(),
      startTime: Date.now(),
    };

    const workflow = new workflowConstructor();
    return await workflow.execute(context);
  }

  async executeWithType(
    workflowType: string,
    tasks: WorkflowTask[],
    executor: (task: WorkflowTask) => Promise<unknown>
  ): Promise<WorkflowResult> {
    const workflowConstructor = this.registry.get(workflowType as any);

    if (!workflowConstructor) {
      throw new Error(`No workflow registered for type: ${workflowType}`);
    }

    const context: WorkflowContext = {
      workflowId: `workflow-${Date.now()}`,
      tasks,
      config: this.config,
      results: new Map(),
      errors: new Map(),
      startTime: Date.now(),
    };

    const workflow = new workflowConstructor();
    return await workflow.execute(context);
  }
}

export { TaskTypeClassifier, classifyTaskType, WorkflowRegistry, ConcurrentWorkflow, PipelineWorkflow, IterativeWorkflow };
