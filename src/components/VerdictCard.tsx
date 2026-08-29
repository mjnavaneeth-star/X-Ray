import React, { useState } from 'react';
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Sparkles, 
  Check, 
  X as CloseIcon, 
  HelpCircle,
  TrendingUp,
  ShieldAlert,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Cpu
} from 'lucide-react';
import { VerdictData } from '../types';

interface VerdictCardProps {
  verdictData: VerdictData;
  productName: string;
  brand: string;
}

export const VerdictCard: React.FC<VerdictCardProps> = ({
  verdictData,
  productName,
  brand,
}) => {
  const [showAudit, setShowAudit] = useState(false);
  const { verdict, primaryReason, actionAdvice, confidenceScore, pros, cons, scoringBreakdown } = verdictData;

  const isBuy = verdict === 'BUY';
  const isConsider = verdict === 'CONSIDER';
  const isAvoid = verdict === 'AVOID';

  const themeStyles = {
    BUY: {
      bg: 'bg-[#0a0a0a]',
      border: 'border-2 border-emerald-500/40',
      badgeText: 'text-emerald-400',
      badgeBorder: 'border-emerald-500/40',
      textAccent: 'text-emerald-400',
      meterBg: 'bg-emerald-500',
      accentGlow: 'shadow-[0_0_20px_rgba(16,185,129,0.15)]',
      icon: <CheckCircle className="w-6 h-6 text-emerald-400" />,
      tagline: 'Safe, verified match for your profile and market value',
    },
    CONSIDER: {
      bg: 'bg-[#0a0a0a]',
      border: 'border-2 border-yellow-500/40',
      badgeText: 'text-yellow-500',
      badgeBorder: 'border-yellow-500/40',
      textAccent: 'text-yellow-400',
      meterBg: 'bg-yellow-500',
      accentGlow: 'shadow-[0_0_20px_rgba(234,179,8,0.15)]',
      icon: <AlertTriangle className="w-6 h-6 text-yellow-500" />,
      tagline: 'Proceed with caution: formulation or pricing trade-offs detected',
    },
    AVOID: {
      bg: 'bg-[#0a0a0a]',
      border: 'border-2 border-red-500/40',
      badgeText: 'text-red-500',
      badgeBorder: 'border-red-500/40',
      textAccent: 'text-red-400',
      meterBg: 'bg-red-500',
      accentGlow: 'shadow-[0_0_20px_rgba(239,68,68,0.15)]',
      icon: <XCircle className="w-6 h-6 text-red-500" />,
      tagline: 'High incompatibility with your logged reactions or sensitive watchlist',
    },
  }[verdict] || {
    bg: 'bg-[#0a0a0a]',
    border: 'border border-[#222]',
    badgeText: 'text-[#888]',
    badgeBorder: 'border-[#333]',
    textAccent: 'text-[#aaa]',
    meterBg: 'bg-cyan-500',
    accentGlow: '',
    icon: <HelpCircle className="w-6 h-6 text-[#888]" />,
    tagline: 'Analysis complete',
  };

  return (
    <div
      id="verdict-card"
      className={`rounded-2xl ${themeStyles.border} ${themeStyles.bg} ${themeStyles.accentGlow} p-6 sm:p-7 relative overflow-hidden transition-all`}
    >
      {/* Top Scanline accent */}
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-60"></div>

      {/* Main Bento Verdict Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left Verdict Stamp (Bento style) */}
        <div className="lg:col-span-3 flex flex-col items-center justify-center p-4 rounded-xl bg-[#111] border border-[#222] text-center">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#888] mb-1">
            VERDICT
          </span>
          <div className={`text-4xl font-black italic uppercase tracking-tighter ${themeStyles.badgeText}`}>
            {verdict}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-mono text-[#888]">
            {themeStyles.icon}
            <span>Match: {confidenceScore}%</span>
          </div>
        </div>

        {/* Right Info & Reasoning */}
        <div className="lg:col-span-9 space-y-3">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-[#666] mb-1">
              <span>{brand || 'MANUFACTURER'}</span>
              <span>•</span>
              <span className="text-cyan-400">GROUNDED VERIFICATION</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {productName}
            </h2>
          </div>

          <div className="p-4 rounded-xl bg-[#141414] border border-[#222] text-sm text-[#bbb] leading-relaxed">
            <span className="text-white font-bold font-sans mr-1.5">The Reasoning:</span>
            <span>{primaryReason}</span>
          </div>

          {actionAdvice && (
            <div className="flex items-center gap-2 text-xs font-mono text-[#888] bg-[#0e0e0e] px-3.5 py-2 rounded-lg border border-[#1f1f1f]">
              <span className="text-cyan-400 font-bold uppercase">TIP:</span>
              <span className="text-[#ccc]">{actionAdvice}</span>
            </div>
          )}
        </div>
      </div>

      {/* Pros and Cons Mini Bento Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 pt-5 border-t border-[#1f1f1f]">
        {/* Pros */}
        <div className="bg-[#111] border border-[#222] rounded-xl p-4 space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" />
              <span>KEY ADVANTAGES</span>
            </span>
            <span className="text-[#666]">({pros?.length || 0})</span>
          </div>
          <ul className="space-y-1 text-xs text-[#bbb]">
            {pros && pros.length > 0 ? (
              pros.map((p, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-emerald-400">•</span>
                  <span>{p}</span>
                </li>
              ))
            ) : (
              <li className="text-[#666] italic">No major standout benefits found.</li>
            )}
          </ul>
        </div>

        {/* Cons */}
        <div className="bg-[#111] border border-[#222] rounded-xl p-4 space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-widest text-red-400 font-bold flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <CloseIcon className="w-3.5 h-3.5" />
              <span>LIMITATIONS & RISKS</span>
            </span>
            <span className="text-[#666]">({cons?.length || 0})</span>
          </div>
          <ul className="space-y-1 text-xs text-[#bbb]">
            {cons && cons.length > 0 ? (
              cons.map((c, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-red-400">•</span>
                  <span>{c}</span>
                </li>
              ))
            ) : (
              <li className="text-[#666] italic">No major risks identified.</li>
            )}
          </ul>
        </div>
      </div>

      {/* Auditable Deterministic Scoring Breakdown Toggle */}
      {scoringBreakdown && (
        <div className="mt-5 pt-4 border-t border-[#1a1a1a]">
          <button
            type="button"
            onClick={() => setShowAudit(!showAudit)}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-[#0d0d0d] hover:bg-[#141414] border border-[#222] transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-mono font-bold tracking-wider text-[#ccc] uppercase">
                Deterministic Decision Breakdown
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1a1a1a] text-cyan-400 border border-cyan-500/20">
                Score: {scoringBreakdown.totalScore > 0 ? `+${scoringBreakdown.totalScore}` : scoringBreakdown.totalScore}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#777] font-mono">
              <span>{showAudit ? 'Hide Audit' : 'View Audit'}</span>
              {showAudit ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {showAudit && (
            <div className="mt-3 p-4 rounded-xl bg-[#0b0b0b] border border-[#222] space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between text-[11px] font-mono text-[#888] pb-2 border-b border-[#1c1c1c]">
                <span>Component Weights & Factors</span>
                <span className="text-cyan-400">
                  Thresholds: BUY ≥ +{scoringBreakdown.thresholds.buy} | CONSIDER ≥ {scoringBreakdown.thresholds.consider}
                </span>
              </div>

              {scoringBreakdown.hardOverrideApplied && (
                <div className="p-2.5 rounded-lg bg-red-950/30 border border-red-500/40 text-red-400 text-xs font-mono flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <span><strong>Hard Override:</strong> {scoringBreakdown.hardOverrideApplied}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                {/* Personal History */}
                <div className="p-2.5 rounded-lg bg-[#121212] border border-[#1f1f1f] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[#aaa] font-bold">1. Personal History (3.5x)</span>
                    <span className={scoringBreakdown.components.personalHistory.contribution < 0 ? 'text-red-400 font-bold' : scoringBreakdown.components.personalHistory.contribution > 0 ? 'text-emerald-400 font-bold' : 'text-[#777]'}>
                      {scoringBreakdown.components.personalHistory.contribution > 0 ? `+${scoringBreakdown.components.personalHistory.contribution}` : scoringBreakdown.components.personalHistory.contribution}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#888]">{scoringBreakdown.components.personalHistory.reason}</p>
                </div>

                {/* Ingredient Caution */}
                <div className="p-2.5 rounded-lg bg-[#121212] border border-[#1f1f1f] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[#aaa] font-bold">2. Ingredient Caution (2.5x)</span>
                    <span className={scoringBreakdown.components.ingredientCaution.contribution < 0 ? 'text-red-400 font-bold' : scoringBreakdown.components.ingredientCaution.contribution > 0 ? 'text-emerald-400 font-bold' : 'text-[#777]'}>
                      {scoringBreakdown.components.ingredientCaution.contribution > 0 ? `+${scoringBreakdown.components.ingredientCaution.contribution}` : scoringBreakdown.components.ingredientCaution.contribution}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#888]">{scoringBreakdown.components.ingredientCaution.reason}</p>
                </div>

                {/* Review Pattern */}
                <div className="p-2.5 rounded-lg bg-[#121212] border border-[#1f1f1f] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[#aaa] font-bold">3. Review Pattern (1.5x)</span>
                    <span className={scoringBreakdown.components.reviewPattern.contribution < 0 ? 'text-red-400 font-bold' : scoringBreakdown.components.reviewPattern.contribution > 0 ? 'text-emerald-400 font-bold' : 'text-[#777]'}>
                      {scoringBreakdown.components.reviewPattern.contribution > 0 ? `+${scoringBreakdown.components.reviewPattern.contribution}` : scoringBreakdown.components.reviewPattern.contribution}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#888]">{scoringBreakdown.components.reviewPattern.reason}</p>
                </div>

                {/* Sustainability */}
                <div className="p-2.5 rounded-lg bg-[#121212] border border-[#1f1f1f] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[#aaa] font-bold">4. Sustainability (1.0x)</span>
                    <span className={scoringBreakdown.components.sustainability.contribution < 0 ? 'text-red-400 font-bold' : scoringBreakdown.components.sustainability.contribution > 0 ? 'text-emerald-400 font-bold' : 'text-[#777]'}>
                      {scoringBreakdown.components.sustainability.contribution > 0 ? `+${scoringBreakdown.components.sustainability.contribution}` : scoringBreakdown.components.sustainability.contribution}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#888]">{scoringBreakdown.components.sustainability.reason}</p>
                </div>

                {/* Market Pricing */}
                <div className="p-2.5 rounded-lg bg-[#121212] border border-[#1f1f1f] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[#aaa] font-bold">5. Market Pricing (1.5x)</span>
                    <span className={scoringBreakdown.components.marketPricing.contribution < 0 ? 'text-red-400 font-bold' : scoringBreakdown.components.marketPricing.contribution > 0 ? 'text-emerald-400 font-bold' : 'text-[#777]'}>
                      {scoringBreakdown.components.marketPricing.contribution > 0 ? `+${scoringBreakdown.components.marketPricing.contribution}` : scoringBreakdown.components.marketPricing.contribution}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#888]">{scoringBreakdown.components.marketPricing.reason}</p>
                </div>

                {/* Review Sentiment */}
                <div className="p-2.5 rounded-lg bg-[#121212] border border-[#1f1f1f] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[#aaa] font-bold">6. Review Rating (1.5x)</span>
                    <span className={scoringBreakdown.components.reviewSentiment.contribution < 0 ? 'text-red-400 font-bold' : scoringBreakdown.components.reviewSentiment.contribution > 0 ? 'text-emerald-400 font-bold' : 'text-[#777]'}>
                      {scoringBreakdown.components.reviewSentiment.contribution > 0 ? `+${scoringBreakdown.components.reviewSentiment.contribution}` : scoringBreakdown.components.reviewSentiment.contribution}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#888]">{scoringBreakdown.components.reviewSentiment.reason}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
