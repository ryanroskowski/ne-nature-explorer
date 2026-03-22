"use client";

import { useRouter, usePathname } from "next/navigation";
import { useRef, useState, useEffect, useCallback } from "react";
import GroupIcon from "@/components/ui/GroupIcon";
import type { GroupInfo } from "@/lib/types";

interface GroupTabsProps {
  groups: GroupInfo[];
  currentGroup: string;
}

export default function GroupTabs({ groups, currentGroup }: GroupTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const activeGroups = groups.filter((g) => g.status === "active");
  if (activeGroups.length <= 1) return null;

  function handleSelect(groupKey: string) {
    const params = new URLSearchParams(window.location.search);
    if (groupKey === "plants") {
      params.delete("group");
    } else {
      params.set("group", groupKey);
    }
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, []);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    const observer = new ResizeObserver(checkScroll);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      observer.disconnect();
    };
  }, [checkScroll]);

  function scroll(direction: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === "left" ? -200 : 200, behavior: "smooth" });
  }

  return (
    <div className="relative mb-6">
      {/* Left arrow */}
      {canScrollLeft && (
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-0 bottom-2 z-10 flex items-center pl-0.5 pr-3 bg-gradient-to-r from-cream via-cream/90 to-transparent"
          aria-label="Scroll tabs left"
        >
          <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Scrollable tabs */}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        role="tablist"
        aria-label="Select taxon group"
      >
        {activeGroups.map((g) => {
          const isActive = g.key === currentGroup;
          return (
            <button
              key={g.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => handleSelect(g.key)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-ui font-medium transition-colors cursor-pointer ${
                isActive
                  ? "bg-forest text-white border border-forest"
                  : "bg-cream-dark text-text-secondary hover:bg-cream-dark/80 border border-transparent"
              }`}
            >
              <GroupIcon groupKey={g.key} emoji={g.icon} size={16} />
              <span>{g.label}</span>
              <span className={`text-xs ${isActive ? "opacity-75" : "text-text-muted"}`}>
                {g.speciesCount.toLocaleString()}
              </span>
            </button>
          );
        })}
      </div>

      {/* Right arrow */}
      {canScrollRight && (
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-0 bottom-2 z-10 flex items-center pr-0.5 pl-3 bg-gradient-to-l from-cream via-cream/90 to-transparent"
          aria-label="Scroll tabs right"
        >
          <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}
