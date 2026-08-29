import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  auth, 
  signInWithGoogle, 
  signOut, 
  getUserPreferences, 
  saveUserPreferences, 
  getUserScans, 
  saveScanRecord, 
  updateScanRecord, 
  deleteScanRecord 
} from './lib/firebase';
import { 
  ScanRecord, 
  UserPreferences, 
  ReactionOutcome, 
  ChatMessage 
} from './types';
import { LandingPage } from './components/LandingPage';
import { Header } from './components/Header';
import { NewScanForm } from './components/NewScanForm';
import { AnalysisView } from './components/AnalysisView';
import { ScanHistory } from './components/ScanHistory';
import { PatternDetective } from './components/PatternDetective';
import { PreferencesModal } from './components/PreferencesModal';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [activeView, setActiveView] = useState<'scan' | 'history' | 'patterns'>('scan');
  
  // Data states
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [activeScan, setActiveScan] = useState<ScanRecord | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>({
    allergiesAndSensitivities: ['Fragrance / Synthetic Parfum', 'High-concentration alcohol denat'],
    sustainabilityPriorities: ['Cruelty-Free / Leaping Bunny', 'Recyclable / Glass Packaging'],
    skinType: 'combination',
    budgetPreference: 'mid_range',
    customWatchlist: [],
  });

  // UI modal states
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // 1. Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setAuthError(null);
        try {
          const [loadedPrefs, loadedScans] = await Promise.all([
            getUserPreferences(currentUser.uid),
            getUserScans(currentUser.uid),
          ]);
          setPreferences(loadedPrefs);
          setScans(loadedScans);
        } catch (err) {
          console.warn('Initial Firestore sync note:', err);
        }
      } else {
        setScans([]);
        setActiveScan(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      const signedInUser = await signInWithGoogle();
      if (!signedInUser) {
        // User closed or cancelled the popup dialog safely
        return;
      }
    } catch (err: any) {
      console.warn('Sign-in notification:', err?.message || err);
      if (err?.message && !err.message.includes('popup-closed-by-user')) {
        setAuthError(err.message);
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setActiveScan(null);
      setActiveView('scan');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  // 2. Scan Analysis Runner
  const handleAnalyze = async (input: {
    url?: string;
    imageBase64?: string;
    imageMimeType?: string;
  }) => {
    if (!user) return;
    setIsAnalyzing(true);

    try {
      // Collect past reaction history for context in Stage 3 [FOR YOU]
      const pastReactionHistory = scans
        .filter((s) => s.outcome?.status === 'mild_irritation' || s.outcome?.status === 'reaction')
        .map((s) => ({
          productName: s.inside?.productName,
          brand: s.inside?.brand,
          category: s.inside?.category,
          ingredients: s.inside?.keyIngredientsOrMaterials,
          outcome: s.outcome,
        }));

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: input.url,
          imageBase64: input.imageBase64,
          imageMimeType: input.imageMimeType,
          userPreferences: preferences,
          pastReactionHistory,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to complete X-Ray analysis.');
      }

      const result = await response.json();

      const newScan: ScanRecord = {
        id: 'scan-' + Date.now(),
        userId: user.uid,
        createdAt: new Date().toISOString(),
        inputType: input.url && input.imageBase64 ? 'both' : input.url ? 'url' : 'image',
        inputUrl: input.url,
        inputImagePreview: input.imageBase64,
        inside: result.inside,
        data: result.data,
        forYou: result.forYou,
        verdict: result.verdict,
        conversation: [],
      };

      // Persist to user-isolated Firestore subcollection
      await saveScanRecord(user.uid, newScan);

      setScans((prev) => [newScan, ...prev]);
      setActiveScan(newScan);
    } catch (err: any) {
      console.error('Analysis error:', err);
      throw err;
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 3. Update Scan Outcome (Reaction Log)
  const handleUpdateOutcome = async (outcome: ReactionOutcome) => {
    if (!user || !activeScan) return;
    const updatedScan: ScanRecord = {
      ...activeScan,
      outcome,
    };
    await updateScanRecord(user.uid, activeScan.id, { outcome });
    setActiveScan(updatedScan);
    setScans((prev) => prev.map((s) => (s.id === activeScan.id ? updatedScan : s)));
  };

  // 4. Update Conversation & Summary
  const handleUpdateConversation = async (messages: ChatMessage[], summary?: string) => {
    if (!user || !activeScan) return;
    const updatedScan: ScanRecord = {
      ...activeScan,
      conversation: messages,
      conversationSummary: summary || activeScan.conversationSummary,
    };
    await updateScanRecord(user.uid, activeScan.id, {
      conversation: messages,
      conversationSummary: summary || activeScan.conversationSummary,
    });
    setActiveScan(updatedScan);
    setScans((prev) => prev.map((s) => (s.id === activeScan.id ? updatedScan : s)));
  };

  // 5. Delete Scan
  const handleDeleteScan = async (scanId: string) => {
    if (!user) return;
    await deleteScanRecord(user.uid, scanId);
    setScans((prev) => prev.filter((s) => s.id !== scanId));
    if (activeScan?.id === scanId) {
      setActiveScan(null);
    }
  };

  // 6. Save User Preferences
  const handleSavePreferences = async (newPrefs: UserPreferences) => {
    if (!user) return;
    await saveUserPreferences(user.uid, newPrefs);
    setPreferences(newPrefs);
  };

  // 7. Add Trigger from Pattern Detective to Watchlist
  const handleAddWatchlistTrigger = async (trigger: string) => {
    if (!user) return;
    const currentList = preferences.allergiesAndSensitivities || [];
    if (!currentList.includes(trigger)) {
      const updatedPrefs: UserPreferences = {
        ...preferences,
        allergiesAndSensitivities: [...currentList, trigger],
      };
      await handleSavePreferences(updatedPrefs);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-[#888] gap-4 font-mono">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
        <div className="text-xs text-white uppercase tracking-wider">Initializing X-Ray Security & Firebase...</div>
      </div>
    );
  }

  // Not signed in: show Landing Page
  if (!user) {
    return (
      <LandingPage 
        onSignIn={handleSignIn} 
        isLoading={isSigningIn} 
        errorMessage={authError}
        onClearError={() => setAuthError(null)}
      />
    );
  }

  const reactionCount = scans.filter(
    (s) => s.outcome?.status === 'mild_irritation' || s.outcome?.status === 'reaction'
  ).length;

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] font-sans flex flex-col selection:bg-cyan-500 selection:text-black">
      {/* Top Header */}
      <Header
        user={user}
        activeView={activeView}
        setActiveView={(view) => {
          setActiveView(view);
          if (view !== 'scan') {
            setActiveScan(null);
          }
        }}
        scanCount={scans.length}
        reactionCount={reactionCount}
        onOpenPreferences={() => setIsPreferencesOpen(true)}
        onSignOut={handleSignOut}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeView === 'scan' && (
          <>
            {activeScan ? (
              <AnalysisView
                key={activeScan.id}
                scan={activeScan}
                userPreferences={preferences}
                allPastScans={scans}
                onBack={() => setActiveScan(null)}
                onUpdateOutcome={handleUpdateOutcome}
                onUpdateConversation={handleUpdateConversation}
                onDeleteScan={handleDeleteScan}
              />
            ) : (
              <NewScanForm
                onAnalyze={handleAnalyze}
                isAnalyzing={isAnalyzing}
                userPreferences={preferences}
                pastReactionsCount={reactionCount}
              />
            )}
          </>
        )}

        {activeView === 'history' && (
          <ScanHistory
            scans={scans}
            onSelectScan={(scan) => {
              setActiveScan(scan);
              setActiveView('scan');
            }}
            onNewScan={() => {
              setActiveScan(null);
              setActiveView('scan');
            }}
            onDeleteScan={handleDeleteScan}
          />
        )}

        {activeView === 'patterns' && (
          <PatternDetective
            scans={scans}
            userPreferences={preferences}
            onAddWatchlistTrigger={handleAddWatchlistTrigger}
            onNewScan={() => {
              setActiveScan(null);
              setActiveView('scan');
            }}
          />
        )}
      </main>

      {/* Preferences Modal */}
      <PreferencesModal
        isOpen={isPreferencesOpen}
        onClose={() => setIsPreferencesOpen(false)}
        preferences={preferences}
        onSave={handleSavePreferences}
      />
    </div>
  );
}
