import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy for Xeno-canto audio files.
 *
 * Xeno-canto's download endpoint returns Content-Disposition: attachment
 * and WAV files, which can cause issues with <audio> element playback.
 * This proxy strips those headers and streams the audio through.
 *
 * Only allows xeno-canto.org URLs for security.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  // Security: only proxy xeno-canto URLs
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("xeno-canto.org")) {
      return NextResponse.json({ error: "Only xeno-canto.org URLs allowed" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    // Forward range requests for seeking support
    const headers: Record<string, string> = {};
    const rangeHeader = request.headers.get("range");
    if (rangeHeader) {
      headers["Range"] = rangeHeader;
    }

    const response = await fetch(url, { headers });

    if (!response.ok && response.status !== 206) {
      return NextResponse.json(
        { error: "Failed to fetch audio" },
        { status: response.status }
      );
    }

    const contentType = response.headers.get("content-type") || "audio/mpeg";
    const contentLength = response.headers.get("content-length");
    const contentRange = response.headers.get("content-range");
    const acceptRanges = response.headers.get("accept-ranges");

    const responseHeaders: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400", // Cache for 1 day
    };

    if (contentLength) responseHeaders["Content-Length"] = contentLength;
    if (contentRange) responseHeaders["Content-Range"] = contentRange;
    if (acceptRanges) responseHeaders["Accept-Ranges"] = acceptRanges;

    return new NextResponse(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error("Audio proxy error:", err);
    return NextResponse.json({ error: "Proxy error" }, { status: 500 });
  }
}
