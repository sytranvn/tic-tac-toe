import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';
import express from 'express';
import { db } from './db';
import { games as gamesTable, moves as movesTable } from './db/schema';
import { eq } from 'drizzle-orm';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  const expressApp = express();
  const server = createServer(expressApp);
  const io = new Server(server);

  // Redis setup
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const pubClient = createClient({ url: redisUrl });
  const subClient = pubClient.duplicate();
  const redisClient = pubClient.duplicate();

  try {
    await Promise.all([
      pubClient.connect(),
      subClient.connect(),
      redisClient.connect()
    ]);
    io.adapter(createAdapter(pubClient, subClient));
    console.log('Connected to Redis and initialized adapter');
  } catch (err) {
    console.error('Failed to connect to Redis:', err);
    // Fallback to in-memory if Redis fails (optional, but safer for dev)
  }

  // Redis keys
  const getWaitingKey = (size: number) => `waiting_players:${size}`;
  const getGameKey = (gameId: string) => `game:${gameId}`;
  const getPlayerGamesKey = (socketId: string) => `player_games:${socketId}`;

  io.on('connection', (socket) => {
    console.log('a user connected', socket.id);

    socket.on('find_match', async ({ boardSize = 3 } = {}) => {
      const size = Number(boardSize);
      const waitingKey = getWaitingKey(size);

      // Try to get a waiting player from Redis
      const waitingPlayer = await redisClient.lPop(waitingKey);

      if (waitingPlayer && waitingPlayer !== socket.id) {
        const playerX = waitingPlayer;
        const playerO = socket.id;
        const gameId = `game_${playerX}_${playerO}_${Date.now()}`;

        const gameState = {
          id: gameId,
          board: Array(size * size).fill(null),
          size: size,
          winLength: size === 3 ? 3 : 4,
          nextPlayer: 'X',
          players: {
            X: playerX,
            O: playerO
          },
          status: 'active',
          winner: null,
          rematchRequests: []
        };

        // Save game state to Redis
        await redisClient.set(getGameKey(gameId), JSON.stringify(gameState), { EX: 3600 }); // 1 hour expiry
        
        // Track games for both players
        await redisClient.sAdd(getPlayerGamesKey(playerX), gameId);
        await redisClient.sAdd(getPlayerGamesKey(playerO), gameId);

        // Save to DB
        try {
          await db.insert(gamesTable).values({
            id: gameId,
            size: gameState.size,
            winLength: gameState.winLength,
            playerX: playerX,
            playerO: playerO,
            status: 'active',
            createdAt: new Date(),
          });
        } catch (err) {
          console.error('Error saving game to DB:', err);
        }

        // Join both to the room
        // Note: In a multi-server setup, socketX might be on another server.
        // io.to(gameId).emit will work because of the Redis adapter.
        // But we need to make sure both sockets join the room.
        
        // We can use io.sockets.sockets.get(playerX) only if it's on THIS server.
        // For horizontal scaling, we should use a different approach or assume they join when they receive match_found.
        // Actually, Socket.io adapter handles io.to(socketId).emit across servers.
        
        io.to(playerX).socketsJoin(gameId);
        socket.join(gameId);

        io.to(gameId).emit('match_found', {
          gameId,
          role: 'X', // We'll tell playerX they are X
          gameState
        });
        
        // Wait, we need to tell them their roles individually
        io.to(playerX).emit('match_found', { gameId, role: 'X', gameState });
        socket.emit('match_found', { gameId, role: 'O', gameState });

      } else {
        // If we were the one who popped but it was us (shouldn't happen with lPop usually but just in case)
        // or if there was no one waiting.
        await redisClient.rPush(waitingKey, socket.id);
        socket.emit('waiting_for_match');
      }
    });

    socket.on('make_move', async ({ gameId, index }) => {
      const gameData = await redisClient.get(getGameKey(gameId));
      if (!gameData) return;
      const game = JSON.parse(gameData);

      if (game.status !== 'active') return;

      const playerRole = game.players.X === socket.id ? 'X' : 'O';
      if (game.nextPlayer !== playerRole) return;
      if (game.board[index] !== null) return;

      // Update board
      game.board[index] = playerRole;
      game.nextPlayer = playerRole === 'X' ? 'O' : 'X';

      // Save move to DB
      try {
        await db.insert(movesTable).values({
          gameId: gameId,
          playerId: socket.id,
          playerRole: playerRole,
          cellIndex: index,
          timestamp: new Date(),
        });
      } catch (err) {
        console.error('Error saving move to DB:', err);
      }

      // Check for winner
      const winner = calculateWinner(game.board, game.size, game.winLength);
      if (winner) {
        game.status = 'finished';
        game.winner = winner;
      } else if (game.board.every((cell: any) => cell !== null)) {
        game.status = 'finished';
        game.winner = 'draw';
      }

      if (game.status === 'finished') {
        try {
          await db.update(gamesTable)
            .set({ 
              status: 'finished', 
              winner: game.winner, 
              finishedAt: new Date() 
            })
            .where(eq(gamesTable.id, gameId));
        } catch (err) {
          console.error('Error updating game in DB:', err);
        }
        // Cleanup Redis tracking
        await redisClient.sRem(getPlayerGamesKey(game.players.X), gameId);
        await redisClient.sRem(getPlayerGamesKey(game.players.O), gameId);
      }

      // Update Redis state
      await redisClient.set(getGameKey(gameId), JSON.stringify(game), { EX: 3600 });

      io.to(gameId).emit('game_update', game);
    });

    socket.on('request_rematch', async ({ gameId }) => {
      const gameData = await redisClient.get(getGameKey(gameId));
      if (!gameData) return;
      const game = JSON.parse(gameData);

      if (game.status !== 'finished') return;

      if (!game.rematchRequests) game.rematchRequests = [];
      if (!game.rematchRequests.includes(socket.id)) {
        game.rematchRequests.push(socket.id);
      }

      if (game.rematchRequests.length === 2) {
        // Reset game
        const newGameId = `game_${game.players.X}_${game.players.O}_${Date.now()}`;
        game.id = newGameId;
        game.board = Array(game.size * game.size).fill(null);
        game.status = 'active';
        game.winner = null;
        game.rematchRequests = [];
        game.nextPlayer = Math.random() > 0.5 ? 'X' : 'O';

        // Save to Redis
        await redisClient.set(getGameKey(newGameId), JSON.stringify(game), { EX: 3600 });
        await redisClient.sAdd(getPlayerGamesKey(game.players.X), newGameId);
        await redisClient.sAdd(getPlayerGamesKey(game.players.O), newGameId);

        // Save new game to DB
        try {
          await db.insert(gamesTable).values({
            id: newGameId,
            size: game.size,
            winLength: game.winLength,
            playerX: game.players.X,
            playerO: game.players.O,
            status: 'active',
            createdAt: new Date(),
          });
        } catch (err) {
          console.error('Error saving rematch game to DB:', err);
        }

        // Both join new room
        io.to(game.players.X).socketsJoin(newGameId);
        io.to(game.players.O).socketsJoin(newGameId);

        io.to(gameId).emit('game_update', game);
      } else {
        // Update Redis state
        await redisClient.set(getGameKey(gameId), JSON.stringify(game), { EX: 3600 });
        io.to(gameId).emit('rematch_requested', { requesterId: socket.id });
      }
    });

    socket.on('disconnect', async () => {
      console.log('user disconnected', socket.id);
      
      // Remove from all queues
      // In a real app we'd need to iterate or track which queue they are in.
      // For simplicity, we'll check common sizes.
      for (const size of [3, 5]) {
        await redisClient.lRem(getWaitingKey(size), 0, socket.id);
      }
      
      // Handle game abandonment
      const playerGames = await redisClient.sMembers(getPlayerGamesKey(socket.id));
      for (const gameId of playerGames) {
        const gameData = await redisClient.get(getGameKey(gameId));
        if (!gameData) continue;
        const game = JSON.parse(gameData);

        if (game.status === 'active') {
          game.status = 'finished';
          game.winner = game.players.X === socket.id ? 'O' : 'X';
          
          try {
            await db.update(gamesTable)
              .set({ 
                status: 'finished', 
                winner: game.winner, 
                finishedAt: new Date() 
              })
              .where(eq(gamesTable.id, gameId));
          } catch (err) {
            console.error('Error updating abandoned game in DB:', err);
          }

          await redisClient.set(getGameKey(gameId), JSON.stringify(game), { EX: 3600 });
          io.to(gameId).emit('game_update', game);
        }
        await redisClient.sRem(getPlayerGamesKey(socket.id), gameId);
      }
    });
  });

  expressApp.all(/.*/, (req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const PORT = 3000;
  server.listen(PORT, () => {
    console.log(`> Ready on http://localhost:${PORT}`);
  });
});

function calculateWinner(squares: any[], size: number, winLength: number) {
  for (let i = 0; i < squares.length; i++) {
    if (!squares[i]) continue;
    const player = squares[i];
    const row = Math.floor(i / size);
    const col = i % size;
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

    for (const [dr, dc] of directions) {
      let count = 1;
      for (let step = 1; step < winLength; step++) {
        const nr = row + dr * step;
        const nc = col + dc * step;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          if (squares[nr * size + nc] === player) {
            count++;
          } else {
            break;
          }
        } else {
          break;
        }
      }
      if (count === winLength) return player;
    }
  }
  return null;
}

