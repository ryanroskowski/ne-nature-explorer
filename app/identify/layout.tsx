import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Plant Identifier — NE Nature Explorer",
  description:
    "Upload a photo of any plant for instant identification. Powered by Pl@ntNet AI, linked to our New England species database.",
  openGraph: {
    title: "Plant Identifier — NE Nature Explorer",
    description:
      "Snap a photo, identify a plant. Instant AI-powered plant identification for New England naturalists.",
  },
};

export default function IdentifyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
