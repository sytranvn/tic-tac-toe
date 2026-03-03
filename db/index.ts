import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';

const sqlite = new Database('sqlite.db');
export const db = drizzle(sqlite, { schema });

// Simple migration logic for this environment
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    size INTEGER NOT NULL,
    win_length INTEGER NOT NULL,
    player_x TEXT NOT NULL,
    player_o TEXT NOT NULL,
    status TEXT NOT NULL,
    winner TEXT,
    created_at INTEGER NOT NULL,
    finished_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS moves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    player_role TEXT NOT NULL,
    cell_index INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (game_id) REFERENCES games(id)
  );
`);
