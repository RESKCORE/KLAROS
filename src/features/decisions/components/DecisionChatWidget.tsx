import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { askQuestion } from '@/services/llm/llm-service';
import type { MarketMetrics } from '@/features/market/utils/market-metrics';

interface DecisionChatWidgetProps {
  metrics: MarketMetrics | null;
}

export const DecisionChatWidget: React.FC<DecisionChatWidgetProps> = ({ metrics }) => {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, chatLoading]);

  const handleSendChat = async () => {
    if (!chatInput.trim() || chatLoading || !metrics) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setChatLoading(true);

    try {
      const history = chatMessages;
      const metricsJson = JSON.stringify({
        kpis: metrics.kpis,
        topProducts: metrics.topProducts.slice(0, 8),
        revenueByCategory: metrics.revenueByCategory,
        lowStockCount: metrics.kpis.lowStockCount,
      });
      const answer = await askQuestion(userMsg, metricsJson, history);
      setChatMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
    } catch (err) {
      console.error(err);
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'AI assistant is temporarily unavailable. Check your internet connection or API key configurations.',
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {chatOpen && (
        <div className="mb-4 w-96 rounded-3xl border border-slate-100/80 bg-white shadow-[0_12px_48px_rgba(0,0,0,0.12)] overflow-hidden flex flex-col h-[480px] animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-white/10 flex items-center justify-center">
                <Bot className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider">Klaros AI Companion</span>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              className="text-[10px] bg-white/15 hover:bg-white/25 border border-white/10 text-white font-medium rounded-lg px-2.5 py-1 transition-colors"
            >
              Hide
            </button>
          </div>

          {/* Chat list */}
          <ScrollArea className="flex-1 p-4 bg-slate-50/50">
            {chatMessages.length === 0 ? (
              <div className="text-center py-16 space-y-2">
                <div className="h-10 w-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-sm">
                  <Bot className="h-5 w-5" />
                </div>
                <p className="text-xs font-bold text-slate-800">Ask about your metrics</p>
                <p className="text-[11px] text-slate-400 max-w-[200px] mx-auto">
                  Query profit margin, product performance, stock ratios, and category revenue.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-[0_1px_2px_rgba(0,0,0,0.02)] ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white rounded-br-sm'
                          : 'bg-white border border-slate-100 text-slate-750 rounded-bl-sm font-medium'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl bg-white border border-slate-100 px-4 py-2.5 text-slate-400 text-xs shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex gap-1">
                      <span className="animate-bounce font-bold">●</span>
                      <span className="animate-bounce font-bold [animation-delay:0.2s]">●</span>
                      <span className="animate-bounce font-bold [animation-delay:0.4s]">●</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Footer Form */}
          <div className="p-3 border-t border-slate-100 bg-white flex gap-2">
            <Input
              placeholder="Ask a question..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSendChat();
                }
              }}
              disabled={chatLoading}
              className="rounded-2xl text-xs h-10 border-slate-200 focus-visible:ring-blue-600 bg-slate-50/50"
            />
            <button
              onClick={() => void handleSendChat()}
              disabled={chatLoading || !chatInput.trim()}
              className="h-10 w-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white hover:bg-blue-700 transition-all disabled:opacity-50 shrink-0 shadow-sm"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setChatOpen((v) => !v)}
        className="h-12 w-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg hover:bg-blue-700 transition-all hover:scale-105 active:scale-95 p-3"
      >
        <Bot className="h-6 w-6 text-white" />
      </button>
    </div>
  );
};
