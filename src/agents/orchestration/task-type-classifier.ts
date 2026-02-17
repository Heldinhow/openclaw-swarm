import type { WorkflowTask } from "./workflow.js";

export type TaskType = "research" | "refactor" | "coding" | "unknown";

const RESEARCH_KEYWORDS = [
  "search", "find", "investigate", "analyze", "explore", "discover",
  "lookup", "query", "research", "gather", "inspect", "review",
];

const REFACTOR_KEYWORDS = [
  "refactor", "restructure", "improve", "optimize", "clean", "reorganize",
  "simplify", "modernize", "upgrade", "migrate", "consolidate",
];

const CODING_KEYWORDS = [
  "write", "implement", "create", "build", "develop", "make", "add",
  "new", "feature", "function", "class", "module", "component",
];

export class TaskTypeClassifier {
  classify(task: WorkflowTask | string): TaskType {
    const text = typeof task === "string" ? task : this.extractText(task);

    const lowerText = text.toLowerCase();

    if (this.matches(lowerText, RESEARCH_KEYWORDS)) {
      return "research";
    }

    if (this.matches(lowerText, REFACTOR_KEYWORDS)) {
      return "refactor";
    }

    if (this.matches(lowerText, CODING_KEYWORDS)) {
      return "coding";
    }

    return "unknown";
  }

  private extractText(task: WorkflowTask): string {
    const parts: string[] = [];

    if (task.id) {parts.push(task.id);}
    if (task.payload) {
      const payloadStr = JSON.stringify(task.payload);
      parts.push(payloadStr);
    }

    return parts.join(" ");
  }

  private matches(text: string, keywords: string[]): boolean {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return true;
      }
    }
    return false;
  }

  classifyMultiple(tasks: WorkflowTask[]): Map<string, TaskType> {
    const results = new Map<string, TaskType>();

    for (const task of tasks) {
      results.set(task.id, this.classify(task));
    }

    return results;
  }
}

export function classifyTaskType(task: WorkflowTask | string): TaskType {
  const classifier = new TaskTypeClassifier();
  return classifier.classify(task);
}
