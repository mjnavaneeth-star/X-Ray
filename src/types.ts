export type VerdictType = 'BUY' | 'CONSIDER' | 'AVOID';

export type SeverityLevel = 'danger' | 'warning' | 'positive' | 'neutral';

export interface FlagItem {
  active: boolean;
  label: string;
  source: string;
  severity: SeverityLevel;
  headline: string;
  details: string;
  metadata?: string[];
}

export interface InsideStageData {
  productName: string;
  brand: string;
  category: string;
  imageUrl?: string;
  keyIngredientsOrMaterials: string[];
  allIngredientsText?: string;
  claimedBenefits: string[];
  certificationsClaimed: string[];
  productSummary: string;
}

export interface MarketListing {
  retailer: string;
  productName: string;
  variant?: string;
  size?: string;
  price: number | string;
  priceFormatted?: string;
  currency: string;
  currencySymbol?: string;
  unitPrice?: number;
  unitPriceFormatted?: string;
  availability: string; // e.g. "In Stock" | "Check Stock" | "Out of Stock"
  market: string; // e.g. "IN", "US", "GB", "AE"
  country: string; // e.g. "India", "United States", "United Kingdom"
  sourceUrl?: string;
  matchConfidence?: number; // 0.0 to 1.0 (e.g. 0.96)
  isDirectMatch?: boolean;
  notes?: string;
}

export interface BestDealDetail {
  platform: string;
  retailer?: string;
  price: string;
  numericPrice?: number;
  currency?: string;
  currencySymbol?: string;
  unitPriceFormatted?: string;
  size?: string;
  sourceUrl?: string;
  savingsNote?: string;
}

export interface InternationalMarketComparison {
  market: string;
  country: string;
  currency: string;
  currencySymbol: string;
  flagEmoji?: string;
  typicalRange: string;
  bestRetailer: string;
  bestPrice: string;
  sourceUrl?: string;
}

export interface PricePoint {
  platform: string;
  price: string;
  inStock?: boolean;
  notes?: string;
  url?: string;
}

export interface DataStageData {
  // Market Awareness & Location Grounding
  market?: string; // e.g. "IN", "US", "GB", "AE", "GLOBAL"
  country?: string; // e.g. "India", "United States"
  currency?: string; // e.g. "INR", "USD", "GBP", "AED"
  currencySymbol?: string; // e.g. "₹", "$", "£", "AED "
  countryFlag?: string; // e.g. "🇮🇳", "🇺🇸", "🇬🇧", "🇦🇪"
  marketDetectionSource?: string; // e.g. "URL domain detection (amazon.in)", "Retailer TLD", "Inferred location"

  // Listings & Deal Intelligence
  listings?: MarketListing[];
  bestDeal?: BestDealDetail;
  marketRange?: string; // e.g. "₹650 – ₹850"
  averageMarketPrice?: number | string;
  userPrice?: number | string;
  priceDifference?: number | string;
  priceDifferencePercent?: string; // e.g. "-12% vs market avg"
  dataQuality?: 'high' | 'moderate' | 'limited_data';
  limitedDataNotice?: string; // e.g. "Limited local-market data available. Showing verified local listings only."

  // Review Integrity & Evidence Fields
  totalReviewsReported?: string; // e.g. "3,400+ on retailer page"
  sampledReviewCount?: number; // e.g. 24
  sampledReviewBreakdown?: string; // e.g. "Based on 24 indexed customer reviews sampled by X-Ray"

  // Optional International comparisons (when requested or for context)
  internationalComparisons?: InternationalMarketComparison[];

  // Legacy/Compatibility fields
  pricePoints: PricePoint[];
  typicalPriceRange: string;
  averageRating?: number;
  totalReviewVolumeEstimate?: string;
  positiveHighlights: string[];
  recurringCriticisms: string[];
  batchOrFormulaWarnings?: string[];
  searchSources?: { title: string; uri: string }[];
}

export interface ForYouStageData {
  reviewPatternFlag: FlagItem;
  ingredientCautionFlag: FlagItem;
  sustainabilityFlag: FlagItem;
  personalHistoryFlag: FlagItem;
  personalizedSummary: string;
}

export interface ScoringComponent {
  score: number;
  weight: number;
  contribution: number;
  reason: string;
}

export interface VerdictScoringBreakdown {
  totalScore: number;
  thresholds: {
    buy: number;
    consider: number;
  };
  components: {
    personalHistory: ScoringComponent;
    ingredientCaution: ScoringComponent;
    reviewPattern: ScoringComponent;
    sustainability: ScoringComponent;
    marketPricing: ScoringComponent;
    reviewSentiment: ScoringComponent;
  };
  hardOverrideApplied?: string;
  calculatedAt?: string;
}

export interface VerdictData {
  verdict: VerdictType;
  primaryReason: string;
  actionAdvice: string;
  confidenceScore: number; // 0 to 100
  pros: string[];
  cons: string[];
  scoringBreakdown?: VerdictScoringBreakdown;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

export type ReactionOutcomeStatus = 'no_reaction' | 'mild_irritation' | 'reaction';

export interface ReactionOutcome {
  status: ReactionOutcomeStatus;
  loggedAt: string;
  notes?: string;
  symptoms?: string[];
  usedForDays?: number;
}

export interface ScanRecord {
  id: string;
  userId: string;
  createdAt: string;
  inputType: 'url' | 'image' | 'both';
  inputUrl?: string;
  inputImagePreview?: string;
  inside: InsideStageData;
  data: DataStageData;
  forYou: ForYouStageData;
  verdict: VerdictData;
  conversation: ChatMessage[];
  conversationSummary?: string;
  outcome?: ReactionOutcome;
}

export interface UserPreferences {
  skinType?: 'sensitive' | 'dry' | 'oily' | 'combination' | 'normal';
  allergiesAndSensitivities: string[]; // e.g. ["Fragrance/Parfum", "Niacinamide > 5%", "Tree nuts", "Sulfates", "Nickel"]
  sustainabilityPriorities: string[]; // e.g. ["Cruelty-Free / Leaping Bunny", "Vegan", "Refillable Packaging", "Plastic-Free", "Fair Trade"]
  budgetPreference?: 'budget' | 'mid_range' | 'luxury' | 'any';
  healthDietaryNotes?: string;
  customWatchlist: string[];
}

export interface PatternInsight {
  triggerName: string;
  reactionCount: number;
  totalSuspectProducts: number;
  associatedProducts: string[];
  explanation: string;
  recommendedAvoidance: string;
}
