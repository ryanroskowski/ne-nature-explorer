import { getTaxonomyTree } from "@/lib/data/taxonomy";
import TaxonomyExplorer from "@/components/explorer/TaxonomyExplorer";
import Breadcrumbs from "@/components/layout/Breadcrumbs";

export default async function ExploreDeepLinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<{ group?: string }>;
}) {
  const { path } = await params;
  const { group = "plants" } = await searchParams;
  const tree = getTaxonomyTree(group);
  const expandPath = path.join("/");

  // Build breadcrumb items from path segments
  const breadcrumbItems = [
    { label: "Home", rank: "page", slug: "" },
    { label: "Explore", rank: "page", slug: "explore" },
    ...path.map((segment, i) => ({
      label: segment.replace(/-/g, " "),
      rank: "page",
      slug: `explore/${path.slice(0, i + 1).join("/")}`,
    })),
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <Breadcrumbs items={breadcrumbItems} />

      <header className="mb-8">
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-text-primary">
          Tree of Life Explorer
        </h1>
        <p className="text-text-secondary mt-2 text-lg max-w-2xl">
          Navigate through the branches of life. Click any group to expand it
          and see what&apos;s inside.
        </p>
      </header>

      {tree ? (
        <TaxonomyExplorer tree={tree} initialExpandPath={expandPath} />
      ) : (
        <p className="text-text-secondary">No taxonomy data available.</p>
      )}
    </div>
  );
}
