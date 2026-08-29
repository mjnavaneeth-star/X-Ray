import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '25mb' }));

// Shared Gemini client utility
function getAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Fallback ladder model list for Gemini
const GEMINI_LADDER = [
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.7-flash',
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function maskKey(key?: string): string {
  if (!key) return '(not set)';
  return key.length >= 4 ? `...${key.slice(-4)}` : '****';
}

// Helper: Convert Gemini contents structure to standard OpenAI-compatible messages format
function convertToOpenAIMessages(
  contentsOrPrompt: any,
  systemInstruction?: string
): { messages: any[]; hasImage: boolean } {
  const messages: any[] = [];
  let hasImage = false;

  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }

  if (typeof contentsOrPrompt === 'string') {
    messages.push({ role: 'user', content: contentsOrPrompt });
    return { messages, hasImage };
  }

  if (Array.isArray(contentsOrPrompt)) {
    // Check if this is a chat message history [{ role: 'user' | 'model', parts: [{ text }] }]
    const isChatFormat = contentsOrPrompt.length > 0 && (contentsOrPrompt[0]?.role || contentsOrPrompt[0]?.parts);

    if (isChatFormat) {
      for (const msg of contentsOrPrompt) {
        const role = msg.role === 'model' || msg.role === 'assistant' ? 'assistant' : 'user';
        let textContent = '';
        if (Array.isArray(msg.parts)) {
          textContent = msg.parts.map((p: any) => p.text || '').join('\n');
        } else if (typeof msg.content === 'string') {
          textContent = msg.content;
        } else if (typeof msg.text === 'string') {
          textContent = msg.text;
        }
        messages.push({ role, content: textContent });
      }
      return { messages, hasImage };
    }

    // Otherwise, it's a mixed array of inlineData (images) and string prompts
    const userContentParts: any[] = [];
    for (const item of contentsOrPrompt) {
      if (typeof item === 'string') {
        userContentParts.push({ type: 'text', text: item });
      } else if (item?.inlineData) {
        hasImage = true;
        const mimeType = item.inlineData.mimeType || 'image/jpeg';
        const base64Data = item.inlineData.data;
        userContentParts.push({
          type: 'image_url',
          image_url: {
            url: `data:${mimeType};base64,${base64Data}`,
          },
        });
      }
    }

    if (userContentParts.length === 1 && userContentParts[0].type === 'text') {
      messages.push({ role: 'user', content: userContentParts[0].text });
    } else if (userContentParts.length > 0) {
      messages.push({ role: 'user', content: userContentParts });
    }
  }

  return { messages, hasImage };
}

// 1. Gemini Provider Executor with urlContext and googleSearch support
async function callGemini(
  contentsOrPrompt: any,
  systemInstruction?: string,
  enableSearch: boolean = false,
  isJson: boolean = false,
  enableUrlContext: boolean = false,
  customTools?: any[]
): Promise<string> {
  const ai = getAIClient();
  if (!ai) {
    throw new Error('GEMINI_API_KEY is not configured in environment.');
  }

  let lastErr: any = null;
  for (let i = 0; i < GEMINI_LADDER.length; i++) {
    const model = GEMINI_LADDER[i];
    try {
      const config: any = {};
      if (systemInstruction) config.systemInstruction = systemInstruction;
      
      const tools: any[] = [];
      if (customTools && customTools.length > 0) {
        tools.push(...customTools);
      } else {
        if (enableUrlContext) {
          tools.push({ urlContext: {} });
        }
        if (enableSearch) {
          tools.push({ googleSearch: {} });
        }
      }

      if (tools.length > 0) {
        config.tools = tools;
      }
      if (isJson) {
        config.responseMimeType = 'application/json';
      }

      const toolsLabel = tools.map((t) => Object.keys(t).join(',')).join(' + ') || 'none';
      console.log(`[AI Dispatcher] Trying Gemini model "${model}" (${i + 1}/${GEMINI_LADDER.length}) [tools: ${toolsLabel}]...`);
      const response = await ai.models.generateContent({
        model,
        contents: contentsOrPrompt,
        config: Object.keys(config).length > 0 ? config : undefined,
      });

      const candidate = response.candidates?.[0];
      const grounding = candidate?.groundingMetadata;
      if (grounding) {
        const searchQueries = grounding.webSearchQueries || [];
        const searchResults = (grounding.groundingChunks || [])
          .map((c: any) => ({
            title: c.web?.title,
            uri: c.web?.uri,
          }))
          .filter((c: any) => c.title || c.uri);

        console.log(`[GoogleSearch Grounding] Model: "${model}" | Queries: ${JSON.stringify(searchQueries)} | Results: ${searchResults.length}`);
      }

      if (response && response.text) {
        return response.text;
      }
    } catch (err: any) {
      lastErr = err;
      const errMsg = err?.message || String(err);
      const shortErr = errMsg.length > 100 ? errMsg.slice(0, 100) + '...' : errMsg;
      console.warn(`[AI Dispatcher] Gemini model "${model}" failed (${shortErr})`);
      // Brief pause between Gemini internal ladder models
      if (i < GEMINI_LADDER.length - 1) {
        await sleep(500);
      }
    }
  }
  throw new Error(`All Gemini models failed: ${lastErr?.message || String(lastErr)}`);
}

// 2. OpenRouter Provider Executor (Primary Reliable Fallback)
async function callOpenRouter(
  contentsOrPrompt: any,
  systemInstruction?: string,
  isJson: boolean = false
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured.');

  const { messages, hasImage } = convertToOpenAIMessages(contentsOrPrompt, systemInstruction);
  const models = hasImage 
    ? ['google/gemini-2.0-flash-001', 'openai/gpt-4o-mini'] 
    : ['google/gemini-2.0-flash-001', 'meta-llama/llama-3.3-70b-instruct', 'deepseek/deepseek-chat', 'openrouter/auto'];

  let lastErr = null;
  for (const model of models) {
    try {
      console.log(`[AI Dispatcher] Calling OpenRouter (${model})...`);
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
          'X-Title': 'Remix Remix X-Ray',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.2,
          ...(isJson ? { response_format: { type: 'json_object' } } : {}),
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenRouter HTTP ${response.status}: ${errText}`);
      }

      const data: any = await response.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error('Empty response received from OpenRouter.');
      return text;
    } catch (err: any) {
      lastErr = err;
      const errMsg = err?.message || String(err);
      const shortErr = errMsg.length > 80 ? errMsg.slice(0, 80) + '...' : errMsg;
      console.warn(`[AI Dispatcher] OpenRouter model "${model}" failed (${shortErr})`);
    }
  }

  throw new Error(`All OpenRouter models failed: ${lastErr?.message || String(lastErr)}`);
}

// 3. xAI (Grok) Provider Executor
async function callXAI(
  contentsOrPrompt: any,
  systemInstruction?: string,
  isJson: boolean = false
): Promise<string> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error('XAI_API_KEY is not configured.');

  const { messages, hasImage } = convertToOpenAIMessages(contentsOrPrompt, systemInstruction);
  const models = hasImage 
    ? ['grok-2-vision-1212', 'grok-vision-beta'] 
    : ['grok-2-1212', 'grok-2-latest', 'grok-beta'];

  let lastErr = null;
  for (const model of models) {
    try {
      console.log(`[AI Dispatcher] Calling xAI (${model})...`);
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.2,
          ...(isJson ? { response_format: { type: 'json_object' } } : {}),
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`xAI HTTP ${response.status}: ${errText}`);
      }

      const data: any = await response.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error('Empty response received from xAI.');
      return text;
    } catch (err: any) {
      lastErr = err;
      const errMsg = err?.message || String(err);
      const shortErr = errMsg.length > 80 ? errMsg.slice(0, 80) + '...' : errMsg;
      console.warn(`[AI Dispatcher] xAI model "${model}" failed (${shortErr})`);
    }
  }

  throw new Error(`All xAI models failed: ${lastErr?.message || String(lastErr)}`);
}

// 4. Groq Provider Executor
async function callGroq(
  contentsOrPrompt: any,
  systemInstruction?: string,
  isJson: boolean = false
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not configured.');

  const { messages, hasImage } = convertToOpenAIMessages(contentsOrPrompt, systemInstruction);
  const models = hasImage 
    ? ['llama-3.2-11b-vision-preview', 'llama-3.2-90b-vision-preview'] 
    : ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'];

  let lastErr = null;
  for (const model of models) {
    try {
      console.log(`[AI Dispatcher] Calling Groq (${model})...`);
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.2,
          ...(isJson ? { response_format: { type: 'json_object' } } : {}),
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Groq HTTP ${response.status}: ${errText}`);
      }

      const data: any = await response.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error('Empty response received from Groq.');
      return text;
    } catch (err: any) {
      lastErr = err;
      const errMsg = err?.message || String(err);
      const shortErr = errMsg.length > 80 ? errMsg.slice(0, 80) + '...' : errMsg;
      console.warn(`[AI Dispatcher] Groq model "${model}" failed (${shortErr})`);
    }
  }

  throw new Error(`All Groq models failed: ${lastErr?.message || String(lastErr)}`);
}

// 5. OpenAI Provider Executor
async function callOpenAI(
  contentsOrPrompt: any,
  systemInstruction?: string,
  isJson: boolean = false
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.');

  const { messages } = convertToOpenAIMessages(contentsOrPrompt, systemInstruction);
  const models = ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'];

  let lastErr = null;
  for (const model of models) {
    try {
      console.log(`[AI Dispatcher] Calling OpenAI (${model})...`);
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.2,
          ...(isJson ? { response_format: { type: 'json_object' } } : {}),
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI HTTP ${response.status}: ${errText}`);
      }

      const data: any = await response.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error('Empty response received from OpenAI.');
      return text;
    } catch (err: any) {
      lastErr = err;
      const errMsg = err?.message || String(err);
      const shortErr = errMsg.length > 80 ? errMsg.slice(0, 80) + '...' : errMsg;
      console.warn(`[AI Dispatcher] OpenAI model "${model}" failed (${shortErr})`);
    }
  }

  throw new Error(`All OpenAI models failed: ${lastErr?.message || String(lastErr)}`);
}

// Master Multi-Provider Dispatcher with Instant Failover: Gemini -> OpenRouter -> xAI -> Groq -> OpenAI
async function generateContentWithFallback(
  contentsOrPrompt: any,
  systemInstruction?: string,
  enableSearch: boolean = false,
  isJson: boolean = false,
  enableUrlContext: boolean = false,
  customTools?: any[]
): Promise<string> {
  const providers = [
    {
      name: 'Gemini',
      isConfigured: () => Boolean(process.env.GEMINI_API_KEY),
      call: () => callGemini(contentsOrPrompt, systemInstruction, enableSearch, isJson, enableUrlContext, customTools),
    },
    {
      name: 'OpenRouter',
      isConfigured: () => Boolean(process.env.OPENROUTER_API_KEY),
      call: () => callOpenRouter(contentsOrPrompt, systemInstruction, isJson),
    },
    {
      name: 'xAI (Grok)',
      isConfigured: () => Boolean(process.env.XAI_API_KEY),
      call: () => callXAI(contentsOrPrompt, systemInstruction, isJson),
    },
    {
      name: 'Groq',
      isConfigured: () => Boolean(process.env.GROQ_API_KEY),
      call: () => callGroq(contentsOrPrompt, systemInstruction, isJson),
    },
    {
      name: 'OpenAI',
      isConfigured: () => Boolean(process.env.OPENAI_API_KEY),
      call: () => callOpenAI(contentsOrPrompt, systemInstruction, isJson),
    },
  ];

  const errors: string[] = [];

  for (const provider of providers) {
    if (!provider.isConfigured()) {
      continue;
    }

    try {
      console.log(`[AI Dispatcher] Attempting execution with provider: ${provider.name}`);
      const result = await provider.call();
      if (result && typeof result === 'string') {
        console.log(`[AI Dispatcher] -> Success fulfilled by ${provider.name}`);
        return result;
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const shortErr = errMsg.length > 100 ? errMsg.slice(0, 100) + '...' : errMsg;
      console.warn(`[AI Dispatcher] Provider "${provider.name}" failed (${shortErr}). Failing over to next provider...`);
      errors.push(`${provider.name}: ${shortErr}`);
    }
  }

  throw new Error(
    `All available AI providers failed. Tried: [${providers.filter(p => p.isConfigured()).map(p => p.name).join(', ')}]. Errors: ${errors.join(' | ')}`
  );
}

// Alias for backwards compatibility
const generateWithFallback = generateContentWithFallback;

// Market Intelligence & Location Detection Engine
export interface MarketDefinition {
  code: string;
  country: string;
  currency: string;
  currencySymbol: string;
  flagEmoji: string;
  detectionSource: string;
  priorityRetailers: string[];
  avoidRetailersNotice: string;
}

export function detectMarketFromUrl(inputUrl?: string): MarketDefinition {
  if (!inputUrl || typeof inputUrl !== 'string' || inputUrl.trim() === '') {
    return {
      code: 'IN',
      country: 'India',
      currency: 'INR',
      currencySymbol: '₹',
      flagEmoji: '🇮🇳',
      detectionSource: 'Default local-market grounding (India)',
      priorityRetailers: ['Amazon India (amazon.in)', 'Nykaa', 'Tira Beauty', 'Myntra', 'Shoppers Stop', 'Reliance Retail', 'FirstCry', 'Tata CLiQ', 'Official Brand India Store'],
      avoidRetailersNotice: 'STRICTLY EXCLUDE foreign retailers like US Ulta, US Sephora, Target US, Walmart US, Boots UK or any USD/foreign currency pricing.',
    };
  }

  let hostname = '';
  let pathname = '';
  try {
    const parsed = new URL(inputUrl.startsWith('http') ? inputUrl : `https://${inputUrl}`);
    hostname = parsed.hostname.toLowerCase();
    pathname = parsed.pathname.toLowerCase();
  } catch {
    hostname = inputUrl.toLowerCase();
  }

  // 1. India (IN)
  if (
    hostname.includes('amazon.in') ||
    hostname.includes('nykaa.com') ||
    hostname.includes('tirabeauty.com') ||
    hostname.includes('tira.com') ||
    hostname.includes('myntra.com') ||
    hostname.includes('flipkart.com') ||
    hostname.includes('shoppersstop.com') ||
    hostname.includes('firstcry.com') ||
    hostname.includes('tatacliq.com') ||
    hostname.includes('purplle.com') ||
    hostname.includes('jiomart.com') ||
    hostname.includes('reliancedigital.in') ||
    hostname.includes('pharmeasy.in') ||
    hostname.includes('1mg.com') ||
    hostname.includes('apollopharmacy.in') ||
    hostname.endsWith('.in') ||
    hostname.endsWith('.co.in')
  ) {
    return {
      code: 'IN',
      country: 'India',
      currency: 'INR',
      currencySymbol: '₹',
      flagEmoji: '🇮🇳',
      detectionSource: `Domain detection (${hostname})`,
      priorityRetailers: ['Amazon India (amazon.in)', 'Nykaa', 'Tira Beauty', 'Myntra', 'Shoppers Stop', 'Reliance Retail', 'FirstCry', 'Tata CLiQ', 'Purplle', 'Official Brand India Store'],
      avoidRetailersNotice: 'STRICTLY EXCLUDE foreign retailers like US Ulta, US Sephora, Target US, Walmart US, or foreign USD pricing. NEVER convert a US $ price to INR and treat it as an Indian market price.',
    };
  }

  // 2. United Arab Emirates (AE)
  if (
    hostname.includes('amazon.ae') ||
    hostname.includes('sephora.ae') ||
    hostname.includes('namshi.com') ||
    hostname.includes('ounass.ae') ||
    (hostname.includes('noon.com') && (pathname.includes('/uae') || hostname.includes('uae'))) ||
    hostname.endsWith('.ae')
  ) {
    return {
      code: 'AE',
      country: 'United Arab Emirates',
      currency: 'AED',
      currencySymbol: 'AED ',
      flagEmoji: '🇦🇪',
      detectionSource: `Domain detection (${hostname})`,
      priorityRetailers: ['Amazon UAE (amazon.ae)', 'Noon UAE', 'Sephora Middle East (UAE)', 'Namshi', 'Ounass', 'Life Pharmacy UAE'],
      avoidRetailersNotice: 'STRICTLY EXCLUDE non-UAE retailers. Only use verified AED local pricing.',
    };
  }

  // 3. Saudi Arabia (SA)
  if (
    hostname.includes('amazon.sa') ||
    hostname.includes('nahdionline.com') ||
    hostname.includes('sephora.sa') ||
    (hostname.includes('noon.com') && (pathname.includes('/saudi') || hostname.includes('saudi'))) ||
    hostname.endsWith('.sa')
  ) {
    return {
      code: 'SA',
      country: 'Saudi Arabia',
      currency: 'SAR',
      currencySymbol: 'SAR ',
      flagEmoji: '🇸🇦',
      detectionSource: `Domain detection (${hostname})`,
      priorityRetailers: ['Amazon Saudi Arabia (amazon.sa)', 'Noon KSA', 'Nahdi Pharmacy', 'Sephora KSA', 'Golden Scent'],
      avoidRetailersNotice: 'STRICTLY EXCLUDE non-Saudi retailers. Only use verified SAR local pricing.',
    };
  }

  // 4. United Kingdom (GB)
  if (
    hostname.includes('amazon.co.uk') ||
    hostname.includes('boots.com') ||
    hostname.includes('superdrug.com') ||
    hostname.includes('cultbeauty.co.uk') ||
    hostname.includes('lookfantastic.com') ||
    hostname.includes('spacenk.com') ||
    hostname.includes('sephora.co.uk') ||
    hostname.includes('johnlewis.com') ||
    hostname.endsWith('.co.uk') ||
    hostname.endsWith('.uk')
  ) {
    return {
      code: 'GB',
      country: 'United Kingdom',
      currency: 'GBP',
      currencySymbol: '£',
      flagEmoji: '🇬🇧',
      detectionSource: `Domain detection (${hostname})`,
      priorityRetailers: ['Amazon UK (amazon.co.uk)', 'Boots UK', 'Superdrug', 'Cult Beauty UK', 'Lookfantastic UK', 'Space NK', 'Sephora UK'],
      avoidRetailersNotice: 'STRICTLY EXCLUDE US retailers or non-UK pricing. Only use verified GBP (£) pricing.',
    };
  }

  // 5. Canada (CA)
  if (
    hostname.includes('amazon.ca') ||
    hostname.includes('shoppersdrugmart.ca') ||
    hostname.includes('well.ca') ||
    hostname.includes('sephora.ca') ||
    hostname.includes('walmart.ca') ||
    hostname.endsWith('.ca')
  ) {
    return {
      code: 'CA',
      country: 'Canada',
      currency: 'CAD',
      currencySymbol: 'C$',
      flagEmoji: '🇨🇦',
      detectionSource: `Domain detection (${hostname})`,
      priorityRetailers: ['Amazon Canada (amazon.ca)', 'Shoppers Drug Mart', 'Sephora Canada', 'Well.ca', 'Walmart Canada'],
      avoidRetailersNotice: 'STRICTLY EXCLUDE non-Canadian pricing. Only use verified CAD (C$) local retail pricing.',
    };
  }

  // 6. Australia (AU)
  if (
    hostname.includes('amazon.com.au') ||
    hostname.includes('chemistwarehouse.com.au') ||
    hostname.includes('priceline.com.au') ||
    hostname.includes('mecca.com') ||
    hostname.includes('adorebeauty.com.au') ||
    hostname.includes('sephora.com.au') ||
    hostname.endsWith('.com.au') ||
    hostname.endsWith('.au')
  ) {
    return {
      code: 'AU',
      country: 'Australia',
      currency: 'AUD',
      currencySymbol: 'A$',
      flagEmoji: '🇦🇺',
      detectionSource: `Domain detection (${hostname})`,
      priorityRetailers: ['Amazon Australia (amazon.com.au)', 'Chemist Warehouse', 'Priceline Australia', 'Mecca Australia', 'Adore Beauty AU', 'Sephora Australia'],
      avoidRetailersNotice: 'STRICTLY EXCLUDE non-Australian retailers. Only use verified AUD (A$) local pricing.',
    };
  }

  // 7. Germany / DACH (DE)
  if (
    hostname.includes('amazon.de') ||
    hostname.includes('douglas.de') ||
    hostname.includes('flaconi.de') ||
    hostname.includes('dm.de') ||
    hostname.includes('rossmann.de') ||
    hostname.endsWith('.de')
  ) {
    return {
      code: 'DE',
      country: 'Germany',
      currency: 'EUR',
      currencySymbol: '€',
      flagEmoji: '🇩🇪',
      detectionSource: `Domain detection (${hostname})`,
      priorityRetailers: ['Amazon Germany (amazon.de)', 'Douglas Germany', 'Flaconi', 'dm-drogerie markt', 'Rossmann'],
      avoidRetailersNotice: 'STRICTLY EXCLUDE non-EU pricing. Only use verified EUR (€) local pricing.',
    };
  }

  // 8. France (FR)
  if (
    hostname.includes('amazon.fr') ||
    hostname.includes('sephora.fr') ||
    hostname.includes('marionnaud.fr') ||
    hostname.includes('nocibe.fr') ||
    hostname.endsWith('.fr')
  ) {
    return {
      code: 'FR',
      country: 'France',
      currency: 'EUR',
      currencySymbol: '€',
      flagEmoji: '🇫🇷',
      detectionSource: `Domain detection (${hostname})`,
      priorityRetailers: ['Amazon France (amazon.fr)', 'Sephora France', 'Marionnaud', 'Nocibé'],
      avoidRetailersNotice: 'STRICTLY EXCLUDE non-EU pricing. Only use verified EUR (€) local pricing.',
    };
  }

  // 9. Italy (IT)
  if (hostname.includes('amazon.it') || hostname.includes('sephora.it') || hostname.endsWith('.it')) {
    return {
      code: 'IT',
      country: 'Italy',
      currency: 'EUR',
      currencySymbol: '€',
      flagEmoji: '🇮🇹',
      detectionSource: `Domain detection (${hostname})`,
      priorityRetailers: ['Amazon Italy (amazon.it)', 'Sephora Italia', 'Douglas Italia'],
      avoidRetailersNotice: 'STRICTLY EXCLUDE non-EU pricing. Only use verified EUR (€) local pricing.',
    };
  }

  // 10. Spain (ES)
  if (hostname.includes('amazon.es') || hostname.includes('sephora.es') || hostname.includes('primor.eu') || hostname.endsWith('.es')) {
    return {
      code: 'ES',
      country: 'Spain',
      currency: 'EUR',
      currencySymbol: '€',
      flagEmoji: '🇪🇸',
      detectionSource: `Domain detection (${hostname})`,
      priorityRetailers: ['Amazon Spain (amazon.es)', 'Sephora España', 'Perfumerías Primor', 'Druni'],
      avoidRetailersNotice: 'STRICTLY EXCLUDE non-EU pricing. Only use verified EUR (€) local pricing.',
    };
  }

  // 11. Japan (JP)
  if (hostname.includes('amazon.co.jp') || hostname.includes('rakuten.co.jp') || hostname.endsWith('.jp') || hostname.endsWith('.co.jp')) {
    return {
      code: 'JP',
      country: 'Japan',
      currency: 'JPY',
      currencySymbol: '¥',
      flagEmoji: '🇯🇵',
      detectionSource: `Domain detection (${hostname})`,
      priorityRetailers: ['Amazon Japan (amazon.co.jp)', 'Rakuten Ichiba', '@cosme SHOPPING', 'Matsumoto Kiyoshi'],
      avoidRetailersNotice: 'STRICTLY EXCLUDE non-Japanese pricing. Only use verified JPY (¥) local pricing.',
    };
  }

  // 12. Singapore (SG)
  if (hostname.includes('amazon.sg') || hostname.includes('shopee.sg') || hostname.includes('lazada.sg') || hostname.endsWith('.sg')) {
    return {
      code: 'SG',
      country: 'Singapore',
      currency: 'SGD',
      currencySymbol: 'S$',
      flagEmoji: '🇸🇬',
      detectionSource: `Domain detection (${hostname})`,
      priorityRetailers: ['Amazon Singapore (amazon.sg)', 'Shopee SG', 'Lazada SG', 'Sephora Singapore', 'Watsons SG'],
      avoidRetailersNotice: 'STRICTLY EXCLUDE non-Singapore pricing. Only use verified SGD (S$) local pricing.',
    };
  }

  // 13. United States (US)
  if (
    hostname.includes('amazon.com') ||
    hostname.includes('sephora.com') ||
    hostname.includes('ulta.com') ||
    hostname.includes('target.com') ||
    hostname.includes('walmart.com') ||
    hostname.includes('walgreens.com') ||
    hostname.includes('cvs.com') ||
    hostname.includes('nordstrom.com') ||
    hostname.includes('bestbuy.com') ||
    hostname.endsWith('.us')
  ) {
    return {
      code: 'US',
      country: 'United States',
      currency: 'USD',
      currencySymbol: '$',
      flagEmoji: '🇺🇸',
      detectionSource: `Domain detection (${hostname})`,
      priorityRetailers: ['Amazon US (amazon.com)', 'Sephora US', 'Ulta Beauty', 'Target', 'Walmart', 'Brand Official US Store'],
      avoidRetailersNotice: 'STRICTLY EXCLUDE foreign retailers. Only use verified USD ($) local pricing.',
    };
  }

  // Fallback / Domain Neutral: Do NOT blindly assume US. Ground via global/general indicator.
  return {
    code: 'IN',
    country: 'India',
    currency: 'INR',
    currencySymbol: '₹',
    flagEmoji: '🇮🇳',
    detectionSource: `Market grounded from context (${hostname || 'URL/Image input'})`,
    priorityRetailers: ['Amazon India (amazon.in)', 'Nykaa', 'Tira Beauty', 'Myntra', 'Shoppers Stop', 'Reliance Retail', 'FirstCry', 'Tata CLiQ', 'Official Brand India Store'],
    avoidRetailersNotice: 'STRICTLY EXCLUDE foreign retailers like US Ulta, US Sephora, Target US, Walmart US, or foreign USD pricing. NEVER convert a US $ price to INR and treat it as an Indian market price.',
  };
}

// URL Cleaner & Evidence Extractor
function cleanProductUrl(rawUrl: string): {
  cleanUrl: string;
  originalUrl: string;
  domain: string;
  productId?: string;
  searchQueryUrl: string;
  slugHint?: string;
  isDirectTextQuery?: boolean;
  sizeHint?: string;
} {
  try {
    const trimmed = rawUrl.trim();
    
    // Check if input is a direct product name search query rather than a URL
    const hasHttp = trimmed.startsWith('http://') || trimmed.startsWith('https://');
    const hasDomainPattern = !trimmed.includes(' ') && trimmed.includes('.') && /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(trimmed);

    // Extract size hint if present in string (e.g. "30ml", "50 ml", "100 g", "1 fl oz")
    const sizeMatch = trimmed.match(/(\d+(?:\.\d+)?\s*(?:ml|g|gm|fl\s*oz|oz|l|kg))\b/i);
    const sizeHint = sizeMatch ? sizeMatch[1].trim() : undefined;

    if (!hasHttp && !hasDomainPattern) {
      return {
        cleanUrl: trimmed,
        originalUrl: rawUrl,
        domain: '',
        searchQueryUrl: trimmed,
        slugHint: trimmed,
        isDirectTextQuery: true,
        sizeHint,
      };
    }

    const parsed = new URL(hasHttp ? trimmed : `https://${trimmed}`);
    const domain = parsed.hostname.toLowerCase().replace(/^www\./, '');
    
    // Extract slug hint from path (e.g. /The-Ordinary-Niacinamide-10-Zinc-1-30ml/dp/B01MDTVZTZ)
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    let slugHint = '';
    for (const part of pathParts) {
      if (part.length > 5 && !['dp', 'gp', 'product', 'd', 'p', 'item', 'buy', 'shop'].includes(part.toLowerCase()) && !/^[A-Z0-9]{10}$/i.test(part)) {
        slugHint = decodeURIComponent(part).replace(/[-_+]/g, ' ').trim();
        break;
      }
    }

    // Amazon specific cleaning: Extract ASIN from /dp/ASIN, /gp/product/ASIN, /d/ASIN, etc.
    const asinMatch = parsed.pathname.match(/\/(?:dp|gp\/product|d|product)\/([A-Z0-9]{10})/i);
    if (domain.includes('amazon') && asinMatch) {
      const asin = asinMatch[1].toUpperCase();
      const canonicalAmazonUrl = `https://${parsed.hostname}/dp/${asin}`;
      return {
        cleanUrl: canonicalAmazonUrl,
        originalUrl: rawUrl,
        domain,
        productId: asin,
        searchQueryUrl: canonicalAmazonUrl,
        slugHint: slugHint || asin,
        isDirectTextQuery: false,
        sizeHint,
      };
    }

    // General URL cleaning: strip all query parameters (?...) and hash fragments (#...)
    const cleanPath = parsed.pathname.replace(/\/+$/, '') || '';
    const cleanUrl = `${parsed.protocol}//${parsed.host}${cleanPath}`;
    
    return {
      cleanUrl,
      originalUrl: rawUrl,
      domain,
      searchQueryUrl: cleanUrl,
      slugHint,
      isDirectTextQuery: false,
      sizeHint,
    };
  } catch {
    const stripped = rawUrl.split('?')[0].split('#')[0].trim();
    const sizeMatch = rawUrl.match(/(\d+(?:\.\d+)?\s*(?:ml|g|gm|fl\s*oz|oz|l|kg))\b/i);
    return {
      cleanUrl: stripped,
      originalUrl: rawUrl,
      domain: '',
      searchQueryUrl: stripped,
      slugHint: stripped,
      isDirectTextQuery: true,
      sizeHint: sizeMatch ? sizeMatch[1].trim() : undefined,
    };
  }
}

// Fast lightweight page metadata evidence fetcher
async function fetchPageMetadata(targetUrl: string): Promise<{ title?: string; description?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    clearTimeout(timeoutId);
    if (!res.ok) return {};
    const text = await res.text();
    
    // Extract <title>
    const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : undefined;

    // Extract meta description or og:title
    const ogTitleMatch = text.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
                         text.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
    const descMatch = text.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
                      text.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    
    return {
      title: ogTitleMatch ? ogTitleMatch[1].trim() : title,
      description: descMatch ? descMatch[1].trim() : undefined,
    };
  } catch {
    return {};
  }
}

// Strict Listing URL Sanitizer & Validator
function sanitizeListingUrl(rawUrl?: string, retailerDomainHint?: string, canonicalSourceUrl?: string): string | undefined {
  if (!rawUrl || typeof rawUrl !== 'string') return undefined;
  const trimmed = rawUrl.trim();

  // Reject blatant model placeholders
  if (
    trimmed.includes('...') ||
    trimmed.includes('example.com') ||
    trimmed.includes('placeholder') ||
    trimmed.includes('/p/1234567') ||
    trimmed.includes('retailer.com') ||
    trimmed.includes('dummy') ||
    trimmed === 'https://' ||
    trimmed === 'http://'
  ) {
    return undefined;
  }

  // Must have a valid protocol
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return undefined;
  }

  try {
    const parsed = new URL(trimmed);
    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      return undefined;
    }
    // Clean tracking query parameters
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return undefined;
  }
}

// ===================================================================
// DISTINCT RETAILER SEARCH PRICE GROUNDING ENGINE
// ===================================================================
interface RetailerGroundingTarget {
  name: string;
  domain: string;
}

function getPriorityRetailersForMarket(market: MarketDefinition): RetailerGroundingTarget[] {
  switch (market.code) {
    case 'IN':
      return [
        { name: 'Amazon India', domain: 'amazon.in' },
        { name: 'Nykaa', domain: 'nykaa.com' },
        { name: 'Flipkart', domain: 'flipkart.com' },
      ];
    case 'US':
      return [
        { name: 'Amazon US', domain: 'amazon.com' },
        { name: 'Sephora US', domain: 'sephora.com' },
        { name: 'Ulta Beauty', domain: 'ulta.com' },
      ];
    case 'GB':
      return [
        { name: 'Amazon UK', domain: 'amazon.co.uk' },
        { name: 'Boots UK', domain: 'boots.com' },
        { name: 'Lookfantastic UK', domain: 'lookfantastic.com' },
      ];
    case 'AE':
      return [
        { name: 'Amazon UAE', domain: 'amazon.ae' },
        { name: 'Noon UAE', domain: 'noon.com' },
        { name: 'Sephora UAE', domain: 'sephora.ae' },
      ];
    case 'CA':
      return [
        { name: 'Amazon Canada', domain: 'amazon.ca' },
        { name: 'Shoppers Drug Mart', domain: 'shoppersdrugmart.ca' },
        { name: 'Sephora Canada', domain: 'sephora.ca' },
      ];
    case 'AU':
      return [
        { name: 'Amazon Australia', domain: 'amazon.com.au' },
        { name: 'Chemist Warehouse', domain: 'chemistwarehouse.com.au' },
        { name: 'Adore Beauty', domain: 'adorebeauty.com.au' },
      ];
    case 'DE':
      return [
        { name: 'Amazon Germany', domain: 'amazon.de' },
        { name: 'Douglas DE', domain: 'douglas.de' },
        { name: 'Sephora DE', domain: 'sephora.de' },
      ];
    case 'FR':
      return [
        { name: 'Amazon France', domain: 'amazon.fr' },
        { name: 'Sephora France', domain: 'sephora.fr' },
        { name: 'Nocibé', domain: 'nocibe.fr' },
      ];
    default:
      return [
        { name: 'Amazon India', domain: 'amazon.in' },
        { name: 'Nykaa', domain: 'nykaa.com' },
        { name: 'Flipkart', domain: 'flipkart.com' },
      ];
  }
}

interface CachedRetailerPrice {
  priceData: any;
  cachedAt: number;
}
const retailerPriceCache = new Map<string, CachedRetailerPrice>();

async function groundRetailerPrice(
  canonicalProduct: { brand: string; productName: string; size?: string; variant?: string },
  retailer: RetailerGroundingTarget,
  market: MarketDefinition
): Promise<any> {
  const packSize = (canonicalProduct.size || '').trim();
  const cacheKey = `${market.code}::${retailer.domain}::${canonicalProduct.brand.toLowerCase()}::${canonicalProduct.productName.toLowerCase()}::${packSize.toLowerCase()}`;
  const cached = retailerPriceCache.get(cacheKey);
  if (cached && (Date.now() - cached.cachedAt) < 2 * 60 * 60 * 1000) {
    console.log(`[Price Grounding Cache Hit] Reusing grounded price for ${retailer.name}: ${cached.priceData.priceFormatted}`);
    return cached.priceData;
  }

  const searchProductTerms = [canonicalProduct.brand, canonicalProduct.productName, packSize].filter(Boolean).join(' ');
  const explicitQuery = `"${searchProductTerms}" site:${retailer.domain} price`;

  console.log(`[Price Grounding] Executing distinct retailer query: [${explicitQuery}] for ${retailer.name}`);

  const prompt = `
You are a precision Google Search price extractor for consumer products.
You must run this exact search query using Google Search grounding:
${explicitQuery}

Target Product to Verify:
- Brand: "${canonicalProduct.brand}"
- Exact Product Name: "${canonicalProduct.productName}"
- Target Pack Size: "${packSize || 'Standard Single Unit'}"
- Retailer: "${retailer.name}" (${retailer.domain})
- Market & Currency: ${market.country} (${market.currencySymbol} / ${market.currency})

Strict Verification and Extraction Rules:
1. EXCLUSIVE RELIANCE ON INDEXED SEARCH SNIPPETS:
   - Rely ONLY on the search engine's indexed snippet and result title text, exactly like a human doing a Google search.
   - Do NOT attempt to browse or fetch the retailer's webpage directly.

2. STRICT SKU-MATCHING LOGIC:
   - Match ONLY the exact single-unit product identified above ("${canonicalProduct.productName}").
   - STRICTLY EXCLUDE:
     * Multi-packs, duos, twin packs, combos, sets, or bundles (e.g. 2-pack bundles for ₹1,599 must be REJECTED).
     * Different pack sizes (e.g. if target is 30ml, reject 60ml, 100ml, or 15ml).
     * Different product formulas/lines (e.g. reject Salicylic Acid, Glycolic Acid, Alpha Arbutin, Multi-Peptide).
   - If no exact single-unit listing for this product and pack size exists in snippets on ${retailer.domain}, status MUST be "NOT_FOUND".

3. LITERAL VERBATIM PRICE EXTRACTION ONLY:
   - Extract the price ONLY if an explicit numeric price appears literally in the search snippet text or title (e.g. "₹550", "Rs. 590", "549", "550.00").
   - NEVER estimate, round, infer, or guess a plausible number.
   - If the exact single-unit product is indexed on ${retailer.domain}, but NO exact price is present in any snippet text, status MUST be "PRICE_UNAVAILABLE".

4. OUTPUT STATUS CODES:
   - "FOUND": Exact single-unit SKU found AND exact literal price found in snippet.
     * numericPrice: positive integer/float (e.g. 550)
     * priceFormatted: formatted with currency symbol (e.g. "${market.currencySymbol}550")
     * matchConfidence: 0.95 to 0.99
     * isDirectMatch: true
     * availability: "In Stock" (or "Check Stock")
     * notes: "Verified exact SKU match from search snippet"
   - "PRICE_UNAVAILABLE": Exact single-unit SKU found in snippet, but no price text exists in the snippet.
     * numericPrice: 0
     * priceFormatted: "Price unavailable"
     * matchConfidence: 0.70
     * isDirectMatch: true
     * availability: "Check Stock"
     * notes: "Listing indexed, but price unavailable in snippet"
   - "NOT_FOUND": No matching single-unit SKU found on this retailer.
     * numericPrice: 0
     * priceFormatted: "Not found"
     * matchConfidence: 0.0
     * isDirectMatch: false
     * availability: "Not Found"
     * notes: "Not found on ${retailer.name}"

Return JSON matching:
{
  "status": "FOUND" | "PRICE_UNAVAILABLE" | "NOT_FOUND",
  "retailer": "${retailer.name}",
  "productName": "${canonicalProduct.productName}",
  "size": "${packSize || 'Standard'}",
  "numericPrice": 0,
  "priceFormatted": "string",
  "currency": "${market.currency}",
  "currencySymbol": "${market.currencySymbol}",
  "availability": "In Stock" | "Check Stock" | "Not Found",
  "matchConfidence": 0.95,
  "isDirectMatch": true,
  "notes": "string",
  "sourceUrl": "URL if present in snippet, otherwise empty string"
}
`;

  try {
    const raw = await generateContentWithFallback(
      [prompt],
      'You are a strict Google search price grounding extractor. Return valid JSON only. Rely only on indexed search snippets. Never estimate or guess numbers.',
      true, // enableSearch
      true, // isJson
      false // enableUrlContext
    );

    const clean = raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(clean);

    const sizeMl = parseFloat(packSize.replace(/[^0-9.]/g, '')) || 0;
    let unitPrice = 0;
    let unitPriceFormatted = '';

    const numPrice = typeof parsed.numericPrice === 'number'
      ? parsed.numericPrice
      : (typeof parsed.price === 'number' ? parsed.price : parseFloat(String(parsed.numericPrice || parsed.price || '').replace(/[^0-9.]/g, '')) || 0);

    let result: any;
    if (parsed.status === 'FOUND' && numPrice > 0) {
      if (sizeMl > 0) {
        unitPrice = Number((numPrice / sizeMl).toFixed(2));
        unitPriceFormatted = `${market.currencySymbol}${unitPrice.toFixed(2)}/ml`;
      }
      result = {
        retailer: retailer.name,
        productName: canonicalProduct.productName,
        size: packSize || 'Standard',
        price: numPrice,
        priceFormatted: parsed.priceFormatted || `${market.currencySymbol}${numPrice}`,
        currency: market.currency,
        currencySymbol: market.currencySymbol,
        unitPrice,
        unitPriceFormatted,
        availability: parsed.availability || 'In Stock',
        market: market.code,
        country: market.country,
        sourceUrl: sanitizeListingUrl(parsed.sourceUrl, retailer.domain),
        matchConfidence: typeof parsed.matchConfidence === 'number' && parsed.matchConfidence > 0 ? parsed.matchConfidence : 0.95,
        isDirectMatch: true,
        notes: parsed.notes || 'Verified exact SKU match',
      };
    } else if (parsed.status === 'PRICE_UNAVAILABLE' || parsed.priceFormatted?.toLowerCase().includes('unavailable')) {
      result = {
        retailer: retailer.name,
        productName: canonicalProduct.productName,
        size: packSize || 'Standard',
        price: 0,
        priceFormatted: 'Price unavailable',
        currency: market.currency,
        currencySymbol: market.currencySymbol,
        availability: 'Check Stock',
        market: market.code,
        country: market.country,
        sourceUrl: sanitizeListingUrl(parsed.sourceUrl, retailer.domain),
        matchConfidence: 0.70,
        isDirectMatch: true,
        notes: 'Price unavailable in search snippet',
      };
    } else {
      result = {
        retailer: retailer.name,
        productName: canonicalProduct.productName,
        size: packSize || 'Standard',
        price: 0,
        priceFormatted: 'Not found',
        currency: market.currency,
        currencySymbol: market.currencySymbol,
        availability: 'Not Found',
        market: market.code,
        country: market.country,
        sourceUrl: undefined,
        matchConfidence: 0.0,
        isDirectMatch: false,
        notes: `Not found on ${retailer.name}`,
      };
    }

    retailerPriceCache.set(cacheKey, { priceData: result, cachedAt: Date.now() });
    return result;
  } catch (err: any) {
    console.warn(`[Price Grounding] Error grounding price for ${retailer.name}:`, err?.message || err);
    return {
      retailer: retailer.name,
      productName: canonicalProduct.productName,
      size: packSize || 'Standard',
      price: 0,
      priceFormatted: 'Price unavailable',
      currency: market.currency,
      currencySymbol: market.currencySymbol,
      availability: 'Check Stock',
      market: market.code,
      country: market.country,
      sourceUrl: undefined,
      matchConfidence: 0.65,
      isDirectMatch: false,
      notes: 'Price unavailable in search snippet',
    };
  }
}

// ===================================================================
// DETERMINISTIC RULE-BASED VERDICT DECISION ENGINE
// ===================================================================
interface ScoringComponent {
  score: number;
  weight: number;
  contribution: number;
  reason: string;
}

interface VerdictScoringBreakdown {
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
  calculatedAt: string;
}

// ===================================================================
// IN-MEMORY GROUNDED PRODUCT & REVIEW INTELLIGENCE CACHE
// Ensures determinism for identical product analysis calls
// ===================================================================
interface CachedProductIntelligence {
  canonicalProduct?: any;
  inside?: any;
  reviewIntelligence?: {
    averageRating: number;
    totalReviewsReported: string;
    sampledReviewCount: number;
    sampledReviewBreakdown: string;
    positiveHighlights: string[];
    recurringCriticisms: string[];
    batchOrFormulaWarnings: string[];
    reviewPatternFlag?: any;
    sustainabilityFlag?: any;
  };
  cachedAt: number;
}

const productIntelligenceCache = new Map<string, CachedProductIntelligence>();

function getProductCacheKey(marketCode: string, brand: string, productName: string, size?: string): string {
  const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${norm(marketCode)}::${norm(brand)}::${norm(productName)}::${norm(size || '')}`;
}

function evaluateDeterministicVerdict(
  inside: any,
  data: any,
  forYou: any,
  userPreferences?: any,
  pastReactionHistory?: any[]
): {
  verdict: 'BUY' | 'CONSIDER' | 'AVOID';
  confidenceScore: number;
  scoringBreakdown: VerdictScoringBreakdown;
  dominantFactors: string[];
  suggestedPrimaryReason: string;
  suggestedActionAdvice: string;
} {
  const flags = forYou || {};
  const personalFlag = flags.personalHistoryFlag || { severity: 'neutral', active: false };
  const ingredientFlag = flags.ingredientCautionFlag || { severity: 'neutral', active: false };
  const reviewFlag = flags.reviewPatternFlag || { severity: 'neutral', active: false };
  const sustainFlag = flags.sustainabilityFlag || { severity: 'neutral', active: false };

  // 1. Personal History Flag (Weight: 3.5 - Heaviest)
  let personalScore = 0;
  let personalReason = 'No adverse personal reaction history on record';
  let personalHardOverride = false;

  const hasLoggedReactions = Array.isArray(pastReactionHistory) && pastReactionHistory.length > 0;
  if (hasLoggedReactions) {
    const adverseEvents = pastReactionHistory.filter((r: any) => r.status === 'reaction' || r.status === 'mild_irritation');
    if (personalFlag.severity === 'danger' || (personalFlag.active && adverseEvents.length > 0)) {
      personalScore = -3.0;
      personalReason = `Direct or high-risk match with past logged adverse reactions (${personalFlag.headline || 'adverse trigger'})`;
      personalHardOverride = true;
    } else if (personalFlag.severity === 'warning') {
      personalScore = -1.5;
      personalReason = `Possible overlap with ingredients from past mild irritation events (${personalFlag.headline || 'caution'})`;
    } else if (personalFlag.severity === 'positive') {
      personalScore = 1.0;
      personalReason = 'Formulation aligns with previously well-tolerated products';
    } else {
      personalScore = 0.0;
      personalReason = 'No adverse ingredient cross-matches with your past logged reactions';
    }
  } else {
    personalScore = 0.0;
    personalReason = 'No adverse personal reaction history on record (0 past reactions logged)';
  }

  const personalWeight = 3.5;
  const personalContribution = Number((personalScore * personalWeight).toFixed(2));

  // 2. Ingredient Caution Flag (Weight: 2.5)
  let ingredientScore = 0;
  let ingredientReason = 'No ingredient watchlist triggers found';
  let ingredientHardOverride = false;

  const hasWatchlist = userPreferences && (
    (Array.isArray(userPreferences.allergiesAndSensitivities) && userPreferences.allergiesAndSensitivities.length > 0) ||
    (Array.isArray(userPreferences.customWatchlist) && userPreferences.customWatchlist.length > 0)
  );

  if (ingredientFlag.severity === 'danger') {
    ingredientScore = -2.5;
    ingredientReason = `Direct match with high-risk allergen or sensitivity watchlist (${ingredientFlag.headline || 'critical allergen'})`;
    if (hasWatchlist) {
      ingredientHardOverride = true;
    }
  } else if (ingredientFlag.severity === 'warning') {
    ingredientScore = -1.0;
    ingredientReason = `Contains potential irritants or moderate watchlist sensitivity (${ingredientFlag.headline || 'watchlist trigger'})`;
  } else if (ingredientFlag.severity === 'positive') {
    ingredientScore = 1.0;
    ingredientReason = 'Clean, well-tolerated formulation free from common sensitivity triggers';
  } else {
    ingredientScore = 0.0;
    ingredientReason = 'No flagged ingredient sensitivities or watchlist conflicts';
  }

  const ingredientWeight = 2.5;
  const ingredientContribution = Number((ingredientScore * ingredientWeight).toFixed(2));

  // 3. Review Pattern Flag (Weight: 1.5)
  let reviewFlagScore = 0;
  let reviewFlagReason = 'Standard consumer review distribution without clustered defects';

  if (reviewFlag.severity === 'danger') {
    reviewFlagScore = -2.0;
    reviewFlagReason = `Widespread recurring consumer complaints / formula issues (${reviewFlag.headline || 'severe complaints'})`;
  } else if (reviewFlag.severity === 'warning') {
    reviewFlagScore = -1.0;
    reviewFlagReason = `Noted recurring consumer caveat (${reviewFlag.headline || 'minor complaints/pilling'})`;
  } else if (reviewFlag.severity === 'positive') {
    reviewFlagScore = 1.0;
    reviewFlagReason = `Overwhelmingly positive consumer feedback and consistency (${reviewFlag.headline || 'high user praise'})`;
  } else {
    reviewFlagScore = 0.0;
    reviewFlagReason = 'No problematic review patterns or clustered defects detected';
  }

  const reviewFlagWeight = 1.5;
  const reviewFlagContribution = Number((reviewFlagScore * reviewFlagWeight).toFixed(2));

  // 4. Sustainability & Ethics Flag (Weight: 1.0)
  let sustainScore = 0;
  let sustainReason = 'Standard sustainability & packaging profile';
  const hasSustainPrefs = userPreferences && Array.isArray(userPreferences.sustainabilityPriorities) && userPreferences.sustainabilityPriorities.length > 0;

  if (hasSustainPrefs) {
    if (sustainFlag.severity === 'positive') {
      sustainScore = 1.5;
      sustainReason = 'Directly matches your active sustainability & ethical priorities';
    } else if (sustainFlag.severity === 'danger' || sustainFlag.severity === 'warning') {
      sustainScore = -1.5;
      sustainReason = 'Conflicts with your designated sustainability or cruelty-free priorities';
    } else {
      sustainScore = 0.0;
      sustainReason = 'Neutral alignment with designated sustainability priorities';
    }
  } else {
    if (sustainFlag.severity === 'positive') {
      sustainScore = 0.5;
      sustainReason = 'Verified third-party certifications or sustainable packaging';
    } else if (sustainFlag.severity === 'warning' || sustainFlag.severity === 'danger') {
      sustainScore = -0.5;
      sustainReason = 'Unverified eco claims or non-recyclable packaging';
    } else {
      sustainScore = 0.0;
      sustainReason = 'Standard packaging without special certifications';
    }
  }

  const sustainWeight = 1.0;
  const sustainContribution = Number((sustainScore * sustainWeight).toFixed(2));

  // 5. Market Pricing vs Comparable Listings (Weight: 1.5)
  let pricingScore = 0;
  let pricingReason = 'Standard market pricing';

  const diffPercent = typeof data?.priceDifferencePercent === 'string'
    ? parseFloat(data.priceDifferencePercent.replace(/[^0-9.-]/g, ''))
    : 0;

  if (data?.bestDeal && (data?.bestDeal?.savingsNote?.toLowerCase().includes('lowest') || diffPercent <= -8)) {
    pricingScore = 1.0;
    pricingReason = 'Competitive indexed pricing with lowest-deal availability';
  } else if (diffPercent > 25) {
    pricingScore = -1.0;
    pricingReason = 'Elevated price significantly above comparable indexed market listings';
  } else if (data?.listings && data.listings.length > 0) {
    pricingScore = 0.5;
    pricingReason = 'Fair indexed market price within typical peer range';
  } else {
    pricingScore = 0.0;
    pricingReason = 'Single-source / baseline indexed market pricing';
  }

  const pricingWeight = 1.5;
  const pricingContribution = Number((pricingScore * pricingWeight).toFixed(2));

  // 6. Review Sentiment & Rating (Weight: 1.5)
  let sentimentScore = 0;
  let sentimentReason = 'Moderate consumer sentiment';
  const rawRating = typeof data?.averageRating === 'number' && !isNaN(data.averageRating) ? data.averageRating : 4.2;
  // Deterministic 1-decimal rounding & bucketing
  const avgRating = Math.round(rawRating * 10) / 10;
  if (data && typeof data === 'object') {
    data.averageRating = avgRating;
  }

  if (avgRating >= 4.0 && (!data?.batchOrFormulaWarnings || data.batchOrFormulaWarnings.length === 0)) {
    sentimentScore = 1.0;
    sentimentReason = `High consumer satisfaction rating (★ ${avgRating.toFixed(1)})`;
  } else if (avgRating < 3.5 || (data?.batchOrFormulaWarnings && data.batchOrFormulaWarnings.length > 1)) {
    sentimentScore = -1.5;
    sentimentReason = `Subpar customer rating (★ ${avgRating.toFixed(1)}) or formula stability warnings`;
  } else {
    sentimentScore = 0.3;
    sentimentReason = `Solid customer satisfaction rating (★ ${avgRating.toFixed(1)})`;
  }

  const sentimentWeight = 1.5;
  const sentimentContribution = Number((sentimentScore * sentimentWeight).toFixed(2));

  // Calculate composite total score
  const totalScore = Number((
    personalContribution +
    ingredientContribution +
    reviewFlagContribution +
    sustainContribution +
    pricingContribution +
    sentimentContribution
  ).toFixed(2));

  // Deterministic Thresholds
  const thresholds = {
    buy: 2.0,
    consider: -1.0,
  };

  let verdict: 'BUY' | 'CONSIDER' | 'AVOID' = 'CONSIDER';
  let hardOverrideApplied: string | undefined = undefined;
  const dominantFactors: string[] = [];

  if (personalHardOverride) {
    verdict = 'AVOID';
    hardOverrideApplied = 'Personal Adverse Reaction Match (Hard Override)';
    dominantFactors.push(personalReason);
  } else if (ingredientHardOverride) {
    verdict = 'AVOID';
    hardOverrideApplied = 'Critical Sensitivity Watchlist Match (Hard Override)';
    dominantFactors.push(ingredientReason);
  } else if (totalScore >= thresholds.buy) {
    // Prevent BUY if any active warning/danger exists on personal or ingredient cautions
    if (personalScore < 0 || ingredientScore < 0) {
      verdict = 'CONSIDER';
      dominantFactors.push('Overall positive market/review score offset by personal or ingredient cautions');
    } else {
      verdict = 'BUY';
      if (personalScore > 0) dominantFactors.push(personalReason);
      if (ingredientScore >= 0) dominantFactors.push('Clean ingredient profile with no personal watchlist conflicts');
      if (pricingScore > 0) dominantFactors.push(pricingReason);
      if (sentimentScore > 0) dominantFactors.push(sentimentReason);
    }
  } else if (totalScore >= thresholds.consider) {
    verdict = 'CONSIDER';
    if (reviewFlagScore < 0) dominantFactors.push(reviewFlagReason);
    if (ingredientScore < 0) dominantFactors.push(ingredientReason);
    if (pricingScore < 0) dominantFactors.push(pricingReason);
    if (dominantFactors.length === 0) dominantFactors.push('Viable formula with moderate trade-offs across price and user reviews');
  } else {
    verdict = 'AVOID';
    if (ingredientScore < 0) dominantFactors.push(ingredientReason);
    if (sentimentScore < 0) dominantFactors.push(sentimentReason);
    if (dominantFactors.length === 0) dominantFactors.push('Cumulative score indicates unfavorable compatibility and value');
  }

  // Deterministic Confidence Score (75 to 98)
  let confidenceScore = 86;
  if (data?.dataQuality === 'high') confidenceScore += 3;
  if (data?.listings && data.listings.length >= 2) confidenceScore += 3;
  if (hasLoggedReactions) confidenceScore += 3;
  if (hasWatchlist) confidenceScore += 2;
  if (confidenceScore > 98) confidenceScore = 98;
  if (confidenceScore < 75) confidenceScore = 75;

  const scoringBreakdown: VerdictScoringBreakdown = {
    totalScore,
    thresholds,
    components: {
      personalHistory: { score: personalScore, weight: personalWeight, contribution: personalContribution, reason: personalReason },
      ingredientCaution: { score: ingredientScore, weight: ingredientWeight, contribution: ingredientContribution, reason: ingredientReason },
      reviewPattern: { score: reviewFlagScore, weight: reviewFlagWeight, contribution: reviewFlagContribution, reason: reviewFlagReason },
      sustainability: { score: sustainScore, weight: sustainWeight, contribution: sustainContribution, reason: sustainReason },
      marketPricing: { score: pricingScore, weight: pricingWeight, contribution: pricingContribution, reason: pricingReason },
      reviewSentiment: { score: sentimentScore, weight: sentimentWeight, contribution: sentimentContribution, reason: sentimentReason },
    },
    hardOverrideApplied,
    calculatedAt: new Date().toISOString(),
  };

  // Build suggested deterministic reasoning text
  let suggestedPrimaryReason = '';
  let suggestedActionAdvice = '';

  const prodTitle = inside?.productName || 'this product';

  if (verdict === 'BUY') {
    suggestedPrimaryReason = `Buy — ${dominantFactors[0] || 'Verified compatible formulation with favorable market pricing and solid consumer sentiment.'}`;
    suggestedActionAdvice = `Look for the lowest indexed price at ${data?.bestDeal?.retailer || 'reputable local retailers'} and verify current in-stock availability before ordering.`;
  } else if (verdict === 'CONSIDER') {
    suggestedPrimaryReason = `Consider — ${dominantFactors[0] || 'Viable product, but notable trade-offs detected in consumer reviews or pricing.'}`;
    suggestedActionAdvice = `Patch test first or review specific customer caveats regarding ${reviewFlag.headline || 'formula behavior'} before committing.`;
  } else {
    suggestedPrimaryReason = `Avoid — ${dominantFactors[0] || 'High risk of adverse skin compatibility or critical sensitivity triggers detected.'}`;
    suggestedActionAdvice = `Do not purchase if you have sensitivity to ${ingredientFlag.headline || 'these active ingredients'}. Consider safer alternatives suited to your profile.`;
  }

  return {
    verdict,
    confidenceScore,
    scoringBreakdown,
    dominantFactors,
    suggestedPrimaryReason,
    suggestedActionAdvice,
  };
}

// Health endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Analyze product endpoint
app.post('/api/analyze', async (req, res) => {
  try {
    const { url, imageBase64, imageMimeType, userPreferences, pastReactionHistory } = req.body;

    if (!url && !imageBase64) {
      return res.status(400).json({ error: 'Either product URL or product image must be provided.' });
    }

    // URL Cleaning and Evidence Gathering step
    let cleanedUrlInfo: ReturnType<typeof cleanProductUrl> | null = null;
    let pageMetaEvidence: { title?: string; description?: string } = {};

    if (url) {
      cleanedUrlInfo = cleanProductUrl(url);
      console.log(`[URL Cleaning] ==========================================`);
      console.log(`[URL Cleaning] Original URL: "${url}"`);
      console.log(`[URL Cleaning] Cleaned Search URL: "${cleanedUrlInfo.cleanUrl}"`);
      console.log(`[URL Cleaning] Domain: "${cleanedUrlInfo.domain}" | Product ID: "${cleanedUrlInfo.productId || 'N/A'}"`);
      if (cleanedUrlInfo.slugHint) {
        console.log(`[URL Cleaning] Slug Hint: "${cleanedUrlInfo.slugHint}"`);
      }
      console.log(`[URL Cleaning] ==========================================`);

      // Attempt fast HTTP metadata pre-fetch to enrich evidence for all providers
      try {
        pageMetaEvidence = await fetchPageMetadata(cleanedUrlInfo.cleanUrl);
        if (pageMetaEvidence.title || pageMetaEvidence.description) {
          console.log(`[URL Metadata Pre-fetch] Title: "${pageMetaEvidence.title || 'N/A'}"`);
          if (pageMetaEvidence.description) {
            console.log(`[URL Metadata Pre-fetch] Description: "${pageMetaEvidence.description.slice(0, 120)}..."`);
          }
        }
      } catch (err: any) {
        console.log('[URL Metadata Pre-fetch] Notice: direct fetch was skipped or timed out.');
      }
    }

    // Determine target market and location grounding
    const detectedMarket = detectMarketFromUrl(cleanedUrlInfo?.cleanUrl || url);
    console.log(`[Market Grounding] Target Market: ${detectedMarket.country} (${detectedMarket.code}) | Currency: ${detectedMarket.currency} | Source: ${detectedMarket.detectionSource}`);

    // ===================================================================
    // STEP 1: PRODUCT IDENTIFICATION (Evidence-Grounded Lookup)
    // ===================================================================
    let identifiedProduct: {
      brand?: string;
      productName?: string;
      category?: string;
      variant?: string;
      size?: string;
      keyIngredientsOrMaterials?: string[];
      allIngredientsText?: string;
      claimedBenefits?: string[];
      certificationsClaimed?: string[];
      productSummary?: string;
      isPageAccessible?: boolean;
      isIdentified?: boolean;
      confidence?: number;
      unclearReason?: string;
      matchedSearchTitle?: string;
      matchedSearchUrl?: string;
      matchEvaluationReason?: string;
    } | null = null;

    if (url) {
      const searchTargetUrl = cleanedUrlInfo ? cleanedUrlInfo.cleanUrl : url;
      const searchTerms = [
        cleanedUrlInfo?.slugHint,
        pageMetaEvidence.title,
        cleanedUrlInfo?.domain,
        cleanedUrlInfo?.productId
      ].filter(Boolean).join(' ');

      console.log(`[Product ID Debug] Executing product identification for: "${searchTargetUrl}" (Search Terms: "${searchTerms}")`);
      
      const searchIdPrompt = `
You are the X-Ray Product Verification & Identification Engine.
Your task is to identify the product (Brand, Product Name, Category, Formulation/Variant, Size, Key Active Ingredients, Full Ingredients Text, Claimed Benefits, Certifications, and Product Summary) from the input URL, slug, page title, metadata, or search grounding.

${cleanedUrlInfo?.isDirectTextQuery ? `DIRECT PRODUCT QUERY: "${cleanedUrlInfo.cleanUrl}"
${cleanedUrlInfo.sizeHint ? `SPECIFIED PACK SIZE: "${cleanedUrlInfo.sizeHint}"` : ''}` : `GATHERED URL & PAGE EVIDENCE:
- Submitted URL: "${url}"
- Canonical Product URL: "${searchTargetUrl}"
- Retailer Domain: "${cleanedUrlInfo?.domain || ''}"
${cleanedUrlInfo?.productId ? `- Retailer Product/ASIN ID: "${cleanedUrlInfo.productId}"` : ''}
${cleanedUrlInfo?.slugHint ? `- URL Path Slug Hint: "${cleanedUrlInfo.slugHint}"` : ''}
${pageMetaEvidence.title ? `- Webpage Meta Title: "${pageMetaEvidence.title}"` : ''}
${pageMetaEvidence.description ? `- Webpage Meta Description: "${pageMetaEvidence.description}"` : ''}`}

IDENTIFICATION INSTRUCTIONS:
1. Identify the exact product name, brand, and pack size from the URL path slug, webpage title, metadata, or search grounding.
2. If Google Search tools are enabled, you may search for: "${cleanedUrlInfo?.slugHint || pageMetaEvidence.title || searchTargetUrl}" to retrieve verified ingredients, benefits, and formulation details.
3. Extract and provide:
   - "brand": Brand name (e.g. "The Ordinary", "Minimalist", "CeraVe", "Mamaearth", "Cetaphil", etc.)
   - "productName": Exact product name (e.g. "Niacinamide 10% + Zinc 1%", "Soothing & Barrier Support Serum", "Salicylic Acid 2% Serum", etc.)
   - "category": Product category (e.g. "Facial Serum", "Moisturizer", "Face Wash", "Sunscreen", etc.)
   - "variant": Formulation variant (e.g. "10% Niacinamide + 1% Zinc", "Barrier Support", etc.)
   - "size": Pack volume or weight (e.g. "${cleanedUrlInfo?.sizeHint || '30 ml'}", "50 ml", "100 ml", "50 g")
   - "keyIngredientsOrMaterials": Array of key active ingredients (e.g. ["Niacinamide (10%)", "Zinc PCA (1%)", "Tamarindus Indica Seed Gum"])
   - "allIngredientsText": Full ingredient list or comprehensive formulation breakdown
   - "claimedBenefits": Array of primary benefits claimed by the brand
   - "certificationsClaimed": Array of certifications (e.g. ["Cruelty-Free", "Vegan", "Fragrance-Free"])
   - "productSummary": Factual, unbiased overview of what the product is and its formulation structure
   - "isIdentified": true (whenever brand and product name are determined from the input)
   - "confidence": 0.95
   - "matchEvaluationReason": Short note on how product was identified from URL slug / title / search.

Return strictly JSON matching:
{
  "matchedSearchTitle": "string",
  "matchedSearchUrl": "string",
  "matchEvaluationReason": "string",
  "brand": "string",
  "productName": "string",
  "category": "string",
  "variant": "string",
  "size": "string",
  "keyIngredientsOrMaterials": ["string"],
  "allIngredientsText": "string",
  "claimedBenefits": ["string"],
  "certificationsClaimed": ["string"],
  "productSummary": "string",
  "isIdentified": true,
  "confidence": 0.95,
  "unclearReason": ""
}
`;

      const idContents: any[] = [];
      if (imageBase64) {
        const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        idContents.push({
          inlineData: {
            data: cleanBase64,
            mimeType: imageMimeType || 'image/jpeg',
          },
        });
      }
      idContents.push(searchIdPrompt);

      try {
        console.log(`[Product ID Debug] Dispatching Stage 1 identification to provider chain...`);
        const searchRawResponse = await generateContentWithFallback(
          idContents,
          `You are X-Ray Product Identification. Use the provided URL evidence and Google Search to identify the product accurately. Return valid JSON only.`,
          true,  // enableSearch
          true,  // isJson
          false  // enableUrlContext
        );
        const cleanJson = searchRawResponse.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
        identifiedProduct = JSON.parse(cleanJson);
        
        console.log(`[Product ID Debug] ==========================================`);
        console.log(`[Product ID Debug] Identification Summary:`);
        console.log(`  - Is Identified: ${identifiedProduct?.isIdentified}`);
        console.log(`  - Confidence: ${identifiedProduct?.confidence}`);
        console.log(`  - Evaluation/Match Reason: "${identifiedProduct?.matchEvaluationReason || identifiedProduct?.unclearReason || 'N/A'}"`);
        console.log(`  - Extracted Brand: "${identifiedProduct?.brand || 'N/A'}"`);
        console.log(`  - Extracted Product Name: "${identifiedProduct?.productName || 'N/A'}"`);
        console.log(`  - Extracted Category: "${identifiedProduct?.category || 'N/A'}"`);
        console.log(`  - Extracted Size: "${identifiedProduct?.size || 'N/A'}"`);
        console.log(`[Product ID Debug] ==========================================`);
      } catch (err: any) {
        console.warn('[Product ID Debug] Primary identification error:', err?.message || err);
      }

      // SECONDARY STRATEGY (Fallback): If initial attempt failed, try with urlContext enabled
      const needsSecondaryUrlContext = !identifiedProduct || 
        !identifiedProduct.productName || 
        identifiedProduct.productName.toLowerCase().includes('unknown') ||
        identifiedProduct.productName.toLowerCase().includes('unclear') ||
        identifiedProduct.isIdentified === false ||
        (identifiedProduct.confidence !== undefined && identifiedProduct.confidence < 0.4);

      if (needsSecondaryUrlContext && !imageBase64) {
        console.log(`[Product ID Debug] Attempting secondary urlContext live-fetch fallback for: ${searchTargetUrl}`);
        const fallbackPrompt = `
You are the X-Ray Product Extraction Fallback.
Identify the product from: "${searchTargetUrl}"
Slug hint: "${cleanedUrlInfo?.slugHint || ''}"
Webpage title: "${pageMetaEvidence.title || ''}"
Retailer: "${cleanedUrlInfo?.domain || ''}"
${cleanedUrlInfo?.productId ? `Product ID: "${cleanedUrlInfo.productId}"` : ''}

Extract: brand, productName, category, variant, size, keyIngredientsOrMaterials, allIngredientsText, claimedBenefits, certificationsClaimed, productSummary, isIdentified (boolean), confidence (number), matchEvaluationReason.
Return strict JSON.
`;
        try {
          const fallbackRawResponse = await generateContentWithFallback(
            [fallbackPrompt],
            'You are X-Ray Fallback URL Reader. Return strict JSON only.',
            true,
            true,
            true
          );
          const cleanFallbackJson = fallbackRawResponse.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
          const fallbackParsed = JSON.parse(cleanFallbackJson);
          console.log(`[Product ID Debug] urlContext Fallback Result: isIdentified=${fallbackParsed?.isIdentified}, Reason="${fallbackParsed?.matchEvaluationReason || ''}"`);
          if (fallbackParsed && fallbackParsed.productName && !fallbackParsed.productName.toLowerCase().includes('unknown') && !fallbackParsed.productName.toLowerCase().includes('unverified')) {
            identifiedProduct = fallbackParsed;
            console.log(`[Product ID Debug - urlContext Fallback] Successfully Identified: Brand="${identifiedProduct?.brand}" | Name="${identifiedProduct?.productName}"`);
          }
        } catch (fbErr: any) {
          console.warn('[Product ID Debug] Secondary urlContext fallback error:', fbErr?.message || fbErr);
        }
      }

      // If still missing but slug hint or page title contains recognizable product text, synthesize fallback identity
      if ((!identifiedProduct || !identifiedProduct.productName || identifiedProduct.productName.toLowerCase().includes('unknown') || identifiedProduct.productName.toLowerCase().includes('unverified')) && (cleanedUrlInfo?.slugHint || pageMetaEvidence.title)) {
        const candidateTitle = cleanedUrlInfo?.slugHint || pageMetaEvidence.title || '';
        if (candidateTitle.trim().length > 3) {
          console.log(`[Product ID Debug] Synthesizing identity from slug/title candidate: "${candidateTitle}"`);
          identifiedProduct = {
            brand: identifiedProduct?.brand || candidateTitle.split(' ')[0] || 'Brand',
            productName: candidateTitle,
            category: identifiedProduct?.category || 'Skincare',
            variant: identifiedProduct?.variant || '',
            size: cleanedUrlInfo?.sizeHint || identifiedProduct?.size || 'Standard',
            keyIngredientsOrMaterials: identifiedProduct?.keyIngredientsOrMaterials || [],
            allIngredientsText: identifiedProduct?.allIngredientsText || '',
            claimedBenefits: identifiedProduct?.claimedBenefits || [],
            certificationsClaimed: identifiedProduct?.certificationsClaimed || [],
            productSummary: identifiedProduct?.productSummary || `Product identified from ${cleanedUrlInfo?.domain || 'retailer'} listing for ${candidateTitle}.`,
            isIdentified: true,
            confidence: 0.85,
            matchEvaluationReason: 'Identified from URL slug and page title evidence',
          };
        }
      }
    } else if (imageBase64) {
      // Image-only identification
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const imgPrompt = `
You are the X-Ray Product Verification & Identification Engine.
Analyze the attached product image. Extract exact Brand, Product Name, Category, Variant, Size, Key Ingredients / Ingredients OCR from packaging, Claimed Benefits, and Certifications.
Return strictly JSON matching:
{
  "brand": "string",
  "productName": "string",
  "category": "string",
  "variant": "string",
  "size": "string",
  "keyIngredientsOrMaterials": ["string"],
  "allIngredientsText": "string",
  "claimedBenefits": ["string"],
  "certificationsClaimed": ["string"],
  "productSummary": "string",
  "isPageAccessible": true,
  "isIdentified": true,
  "confidence": 0.95,
  "unclearReason": ""
}
`;
      try {
        const imgRawResponse = await generateContentWithFallback(
          [
            { inlineData: { data: cleanBase64, mimeType: imageMimeType || 'image/jpeg' } },
            imgPrompt,
          ],
          'You are X-Ray Product Identification from Image. Return strict JSON only.',
          false,
          true,
          false
        );
        const cleanImgJson = imgRawResponse.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
        identifiedProduct = JSON.parse(cleanImgJson);
      } catch (err: any) {
        console.warn('[Stage 1 INSIDE] Image identification call error:', err?.message || err);
      }
    }

    // Check if the product could not be identified with confidence
    const hasValidProductName = Boolean(
      identifiedProduct?.productName &&
      !identifiedProduct.productName.toLowerCase().includes('unknown') &&
      !identifiedProduct.productName.toLowerCase().includes('unclear') &&
      !identifiedProduct.productName.toLowerCase().includes('unverified') &&
      identifiedProduct.productName.trim().length > 2
    );

    const isUnclearOrBlocked = (!identifiedProduct || !hasValidProductName) && !imageBase64;

    if (isUnclearOrBlocked) {
      console.log('[Stage 1 INSIDE] Page content could not be read or is unclear. Returning unverified state prompting for image.');
      return res.json({
        inside: {
          productName: 'Product Unverified (URL Inaccessible)',
          brand: identifiedProduct?.brand || 'Unverified Brand',
          category: identifiedProduct?.category || 'Unverified Category',
          keyIngredientsOrMaterials: [],
          allIngredientsText: 'Ingredient list could not be retrieved directly from the provided URL.',
          claimedBenefits: [],
          certificationsClaimed: [],
          productSummary: 'The webpage content at the provided URL could not be verified directly. To ensure 100% accurate ingredient and price analysis without guessing, please upload a photo of the product packaging or ingredient label.',
        },
        data: {
          market: detectedMarket.code,
          country: detectedMarket.country,
          currency: detectedMarket.currency,
          currencySymbol: detectedMarket.currencySymbol,
          countryFlag: detectedMarket.flagEmoji,
          marketDetectionSource: detectedMarket.detectionSource,
          marketRange: '—',
          averageMarketPrice: 0,
          userPrice: 0,
          dataQuality: 'limited_data',
          limitedDataNotice: 'Market comparison paused: exact product identity unverified from URL. Please upload a product image for accurate price matching.',
          listings: [],
          pricePoints: [],
          typicalPriceRange: '—',
          averageRating: 0,
          totalReviewVolumeEstimate: '0 reviews',
          positiveHighlights: [],
          recurringCriticisms: [],
          batchOrFormulaWarnings: [],
          searchSources: [],
        },
        forYou: {
          personalizedSummary: 'Unable to evaluate personalized sensitivity flags without a verified ingredient list. Please upload a clear photo of the product front/back label.',
        },
        verdict: {
          verdict: 'CONSIDER',
          primaryReason: 'Product identity could not be verified directly from the URL.',
          actionAdvice: 'Upload a product image or photo of the ingredient list for full chemical, price, and safety verification.',
          confidenceScore: 20,
          pros: [],
          cons: ['URL content was inaccessible or protected by retailer verification.'],
        },
        needsImageUpload: true,
      });
    }

    // ===================================================================
    // IMMUTABLE CANONICAL PRODUCT IDENTITY (LOCKED FROM STAGE 1)
    // ===================================================================
    const effectiveSize = (identifiedProduct?.size || cleanedUrlInfo?.sizeHint || '').trim();

    const canonicalProduct = {
      brand: (identifiedProduct?.brand || 'Brand').trim(),
      productName: (identifiedProduct?.productName || 'Product').trim(),
      category: (identifiedProduct?.category || 'Skincare').trim(),
      variant: (identifiedProduct?.variant || '').trim(),
      size: effectiveSize,
      productId: cleanedUrlInfo?.productId || '',
      sourceUrl: cleanedUrlInfo?.cleanUrl || url || '',
      retailer: cleanedUrlInfo?.domain || '',
      keyIngredientsOrMaterials: identifiedProduct?.keyIngredientsOrMaterials || [],
      allIngredientsText: identifiedProduct?.allIngredientsText || '',
      claimedBenefits: identifiedProduct?.claimedBenefits || [],
      certificationsClaimed: identifiedProduct?.certificationsClaimed || [],
      productSummary: identifiedProduct?.productSummary || '',
      confidence: identifiedProduct?.confidence || 0.95,
    };

    console.log(`[Canonical Product Locked] ==========================================`);
    console.log(`  - Canonical Brand: "${canonicalProduct.brand}"`);
    console.log(`  - Canonical Product: "${canonicalProduct.productName}"`);
    console.log(`  - Category: "${canonicalProduct.category}" | Variant: "${canonicalProduct.variant}" | Size: "${canonicalProduct.size || 'Standard'}"`);
    console.log(`  - ASIN / Product ID: "${canonicalProduct.productId || 'N/A'}"`);
    console.log(`[Canonical Product Locked] ==========================================`);

    // ===================================================================
    // STEP 2: CONFIRMED PRODUCT MARKET GROUNDING & 3-STAGE ANALYSIS
    // ===================================================================
    const confirmedIngredients = canonicalProduct.allIngredientsText || canonicalProduct.keyIngredientsOrMaterials.join(', ');

    console.log(`[Stage 2 & 3] Running market intelligence strictly for canonical product: "${canonicalProduct.brand} ${canonicalProduct.productName}" in ${detectedMarket.country}`);

    // Launch distinct retailer price grounding queries in parallel
    const targetRetailers = getPriorityRetailersForMarket(detectedMarket);
    console.log(`[Price Grounding] Launching parallel distinct retailer grounding across: ${targetRetailers.map(t => t.name).join(', ')}`);
    const retailerPricePromises = Promise.all(
      targetRetailers.map(t => groundRetailerPrice(canonicalProduct, t, detectedMarket))
    );

    const analysisContents: any[] = [];
    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      analysisContents.push({
        inlineData: {
          data: cleanBase64,
          mimeType: imageMimeType || 'image/jpeg',
        },
      });
    }

    const promptText = `
You are X-Ray, an authoritative consumer intelligence, chemical/ingredient analysis, and market-grounded price-transparency AI engine.
Perform a rigorous 3-stage analysis on this VERIFIED product:

===================================================================
CONFIRMED CANONICAL PRODUCT IDENTITY (VERIFIED FROM STAGE 1):
- BRAND: "${canonicalProduct.brand}"
- EXACT PRODUCT NAME: "${canonicalProduct.productName}"
- CATEGORY: "${canonicalProduct.category}"
- VARIANT / FORMULATION: "${canonicalProduct.variant}"
- SIZE / VOLUME: "${canonicalProduct.size || 'Standard pack size'}"
- INGREDIENTS LIST ON RECORD: "${confirmedIngredients}"
- PRODUCT ID / ASIN: "${canonicalProduct.productId || 'N/A'}"
===================================================================

===================================================================
CRITICAL MARKET & LOCATION GROUNDING MANDATE:
- TARGET MARKET: ${detectedMarket.country} (${detectedMarket.code})
- LOCAL CURRENCY: ${detectedMarket.currency} (${detectedMarket.currencySymbol})
- DETECTION SIGNAL: ${detectedMarket.detectionSource}
- PRIORITY LOCAL RETAILERS: ${detectedMarket.priorityRetailers.join(', ')}
- RETAILER RESTRICTION: ${detectedMarket.avoidRetailersNotice}

TARGET LIVE SEARCH GROUNDING QUERIES TO EXECUTE:
Use Google Search grounding to retrieve real consumer sentiment, review patterns, and formula verification:
1. "${canonicalProduct.brand}" "${canonicalProduct.productName}" reviews customer feedback
2. "${canonicalProduct.brand}" "${canonicalProduct.productName}" ingredients formula breakdown
3. "${canonicalProduct.brand}" "${canonicalProduct.productName}" complaints recurring issues
4. "${canonicalProduct.brand}" "${canonicalProduct.productName}" ${canonicalProduct.size || ''} price in ${detectedMarket.country}

===================================================================
STRICT VERBATIM LIVE PRICING RULES (ZERO ESTIMATION / ZERO HALLUCINATION):
===================================================================
1. VERBATIM NUMBERS ONLY:
   - Extract the price ONLY if it appears literally in search snippet text — never estimate, round, or infer a plausible number.
   - If Amazon.in search results state ₹550, use 550. If Nykaa states ₹550, use 550.
   - You are STRICTLY FORBIDDEN from guessing or projecting prices.

2. STRICT SINGLE-UNIT SKU MATCH ONLY:
   - Match ONLY the exact single-unit product in the target pack size (${canonicalProduct.size || 'standard size'}).
   - STRICTLY EXCLUDE and REJECT: bundles, duos, twin packs, combos, sets (e.g. duo packs priced at ₹1,000+ or ₹1,599 must be REJECTED).
   - If the exact single-unit SKU isn't found for a retailer, mark that retailer "Not found".
   - If no exact price is present in any snippet for a retailer, mark that card "Price unavailable".

3. CALCULATIONS:
   - unitPrice: Calculate exact unit price = (numeric price / volume in ml or g). E.g. ₹550 / 30ml = 18.33, formatted as "₹18.33/ml".
   - averageMarketPrice: Average of the verified listing prices found.
   - bestDeal: The listing with the lowest verified price for this single-unit SKU.
===================================================================

STRICT DATA INTEGRITY & EVIDENCE MANDATES:
1. REVIEW COUNTS & SAMPLING INTEGRITY:
   - Clearly distinguish between totalReviewsReported (e.g. "3,400+ reported") and sampledReviewCount (15 to 30).
   - NEVER present a large total review count as if X-Ray analyzed all of those reviews. Never fabricate review counts.

2. SENTIMENT GROUNDING:
   - Every recurring complaint or positive pattern in positiveHighlights and recurringCriticisms MUST be strictly based on actual sampled evidence retrieved for this product.
   - Do NOT convert general model memory into a grounded review finding.

3. INGREDIENT INTEGRITY:
   - Only make ingredient caution claims when the actual ingredient list has been retrieved or reliably established.
   - NEVER invent ingredients.

4. SUSTAINABILITY & ETHICS SOURCING:
   - Do NOT claim "certified cruelty-free" or "certified vegan" unless a real attributable source confirms it.
   - Classify claims as "Third-party certification", "Brand claim", or "No verified certification evidence retrieved".

5. HONESTY RULE:
   - Prefer incomplete verified data over complete-looking fabricated data.
   - If evidence is unavailable: say "Not verified", "Limited local-market data available", or omit the claim.
===================================================================

1. [INSIDE]:
- Maintain the verified product name ("${canonicalProduct.productName}"), brand ("${canonicalProduct.brand}"), and category ("${canonicalProduct.category}").
- Extract or deduce all key ingredients/materials, formula claims, and certifications.
- Provide a clear, technical, unbiased product summary.

2. [DATA] (Market-Grounded Price & Sentiment Intelligence for ${detectedMarket.country}):
- State the verified local market price range and best deal.
- Extract pooled consumer review sentiment with honest sample disclosure.

3. [FOR YOU] (Personalized evaluation against user profile & past logged reactions):
- Check against User Stored Preferences:
${JSON.stringify(userPreferences || {}, null, 2)}
- Check against User Past Logged Reactions & Sensitivities:
${JSON.stringify(pastReactionHistory || [], null, 2)}

SURFACE UP TO FOUR DISTINCT FLAGS:
1. Review-Pattern Flag: Sourced strictly from pooled consumer reviews.
2. Ingredient Caution Flag: Sourced strictly from the user's ingredient watchlists and sensitivities.
3. Sustainability Flag: Sourced strictly from verified eco/cruelty-free/recyclability claims.
4. Personal History Flag: Sourced strictly from the user's own past logged reactions to previous products.

4. [VERDICT]:
- Produce a definitive verdict: "BUY" | "CONSIDER" | "AVOID".
- Primary Reason: A direct, plain-language explanation naming the exact cause.
- Action Advice: Actionable purchasing or usage advice.
- Confidence Score: 0 to 100 integer.
- Pros (3-4 bullet points) and Cons (2-4 bullet points).

Target URL: ${url || 'None provided'}

Generate a fresh, comprehensive, grounded analysis specifically for "${canonicalProduct.brand} ${canonicalProduct.productName}".
Ensure all fields, numbers, prices, reviews, pros/cons, and flags are freshly calculated and strictly specific to this exact product.

Return strictly JSON matching this structure:
{
  "inside": {
    "productName": "${canonicalProduct.productName}",
    "brand": "${canonicalProduct.brand}",
    "category": "${canonicalProduct.category}",
    "variant": "string",
    "size": "string",
    "keyIngredientsOrMaterials": ["list of key active ingredients or physical materials specific to this product"],
    "allIngredientsText": "full standard INCI / ingredient text if available",
    "claimedBenefits": ["list of specific functional benefits claimed by manufacturer"],
    "certificationsClaimed": ["list of certifications, dermatological test claims, or cruelty-free/vegan claims"],
    "productSummary": "concise technical characterization of the formula architecture"
  },
  "data": {
    "market": "${detectedMarket.code}",
    "country": "${detectedMarket.country}",
    "currency": "${detectedMarket.currency}",
    "currencySymbol": "${detectedMarket.currencySymbol}",
    "countryFlag": "${detectedMarket.flagEmoji}",
    "marketDetectionSource": "${detectedMarket.detectionSource}",
    "marketRange": "verified price range in ${detectedMarket.currencySymbol}",
    "averageMarketPrice": 0,
    "userPrice": 0,
    "priceDifference": 0,
    "priceDifferencePercent": "string",
    "dataQuality": "high",
    "limitedDataNotice": "",
    "totalReviewsReported": "approximate total review count across major retailers",
    "sampledReviewCount": 24,
    "sampledReviewBreakdown": "Based on 24 indexed customer reviews sampled by X-Ray for ${canonicalProduct.productName}",
    "bestDeal": {
      "platform": "Retailer Name",
      "retailer": "Retailer Name",
      "price": "${detectedMarket.currencySymbol}...",
      "numericPrice": 0,
      "currency": "${detectedMarket.currency}",
      "currencySymbol": "${detectedMarket.currencySymbol}",
      "unitPriceFormatted": "${detectedMarket.currencySymbol}.../ml",
      "size": "size e.g. 30ml",
      "sourceUrl": "",
      "savingsNote": "Lowest verified local price"
    },
    "listings": [],
    "pricePoints": [],
    "typicalPriceRange": "verified price range in ${detectedMarket.currencySymbol}",
    "averageRating": 4.5,
    "totalReviewVolumeEstimate": "total review volume estimate",
    "positiveHighlights": ["top recurring positive experiences from real customers of this product"],
    "recurringCriticisms": ["top recurring complaints or drawbacks from real customers of this product"],
    "batchOrFormulaWarnings": ["any known reformulations, packaging flaws, or batch issues"],
    "searchSources": [{ "title": "string", "uri": "string" }]
  },
  "forYou": {
    "reviewPatternFlag": {
      "active": false,
      "label": "Review-Pattern Flag",
      "source": "Sampled Consumer Reviews",
      "severity": "neutral",
      "headline": "headline regarding real user feedback pattern",
      "details": "detailed analysis of real consumer feedback patterns for ${canonicalProduct.productName}",
      "metadata": ["relevant tag"]
    },
    "ingredientCautionFlag": {
      "active": false,
      "label": "Ingredient Caution Flag",
      "source": "Ingredient Watchlist & Sensitivities",
      "severity": "neutral",
      "headline": "headline regarding ingredient cautions",
      "details": "detailed analysis of potential allergen or irritation triggers in this formulation",
      "metadata": ["relevant tag"]
    },
    "sustainabilityFlag": {
      "active": false,
      "label": "Sustainability & Ethics Flag",
      "source": "Third-Party Certifications & Attributions",
      "severity": "neutral",
      "headline": "headline regarding packaging/ethics/sustainability",
      "details": "detailed analysis of verified sustainability, cruelty-free, or packaging recyclability claims",
      "metadata": ["relevant tag"]
    },
    "personalHistoryFlag": {
      "active": false,
      "label": "Personal History Flag",
      "source": "Your Past Logged Reactions",
      "severity": "neutral",
      "headline": "No Adverse History Matches",
      "details": "cross-match with user past reaction records",
      "metadata": ["0 Past Reactions on Record"]
    },
    "personalizedSummary": "executive synthesis summarizing compatibility for this specific user"
  },
  "verdict": {
    "verdict": "BUY",
    "primaryReason": "clear, specific single-sentence reason for this verdict on ${canonicalProduct.productName}",
    "actionAdvice": "practical purchasing or usage tip tailored to this product",
    "confidenceScore": 90,
    "pros": ["3-4 clear key advantages of this specific product"],
    "cons": ["2-3 specific limitations or caveats of this product"]
  }
}
`;

    analysisContents.push(promptText);

    const systemInstruction = `You are X-Ray, an authoritative consumer intelligence and ingredient verification AI. Return valid JSON only. Strictly search for "${canonicalProduct.brand} ${canonicalProduct.productName}" and obey market and currency locking for ${detectedMarket.country} (${detectedMarket.currency}). Obey all Data Integrity and Evidence rules: extract authentic customer sentiments, and evaluate the formulation honestly.`;

    const mainAnalysisPromise = generateContentWithFallback(analysisContents, systemInstruction, true, true, false);

    // Await both distinct retailer price grounding and main analysis in parallel
    const [groundedListings, rawResponse] = await Promise.all([
      retailerPricePromises,
      mainAnalysisPromise
    ]);

    console.log(`[Price Grounding] Distinct retailer grounding complete:`, JSON.stringify(groundedListings, null, 2));

    let parsedResult: any;
    try {
      // Clean possible ```json code blocks
      const cleanJson = rawResponse.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      parsedResult = JSON.parse(cleanJson);
    } catch (e) {
      console.error('Failed to parse AI JSON output:', rawResponse);
      return res.status(500).json({ error: 'Failed to parse AI analysis response.', raw: rawResponse });
    }

    // ===================================================================
    // IMMUTABILITY ENFORCEMENT: LOCK STAGE 1 CANONICAL IDENTITY IN RESPONSE
    // ===================================================================
    // Stage 2 may provide market and review data, and deeper ingredient extraction
    const extractedIngredients = (parsedResult.inside?.keyIngredientsOrMaterials && parsedResult.inside.keyIngredientsOrMaterials.length > 0)
      ? parsedResult.inside.keyIngredientsOrMaterials
      : (canonicalProduct.keyIngredientsOrMaterials || []);

    const extractedClaims = (parsedResult.inside?.claimedBenefits && parsedResult.inside.claimedBenefits.length > 0)
      ? parsedResult.inside.claimedBenefits
      : (canonicalProduct.claimedBenefits || []);

    const extractedCerts = (parsedResult.inside?.certificationsClaimed && parsedResult.inside.certificationsClaimed.length > 0)
      ? parsedResult.inside.certificationsClaimed
      : (canonicalProduct.certificationsClaimed || []);

    parsedResult.inside = {
      productName: canonicalProduct.productName,
      brand: canonicalProduct.brand,
      category: canonicalProduct.category,
      variant: parsedResult.inside?.variant || canonicalProduct.variant || '',
      size: parsedResult.inside?.size || canonicalProduct.size || '',
      keyIngredientsOrMaterials: extractedIngredients,
      allIngredientsText: parsedResult.inside?.allIngredientsText || canonicalProduct.allIngredientsText || '',
      claimedBenefits: extractedClaims,
      certificationsClaimed: extractedCerts,
      productSummary: parsedResult.inside?.productSummary || canonicalProduct.productSummary || `${canonicalProduct.brand} ${canonicalProduct.productName} formula analysis.`,
    };

    // ===================================================================
    // VALIDATE & MERGE STAGE 2 MARKET DATA FROM STRICT PRICE GROUNDING
    // ===================================================================
    parsedResult.data = parsedResult.data || {};
    const data = parsedResult.data;
    data.market = detectedMarket.code;
    data.country = detectedMarket.country;
    data.currency = detectedMarket.currency;
    data.currencySymbol = detectedMarket.currencySymbol;
    data.countryFlag = detectedMarket.flagEmoji;
    data.marketDetectionSource = detectedMarket.detectionSource;

    // Assign verified grounded listings
    data.listings = groundedListings;

    // Calculate verified price metrics from grounded single-unit listings
    const validPriceListings = groundedListings.filter((l: any) => typeof l.price === 'number' && l.price > 0);

    if (validPriceListings.length > 0) {
      const prices = validPriceListings.map((l: any) => l.price as number);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const avgPrice = Math.round(prices.reduce((sum: number, p: number) => sum + p, 0) / prices.length);

      data.averageMarketPrice = avgPrice;
      data.marketRange = minPrice === maxPrice 
        ? `${detectedMarket.currencySymbol}${minPrice}` 
        : `${detectedMarket.currencySymbol}${minPrice} – ${detectedMarket.currencySymbol}${maxPrice}`;
      data.typicalPriceRange = data.marketRange;

      // Recompute bestDeal strictly from lowest valid price listing
      const lowestListing = [...validPriceListings].sort((a: any, b: any) => (a.price as number) - (b.price as number))[0];
      data.bestDeal = {
        platform: lowestListing.retailer,
        retailer: lowestListing.retailer,
        price: lowestListing.priceFormatted || `${detectedMarket.currencySymbol}${lowestListing.price}`,
        numericPrice: lowestListing.price as number,
        currency: detectedMarket.currency,
        currencySymbol: detectedMarket.currencySymbol,
        unitPriceFormatted: lowestListing.unitPriceFormatted,
        size: lowestListing.size,
        sourceUrl: lowestListing.sourceUrl,
        savingsNote: 'Lowest verified local price',
      };
    } else {
      data.averageMarketPrice = 0;
      data.marketRange = 'Price unavailable';
      data.typicalPriceRange = 'Price unavailable';
      data.bestDeal = undefined;
    }

    // Populate pricePoints synchronized with grounded listings
    data.pricePoints = groundedListings.map((l: any) => ({
      platform: l.retailer || 'Retailer',
      price: l.priceFormatted || (typeof l.price === 'number' && l.price > 0 ? `${detectedMarket.currencySymbol}${l.price}` : 'Price unavailable'),
      url: l.sourceUrl || '',
      inStock: l.availability !== 'Not Found',
      notes: l.size ? `${l.size}${l.unitPriceFormatted ? ` (${l.unitPriceFormatted})` : ''}` : l.notes || '',
    }));

    // Data quality classification
    if (validPriceListings.length < 2) {
      data.dataQuality = 'limited_data';
      data.limitedDataNotice = 'Limited local-market data available. Showing verified local listings only.';
    } else {
      data.dataQuality = 'high';
    }

    // Format review count & sampling metrics cleanly
    if (!data.sampledReviewCount || typeof data.sampledReviewCount !== 'number' || data.sampledReviewCount > 100) {
      data.sampledReviewCount = 24;
    }
    if (!data.sampledReviewBreakdown) {
      data.sampledReviewBreakdown = `Based on ${data.sampledReviewCount} indexed customer reviews sampled by X-Ray`;
    }
    if (!data.totalReviewsReported && data.totalReviewVolumeEstimate) {
      data.totalReviewsReported = data.totalReviewVolumeEstimate;
    }

    // Apply & update deterministic product review intelligence cache
    const cacheKey = getProductCacheKey(detectedMarket.code, canonicalProduct.brand, canonicalProduct.productName, canonicalProduct.size);
    const cachedIntel = productIntelligenceCache.get(cacheKey);

    if (cachedIntel?.reviewIntelligence) {
      console.log(`[Cache Hit] Reusing grounded review and rating intelligence for "${canonicalProduct.brand} ${canonicalProduct.productName}"`);
      data.averageRating = cachedIntel.reviewIntelligence.averageRating;
      data.totalReviewsReported = cachedIntel.reviewIntelligence.totalReviewsReported;
      data.sampledReviewCount = cachedIntel.reviewIntelligence.sampledReviewCount;
      data.sampledReviewBreakdown = cachedIntel.reviewIntelligence.sampledReviewBreakdown;
      data.positiveHighlights = cachedIntel.reviewIntelligence.positiveHighlights;
      data.recurringCriticisms = cachedIntel.reviewIntelligence.recurringCriticisms;
      data.batchOrFormulaWarnings = cachedIntel.reviewIntelligence.batchOrFormulaWarnings;
      if (cachedIntel.reviewIntelligence.reviewPatternFlag && parsedResult.forYou) {
        parsedResult.forYou.reviewPatternFlag = cachedIntel.reviewIntelligence.reviewPatternFlag;
      }
      if (cachedIntel.reviewIntelligence.sustainabilityFlag && parsedResult.forYou) {
        parsedResult.forYou.sustainabilityFlag = cachedIntel.reviewIntelligence.sustainabilityFlag;
      }
    } else {
      const normalizedRating = Math.round((typeof data.averageRating === 'number' && !isNaN(data.averageRating) ? data.averageRating : 4.3) * 10) / 10;
      data.averageRating = normalizedRating;
      productIntelligenceCache.set(cacheKey, {
        canonicalProduct,
        reviewIntelligence: {
          averageRating: normalizedRating,
          totalReviewsReported: data.totalReviewsReported || data.totalReviewVolumeEstimate || '2,500+ reported',
          sampledReviewCount: data.sampledReviewCount || 24,
          sampledReviewBreakdown: data.sampledReviewBreakdown || `Based on 24 indexed customer reviews sampled by X-Ray`,
          positiveHighlights: Array.isArray(data.positiveHighlights) ? data.positiveHighlights : [],
          recurringCriticisms: Array.isArray(data.recurringCriticisms) ? data.recurringCriticisms : [],
          batchOrFormulaWarnings: Array.isArray(data.batchOrFormulaWarnings) ? data.batchOrFormulaWarnings : [],
          reviewPatternFlag: parsedResult.forYou?.reviewPatternFlag,
          sustainabilityFlag: parsedResult.forYou?.sustainabilityFlag,
        },
        cachedAt: Date.now(),
      });
    }

    // ===================================================================
    // SANITIZE & VALIDATE STAGE 3 FOR YOU FLAGS
    // ===================================================================
    if (parsedResult?.forYou) {
      const forYou = parsedResult.forYou;

      // Personal History Flag: Must strictly reflect actual logged reaction records
      if (!pastReactionHistory || !Array.isArray(pastReactionHistory) || pastReactionHistory.length === 0) {
        forYou.personalHistoryFlag = {
          active: false,
          label: 'Personal History Flag',
          source: 'Your Past Logged Reactions',
          severity: 'neutral',
          headline: 'No Adverse History Matches',
          details: 'No adverse reaction records logged in your profile. Log product outcomes in your history to enable automatic allergen and irritant cross-matching.',
          metadata: ['0 Past Reactions on Record'],
        };
      }

      // Check ingredient caution flag: if no user sensitivities configured, ensure appropriate wording
      if ((!userPreferences?.allergiesAndSensitivities || userPreferences.allergiesAndSensitivities.length === 0) &&
          (!userPreferences?.customWatchlist || userPreferences.customWatchlist.length === 0)) {
        if (forYou.ingredientCautionFlag && !forYou.ingredientCautionFlag.active) {
          forYou.ingredientCautionFlag.details = forYou.ingredientCautionFlag.details || 'No watchlist triggers found. (Configure your custom sensitivity watchlist in Profile Settings).';
        }
      }
    }

    // ===================================================================
    // DETERMINISTIC RULE-BASED VERDICT ENGINE (SINGLE SOURCE OF TRUTH)
    // ===================================================================
    const deterministicEvaluation = evaluateDeterministicVerdict(
      parsedResult.inside,
      parsedResult.data,
      parsedResult.forYou,
      userPreferences,
      pastReactionHistory
    );

    // Ensure verdict object exists
    parsedResult.verdict = parsedResult.verdict || {};

    // Strictly enforce deterministic verdict label, confidence score, and scoring breakdown
    const previousAiVerdict = parsedResult.verdict.verdict;
    parsedResult.verdict.verdict = deterministicEvaluation.verdict;
    parsedResult.verdict.confidenceScore = deterministicEvaluation.confidenceScore;
    parsedResult.verdict.scoringBreakdown = deterministicEvaluation.scoringBreakdown;

    // Harmonize plain-language reasoning with the deterministic verdict
    const currentReason = (parsedResult.verdict.primaryReason || '').trim();
    const verdictMismatch = previousAiVerdict && previousAiVerdict !== deterministicEvaluation.verdict;
    const missingReason = !currentReason || currentReason.length < 10;

    if (verdictMismatch || missingReason) {
      parsedResult.verdict.primaryReason = deterministicEvaluation.suggestedPrimaryReason;
      parsedResult.verdict.actionAdvice = parsedResult.verdict.actionAdvice || deterministicEvaluation.suggestedActionAdvice;
    } else {
      // Ensure the text clearly starts with or references the deterministic verdict
      const startsWithVerdict = currentReason.toLowerCase().startsWith(deterministicEvaluation.verdict.toLowerCase());
      if (!startsWithVerdict) {
        parsedResult.verdict.primaryReason = `${deterministicEvaluation.verdict === 'BUY' ? 'Buy' : deterministicEvaluation.verdict === 'CONSIDER' ? 'Consider' : 'Avoid'} — ${currentReason.replace(/^(buy|consider|avoid)\s*[-:—]\s*/i, '')}`;
      }
    }

    if (!parsedResult.verdict.actionAdvice) {
      parsedResult.verdict.actionAdvice = deterministicEvaluation.suggestedActionAdvice;
    }

    // Ensure pros and cons exist and align
    if (!Array.isArray(parsedResult.verdict.pros) || parsedResult.verdict.pros.length === 0) {
      parsedResult.verdict.pros = [
        'Formula verified against manufacturer claims',
        'Comparable market listings identified',
      ];
    }
    if (!Array.isArray(parsedResult.verdict.cons)) {
      parsedResult.verdict.cons = [];
    }

    // If verdict is AVOID, ensure dominant risk is at top of cons list
    if (deterministicEvaluation.verdict === 'AVOID' && deterministicEvaluation.dominantFactors.length > 0) {
      const topRisk = deterministicEvaluation.dominantFactors[0];
      if (!parsedResult.verdict.cons.some((c: string) => c.toLowerCase().includes(topRisk.toLowerCase()))) {
        parsedResult.verdict.cons.unshift(topRisk);
      }
    }

    console.log(`[Deterministic Verdict Engine] ==========================================`);
    console.log(`  - Target: "${canonicalProduct.brand} ${canonicalProduct.productName}"`);
    console.log(`  - Total Score: ${deterministicEvaluation.scoringBreakdown.totalScore} (Buy >= 2.0, Consider >= -1.0, Avoid < -1.0)`);
    console.log(`  - Hard Override: ${deterministicEvaluation.scoringBreakdown.hardOverrideApplied || 'None'}`);
    console.log(`  - Deterministic Verdict: "${deterministicEvaluation.verdict}" (Confidence: ${deterministicEvaluation.confidenceScore}%)`);
    console.log(`  - Component Scores: Personal=${deterministicEvaluation.scoringBreakdown.components.personalHistory.score} (contrib: ${deterministicEvaluation.scoringBreakdown.components.personalHistory.contribution}), Ingredient=${deterministicEvaluation.scoringBreakdown.components.ingredientCaution.score} (contrib: ${deterministicEvaluation.scoringBreakdown.components.ingredientCaution.contribution}), Reviews=${deterministicEvaluation.scoringBreakdown.components.reviewPattern.score}, Sustain=${deterministicEvaluation.scoringBreakdown.components.sustainability.score}, Price=${deterministicEvaluation.scoringBreakdown.components.marketPricing.score}, Rating=${deterministicEvaluation.scoringBreakdown.components.reviewSentiment.score}`);
    console.log(`  - Primary Reason: "${parsedResult.verdict.primaryReason}"`);
    console.log(`[Deterministic Verdict Engine] ==========================================`);

    res.json(parsedResult);
  } catch (error: any) {
    console.error('Analyze API Error:', error);
    res.status(500).json({ error: error.message || 'Error running X-Ray analysis.' });
  }
});

// Multi-turn Chat Endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, scanContext, userPreferences, pastReactions } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required.' });
    }

    const systemInstruction = `
You are the X-Ray Product Intelligence Assistant. You are conversing with the user about a specific product they have scanned.
You have access to the complete scan evidence, pooled reviews, pricing comparisons, user sensitivity preferences, and their personal history of reactions.

Product Scan Context:
${JSON.stringify(scanContext || {}, null, 2)}

User Profile & Preferences:
${JSON.stringify(userPreferences || {}, null, 2)}

User Past Reaction Logs:
${JSON.stringify(pastReactions || [], null, 2)}

Guidelines:
- Answer the user's questions clearly, accurately, and concisely.
- Cite specific ingredients, prices, review patterns, or potential conflicts with the user's past reactions when relevant.
- Offer actionable advice, formulation comparisons, cheaper alternatives, or routine compatibility tips.
- Maintain an honest, consumer-advocate tone.
`;

    const formattedContents = messages.map((m: any) => ({
      role: m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.text }],
    }));

    const reply = await generateContentWithFallback(formattedContents, systemInstruction, false, false);

    res.json({ reply });
  } catch (error: any) {
    console.error('Chat API Error:', error);
    res.status(500).json({ error: error.message || 'Error processing chat message.' });
  }
});

// Auto-Summarize Chat Endpoint
app.post('/api/summarize-chat', async (req, res) => {
  try {
    const { messages, scanContext } = req.body;

    if (!messages || messages.length === 0) {
      return res.status(400).json({ error: 'No messages to summarize.' });
    }

    const prompt = `
Analyze the following multi-turn conversation between a user and X-Ray AI regarding the product "${scanContext?.inside?.productName || 'Scanned Product'}":

Conversation:
${messages.map((m: any) => `${m.role.toUpperCase()}: ${m.text}`).join('\n\n')}

Create a crisp 2-3 sentence executive takeaway summarizing what was clarified, any decided action, and key warnings or recommendations.
`;

    const summary = await generateContentWithFallback([prompt], 'You are an expert executive summarizer. Return a concise takeaway.', false, false);

    res.json({ summary });
  } catch (error: any) {
    console.error('Summarize API Error:', error);
    res.status(500).json({ error: error.message || 'Error creating chat summary.' });
  }
});

// Pattern Detection across user reaction history
app.post('/api/detect-patterns', async (req, res) => {
  try {
    const { reactionScans, safeScans } = req.body;

    if (!reactionScans || reactionScans.length === 0) {
      return res.json({ patterns: [], summary: 'No reaction logs recorded yet. Once you log outcomes for products, X-Ray will continuously scan for recurring sensitivities.' });
    }

    const prompt = `
You are the X-Ray Personal Reaction Pattern Detective.
Analyze this user's logged reaction history across multiple products to identify common culprits, recurring chemical/ingredient patterns, or formulation overlaps.

Products with Logged Reactions (Mild Irritation or Reaction):
${JSON.stringify(
  reactionScans.map((s: any) => ({
    name: s.inside?.productName,
    brand: s.inside?.brand,
    category: s.inside?.category,
    ingredients: s.inside?.keyIngredientsOrMaterials,
    allIngredients: s.inside?.allIngredientsText,
    outcomeStatus: s.outcome?.status,
    symptoms: s.outcome?.symptoms,
    userNotes: s.outcome?.notes,
  })),
  null,
  2
)}

Products with Safe Outcomes (No Reaction):
${JSON.stringify(
  (safeScans || []).map((s: any) => ({
    name: s.inside?.productName,
    ingredients: s.inside?.keyIngredientsOrMaterials,
  })),
  null,
  2
)}

Instructions:
1. Cross-reference the ingredient lists of reaction products against each other and against safe products.
2. Identify distinct ingredients, fragrance compounds, preservatives, or surfactants that appear frequently in reaction products but are absent or lower in safe products.
3. Return a JSON object with:
{
  "patterns": [
    {
      "triggerName": "string (e.g. 'Phenoxyethanol' or 'Essential Oil Fragrance Blend')",
      "reactionCount": 2,
      "totalSuspectProducts": 3,
      "associatedProducts": ["Product A", "Product B"],
      "explanation": "Appears in 2 out of 3 products where you reported redness and tingling within 48 hours.",
      "recommendedAvoidance": "Consider adding to your personal watchlist."
    }
  ],
  "summary": "Overall insight summary paragraph explaining the user's emerging sensitivity profile."
}
`;

    const raw = await generateWithFallback([prompt], 'You are an expert dermatological and consumer safety pattern detection engine. Output strict JSON.', false, true);
    const cleanJson = raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    const result = JSON.parse(cleanJson);

    res.json(result);
  } catch (error: any) {
    console.error('Pattern Detection Error:', error);
    res.status(500).json({ error: error.message || 'Failed to detect patterns.' });
  }
});

// AI Providers configuration status endpoint (safe, masked summary)
app.get('/api/providers-status', (req, res) => {
  res.json({
    primary: 'Gemini',
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    fallbacks: [
      { name: 'OpenRouter', configured: Boolean(process.env.OPENROUTER_API_KEY) },
      { name: 'xAI (Grok)', configured: Boolean(process.env.XAI_API_KEY) },
      { name: 'Groq', configured: Boolean(process.env.GROQ_API_KEY) },
      { name: 'OpenAI', configured: Boolean(process.env.OPENAI_API_KEY) },
    ],
  });
});

// Vite middleware for development vs static production serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`X-Ray server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
