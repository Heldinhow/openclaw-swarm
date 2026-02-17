/**
 * Orchestration Module - EventBus System
 * 
 * Provides centralized event management for OpenClaw Swarm.
 * Includes EventBus, EventLog, SwarmController, and EventStreamer.
 */

// EventBus
export {
  EventBus,
  EventType,
  EventStatus,
  type SwarmEvent,
  type EventHandler,
  getGlobalEventBus,
  resetGlobalEventBus,
} from "./event-bus.js";

// EventLog
export {
  EventLog,
  type EventQuery,
  type PaginationOptions,
  getGlobalEventLog,
  resetGlobalEventLog,
} from "./event-log.js";

// SwarmController
export {
  SwarmController,
  getGlobalSwarmController,
  resetGlobalSwarmController,
} from "./swarm-controller.js";

// EventStreamer
export {
  EventStreamer,
  type StreamConfig,
  type WebSocketAdapter,
  getGlobalEventStreamer,
  resetGlobalEventStreamer,
} from "./event-streamer.js";

// Existing orchestration exports
export {
  extractSessionContext,
  type ContextSharingMode,
  type ExtractContextOptions,
  type ExtractedContext,
} from "./context-bridge.js";

export {
  configureOrchestratorEventHandler,
  initOrchestratorEventHandler,
  getTaskCompletion,
  getCheckpoint,
  listCheckpoints,
  getTaskErrors,
} from "./event-handler.js";

export {
  SharedContextStore,
  type StoredValue,
  type SubscribeCallback,
  getSharedContextStore,
  resetSharedContextStore,
} from "./shared-context-store.js";

// Workflow Patterns
export {
  Workflow,
  WorkflowTask,
  WorkflowConfig,
  WorkflowResult,
  WorkflowContext,
  DEFAULT_WORKFLOW_CONFIG,
  createWorkflowContext,
} from "./workflow.js";

export {
  TaskGraph,
  createTaskGraph,
  getTopologicalOrder,
  getReadyTasks,
  hasCycles,
} from "./task-graph.js";

export { ConcurrentWorkflow } from "./concurrent-workflow.js";
export { PipelineWorkflow } from "./pipeline-workflow.js";
export { IterativeWorkflow } from "./iterative-workflow.js";

export {
  TaskTypeClassifier,
  classifyTaskType,
  defaultClassifier,
} from "./task-type-classifier.js";

export {
  WorkflowRegistry,
  globalWorkflowRegistry,
} from "./workflow-registry.js";

export {
  Orchestrator,
  createOrchestrator,
} from "./orchestrator.js";
