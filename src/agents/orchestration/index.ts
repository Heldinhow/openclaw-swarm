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

// Workflow types and classes
export {
  type Workflow,
  type WorkflowConfig,
  type WorkflowResult,
  type WorkflowTimings,
  type WorkflowMetadata,
  type WorkflowType,
  type Task,
  type TaskContext,
  type TaskHandler,
  DEFAULT_WORKFLOW_CONFIG,
  createDefaultWorkflowConfig,
  createWorkflowResult,
} from "./workflow.js";

export { TaskGraph as TaskGraphClass } from "./task-graph.js";

export { ConcurrentWorkflow } from "./concurrent-workflow.js";

export { PipelineWorkflow } from "./pipeline-workflow.js";

export { IterativeWorkflow, type IterativeWorkflowConfig } from "./iterative-workflow.js";

export {
  TaskTypeClassifier,
  type ClassificationResult,
  type ClassificationInput,
} from "./task-type-classifier.js";

export {
  WorkflowRegistry,
  type WorkflowClass,
  getGlobalWorkflowRegistry,
  resetGlobalWorkflowRegistry,
} from "./workflow-registry.js";

export {
  Orchestrator,
  type OrchestratorConfig,
  type OrchestrationTask,
  getGlobalOrchestrator,
  resetGlobalOrchestrator,
} from "./orchestrator.js";
