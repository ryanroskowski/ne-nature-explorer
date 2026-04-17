import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  const filePath = path.join(process.cwd(), "data", "search-index-articles.json");
  if (!fs.existsSync(filePath)) {
    return NextResponse.json([], { status: 200 });
  }
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
