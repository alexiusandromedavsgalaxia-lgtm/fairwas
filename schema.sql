CREATE TABLE IF NOT EXISTS visits (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 url TEXT NOT NULL,
 protocol TEXT NOT NULL,
 visited_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_visits_id ON visits(id DESC);

CREATE TABLE IF NOT EXISTS bookmarks (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 url TEXT UNIQUE NOT NULL,
 title TEXT NOT NULL,
 created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sites (
 site_id TEXT PRIMARY KEY,
 hostname TEXT NOT NULL UNIQUE,
 protocol TEXT NOT NULL DEFAULT 'httc',
 title TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 logo_url TEXT,
 framework TEXT,
 language TEXT,
 backend TEXT,
 runtime TEXT,
 database_type TEXT,
 status TEXT NOT NULL DEFAULT 'draft',
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sites_protocol_hostname ON sites(protocol,hostname);

CREATE TABLE IF NOT EXISTS site_files (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 site_id TEXT NOT NULL,
 path TEXT NOT NULL,
 content_type TEXT NOT NULL,
 content TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 UNIQUE(site_id,path)
);
CREATE INDEX IF NOT EXISTS idx_site_files_site ON site_files(site_id);

CREATE TABLE IF NOT EXISTS servers (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 site_id TEXT,
 hostname TEXT NOT NULL UNIQUE,
 protocol TEXT NOT NULL DEFAULT 'httc',
 origin TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'active',
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_servers_protocol_hostname ON servers(protocol,hostname);

CREATE TABLE IF NOT EXISTS cp_developers (
 id INTEGER PRIMARY KEY CHECK(id=1),
 developer_id TEXT NOT NULL UNIQUE,
 display_name TEXT NOT NULL,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cp_projects (
 site_id TEXT PRIMARY KEY,
 hostname TEXT NOT NULL UNIQUE,
 title TEXT NOT NULL,
 developer_id TEXT,
 status TEXT NOT NULL DEFAULT 'draft',
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cp_deployments (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 site_id TEXT NOT NULL,
 version TEXT NOT NULL,
 status TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cp_databases (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 site_id TEXT,
 name TEXT NOT NULL UNIQUE,
 engine TEXT NOT NULL DEFAULT 'SQLite',
 status TEXT NOT NULL DEFAULT 'registered',
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cp_profiles (
 id INTEGER PRIMARY KEY CHECK(id=1),
 display_name TEXT NOT NULL DEFAULT 'Fairwas user',
 updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cp_workers (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 site_id TEXT,
 name TEXT NOT NULL,
 script TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'draft',
 updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cp_docs (
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL,
 content TEXT NOT NULL DEFAULT '',
 updated_at TEXT NOT NULL
);
