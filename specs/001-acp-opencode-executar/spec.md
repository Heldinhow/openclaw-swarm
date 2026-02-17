# Feature Specification: ACP Support for OpenCodeExecutar

**Feature Branch**: `001-acp-opencode-executar`  
**Created**: 2026-02-17  
**Status**: Draft  
**Input**: User description: "use o OpenCodeExecutar com o https://opencode.ai/docs/pt-br/acp/ ACP"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Execute Commands via ACP Protocol (Priority: P1)

As a developer using ACP-compatible editors (Zed, JetBrains, Neovim), I want to use OpenCodeExecutar as an ACP agent so I can execute code and commands directly from my editor without switching contexts.

**Why this priority**: This is the core value proposition - enabling OpenCodeExecutar to work as an ACP agent allows seamless integration with popular editors, reducing context switching and improving developer workflow efficiency.

**Independent Test**: Can be fully tested by configuring an ACP-compatible editor (e.g., Zed) to use OpenCodeExecutar as an agent, sending a command, and receiving execution results through the ACP protocol.

**Acceptance Scenarios**:

1. **Given** OpenCodeExecutar is configured as an ACP agent in Zed, **When** the user sends a command through the editor's AI assistant, **Then** OpenCodeExecutar executes the command and returns results via ACP JSON-RPC
2. **Given** A JetBrains IDE is configured with OpenCodeExecutar as an ACP agent, **When** the user requests code execution, **Then** the execution output is displayed in the IDE's AI chat interface
3. **Given** Neovim with Avante.nvim is configured with OpenCodeExecutar, **When** a file operation command is sent, **Then** the file is modified and the result is communicated back through stdio

---

### User Story 2 - Support Standard ACP Operations (Priority: P2)

As a developer, I want OpenCodeExecutar to support all standard ACP operations (file operations, terminal commands, tool execution) so I can perform any development task through my editor.

**Why this priority**: Supporting the full range of ACP capabilities ensures feature parity with the terminal experience and makes OpenCodeExecutar a viable replacement for other ACP agents.

**Independent Test**: Can be tested by executing each category of operation (file read/write, terminal commands, tool calls) through an ACP client and verifying correct behavior.

**Acceptance Scenarios**:

1. **Given** an ACP session is active, **When** the agent requests to read a file, **Then** the file contents are returned via ACP protocol
2. **Given** an ACP session is active, **When** the agent executes a terminal command, **Then** the command output and exit code are returned
3. **Given** an ACP session is active, **When** custom tools are invoked, **Then** they execute and return results through the ACP interface

---

### User Story 3 - Environment and Configuration Support (Priority: P3)

As a developer, I want to pass environment variables and configuration to OpenCodeExecutar through ACP so I can use API keys and custom settings securely.

**Why this priority**: Environment configuration is essential for real-world usage (API keys, custom settings), but can be worked around initially with configuration files.

**Independent Test**: Can be tested by configuring environment variables in the ACP client setup and verifying they are accessible during command execution.

**Acceptance Scenarios**:

1. **Given** environment variables are configured in the ACP client settings, **When** OpenCodeExecutar starts, **Then** those variables are available to the execution context
2. **Given** custom configuration is needed, **When** the agent initializes, **Then** it respects the AGENTS.md rules and project-specific settings

---

### Edge Cases

- What happens when the ACP client disconnects unexpectedly during execution?
- How does the system handle malformed JSON-RPC messages from the ACP client?
- What happens when a long-running command exceeds timeout limits?
- How are errors in tool execution communicated back through ACP?
- What happens when multiple concurrent requests are sent through ACP?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST implement ACP protocol communication via JSON-RPC over stdio
- **FR-002**: System MUST expose an `acp` command that starts the ACP-compatible subprocess
- **FR-003**: System MUST support all built-in OpenCodeExecutar tools through ACP (file operations, terminal commands)
- **FR-004**: System MUST handle ACP lifecycle events (initialization, heartbeat, termination)
- **FR-005**: System MUST return execution results in ACP-compliant format
- **FR-006**: System MUST support custom tools and MCP servers configured in OpenCodeExecutar settings
- **FR-007**: System MUST respect AGENTS.md rules when executing commands via ACP
- **FR-008**: System MUST support environment variable injection from ACP client configuration
- **FR-009**: System MUST provide clear error messages when ACP communication fails
- **FR-010**: System MUST handle concurrent ACP requests safely

### Key Entities *(include if feature involves data)*

- **ACP Session**: Represents an active ACP connection, including client info, environment variables, and session state
- **ACP Request**: JSON-RPC message containing operation type (tool call, file operation, etc.), parameters, and request ID
- **ACP Response**: JSON-RPC response containing result data, error information, or status updates
- **Tool Registry**: Collection of available tools that can be invoked through ACP (file operations, terminal, custom tools)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can successfully configure OpenCodeExecutar as an ACP agent in Zed, JetBrains IDEs, and Neovim within 5 minutes
- **SC-002**: 95% of standard OpenCodeExecutar operations (file read/write, terminal commands) work through ACP with identical results to terminal usage
- **SC-003**: ACP session initialization completes in under 2 seconds
- **SC-004**: Tool execution results are returned through ACP within 5 seconds for 90% of operations
- **SC-005**: Zero data loss when ACP client disconnects during active operations
- **SC-006**: Support for at least 3 major ACP-compatible editors (Zed, JetBrains, Neovim)

## Assumptions

- Users have OpenCodeExecutar installed and accessible in their system PATH
- ACP-compatible editors support the standard ACP protocol as defined at agentclientprotocol.com
- Environment variables needed for API access (e.g., OPENCODE_API_KEY) are configured in the editor's ACP settings or available in the shell environment
- The stdio communication channel between editor and OpenCodeExecutar is reliable (no network-related failures)
