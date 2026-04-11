import { redirect } from "next/navigation";

/**
 * Legacy deep-link route for explore paths like /explore/rosaceae.
 * Redirects to the main /explore page with query params so the
 * AllGroupsExplorer (split-pane view) handles it instead.
 */
export default async function ExploreDeepLinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<{ group?: string }>;
}) {
  const { path } = await params;
  const { group = "plants" } = await searchParams;
  const expandPath = path.join("/");

  redirect(`/explore?group=${encodeURIComponent(group)}&path=${encodeURIComponent(expandPath)}`);
}
