# OpenClaw Swarm

Fork do OpenClaw com ferramentas avançadas para orchestration de subagentes.

## Funcionalidades

### 1. Context Sharing (`contextSharing`)

Compartilha contexto da sessão pai com subagentes.

```typescript
sessions_spawn({
  label: "meu-subagent",
  task: "Faça algo",
  contextSharing: "recent" // none | summary | recent | full
})
```

- **none**: Sem contexto
- **summary**: Resumo compactado
- **recent**: Últimas mensagens
- **full**: Histórico completo

### 2. Shared Context Store (`context_store`)

Armazena estado compartilhado entre subagentes (siblings).

```typescript
// Escrever
context_store({
  action: "set",
  namespace: "meu-projeto",
  key: "dados",
  value: { resultado: "ok" }
})

// Ler
context_store({
  action: "get",
  namespace: "meu-projeto",
  key: "dados"
})
```

**Features:**
- TTL (tempo de vida)
- Namespaces isolados
- Pub/Sub via `subscribe`/`broadcast`

### 3. Event-Driven Notifications (`context_publish`)

Notifica o orchestrator quando subagentes completam.

```typescript
context_publish({
  action: "publish",
  eventType: "task_complete", // task_complete | task_progress | task_error | handoff
  target: "orchestrator",
  data: { resultado: "ok" }
})
```

**Auto-announce**: O sistema notifica automaticamente quando um subagent termina.

```
✅ Sub-agent completed: label
   task: ...
   result: ...
   runtime: Xs
   sessionKey: ...
```

### 4. Parallel Execution (`parallel_spawn`)

Executa múltiplos subagentes em paralelo com diferentes estratégias de espera.

```typescript
parallel_spawn({
  tasks: [
    { label: "tarefa1", task: "Faça isso" },
    { label: "tarefa2", task: "Faça aquilo" }
  ],
  wait: "all" // all | any | race | number
})
```

| Strategy | Comportamento |
|---------|--------------|
| `all` | Espera todos terminarem |
| `any` | Retorna no primeiro, outros continuam |
| `race` | Retorna no primeiro |

## Instalação

```bash
# Clone o fork
git clone https://github.com/Heldinhow/openclaw-swarm.git
cd openclaw-swarm

# Build
pnpm install
pnpm build

# Ou use o código direto do /usr/lib/node_modules/openclaw/
```

## Status

- ✅ `sessions_spawn` com contextSharing
- ✅ `context_store` (get, set, delete, list, subscribe, broadcast)
- ✅ `context_publish` (task_complete, task_progress, task_error, handoff)
- ✅ Auto-announce de subagentes
- ✅ `parallel_spawn` (all, any, race)

## Diferenças do OpenClaw original

| Feature | Original | Swarm |
|---------|----------|-------|
| Context sharing | ❌ | ✅ |
| Siblings comunicação | ❌ | ✅ |
| Auto-notify | ❌ | ✅ |
| Parallel spawn | ❌ | ✅ |

## Autor

Helder (@Heldinhow)
