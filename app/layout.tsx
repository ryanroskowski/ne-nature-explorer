import type { Metadata } from "next";
import { Suspense } from "react";
import { Lora } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "New England Nature Explorer",
    template: "%s — NE Nature Explorer",
  },
  description:
    "Discover and learn to identify the plants, fungi, and wildlife of New England. An interactive field guide for explorers of all ages.",
  keywords: [
    "New England",
    "nature",
    "plants",
    "wildflowers",
    "trees",
    "field guide",
    "identification",
    "botany",
    "iNaturalist",
    "flora",
  ],
  authors: [{ name: "NE Nature Explorer" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "New England Nature Explorer",
    title: "New England Nature Explorer",
    description:
      "Discover and learn to identify the plants, fungi, and wildlife of New England. An interactive field guide for explorers of all ages.",
  },
  twitter: {
    card: "summary_large_image",
    title: "New England Nature Explorer",
    description:
      "An interactive field guide to the plants of New England.",
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
        <Analytics />
      </body>
    </html>
  );
}
