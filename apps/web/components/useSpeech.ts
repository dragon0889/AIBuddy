"use client";
import { useCallback } from "react";

/** Đọc to văn bản (Web Speech API – chạy trên thiết bị; không gửi văn bản đi đâu). */
export function useSpeech(lang: "vi" | "en" = "vi") {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const speak = useCallback((text: string) => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === "vi" ? "vi-VN" : "en-US";
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  }, [lang, supported]);
  const stop = useCallback(() => { if (supported) window.speechSynthesis.cancel(); }, [supported]);
  return { speak, stop, supported };
}
