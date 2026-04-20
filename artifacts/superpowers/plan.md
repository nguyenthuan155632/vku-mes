# VKU MES v1 — Approved Plan

> Source: `docs/superpowers/plans/2026-04-20-vku-mes-v1.md`
> Approved and executing via `superpowers-execute-plan-parallel`.

This file acts as the canonical approved-plan pointer required by the workflow preconditions.

## 24 Tasks (see source plan for full details)

| Task | Title                                            | Batch |
| ---- | ------------------------------------------------ | ----- |
| 1    | Project scaffolding                              | 1     |
| 2    | Dockerfile + docker-compose                      | 1     |
| 3    | Drizzle schema + migration                       | 2     |
| 4    | Seed script                                      | 3     |
| 5    | Vitest setup                                     | 1     |
| 6    | Engine — shift.ts (TDD)                          | 2     |
| 7    | Engine — oee.ts (TDD)                            | 2     |
| 8    | Engine — hourly.ts (TDD)                         | 2     |
| 9    | Engine — downtime.ts (TDD)                       | 2     |
| 10   | Engine — alerts.ts (TDD)                         | 2     |
| 11   | Repos — workcenters + production                 | 3     |
| 12   | Repos — downtime + shifts + alerts               | 3     |
| 13   | Auth — session, guards, routes                   | 3     |
| 14   | API — pulse + manual-entry                       | 4     |
| 15   | API — dashboard payload                          | 4     |
| 16   | API — hourly, workcenters CRUD, downtime, alerts | 4     |
| 17   | Worker — tick, alerts, shift rollover            | 4     |
| 18   | Frontend foundation                              | 4     |
| 19   | /login page                                      | 5     |
| 20   | Operator dashboard /                             | 5     |
| 21   | Supervisor page /supervisor                      | 5     |
| 22   | Admin workcenters page                           | 5     |
| 23   | Pulse simulator + smoke test + README            | 6     |
| 24   | Final verification                               | 6     |
