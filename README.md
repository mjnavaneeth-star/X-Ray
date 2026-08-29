# 🔍 X-Ray

### See it. Understand it. Decide.

**Google tells you what's out there. X-Ray tells you what's safe for *you* — and remembers it.**

Built for the **Google Cloud Gen AI Academy APAC Ideathon** (Cloud Run Build & Deploy Social Challenge, run by Google Cloud with Hack2skill).

🔗 **Live App:** https://x-ray-1045735169186.us-west2.run.app/
📦 **Repo:** you're in it
🏷️ **Verified:** `dev-tutorial=cloud-run-ai-challenge`

---

## The Problem With Every Other Product Scanner

Point any shopping app or Google Lens at a skincare product and you'll get the same thing everyone else gets: a star rating pooled from millions of strangers, and the cheapest price. That's it. It doesn't know you have a history of reacting to fragrance. It doesn't know you specifically care about cruelty-free packaging over price. It has no concept of "you" at all — only a query.

**X-Ray is built around a different question: not "what is this product," but "what does this product mean for the person holding it."**

That's not a tagline — it's the actual architecture. Every layer of this app either builds toward that personal judgment, or explicitly refuses to pretend it knows something it doesn't.

---

## What X-Ray Actually Does

Sign in, paste a product link or snap a photo of the packaging. X-Ray runs it through a three-stage evidence chain, visible top to bottom so the reasoning is never a black box:

### 🔬 Stage 1 — INSIDE: *What is it?*
Gemini vision + search identifies the exact product: brand, formulation, category, pack size, full ingredient list, and claimed benefits — pulled from the product image, URL metadata, or page title, with a multi-layered fallback so a valid product link reliably resolves to a real identification instead of dead-ending on "URL inaccessible."

### 📊 Stage 2 — DATA: *What does the outside world say?*
Gemini + Google Search grounding pulls **live price comparisons across Amazon India, Nykaa, and Flipkart** side by side, plus pooled review sentiment sampled from real customer feedback. Region is auto-detected from domain/locale — no hardcoded country list.

This is also where X-Ray's honesty-first design shows up hardest: prices are extracted **only** from what's literally present in a grounded search result — never estimated, rounded, or guessed. If a retailer's exact SKU price can't be confirmed, the card says **"Price unavailable"** or **"Not found"** in plain amber text, rather than silently showing a plausible-but-wrong number. A visible disclaimer — *"Prices are sourced from indexed search data and may lag behind live listings"* — sets honest expectations rather than implying false certainty. Two-out-of-three retailer confirmation is enough to compute a fair market-price signal; the system doesn't collapse to "unknown" just because one source came back empty.

### 🎯 Stage 3 — FOR YOU: *What does it mean for you, specifically?*
This is the actual product. Gemini reasons over the user's own stored profile and reaction history — pulled from **user-isolated Firestore**, never shared or pooled across accounts — to surface four **distinct, separately-sourced flags**. They are never merged into one generic "warning" block, because that visual separation is what makes the personalization claim credible:

| Flag | Answers | Sourced From |
|---|---|---|
| **Review-Pattern** | What do other buyers report? | Pooled, sampled consumer reviews — states its actual sample size (e.g. "5 of 24 sampled reviews"), never implying a full read |
| **Ingredient Caution** | Does this contain something commonly flagged? | Ingredient watchlists — named and sourced, never a fabricated numeric "toxicity score" |
| **Sustainability & Ethics** | Is this cruelty-free / eco-certified? | Third-party certifications & attributions |
| **Personal History** ⭐ | Does this match *your own* past reactions? | The user's own logged outcomes — nothing else can offer this |

The **Personal History flag is weighted most heavily** in the final verdict — deliberately — because it's the single most specific piece of evidence available. No competitor tool, no matter how much review data it pools, can know what happened the last time *this exact person* used a fragranced serum. That's the moat.

### ⚖️ The Verdict: BUY / CONSIDER / AVOID
Here's the part most AI product demos get wrong: **the verdict is not the model "vibing" a decision on every call.**

X-Ray's verdict engine is a **deterministic, auditable scoring system**. Each flag contributes a fixed, weighted score (personal history weighted heaviest, then ingredient caution, review pattern, sustainability, market pricing, and review sentiment), summed against fixed BUY/CONSIDER/AVOID thresholds. Gemini's only job at this stage is to write the plain-language explanation for a result that's already been computed — not to decide the label itself.

**This was explicitly tested for determinism**: the same product scanned against the same user profile multiple times in a row reliably returns the identical verdict, identical score, identical confidence — proven during development by running repeated back-to-back scans and comparing raw scoring breakdowns. The reasoning text may vary in phrasing; the verdict itself never does. That reproducibility is a deliberate engineering choice, not an accident.

### 💬 Multi-Turn Conversation
After the verdict, the scan opens into a real conversation — not a dead end. Ask Gemini follow-up questions ("is this okay with retinol?", "why exactly was this flagged?") and it answers with the full scan context already loaded: the product's ingredients, evidence, and *your* profile and reaction history — so answers are grounded and specific, never generic. When the conversation ends, Gemini auto-generates a short executive-summary takeaway, and both the raw thread and its summary are saved to Firestore under that scan's document.

### 📝 Closing the Loop
After using a product, the user logs a real-world outcome — no reaction, mild irritation, or reaction — in a few taps. This is what feeds the Personal History flag on every future scan, and it's what makes X-Ray get *more* accurate about *that specific person* the longer they use it. A pattern-detection layer cross-references reaction logs across all of a user's scans to surface recurring culprits (e.g. "you've reacted to 2 of your last 3 fragranced products").

---

## The User Preference Profile

Personalization here is **explicit, not inferred.** Set once, stored in Firestore, isolated per account — this is what all four flags actually check against:

- **Sensitivity flags** — free-entry list of ingredients/categories the user reacts to (not a fixed dropdown; sensitivities are individual, not categorical)
- **Vegan / cruelty-free preference** — on/off, checked against the sustainability flag's sourced claims
- **Value-for-money priority** — low/medium/high weighting for how much price influences the verdict
- **Ingredient caution sensitivity** — how strictly the watchlist flag is applied ("only well-documented concerns" vs. "flag anything commonly discussed")
- **Sustainability priority** — how much cruelty-free/eco claims weigh in the final call

Deliberately **five parameters, not fifteen** — every additional parameter is another thing the reasoning has to weigh and another thing the UI has to display cleanly, and five is enough to make the FOR YOU layer feel genuinely personal without becoming a sprawling settings screen.

**Notably absent by design:** a numeric "toxicity" tolerance. X-Ray never computes or displays a pseudo-scientific safety score — that would violate its own honesty rule. The user controls *how strictly* ingredient mentions are surfaced, not a fake number pretending to quantify risk.

---

## Why This Isn't Just Google Shopping

Google can already show the same product across platforms with a price — that's not a differentiator, and it's not the headline here. What generic shopping tools structurally cannot do:

1. **Personalize to one person's actual sensitivities** — not a generic star average.
2. **Remember what happened to *that specific person* before** — a search engine has no concept of "you," only a query.
3. **Explain a downgraded recommendation in sourced, plain language** — not just a number, but *"Consider — this matches your own reaction pattern: you've reacted to 2 of your last 3 fragranced products, and this one lists parfum."*

Price and pooled reviews are supporting evidence that make the personal layer's conclusions credible — they are never the headline.

---

## Design System

A deliberate **dark diagnostic/scan-panel aesthetic** — built to feel like a device readout giving you a verdict, not a shopping page. Space Grotesk for the verdict word, IBM Plex Mono for labels/prices/confidence percentages (reinforcing the "evidence" feel), color-coded verdict states (green BUY, amber CONSIDER, red AVOID). Each evidence layer is a numbered, bordered card with its own guiding question in the header — INSIDE → DATA → FOR YOU (four separate flag cards) → verdict banner as the visual climax, with a stat strip along the bottom (price / rating / the user's own reaction ratio).

---

## Technical Architecture

| Layer | Technology | Role |
|---|---|---|
| Frontend/Backend | Google AI Studio Build Mode → **Cloud Run** | Signed-in web app, deployed as a container |
| Auth | **Firebase Authentication** | Google Sign-In only — federated identity, zero stored passwords |
| Database | **Cloud Firestore** | User-isolated storage: preferences, scan history, conversations, reaction outcomes |
| AI | **Gemini API** | Vision (INSIDE), search-grounded reasoning (DATA), personalization + flag logic (FOR YOU), multi-turn chat |
| Model resilience | Fallback ladder | `gemini-3.6-flash` → `gemini-3.1-flash-lite` → `gemini-flash-latest` → `gemini-3.7-flash`, with a secondary provider fallback if the entire Gemini chain is exhausted — the app degrades gracefully under quota pressure instead of failing outright |
| Evidence | **Google Search grounding** | Live price comparison, review pooling, ingredient/sustainability watchlist lookups |
| Secrets | **Google Cloud Secret Manager** | Gemini API key — never hardcoded, never client-side |

### Engineering decisions worth knowing about
- **Resilient JSON parsing**: price-grounding responses are parsed defensively — extracting a valid JSON object even from a response that includes surrounding explanatory text — rather than crashing outright when a fallback model doesn't return perfectly clean JSON.
- **Per-scan state isolation**: every new scan fully clears prior scan state before populating results, across every section (INSIDE, DATA, all four flags, verdict) — verified by scanning multiple distinct products back-to-back and confirming zero data bleed between them.
- **Honest degradation over false confidence, everywhere**: this isn't just a Section 5 rule — it's threaded through the price grounding, the ingredient flag, the sustainability flag, and the review pattern flag alike. Thin or unconfirmed evidence is labeled as such, never dressed up as certainty.

---

## Firestore Security

See [`firestore.rules`](./firestore.rules) in this repo.

Every read/write to a user's preferences, scan history, conversation logs, and reaction outcomes requires `request.auth.uid == userId` at the rules level. No cross-user reads are possible under any circumstance — this isn't handled at the application layer where it could be bypassed, it's enforced directly by Firestore's own security rules engine.

---

## Deployment

Built entirely inside **Google AI Studio's Build Mode**, using the official codelab's Production Directives (threat modeling, secure coding, Firestore isolation rules, secret management) as Custom Instructions before any code was generated.

**Steps:**
1. Built and iterated inside AI Studio Build Mode.
2. Published via AI Studio's **Publish** flow → deploys the containerized app directly to **Cloud Run**.
3. Billing enabled on the linked Google Cloud project (required by Cloud Run for any deployment), with a monthly spend cap configured as a safety limit.
4. Applied the challenge's required verification label:
```bash
   gcloud run services update x-ray --region=us-west2 --update-labels=dev-tutorial=cloud-run-ai-challenge
```
5. Verified end-to-end in production: sign-in, full scan flow, multi-turn chat, and outcome logging all tested directly against the live Cloud Run URL — not just the AI Studio preview.

**Live URL:** https://x-ray-1045735169186.us-west2.run.app/

---

## Environment Setup (Local Development)

See [`.env.example`](./.env.example) for required environment variables.

```bash
npm install
npm run dev
```

---

## How X-Ray Meets Every Evaluation Criterion

**🎨 Authenticity — Originality & genuine custom-built approach**
X-Ray deliberately diverges from the codelab's "Personal Gemini Journal" starter rather than reskinning it. The four-flag personalization system is an original mechanic built on top of the required base architecture. The verdict engine is a custom deterministic scoring system — Gemini writes the explanation, but the label itself comes from fixed, auditable, weighted logic, not a fresh model judgment call every time. This was a deliberate fix mid-build after discovering the naive approach could return different verdicts for identical inputs — and it was re-verified afterward with repeated identical-input tests until the output was provably stable.

**🎯 Usability — Intuitive design & seamless experience**
The evidence chain is presented top-to-bottom in numbered stages so the reasoning behind any verdict is always inspectable, never a black box. Each personalization flag gets its own card with its own named source — deliberately never merged into one generic block. The report view was explicitly redesigned mid-build from one long continuous scroll into functional tabs with a condensed summary view, collapsible flag cards, and a horizontal price-comparison strip — because a genuinely usable tool has to be scannable, not just complete.

**🛡️ Stability — Reliable, bug-free operation**
A multi-model Gemini fallback ladder plus a secondary provider fallback means the app degrades gracefully instead of failing outright under quota pressure. Price-grounding parsing is defensive against malformed model output. The verdict engine's determinism was explicitly tested and fixed after discovering non-deterministic behavior during development — the same inputs now reliably produce the same outputs, verified through repeated side-by-side comparison of raw scoring data, not just a passing glance at the UI.

**🔒 Security — Standard best practices for data & infrastructure**
Firebase Auth handles all authentication — federated Google Sign-In only, zero stored passwords. Every Firestore document is scoped with `request.auth.uid == userId` at the rules engine level, not just the application layer. The Gemini API key lives in Google Cloud Secret Manager and is never hardcoded or exposed client-side, per the codelab's Production Directives.

---

## Challenge Context

Built for the **Google Cloud Gen AI Academy APAC Ideathon** (Cloud Run Build & Deploy Social Challenge), run by Google Cloud with Hack2skill. Adapted from the official [Build a User-Authenticated AI Application with Custom Instructions on Google AI Studio & Cloud Run](https://codelabs.developers.google.com/codelabs/cloud-run/cloud-run-ai-challenge) codelab — diverging from its "Personal Gemini Journal" starter into X-Ray's own product-intelligence flow while satisfying all four required core mechanics (Firebase Auth, multi-turn Gemini interaction, user-isolated Firestore, Secret Manager key handling).

**#AccelerateAIwithCloudRun**
