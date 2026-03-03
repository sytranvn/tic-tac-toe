import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';
import express from 'express';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const expressApp = express();
  const server = createServer(expressApp);
  const io = new Server(server);

  // Matchmaking queues per board size
  const waitingPlayers = new Map<number, string | null>();
  const games = new Map<string, any>();

  io.on('connection', (socket) => {
    console.log('a user connected', socket.id);

    socket.on('find_match', ({ boardSize = 3 } = {}) => {
      const size = Number(boardSize);
      const waitingPlayer = waitingPlayers.get(size);

      // If there's a waiting player and it's not the current socket
      if (waitingPlayer && waitingPlayer !== socket.id) {
        const playerX = waitingPlayer;
        const playerO = socket.id;
        const gameId = `game_${playerX}_${playerO}_${Date.now()}`;

        const gameState = {
          id: gameId,
          board: Array(size * size).fill(null),
          size: size,
          winLength: size === 3 ? 3 : 4, // 3 for 3x3, 4 for 5x5
          nextPlayer: 'X',
          players: {
            X: playerX,
            O: playerO
          },
          status: 'active',
          winner: null,
          rematchRequests: []
        };

        games.set(gameId, gameState);

        // Join both to the room
        const socketX = io.sockets.sockets.get(playerX);
        if (socketX) {
          socketX.join(gameId);
          socketX.emit('match_found', {
            gameId,
            role: 'X',
            gameState
          });
        }

        socket.join(gameId);
        socket.emit('match_found', {
          gameId,
          role: 'O',
          gameState
        });

        waitingPlayers.set(size, null);
      } else {
        waitingPlayers.set(size, socket.id);
        socket.emit('waiting_for_match');
      }
    });

    socket.on('make_move', ({ gameId, index }) => {
      const game = games.get(gameId);
      if (!game || game.status !== 'active') return;

      const playerRole = game.players.X === socket.id ? 'X' : 'O';
      if (game.nextPlayer !== playerRole) return;
      if (game.board[index] !== null) return;

      // Update board
      game.board[index] = playerRole;
      game.nextPlayer = playerRole === 'X' ? 'O' : 'X';

      // Check for winner
      const winner = calculateWinner(game.board, game.size, game.winLength);
      if (winner) {
        game.status = 'finished';
        game.winner = winner;
      } else if (game.board.every((cell: any) => cell !== null)) {
        game.status = 'finished';
        game.winner = 'draw';
      }

      io.to(gameId).emit('game_update', game);
    });

    socket.on('request_rematch', ({ gameId }) => {
      const game = games.get(gameId);
      if (!game || game.status !== 'finished') return;

      if (!game.rematchRequests) game.rematchRequests = [];
      if (!game.rematchRequests.includes(socket.id)) {
        game.rematchRequests.push(socket.id);
      }

      if (game.rematchRequests.length === 2) {
        // Reset game
        game.board = Array(game.size * game.size).fill(null);
        game.status = 'active';
        game.winner = null;
        game.rematchRequests = [];
        // Swap starting player for variety
        game.nextPlayer = Math.random() > 0.5 ? 'X' : 'O';
        io.to(gameId).emit('game_update', game);
      } else {
        // Notify other player
        io.to(gameId).emit('rematch_requested', { requesterId: socket.id });
      }
    });

    socket.on('disconnect', () => {
      console.log('user disconnected', socket.id);
      // Remove from all queues
      for (const [size, id] of waitingPlayers.entries()) {
        if (id === socket.id) {
          waitingPlayers.set(size, null);
        }
      }
      
      // Handle game abandonment
      for (const [gameId, game] of games.entries()) {
        if (game.players.X === socket.id || game.players.O === socket.id) {
          if (game.status === 'active') {
            game.status = 'finished';
            game.winner = game.players.X === socket.id ? 'O' : 'X'; // Opponent wins
            io.to(gameId).emit('game_update', game);
          }
        }
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
  // Check rows, columns, and diagonals
  for (let i = 0; i < squares.length; i++) {
    if (!squares[i]) continue;
    const player = squares[i];

    const row = Math.floor(i / size);
    const col = i % size;

    // Directions: [dRow, dCol]
    const directions = [
      [0, 1],  // Horizontal
      [1, 0],  // Vertical
      [1, 1],  // Diagonal Down-Right
      [1, -1]  // Diagonal Down-Left
    ];

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
