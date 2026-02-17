import type { Task } from "./workflow.js";

export class TaskGraph<T = unknown> {
  private tasks: Map<string, Task<T>> = new Map();
  private adjacencyList: Map<string, Set<string>> = new Map();
  private reverseList: Map<string, Set<string>> = new Map();

  addTask(task: Task<T>): void {
    if (this.tasks.has(task.id)) {
      throw new Error(`Task ${task.id} already exists`);
    }
    this.tasks.set(task.id, task);
    this.adjacencyList.set(task.id, new Set(task.dependencies));

    for (const dep of task.dependencies) {
      if (!this.reverseList.has(dep)) {
        this.reverseList.set(dep, new Set());
      }
      this.reverseList.get(dep)!.add(task.id);
    }
  }

  addDependency(taskId: string, dependsOn: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    if (!this.tasks.has(dependsOn)) {
      throw new Error(`Dependency ${dependsOn} not found`);
    }

    task.dependencies.push(dependsOn);
    this.adjacencyList.get(taskId)!.add(dependsOn);

    if (!this.reverseList.has(dependsOn)) {
      this.reverseList.set(dependsOn, new Set());
    }
    this.reverseList.get(dependsOn)!.add(taskId);
  }

  detectCycles(): string[] | null {
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const path: string[] = [];

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recStack.add(nodeId);
      path.push(nodeId);

      for (const dep of this.adjacencyList.get(nodeId) ?? []) {
        if (!visited.has(dep)) {
          if (dfs(dep)) {
            return true;
          }
        } else if (recStack.has(dep)) {
          path.push(dep);
          return true;
        }
      }

      path.pop();
      recStack.delete(nodeId);
      return false;
    };

    for (const taskId of this.tasks.keys()) {
      if (!visited.has(taskId)) {
        if (dfs(taskId)) {
          return [...path];
        }
      }
    }
    return null;
  }

  getExecutionOrder(): string[] {
    const cycle = this.detectCycles();
    if (cycle) {
      throw new Error(`Cannot compute execution order: cycle detected ${cycle.join(" -> ")}`);
    }

    const inDegree = new Map<string, number>();
    const result: string[] = [];
    const queue: string[] = [];

    for (const [taskId, deps] of this.adjacencyList) {
      inDegree.set(taskId, deps.size);
    }

    for (const [taskId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(taskId);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      for (const dependent of this.reverseList.get(current) ?? []) {
        const newDegree = (inDegree.get(dependent) ?? 1) - 1;
        inDegree.set(dependent, newDegree);
        if (newDegree === 0) {
          queue.push(dependent);
        }
      }
    }

    if (result.length !== this.tasks.size) {
      throw new Error("Circular dependency detected during topological sort");
    }

    return result;
  }

  getReadyTasks(completed: Set<string>): string[] {
    const ready: string[] = [];
    for (const [taskId, deps] of this.adjacencyList) {
      if (completed.has(taskId)) {
        continue;
      }
      if ([...deps].every((dep) => completed.has(dep))) {
        ready.push(taskId);
      }
    }
    return ready;
  }

  getTask(taskId: string): Task<T> | undefined {
    return this.tasks.get(taskId);
  }

  getAllTasks(): Task<T>[] {
    return Array.from(this.tasks.values());
  }

  getTaskCount(): number {
    return this.tasks.size;
  }

  clear(): void {
    this.tasks.clear();
    this.adjacencyList.clear();
    this.reverseList.clear();
  }
}
