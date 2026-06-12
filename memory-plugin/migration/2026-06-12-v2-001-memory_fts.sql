-- 2026-06-12-v2-001: Initial memory_fts table
-- Ported from mimocode v6.1 (commit 20260521010000_memory_fts_v6 + 20260521020000_memory_fts_triggers)
-- with v2 additions: hit_count for importance ranking, single 'projects' scope

CREATE TABLE `memory_fts` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `path` TEXT NOT NULL UNIQUE,
  `scope` TEXT NOT NULL DEFAULT 'projects',
  `scope_id` TEXT NOT NULL DEFAULT '',
  `type` TEXT NOT NULL,
  `body` TEXT NOT NULL,
  `fingerprint` TEXT NOT NULL,
  `last_indexed_at` INTEGER NOT NULL,
  `hit_count` INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX `memory_fts_scope_idx` ON `memory_fts` (`scope`, `scope_id`);
CREATE INDEX `memory_fts_type_idx` ON `memory_fts` (`type`);

CREATE VIRTUAL TABLE `memory_fts_idx` USING fts5(
  `body`,
  content='memory_fts',
  content_rowid='id',
  tokenize='unicode61 remove_diacritics 1'
);

CREATE TRIGGER `memory_fts_ai` AFTER INSERT ON `memory_fts` BEGIN
  INSERT INTO `memory_fts_idx`(rowid, body) VALUES (NEW.id, NEW.body);
END;

CREATE TRIGGER `memory_fts_ad` AFTER DELETE ON `memory_fts` BEGIN
  INSERT INTO `memory_fts_idx`(`memory_fts_idx`, rowid, body) VALUES('delete', OLD.id, OLD.body);
END;

CREATE TRIGGER `memory_fts_au` AFTER UPDATE ON `memory_fts` BEGIN
  INSERT INTO `memory_fts_idx`(`memory_fts_idx`, rowid, body) VALUES('delete', OLD.id, OLD.body);
  INSERT INTO `memory_fts_idx`(rowid, body) VALUES (NEW.id, NEW.body);
END;
