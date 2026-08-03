ALTER TABLE calendar_tokens ADD COLUMN include_meetings INTEGER NOT NULL DEFAULT 1 CHECK (include_meetings IN (0, 1));
ALTER TABLE calendar_tokens ADD COLUMN include_ppa INTEGER NOT NULL DEFAULT 1 CHECK (include_ppa IN (0, 1));
ALTER TABLE calendar_tokens ADD COLUMN include_competition INTEGER NOT NULL DEFAULT 1 CHECK (include_competition IN (0, 1));
ALTER TABLE calendar_tokens ADD COLUMN include_bonus INTEGER NOT NULL DEFAULT 1 CHECK (include_bonus IN (0, 1));
