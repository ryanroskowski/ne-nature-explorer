import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy for Xeno-canto audio files.
 *
 * Buffers the full response so we can provide Content-Length and
 * Accept-Ranges headers, enabling browser seeking even when
 * Xeno-canto uses chunked transfer encoding.
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
    const response = await fetch(url);

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch audio" },
        { status: response.status }
      );
    }

    // Buffer the full response so we know the size and can support range requests
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "audio/mpeg";

    // Handle range requests for seeking
    const rangeHeader = request.headers.get("range");
    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : buffer.length - 1;
        const chunk = buffer.subarray(start, end + 1);

        return new NextResponse(chunk, {
          status: 206,
          headers: {
            "Content-Type": contentType,
            "Content-Length": chunk.length.toString(),
            "Content-Range": `bytes ${start}-${end}/${buffer.length}`,
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=86400",
          },
        });
      }
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": buffer.length.toString(),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    console.error("Audio proxy error:", err);
    return NextResponse.json({ error: "Proxy error" }, { status: 500 });
  }
}
