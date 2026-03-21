"use client";

import { useRouter, usePathname } from "next/navigation";
import GroupIcon from "@/components/ui/GroupIcon";
import type { GroupInfo } from "@/lib/types";

interface GroupTabsProps {
  groups: GroupInfo[];
  currentGroup: string;
}

export default function GroupTabs({ groups, currentGroup }: GroupTabsProps) {
  const router = useRouter();
  const pathname = usePathname();

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

  return (
    <div
      className="flex gap-2 overflow-x-auto pb-2 mb-6 -mx-1 px-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
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
  );
}
