import React, { useState } from 'react';
import { 
  X, 
  Sliders, 
  Plus, 
  Trash2, 
  Check, 
  Save, 
  Leaf, 
  ShieldAlert, 
  Sparkles,
  DollarSign
} from 'lucide-react';
import { UserPreferences } from '../types';

interface PreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: UserPreferences;
  onSave: (prefs: UserPreferences) => Promise<void>;
}

const COMMON_SENSITIVITIES_SUGGESTIONS = [
  'Fragrance / Synthetic Parfum',
  'Essential Oils (Citrus/Lavender)',
  'High-Concentration Niacinamide (>5%)',
  'Alcohol Denat / SD Alcohol',
  'Sulfates (SLS / SLES)',
  'Chemical Sunscreen (Avobenzone/Octinoxate)',
  'Phenoxyethanol',
  'Tree Nuts / Nut Oils',
  'Bismuth Oxychloride',
  'Lanolin / Wool Fat',
  'Silicones (Dimethicone / Cyclopentasiloxane)'
];

const SUSTAINABILITY_OPTIONS = [
  'Cruelty-Free / Leaping Bunny',
  '100% Vegan Formula',
  'Recyclable / Glass Packaging',
  'Plastic-Free / Refillable',
  'Fair Trade Certified',
  'Reef-Safe Formulation'
];

export const PreferencesModal: React.FC<PreferencesModalProps> = ({
  isOpen,
  onClose,
  preferences,
  onSave,
}) => {
  const [allergies, setAllergies] = useState<string[]>(
    preferences.allergiesAndSensitivities || []
  );
  const [sustainability, setSustainability] = useState<string[]>(
    preferences.sustainabilityPriorities || []
  );
  const [skinType, setSkinType] = useState<UserPreferences['skinType']>(
    preferences.skinType || 'combination'
  );
  const [budget, setBudget] = useState<UserPreferences['budgetPreference']>(
    preferences.budgetPreference || 'mid_range'
  );
  const [newSensitivityInput, setNewSensitivityInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleAddSensitivity = () => {
    const trimmed = newSensitivityInput.trim();
    if (trimmed && !allergies.includes(trimmed)) {
      setAllergies([...allergies, trimmed]);
      setNewSensitivityInput('');
    }
  };

  const handleRemoveSensitivity = (item: string) => {
    setAllergies(allergies.filter((a) => a !== item));
  };

  const toggleSuggestion = (item: string) => {
    if (allergies.includes(item)) {
      setAllergies(allergies.filter((a) => a !== item));
    } else {
      setAllergies([...allergies, item]);
    }
  };

  const toggleSustainability = (item: string) => {
    if (sustainability.includes(item)) {
      setSustainability(sustainability.filter((s) => s !== item));
    } else {
      setSustainability([...sustainability, item]);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        allergiesAndSensitivities: allergies,
        sustainabilityPriorities: sustainability,
        skinType,
        budgetPreference: budget,
        customWatchlist: allergies,
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div
        className="bg-[#0a0a0a] border border-[#222] rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#222]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#111] border border-[#222] text-cyan-400 flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 font-bold">CALIBRATION ENGINE</div>
              <h3 className="text-base font-bold text-white mt-0.5">Personal Sensitivity & Profile Settings</h3>
              <p className="text-xs font-mono text-[#666]">
                Calibrate how X-Ray flags ingredients and evaluates sustainability in Stage 3 [FOR YOU].
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#666] hover:text-white hover:bg-[#111] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm">
          {/* Watchlist & Sensitivities */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase font-mono tracking-wider text-[#888] flex items-center gap-2">
                <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                <span>Ingredient Watchlist & Known Sensitivities ({allergies.length})</span>
              </label>
            </div>

            {/* Custom Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newSensitivityInput}
                onChange={(e) => setNewSensitivityInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSensitivity())}
                placeholder="Type custom ingredient or allergen (e.g. Parabens, Retinol)..."
                className="flex-1 bg-[#111] border border-[#222] rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder-[#555] focus:outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={handleAddSensitivity}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>ADD</span>
              </button>
            </div>

            {/* Active Chips */}
            <div className="flex flex-wrap gap-2 pt-1">
              {allergies.map((item, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-[#180e0e] border border-red-900/60 text-red-300 text-xs font-mono"
                >
                  <span>{item}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSensitivity(item)}
                    className="hover:text-white cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            {/* Quick Suggestions */}
            <div className="pt-2">
              <div className="text-[9px] text-[#666] mb-2 font-mono uppercase font-bold">
                Quick Toggle Common Watchlist Items:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_SENSITIVITIES_SUGGESTIONS.map((sug, idx) => {
                  const isActive = allergies.includes(sug);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleSuggestion(sug)}
                      className={`px-2.5 py-1 rounded text-xs font-mono transition-all cursor-pointer ${
                        isActive
                          ? 'bg-red-500 text-white font-bold'
                          : 'bg-[#111] border border-[#222] text-[#888] hover:text-white'
                      }`}
                    >
                      {sug}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sustainability & Ethics */}
          <div className="space-y-3 pt-4 border-t border-[#222]">
            <label className="text-[10px] font-bold uppercase font-mono tracking-wider text-[#888] flex items-center gap-2">
              <Leaf className="w-3.5 h-3.5 text-green-400" />
              <span>Sustainability & Ethics Priorities</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SUSTAINABILITY_OPTIONS.map((item, idx) => {
                const isSelected = sustainability.includes(item);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleSustainability(item)}
                    className={`p-3 rounded-xl border text-left flex items-center justify-between text-xs font-mono transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#0e1810] border-green-500 text-white font-bold'
                        : 'bg-[#111] border-[#222] text-[#888] hover:text-white'
                    }`}
                  >
                    <span>{item}</span>
                    {isSelected ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Plus className="w-4 h-4 text-[#444]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Skin Type & Budget Preferences */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#222]">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase font-mono tracking-wider text-[#888]">
                Skin Profile
              </label>
              <select
                value={skinType}
                onChange={(e) => setSkinType(e.target.value as any)}
                className="w-full bg-[#111] border border-[#222] rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="sensitive">Sensitive / Reactive</option>
                <option value="combination">Combination</option>
                <option value="dry">Dry / Dehydrated</option>
                <option value="oily">Oily / Acne-Prone</option>
                <option value="normal">Normal / Balanced</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase font-mono tracking-wider text-[#888]">
                Budget Target
              </label>
              <select
                value={budget}
                onChange={(e) => setBudget(e.target.value as any)}
                className="w-full bg-[#111] border border-[#222] rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="budget">Budget-Friendly (Drugstore / Value)</option>
                <option value="mid_range">Mid-Range / Premium Clean</option>
                <option value="luxury">Luxury / High-End</option>
                <option value="any">Any / Price-Agnostic</option>
              </select>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t border-[#222] bg-[#050505] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-mono font-bold text-[#666] hover:text-white transition-colors cursor-pointer"
          >
            CANCEL
          </button>

          <button
            id="btn-save-preferences"
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black text-xs font-mono font-bold transition-all cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'SAVING...' : 'SAVE WATCHLIST PROFILE'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
