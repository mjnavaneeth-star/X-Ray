import React, { useState, useRef } from 'react';
import { 
  Link as LinkIcon, 
  UploadCloud, 
  Sparkles, 
  Image as ImageIcon, 
  X, 
  Search, 
  ShieldAlert,
  ArrowRight,
  Layers,
  BarChart2,
  CheckCircle2,
  Cpu
} from 'lucide-react';
import { UserPreferences, ScanRecord } from '../types';

interface NewScanFormProps {
  onAnalyze: (data: {
    url?: string;
    imageBase64?: string;
    imageMimeType?: string;
  }) => Promise<void>;
  isAnalyzing: boolean;
  userPreferences: UserPreferences;
  pastReactionsCount: number;
}

const SAMPLE_PRODUCTS = [
  {
    name: 'Glow Recipe Watermelon Niacinamide Dew Drops',
    url: 'https://www.sephora.com/product/glow-recipe-watermelon-glow-niacinamide-dew-drops-P466123',
    description: 'High viral serum containing 5% Niacinamide and Fragrance blend.',
    category: 'Skincare / Serum'
  },
  {
    name: "CeraVe Moisturizing Cream (with Ceramides & Hyaluronic Acid)",
    url: 'https://www.amazon.com/CeraVe-Moisturizing-Cream-Daily-Moisturizer/dp/B00TTD9BRC',
    description: 'Barrier repair cream with 3 essential ceramides and petrolatum.',
    category: 'Skincare / Moisturizer'
  },
  {
    name: "The Ordinary AHA 30% + BHA 2% Peeling Solution",
    url: 'https://theordinary.com/en-us/aha-30-bha-2-peeling-solution-exfoliator-100400.html',
    description: 'Intense chemical exfoliator with Glycolic, Lactic, and Salicylic acids.',
    category: 'Skincare / Chemical Exfoliant'
  },
  {
    name: "Briogeo Don't Despair, Repair! Deep Conditioning Hair Mask",
    url: 'https://briogeohair.com/products/dont-despair-repair-deep-conditioning-mask',
    description: 'Clean hair mask featuring rosehip, sweet almond, and argan oils with B-vitamins.',
    category: 'Haircare / Treatment'
  }
];

export const NewScanForm: React.FC<NewScanFormProps> = ({
  onAnalyze,
  isAnalyzing,
  userPreferences,
  pastReactionsCount,
}) => {
  const [url, setUrl] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>('image/jpeg');
  const [error, setError] = useState<string | null>(null);
  const [currentStage, setCurrentStage] = useState<number>(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cycle animation stages when analyzing
  React.useEffect(() => {
    if (!isAnalyzing) {
      setCurrentStage(1);
      return;
    }
    const interval = setInterval(() => {
      setCurrentStage((prev) => (prev >= 3 ? 1 : prev + 1));
    }, 2800);
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file (PNG, JPEG, WebP).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Image size exceeds 10MB limit.');
      return;
    }

    setError(null);
    setImageMimeType(file.type);

    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please drop a valid image file.');
      return;
    }

    setImageMimeType(file.type);
    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() && !imagePreview) {
      setError('Please provide either a product link or upload an image.');
      return;
    }

    setError(null);
    try {
      await onAnalyze({
        url: url.trim() || undefined,
        imageBase64: imagePreview || undefined,
        imageMimeType: imagePreview ? imageMimeType : undefined,
      });
    } catch (err: any) {
      setError(err.message || 'Analysis failed. Please try again.');
    }
  };

  const clearImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Personalized Context Banner */}
      <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2 text-[#aaa]">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
          <span>
            <strong className="text-white">ACTIVE PROFILE:</strong>{' '}
            {userPreferences.allergiesAndSensitivities?.length > 0 ? (
              <span className="text-cyan-400">
                {userPreferences.allergiesAndSensitivities.length} sensitivities monitored
              </span>
            ) : (
              <span className="text-[#666]">Standard profile</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-4 text-[#888]">
          <span>
            <strong className="text-white">REACTIONS LOGGED:</strong>{' '}
            <span className="text-red-400 font-bold">
              {pastReactionsCount}
            </span>
          </span>
          <span className="hidden sm:inline text-[#444]">|</span>
          <span className="text-green-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Engine Ready
          </span>
        </div>
      </div>

      {/* Main Scan Form Card (Bento Container) */}
      <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-40"></div>

        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#222] pb-4">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#666]">
              INPUT PAYLOAD
            </span>
            <h2 className="text-xl font-bold text-white tracking-tight mt-0.5">
              New X-Ray Product Scan
            </h2>
          </div>
          <span className="text-[10px] font-mono text-[#666] border border-[#222] px-2 py-0.5 rounded bg-[#111]">
            MULTIMODAL INGESTION
          </span>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs font-mono flex items-center gap-3">
            <ShieldAlert className="w-4 h-4 flex-shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* URL Input */}
          <div className="space-y-2">
            <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#888]">
              Product Web Link (Amazon, Sephora, Target, Brand Site)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#555]">
                <LinkIcon className="w-4 h-4" />
              </div>
              <input
                id="input-product-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.sephora.com/product/... or https://amazon.com/dp/..."
                className="w-full pl-10 pr-4 py-3 bg-[#111] border border-[#222] rounded-xl text-white placeholder-[#555] text-xs font-mono focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                disabled={isAnalyzing}
              />
              {url && (
                <button
                  type="button"
                  onClick={() => setUrl('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#555] hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-[#222]"></div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#555]">AND / OR</span>
            <div className="flex-1 h-px bg-[#222]"></div>
          </div>

          {/* Image Upload Zone */}
          <div className="space-y-2">
            <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#888]">
              Upload Packaging / Ingredient Label Photo
            </label>

            {imagePreview ? (
              <div className="relative rounded-xl border border-[#222] bg-[#111] p-3 flex items-center gap-4">
                <img
                  src={imagePreview}
                  alt="Product preview"
                  className="w-20 h-20 object-cover rounded-lg border border-[#333]"
                />
                <div className="flex-1 min-w-0 font-mono">
                  <div className="text-xs font-bold text-white truncate">IMAGE ATTACHED</div>
                  <div className="text-[11px] text-[#888] mt-0.5">
                    Ready for optical chemical parsing & formula deconstruction
                  </div>
                </div>
                <button
                  id="btn-remove-image"
                  type="button"
                  onClick={clearImage}
                  disabled={isAnalyzing}
                  className="p-2 rounded-lg bg-[#222] hover:bg-red-950 hover:text-red-300 text-[#888] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#222] hover:border-cyan-500/50 bg-[#0d0d0d] hover:bg-[#111] rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all duration-150 group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-xl bg-[#161616] group-hover:bg-cyan-500/10 text-[#666] group-hover:text-cyan-400 flex items-center justify-center mx-auto mb-3 transition-colors border border-[#222]">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div className="text-xs font-mono font-bold text-white">
                  DRAG & DROP PACKAGING IMAGE, OR <span className="text-cyan-400 underline">BROWSE</span>
                </div>
                <div className="text-[11px] font-mono text-[#666] mt-1">
                  Supports bottle labels, ingredient lists, box backs, or bottle fronts (JPG, PNG, WebP)
                </div>
              </div>
            )}
          </div>

          {/* Submit Button & Progress State */}
          {isAnalyzing ? (
            <div className="bg-[#111] border border-[#222] rounded-xl p-5 space-y-4 font-mono">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Running 3-Stage X-Ray Analysis...
                  </span>
                </div>
                <span className="text-[10px] text-cyan-400 font-bold border border-cyan-500/30 px-2 py-0.5 rounded bg-cyan-950/20">
                  STAGE {currentStage} OF 3
                </span>
              </div>

              {/* Progress Steps Indicators */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div
                  className={`p-2.5 rounded-lg border transition-all ${
                    currentStage === 1
                      ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-200'
                      : currentStage > 1
                      ? 'bg-[#161616] border-[#222] text-[#888]'
                      : 'bg-[#0a0a0a] border-[#1a1a1a] text-[#444]'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5 text-[11px]">
                    <Layers className="w-3 h-3 text-cyan-400" />
                    1. INSIDE
                  </div>
                  <div className="text-[10px] text-[#666] mt-0.5 truncate">
                    Chemical manifest...
                  </div>
                </div>

                <div
                  className={`p-2.5 rounded-lg border transition-all ${
                    currentStage === 2
                      ? 'bg-blue-950/40 border-blue-500/50 text-blue-200'
                      : currentStage > 2
                      ? 'bg-[#161616] border-[#222] text-[#888]'
                      : 'bg-[#0a0a0a] border-[#1a1a1a] text-[#444]'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5 text-[11px]">
                    <BarChart2 className="w-3 h-3 text-blue-400" />
                    2. DATA
                  </div>
                  <div className="text-[10px] text-[#666] mt-0.5 truncate">
                    Search grounding prices...
                  </div>
                </div>

                <div
                  className={`p-2.5 rounded-lg border transition-all ${
                    currentStage === 3
                      ? 'bg-green-950/40 border-green-500/50 text-green-200'
                      : 'bg-[#0a0a0a] border-[#1a1a1a] text-[#444]'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5 text-[11px]">
                    <Sparkles className="w-3 h-3 text-green-400" />
                    3. FOR YOU
                  </div>
                  <div className="text-[10px] text-[#666] mt-0.5 truncate">
                    Cross-checking 4 flags...
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <button
              id="btn-start-analysis"
              type="submit"
              disabled={(!url.trim() && !imagePreview) || isAnalyzing}
              className="w-full py-3.5 px-6 rounded-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold text-xs font-mono transition-all duration-150 shadow-[0_0_20px_rgba(6,182,212,0.3)] flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              <Cpu className="w-4 h-4" />
              <span>EXECUTE X-RAY ANALYSIS</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </form>
      </div>

      {/* Quick Sample Products Picker */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#666]">
            QUICK SAMPLE INGESTION
          </h3>
          <span className="text-[10px] font-mono text-[#555]">1-Click Autofill</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SAMPLE_PRODUCTS.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setUrl(item.url);
                setError(null);
              }}
              disabled={isAnalyzing}
              className="p-3.5 rounded-xl bg-[#0a0a0a] hover:bg-[#111] border border-[#222] hover:border-[#333] text-left transition-all group cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-mono font-bold text-white group-hover:text-cyan-400 transition-colors line-clamp-1">
                  {item.name}
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#161616] text-[#888] font-mono whitespace-nowrap border border-[#222]">
                  {item.category.split('/')[1] || item.category}
                </span>
              </div>
              <p className="text-[11px] text-[#888] mt-1 line-clamp-2">{item.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
