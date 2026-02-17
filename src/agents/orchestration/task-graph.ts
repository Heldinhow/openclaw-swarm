import type { WorkflowTask } from "./workflow.js";

export interface TaskNode {
  id: string;
  task: WorkflowTask;
  status: "pending" | "running" | "completed" | "failed";
  result?: unknown;
  error?: Error;
}

export interface GraphEdge {
  from: string;
  to: string;
}

export interface TaskGraph {
  vertices: Map<string, TaskNode>;
  edges: GraphEdge[];
  adjacencyList: Map<string, string[]>;
  reverseAdjacencyList: Map<string, string[]>;
}

export function createTaskGraph(tasks: WorkflowTask[]): TaskGraph {
  const vertices = new Map<string, TaskNode>();
  const adjacencyList = new Map<string, string[]>();
  const reverseAdjacencyList = new Map<string, string[]>();
  const edges: GraphEdge[] = [];

  for (const task of tasks) {
    vertices.set(task.id, {
      id: task.id,
      task,
      status: "pending",
    });
    adjacencyList.set(task.id, []);
    reverseAdjacencyList.set(task.id, []);
  }

  for (const task of tasks) {
    if (task.dependencies) {
      for (const depId of task.dependencies) {
        if (!vertices.has(depId)) {
          throw new Error(`Dependency ${depId} not found for task ${task.id}`);
        }
        edges.push({ from: depId, to: task.id });
        adjacencyList.get(depId)!.push(task.id);
        reverseAdjacencyList.get(task.id)!.push(depId);
      }
    }
  }

  return { vertices, edges, adjacencyList, reverseAdjacencyList };
}

export function getTopologicalOrder(graph: TaskGraph): string[][] {
  const inDegree = new Map<string, number>();
  const result: string[][] = [];
  const visited = new Set<string>();

  for (const nodeId of graph.vertices.keys()) {
    inDegree.set(nodeId, graph.reverseAdjacencyList.get(nodeId)?.length ?? 0);
  }

  while (visited.size < graph.vertices.size) {
    const currentBatch: string[] = [];

    for (const [nodeId, degree] of inDegree) {
      if (degree === 0 && !visited.has(nodeId)) {
        currentBatch.push(nodeId);
      }
    }

    if (currentBatch.length === 0 && visited.size < graph.vertices.size) {
      throw new Error("Cycle detected in task graph");
    }

    for (const nodeId of currentBatch) {
      visited.add(nodeId);
      const neighbors = graph.adjacencyList.get(nodeId) ?? [];
      for (const neighbor of neighbors) {
        inDegree.set(neighbor, (inDegree.get(neighbor) ?? 1) - 1);
      }
    }

    if (currentBatch.length > 0) {
      result.push(currentBatch);
    }
  }

  return result;
}

export function getReadyTasks(
  graph: TaskGraph,
  completedTasks: Set<string>
): string[] {
  const ready: string[] = [];

  for (const [nodeId, deps] of graph.reverseAdjacencyList) {
    if (completedTasks.has(nodeId)) {continue;}

    const allDepsCompleted = deps.every((depId) => completedTasks.has(depId));
    if (allDepsCompleted) {
      ready.push(nodeId);
    }
  }

  return ready;
}

export function hasCycles(graph: TaskGraph): boolean {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(nodeId: string): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const neighbors = graph.adjacencyList.get(nodeId) ?? [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) {return true;}
      } else if (recursionStack.has(neighbor)) {
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  for (const nodeId of graph.vertices.keys()) {
    if (!visited.has(nodeId)) {
      if (dfs(nodeId)) {return true;}
    }
  }

  return false;
}

export function getParallelizableTasks(
  graph: TaskGraph,
  completedTasks: Set<string>
): string[] {
  return getReadyTasks(graph, completedTasks);
}
