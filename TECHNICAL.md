# OpenClaw Orchestration Fork - Documentação Técnica

## Histórico

**Criado:** 2026-02-16
**Autor:** Clawdinho + OpenCode
**Versão:** 0.1.0

---

## Visão Geral

Fork do OpenClaw para melhorar a orquestração de subagents com três foco principais:
1. Contexto compartilhado entre orquestrador e subagents
2. Contexto compartilhado entre subagents
3. Execução paralela de tarefas

---

## Phase 1: Context Bridge

### Problema
Subagents começa com contexto vazio, sem acesso ao histórico da sessão principal.

### Solução
Injeção de contexto no momento do spawn do subagent.

### Implementação

#### Arquivos Criados/Modificados
- `src/agents/orchestration/context-bridge.ts` (NOVO)
- `src/agents/tools/sessions-spawn-tool.ts` (MODIFICADO)
- `src/agents/subagent-announce.ts` (MODIFICADO)

#### Tipos Definidos

```typescript
type ContextSharingMode = "none" | "summary" | "recent" | "full";

interface ExtractContextOptions {
  mode?: ContextSharingMode;
  maxRecentMessages?: number;
  maxTokens?: number;
  includeFiles?: string[];
}

interface ExtractedContext {
  contextText: string;
  mode: ContextSharingMode;
  messageCount: number;
  estimatedTokens: number;
}
```

#### API

```typescript
// Uso no sessions_spawn
sessions_spawn({
  task: "minha tarefa",
  contextSharing: "recent",  // none | summary | recent | full
  context: {
    includeHistory: true,
    maxTokens: 4000
  }
})
```

### Decisões de Design

| Decisão | Alternativa | Motivo |
|---------|-------------|--------|
| Context Injection (push) | Shared Memory (pull) | Mais simples; atende 80% dos casos |
| Modos discretos (none/summary/recent/full) | Parâmetros granulares | API mais simples; default seguros |
|compressContext summarization | Truncation | Mantém essência do contexto |

### Backward Compatibility
- `contextSharing` é opcional
- Default: `"none"` (comportamento original)
- Nenhuma mudança em APIs existentes

---

## Phase 2: Shared Context Store

### Problema
Subagents não conseguem se comunicar entre si ou compartilhar resultados parciais.

### Solução
Store chave-valor com suporte a pub/sub para comunicação entre siblings.

### Implementação (Concluído ✅)

#### Arquivos Criados
- `src/agents/orchestration/shared-context-store.ts` (NOVO)
- `src/agents/tools/context-store-tool.ts` (NOVO)
- `src/agents/orchestration/shared-context-store.test.ts` (NOVO - testes unitários)

#### Integração
- Tool registrado em `src/plugins/runtime/index.ts` via `createPluginRuntime().tools.createContextStoreTool`
- Disponível para todos os agentes via nome `context_store`

#### API

```typescript
// Armazenar valor
context_store({
  action: "set",
  namespace: "my-task",
  key: "partial-result",
  value: { data: "..." },
  ttl: 3600  // 1 hora
})

// Recuperar valor
context_store({
  action: "get",
  namespace: "my-task",
  key: "partial-result"
})

// Deletar valor
context_store({
  action: "delete",
  namespace: "my-task",
  key: "partial-result"
})

// Listar todas as chaves
context_store({
  action: "list",
  namespace: "my-task"
})

// Inscrever-se para atualizações
context_store({
  action: "subscribe",
  namespace: "my-task",
  key: "optional-key"  // ou undefined para todos
})

// Broadcast para todos os subagents
context_store({
  action: "broadcast",
  namespace: "my-task",
  message: { type: "update", data: "..." }
})
```

#### Exemplos de Uso

**1. Comunicação entre subagents (siblings):**
```
Agent principal spawna subagents com sharedKey="my-task":

Subagent 1 (pesquisa):
  context_store({
    action: "set",
    namespace: "my-task",
    key: "pesquisa-resultado",
    value: { titulos: [...], fontes: [...] }
  })

Subagent 2 (análise):
  // Aguarda ou verifica resultado
  context_store({
    action: "get",
    namespace: "my-task",
    key: "pesquisa-resultado"
  })
```

**2. Resultado intermediário:**
```
Subagent 1:
  context_store({
    action: "set",
    namespace: "pipeline-001",
    key: "stage-1-result",
    value: { output: "..." },
    ttl: 7200  // 2 horas
  })

// Outro agente pode recuperar depois
context_store({
  action: "get",
  namespace: "pipeline-001", 
  key: "stage-1-result"
})
```

**3. Notificações via broadcast:**
```
Agente emissor:
  context_store({
    action: "broadcast",
    namespace: "notificacoes",
    message: { tipo: "progresso", etapa: 2, total: 5 }
  })
```

### Decisões de Design

| Decisão | Alternativa | Motivo |
|---------|-------------|--------|
| In-memory store | Redis/DB externo | Simplicidade; zero infra |
| TTL automático | Manual cleanup | Previne memory leaks |
| Namespace por orchestration | Global | Isolamento entre tarefas |
| Pub/Sub híbrido | Only pub ou only sub | Flexibilidade |

### TTL Strategy
- Default TTL: 1 hora
- Cleanup a cada 5 minutos
- Keys expiradas são removidas automaticamente

---

## Phase 3: Event-Driven & Autonomy (Planejado)

### Problema Original
- Orquestrador precisa vigiar subagents constantemente (polling)
- Subagents não têm autonomia para notificar conclusão
- Tasks sequenciais precisam de "passagem de bastão"

### Patterns a Implementar

#### Task Completion Callback
Subagent pode notificar conclusão:
```typescript
context_publish({
  target: "orchestrator",
  data: {
    type: "task_complete",
    result: { ... },
    nextAction: "continue" | "wait" | "escalate"
  },
  priority: "high"
})
```

#### Handoff (Sequential Pipeline)
Agent passa resultado pro próximo:
```typescript
context_store({
  action: "set",
  namespace: "workflow-123",
  key: "handoff",
  value: {
    from: "subagent-1",
    to: "subagent-2",
    payload: { ... },
    checkpoint: "state-123"
  }
})
```

#### Checkpoint Resume
Próximo agent pode resumir de um checkpoint:
```typescript
sessions_spawn({
  task: "continuar tarefa",
  resumeFrom: {
    checkpointId: "state-123",
    namespace: "workflow-123"
  }
})
```

### Alternativas de Implementação

| Pattern | Prós | Contras |
|---------|------|---------|
| Callback/Event | Decoplado | Requer event system |
| Continuation Token | Leve | Acoplamento direto |
| Checkpoint/State | Recuperação falha | Overhead storage |
| Message Queue | Escalável | Infra adicional |

### Decisão: Abordagem Híbrida
- `context_publish` para notificações (eventos)
- `context_store` com `handoff` key para state
- `resumeFrom` opcional no spawn para continuação

---

## Phase 4: Parallel Execution (Planejado)

### Problema
Execução sequencial - resultado de um bloqueia o próximo.

### Solução
Comando para spawn múltiplo com wait strategies.

### API Planejada

```typescript
// Executar tarefas em paralelo
parallel_spawn({
  tasks: [
    { task: "pesquisa X", model: "..." },
    { task: "pesquisa Y", model: "..." }
  ],
  wait: "all"  // all | any | race | number
})
```

### Wait Strategies

| Strategy | Comportamento |
|---------|--------------|
| `all` | Espera todos terminarem |
| `any` | Retorna quando qualquer um terminar |
| `race` | Retorna primeiro resultado |
| `number` | Retorna quando N terminarem |

---

## Phase 4: Config & Docs (Planejado)

- Documentação completa
- Exemplos de uso
- Tests E2E

---

## Arquitetura Proposta

```
src/agents/orchestration/
├── context-bridge.ts       # FR-1: Contexto orchestrator → subagent
├── shared-context-store.ts # FR-2: Comunicação entre siblings
├── parallel-executor.ts   # FR-3: Execução paralela
├── task-graph.ts         # FR-3: Dependências de tarefas
└── result-aggregator.ts  # FR-3: Combinação de resultados
```

---

## Comparativo

| Solução | Context | Parallel | Complexidade |
|---------|---------|----------|-------------|
| **OpenClaw Original** | None | No | Baixo |
| **Fork (este)** | Yes | Yes | Médio |
| **CrewAI** | Yes | Yes | Alto |
| **AutoGen** | Yes | Yes | Alto |

---

## Riscos e Mitigações

| Risco | Prob. | Impacto | Mitigação |
|-------|-------|---------|-----------|
| Contexto muito grande | Alta | Médio | Token budget; compressão |
| Memory leaks | Média | Alto | TTL; cleanup automático |
| Race conditions | Baixa | Alto | Locks; versionamento |
| Backward breaks | Baixa | Alto | Tests; versionamento |

---

## Referências

- Repo base: https://github.com/openclaw/openclaw
- SPEC.md: especificação completa
- PLAN.md: plano técnico
- TASKS.md: breakdown de 42 tarefas
- CONSTITUTION.md: princípios do projeto
- INSIGHTS.md: análises e tradeoffs

---

## Inspiração

- **Kimi K2.5 Agent Swarm**: até 100 sub-agents, 1.500 tool calls
- **CrewAI**: role-based agents, sequential/hierarchical execution
- **AutoGen**: conversation-driven agents
