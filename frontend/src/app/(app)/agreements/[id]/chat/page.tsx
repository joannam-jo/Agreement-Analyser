"use client";

import { use, useEffect, useState, useRef } from "react";
import { Send, Loader2 } from "lucide-react";
import { getAgreement, sendChatMessage } from "@/lib/api";
import { useUserId } from "@/hooks/use-user-id";
import type { ChatMessage } from "@faa/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SpeakButton } from "@/components/ui/speak-button";
import { ChatMessageContent } from "@/components/chat/chat-message";
import { useLanguage } from "@/lib/i18n";

export default function AgreementChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const userId = useUserId();
  const { lang, t } = useLanguage();
  // The greeting is rendered separately so it follows the selected language.
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const lastRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userId) return;
    getAgreement(id).then((r) => setFileName(r.agreement.fileName));
  }, [id, userId]);

  // Show the start of a new answer (not its end); otherwise keep the latest message in view.
  useEffect(() => {
    const list = listRef.current;
    const last = lastRef.current;
    if (!list) return;
    const top =
      last && messages[messages.length - 1]?.role === "assistant" && !loading ? last.offsetTop - 12 : list.scrollHeight;
    list.scrollTo({ top, behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend(text: string = input) {
    if (!text.trim() || loading) return;
    const userMsg: ChatMessage = { role: "user", content: text.trim(), timestamp: new Date().toISOString() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await sendChatMessage(
        id,
        next.map((m) => ({ role: m.role, content: m.content })),
        lang
      );
      setMessages([...next, res.message]);
    } catch (e) {
      setMessages([
        ...next,
        {
          role: "assistant",
          content: `Sorry, I couldn't answer that: ${e instanceof Error ? e.message : "the server is unreachable"}. Please try again.`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const assistantBubble =
    "max-w-[90%] rounded-2xl rounded-bl-md bg-brand-graphite px-4 py-3 text-sm leading-relaxed text-ink/90";

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] min-h-[520px] w-full min-w-0 max-w-3xl flex-col">
      <h1 className="text-xl font-bold text-ink">{t.chatTitle}</h1>
      <div className="text-sm text-brand-cool">{fileName || <Skeleton className="h-4 w-48" />}</div>

      <Card className="mt-4 flex min-w-0 flex-1 flex-col overflow-hidden p-0">
        <div ref={listRef} className="relative flex-1 space-y-4 overflow-y-auto p-4">
          <div className={assistantBubble}>{t.chatGreeting}</div>
          {messages.map((m, i) => (
            <div
              key={i}
              ref={i === messages.length - 1 ? lastRef : undefined}
              className={
                m.role === "user"
                  ? "ml-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand-trust px-4 py-2 text-sm text-white"
                  : assistantBubble
              }
            >
              {m.role === "assistant" ? (
                <>
                  <ChatMessageContent content={m.content} />
                  <SpeakButton text={m.content} className="mt-3" />
                </>
              ) : (
                m.content
              )}
            </div>
          ))}
          {loading && (
            <div className="flex w-fit items-center gap-2 rounded-2xl bg-brand-graphite px-4 py-2 text-sm text-brand-cool">
              <Loader2 className="h-4 w-4 animate-spin" /> {t.thinking}
            </div>
          )}
        </div>
        <div className="flex min-w-0 gap-2 overflow-x-auto border-t border-ink/10 px-4 pb-1 pt-3 [scrollbar-width:thin]">
          {t.suggestions.map((q) => (
            <button
              key={q}
              type="button"
              disabled={loading}
              onClick={() => handleSend(q)}
              className="shrink-0 whitespace-nowrap rounded-full border border-ink/15 px-3 py-1 text-xs text-brand-cool transition hover:border-brand-insight hover:text-ink disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
        <div className="flex gap-2 px-4 pb-4 pt-2">
          <input
            className="min-w-0 flex-1 rounded-xl bg-brand-graphite px-4 py-2 text-sm text-ink outline-none ring-brand-insight focus:ring-2"
            placeholder={t.chatPlaceholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            maxLength={2000}
          />
          <Button onClick={() => handleSend()} disabled={loading} aria-label="Send">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
