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

    // Defer the first parse until after hydration completes. This component
    // mounts outside the root <Suspense> boundary, so without this delay its
    // effect can fire and mutate the DOM (swapping emoji text for <img>s)
    // before React finishes hydrating the Header — which triggers a
    // "server-rendered text didn't match client" warning.
    let observer: MutationObserver | null = null;
    const rafId = requestAnimationFrame(() => {
      parse();
      // Re-parse when DOM changes (route transitions, dynamic content)
      observer = new MutationObserver(() => parse());
      observer.observe(document.body, { childList: true, subtree: true });
    });

    return () => {
      cancelAnimationFrame(rafId);
      observer?.disconnect();
    };
  }, []);

  return null;
}
