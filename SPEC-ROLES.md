# Role-Based Agent System Specification

## Overview

This specification defines a Role-Based Agent system for openclaw-swarm that enables specialized agent spawning based on JSON-defined roles. Each role has distinct capabilities, tool access, execution strategies, memory scopes, and skill references.

## Scope

This specification covers:

1. **roles.json Schema** - JSON-based role configuration
2. **Skill Reference System** - Dynamic skill loading for role-based agents
3. **Dynamic Role Registry** - Runtime role loading (no hardcoded enum)
4. **SwarmController Integration** - Role-based agent spawning
5. **RoleResolver** - Automatic role selection mechanism
6. **Schema Validation** - JSON validation at runtime

---

## 1. JSON-Based Role Configuration (PRIMARY)

Roles are defined entirely in JSON and loaded at runtime. No hardcoded enums.

### roles.json Schema

```json
{
  "$schema": "https://openclaw.dev/schemas/roles.json",
  "version": "1.0.0",
  "roles": {
    "ARCHITECT": {
      "name": "System Architect",
      "description": "Architectural design and technology selection specialist",
      "capabilities": [
        "system_design",
        "technology_selection",
        "component_decomposition",
        "performance_planning",
        "security_assessment"
      ],
      "allowed_tools": [
        "read",
        "exec",
        "context_store",
        "context_publish"
      ],
      "execution_strategy": {
        "timeout": 300000,
        "retry": 3,
        "model": "minimax-m2.5",
        "requires_approval": true,
        "parallel_friendly": false,
        "priority": 1
      },
      "memory_scope": {
        "context_window": "project",
        "include_history": true,
        "max_tokens": 100000
      },
      "skill": "architect-skill"
    },
    "BACKEND_ENGINEER": {
      "name": "Backend Engineer",
      "description": "Server-side code and API implementation specialist",
      "capabilities": [
        "server_side_development",
        "api_design",
        "database_schema",
        "business_logic",
        "performance_optimization"
      ],
      "allowed_tools": [
        "read",
        "write",
        "exec",
        "context_store",
        "context_publish"
      ],
      "execution_strategy": {
        "timeout": 180000,
        "retry": 2,
        "model": "opencode/minimax-m2.1-free",
        "requires_approval": false,
        "parallel_friendly": true,
        "priority": 5
      },
      "memory_scope": {
        "context_window": "module",
        "include_history": true,
        "max_tokens": 50000
      },
      "skill": "dotnet-expert"
    },
    "FRONTEND_ENGINEER": {
      "name": "Frontend Engineer",
      "description": "User interface and component development specialist",
      "capabilities": [
        "ui_implementation",
        "component_development",
        "state_management",
        "styling_theming",
        "client_validation"
      ],
      "allowed_tools": [
        "read",
        "write",
        "exec",
        "context_store",
        "context_publish"
      ],
      "execution_strategy": {
        "timeout": 180000,
        "retry": 2,
        "model": "opencode/minimax-m2.1-free",
        "requires_approval": false,
        "parallel_friendly": true,
        "priority": 5
      },
      "memory_scope": {
        "context_window": "module",
        "include_history": true,
        "max_tokens": 50000
      },
      "skill": "frontend-patterns"
    },
    "TEST_ENGINEER": {
      "name": "Test Engineer",
      "description": "Test creation and quality assurance specialist",
      "capabilities": [
        "unit_test_creation",
        "integration_test_design",
        "e2e_test_specification",
        "coverage_analysis",
        "bug_reproduction"
      ],
      "allowed_tools": [
        "read",
        "write",
        "exec",
        "context_store",
        "context_publish"
      ],
      "execution_strategy": {
        "timeout": 240000,
        "retry": 2,
        "model": "opencode/kimi-k2.5-free",
        "requires_approval": false,
        "parallel_friendly": true,
        "priority": 4
      },
      "memory_scope": {
        "context_window": "feature",
        "include_history": true,
        "max_tokens": 40000
      },
      "skill": "test-patterns"
    },
    "REVIEW_AGENT": {
      "name": "Code Review Agent",
      "description": "Code review and quality assurance specialist",
      "capabilities": [
        "code_review",
        "best_practice_enforcement",
        "security_detection",
        "performance_identification",
        "documentation_verification"
      ],
      "allowed_tools": [
        "read",
        "exec",
        "context_store",
        "context_publish"
      ],
      "execution_strategy": {
        "timeout": 120000,
        "retry": 1,
        "model": "minimax-m2.5",
        "requires_approval": false,
        "parallel_friendly": true,
        "priority": 6
      },
      "memory_scope": {
        "context_window": "feature",
        "include_history": false,
        "max_tokens": 30000
      },
      "skill": "pr-reviewer"
    },
    "REFACTOR_AGENT": {
      "name": "Refactor Agent",
      "description": "Code quality improvement specialist",
      "capabilities": [
        "code_quality",
        "pattern_application",
        "dead_code_elimination",
        "dependency_management",
        "technical_debt_reduction"
      ],
      "allowed_tools": [
        "read",
        "write",
        "exec",
        "context_store",
        "context_publish"
      ],
      "execution_strategy": {
        "timeout": 300000,
        "retry": 1,
        "model": "opencode/minimax-m2.1-free",
        "requires_approval": true,
        "parallel_friendly": false,
        "priority": 3
      },
      "memory_scope": {
        "context_window": "module",
        "include_history": true,
        "max_tokens": 60000
      },
      "skill": "refactor-patterns"
    }
  },
  "inheritance": {
    "extends": {
      "SENIOR_BACKEND_ENGINEER": {
        "base": "BACKEND_ENGINEER",
        "overrides": {
          "capabilities": ["+senior_architecture", "+mentoring"],
          "execution_strategy": {
            "timeout": 360000,
            "priority": 7
          }
        }
      }
    }
  }
}
```

### Schema Definition (roles.schema.json)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["version", "roles"],
  "properties": {
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$"
    },
    "roles": {
      "type": "object",
      "patternProperties": {
        "^[A-Z_]+$": {
          "type": "object",
          "required": ["name", "description", "capabilities", "allowed_tools", "execution_strategy", "memory_scope"],
          "properties": {
            "name": { "type": "string" },
            "description": { "type": "string" },
            "capabilities": {
              "type": "array",
              "items": { "type": "string" }
            },
            "allowed_tools": {
              "type": "array",
              "items": { "type": "string", "enum":write", "edit ["read", "", "exec", "context_store", "context_publish", "subagents", "parallel_spawn", "browser", "web_search", "web_fetch", "message", "tts", "image", "nodes"] }
            },
            "execution_strategy": {
              "type": "object",
              "required": ["timeout", "model"],
              "properties": {
                "timeout": { "type": "number", "minimum": 60000 },
                "retry": { "type": "number", "minimum": 0, "maximum": 10 },
                "model": { "type": "string" },
                "requires_approval": { "type": "boolean" },
                "parallel_friendly": { "type": "boolean" },
                "priority": { "type": "number", "minimum": 1, "maximum": 10 }
              }
            },
            "memory_scope": {
              "type": "object",
              "properties": {
                "context_window": { "type": "string", "enum": ["feature", "module", "project"] },
                "include_history": { "type": "boolean" },
                "max_tokens": { "type": "number" }
              }
            },
            "skill": { "type": "string" }
          }
        }
      }
    },
    "inheritance": {
      "type": "object",
      "properties": {
        "extends": {
          "type": "object",
          "patternProperties": {
            "^[A-Z_]+$": {
              "type": "object",
              "required": ["base"],
              "properties": {
                "base": { "type": "string" },
                "overrides": {
                  "type": "object",
                  "properties": {
                    "capabilities": { "type": "array", "items": { "type": "string" } },
                    "execution_strategy": { "type": "object" }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

---

## 2. Skill Reference System

Each role can reference a skill that provides specialized context and tools.

### Skill Loading Architecture

```typescript
interface SkillReference {
  skill: string;           // e.g., "dotnet-expert", "test-patterns"
  autoLoad: boolean;       // Load skill when spawning role
  priority: number;        // Skill priority (higher = more important)
}

interface SkillLoader {
  /**
   * Load skill by name from skills directory
   */
  load(skillName: string): Promise<SkillContext>;
  
  /**
   * Load multiple skills and merge contexts
   */
  loadMultiple(skills: string[]): Promise<SkillContext>;
  
  /**
   * Check if skill exists
   */
  exists(skillName: string): boolean;
  
  /**
   * List available skills
   */
  listAvailable(): string[];
}

interface SkillContext {
  name: string;
  description: string;
  tools: string[];           // Additional tools this skill provides
  prompts: Record<string, string>;  // Role-specific prompts
  context: Record<string, any>;      // Skill-specific context
  files?: string[];          // Files to load into context
}
```

### Skill Directory Structure

```
skills/
├── dotnet-expert/
│   ├── SKILL.md           # Skill definition
│   └── prompts/
│       └── implementation.md
├── test-patterns/
│   ├── SKILL.md
│   └── patterns/
│       └── tdd.md
├── architect-skill/
│   ├── SKILL.md
│   └── templates/
│       └── architecture.md
└── pr-reviewer/
    ├── SKILL.md
    └── rules/
        └── review-criteria.md
```

### SwarmController Skill Integration

```typescript
class SwarmController {
  private roleRegistry: RoleRegistry;
  private skillLoader: SkillLoader;
  
  /**
   * Spawn agent with role-based configuration and skill
   */
  async spawnWithRole(
    roleKey: string,      // Dynamic key, not enum
    task: TaskInput,
    options?: SpawnOptions
  ): Promise<AgentHandle> {
    // Load role configuration from JSON
    const roleConfig = this.roleRegistry.get(roleKey);
    
    // Load referenced skill if specified
    let skillContext: SkillContext | undefined;
    if (roleConfig.skill) {
      skillContext = await this.skillLoader.load(roleConfig.skill);
    }
    
    // Merge role config + skill context
    const agentConfig = this.buildAgentConfig(roleConfig, skillContext);
    
    // Spawn agent with merged configuration
    return this.spawn(agentConfig);
  }
  
  /**
   * Build agent configuration from role + skill
   */
  private buildAgentConfig(
    roleConfig: RoleConfiguration,
    skillContext?: SkillContext
  ): AgentConfig {
    return {
      // Role execution strategy
      timeout: roleConfig.execution_strategy.timeout,
      retry: roleConfig.execution_strategy.retry,
      model: roleConfig.execution_strategy.model,
      
      // Role allowed tools + skill tools
      allowedTools: [
        ...roleConfig.allowed_tools,
        ...(skillContext?.tools ?? [])
      ],
      
      // Capabilities from role + skill
      capabilities: [
        ...roleConfig.capabilities,
        ...(skillContext?.context?.capabilities ?? [])
      ],
      
      // Skill prompts take priority over role prompts
      prompts: {
        ...roleConfig.prompts,
        ...skillContext?.prompts
      },
      
      // Memory scope from role
      memoryScope: roleConfig.memory_scope
    };
  }
}
```

---

## 3. Dynamic Role Registry

No hardcoded enum. Roles loaded entirely from JSON at runtime.

### RoleRegistry Implementation

```typescript
interface RoleConfiguration {
  name: string;
  description: string;
  capabilities: string[];
  allowed_tools: string[];
  execution_strategy: ExecutionStrategy;
  memory_scope: MemoryScope;
  skill?: string;
}

interface ExecutionStrategy {
  timeout: number;
  retry: number;
  model: string;
  requires_approval?: boolean;
  parallel_friendly: boolean;
  priority: number;
}

interface MemoryScope {
  context_window: 'feature' | 'module' | 'project';
  include_history: boolean;
  max_tokens?: number;
}

class RoleRegistry {
  private roles: Map<string, RoleConfiguration> = new Map();
  private schema: object;
  
  /**
   * Load roles from JSON file
   */
  async loadFromFile(filePath: string): Promise<void> {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const config = JSON.parse(content);
    this.load(config);
  }
  
  /**
   * Load roles from JSON object
   */
  load(config: RolesConfig): void {
    // Validate against schema
    this.validate(config);
    
    // Process inheritance first
    this.processInheritance(config);
    
    // Register each role
    for (const [key, role] of Object.entries(config.roles)) {
      this.roles.set(key, role);
    }
  }
  
  /**
   * Process role inheritance/extension
   */
  private processInheritance(config: RolesConfig): void {
    if (!config.inheritance?.extends) return;
    
    for (const [derivedKey, inheritance] of Object.entries(config.inheritance.extends)) {
      const baseRole = config.roles[inheritance.base];
      if (!baseRole) {
        throw new Error(`Base role ${inheritance.base} not found for ${derivedKey}`);
      }
      
      // Deep clone base role
      const derived = JSON.parse(JSON.stringify(baseRole));
      
      // Apply overrides
      if (inheritance.overrides) {
        if (inheritance.overrides.capabilities) {
          // Handle "+capability" syntax for additions
          derived.capabilities = derived.capabilities.concat(
            inheritance.overrides.capabilities.filter((c: string) => !c.startsWith('+'))
          );
        }
        
        if (inheritance.overrides.execution_strategy) {
          derived.execution_strategy = {
            ...derived.execution_strategy,
            ...inheritance.overrides.execution_strategy
          };
        }
      }
      
      config.roles[derivedKey] = derived;
    }
  }
  
  /**
   * Get role configuration by key
   */
  get(roleKey: string): RoleConfiguration {
    const role = this.roles.get(roleKey.toUpperCase());
    if (!role) {
      throw new Error(`Role ${roleKey} not found. Available: ${this.list().join(', ')}`);
    }
    return role;
  }
  
  /**
   * List all registered roles
   */
  list(): string[] {
    return Array.from(this.roles.keys());
  }
  
  /**
   * Check if role exists
   */
  has(roleKey: string): boolean {
    return this.roles.has(roleKey.toUpperCase());
  }
  
  /**
   * Validate configuration against schema
   */
  private validate(config: any): void {
    const ajv = new AJV();
    const valid = ajv.validate(this.schema, config);
    if (!valid) {
      throw new Error(`Invalid roles configuration: ${ajv.errorsText()}`);
    }
  }
}
```

### Usage Example

```typescript
// Initialize registry
const registry = new RoleRegistry();
await registry.loadFromFile('./config/roles.json');

// Get role dynamically (no enum)
const architect = registry.get('ARCHITECT');

// List available roles
console.log(registry.list());
// ['ARCHITECT', 'BACKEND_ENGINEER', 'FRONTEND_ENGINEER', ...]

// Check role exists
if (registry.has('MOBILE_ENGINEER')) {
  // Mobile engineer role available
}
```

---

## 4. SwarmController Integration

### Role-Based Spawning

```typescript
interface SwarmController {
  /**
   * Spawn agent with specific role (dynamic key)
   */
  spawnWithRole(
    roleKey: string,           // Dynamic string, not enum
    task: TaskInput,
    overrides?: Partial<RoleConfiguration>
  ): Promise<AgentHandle>;
  
  /**
   * Spawn multiple agents with different roles
   */
  spawnRoleGroup(
    tasks: Array<{ roleKey: string; task: TaskInput }>
  ): Promise<AgentHandle[]>;
  
  /**
   * Get role configuration
   */
  getRoleConfig(roleKey: string): RoleConfiguration;
  
  /**
   * Register custom role at runtime
   */
  registerRole(key: string, config: RoleConfiguration): void;
  
  /**
   * Reload roles from JSON file
   */
  reloadRoles(filePath?: string): Promise<void>;
}
```

### Role Resolution Mechanism

```typescript
interface RoleResolver {
  /**
   * Resolve role from task description
   */
  resolveFromTask(task: string): string[];
  
  /**
   * Resolve role from file patterns
   */
  resolveFromFiles(files: string[]): string[];
  
  /**
   * Resolve role from context
   */
  resolveFromContext(context: TaskContext): string[];
  
  /**
   * Suggest roles for given input
   */
  suggestRoles(input: TaskInput): Array<{
    roleKey: string;
    confidence: number;
    reasoning: string;
  }>;
}
```

---

## 5. Configuration File Structure

```
src/
├── orchestration/
│   ├── roles/
│   │   ├── RoleRegistry.ts        # Dynamic role registry
│   │   ├── RoleResolver.ts       # Role resolution logic
│   │   ├── SkillLoader.ts         # Skill loading system
│   │   ├── index.ts               # Public API
│   │   └── types.ts               # TypeScript types
│   │
│   └── config/
│       ├── roles.json             # Role definitions (user-editable)
│       └── roles.schema.json      # JSON Schema for validation
│
├── skills/                        # Skill definitions
│   ├── dotnet-expert/
│   ├── test-patterns/
│   └── architect-skill/
│
├── Task.ts
├── TaskGraph.ts
├── SwarmController.ts
├── AgentLifecycleManager.ts
└── types.ts
```

---

## 6. Agent Statelessness

Agents maintain no persistent state between tasks except:

1. **Working Memory** - Task-specific context during execution
   - Current file being edited
   - Recent changes
   - Linter/compiler output

2. **Role Context** - Transient role-specific data (from JSON config)
   - Architecture decisions (ARCHITECT)
   - API contracts (BACKEND_ENGINEER)
   - Component library (FRONTEND_ENGINEER)
   - Test coverage (TEST_ENGINEER)

3. **Skill Context** - Dynamic skill-loaded context
   - Specialized prompts
   - Tool configurations
   - Pattern libraries

4. **Shared Context Store** - Explicitly shared data
   - Cross-agent results
   - Task dependencies
   - Configuration

No hardcoded prompts in the controller. Prompts are:
- Template-based with role parameters
- Loaded from skill files
- Customizable via JSON configuration

---

## 7. Requirements Summary

| Requirement | Implementation |
|-------------|----------------|
| **JSON-based roles** | `roles.json` loaded at runtime via `RoleRegistry.load()` |
| **Skill reference** | `skill` field in role config; `SkillLoader` loads on spawn |
| **Dynamic registry** | No enum; `registry.get(roleKey)` returns config |
| **Role inheritance** | `inheritance.extends` in JSON with base + overrides |
| **Schema validation** | AJV validates against `roles.schema.json` |
| **Extensible via JSON** | Add roles without code changes |

---

## 8. Migration from Enum Approach

### Before (Enum-based)

```typescript
export enum AgentRole {
  ARCHITECT = 'ARCHITECT',
  BACKEND_ENGINEER = 'BACKEND_ENGINEER',
}

const role = AgentRole.ARCHITECT;
swarm.spawnWithRole(role, task);
```

### After (JSON-based)

```typescript
// No enum - use string keys
const role = 'ARCHITECT';  // or load from config
swarm.spawnWithRole(role, task);

// Or use enum-like constant for documentation (optional)
const AgentRole = {
  ARCHITECT: 'ARCHITECT',
  BACKEND_ENGINEER: 'BACKEND_ENGINEER',
} as const;
```

---

## Acceptance Criteria

1. ✅ Roles defined entirely in JSON (roles.json)
2. ✅ RoleRegistry loads JSON at runtime (no hardcoded enum)
3. ✅ Each role defines: capabilities, allowed_tools, execution_strategy, memory_scope, skill
4. ✅ Skill referenced but not hardcoded in controller
5. ✅ SwarmController loads skill when spawning role-based agent
6. ✅ Schema validation for JSON configuration
7. ✅ Role inheritance/extension support in JSON
8. ✅ Extensible via JSON (add roles without code changes)
9. ✅ Dynamic key-based role lookup
10. ✅ Agents remain stateless except for working memory

---

## Out of Scope

- Role-based access control (RBAC) for users
- Multi-agent consensus/negotiation
- Hierarchical role structures
- Persistent role configurations in database
- Role analytics/metrics
