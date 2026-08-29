import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Sparkles, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  Sliders, 
  Fingerprint, 
  ExternalLink,
  Layers,
  ArrowRight,
  TrendingDown,
  FileText
} from 'lucide-react';

interface LandingPageProps {
  onSignIn: () => void;
  isLoading: boolean;
  errorMessage?: string | null;
  onClearError?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ 
  onSignIn, 
  isLoading,
  errorMessage,
  onClearError
}) => {
  const [activeTab, setActiveTab] = useState<'inside' | 'data' | 'foryou'>('inside');

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] flex flex-col selection:bg-cyan-500 selection:text-black">
      {/* Top Navbar */}
      <header className="border-b border-[#222] bg-[#0a0a0a] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-cyan-500 rounded-sm rotate-45 flex items-center justify-center shadow-[0_0_12px_rgba(6,182,212,0.4)]">
              <div className="w-4 h-4 border-2 border-black"></div>
            </div>
            <div>
              <span className="text-xl font-bold tracking-tighter text-white uppercase italic">
                X-Ray
              </span>
              <span className="ml-2 text-[10px] font-mono uppercase tracking-widest text-[#666] border border-[#222] px-2 py-0.5 rounded bg-[#111]">
                Intelligence Engine
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="landing-signin-btn-top"
              onClick={onSignIn}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs font-mono transition-all duration-150 shadow-[0_0_15px_rgba(6,182,212,0.3)] active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span>SIGN IN WITH GOOGLE</span>
            </button>
          </div>
        </div>
      </header>

      {/* Optional In-app Alert Notification */}
      {errorMessage && (
        <div className="bg-red-950/80 border-b border-red-800/80 px-4 py-3 text-center text-xs font-mono text-red-200 flex items-center justify-center gap-3">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span>{errorMessage}</span>
          {onClearError && (
            <button
              onClick={onClearError}
              className="text-red-400 hover:text-white underline text-[10px] ml-2 cursor-pointer"
            >
              DISMISS
            </button>
          )}
        </div>
      )}

      {/* Hero Bento Layout */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full space-y-12">
        {/* Top Hero Text */}
        <div className="text-center max-w-3xl mx-auto space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#111] border border-[#222] text-[#888] text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            Multimodal Vision & Real-Time Search Grounding
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight uppercase italic">
            See Through The Label. <br />
            <span className="text-cyan-400">
              Verify Before You Buy.
            </span>
          </h1>

          <p className="text-base text-[#999] max-w-2xl mx-auto leading-relaxed">
            Paste any product link or upload packaging photos. X-Ray deconstructs chemical formulas, compares real-time prices across major retailers, and cross-references your personal logged reaction history.
          </p>

          {/* Primary CTA */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              id="landing-signin-btn-main"
              onClick={onSignIn}
              disabled={isLoading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-3.5 rounded-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-sm font-mono transition-all duration-200 shadow-[0_0_20px_rgba(6,182,212,0.35)] hover:-translate-y-0.5 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span>CONTINUE WITH GOOGLE SIGN-IN</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-center gap-6 text-xs font-mono text-[#666] pt-1">
            <span className="flex items-center gap-1.5 text-green-400">
              <ShieldCheck className="w-4 h-4" />
              Isolated Firestore Data
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5 text-cyan-400">
              <Fingerprint className="w-4 h-4" />
              No Stored Passwords
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5 text-[#aaa]">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              Gemini AI Grounded
            </span>
          </div>
        </div>

        {/* Bento Grid Architecture Showcase */}
        <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-60"></div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#222] pb-5 gap-4">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#666]">
                PIPELINE ARCHITECTURE
              </span>
              <h2 className="text-lg font-bold text-white mt-0.5">Three Autonomous Intelligence Stages</h2>
            </div>
            
            {/* Stage Selector Pills */}
            <div className="flex items-center bg-[#111] p-1 rounded-xl border border-[#222]">
              <button
                id="tab-stage-inside"
                onClick={() => setActiveTab('inside')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                  activeTab === 'inside'
                    ? 'bg-cyan-500 text-black shadow-sm'
                    : 'text-[#888] hover:text-white'
                }`}
              >
                1. INSIDE
              </button>
              <button
                id="tab-stage-data"
                onClick={() => setActiveTab('data')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                  activeTab === 'data'
                    ? 'bg-cyan-500 text-black shadow-sm'
                    : 'text-[#888] hover:text-white'
                }`}
              >
                2. DATA
              </button>
              <button
                id="tab-stage-foryou"
                onClick={() => setActiveTab('foryou')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                  activeTab === 'foryou'
                    ? 'bg-cyan-500 text-black shadow-sm'
                    : 'text-[#888] hover:text-white'
                }`}
              >
                3. FOR YOU (4 Flags)
              </button>
            </div>
          </div>

          <div className="pt-6">
            {activeTab === 'inside' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fadeIn">
                <div className="bg-[#111] p-5 rounded-xl border border-[#222]">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-3 border border-cyan-400/20">
                    <Layers className="w-4 h-4" />
                  </div>
                  <h3 className="text-white font-mono font-semibold text-xs uppercase mb-1">Optical Chemical Parsing</h3>
                  <p className="text-[#888] text-xs leading-relaxed">
                    Deciphers micro-print ingredient lists directly from packaging photos or unrolls complex retailer marketing text.
                  </p>
                </div>

                <div className="bg-[#111] p-5 rounded-xl border border-[#222]">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-3 border border-cyan-400/20">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <h3 className="text-white font-mono font-semibold text-xs uppercase mb-1">Active Concentrations</h3>
                  <p className="text-[#888] text-xs leading-relaxed">
                    Identifies key actives (e.g. 2% Salicylic Acid, 10% Niacinamide) and checks formulation safety ratios.
                  </p>
                </div>

                <div className="bg-[#111] p-5 rounded-xl border border-[#222]">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-3 border border-cyan-400/20">
                    <FileText className="w-4 h-4" />
                  </div>
                  <h3 className="text-white font-mono font-semibold text-xs uppercase mb-1">Claim Verification</h3>
                  <p className="text-[#888] text-xs leading-relaxed">
                    Validates manufacturer claims ("Non-comedogenic", "Hypoallergenic", "Fragrance-Free") against the true chemical manifest.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'data' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fadeIn">
                <div className="bg-[#111] p-5 rounded-xl border border-[#222]">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center mb-3 border border-blue-400/20">
                    <TrendingDown className="w-4 h-4" />
                  </div>
                  <h3 className="text-white font-mono font-semibold text-xs uppercase mb-1">Live Price Arbitrage</h3>
                  <p className="text-[#888] text-xs leading-relaxed">
                    Uses live Google Search Grounding to compare current pricing across Amazon, Sephora, Target, Brand sites, and Walmart.
                  </p>
                </div>

                <div className="bg-[#111] p-5 rounded-xl border border-[#222]">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center mb-3 border border-blue-400/20">
                    <Search className="w-4 h-4" />
                  </div>
                  <h3 className="text-white font-mono font-semibold text-xs uppercase mb-1">Pooled Sentiment Analysis</h3>
                  <p className="text-[#888] text-xs leading-relaxed">
                    Aggregates thousands of verified buyer reviews across platforms to isolate real pros and chronic design defects.
                  </p>
                </div>

                <div className="bg-[#111] p-5 rounded-xl border border-[#222]">
                  <div className="w-8 h-8 rounded-lg bg-yellow-500/10 text-yellow-400 flex items-center justify-center mb-3 border border-yellow-400/20">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <h3 className="text-white font-mono font-semibold text-xs uppercase mb-1">Batch & Formula Alerts</h3>
                  <p className="text-[#888] text-xs leading-relaxed">
                    Detects recent manufacturer reformulation complaints or bad batch alerts reported in recent consumer forums.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'foryou' && (
              <div className="space-y-4 animate-fadeIn">
                <div className="p-3 bg-[#111] border border-[#222] rounded-xl text-xs text-[#aaa] mb-2 font-mono">
                  <strong className="text-cyan-400">Strict Non-Merge Mandate:</strong> X-Ray never collapses risks into a vague single alert. It outputs up to 4 individually sourced flags:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl bg-[#1a1111] border border-red-900/30">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-red-400 font-bold">Flag 1 • Pooled Reviews</span>
                    <h4 className="text-xs font-mono font-bold text-white mt-1">Review-Pattern Flag</h4>
                    <p className="text-xs text-[#888] mt-1">Detects usage patterns in large review corpora (e.g. "Frequent pilling when layered with SPF").</p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#1a1811] border border-yellow-900/30">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-yellow-400 font-bold">Flag 2 • Personal Watchlist</span>
                    <h4 className="text-xs font-mono font-bold text-white mt-1">Ingredient Caution Flag</h4>
                    <p className="text-xs text-[#888] mt-1">Cross-references against your personal sensitivity list (e.g. Niacinamide, Tree Nuts, Essential Oils).</p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#111a11] border border-green-900/30">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-green-400 font-bold">Flag 3 • Ethics & Claims</span>
                    <h4 className="text-xs font-mono font-bold text-white mt-1">Sustainability Flag</h4>
                    <p className="text-xs text-[#888] mt-1">Evaluates verified cruelty-free credentials, vegan claims, and packaging recyclability.</p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#11161a] border border-blue-900/30">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-blue-400 font-bold">Flag 4 • Your Past Scans</span>
                    <h4 className="text-xs font-mono font-bold text-white mt-1">Personal History Flag</h4>
                    <p className="text-xs text-[#888] mt-1">Matches ingredients against your logged past reactions to find exact recurring triggers.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#222] py-6 text-center text-xs font-mono text-[#666]">
        X-RAY INTELLIGENCE PLATFORM • POWERED BY GEMINI & FIREBASE FIRESTORE
      </footer>
    </div>
  );
};
