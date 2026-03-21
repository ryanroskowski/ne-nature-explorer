"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import SearchBar from "../ui/SearchBar";

const navItems = [
  { href: "/explore", label: "Explore", icon: "🌳" },
  { href: "/browse", label: "Browse", icon: "🔍" },
  { href: "/map", label: "Map", icon: "🗺️" },
  { href: "/compare", label: "Compare", icon: "🔄" },
  { href: "/common", label: "Common", icon: "⭐" },
  { href: "/learn", label: "Learn", icon: "📖" },
];

export default function Header() {
  const pathname = usePathname();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-cream/95 backdrop-blur-sm border-b border-border" role="banner">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group shrink-0" aria-label="NE Nature Explorer — Home">
            <span className="text-xl sm:text-2xl" aria-hidden="true">
              🌲
            </span>
            <span className="hidden sm:block font-serif font-bold text-lg text-forest group-hover:text-forest-light transition-colors">
              NE Nature Explorer
            </span>
          </Link>

          {/* Navigation */}
          <nav aria-label="Main navigation" className="flex items-center gap-0.5 sm:gap-2">
            {navItems.map((item) => {
              const isActive = pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`px-2 sm:px-3 py-1.5 rounded-lg text-sm font-ui font-medium transition-colors ${
                    isActive
                      ? "bg-forest text-white"
                      : "text-text-secondary hover:text-text-primary hover:bg-cream-dark"
                  }`}
                >
                  <span className="sm:hidden" aria-hidden="true">{item.icon}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                  <span className="sr-only sm:hidden">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Desktop search */}
          <div className="hidden md:block w-56" role="search" aria-label="Site search">
            <SearchBar />
          </div>

          {/* Mobile search toggle */}
          <button
            onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
            className="md:hidden p-2 text-text-secondary hover:text-text-primary transition-colors"
            aria-label={mobileSearchOpen ? "Close search" : "Open search"}
            aria-expanded={mobileSearchOpen}
          >
            {mobileSearchOpen ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile search dropdown */}
      <AnimatePresence>
        {mobileSearchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="md:hidden overflow-hidden border-t border-border"
            role="search"
            aria-label="Site search"
          >
            <div className="px-4 py-3 bg-cream">
              <SearchBar />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
