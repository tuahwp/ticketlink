import { NextRequest, NextResponse } from "next/server";
import { saveFileToCloud, MAX_UPLOAD_SIZE } from "@/lib/storage";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json(
        { error: "Unauthorized: Sesi tidak sah atau telah tamat tempoh." },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided in the request" },
        { status: 400 }
      );
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json(
        {
          error: `File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds the 10 MB limit.`,
        },
        { status: 400 }
      );
    }

    // Save the file (defaults to local, checks magic bytes and regenerates safe server filename)
    const fileUrl = await saveFileToCloud(file);

    return NextResponse.json({ url: fileUrl });
  } catch (error: any) {
    console.error("Upload handler failed:", error);
    const msg = error.message || "Failed to upload file";
    const isValidationErr =
      msg.includes("exceeds the 10 MB limit") ||
      msg.includes("Invalid file type");
    return NextResponse.json(
      { error: msg },
      { status: isValidationErr ? 400 : 500 }
    );
  }
}
