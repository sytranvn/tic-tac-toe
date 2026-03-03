'use client';

import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, User, Trophy, X, Circle, RefreshCw, Handshake } from 'lucide-react';

type GameState = {
  id: string;
  board: (string | null)[];
  size: number;
  winLength: number;
  nextPlayer: string;
  status: 'active' | 'finished';
  winner: string | null;
};

export default function TicTacToe() {
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<'idle' | 'searching' | 'playing'>('idle');
  const [game, setGame] = useState<GameState | null>(null);
  const [myRole, setMyRole] = useState<'X' | 'O' | null>(null);
  const [rematchRequested, setRematchRequested] = useState(false);
  const [opponentRematchRequested, setOpponentRematchRequested] = useState(false);
  const [selectedSize, setSelectedSize] = useState<number>(3);

  useEffect(() => {
    socketRef.current = io();
    const s = socketRef.current;

    s.on('waiting_for_match', () => {
      setStatus('searching');
    });

    s.on('match_found', ({ role, gameState }) => {
      setMyRole(role);
      setGame(gameState);
      setStatus('playing');
    });

    s.on('game_update', (updatedGame: GameState) => {
      setGame(updatedGame);
      if (updatedGame.status === 'active') {
        setRematchRequested(false);
        setOpponentRematchRequested(false);
      }
    });

    s.on('rematch_requested', ({ requesterId }) => {
      if (requesterId !== s.id) {
        setOpponentRematchRequested(true);
      }
    });

    return () => {
      s.disconnect();
    };
  }, []);

  const findMatch = () => {
    if (!socketRef.current) return;
    socketRef.current.emit('find_match', { boardSize: selectedSize });
  };

  const makeMove = (index: number) => {
    if (!socketRef.current || !game || game.status !== 'active' || game.board[index] !== null) return;
    if (game.nextPlayer !== myRole) return;

    socketRef.current.emit('make_move', { gameId: game.id, index });
  };

  const requestRematch = () => {
    if (!socketRef.current || !game) return;
    socketRef.current.emit('request_rematch', { gameId: game.id });
    setRematchRequested(true);
  };

  const reset = () => {
    setGame(null);
    setMyRole(null);
    setStatus('idle');
    setRematchRequested(false);
    setOpponentRematchRequested(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-4">
      <AnimatePresence mode="wait">
        {status === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center"
          >
            <h1 className="text-6xl md:text-8xl font-display font-bold mb-4 tracking-tighter bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-transparent">
              TIC TAC TOE
            </h1>
            <p className="text-zinc-400 mb-8 max-w-md mx-auto text-lg">
              Real-time multiplayer game. Match with random players across the world instantly.
            </p>
            
            <div className="flex flex-col gap-6 items-center mb-8">
              <div className="flex gap-4 p-1 bg-zinc-900 rounded-2xl border border-white/5">
                {[3, 5].map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`px-6 py-2 rounded-xl font-bold transition-all ${
                      selectedSize === size 
                        ? 'bg-zinc-800 text-white shadow-lg' 
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {size}x{size}
                  </button>
                ))}
              </div>
              
              <button
                onClick={findMatch}
                className="px-12 py-4 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-full transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-emerald-500/20"
              >
                FIND A MATCH
              </button>
            </div>
          </motion.div>
        )}

        {status === 'searching' && (
          <motion.div
            key="searching"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="flex flex-col items-center"
          >
            <div className="relative w-32 h-32 mb-8">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <User className="w-12 h-12 text-emerald-500" />
              </div>
            </div>
            <h2 className="text-2xl font-display font-bold mb-2 uppercase tracking-widest">SEARCHING {selectedSize}x{selectedSize}...</h2>
            <p className="text-zinc-400">Waiting for an opponent to join</p>
            <button 
              onClick={reset}
              className="mt-8 text-zinc-500 hover:text-white text-sm underline underline-offset-4"
            >
              Cancel
            </button>
          </motion.div>
        )}

        {status === 'playing' && game && (
          <motion.div
            key="playing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full max-w-md"
          >
            <div className="flex justify-between items-center mb-6 bg-zinc-900/50 p-4 rounded-2xl border border-white/5 backdrop-blur-sm">
              <div className={`flex items-center gap-3 transition-colors ${game.nextPlayer === 'X' ? 'text-emerald-400' : 'text-zinc-500'}`}>
                <div className={`p-2 rounded-lg transition-colors ${game.nextPlayer === 'X' ? 'bg-emerald-500/10' : 'bg-zinc-800'}`}>
                  <X className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-sm">PLAYER X</span>
                  <span className="text-[10px] opacity-50 uppercase tracking-wider">{myRole === 'X' ? 'You' : 'Opponent'}</span>
                </div>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">{game.size}x{game.size}</span>
                <div className="h-4 w-[1px] bg-white/10" />
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">{game.winLength} IN A ROW</span>
              </div>
              <div className={`flex items-center gap-3 transition-colors ${game.nextPlayer === 'O' ? 'text-blue-400' : 'text-zinc-500'}`}>
                <div className="flex flex-col items-end">
                  <span className="font-bold text-sm">PLAYER O</span>
                  <span className="text-[10px] opacity-50 uppercase tracking-wider">{myRole === 'O' ? 'You' : 'Opponent'}</span>
                </div>
                <div className={`p-2 rounded-lg transition-colors ${game.nextPlayer === 'O' ? 'bg-blue-500/10' : 'bg-zinc-800'}`}>
                  <Circle className="w-5 h-5" />
                </div>
              </div>
            </div>

            <div 
              className="grid gap-2 mb-8"
              style={{ 
                gridTemplateColumns: `repeat(${game.size}, minmax(0, 1fr))` 
              }}
            >
              {game.board.map((cell, i) => (
                <button
                  key={i}
                  onClick={() => makeMove(i)}
                  disabled={game.status !== 'active' || cell !== null || game.nextPlayer !== myRole}
                  className={`aspect-square rounded-xl flex items-center justify-center transition-all border border-white/5 
                    ${cell === null && game.nextPlayer === myRole && game.status === 'active' ? 'bg-zinc-900 hover:bg-zinc-800 cursor-pointer hover:border-white/20' : 'bg-zinc-900/50 cursor-default'}
                    ${cell === 'X' ? 'text-emerald-400' : 'text-blue-400'}
                  `}
                >
                  <AnimatePresence>
                    {cell === 'X' && (
                      <motion.div initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }}>
                        <X className={game.size === 3 ? "w-12 h-12" : "w-8 h-8"} />
                      </motion.div>
                    )}
                    {cell === 'O' && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                        <Circle className={game.size === 3 ? "w-12 h-12" : "w-8 h-8"} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
              ))}
            </div>

            {game.status === 'finished' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-zinc-900 border border-white/10 p-6 rounded-3xl text-center shadow-2xl"
              >
                <Trophy className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-2xl font-display font-bold mb-2">
                  {game.winner === 'draw' ? "IT'S A DRAW!" : (game.winner === myRole ? "YOU WON!" : "YOU LOST!")}
                </h3>
                <p className="text-zinc-400 mb-6">
                  {game.winner === 'draw' ? "Well played by both sides." : (game.winner === myRole ? "Congratulations, champion!" : "Better luck next time.")}
                </p>
                
                <div className="flex flex-col gap-3">
                  <button
                    onClick={requestRematch}
                    disabled={rematchRequested}
                    className={`flex items-center justify-center gap-2 w-full px-6 py-3 font-bold rounded-full transition-all ${
                      rematchRequested 
                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                        : 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400'
                    }`}
                  >
                    {rematchRequested ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        WAITING FOR OPPONENT...
                      </>
                    ) : (
                      <>
                        <Handshake className="w-4 h-4" />
                        REMATCH
                      </>
                    )}
                  </button>

                  {opponentRematchRequested && !rematchRequested && (
                    <motion.p 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      className="text-xs text-emerald-500 font-bold uppercase tracking-widest"
                    >
                      Opponent wants a rematch!
                    </motion.p>
                  )}

                  <button
                    onClick={reset}
                    className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-zinc-800 text-white font-bold rounded-full hover:bg-zinc-700 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    LEAVE GAME
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
