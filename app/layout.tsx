import type { Metadata } from "next";
import { Suspense } from "react";
import { Lora } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import TwemojiParser from "@/components/layout/TwemojiParser";

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  display: "swap",
});

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ne-nature-explorer.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "New England Nature Explorer",
    template: "%s — NE Nature Explorer",
  },
  description:
    "Discover and learn to identify the plants, fungi, birds, mammals, insects, and wildlife of New England. An interactive field guide with 10,000+ species for nature explorers of all ages.",
  keywords: [
    "New England",
    "nature",
    "wildlife",
    "plants",
    "birds",
    "fungi",
    "mushrooms",
    "insects",
    "mammals",
    "wildflowers",
    "trees",
    "field guide",
    "species identification",
    "nature guide",
    "Connecticut",
    "Massachusetts",
    "Maine",
    "New Hampshire",
    "Rhode Island",
    "Vermont",
  ],
  authors: [{ name: "NE Nature Explorer" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "New England Nature Explorer",
    title: "New England Nature Explorer",
    description:
      "Discover and learn to identify the plants, fungi, birds, mammals, insects, and wildlife of New England. An interactive field guide with 10,000+ species.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "New England Nature Explorer" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "New England Nature Explorer",
    description:
      "An interactive field guide to the plants, fungi, birds, and wildlife of New England.",
    images: [{ url: "/opengraph-image", alt: "New England Nature Explorer" }],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={lora.variable}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "New England Nature Explorer",
              url: baseUrl,
              description:
                "An interactive field guide to the plants, fungi, birds, mammals, insects, and wildlife of New England.",
              potentialAction: {
                "@type": "SearchAction",
                target: {
                  "@type": "EntryPoint",
                  urlTemplate: `${baseUrl}/explore?q={search_term_string}`,
                },
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
        <script
          src="https://cdn.jsdelivr.net/npm/@twemoji/api@latest/dist/twemoji.min.js"
          crossOrigin="anonymous"
        />
      </head>
      <body className="antialiased min-h-screen flex flex-col">
        {/* Skip to main content — accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-forest focus:text-white focus:rounded-lg focus:text-sm focus:font-ui focus:shadow-lg"
        >
          Skip to main content
        </a>
        <Suspense>
          <Header />
          <main id="main-content" className="flex-1" role="main">
            {children}
          </main>
          <Footer />
        </Suspense>
        <TwemojiParser />
        <Analytics />
      </body>
    </html>
  );
}
