import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { usePlatform } from '../context/PlatformContext.tsx';

const SUPPORT_THREAD_ID = 'support-thread';

export const SupportChat: React.FC = () => {
  const { route, messages, userAccount, clientProfile, workspace, sendSupportMessage } = usePlatform();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const senderName = userAccount?.fullName || clientProfile?.contactName || workspace.displayName;
  const senderEmail = userAccount?.email || clientProfile?.contactEmail;

  const supportMessages = useMemo(
    () =>
      messages
        .filter((message) => message.threadId === SUPPORT_THREAD_ID)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [messages]
  );

  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [open, supportMessages.length]);

  // Admin replies are handled in the Admin Center's message tab.
  if (route.page === 'admin') return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await sendSupportMessage({ body: text, senderName, senderEmail });
      setBody('');
    } catch {
      // Errors are surfaced as a toast by sendSupportMessage.
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3">
      {open && (
        <section
          aria-label="Live support chat"
          className="w-[320px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
        >
          <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-white">
                <MessageCircle className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-zinc-950">Live Support</p>
                <p className="text-[10px] text-zinc-500">We typically reply shortly</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close live support chat"
              className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-950 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={listRef} className="h-72 space-y-3 overflow-y-auto bg-zinc-50/60 px-3.5 py-4">
            {supportMessages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                <MessageCircle className="mb-2 h-6 w-6 text-zinc-300" />
                <p className="text-xs font-semibold text-zinc-700">Need a hand?</p>
                <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                  Send us a message and our team will get back to you here.
                </p>
              </div>
            ) : (
              supportMessages.map((message) => {
                const isOwn = message.senderRole === 'client';
                return (
                  <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                        isOwn
                          ? 'bg-zinc-950 text-white'
                          : 'border border-zinc-200 bg-white text-zinc-800'
                      }`}
                    >
                      <p className={`mb-0.5 text-[10px] uppercase tracking-wider opacity-60`}>
                        {message.senderName || (isOwn ? 'You' : 'Live Support')}
                      </p>
                      <p className="whitespace-pre-wrap break-words text-xs leading-relaxed">{message.body}</p>
                      <p className={`mt-1 text-[9px] opacity-50`}>
                        {new Date(message.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={submit} className="flex items-center gap-2 border-t border-zinc-100 p-3">
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type your message…"
              aria-label="Support message"
              className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!body.trim() || sending}
              aria-label="Send support message"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-white hover:bg-blue-600 disabled:opacity-40 cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close live support' : 'Open live support'}
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white shadow-lg hover:bg-blue-600 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
      >
        <MessageCircle className="h-4 w-4" />
        {open ? 'Close' : 'Live Support'}
      </button>
    </div>
  );
};
