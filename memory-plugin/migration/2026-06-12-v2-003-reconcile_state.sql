-- 2026-06-12-v2-003: reconcile state
-- Tracks last reconcile time per project, used by curator to determine
-- delta-vs-full in Phase 2 GATHER

CREATE TABLE `memory_reconcile_state` (
  `key` TEXT PRIMARY KEY,
  `last_reconcile_at` INTEGER NOT NULL
);
