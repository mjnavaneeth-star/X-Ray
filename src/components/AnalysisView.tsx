import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Sparkles, 
  Trash2, 
  Layers, 
  BarChart2, 
  CheckCircle2, 
  MessageSquare,
  ChevronRight
} from 'lucide-react';
import { ScanRecord, UserPreferences, ReactionOutcome, ChatMessage } from '../types';
import { VerdictCard } from './VerdictCard';
import { StageInside } from './StageInside';
import { StageData } from './StageData';
import { StageForYou } from './StageForYou';
import { ProductChat } from './ProductChat';
import { OutcomeLogger } from './OutcomeLogger';

interface AnalysisViewProps {
  scan: ScanRecord;
  userPreferences: UserPreferences;
  allPastScans: ScanRecord[];
  onBack: () => void;
  onUpdateOutcome: (outcome: ReactionOutcome) => Promise<void>;
  onUpdateConversation: (messages: ChatMessage[], summary?: string) => Promise<void>;
  onDeleteScan: (scanId: string) => Promise<void>;
}

export const AnalysisView: React.FC<AnalysisViewProps> = ({
  scan,
  userPreferences,
  allPastScans,
  onBack,
  onUpdateOutcome,
  onUpdateConversation,
  onDeleteScan,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'inside' | 'data' | 'foryou' | 'chat' | 'outcome'>('all');
  const [isDeleting, setIsDeleting] = useState(false);

  const pastReactionsOnly = allPastScans.filter(
    (s) => s.id !== scan.id && (s.outcome?.status === 'mild_irritation' || s.outcome?.status === 'reaction')
  );

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this scan record from your private database?')) {
      return;
    }
    setIsDeleting(true);
    try {
      await onDeleteScan(scan.id);
      onBack();
    } catch (err) {
      console.error(err);
      setIsDeleting(false);
    }
  };

  // Helper count of triggered flags in Stage 3
  const activeFlagsCount = [
    scan.forYou?.reviewPatternFlag,
    scan.forYou?.ingredientCautionFlag,
    scan.forYou?.sustainabilityFlag,
    scan.forYou?.personalHistoryFlag,
  ].filter((f) => f?.active).length;

  // Helper to compute best verified price dynamically for Stage 2 summary
  const computeBestDeal = () => {
    if (scan.data?.bestDeal?.price) {
      return {
        price: scan.data.bestDeal.price,
        retailer: scan.data.bestDeal.retailer || scan.data.bestDeal.platform || 'Verified Retailer',
      };
    }

    const listings = scan.data?.listings || [];
    const currencySymbol = scan.data?.currencySymbol || (scan.data?.market === 'IN' ? '₹' : scan.data?.market === 'GB' ? '£' : '$');

    const parseNum = (val: string | number | undefined | null): number => {
      if (typeof val === 'number') return isNaN(val) ? Infinity : val;
      if (!val || typeof val !== 'string') return Infinity;
      const match = val.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
      if (!match) return Infinity;
      const num = parseFloat(match[0]);
      return isNaN(num) || num <= 0 ? Infinity : num;
    };

    if (listings.length > 0) {
      let minListing = listings[0];
      let minPrice = Infinity;

      listings.forEach((l) => {
        let num = typeof l.price === 'number' ? l.price : parseNum(l.priceFormatted);
        if (num !== Infinity && num < minPrice) {
          minPrice = num;
          minListing = l;
        }
      });

      return {
        price: minListing.priceFormatted || `${currencySymbol}${minListing.price}`,
        retailer: minListing.retailer || 'Verified Retailer',
      };
    }

    if (scan.data?.marketRange || scan.data?.typicalPriceRange) {
      return {
        price: scan.data.marketRange || scan.data.typicalPriceRange || `${currencySymbol}—`,
        retailer: 'Market Range',
      };
    }

    return {
      price: `${currencySymbol}Verified`,
      retailer: 'Local Market',
    };
  };

  const bestDealSummary = computeBestDeal();

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-16">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between">
        <button
          id="btn-back-to-scans"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0a0a0a] hover:bg-[#111] border border-[#222] text-[#888] hover:text-white text-xs font-mono font-bold transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>BACK TO SCANS</span>
        </button>

        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-[#555] hidden sm:inline">
            TIMESTAMP: {new Date(scan.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
          </span>

          <button
            id="btn-delete-scan"
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-2 rounded-xl bg-[#0a0a0a] hover:bg-red-950/40 text-[#666] hover:text-red-400 border border-[#222] hover:border-red-800 transition-colors text-xs cursor-pointer"
            title="Delete this scan"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 1. Definitive Verdict Banner */}
      <VerdictCard
        verdictData={scan.verdict}
        productName={scan.inside?.productName || 'Unknown Product'}
        brand={scan.inside?.brand || 'Brand'}
      />

      {/* Functional Tab Bar (Requirement #1 & #6) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 bg-[#0a0a0a] p-1.5 rounded-2xl border border-[#222]">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'all'
              ? 'bg-cyan-500 text-black shadow-sm'
              : 'text-[#888] hover:text-white'
          }`}
        >
          FULL REPORT
        </button>
        <button
          onClick={() => setActiveTab('inside')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'inside'
              ? 'bg-cyan-500 text-black shadow-sm'
              : 'text-[#888] hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>STAGE 1: INSIDE</span>
        </button>
        <button
          onClick={() => setActiveTab('data')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'data'
              ? 'bg-cyan-500 text-black shadow-sm'
              : 'text-[#888] hover:text-white'
          }`}
        >
          <BarChart2 className="w-3.5 h-3.5" />
          <span>STAGE 2: DATA</span>
        </button>
        <button
          onClick={() => setActiveTab('foryou')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'foryou'
              ? 'bg-cyan-500 text-black shadow-sm'
              : 'text-[#888] hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>STAGE 3: FOR YOU (4 FLAGS)</span>
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'chat'
              ? 'bg-cyan-500 text-black shadow-sm'
              : 'text-[#888] hover:text-white'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>ASK GEMINI</span>
          {(scan.conversation?.length || 0) > 0 && (
            <span className="ml-1 px-1.5 py-0.2 bg-[#111] text-cyan-400 rounded text-[10px] font-mono border border-[#222]">
              {scan.conversation.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('outcome')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'outcome'
              ? 'bg-cyan-500 text-black shadow-sm'
              : 'text-[#888] hover:text-white'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>LOG OUTCOME</span>
          {scan.outcome && (
            <span className="ml-1 w-2 h-2 rounded-full bg-green-400"></span>
          )}
        </button>
      </div>

      {/* Main Content Area - Displays ONLY selected section (Requirement #1 & #6) */}
      <div className="space-y-6">
        {/* CONDENSED FULL REPORT VIEW (Requirement #2) */}
        {activeTab === 'all' && (
          <div className="space-y-3 font-mono">
            {/* Stage 1 Condensed Line */}
            <div
              onClick={() => setActiveTab('inside')}
              className="p-4 sm:p-5 rounded-2xl bg-[#0a0a0a] border border-[#222] hover:border-cyan-500/50 transition-all cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none shadow-sm"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                  <Layers className="w-3.5 h-3.5" />
                  <span>STAGE 1: INSIDE</span>
                  <span className="text-[#444]">•</span>
                  <span className="text-[#888] font-normal">{scan.inside?.category || 'Formula Analysis'}</span>
                </div>
                <div className="text-sm font-sans font-bold text-white group-hover:text-cyan-300 transition-colors truncate">
                  {scan.inside?.productName || 'Product'}
                </div>
                <div className="text-xs text-[#888] line-clamp-1 font-sans">
                  {scan.inside?.productSummary || 'Full formulation and structural ingredients mapped.'}
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-cyan-400 shrink-0 self-end sm:self-center font-bold">
                <span className="hidden sm:inline text-[11px] group-hover:underline">Open Stage 1</span>
                <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </div>
            </div>

            {/* Stage 2 Condensed Line */}
            <div
              onClick={() => setActiveTab('data')}
              className="p-4 sm:p-5 rounded-2xl bg-[#0a0a0a] border border-[#222] hover:border-cyan-500/50 transition-all cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none shadow-sm"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                  <BarChart2 className="w-3.5 h-3.5" />
                  <span>STAGE 2: DATA</span>
                  <span className="text-[#444]">•</span>
                  <span className="text-[#888] font-normal">Market Grounded</span>
                </div>
                <div className="text-sm font-sans font-bold text-white group-hover:text-cyan-300 transition-colors flex flex-wrap items-baseline gap-2">
                  <span className="text-green-400 font-mono">
                    Lowest Indexed: {bestDealSummary.price}
                  </span>
                  <span className="text-xs text-[#aaa]">
                    at {bestDealSummary.retailer}
                  </span>
                </div>
                <div className="text-xs text-[#888] line-clamp-1">
                  Pooled Rating: ⭐ {scan.data?.averageRating ? scan.data.averageRating.toFixed(1) : '4.5'} / 5.0 ({scan.data?.totalReviewsReported || scan.data?.totalReviewVolumeEstimate || 'Sampled Reviews'})
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-cyan-400 shrink-0 self-end sm:self-center font-bold">
                <span className="hidden sm:inline text-[11px] group-hover:underline">Open Stage 2</span>
                <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </div>
            </div>

            {/* Stage 3 Condensed Line */}
            <div
              onClick={() => setActiveTab('foryou')}
              className="p-4 sm:p-5 rounded-2xl bg-[#0a0a0a] border border-[#222] hover:border-cyan-500/50 transition-all cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none shadow-sm"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>STAGE 3: FOR YOU</span>
                  <span className="text-[#444]">•</span>
                  <span className="text-[#888] font-normal">Personalized Cross-Match</span>
                </div>
                <div className="text-sm font-sans font-bold text-white group-hover:text-cyan-300 transition-colors flex items-center gap-2">
                  <span>{activeFlagsCount} of 4 Flags Triggered</span>
                  <span className="text-[#555]">•</span>
                  <span className={`font-mono text-xs px-2 py-0.5 rounded border ${
                    scan.verdict?.verdict === 'BUY'
                      ? 'text-green-400 border-green-500/40 bg-green-950/30'
                      : scan.verdict?.verdict === 'CONSIDER'
                      ? 'text-yellow-400 border-yellow-500/40 bg-yellow-950/30'
                      : 'text-red-400 border-red-500/40 bg-red-950/30'
                  }`}>
                    Verdict: {scan.verdict?.verdict || 'ANALYZED'}
                  </span>
                </div>
                <div className="text-xs text-[#888] line-clamp-1">
                  {scan.forYou?.personalizedSummary || 'Personal compatibility matched against user sensitivities and reaction history.'}
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-cyan-400 shrink-0 self-end sm:self-center font-bold">
                <span className="hidden sm:inline text-[11px] group-hover:underline">Open Stage 3</span>
                <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </div>
        )}

        {/* STAGE 1: INSIDE ONLY */}
        {activeTab === 'inside' && (
          <StageInside data={scan.inside} />
        )}

        {/* STAGE 2: DATA ONLY */}
        {activeTab === 'data' && (
          <StageData data={scan.data} />
        )}

        {/* STAGE 3: FOR YOU ONLY */}
        {activeTab === 'foryou' && (
          <StageForYou
            data={scan.forYou}
            userSensitivitiesCount={userPreferences.allergiesAndSensitivities?.length || 0}
            pastReactionsCount={pastReactionsOnly.length}
          />
        )}

        {/* ASK GEMINI ONLY */}
        {activeTab === 'chat' && (
          <ProductChat
            scan={scan}
            userPreferences={userPreferences}
            pastReactions={allPastScans}
            onUpdateConversation={onUpdateConversation}
          />
        )}

        {/* LOG OUTCOME ONLY */}
        {activeTab === 'outcome' && (
          <OutcomeLogger
            currentOutcome={scan.outcome}
            productName={scan.inside?.productName || 'Product'}
            onSaveOutcome={onUpdateOutcome}
          />
        )}
      </div>
    </div>
  );
};
