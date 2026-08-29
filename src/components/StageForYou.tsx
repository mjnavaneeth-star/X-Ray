import React, { useState } from 'react';
import { 
  Sparkles, 
  Leaf, 
  History, 
  MessageSquare, 
  ShieldAlert, 
  Fingerprint,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { ForYouStageData, FlagItem, SeverityLevel } from '../types';

interface StageForYouProps {
  data: ForYouStageData;
  userSensitivitiesCount: number;
  pastReactionsCount: number;
}

export const StageForYou: React.FC<StageForYouProps> = ({
  data,
  userSensitivitiesCount,
  pastReactionsCount,
}) => {
  // Collapsed by default as requested in requirement #4
  const [expandedFlags, setExpandedFlags] = useState<Record<number, boolean>>({});

  const toggleFlag = (flagNumber: number) => {
    setExpandedFlags((prev) => ({
      ...prev,
      [flagNumber]: !prev[flagNumber],
    }));
  };

  const renderFlagCard = (
    flag: FlagItem,
    flagNumber: number,
    icon: React.ReactNode,
    defaultColor: string
  ) => {
    if (!flag) return null;
    const isExpanded = !!expandedFlags[flagNumber];

    const severityConfig: Record<
      SeverityLevel,
      {
        border: string;
        bg: string;
        badgeBg: string;
        badgeText: string;
        iconColor: string;
        statusText: string;
      }
    > = {
      danger: {
        border: 'border-red-900/50 hover:border-red-600/70',
        bg: 'bg-[#180e0e]',
        badgeBg: 'bg-red-950/60',
        badgeText: 'text-red-400 border-red-800/50',
        iconColor: 'text-red-400',
        statusText: 'HIGH RISK',
      },
      warning: {
        border: 'border-yellow-900/50 hover:border-yellow-600/70',
        bg: 'bg-[#18160e]',
        badgeBg: 'bg-yellow-950/60',
        badgeText: 'text-yellow-400 border-yellow-800/50',
        iconColor: 'text-yellow-400',
        statusText: 'CAUTION',
      },
      positive: {
        border: 'border-green-900/50 hover:border-green-600/70',
        bg: 'bg-[#0e1810]',
        badgeBg: 'bg-green-950/60',
        badgeText: 'text-green-400 border-green-800/50',
        iconColor: 'text-green-400',
        statusText: 'POSITIVE',
      },
      neutral: {
        border: 'border-[#222] hover:border-[#444]',
        bg: 'bg-[#111]',
        badgeBg: 'bg-[#181818]',
        badgeText: 'text-[#888] border-[#333]',
        iconColor: 'text-[#666]',
        statusText: 'CLEARED',
      },
    };

    const cfg = severityConfig[flag.severity] || severityConfig.neutral;

    return (
      <div
        id={`for-you-flag-${flagNumber}`}
        className={`rounded-xl border ${cfg.border} ${cfg.bg} transition-all overflow-hidden cursor-pointer select-none`}
        onClick={() => toggleFlag(flagNumber)}
      >
        {/* Compact Collapsed Row */}
        <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`flex-shrink-0 p-1.5 rounded-lg bg-[#0a0a0a] border border-[#222] ${cfg.iconColor}`}>
              {icon}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono font-bold tracking-wider text-[#666] uppercase">
                  FLAG {flagNumber}
                </span>
                <span className="text-[#444]">•</span>
                <span className="text-xs font-mono font-bold text-white uppercase truncate">
                  {flag.label}
                </span>
              </div>
              <div className="text-xs text-[#ccc] font-medium truncate mt-0.5">
                {flag.headline || 'No specific warning triggered'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className={`text-[9px] uppercase font-mono px-2 py-0.5 rounded border ${cfg.badgeBg} ${cfg.badgeText} font-bold`}
            >
              {flag.active ? (flag.severity.toUpperCase()) : 'CLEARED'}
            </span>
            <button
              type="button"
              className="p-1 rounded text-[#777] hover:text-white transition-colors"
              aria-label={isExpanded ? 'Collapse flag' : 'Expand flag'}
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-cyan-400" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Expanded Details on Click */}
        {isExpanded && (
          <div className="px-4 pb-4 pt-1 border-t border-[#1f1f1f] bg-[#0c0c0c]/80 space-y-3 text-xs">
            <div className="flex items-center justify-between pt-2 text-[10px] font-mono text-[#888]">
              <span className="text-[#aaa] font-bold">SOURCE: {flag.source}</span>
              <span className={`font-bold uppercase ${cfg.iconColor}`}>
                STATUS: {flag.active ? 'FLAG TRIGGERED' : 'CLEARED / NEUTRAL'}
              </span>
            </div>

            <p className="text-xs text-[#aaa] leading-relaxed">
              {flag.details}
            </p>

            {flag.metadata && flag.metadata.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {flag.metadata.map((m, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded bg-[#141414] border border-[#222] text-[10px] font-mono text-cyan-400"
                  >
                    {m}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#222]">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 font-mono text-[10px] uppercase tracking-widest font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>STAGE 3: STRICT 4-FLAG PERSONALIZED EVALUATION</span>
          </div>
          <h3 className="text-lg font-bold text-white mt-1">FOR YOU Safety & History Cross-Match</h3>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#888] font-mono">
          <span className="px-2.5 py-1 bg-[#111] rounded border border-[#222]">
            {userSensitivitiesCount} Watchlist Items
          </span>
          <span className="px-2.5 py-1 bg-[#111] rounded border border-[#222]">
            {pastReactionsCount} Past Logged Reactions
          </span>
        </div>
      </div>

      {/* Personalized Executive Synthesis */}
      {data.personalizedSummary && (
        <div className="p-4 rounded-xl bg-[#111] border border-cyan-500/30 text-xs text-cyan-200 leading-relaxed flex items-start gap-3 font-mono">
          <Fingerprint className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-white block mb-0.5 font-bold uppercase">Personal Compatibility Summary:</strong>
            {data.personalizedSummary}
          </div>
        </div>
      )}

      {/* Mandatory 4 Distinct Flags - Compact Collapsed by Default */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-[10px] uppercase font-mono tracking-widest font-bold text-[#666]">
          <span>FOUR DISTINCT RISK & MATCH VECTORS (CLICK TO EXPAND DETAILS):</span>
          <button
            onClick={() => {
              const allExpanded = Object.keys(expandedFlags).length === 4 && Object.values(expandedFlags).every(Boolean);
              if (allExpanded) {
                setExpandedFlags({});
              } else {
                setExpandedFlags({ 1: true, 2: true, 3: true, 4: true });
              }
            }}
            className="text-cyan-400 hover:underline cursor-pointer font-bold lowercase"
          >
            {Object.keys(expandedFlags).length === 4 && Object.values(expandedFlags).every(Boolean)
              ? 'collapse all'
              : 'expand all'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Flag 1: Review-Pattern Flag */}
          {renderFlagCard(
            data.reviewPatternFlag,
            1,
            <MessageSquare className="w-4 h-4" />,
            'amber'
          )}

          {/* Flag 2: Ingredient Caution Flag */}
          {renderFlagCard(
            data.ingredientCautionFlag,
            2,
            <ShieldAlert className="w-4 h-4" />,
            'rose'
          )}

          {/* Flag 3: Sustainability Flag */}
          {renderFlagCard(
            data.sustainabilityFlag,
            3,
            <Leaf className="w-4 h-4" />,
            'emerald'
          )}

          {/* Flag 4: Personal History Flag */}
          {renderFlagCard(
            data.personalHistoryFlag,
            4,
            <History className="w-4 h-4" />,
            'purple'
          )}
        </div>
      </div>
    </div>
  );
};
