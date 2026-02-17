import type { Workflow, WorkflowConfig } from "./workflow.js";

export type WorkflowClass = new (config: WorkflowConfig) => Workflow;

export class WorkflowRegistry {
  private registries = new Map<string, WorkflowClass>();

  register(type: string, workflowClass: WorkflowClass): void {
    if (this.registries.has(type)) {
      console.warn(`[WorkflowRegistry] Overriding existing workflow type: ${type}`);
    }
    this.registries.set(type, workflowClass);
  }

  get(type: string): WorkflowClass | undefined {
    return this.registries.get(type);
  }

  has(type: string): boolean {
    return this.registries.has(type);
  }

  list(): string[] {
    return Array.from(this.registries.keys());
  }

  clear(): void {
    this.registries.clear();
  }
}

let globalRegistry: WorkflowRegistry | null = null;

export function getGlobalWorkflowRegistry(): WorkflowRegistry {
  if (!globalRegistry) {
    globalRegistry = new WorkflowRegistry();
  }
  return globalRegistry;
}

export function resetGlobalWorkflowRegistry(): void {
  globalRegistry = null;
}
