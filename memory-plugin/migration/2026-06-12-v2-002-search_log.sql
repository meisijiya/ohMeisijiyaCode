-- 2026-06-12-v2-002: search audit log
-- Tracks every memory search hit for hit_count derivation and audit
-- 90-day retention enforced in curator Phase 5 PRUNE

CREATE TABLE `memory_search_log` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `memory_id` INTEGER NOT NULL REFERENCES `memory_fts`(`id`),
  `query` TEXT NOT NULL,
  `time` INTEGER NOT NULL
);

CREATE INDEX `memory_search_log_memory_id_idx` ON `memory_search_log` (`memory_id`);
CREATE INDEX `memory_search_log_time_idx` ON `memory_search_log` (`time`);
