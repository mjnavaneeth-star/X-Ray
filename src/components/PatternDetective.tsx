import React, { useState, useEffect } from 'react';
import { 
  Dna, 
  Sparkles, 
  AlertTriangle, 
  Plus, 
  Check, 
  HelpCircle, 
  RefreshCw, 
  ShieldAlert, 
  Flame,
  Layers,
  ArrowRight
} from 'lucide-react';
import { ScanRecord, PatternInsight, UserPreferences } from '../types';

interface PatternDetectiveProps {
  scans: ScanRecord[];
  userPreferences: UserPreferences;
  onAddWatchlistTrigger: (trigger: string) => Promise<void>;
  onNewScan: () => void;
}

export const PatternDetective: React.FC<PatternDetectiveProps> = ({
  scans,
  userPreferences,
  onAddWatchlistTrigger,
  onNewScan,
}) => {
  const [patterns, setPatterns] = useState<PatternInsight[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [addedTriggers, setAddedTriggers] = useState<string[]>([]);

  const reactionScans = scans.filter(
    (s) => s.outcome?.status === 'mild_irritation' || s.outcome?.status === 'reaction'
  );
  const safeScans = scans.filter((s) => s.outcome?.status === 'no_reaction');

  const detectPatterns = async () => {
    if (reactionScans.length === 0) return;
    setIsLoading(true);

    try {
      const res = await fetch('/api/detect-patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reactionScans,
          safeScans,
        }),
      });

      if (!res.ok) throw new Error('Failed to run pattern detection.');
      const data = await res.json();
      setPatterns(data.patterns || []);
      setSummary(data.summary || '');
    } catch (err) {
      console.error('Error detecting patterns:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (reactionScans.length > 0) {
      detectPatterns();
    }
  }, [reactionScans.length]);

  const handleAddToWatchlist = async (trigger: string) => {
    try {
      await onAddWatchlistTrigger(trigger);
      setAddedTriggers((prev) => [...prev, trigger]);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 font-mono text-[10px] uppercase tracking-widest font-bold">
            <Dna className="w-3.5 h-3.5" />
            <span>CROSS-PRODUCT SENSITIVITY SYNTHESIS</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight mt-0.5">
            Pattern Detective
          </h2>
          <p className="text-xs font-mono text-[#666]">
            Gemini cross-references your logged reactions to isolate hidden common culprits across formulations.
          </p>
        </div>

        {reactionScans.length > 0 && (
          <button
            onClick={detectPatterns}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0a0a0a] hover:bg-[#111] border border-[#222] text-[#888] hover:text-white text-xs font-mono font-bold transition-all cursor-pointer self-start sm:self-auto disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>RE-ANALYZE PATTERNS</span>
          </button>
        )}
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-5">
          <div className="text-[10px] font-mono uppercase font-bold text-[#888]">Logged Reaction Scans</div>
          <div className="text-2xl font-bold text-red-400 font-mono mt-1">
            {reactionScans.length}
          </div>
          <div className="text-[10px] font-mono text-[#555] mt-1">
            {reactionScans.filter((s) => s.outcome?.status === 'reaction').length} severe,{' '}
            {reactionScans.filter((s) => s.outcome?.status === 'mild_irritation').length} mild
          </div>
        </div>

        <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-5">
          <div className="text-[10px] font-mono uppercase font-bold text-[#888]">Logged Safe Scans</div>
          <div className="text-2xl font-bold text-green-400 font-mono mt-1">
            {safeScans.length}
          </div>
          <div className="text-[10px] font-mono text-[#555] mt-1">Negative control baseline</div>
        </div>

        <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-5">
          <div className="text-[10px] font-mono uppercase font-bold text-[#888]">Emerging Triggers Found</div>
          <div className="text-2xl font-bold text-cyan-400 font-mono mt-1">
            {patterns.length}
          </div>
          <div className="text-[10px] font-mono text-[#555] mt-1">Common chemical overlap</div>
        </div>
      </div>

      {/* Main Pattern Content */}
      {reactionScans.length === 0 ? (
        <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-10 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#111] border border-[#222] text-cyan-400 flex items-center justify-center mx-auto">
            <Dna className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white font-mono uppercase">No Reaction Logs Recorded Yet</h3>
          <p className="text-xs font-mono text-[#666] max-w-md mx-auto">
            Whenever a product causes redness, itching, or breakouts, log an outcome on its scan report. The Pattern Detective will compare its chemical manifest with all your other scans to find common denominators.
          </p>
          <button
            onClick={onNewScan}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-mono font-bold transition-all cursor-pointer"
          >
            <span>SCAN A PRODUCT TO START</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : isLoading ? (
        <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-12 text-center space-y-3">
          <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div className="text-xs font-mono font-bold text-white">
            DECONSTRUCTING INGREDIENT OVERLAP ACROSS {reactionScans.length} REACTION SCANS...
          </div>
          <div className="text-[10px] font-mono text-[#666]">
            Cross-referencing preservatives, surfactants, fragrance groups, and active acids.
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Executive Summary Card */}
          {summary && (
            <div className="bg-[#0a0a0a] border border-cyan-500/40 rounded-2xl p-5 space-y-2">
              <div className="flex items-center gap-2 text-cyan-400 font-mono text-[10px] uppercase font-bold tracking-widest">
                <Sparkles className="w-3.5 h-3.5" />
                <span>SYNTHESIS INSIGHT</span>
              </div>
              <p className="text-xs text-[#ccc] font-mono leading-relaxed">{summary}</p>
            </div>
          )}

          {/* Detected Triggers List */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold uppercase font-mono tracking-wider text-[#888] flex items-center gap-2">
              <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
              <span>Identified Suspicious Common Denominators ({patterns.length})</span>
            </h3>

            {patterns.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[#0a0a0a] border border-[#222] text-center text-xs font-mono text-[#666]">
                No dominant single culprit detected yet across current logs. As more products are scanned and logged, X-Ray will sharpen its pattern accuracy.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {patterns.map((item, idx) => {
                  const isAdded =
                    addedTriggers.includes(item.triggerName) ||
                    userPreferences.allergiesAndSensitivities?.includes(item.triggerName);

                  return (
                    <div
                      key={idx}
                      className="bg-[#0a0a0a] border border-[#222] hover:border-[#333] rounded-2xl p-5 space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-white font-mono">
                            {item.triggerName}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-red-950/80 text-red-400 border border-red-800 text-[10px] font-mono font-bold">
                            {item.reactionCount} / {item.totalSuspectProducts} Products
                          </span>
                        </div>

                        <p className="text-xs text-[#aaa] font-mono leading-relaxed">
                          {item.explanation}
                        </p>

                        {/* Associated Products */}
                        {item.associatedProducts && item.associatedProducts.length > 0 && (
                          <div className="pt-1">
                            <div className="text-[9px] uppercase font-mono text-[#666] mb-1 font-bold">
                              Present In Your Logged Scans:
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {item.associatedProducts.map((prod, pIdx) => (
                                <span
                                  key={pIdx}
                                  className="px-2 py-0.5 rounded bg-[#111] border border-[#222] text-[10px] font-mono text-[#888] truncate max-w-[200px]"
                                >
                                  {prod}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action to add to personal watchlist */}
                      <div className="pt-3 border-t border-[#222] flex items-center justify-between">
                        <span className="text-[10px] font-mono text-[#666]">
                          {item.recommendedAvoidance || 'Consider watching in future scans.'}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleAddToWatchlist(item.triggerName)}
                          disabled={isAdded}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                            isAdded
                              ? 'bg-green-950 border border-green-800 text-green-400 cursor-default'
                              : 'bg-cyan-500 hover:bg-cyan-400 text-black'
                          }`}
                        >
                          {isAdded ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>ON WATCHLIST</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              <span>ADD TO WATCHLIST</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
