import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Sparkles, 
  Bot, 
  User as UserIcon, 
  FileCheck2, 
  MessageSquare, 
  HelpCircle, 
  Lightbulb,
  Check
} from 'lucide-react';
import { ChatMessage, ScanRecord, UserPreferences } from '../types';

interface ProductChatProps {
  scan: ScanRecord;
  userPreferences: UserPreferences;
  pastReactions: ScanRecord[];
  onUpdateConversation: (messages: ChatMessage[], summary?: string) => Promise<void>;
}

export const ProductChat: React.FC<ProductChatProps> = ({
  scan,
  userPreferences,
  pastReactions,
  onUpdateConversation,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(scan.conversation || []);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState<string | undefined>(scan.conversationSummary);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const productName = scan.inside?.productName || 'this product';
  const brandName = scan.inside?.brand || '';
  const fullName = brandName ? `${brandName} ${productName}` : productName;
  const verdict = scan.verdict?.verdict || 'analysis';
  const category = scan.inside?.category || 'formula';

  // Dynamically generate suggested inquiries specific to the current product
  const suggestedPrompts = [
    `Is ${productName} safe to layer alongside Retinol or AHA / BHA exfoliants?`,
    `Why did ${productName} receive a ${verdict} verdict in my evaluation?`,
    `Are there cleaner, fragrance-free alternatives or cheaper dupes for ${productName}?`,
    `How do the key active ingredients in this ${category} compare to my sensitivity watchlist?`,
    scan.data?.bestDeal?.price
      ? `Explain the price differences found across retailers for ${productName} (${scan.data.bestDeal.price} at ${scan.data.bestDeal.retailer}).`
      : `How should I properly patch-test ${productName} before regular use?`
  ];

  useEffect(() => {
    setMessages(scan.conversation || []);
    setSummary(scan.conversationSummary);
    setInput('');
  }, [scan.id, scan.conversation, scan.conversationSummary]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const handleSendMessage = async (textToSend?: string) => {
    const messageText = (textToSend || input).trim();
    if (!messageText || isSending) return;

    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      role: 'user',
      text: messageText,
      timestamp: new Date().toISOString(),
    };

    const updated = [...messages, userMsg];
    setMessages(updated);
    if (!textToSend) setInput('');
    setIsSending(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updated,
          scanContext: scan,
          userPreferences,
          pastReactions: pastReactions.map((p) => ({
            name: p.inside?.productName,
            ingredients: p.inside?.keyIngredientsOrMaterials,
            outcome: p.outcome,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response from Gemini.');
      }

      const data = await response.json();
      const modelMsg: ChatMessage = {
        id: 'msg-' + (Date.now() + 1),
        role: 'model',
        text: data.reply,
        timestamp: new Date().toISOString(),
      };

      const finalMessages = [...updated, modelMsg];
      setMessages(finalMessages);
      await onUpdateConversation(finalMessages, summary);
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMsg: ChatMessage = {
        id: 'msg-err-' + Date.now(),
        role: 'model',
        text: 'Sorry, I encountered an issue connecting to the X-Ray reasoning engine. Please try asking again.',
        timestamp: new Date().toISOString(),
      };
      setMessages([...updated, errorMsg]);
    } finally {
      setIsSending(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (messages.length === 0 || isSummarizing) return;
    setIsSummarizing(true);
    try {
      const response = await fetch('/api/summarize-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          scanContext: scan,
        }),
      });

      if (!response.ok) throw new Error('Failed to summarize conversation.');
      const data = await response.json();
      setSummary(data.summary);
      await onUpdateConversation(messages, data.summary);
    } catch (err: any) {
      console.error('Summarize error:', err);
    } finally {
      setIsSummarizing(false);
    }
  };

  return (
    <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#222]">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 font-mono text-[10px] uppercase tracking-widest font-bold">
            <Bot className="w-3.5 h-3.5" />
            <span>INTERACTIVE INTELLIGENCE ASSISTANT</span>
          </div>
          <h3 className="text-lg font-bold text-white mt-1">
            Ask Gemini About {scan.inside?.productName || 'This Product'}
          </h3>
          <p className="text-xs font-mono text-[#666] mt-0.5">
            Contextualized with full scan evidence, price comparisons, and your personal profile.
          </p>
        </div>

        {messages.length > 1 && (
          <button
            id="btn-summarize-chat"
            onClick={handleGenerateSummary}
            disabled={isSummarizing}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded bg-[#111] hover:bg-[#181818] text-xs font-mono font-bold text-cyan-400 border border-[#222] transition-colors disabled:opacity-50 cursor-pointer"
          >
            <FileCheck2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isSummarizing ? 'GENERATING...' : 'END & SUMMARIZE'}</span>
          </button>
        )}
      </div>

      {/* Auto-Generated Summary Box if present */}
      {summary && (
        <div className="p-4 rounded-xl bg-[#111] border border-cyan-500/30 text-xs text-cyan-200 space-y-1 font-mono">
          <div className="font-bold text-white flex items-center gap-2 text-[10px] uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>CONSULTATION KEY TAKEAWAY</span>
          </div>
          <p className="leading-relaxed text-[#aaa]">{summary}</p>
        </div>
      )}

      {/* Message Stream */}
      <div className="bg-[#111] border border-[#222] rounded-xl p-4 sm:p-5 min-h-[260px] max-h-[420px] overflow-y-auto space-y-4 font-mono">
        {messages.length === 0 ? (
          <div className="text-center py-10 space-y-3">
            <div className="w-10 h-10 rounded-full bg-[#0a0a0a] border border-[#222] text-[#666] flex items-center justify-center mx-auto">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="text-sm font-bold text-white uppercase">
              Have questions about application, pricing, or safety?
            </div>
            <div className="text-xs text-[#666] max-w-md mx-auto">
              Select a quick prompt below or type your custom inquiry. Gemini will answer using the scan's chemical breakdown and your personal history.
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 text-xs ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.role === 'model' && (
                <div className="w-7 h-7 rounded bg-[#0a0a0a] border border-cyan-500/30 text-cyan-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-xl p-3.5 ${
                  msg.role === 'user'
                    ? 'bg-cyan-500 text-black font-semibold rounded-tr-none'
                    : 'bg-[#0a0a0a] border border-[#222] text-[#ccc] rounded-tl-none leading-relaxed'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.text}</div>
                <div
                  className={`text-[9px] mt-1 font-mono ${
                    msg.role === 'user' ? 'text-black/70' : 'text-[#555]'
                  }`}
                >
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>

              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded bg-[#222] text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                  <UserIcon className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          ))
        )}

        {isSending && (
          <div className="flex gap-3 text-xs justify-start">
            <div className="w-7 h-7 rounded bg-[#0a0a0a] border border-cyan-500/30 text-cyan-400 flex items-center justify-center flex-shrink-0">
              <Bot className="w-3.5 h-3.5 animate-pulse" />
            </div>
            <div className="bg-[#0a0a0a] border border-[#222] text-[#888] rounded-xl p-3.5 rounded-tl-none flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></div>
              <span>X-Ray is synthesizing response with product evidence...</span>
            </div>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Suggested Prompt Chips */}
      <div className="space-y-2">
        <div className="text-[10px] font-mono uppercase tracking-widest text-[#666] flex items-center gap-1.5">
          <Lightbulb className="w-3 h-3 text-cyan-400" />
          <span>Suggested Inquiries:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {suggestedPrompts.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(prompt)}
              disabled={isSending}
              className="text-left text-xs font-mono px-3 py-1.5 rounded bg-[#111] hover:bg-[#181818] border border-[#222] hover:border-cyan-500/40 text-[#aaa] transition-colors disabled:opacity-50 cursor-pointer"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Message Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="flex items-center gap-2"
      >
        <input
          id="input-chat-message"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask anything about ${scan.inside?.productName || 'this formula'}...`}
          disabled={isSending}
          className="flex-1 bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-xs font-mono text-white placeholder-[#555] focus:outline-none focus:border-cyan-500 transition-all"
        />
        <button
          id="btn-chat-send"
          type="submit"
          disabled={!input.trim() || isSending}
          className="p-3 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black font-bold rounded-xl transition-all cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
