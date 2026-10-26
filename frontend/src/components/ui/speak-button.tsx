"use client";

import { useEffect, useState } from "react";
import { Volume2, Square } from "lucide-react";
import type { ExplanationLanguage } from "@faa/shared";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const VOICE_LANG: Record<ExplanationLanguage, string> = { en: "en-IN", hi: "hi-IN" };

/** Reads text aloud with the browser's built-in speech (no server, no cost). */
export function SpeakButton({ text, className }: { text: string; className?: string }) {
  const { lang, t } = useLanguage();
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  if (!supported || !text.trim()) return null;

  function toggle() {
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(toSpeech(text));
    utterance.lang = VOICE_LANG[lang];
    const voice =
      synth.getVoices().find((v) => v.lang === VOICE_LANG[lang]) ??
      synth.getVoices().find((v) => v.lang.startsWith(lang));
    if (voice) utterance.voice = voice;
    utterance.rate = 0.95;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(utterance);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={speaking}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-2.5 py-1 text-xs text-brand-cool transition hover:border-brand-insight hover:text-ink",
        speaking && "border-brand-insight text-ink",
        className
      )}
    >
      {speaking ? <Square className="h-3 w-3" /> : <Volume2 className="h-3.5 w-3.5" />}
      {speaking ? t.stop : t.listen}
    </button>
  );
}

/** Strip the chat's markdown markers so they are not read aloud. */
function toSpeech(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/^\s*[-•>]\s*/gm, "")
    .replace(/[⚠️]/g, "")
    .replace(/\n+/g, ". ");
}
