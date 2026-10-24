-- The index of radio.4000.* records. A cache of the network: it can be dropped and backfilled.

-- Every account the index knows: radio owners and chat authors
CREATE TABLE accounts (
	did TEXT PRIMARY KEY,
	handle TEXT NOT NULL,
	pds TEXT NOT NULL,
	indexed_at TEXT NOT NULL
);

-- Accounts with a radio.4000.channel record or tracks
CREATE TABLE radios (
	did TEXT PRIMARY KEY,
	handle TEXT NOT NULL,
	pds TEXT NOT NULL,
	record TEXT,
	name TEXT,
	description TEXT,
	latitude REAL,
	longitude REAL,
	created_at TEXT,
	track_count INTEGER NOT NULL DEFAULT 0,
	latest_track_at TEXT,
	indexed_at TEXT NOT NULL
);
CREATE INDEX radios_latest ON radios (latest_track_at DESC);
CREATE INDEX radios_created ON radios (created_at DESC);
CREATE INDEX radios_tracks ON radios (track_count DESC);
CREATE INDEX radios_location ON radios (latitude, longitude);

CREATE TABLE tracks (
	uri TEXT PRIMARY KEY,
	did TEXT NOT NULL,
	cid TEXT NOT NULL,
	record TEXT NOT NULL,
	title TEXT NOT NULL,
	description TEXT,
	created_at TEXT NOT NULL,
	indexed_at TEXT NOT NULL
);
CREATE INDEX tracks_created ON tracks (created_at DESC, uri DESC);
CREATE INDEX tracks_radio ON tracks (did, created_at DESC, uri DESC);

-- #tags and @mentions of track descriptions, lowercase, without # or @. With the
-- track's date, so a tag's tracks are read newest first straight from the index.
CREATE TABLE track_tags (
	tag TEXT NOT NULL,
	uri TEXT NOT NULL,
	created_at TEXT NOT NULL,
	PRIMARY KEY (tag, uri)
);
CREATE INDEX track_tags_feed ON track_tags (tag, created_at DESC, uri DESC);
CREATE INDEX track_tags_uri ON track_tags (uri);
CREATE TABLE track_mentions (
	handle TEXT NOT NULL,
	uri TEXT NOT NULL,
	created_at TEXT NOT NULL,
	PRIMARY KEY (handle, uri)
);
CREATE INDEX track_mentions_feed ON track_mentions (handle, created_at DESC, uri DESC);
CREATE INDEX track_mentions_uri ON track_mentions (uri);

CREATE TABLE broadcasts (
	did TEXT PRIMARY KEY,
	record TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	indexed_at TEXT NOT NULL
);

CREATE TABLE chat_messages (
	uri TEXT PRIMARY KEY,
	did TEXT NOT NULL,
	cid TEXT NOT NULL,
	subject TEXT NOT NULL,
	record TEXT NOT NULL,
	created_at TEXT NOT NULL,
	indexed_at TEXT NOT NULL
);
CREATE INDEX chat_messages_room ON chat_messages (subject, created_at DESC, uri DESC);
CREATE INDEX chat_messages_author ON chat_messages (did);

-- Full-text search, kept in sync by triggers
CREATE VIRTUAL TABLE tracks_fts USING fts5 (title, description, content = 'tracks');
CREATE TRIGGER tracks_fts_insert AFTER INSERT ON tracks BEGIN
	INSERT INTO tracks_fts (rowid, title, description) VALUES (new.rowid, new.title, new.description);
END;
CREATE TRIGGER tracks_fts_delete AFTER DELETE ON tracks BEGIN
	INSERT INTO tracks_fts (tracks_fts, rowid, title, description) VALUES ('delete', old.rowid, old.title, old.description);
END;
CREATE TRIGGER tracks_fts_update AFTER UPDATE OF title, description ON tracks BEGIN
	INSERT INTO tracks_fts (tracks_fts, rowid, title, description) VALUES ('delete', old.rowid, old.title, old.description);
	INSERT INTO tracks_fts (rowid, title, description) VALUES (new.rowid, new.title, new.description);
END;

CREATE VIRTUAL TABLE radios_fts USING fts5 (handle, name, description, content = 'radios');
CREATE TRIGGER radios_fts_insert AFTER INSERT ON radios BEGIN
	INSERT INTO radios_fts (rowid, handle, name, description) VALUES (new.rowid, new.handle, new.name, new.description);
END;
CREATE TRIGGER radios_fts_delete AFTER DELETE ON radios BEGIN
	INSERT INTO radios_fts (radios_fts, rowid, handle, name, description) VALUES ('delete', old.rowid, old.handle, old.name, old.description);
END;
CREATE TRIGGER radios_fts_update AFTER UPDATE OF handle, name, description ON radios BEGIN
	INSERT INTO radios_fts (radios_fts, rowid, handle, name, description) VALUES ('delete', old.rowid, old.handle, old.name, old.description);
	INSERT INTO radios_fts (rowid, handle, name, description) VALUES (new.rowid, new.handle, new.name, new.description);
END;
