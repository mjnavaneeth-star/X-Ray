import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  Sparkles, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  ArrowRight, 
  ExternalLink, 
  PlusCircle, 
  Clock, 
  Trash2, 
  Layers, 
  ChevronRight,
  Plus
} from 'lucide-react';
import { ScanRecord, VerdictType, ReactionOutcomeStatus } from '../types';

interface ScanHistoryProps {
  scans: ScanRecord[];
  onSelectScan: (scan: ScanRecord) => void;
  onNewScan: () => void;
  onDeleteScan: (scanId: string) => Promise<void>;
}

export const ScanHistory: React.FC<ScanHistoryProps> = ({
  scans,
  onSelectScan,
  onNewScan,
  onDeleteScan,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [verdictFilter, setVerdictFilter] = useState<'ALL' | VerdictType>('ALL');
  const [outcomeFilter, setOutcomeFilter] = useState<'ALL' | ReactionOutcomeStatus | 'unlogged'>('ALL');

  const filteredScans = scans.filter((s) => {
    const matchesSearch =
      (s.inside?.productName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.inside?.brand || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.inside?.category || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesVerdict = verdictFilter === 'ALL' || s.verdict?.verdict === verdictFilter;

    let matchesOutcome = true;
    if (outcomeFilter === 'unlogged') {
      matchesOutcome = !s.outcome;
    } else if (outcomeFilter !== 'ALL') {
      matchesOutcome = s.outcome?.status === outcomeFilter;
    }

    return matchesSearch && matchesVerdict && matchesOutcome;
  });

  const getVerdictBadge = (verdict: VerdictType) => {
    switch (verdict) {
      case 'BUY':
        return (
          <span className="px-2 py-0.5 rounded bg-green-950/60 border border-green-800/60 text-green-400 text-[10px] font-mono font-bold">
            BUY
          </span>
        );
      case 'CONSIDER':
        return (
          <span className="px-2 py-0.5 rounded bg-yellow-950/60 border border-yellow-800/60 text-yellow-400 text-[10px] font-mono font-bold">
            CONSIDER
          </span>
        );
      case 'AVOID':
        return (
          <span className="px-2 py-0.5 rounded bg-red-950/60 border border-red-800/60 text-red-400 text-[10px] font-mono font-bold">
            AVOID
          </span>
        );
      default:
        return null;
    }
  };

  const getOutcomeBadge = (status?: ReactionOutcomeStatus) => {
    if (!status) {
      return (
        <span className="text-[10px] text-[#555] flex items-center gap-1 font-mono">
          <Clock className="w-3 h-3 text-[#555]" /> UNLOGGED
        </span>
      );
    }

    switch (status) {
      case 'no_reaction':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-green-400 font-bold font-mono uppercase">
            <CheckCircle2 className="w-3 h-3 text-green-400" /> No Reaction
          </span>
        );
      case 'mild_irritation':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-yellow-400 font-bold font-mono uppercase">
            <AlertTriangle className="w-3 h-3 text-yellow-400" /> Mild Irritation
          </span>
        );
      case 'reaction':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-red-400 font-bold font-mono uppercase">
            <XCircle className="w-3 h-3 text-red-400" /> Reaction Logged
          </span>
        );
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 font-bold">ARCHIVE REPOSITORY</div>
          <h2 className="text-xl font-bold text-white tracking-tight mt-0.5">Your Scan History</h2>
          <p className="text-xs font-mono text-[#666]">
            Private Firestore archive of all analyzed formulations, pricing data, and real-world outcomes.
          </p>
        </div>

        <button
          id="btn-history-new-scan"
          onClick={onNewScan}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-mono font-bold transition-all cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>NEW SCAN</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-[#555] absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by product name, brand, or category..."
              className="w-full pl-9 pr-4 py-2 bg-[#111] border border-[#222] rounded-xl text-xs font-mono text-white placeholder-[#555] focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Verdict Filter */}
          <div className="flex items-center gap-1 bg-[#111] p-1 rounded-xl border border-[#222] text-xs">
            <span className="text-[#666] px-2 text-[9px] uppercase font-mono font-bold">VERDICT:</span>
            {(['ALL', 'BUY', 'CONSIDER', 'AVOID'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setVerdictFilter(v)}
                className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                  verdictFilter === v
                    ? 'bg-cyan-500 text-black'
                    : 'text-[#888] hover:text-white'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Outcome Filter row */}
        <div className="flex items-center gap-2 text-xs pt-2 border-t border-[#222] overflow-x-auto">
          <span className="text-[#666] font-mono text-[9px] uppercase font-bold whitespace-nowrap">
            OUTCOME:
          </span>
          <button
            onClick={() => setOutcomeFilter('ALL')}
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer whitespace-nowrap ${
              outcomeFilter === 'ALL'
                ? 'bg-[#222] text-white'
                : 'text-[#666] hover:text-[#aaa]'
            }`}
          >
            ALL ({scans.length})
          </button>
          <button
            onClick={() => setOutcomeFilter('reaction')}
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer whitespace-nowrap ${
              outcomeFilter === 'reaction'
                ? 'bg-red-950/80 border border-red-800 text-red-400'
                : 'text-[#666] hover:text-red-400'
            }`}
          >
            REACTION (
            {scans.filter((s) => s.outcome?.status === 'reaction').length})
          </button>
          <button
            onClick={() => setOutcomeFilter('mild_irritation')}
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer whitespace-nowrap ${
              outcomeFilter === 'mild_irritation'
                ? 'bg-yellow-950/80 border border-yellow-800 text-yellow-400'
                : 'text-[#666] hover:text-yellow-400'
            }`}
          >
            MILD IRRITATION (
            {scans.filter((s) => s.outcome?.status === 'mild_irritation').length})
          </button>
          <button
            onClick={() => setOutcomeFilter('no_reaction')}
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer whitespace-nowrap ${
              outcomeFilter === 'no_reaction'
                ? 'bg-green-950/80 border border-green-800 text-green-400'
                : 'text-[#666] hover:text-green-400'
            }`}
          >
            NO REACTION (
            {scans.filter((s) => s.outcome?.status === 'no_reaction').length})
          </button>
          <button
            onClick={() => setOutcomeFilter('unlogged')}
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer whitespace-nowrap ${
              outcomeFilter === 'unlogged'
                ? 'bg-[#222] text-[#ccc]'
                : 'text-[#555] hover:text-[#888]'
            }`}
          >
            UNLOGGED ({scans.filter((s) => !s.outcome).length})
          </button>
        </div>
      </div>

      {/* Scans List */}
      {filteredScans.length === 0 ? (
        <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#111] border border-[#222] text-[#666] flex items-center justify-center mx-auto">
            <Search className="w-5 h-5 text-[#666]" />
          </div>
          <h3 className="text-base font-bold text-white font-mono uppercase">No scans found</h3>
          <p className="text-xs font-mono text-[#666] max-w-sm mx-auto">
            {searchQuery || verdictFilter !== 'ALL' || outcomeFilter !== 'ALL'
              ? 'No scans match your selected filters. Try clearing the filter criteria.'
              : 'You have not analyzed any products yet. Run your first X-Ray scan to start tracking.'}
          </p>
          <button
            onClick={onNewScan}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 text-black text-xs font-mono font-bold transition-all cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>START FIRST SCAN</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredScans.map((scan) => (
            <div
              key={scan.id}
              onClick={() => onSelectScan(scan)}
              className="bg-[#0a0a0a] hover:bg-[#111] border border-[#222] hover:border-cyan-500/40 rounded-2xl p-4 sm:p-5 transition-all cursor-pointer group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-4 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-[#111] border border-[#222] flex items-center justify-center flex-shrink-0 text-cyan-400 font-mono font-bold text-xs">
                  {scan.inside?.brand ? scan.inside.brand.substring(0, 3).toUpperCase() : 'XRY'}
                </div>

                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap font-mono">
                    {getVerdictBadge(scan.verdict?.verdict || 'CONSIDER')}
                    <span className="text-xs font-bold text-white uppercase">
                      {scan.inside?.brand || 'Brand'}
                    </span>
                    <span className="text-[#444] text-xs">•</span>
                    <span className="text-xs text-[#666]">
                      {new Date(scan.createdAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors truncate">
                    {scan.inside?.productName || 'Scanned Product'}
                  </h3>

                  <p className="text-xs text-[#888] font-mono line-clamp-1">
                    {scan.verdict?.primaryReason || scan.inside?.productSummary}
                  </p>
                </div>
              </div>

              {/* Right status & outcome */}
              <div className="flex items-center gap-4 self-end sm:self-center">
                <div className="text-right">
                  {getOutcomeBadge(scan.outcome?.status)}
                  {scan.data?.bestDeal && (
                    <div className="text-[10px] text-[#666] font-mono mt-0.5">
                      BEST: {scan.data.bestDeal.price} ({scan.data.bestDeal.platform})
                    </div>
                  )}
                </div>

                <div className="w-8 h-8 rounded-xl bg-[#111] border border-[#222] flex items-center justify-center text-[#666] group-hover:text-cyan-400 group-hover:border-cyan-500/40 transition-all">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
