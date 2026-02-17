# Swarm Workflow Patterns

Sistema de Workflows para OpenClaw Swarm com padrões de execução parallel, pipeline e iterativo.

## Instalação

Os workflows já estão incluídos no módulo de orquestração:

```typescript
import {
  Workflow,
  TaskGraph,
  ConcurrentWorkflow,
  PipelineWorkflow,
  IterativeWorkflow,
  Orchestrator,
  WorkflowRegistry,
} from "./agents/orchestration/index.js";
```

---

## Uso Básico

### 1. ConcurrentWorkflow (Tarefas Paralelas)

Executa todas as tarefas simultaneamente:

```typescript
import { ConcurrentWorkflow } from "./orchestration/concurrent-workflow.js";

const workflow = new ConcurrentWorkflow([
  { id: "analyze", payload: { task: "Analisar código" } },
  { id: "lint", payload: { task: "Verificar lint" } },
  { id: "test", payload: { task: "Executar testes" } },
]);

const result = await workflow.execute(context);
console.log(result.success); // true
console.log(result.outputs); // Map com resultados
```

### 2. PipelineWorkflow (Tarefas Sequenciais)

Executa tarefas em sequência, passando output como input:

```typescript
import { PipelineWorkflow } from "./orchestration/pipeline-workflow.js";

const workflow = new PipelineWorkflow([
  {
    id: "fetch",
    payload: { source: "api" },
    handler: async (p) => fetchData(p.source),
  },
  {
    id: "transform",
    payload: { format: "json" },
    handler: async (p, ctx) => transformData(ctx.get("fetch")),
  },
  {
    id: "save",
    payload: { target: "db" },
    handler: async (p, ctx) => saveData(ctx.get("transform")),
  },
]);

const result = await workflow.execute(context);
```

### 3. IterativeWorkflow (Loop)

Repete tarefas até condição:

```typescript
import { IterativeWorkflow } from "./orchestration/iterative-workflow.js";

const workflow = new IterativeWorkflow({
  maxIterations: 5,
  stopOnSuccess: true,
  tasks: [
    {
      id: "implement",
      payload: { action: "implement" },
      handler: async (p) => implementFeature(),
    },
    {
      id: "test",
      payload: { action: "test" },
      handler: async (p) => runTests(),
    },
  ],
  until: (results) => results.get("test")?.success === true,
});
```

---

## Orchestrator (Auto-Seleção)

O Orchestrator seleciona automaticamente o workflow baseado no tipo de tarefa:

```typescript
import { Orchestrator } from "./orchestration/orchestrator.js";

const orchestrator = new Orchestrator();

// Auto-seleciona ConcurrentWorkflow para research
const researchResult = await orchestrator.execute({
  id: "research-task",
  type: "research",
  tasks: [{ id: "t1", payload: {} }],
});

// Auto-seleciona PipelineWorkflow para refactor
const refactorResult = await orchestrator.execute({
  id: "refactor-task",
  type: "refactor",
  tasks: [{ id: "t1", payload: {} }],
});

// Auto-seleciona IterativeWorkflow para coding
const codingResult = await orchestrator.execute({
  id: "coding-task",
  type: "coding",
  tasks: [{ id: "t1", payload: {} }],
});
```

---

## Mapeamento de Tipos

| Tipo de Tarefa | Workflow           | Palavras-chave                 |
| -------------- | ------------------ | ------------------------------ |
| `research`     | ConcurrentWorkflow | search, find, investigate      |
| `code`         | IterativeWorkflow  | write, implement, create       |
| `refactor`     | PipelineWorkflow   | refactor, restructure, improve |
| _(default)_    | ConcurrentWorkflow | -                              |

---

## Registro de Workflows Customizados

Registre seus próprios workflows:

```typescript
import { WorkflowRegistry, Workflow } from "./orchestration/workflow.js";

class CustomWorkflow implements Workflow {
  readonly type = "custom";

  validate() {
    /* ... */
  }
  getGraph() {
    /* ... */
  }
  async execute(ctx) {
    /* ... */
  }
}

const registry = new WorkflowRegistry();
registry.register("custom", CustomWorkflow);

// Use com orchestrator
const orchestrator = new Orchestrator({ registry });
const result = await orchestrator.execute({
  id: "custom-task",
  type: "custom",
  tasks: [],
});
```

---

## Configuração

```typescript
import { WorkflowConfig } from "./orchestration/workflow.js";

const config: WorkflowConfig = {
  maxTasks: 50, // Max tarefas por workflow
  maxNestingDepth: 5, // Max profundidade aninhada
  defaultTimeout: 300000, // 5 minutos
  failureStrategy: "fail-fast", // fail-fast | continue-others | retry
  maxRetries: 0,
};

const workflow = new ConcurrentWorkflow(tasks, config);
```

---

## Eventos (SwarmController)

Workflows emitem eventos para monitoramento:

```typescript
import { getGlobalSwarmController } from "./orchestration/index.js";

const controller = getGlobalSwarmController();

// Subscribe a eventos
controller.subscribe("task_start", (event) => {
  console.log(`Tarefa iniciada: ${event.taskId}`);
});

controller.subscribe("task_complete", (event) => {
  console.log(`Tarefa concluída: ${event.taskId}`);
});

controller.subscribe("task_error", (event) => {
  console.error(`Erro na tarefa: ${event.taskId}`, event.error);
});
```

---

## Exemplo Completo

```typescript
import { Orchestrator } from "./orchestration/orchestrator.js";

async function main() {
  const orchestrator = new Orchestrator();

  // Pesquisa parallel
  const researchResult = await orchestrator.execute({
    id: "research-auth",
    type: "research",
    message: "research best practices for authentication",
    tasks: [
      { id: "google", payload: { query: "auth best practices" } },
      { id: "docs", payload: { query: "oauth2 documentation" } },
      { id: "github", payload: { query: "auth libraries" } },
    ],
  });

  console.log("Research results:", researchResult.outputs);

  // Refatoração sequencial
  const refactorResult = await orchestrator.execute({
    id: "refactor-api",
    type: "refactor",
    tasks: [
      { id: "analyze", payload: { file: "api.ts" } },
      { id: "transform", payload: { file: "api.ts" } },
      { id: "validate", payload: { file: "api.ts" } },
    ],
  });

  console.log("Refactor results:", refactorResult.outputs);
}

main();
```

---

## API Reference

### Classes

- `ConcurrentWorkflow` - Execução paralela
- `PipelineWorkflow` - Execução sequencial
- `IterativeWorkflow` - Execução iterativa
- `TaskGraph` - Grafo de dependências (DAG)
- `TaskTypeClassifier` - Classificação de tipo por palavras-chave
- `WorkflowRegistry` - Registro de workflows customizados
- `Orchestrator` - Seleção automática de workflow

### Interfaces

- `Workflow` - Interface base para workflows
- `WorkflowConfig` - Configuração de execução
- `WorkflowResult` - Resultado da execução
- `Task` - Definição de tarefa
- `TaskContext` - Contexto de execução

---

## Testes

```bash
# Executar todos os testes
pnpm test -- src/agents/orchestration/*.test.ts
```
