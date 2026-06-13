-- 2026-06-13-v3-001: curator turn counter
-- Tracks user-turn count per project (shared across all sessions of that project).
-- When count >= cfg.triggerThreshold (default 15), the next session.idle dispatches
-- a FULL curator reconcile (walks all queue.jsonl, no incremental skip) and resets
-- the counter. Below threshold, dispatches delta reconcile as usual.
--
-- Project-scoped (not session-scoped) so a user opening 3 sessions in the same
-- project shares one counter — the 15-turn budget is for the project, not per session.

CREATE TABLE `memory_curator_counter` (
  `project_hash` TEXT PRIMARY KEY,
  `turn_count` INTEGER NOT NULL DEFAULT 0,
  `last_full_at` INTEGER,
  `last_delta_at` INTEGER
);
