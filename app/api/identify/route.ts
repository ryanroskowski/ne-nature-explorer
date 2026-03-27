import { NextResponse, type NextRequest } from "next/server";

// Allow larger body for multi-image uploads (default is 1MB in Next.js)
export const config = {
  api: { bodyParser: false },
};

// Increase max duration for Vercel serverless (free tier max 10s)
export const maxDuration = 10;

const PLANTNET_API_KEY = process.env.PLANTNET_API_KEY;
const PLANTNET_URL = "https://my-api.plantnet.org/v2/identify/all";

export async function POST(request: NextRequest) {
  if (!PLANTNET_API_KEY) {
    return NextResponse.json(
      { error: "PlantNet API key not configured" },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const images = formData.getAll("images") as File[];
    const organs = formData.getAll("organs") as string[];

    if (images.length === 0) {
      return NextResponse.json(
        { error: "At least one image is required" },
        { status: 400 }
      );
    }

    if (images.length > 5) {
      return NextResponse.json(
        { error: "Maximum 5 images allowed" },
        { status: 400 }
      );
    }

    // Build the multipart form for PlantNet
    const plantnetForm = new FormData();
    for (const image of images) {
      plantnetForm.append("images", image);
    }
    for (const organ of organs) {
      plantnetForm.append("organs", organ);
    }

    const url = new URL(PLANTNET_URL);
    url.searchParams.set("api-key", PLANTNET_API_KEY);
    url.searchParams.set("include-related-images", "true");
    url.searchParams.set("nb-results", "5");
    url.searchParams.set("lang", "en");

    const response = await fetch(url.toString(), {
      method: "POST",
      body: plantnetForm,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("PlantNet API error:", response.status, errorText);

      if (response.status === 429) {
        return NextResponse.json(
          { error: "Daily identification limit reached. Please try again tomorrow." },
          { status: 429 }
        );
      }

      if (response.status === 400) {
        return NextResponse.json(
          { error: "Could not process this image. Please try a clearer photo of a plant." },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: "Identification service unavailable. Please try again later." },
        { status: 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Identify API error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
