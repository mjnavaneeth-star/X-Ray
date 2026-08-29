import React, { useState } from 'react';
import { 
  Layers, 
  Tag, 
  Award, 
  FileText, 
  CheckCircle, 
  Search, 
  FlaskConical,
  Sparkles
} from 'lucide-react';
import { InsideStageData } from '../types';

interface StageInsideProps {
  data: InsideStageData;
}

export const StageInside: React.FC<StageInsideProps> = ({ data }) => {
  const [filterQuery, setFilterQuery] = useState('');

  const filteredIngredients = (data.keyIngredientsOrMaterials || []).filter((item) =>
    item.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#222]">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 font-mono text-[10px] uppercase tracking-widest font-bold">
            <Layers className="w-3.5 h-3.5" />
            <span>STAGE 1: FORMULATION & PHYSICAL ARCHITECTURE</span>
          </div>
          <h3 className="text-lg font-bold text-white mt-1">INSIDE Analysis</h3>
        </div>
        <span className="px-3 py-1 rounded bg-[#111] border border-[#222] text-cyan-400 text-xs font-mono">
          Category: {data.category || 'General Consumer Good'}
        </span>
      </div>

      {/* Product Summary */}
      {data.productSummary && (
        <div className="p-4 rounded-xl bg-[#111] border border-[#222] text-xs text-[#aaa] leading-relaxed font-mono">
          <span className="font-bold text-white block mb-1">FORMULA CHARACTERIZATION:</span>
          {data.productSummary}
        </div>
      )}

      {/* Key Actives & Ingredients */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-[11px] font-bold uppercase font-mono tracking-wider text-[#888] flex items-center gap-2">
            <FlaskConical className="w-3.5 h-3.5 text-cyan-400" />
            <span>Key Ingredients & Structural Materials ({data.keyIngredientsOrMaterials?.length || 0})</span>
          </h4>

          {data.keyIngredientsOrMaterials?.length > 5 && (
            <div className="relative w-48">
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filter ingredients..."
                className="w-full pl-7 pr-2 py-1 bg-[#111] border border-[#222] rounded-lg text-xs font-mono text-white placeholder-[#555] focus:outline-none focus:border-cyan-500"
              />
              <Search className="w-3 h-3 text-[#555] absolute left-2 top-2" />
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {filteredIngredients.length > 0 ? (
            filteredIngredients.map((item, idx) => (
              <span
                key={idx}
                className="px-3 py-1.5 rounded-lg bg-[#111] border border-[#222] text-white text-xs font-mono font-medium hover:border-cyan-500/50 transition-colors"
              >
                {item}
              </span>
            ))
          ) : (
            <span className="text-xs font-mono text-[#555]">No matching ingredients found.</span>
          )}
        </div>
      </div>

      {/* Benefits & Claims Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Claimed Benefits */}
        <div className="p-4 rounded-xl bg-[#111] border border-[#222] space-y-2.5">
          <div className="text-[10px] font-bold uppercase font-mono tracking-wider text-[#888] flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-cyan-400" />
            <span>Claimed Functional Benefits</span>
          </div>
          <ul className="space-y-1.5 text-xs text-[#aaa]">
            {data.claimedBenefits && data.claimedBenefits.length > 0 ? (
              data.claimedBenefits.map((b, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-cyan-400 mt-0.5 flex-shrink-0" />
                  <span>{b}</span>
                </li>
              ))
            ) : (
              <li className="text-[#555]">Standard market claims.</li>
            )}
          </ul>
        </div>

        {/* Verified Certifications */}
        <div className="p-4 rounded-xl bg-[#111] border border-[#222] space-y-2.5">
          <div className="text-[10px] font-bold uppercase font-mono tracking-wider text-[#888] flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-yellow-400" />
            <span>Certified Specs & Standards</span>
          </div>
          <ul className="space-y-1.5 text-xs text-[#aaa]">
            {data.certificationsClaimed && data.certificationsClaimed.length > 0 ? (
              data.certificationsClaimed.map((c, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <span>{c}</span>
                </li>
              ))
            ) : (
              <li className="text-[#555]">No independent certifications stated.</li>
            )}
          </ul>
        </div>
      </div>

      {/* Raw Ingredients Text Expandable */}
      {data.allIngredientsText && (
        <details className="bg-[#111] border border-[#222] rounded-xl p-3 text-xs text-[#888]">
          <summary className="cursor-pointer font-mono font-bold text-[#aaa] select-none flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-[#666]" />
            <span>VIEW FULL RAW INGREDIENT INCI / FORMULA TEXT</span>
          </summary>
          <div className="mt-3 p-3 bg-[#0a0a0a] border border-[#222] rounded-lg text-[#888] font-mono text-[11px] leading-relaxed break-words">
            {data.allIngredientsText}
          </div>
        </details>
      )}
    </div>
  );
};
