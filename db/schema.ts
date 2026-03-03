import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

export const games = sqliteTable('games', {
  id: text('id').primaryKey(),
  size: integer('size').notNull(),
  winLength: integer('win_length').notNull(),
  playerX: text('player_x').notNull(),
  playerO: text('player_o').notNull(),
  status: text('status').notNull(), // 'active', 'finished'
  winner: text('winner'), // 'X', 'O', 'draw', null
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  finishedAt: integer('finished_at', { mode: 'timestamp' }),
});

export const moves = sqliteTable('moves', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gameId: text('game_id').notNull().references(() => games.id),
  playerId: text('player_id').notNull(),
  playerRole: text('player_role').notNull(), // 'X' or 'O'
  cellIndex: integer('cell_index').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
});
