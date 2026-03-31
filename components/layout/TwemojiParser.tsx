"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    twemoji?: {
      parse: (node: HTMLElement, options?: Record<string, unknown>) => void;
    };
  }
}

export default function TwemojiParser() {
  useEffect(() => {
    function parse() {
      if (window.twemoji) {
        window.twemoji.parse(document.body, {
          folder: "svg",
          ext: ".svg",
        });
      }
    }

    // Parse on initial load
    parse();

    // Re-parse when DOM changes (route transitions, dynamic content)
    const observer = new MutationObserver(() => parse());
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
