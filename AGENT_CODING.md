# OpenClaw Swarm - Agent Coding Specification

## Princípio Fundamental

**Qualquer tarefa relacionada a código DEVE usar OpenCode CLI.** Esta é uma regra indiscutível.

## Workflow

### 1. Tarefas Simples (OpenCode direto)

Para tarefas de código simples:
- Bug fixes menores
- Refatorações pequenas
- Adição de funcionalidades straightforward

**Fluxo:**
```
1. Receber task de código
2. Usar opencode-controller skill
3. Executar com modelo apropriado
4. Reportar resultado
```

### 2. Tarefas Complexas (Speckit + OpenCode)

Para projetos maiores:
- Novas features significativas
- Arquitetura de sistemas
- Múltiplos arquivos
- Especificações detalhadas necessárias

**Fluxo:**
```
1. Receber task de código complexa
2. Usar speckit-coding-agent skill
3. /speckit.constitution - Definir princípios
4. /speckit.specify - Especificar funcionalidade
5. /speckit.plan - Criar plano técnico
6. /speckit.tasks - Breakdown de tasks
7. /speckit.implement - Executar via OpenCode
```

## Models

### Prioridade

1. **MiniMax M2.5** (padrão) - Melhor custo-benefício
2. **Fallbacks:**
   - Kimi K2.5 Free
   - GLM 4.7 Free
   - Xiaomi Mimo v2 Flash (cross-provider)

### Seleção por Tipo de Task

| Tipo | Modelo |
|------|--------|
| Código simples | MiniMax M2.5 |
| Debug/fix | MiniMax M2.5 |
| Arquitetura | Kimi K2.5 Free |
| Pesquisa | MiniMax M2.5 |

## OpenCode Controller

### Comandos

- `/sessions` - Selecionar sessão existente ou criar nova
- `/agents` - Escolher Plan ou Build
- `/models` - Selecionar modelo

### Fluxo

1. **Plan Agent** - Analisa tarefa, cria plano
2. **Review** - Humano aprova
3. **Build Agent** - Implementa o plano
4. **Iteração** - Plan → Build até completar

## Speckit Commands

```bash
# Inicializar spec no projeto
specify init --here --ai opencode

# Constitution (princípios do projeto)
/speckit.constitution

# Specify (funcionalidade)
/speckit.specify

# Plan (plano técnico)
/speckit.plan

# Tasks (breakdown)
/speckit.tasks

# Implement (executar)
/speckit.implement
```

## Regras

1. **NUNCA escrever código diretamente na conversa**
2. **SEMPRE delegar ao OpenCode via sub-agent**
3. **Usar Speckit para projetos complexos**
4. **Manter contexto pequeno** - não expor código desnecessário
5. **Testar antes de finalizar** - usar test-patterns skill

## Ferramentas

- **opencode-controller** - Controla OpenCode via slash commands
- **speckit-coding-agent** - Spec-driven development
- **test-patterns** - Writing and running tests
- **clean-code** - Padrões de código

## Padrão de Resposta

Quando completar uma task de código:

- Reportar o que foi feito
- Onde foi feito (path)
- Próximos passos
- **NUNCA** incluir código na resposta
