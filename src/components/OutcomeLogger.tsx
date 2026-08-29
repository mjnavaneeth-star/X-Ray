import React, { useState } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Save, 
  Calendar, 
  Clock, 
  FileText, 
  Tag,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { ReactionOutcome, ReactionOutcomeStatus } from '../types';

interface OutcomeLoggerProps {
  currentOutcome?: ReactionOutcome;
  productName: string;
  onSaveOutcome: (outcome: ReactionOutcome) => Promise<void>;
}

const COMMON_SYMPTOMS = [
  'Redness / Flushing',
  'Stinging / Burning',
  'Itching / Pruritus',
  'Breakout / Clogged Pores',
  'Flaking / Dry Patches',
  'Swelling / Puffy Eyes',
  'Pilling / Texture Issues'
];

export const OutcomeLogger: React.FC<OutcomeLoggerProps> = ({
  currentOutcome,
  productName,
  onSaveOutcome,
}) => {
  const [status, setStatus] = useState<ReactionOutcomeStatus>(
    currentOutcome?.status || 'no_reaction'
  );
  const [notes, setNotes] = useState<string>(currentOutcome?.notes || '');
  const [symptoms, setSymptoms] = useState<string[]>(currentOutcome?.symptoms || []);
  const [usedForDays, setUsedForDays] = useState<number>(currentOutcome?.usedForDays || 1);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const toggleSymptom = (sym: string) => {
    setSymptoms((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedSuccess(false);

    try {
      const outcome: ReactionOutcome = {
        status,
        loggedAt: new Date().toISOString(),
        notes: notes.trim() || undefined,
        symptoms: status !== 'no_reaction' ? symptoms : [],
        usedForDays,
      };

      await onSaveOutcome(outcome);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to log outcome:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#222]">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 font-mono text-[10px] uppercase tracking-widest font-bold">
            <Clock className="w-3.5 h-3.5" />
            <span>REAL-WORLD EXPERIENCE TRACKING</span>
          </div>
          <h3 className="text-lg font-bold text-white mt-1">
            Log Your Personal Reaction / Outcome
          </h3>
          <p className="text-xs font-mono text-[#666] mt-0.5">
            Logs are saved strictly to your private Firestore database to train future personal scans and pattern detection.
          </p>
        </div>

        {currentOutcome && (
          <span className="px-3 py-1 rounded bg-[#111] border border-[#222] text-[#888] text-xs font-mono">
            LOGGED: {new Date(currentOutcome.loggedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Outcome Selector 3 Options */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* No Reaction */}
          <button
            id="outcome-opt-no-reaction"
            type="button"
            onClick={() => setStatus('no_reaction')}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 ${
              status === 'no_reaction'
                ? 'bg-[#0e1810] border-green-500 text-white'
                : 'bg-[#111] border-[#222] text-[#888] hover:border-[#333]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold font-mono uppercase text-xs text-green-400">No Reaction</span>
              <CheckCircle2
                className={`w-4 h-4 ${
                  status === 'no_reaction' ? 'text-green-400' : 'text-[#444]'
                }`}
              />
            </div>
            <p className="text-xs text-[#aaa]">
              Safe, well-tolerated, and worked without adverse side effects.
            </p>
          </button>

          {/* Mild Irritation */}
          <button
            id="outcome-opt-mild-irritation"
            type="button"
            onClick={() => setStatus('mild_irritation')}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 ${
              status === 'mild_irritation'
                ? 'bg-[#18160e] border-yellow-500 text-white'
                : 'bg-[#111] border-[#222] text-[#888] hover:border-[#333]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold font-mono uppercase text-xs text-yellow-400">Mild Irritation</span>
              <AlertTriangle
                className={`w-4 h-4 ${
                  status === 'mild_irritation' ? 'text-yellow-400' : 'text-[#444]'
                }`}
              />
            </div>
            <p className="text-xs text-[#aaa]">
              Slight stinging, minor redness, or transient flaking after use.
            </p>
          </button>

          {/* Reaction */}
          <button
            id="outcome-opt-reaction"
            type="button"
            onClick={() => setStatus('reaction')}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 ${
              status === 'reaction'
                ? 'bg-[#180e0e] border-red-500 text-white'
                : 'bg-[#111] border-[#222] text-[#888] hover:border-[#333]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold font-mono uppercase text-xs text-red-400">Reaction</span>
              <XCircle
                className={`w-4 h-4 ${
                  status === 'reaction' ? 'text-red-400' : 'text-[#444]'
                }`}
              />
            </div>
            <p className="text-xs text-[#aaa]">
              Significant breakout, allergic contact dermatitis, itching, or rash.
            </p>
          </button>
        </div>

        {/* Conditional Symptoms checklist for Mild or Severe Reaction */}
        {status !== 'no_reaction' && (
          <div className="p-4 rounded-xl bg-[#111] border border-[#222] space-y-3 font-mono">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#888] flex items-center gap-2">
              <Tag className="w-3.5 h-3.5 text-cyan-400" />
              <span>Observed Symptoms (Select all that apply)</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {COMMON_SYMPTOMS.map((sym, idx) => {
                const isSelected = symptoms.includes(sym);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleSymptom(sym)}
                    className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-500 text-black font-bold'
                        : 'bg-[#0a0a0a] border border-[#222] text-[#888] hover:text-white'
                    }`}
                  >
                    {sym}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Usage Duration & Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#888] mb-1.5">
              Days Used Before Outcome
            </label>
            <input
              type="number"
              min={1}
              max={365}
              value={usedForDays}
              onChange={(e) => setUsedForDays(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full bg-[#111] border border-[#222] rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#888] mb-1.5">
              Personal Reaction Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Applied at night; woke up with forehead redness..."
              className="w-full bg-[#111] border border-[#222] rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-[#555] focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Submit Save Button */}
        <div className="flex items-center justify-between pt-2">
          {savedSuccess ? (
            <span className="text-xs font-mono text-green-400 flex items-center gap-1.5 font-bold">
              <CheckCircle2 className="w-4 h-4" />
              OUTCOME LOGGED TO FIREBASE!
            </span>
          ) : (
            <span className="text-xs font-mono text-[#666]">
              Future scans will cross-reference this log automatically.
            </span>
          )}

          <button
            id="btn-save-outcome"
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black text-xs font-mono font-bold transition-all cursor-pointer"
          >
            {isSaving ? (
              <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>SAVE OUTCOME LOG</span>
          </button>
        </div>
      </form>
    </div>
  );
};
