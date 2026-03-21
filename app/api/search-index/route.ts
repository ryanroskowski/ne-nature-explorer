import { NextResponse, type NextRequest } from "next/server";
import { getSearchIndex } from "@/lib/data";

export async function GET(request: NextRequest) {
  const group = request.nextUrl.searchParams.get("group") || undefined;
  const index = getSearchIndex(group);
  return NextResponse.json(index);
}
