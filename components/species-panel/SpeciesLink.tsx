"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";
import { useSpeciesPanel } from "./SpeciesPanelContext";

type LinkProps = Omit<ComponentProps<typeof Link>, "href">;

interface SpeciesLinkProps extends LinkProps {
  /** Species slug — the link will go to /species/{slug}. */
  slug: string;
}

/**
 * Drop-in replacement for <Link href={`/species/${slug}`}>.
 *
 * On desktop (when wrapped in a SpeciesPanelProvider), intercepts the click
 * and opens the species in the side panel instead of navigating.
 *
 * On mobile or outside a provider, falls back to normal Next.js navigation
 * so /species/[slug] still works for direct links, new-tab clicks, right-click
 * "Open in new tab", and SEO/crawlers.
 */
export default function SpeciesLink({
  slug,
  onClick,
  children,
  ...rest
}: SpeciesLinkProps) {
  const panel = useSpeciesPanel();

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // Let consumer's onClick run first (may preventDefault already)
    onClick?.(e);
    if (e.defaultPrevented) return;

    // Respect modifier keys / middle-click: let the browser handle them
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }

    // Only intercept when we have a provider AND we're on desktop
    if (!panel || !panel.isDesktop) return;

    e.preventDefault();
    panel.selectSpecies(slug);
  };

  return (
    <Link href={`/species/${slug}`} onClick={handleClick} {...rest}>
      {children}
    </Link>
  );
}
