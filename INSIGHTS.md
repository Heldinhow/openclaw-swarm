# OpenClaw Orchestration Fork - Insights

## Visão Geral do Fork

Fork do OpenClaw para melhorar a orquestração de subagents com foco em:
1. Contexto compartilhado entre orquestrador e subagents
2. Contexto compartilhado entre subagents
3. Execução paralela de tarefas

## Problema Atual

O `sessions_spawn` atual tem limitações:
- Subagents começam "do zero" (isolados)
- Não conversam entre si
- Execução sequencial (resultado bloqueia próximo spawn)
- Sem gerenciamento de dependências

## Solução Proposta

### FR-1: Contexto Orchestrator → Subagent
```typescript
sessions_spawn({
  contextSharing: "recent", // none | summary | recent | full
  context: { 
    includeHistory: true, 
    includeFiles: ["path/to/file"],
    maxTokens: 4000 
  }
})
```

### FR-2: Contexto Subagent → Orchestrator
```typescript
context_publish({
  target: "orchestrator" | "session:<key>" | "broadcast",
  data: any,
  priority: "low" | "normal" | "high",
  persistent: boolean
})
```

### FR-3: Shared Context Store (entre subagents)
```typescript
context_store({
  action: "get" | "set" | "delete" | "list",
  namespace: string,  // Escopo da orquestração
  key: string,
  value?: any,
  ttl?: number
})
```

### FR-4: Execução Paralela
```typescript
parallel_spawn({
  tasks: [
    { task: "pesquisa X", model: "..." },
    { task: "pesquisa Y", model: "..." }
  ],
  wait: "all" | "any" | "race" | number
})
```

## Estrutura Proposta

```
src/agents/orchestration/
├── context-bridge.ts       # Contexto orchestrator ↔ subagent
├── shared-context-store.ts # Dados compartilhados entre siblings
├── parallel-executor.ts   # Execução paralela
├── task-graph.ts         # Dependências de tarefas
└── result-aggregator.ts  # Combinação de resultados
```

## Fases de Implementação

| Phase | Foco | Descrição |
|-------|------|-----------|
| 1 | Context Bridge | Inject contexto do orchestrator no subagent |
| 2 | Shared Context Store | Comunicação entre subagents |
| 3 | Parallel Execution | Execução simultânea |
| 4 | Config & Docs | Documentação |

## Backward Compatibility

- APIs existentes mantidas (sessions_spawn, /subagents, /kill, /steer)
- Novas features opt-in via parâmetros adicionais
- Campos opcionais no registry
- 100% backward compatible

## Inspiração - CrewAI

O fork foi inspirado no CrewAI que oferece:
- Role-based agents (role + goal + backstory)
- Execução sequential ou hierarchical
- Memory persistente entre tasks
- Studio visual (SaaS)

Diferencial do fork: manter lightweight e integrado ao OpenClaw.

## Referências

- Repo base: https://github.com/openclaw/openclaw
- SPEC.md: especificação completa
- PLAN.md: plano técnico
- TASKS.md: breakdown de 42 tarefas
- CONSTITUTION.md: princípios do projeto

## Discussões

### Notificação Assíncrona (pending)
Subagent notificando o orchestrator ao invés de checar constantemente:
- Callback/Webhook
- Event Emitter (pub/sub)
- Message Queue (Redis, RabbitMQ)
- Session notification (sessions_send - já existe)

### Agentes Swarm (2026 trend)
- Cursor coordinou 100+ agentes pra construir browser
- Kimi K2.5 coordena até 100 sub-agents
- "Agent orchestration is still the hard part"

## Decisões de Design & Trade-offs

### 1. Contexto Injection vs. Memory compartilhada

**Abordagem escolhida: Context Injection (push)**
- Prós: Subagent tem contexto desde o início; mais simples de implementar
- Contras: Aumenta tokens por request; pode ficar desatualizado

**Alternativa: Shared Memory (pull)**
- Subagent busca contexto sob demanda
- Prós: Mais eficiente; sempre atualizado
- Contras: Mais complexo; latência adicional

**Decisão:** Context Injection por ser mais simples e atender 80% dos casos

---

### 2. Synchronous vs. Asynchronous Communication

**Abordagem escolhida: Hybrid**
- Pub/Sub para eventos (async)
- Tool calls para requests (sync)

**Alternativa: Fully Async (Message Queue)**
- Prós: Melhor escalabilidade; decoplado
- Contras: Overhead; complexidade operacional

**Alternativa: Fully Sync**
- Prós: Simples; determinístico
- Contras: Bloqueante; não escala

**Decisão:** Hybrid permite Flexibility sem complexidade excessiva

---

### 3. Parallel Execution: Mesh vs. Star

**Abordagem escolhida: Star (Orchestrator como hub)**
- Orquestrador coordena tudo
- Prós: Controle centralizado; debugging fácil
- Contras: Bottleneck potential

**Alternativa: Mesh (subagents conversam direto)**
- Prós: Mais distribuído; resiliente
- Contras: Complexo; difícil debugar

**Decisão:** Star por ser mais simples e manter a proposta lightweight

---

### 4. Context Compression: Summarization vs. Truncation

**Abordagem escolhida: Summarization**
- Resumir mensagens antigas
- Prós: Mantém essência; eficiente
- Contras: Custo de API; pode perder nuance

**Alternativa: Truncation**
- Cortar no limite de tokens
- Prós: Simples; deterministic
- Contras: Perde contexto mais antigo

**Decisão:** Summarization para manter qualidade

---

### 5. Event-Driven & Autonomy Patterns

**Problema:** Orquestrador precisa vigiar subagents constantemente (polling).

**Solução planejada:**
- **Task Completion Callback**: Subagent notifica (`context_publish`) quando termina
- **Handoff**: Agent passa "continuation" pro próximo via `context_store`
- **Checkpoint Resume**: Próximo agent pode resumir de um estado

**Alternativas avaliadas:**
| Pattern | Prós | Contras |
|---------|------|---------|
| Callback/Event | Decoplado | Requer event system |
| Continuation Token | Leve | Acoplamento direto |
| Checkpoint/State | Recuperação falha | Overhead storage |
| Message Queue | Escalável | Infra adicional |

---

### 5. Backward Compatibility

**Estratégia:**
- Todas as novas opções são opcionais com valores padrão seguros
- `contextSharing: "none"` por padrão (mantém comportamento atual)
- APIs existentes intocadas
- Breaking changes = versão maior

---

## Possibilidades Futuras

### Agentes Swarm
- Coordinación de 100+ agentes (como Kimi K2.5)
- Auto-scaling baseado na complexidade da tarefa
- Meta-orquestrador (orquestrador de orquestradores)

### Kimi K2.5 Agent Swarm (Referência)

**Capacidade:**
- Até **100 sub-agents** coordenados dinamicamente
- Até **1.500 tool calls** em paralelo
- **4.5x mais rápido** que single-agent

**Como funciona:**
1. **Self-directed**: O modelo decide quando paralelizar, quantos agentes criar, quais tools usar
2. **Dynamic instantiation**: Cria agentes especializados sob demanda
3. **Parallel workflows**: sub-tasks executam simultaneamente
4. **Result merging**: Agrega resultados dos agentes

**Fontes:**
- [Kimi Blog](https://www.kimi.com/blog/kimi-k2-5.html)
- [DataCamp Guide](https://www.datacamp.com/tutorial/kimi-k2-agent-swarm-guide)
- [NVIDIA NIM](https://build.nvidia.com/moonshotai/kimi-k2.5/modelcard)

### Federated Context
- Múltiplos orquestradores compartilhando contexto
- Cross-session memory
- Hierarchical orchestration (orquestrador de orquestradores)

### Native Integration
- Embed CrewAI-like syntax
- DSL (Domain Specific Language) para orquestração
- Visual flow builder (como CrewAI Studio)

---

## Riscos & Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|------------|
| Contexto muito grande | Alta | Médio | Token budget; compressão |
| Memory leaks | Média | Alto | TTL; cleanup automático |
| Race conditions | Baixa | Alto | Locks; versionamento |
| Backward breaks | Baixa | Alto | Tests; versionamento cuidadoso |

---

## Comparativo com Alternativas

| Solução | Context | Parallel | Complexity | Uso Ideal |
|---------|---------|----------|------------|-----------|
| **OpenClaw Original** | None | No | Baixo | Simple tasks |
| **Fork (este)** | Yes | Yes | Médio | Multi-agent workflows |
| **CrewAI** | Yes | Yes | Alto | Enterprise automation |
| **AutoGen** | Yes | Yes | Alto | Research/prototyping |
| **LangGraph** | Yes | Yes | Médio | Infrastructure-heavy |

---

## Links Relevantes

- r/AI_Agents: https://www.reddit.com/r/AI_Agents/
- Reddit thread "2026, year of agent swarm": https://www.reddit.com/r/AI_Agents/comments/1r0redn/
- CrewAI: https://www.crewai.com/
- OpenCode: https://opencode.ai/
- Awesome OpenCode: https://github.com/awesome-opencode/awesome-opencode
- Microsoft Agent Framework (.NET): https://learn.microsoft.com/en-us/dotnet/api/microsoft.agent
