import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, MessageCircle, Send, X } from 'lucide-react';
import { useShoppingMuse, ShoppingMuseWidget } from '../hooks/useShoppingMuse';
import { useConfig } from '../context/ConfigContext';

type ChatRole = 'user' | 'assistant';

interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  widgets?: ShoppingMuseWidget[];
  support?: boolean;
}

interface MuseChatOverlayProps {
  onClose: () => void;
}

function getSlotDisplayName(slot: { sku?: string; productData?: Record<string, unknown> }): string {
  const candidateKeys = ['name', 'title', 'productName'];
  for (const key of candidateKeys) {
    const value = slot.productData?.[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return 'Unnamed product';
}

function getSlotPrice(slot: { productData?: Record<string, unknown> }): string {
  const priceKeys = ['price', 'dy_display_price', 'displayPrice'];
  for (const key of priceKeys) {
    const value = slot.productData?.[key];
    if (typeof value === 'number') {
      return value.toFixed(2);
    }
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return 'N/A';
}

export const MuseChatOverlay: React.FC<MuseChatOverlayProps> = ({ onClose }) => {
  const { config } = useConfig();
  const [chatId, setChatId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hi, I am Muse. Tell me what you want to shop for and I will help you find products.',
    },
  ]);

  const { mutateAsync, isPending, error } = useShoppingMuse();
  const listRef = useRef<HTMLDivElement>(null);
  const sliderRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const currency = (config.currency || 'PLN').toUpperCase();

  const canSend = useMemo(() => draft.trim().length > 0 && draft.trim().length <= 250 && !isPending, [draft, isPending]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    if (!listRef.current) {
      return;
    }
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, isPending]);

  const scrollSlider = (sliderId: string, direction: 'left' | 'right') => {
    const node = sliderRefs.current[sliderId];
    if (!node) {
      return;
    }

    const shift = 280;
    node.scrollBy({ left: direction === 'left' ? -shift : shift, behavior: 'smooth' });
  };

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || text.length > 250 || isPending) {
      return;
    }

    setDraft('');

    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-user`,
        role: 'user',
        text,
      },
    ]);

    try {
      const response = await mutateAsync({ text, chatId: chatId ?? undefined });

      if (response.chatId) {
        setChatId(response.chatId);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-assistant`,
          role: 'assistant',
          text: response.assistant || 'I do not have a response yet. Try refining your request.',
          widgets: response.widgets,
          support: response.support,
        },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Shopping Muse request failed';
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-error`,
          role: 'assistant',
          text: `Sorry, I ran into an error: ${message}`,
        },
      ]);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onMouseDown={onClose}
        className="fixed inset-0 z-50 bg-black/35 backdrop-blur-sm"
      >
        <motion.aside
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 280 }}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute inset-y-0 right-0 w-full md:w-1/2 bg-white shadow-2xl border-l border-black/10 flex flex-col"
        >
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle size={18} />
              <h2 className="text-sm font-bold uppercase tracking-wider">Ask Muse</h2>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded" aria-label="Close chat">
              <X size={18} />
            </button>
          </div>

          <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[#fcfcfc]">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed border ${
                    msg.role === 'user'
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-black border-gray-200'
                  }`}
                >
                  <p>{msg.text}</p>
                  {msg.support ? (
                    <p className="mt-2 text-xs uppercase tracking-wider opacity-80">Support suggested</p>
                  ) : null}

                  {msg.widgets && msg.widgets.length > 0 ? (
                    <div className="mt-3 space-y-3">
                      {msg.widgets.map((widget, widgetIdx) => (
                        <div key={`${msg.id}-widget-${widgetIdx}`} className="rounded border border-gray-100 p-2 bg-[#fafafa]">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-600">
                              {widget.title || 'Recommendations'}
                            </p>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => scrollSlider(`${msg.id}-widget-${widgetIdx}`, 'left')}
                                className="h-6 w-6 rounded border border-gray-200 bg-white flex items-center justify-center hover:border-black"
                                aria-label="Slide left"
                              >
                                <ChevronLeft size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => scrollSlider(`${msg.id}-widget-${widgetIdx}`, 'right')}
                                className="h-6 w-6 rounded border border-gray-200 bg-white flex items-center justify-center hover:border-black"
                                aria-label="Slide right"
                              >
                                <ChevronRight size={14} />
                              </button>
                            </div>
                          </div>
                          <div
                            ref={(el) => {
                              sliderRefs.current[`${msg.id}-widget-${widgetIdx}`] = el;
                            }}
                            className="mt-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                          >
                            <div className="flex gap-2 min-w-max">
                              {(widget.slots || []).slice(0, 12).map((slot, slotIdx) => {
                                const image =
                                  (slot.productData?.image_url as string) ||
                                  (slot.productData?.imageUrl as string) ||
                                  (slot.productData?.image_url_small as string) ||
                                  'https://placehold.co/160x160?text=No+Image';

                                return (
                                  <article key={`${slot.slotId || slot.sku || slotIdx}`} className="w-36 rounded border border-gray-200 bg-white">
                                    <div className="aspect-square overflow-hidden rounded-t bg-gray-100">
                                      <img
                                        src={image}
                                        alt={getSlotDisplayName(slot)}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).src = 'https://placehold.co/160x160?text=No+Image';
                                        }}
                                      />
                                    </div>
                                    <div className="p-2">
                                      <p className="text-[11px] font-medium line-clamp-2 h-8">{getSlotDisplayName(slot)}</p>
                                      <p className="text-[10px] text-black/60 font-semibold mt-1 truncate">
                                        {currency} {getSlotPrice(slot)}
                                      </p>
                                    </div>
                                  </article>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}

            {isPending ? (
              <div className="flex justify-start">
                <div className="rounded-lg px-3 py-2 text-sm border border-gray-200 bg-white text-gray-500">
                  Muse is thinking...
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-t border-gray-100 p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask for products, outfits, style ideas, or recommendations..."
                rows={2}
                maxLength={250}
                className="flex-1 resize-none bg-black/5 hover:bg-black/8 focus:bg-white border border-transparent focus:border-black rounded-sm py-2 px-3 text-sm transition-all outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage();
                  }
                }}
              />
              <button
                onClick={() => void sendMessage()}
                disabled={!canSend}
                className={`h-10 px-4 rounded-sm text-xs font-bold uppercase tracking-widest transition-colors ${
                  canSend ? 'bg-black text-white hover:bg-gray-900' : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                }`}
              >
                <Send size={14} />
              </button>
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] text-gray-400 uppercase tracking-wider">
              <span>Enter to send, Shift+Enter for new line</span>
              <span>{draft.trim().length}/250</span>
            </div>
            {error ? <p className="mt-2 text-xs text-red-600">{error.message}</p> : null}
          </div>
        </motion.aside>
      </motion.div>
    </AnimatePresence>
  );
};
