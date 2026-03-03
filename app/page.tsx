import TicTacToe from '@/components/TicTacToe';
import { Github, Globe } from 'lucide-react';

export default function Home() {
  return (
    <main className="relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
      </div>

      <header className="p-6 flex justify-between items-center border-b border-white/5 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center font-bold text-zinc-950">
            T
          </div>
          <span className="font-display font-bold tracking-tight">TIC-TAC-TOE</span>
        </div>
        <div className="flex items-center gap-4 text-zinc-400">
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-zinc-900 rounded-full border border-white/5 text-xs">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span>LIVE MULTIPLAYER</span>
          </div>
        </div>
      </header>

      <TicTacToe />

      <footer className="p-8 border-t border-white/5 text-center text-zinc-500 text-sm">
        <div className="flex justify-center gap-6 mb-4">
          <a href="#" className="hover:text-white transition-colors flex items-center gap-2">
            <Github className="w-4 h-4" />
            Source
          </a>
          <a href="#" className="hover:text-white transition-colors flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Website
          </a>
        </div>
        <p>© 2026 Tic Tac Toe Online. Built with Next.js & Socket.io</p>
      </footer>
    </main>
  );
}
