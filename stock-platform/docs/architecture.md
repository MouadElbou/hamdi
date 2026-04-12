# Architecture Decision Record

## System Overview

The platform consists of three synchronized applications sharing a common domain model:

1. **Central Backend** — Fastify + TypeScript + PostgreSQL (source of global truth)
2. **Desktop Back-Office** — Electron + React + TypeScript + SQLite (offline-first)
3. **Public Website** — Next.js + TypeScript (catalog + WhatsApp handoff)

## Technology Decisions

### ADR-001: Monorepo with npm workspaces
**Decision**: Use npm workspaces monorepo.
**Rationale**: Shared domain types, validation, and constants across all three apps.

### ADR-002: TypeScript everywhere
**Decision**: TypeScript for all packages.
**Rationale**: Type safety across domain boundaries prevents mismatches between desktop, backend, and website.

### ADR-003: PostgreSQL for central database
**Decision**: PostgreSQL 16+ for the server.
**Rationale**: Strong relational integrity, JSON support for flexible fields, proven for financial/inventory systems.

### ADR-004: SQLite for desktop local database
**Decision**: better-sqlite3 for Electron local persistence.
**Rationale**: Zero-config, single-file, reliable for offline-first local storage. Supports the same relational schema as PostgreSQL.

### ADR-005: Prisma for backend ORM
**Decision**: Prisma ORM for backend PostgreSQL operations.
**Rationale**: Type-safe queries, migration management, introspection. Mature enough for production.

### ADR-006: Fastify for backend API
**Decision**: Fastify over Express.
**Rationale**: Better TypeScript support, schema validation built-in, faster. Plugin architecture suits modular domains.

### ADR-007: Electron for desktop
**Decision**: Electron with React frontend.
**Rationale**: Most mature desktop web-tech framework. Needed for local SQLite access, background sync, and offline operation.

### ADR-008: Next.js for website
**Decision**: Next.js App Router for the public storefront.
**Rationale**: SSR for SEO, React ecosystem, fast page loads for catalog browsing.

### ADR-009: Operation-log sync with outbox pattern
**Decision**: Desktop apps record mutations in a local outbox. Sync pushes operations to the server. Server is authoritative.
**Rationale**: Idempotent replay, audit trail, conflict detection per aggregate. See sync-strategy.md.

### ADR-010: UUIDs for entity identity
**Decision**: UUIDv7 (time-ordered) for all primary keys.
**Rationale**: Client-generated, globally unique, time-sortable. Safe for offline creation before sync.

## Package Structure

```
stock-platform/
├── packages/
│   ├── shared/          # Domain types, constants, validation, formulas
│   ├── backend/         # Fastify API + Prisma + PostgreSQL
│   ├── desktop/         # Electron + React + SQLite
│   └── website/         # Next.js storefront
├── docs/                # Architecture, domain model, sync strategy
├── prisma/              # Prisma schema (used by backend, reference for desktop)
└── package.json         # Monorepo root
```

## Domain Aggregates

| Aggregate | Root Entity | Owned Entities |
|---|---|---|
| Purchase | PurchaseLot | — |
| Stock | StockLot (computed view of PurchaseLot) | — |
| Sale | SaleOrder | SaleLine |
| Maintenance | MaintenanceJob | — |
| BatteryRepair | BatteryRepairJob | — |
| Expense | Expense | — |
| CustomerCredit | CustomerCredit | CreditPayment |
| SupplierCredit | SupplierCredit | SupplierPayment |
| BankMovement | BankMovement | — |
| MonthlySummary | MonthlySummary | MonthlySummaryLine |
| ZakatSnapshot | ZakatSnapshot | ZakatAdvance |

## Conflict Resolution Policy (per aggregate)

| Aggregate | Policy | Rationale |
|---|---|---|
| PurchaseLot | Server wins, reject stale | Financial integrity |
| SaleOrder/SaleLine | Server wins, reject if stock depleted | Prevent oversell |
| Maintenance | Last-write-wins with timestamp | Low conflict risk |
| BatteryRepair | Last-write-wins with timestamp | Low conflict risk |
| Expense | Last-write-wins with timestamp | Low conflict risk |
| CustomerCredit | Server wins, reject stale | Financial integrity |
| SupplierCredit | Server wins, reject stale | Financial integrity |
| BankMovement | Server wins, reject stale | Financial integrity |
| MonthlySummary | Server wins | Shared editing rare |
| ZakatSnapshot | Server wins | Period-end calculation |

## Top 20 Risks

1. Stock overselling across multiple offline desktop instances
2. Duplicate sale posting during sync retry
3. Sync conflicts on the same stock lot from two boutiques
4. Data loss from failed partial sync
5. SQLite corruption on unexpected desktop shutdown
6. PostgreSQL migration failures on schema updates
7. Stale stock data on website leading to customer frustration
8. Financial precision errors (floating point)
9. Category alias mapping gaps during import
10. Historical negative stock breaking validation rules
11. Large import batches timing out or failing mid-import
12. Inconsistent monthly summary if transactions sync out of order
13. Zakat calculation running on incomplete sync state
14. WhatsApp deep link format changes breaking handoff
15. Electron auto-update breaking local database
16. Network partitions during critical sale operations
17. Concurrent desktop edits to same customer credit
18. Missing audit trail for silent corrections
19. Desktop app DB growing unbounded without archival
20. Website cache serving stale stock after backend update

## Mitigations

- **Risks 1-4**: Outbox pattern + idempotent operations + server-authoritative stock checks
- **Risk 5**: WAL mode + periodic backup
- **Risk 6**: Prisma migration CI pipeline
- **Risk 7**: Short polling interval + stale indicators on website
- **Risk 8**: Use integer minor units (centimes) for all money
- **Risk 9**: Strict alias mapping table with import validation
- **Risk 10**: Historical import mode flag, blocked in normal operations
- **Risk 11**: Chunked import with progress tracking
- **Risk 12**: Summary recomputation after sync completion
- **Risk 13**: Zakat requires explicit "sync complete" gate
- **Risk 14**: WhatsApp URL builder with format tests
- **Risk 15**: DB migration on app startup with rollback
- **Risk 16**: Offline queue with exponential backoff
- **Risk 17**: Optimistic locking with version field
- **Risk 18**: Append-only audit log for all financial mutations
- **Risk 19**: Archival policy for old sync operations
- **Risk 20**: Cache invalidation on write + ETag/Last-Modified headers
