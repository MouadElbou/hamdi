# Sync Strategy

## Overview

The system uses an **operation-log sync pattern** with an **outbox/inbox** mechanism.
The central backend (PostgreSQL) is the **authoritative source of truth**.
Desktop instances work offline with SQLite and sync when connectivity is available.
The website reads from the central backend only.

## Identity Strategy

- All entities use **UUIDv7** primary keys, generated client-side.
- UUIDv7 is time-ordered, globally unique, and collision-safe for offline generation.
- No auto-increment IDs in any table (auto-increment is local-only for SQLite rowid).

## Operation Log (Outbox Pattern)

Every mutation on the desktop app is recorded in a local `sync_outbox` table:

```
sync_outbox:
  id           UUID PRIMARY KEY
  entity_type  TEXT NOT NULL        -- e.g., 'purchase_lot', 'sale_order'
  entity_id    UUID NOT NULL        -- the affected entity's UUID
  operation    TEXT NOT NULL        -- 'CREATE', 'UPDATE', 'DELETE'
  payload      TEXT NOT NULL        -- JSON of the full entity state
  version      INTEGER NOT NULL     -- entity version at time of mutation
  created_at   TEXT NOT NULL        -- ISO 8601 timestamp
  synced_at    TEXT NULL            -- set when server acknowledges
  status       TEXT NOT NULL DEFAULT 'pending'  -- pending, synced, conflict, failed
  error_detail TEXT NULL
```

## Sync Flow

### Desktop → Server (Push)

1. Desktop collects all `pending` outbox entries ordered by `created_at`.
2. Desktop sends a batch to `POST /api/sync/push`.
3. Server processes each operation:
   - Validates entity integrity
   - Checks version (optimistic locking) for updates
   - For sales: verifies stock availability server-side
   - Applies or rejects each operation
4. Server responds with per-operation results: `accepted`, `conflict`, or `rejected`.
5. Desktop marks accepted operations as `synced`.
6. Conflicts and rejections are flagged for manual resolution or automatic re-pull.

### Server → Desktop (Pull)

1. Desktop stores a `last_sync_cursor` (server timestamp or sequence number).
2. Desktop calls `GET /api/sync/pull?since={cursor}&limit=500`.
3. Server returns all entities modified after the cursor, ordered by `updated_at`.
4. Desktop upserts received entities into local SQLite.
5. Desktop updates `last_sync_cursor`.
6. Repeat until server returns empty result (fully caught up).

### Server → Website

- Website calls backend API directly (no offline mode).
- Stock availability is read from PostgreSQL.
- Short polling or SSE for near-real-time updates if needed.

## Conflict Resolution

### Per-Aggregate Rules

| Aggregate | Conflict Policy |
|---|---|
| PurchaseLot | Reject stale push (version mismatch) → client must pull first |
| SaleOrder | Reject if stock insufficient server-side → client gets updated stock |
| Maintenance | Last-write-wins (higher timestamp) |
| BatteryRepair | Last-write-wins (higher timestamp) |
| Expense | Last-write-wins (higher timestamp) |
| CustomerCredit | Reject stale (version mismatch) |
| SupplierCredit | Reject stale (version mismatch) |
| BankMovement | Reject stale (version mismatch) |
| MonthlySummary | Reject stale (version mismatch) |
| ZakatSnapshot | Reject stale (version mismatch) |

### Stock-Critical Safety

Sales are the highest-risk operation for sync:
- Desktop shows "available quantity" from local DB.
- User creates a sale locally → outbox entry.
- On push, server re-checks stock availability.
- If another instance already depleted the stock, server rejects.
- Desktop receives rejection + updated stock → user must adjust.

This prevents overselling even with multiple offline instances.

## Idempotency

- Every operation carries the outbox `id` as an idempotency key.
- Server stores processed operation IDs in a `sync_processed_operations` table.
- If the same operation ID is received again (retry), server returns the original result without re-processing.

## Retry & Backoff

- Sync attempts every 30 seconds when online.
- On failure: exponential backoff (30s → 60s → 120s → 300s max).
- On success: reset to 30s interval.
- Manual "Sync Now" button available in desktop UI.

## Deletion Strategy

- Soft delete with `deleted_at` timestamp.
- Deleted entities sync as UPDATE with `deleted_at` set.
- Tombstones retained for at least 90 days for sync convergence.
- Physical cleanup only via maintenance job after retention period.

## Audit Log

Every sync event is logged:

```
sync_audit_log:
  id            UUID PRIMARY KEY
  direction     TEXT NOT NULL        -- 'push' or 'pull'
  entity_type   TEXT NOT NULL
  entity_id     UUID NOT NULL
  operation     TEXT NOT NULL
  result        TEXT NOT NULL        -- 'accepted', 'conflict', 'rejected'
  detail        TEXT NULL
  desktop_id    UUID NOT NULL        -- which desktop instance
  occurred_at   TEXT NOT NULL
```

## Desktop Instance Identity

- Each desktop installation generates a unique `desktop_id` (UUIDv4) on first launch.
- This ID is stored locally and sent with every sync request.
- Allows the server to track which instance originated each change.

## Bootstrap & Rehydration

- New desktop installation: full pull from server to populate local SQLite.
- Corrupted local DB: wipe and re-bootstrap from server.
- Bootstrap endpoint: `GET /api/sync/bootstrap` returns all active entities in chunked response.
