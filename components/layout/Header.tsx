"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import SearchBar from "../ui/SearchBar";

const navItems = [
  { href: "/explore", label: "Explore", icon: "🌳" },
  { href: "/browse", label: "Browse", icon: "📋" },
  { href: "/map", label: "Map", icon: "🗺️" },
  { href: "/compare", label: "Compare", icon: "⚖️" },
  { href: "/common", label: "Common", icon: "🏆" },
  { href: "/learn", label: "Learn", icon: "📖" },
];

export default function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [menuAnimating, setMenuAnimating] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleAnimationComplete = useCallback(() => {
    setMenuAnimating(false);
  }, []);

  // Close mobile menu on click outside
  useEffect(() => {
    if (!mobileMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [mobileMenuOpen]);

  return (
    <header className="sticky top-0 z-50 bg-cream/95 backdrop-blur-sm border-b border-border" role="banner">
      <div className="mx-auto px-4 sm:px-6 lg:px-10 xl:px-16">
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

          {/* Desktop Navigation */}
          <nav aria-label="Main navigation" className="hidden md:flex items-center gap-1 lg:gap-2">
            {navItems.map((item) => {
              const isActive = pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`px-3 py-1.5 rounded-lg text-sm font-ui font-medium transition-colors ${
                    isActive
                      ? "bg-forest text-white"
                      : "text-text-secondary hover:text-text-primary hover:bg-cream-dark"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Desktop search */}
          <div className="hidden md:block w-56" role="search" aria-label="Site search">
            <SearchBar />
          </div>

          {/* Mobile: search + hamburger */}
          <div className="flex md:hidden items-center gap-1">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-text-secondary hover:text-text-primary transition-colors"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            ref={menuRef}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            onAnimationStart={() => setMenuAnimating(true)}
            onAnimationComplete={handleAnimationComplete}
            className={`md:hidden border-t border-border bg-cream ${menuAnimating ? "overflow-hidden" : "overflow-visible"}`}
          >
            <nav aria-label="Mobile navigation" className="px-4 py-3">
              <div className="space-y-1">
                {navItems.map((item) => {
                  const isActive = pathname?.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-ui font-medium transition-colors ${
                        isActive
                          ? "bg-forest text-white"
                          : "text-text-secondary hover:text-text-primary hover:bg-cream-dark"
                      }`}
                    >
                      <span aria-hidden="true" className="text-lg">{item.icon}</span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
              <div className="mt-3 pt-3 border-t border-border" role="search" aria-label="Site search">
                <SearchBar />
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
