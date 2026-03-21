/**
 * Image optimization utilities for the Nature Explorer app.
 *
 * Provides a shimmer blur placeholder for Next.js Image components
 * to avoid layout shift while remote images from iNaturalist load.
 */

// A tiny SVG shimmer placeholder — creates a warm cream-to-light-green gradient
// that matches the site's color scheme while images load.
// Encoded as a data URI for use with Next.js Image `blurDataURL`.
const shimmerSvg = `
<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#f5f0e6"/>
      <stop offset="100%" style="stop-color:#d4e6d4"/>
    </linearGradient>
  </defs>
  <rect width="400" height="300" fill="url(#g)"/>
</svg>`.trim();

export const blurDataURL = `data:image/svg+xml;base64,${typeof Buffer !== "undefined" ? Buffer.from(shimmerSvg).toString("base64") : btoa(shimmerSvg)}`;
