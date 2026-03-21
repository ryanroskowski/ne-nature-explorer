"use client";

import Link from "next/link";
import type { BreadcrumbItem } from "@/lib/types";

export default function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (!items || items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="text-sm font-ui text-text-secondary overflow-x-auto py-3">
      <ol className="flex items-center gap-1 list-none m-0 p-0">
        {items.map((item, i) => (
          <li key={`${item.slug}-${item.rank}`} className="flex items-center gap-1 whitespace-nowrap">
            {i > 0 && (
              <svg className="w-3.5 h-3.5 text-text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
            {i === items.length - 1 ? (
              <span className="text-text-primary font-medium" aria-current="page">{item.label}</span>
            ) : (
              <Link
                href={`/${item.slug}`}
                className="hover:text-forest transition-colors"
              >
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
