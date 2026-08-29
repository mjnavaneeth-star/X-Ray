import React from 'react';
import { 
  Sparkles, 
  History, 
  Dna, 
  Sliders, 
  LogOut, 
  PlusCircle, 
  User as UserIcon,
  Shield,
  Layers
} from 'lucide-react';
import { User } from 'firebase/auth';

interface HeaderProps {
  user: User;
  activeView: 'scan' | 'history' | 'patterns';
  setActiveView: (view: 'scan' | 'history' | 'patterns') => void;
  scanCount: number;
  reactionCount: number;
  onOpenPreferences: () => void;
  onSignOut: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  activeView,
  setActiveView,
  scanCount,
  reactionCount,
  onOpenPreferences,
  onSignOut,
}) => {
  const shortUid = user.uid ? `U_${user.uid.slice(0, 6).toUpperCase()}` : 'U_ANON';

  return (
    <header className="sticky top-0 z-40 bg-[#0a0a0a] border-b border-[#222] backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-6">
            <button
              id="header-brand-btn"
              onClick={() => setActiveView('scan')}
              className="flex items-center gap-3 text-left group cursor-pointer"
            >
              <div className="w-8 h-8 bg-cyan-500 rounded-sm rotate-45 flex items-center justify-center shadow-[0_0_12px_rgba(6,182,212,0.4)] group-hover:rotate-90 transition-transform duration-300">
                <div className="w-4 h-4 border-2 border-black"></div>
              </div>
              <div>
                <span className="text-xl font-bold tracking-tighter text-white uppercase italic">
                  X-Ray
                </span>
                <span className="hidden sm:inline-block ml-2 text-[10px] font-mono uppercase tracking-widest text-[#666]">
                  Intelligence Engine
                </span>
              </div>
            </button>

            {/* Navigation Tabs */}
            <nav className="hidden md:flex items-center gap-1 bg-[#111] p-1 rounded-xl border border-[#222]">
              <button
                id="nav-tab-scan"
                onClick={() => setActiveView('scan')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
                  activeView === 'scan'
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-400/40 shadow-sm'
                    : 'text-[#888] hover:text-white hover:bg-[#1a1a1a]'
                }`}
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>SCANNER</span>
              </button>

              <button
                id="nav-tab-history"
                onClick={() => setActiveView('history')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
                  activeView === 'history'
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-400/40 shadow-sm'
                    : 'text-[#888] hover:text-white hover:bg-[#1a1a1a]'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>HISTORY</span>
                {scanCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 bg-[#222] text-[#aaa] rounded text-[10px] font-mono">
                    {scanCount}
                  </span>
                )}
              </button>

              <button
                id="nav-tab-patterns"
                onClick={() => setActiveView('patterns')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
                  activeView === 'patterns'
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-400/40 shadow-sm'
                    : 'text-[#888] hover:text-white hover:bg-[#1a1a1a]'
                }`}
              >
                <Dna className="w-3.5 h-3.5" />
                <span>PATTERNS</span>
                {reactionCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 bg-red-900/30 text-red-400 border border-red-900/40 rounded text-[10px] font-mono">
                    {reactionCount}
                  </span>
                )}
              </button>
            </nav>
          </div>

          {/* Right Action buttons */}
          <div className="flex items-center gap-4">
            <button
              id="header-newscan-pill"
              onClick={() => setActiveView('scan')}
              className="hidden lg:inline-flex items-center gap-1.5 text-xs font-mono font-medium text-cyan-400 border border-cyan-400/30 px-3.5 py-1.5 rounded-full hover:bg-cyan-400/10 transition-colors cursor-pointer"
            >
              <span>+ New Scan</span>
            </button>

            <button
              id="header-preferences-btn"
              onClick={onOpenPreferences}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#111] hover:bg-[#1a1a1a] border border-[#222] text-[#888] hover:text-white text-xs font-mono transition-colors cursor-pointer"
              title="Configure Personal Watchlist & Sensitivities"
            >
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Watchlist</span>
            </button>

            {/* User Profile Mini */}
            <div className="flex items-center gap-3 pl-2 border-l border-[#222]">
              <span className="hidden sm:inline text-xs font-mono text-[#888]">
                {shortUid}
              </span>

              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full border border-[#333] object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#161616] border border-[#333] flex items-center justify-center text-[#888]">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}

              <button
                id="header-signout-btn"
                onClick={onSignOut}
                className="p-1.5 rounded-lg text-[#666] hover:text-red-400 hover:bg-red-950/20 transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Sub-Nav */}
        <div className="flex md:hidden items-center justify-around py-2 border-t border-[#222] text-xs font-mono">
          <button
            onClick={() => setActiveView('scan')}
            className={`flex items-center gap-1.5 py-1 px-3 rounded-md ${
              activeView === 'scan' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30' : 'text-[#888]'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Scan</span>
          </button>

          <button
            onClick={() => setActiveView('history')}
            className={`flex items-center gap-1.5 py-1 px-3 rounded-md ${
              activeView === 'history' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30' : 'text-[#888]'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>History ({scanCount})</span>
          </button>

          <button
            onClick={() => setActiveView('patterns')}
            className={`flex items-center gap-1.5 py-1 px-3 rounded-md ${
              activeView === 'patterns' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30' : 'text-[#888]'
            }`}
          >
            <Dna className="w-3.5 h-3.5" />
            <span>Patterns ({reactionCount})</span>
          </button>
        </div>
      </div>
    </header>
  );
};
