import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { decryptSession } from "@/lib/auth";

const COOKIE_NAME = "ticketlink_session";

// Map file extensions to MIME types
const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filepath: string[] }> }
) {
  // Enforce session check: must have a valid session token
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json(
      { error: "Unauthorized: Sesi log masuk diperlukan untuk mengakses fail ini." },
      { status: 401 }
    );
  }

  const session = await decryptSession(token);
  if (!session?.userId) {
    return NextResponse.json(
      { error: "Unauthorized: Sesi tidak sah atau tamat tempoh." },
      { status: 401 }
    );
  }

  const { filepath } = await params;

  // Prevent path traversal attacks
  const fileName = filepath.join("/").replace(/\.\./g, "");
  const filePath = path.join(process.cwd(), "public", "uploads", fileName);

  try {
    const file = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    return new NextResponse(file, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}

