# Nagara Character Builder — Roadmap

> Summary. For the full detailed plan, see [`docs/roadmap.md`](../docs/roadmap.md).

| Phase | Goal                                       | Status         |
| ----- | ------------------------------------------ | -------------- |
| **0** | Documentation & Decisions                  | ✅ Done        |
| **1** | Project Restructure (ADR-006)              | ✅ Done        |
| **2** | TypeScript Migration (ADR-008)             | ✅ Done        |
| **3** | Schema-Driven Rendering (ADR-009)          | ✅ Done        |
| **4** | Testing (`node:test`, malizia conventions) | ✅ Done\*      |
| **5** | Bug Fixes & Hardening                      | ✅ Done\*\*    |

\* _Sessions 1–7 complete (385 tests). Session 8 (RPG Engine tests) runs alongside Phase 6._

\*\* _Sessions 0–5 + 4.5 complete. 444 tests, typecheck clean. ADR-013 (domain layer) implemented. See [phase5-plan.md](plans/phase5-plan.md)._
| **6** | RPG Engine (ADR-010, ADR-011)              | Not started    |
| **7** | Sibling Project Integration (addon, bot)   | Not started    |
| **8** | Polish & Beyond MVP                        | Not started    |

## Key Documents

- [Architecture](../docs/architecture.md) — system overview, layers, data flow
- [Data Contracts](../docs/data-contracts.md) — character schema, API contracts
- [Addon Integration](../docs/addon-integration.md) — addon-authored requirements
- [Design Decisions](../docs/decisions/) — ADR files (001–013)
