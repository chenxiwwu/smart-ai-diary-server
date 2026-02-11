import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../../data/diary.db');

// Ensure data directory exists
import fs from 'fs';
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
// Enable foreign key constraints (required for ON DELETE CASCADE to work)
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  -- Users table
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Diary entries table
  CREATE TABLE IF NOT EXISTS entries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    insight TEXT DEFAULT '',
    my_day_summary TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, date)
  );

  -- Todos table
  CREATE TABLE IF NOT EXISTS todos (
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL,
    text TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
  );

  -- Expenses table
  CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL,
    item TEXT NOT NULL,
    amount REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
  );

  -- Media files table
  CREATE TABLE IF NOT EXISTS media (
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('image', 'video', 'audio')),
    url TEXT NOT NULL,
    name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
  );

  -- Create indexes for better query performance
  CREATE INDEX IF NOT EXISTS idx_entries_user_date ON entries(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_todos_entry ON todos(entry_id);
  CREATE INDEX IF NOT EXISTS idx_expenses_entry ON expenses(entry_id);
  CREATE INDEX IF NOT EXISTS idx_media_entry ON media(entry_id);
`);

// Helper functions
export function getDb() {
  return db;
}

export function closeDb() {
  db.close();
}

export default db;
