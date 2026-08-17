import { NextRequest, NextResponse } from "next/server";
import { saveFileToCloud } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided in the request" },
        { status: 400 }
      );
    }

    // Save the file (defaults to local, but can fallback to cloud if env vars present)
    const fileUrl = await saveFileToCloud(file);

    return NextResponse.json({ url: fileUrl });
  } catch (error: any) {
    console.error("Upload handler failed:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload file" },
      { status: 500 }
    );
  }
}
