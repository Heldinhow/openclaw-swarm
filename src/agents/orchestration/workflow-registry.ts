import type { Workflow } from "./workflow.js";

export type WorkflowType = "concurrent" | "pipeline" | "iterative" | "custom";

export interface WorkflowConstructor {
  new (...args: unknown[]): Workflow;
}

export class WorkflowRegistry {
  private workflows: Map<WorkflowType, WorkflowConstructor> = new Map();

  register(type: WorkflowType, constructor: WorkflowConstructor): void {
    if (this.workflows.has(type)) {
      throw new Error(`Workflow type "${type}" is already registered`);
    }
    this.workflows.set(type, constructor);
  }

  unregister(type: WorkflowType): void {
    this.workflows.delete(type);
  }

  get(type: WorkflowType): WorkflowConstructor | undefined {
    return this.workflows.get(type);
  }

  has(type: WorkflowType): boolean {
    return this.workflows.has(type);
  }

  list(): WorkflowType[] {
    return Array.from(this.workflows.keys());
  }

  clear(): void {
    this.workflows.clear();
  }
}

export const globalWorkflowRegistry = new WorkflowRegistry();
