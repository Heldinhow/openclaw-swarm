# OpenClaw Orchestration Fork - Tasks

## Task Breakdown

### Phase 1: Context Injection

| ID | Task | File | Effort | Dependencies |
|----|------|------|--------|--------------|
| T1.1 | Add ContextInjectionConfig interface | `packages/gateway/src/types.ts` | 0.5d | - |
| T1.2 | Modify sessions_spawn tool params | `packages/gateway/src/tools/sessions/spawn.ts` | 1d | T1.1 |
| T1.3 | Create ContextBuilder class | `packages/gateway/src/orchestration/context-builder.ts` | 1d | T1.1 |
| T1.4 | Implement history extraction | `packages/gateway/src/orchestration/context-builder.ts` | 0.5d | T1.3 |
| T1.5 | Implement file reading | `packages/gateway/src/orchestration/context-builder.ts` | 0.5d | T1.3 |
| T1.6 | Implement memory retrieval | `packages/gateway/src/orchestration/context-builder.ts` | 0.5d | T1.3 |
| T1.7 | Integrate context at session start | `packages/gateway/src/agent/session-start.ts` | 1d | T1.2, T1.3 |

**Phase 1 Subtotal: 5 days**

---

### Phase 2: Context Store

| ID | Task | File | Effort | Dependencies |
|----|------|------|--------|--------------|
| T2.1 | Create ContextStore class | `packages/gateway/src/orchestration/context-store.ts` | 1d | - |
| T2.2 | Implement TTL cleanup | `packages/gateway/src/orchestration/context-store.ts` | 0.5d | T2.1 |
| T2.3 | Create context_store tool | `packages/gateway/src/tools/orchestration/context-store.ts` | 1d | T2.1 |
| T2.4 | Create context_publish tool | `packages/gateway/src/tools/orchestration/context-publish.ts` | 1d | T2.1 |
| T2.5 | Add tools to tool registry | `packages/gateway/src/tools/registry.ts` | 0.5d | T2.3, T2.4 |

**Phase 2 Subtotal: 4 days**

---

### Phase 3: Parallel Execution

| ID | Task | File | Effort | Dependencies |
|----|------|------|--------|--------------|
| T3.1 | Create OrchestrationManager class | `packages/gateway/src/orchestration/manager.ts` | 1.5d | T1.2 |
| T3.2 | Implement task dependency resolution | `packages/gateway/src/orchestration/scheduler.ts` | 1d | T3.1 |
| T3.3 | Implement parallel scheduler | `packages/gateway/src/orchestration/scheduler.ts` | 1.5d | T3.2 |
| T3.4 | Implement result aggregation | `packages/gateway/src/orchestration/manager.ts` | 1d | T3.1 |
| T3.5 | Update sessions_spawn for batch mode | `packages/gateway/src/tools/sessions/spawn.ts` | 1d | T3.1, T3.3 |
| T3.6 | Add orchestrationId to session model | `packages/gateway/src/sessions/model.ts` | 0.5d | - |

**Phase 3 Subtotal: 6.5 days**

---

### Phase 4: Status Tracking

| ID | Task | File | Effort | Dependencies |
|----|------|------|--------|--------------|
| T4.1 | Create orchestration_status tool | `packages/gateway/src/tools/orchestration/status.ts` | 0.5d | T3.1 |
| T4.2 | Update sessions_list with orchestration filters | `packages/gateway/src/tools/sessions/list.ts` | 0.5d | T3.6 |
| T4.3 | Add orchestration fields to session response | `packages/gateway/src/tools/sessions/list.ts` | 0.5d | T3.6 |
| T4.4 | Wire up status in OrchestrationManager | `packages/gateway/src/orchestration/manager.ts` | 0.5d | T4.1 |

**Phase 4 Subtotal: 2 days**

---

### Phase 5: Configuration

| ID | Task | File | Effort | Dependencies |
|----|------|------|--------|--------------|
| T5.1 | Add orchestration config schema | `packages/gateway/src/config/orchestration.ts` | 0.5d | - |
| T5.2 | Add config validation | `packages/gateway/src/config/validation.ts` | 0.5d | T5.1 |
| T5.3 | Load config in gateway startup | `packages/gateway/src/index.ts` | 0.5d | T5.2 |

**Phase 5 Subtotal: 1.5 days**

---

### Phase 6: Testing & Documentation

| ID | Task | File | Effort | Dependencies |
|----|------|------|--------|--------------|
| T6.1 | Unit tests: ContextStore | `packages/gateway/tests/unit/context-store.test.ts` | 0.5d | T2.1 |
| T6.2 | Unit tests: Scheduler | `packages/gateway/tests/unit/scheduler.test.ts` | 0.5d | T3.2 |
| T6.3 | Unit tests: Aggregation | `packages/gateway/tests/unit/aggregation.test.ts` | 0.5d | T3.4 |
| T6.4 | Integration: Parallel spawn flow | `packages/gateway/tests/integration/parallel-spawn.test.ts` | 1d | T3.5 |
| T6.5 | Integration: Context injection | `packages/gateway/tests/integration/context-injection.test.ts` | 0.5d | T1.7 |
| T6.6 | Integration: Cross-subagent comm | `packages/gateway/tests/integration/cross-subagent.test.ts` | 0.5d | T2.4 |
| T6.7 | API documentation | `docs/orchestration/api.md` | 1d | All |
| T6.8 | Migration guide | `docs/orchestration/migration.md` | 0.5d | T5.1 |

**Phase 6 Subtotal: 5 days**

---

## Summary

| Phase | Effort |
|-------|--------|
| Phase 1: Context Injection | 5 days |
| Phase 2: Context Store | 4 days |
| Phase 3: Parallel Execution | 6.5 days |
| Phase 4: Status Tracking | 2 days |
| Phase 5: Configuration | 1.5 days |
| Phase 6: Testing & Docs | 5 days |
| **Total** | **24 days** |

---

## Priority Order

1. **P0 (Critical Path)**: T1.1 → T1.2 → T1.3 → T1.7 → T2.1 → T2.3 → T3.1 → T3.3 → T3.5
2. **P1 (Core Features)**: T2.4, T3.2, T3.4, T3.6, T4.1, T4.2
3. **P2 (Enhancements)**: T4.3, T4.4, T5.1, T5.2, T5.3
4. **P3 (Polish)**: All testing and documentation tasks

---

## Parallel Opportunities

These tasks can be done in parallel:
- T1.4, T1.5, T1.6 (all in context-builder.ts, different methods)
- T2.3 and T2.4 (independent tools)
- T6.1, T6.2, T6.3 (independent unit tests)
- T6.4, T6.5, T6.6 (independent integration tests)

---

## Notes

- Estimate assumes 1 developer
- Some tasks can be split for pair programming
- Integration tests require full gateway running
- Documentation can start after Phase 3 (features complete)
