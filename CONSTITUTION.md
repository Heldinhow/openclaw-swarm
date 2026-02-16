# Constitution - OpenClaw Orchestration Fork

## Project Principles

### 1. Context Sharing (Contexto Compartilhado)
- Subagents must have access to the orchestrator's context (session state, memory, tools)
- Context propagation must be bidirectional: orchestrator → subagent and subagent → orchestrator
- Subagents must be able to share context with each other without going through the orchestrator

### 2. Parallel Execution (Execução Paralela)
- Multiple subagents should be able to run concurrently
- The orchestrator must coordinate parallel tasks without blocking
- Support for fan-out/fan-in patterns: spawn multiple subagents, then aggregate results

### 3. Isolation with Communication (Isolamento com Comunicação)
- Each subagent runs in its own session/isolation context
- Communication channels must exist between subagents
- Shared state should be explicit and controllable

### 4. Backward Compatibility
- Existing subagent commands (/subagents, /kill, /steer, /tell) must continue to work
- Current registry and session management should be extended, not replaced

### 5. Observability
- Clear visibility into subagent relationships (parent-child, sibling)
- Logging and tracing must show context flow between agents

## Non-Goals
- Replacing the entire agent architecture
- Breaking existing APIs or command interfaces
- Implementing complex multi-agent consensus algorithms
