import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getContextualArticle, getContextualArticles } from "@/lib/data/articles";
import { getSpecies } from "@/lib/data/species";
import { blurDataURL } from "@/lib/image-utils";
import Breadcrumbs from "@/components/layout/Breadcrumbs";

// Generate static params for all articles at build time
export function generateStaticParams() {
  const articles = getContextualArticles();
  return articles.map((a) => ({ slug: a.slug }));
}

// SEO metadata
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getContextualArticle(slug);
  if (!article) return { title: "Article Not Found" };

  return {
    title: article.title,
    description: article.subtitle,
    openGraph: {
      title: article.title,
      description: article.subtitle,
      type: "article",
    },
  };
}

export default async function LearnArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getContextualArticle(slug);
  if (!article) notFound();

  // Resolve related species data
  const relatedSpecies = article.relatedSpeciesSlugs
    .map((s) => getSpecies(s))
    .filter((s) => s !== null);

  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-16">
      <Breadcrumbs
        items={[
          { label: "Home", rank: "page", slug: "" },
          { label: "Learn", rank: "page", slug: "learn" },
          { label: article.title, rank: "page", slug: `learn/${slug}` },
        ]}
      />

      {/* Header */}
      <header className="mb-8">
        <span className="text-4xl mb-3 block" aria-hidden="true">
          {article.icon}
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-text-primary">
          {article.title}
        </h1>
        <p className="text-lg text-text-secondary mt-2">
          {article.subtitle}
        </p>
      </header>

      {/* Article content */}
      <div className="space-y-8">
        {article.content.map((block, i) => {
          if (block.type === "intro") {
            return (
              <p
                key={i}
                className="text-lg text-text-primary leading-relaxed font-medium"
              >
                {block.text}
              </p>
            );
          }

          if (block.type === "section") {
            return (
              <section key={i}>
                {block.heading && (
                  <h2 className="font-serif text-xl font-semibold text-text-primary mb-3">
                    {block.heading}
                  </h2>
                )}
                <p className="text-text-secondary leading-relaxed">
                  {block.text}
                </p>
              </section>
            );
          }

          if (block.type === "audio") {
            return (
              <div
                key={i}
                className="bg-card border border-border rounded-xl p-5"
              >
                <div className="flex items-start gap-3 mb-3">
                  <span
                    className="text-lg shrink-0 mt-0.5"
                    aria-hidden="true"
                  >
                    🔊
                  </span>
                  <div>
                    <h3 className="font-serif font-semibold text-text-primary text-sm">
                      {block.heading}
                    </h3>
                    {block.description && (
                      <p className="text-xs text-text-secondary mt-1">
                        {block.description}
                      </p>
                    )}
                  </div>
                </div>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <audio
                  controls
                  preload="none"
                  className="w-full h-10"
                  src={block.audioUrl}
                >
                  Your browser does not support the audio element.
                </audio>
                {block.attribution && (
                  <p className="text-[10px] text-text-muted mt-2">
                    {block.attribution}
                  </p>
                )}
              </div>
            );
          }

          if (block.type === "tip") {
            return (
              <div
                key={i}
                className="bg-forest/5 border border-forest/15 rounded-xl p-5"
              >
                <div className="flex items-start gap-3">
                  <span
                    className="text-lg shrink-0 mt-0.5"
                    aria-hidden="true"
                  >
                    💡
                  </span>
                  <p className="text-text-primary leading-relaxed font-medium text-sm">
                    {block.text}
                  </p>
                </div>
              </div>
            );
          }

          return null;
        })}
      </div>

      {/* Related Species */}
      {relatedSpecies.length > 0 && (
        <section className="mt-12 pt-8 border-t border-border">
          <h2 className="font-serif text-xl font-semibold text-text-primary mb-4 flex items-center gap-2">
            <span aria-hidden="true">🌿</span>
            Species Mentioned
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {relatedSpecies.map((sp) => (
              <Link
                key={sp.slug}
                href={`/species/${sp.slug}`}
                className="group flex items-center gap-3 bg-card border border-border rounded-xl p-3 hover:border-forest/30 transition-colors"
              >
                <div className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-cream-dark">
                  {sp.photos[0]?.mediumUrl ? (
                    <Image
                      src={sp.photos[0].mediumUrl}
                      alt={sp.commonName}
                      fill
                      className="object-cover"
                      sizes="56px"
                      placeholder="blur"
                      blurDataURL={blurDataURL}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-text-muted text-xs">
                      🌿
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-serif font-semibold text-sm text-text-primary group-hover:text-forest transition-colors capitalize">
                    {sp.commonName}
                  </p>
                  <p className="text-xs italic text-text-secondary">
                    {sp.scientificName}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Back link */}
      <div className="mt-10 pt-6 border-t border-border">
        <Link
          href="/learn"
          className="text-forest hover:text-forest-light font-ui text-sm"
        >
          ← All articles
        </Link>
      </div>
    </article>
  );
}
