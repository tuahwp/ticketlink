import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10 MB

export interface DetectedFileType {
  ext: ".jpg" | ".png" | ".webp" | ".heic" | ".pdf";
  mime: string;
}

/**
 * Validates the file buffer against known magic bytes.
 * Supported: JPEG, PNG, WebP, HEIC/HEIF, and PDF.
 * Returns the detected extension and MIME type, or null if unsupported.
 */
export function detectAllowedFileType(buffer: Buffer): DetectedFileType | null {
  if (!buffer || buffer.length < 4) return null;

  // 1. PDF: %PDF- (0x25 0x50 0x44 0x46 0x2D)
  if (
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  ) {
    return { ext: ".pdf", mime: "application/pdf" };
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { ext: ".png", mime: "image/png" };
  }

  // 3. JPEG: FF D8 FF
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { ext: ".jpg", mime: "image/jpeg" };
  }

  // 4. WebP: 'RIFF' .... 'WEBP'
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { ext: ".webp", mime: "image/webp" };
  }

  // 5. HEIC / HEIF (ISO Base Media File Format box ftyp)
  // Bytes 4..8 must be 'ftyp'
  if (buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp") {
    const brand = buffer.toString("ascii", 8, 12).toLowerCase();
    const heicBrands = [
      "heic",
      "heix",
      "hevc",
      "hevx",
      "heim",
      "heis",
      "hevm",
      "hevs",
      "mif1",
      "msf1",
    ];
    if (heicBrands.includes(brand)) {
      return { ext: ".heic", mime: "image/heic" };
    }

    // Compatible brands list inside ftyp box (scan up to first 64 bytes)
    const scanLimit = Math.min(buffer.length, 64);
    const boxSlice = buffer.subarray(8, scanLimit).toString("ascii").toLowerCase();
    if (heicBrands.some((b) => boxSlice.includes(b))) {
      return { ext: ".heic", mime: "image/heic" };
    }
  }

  return null;
}

/**
 * Generates an unguessable, randomized server-side filename with the validated extension.
 */
export function generateSafeServerFileName(ext: string): string {
  const timestamp = Date.now();
  const randomHex = crypto.randomBytes(8).toString("hex");
  return `upload_${timestamp}_${randomHex}${ext}`;
}

/**
 * Saves a file to the local disk inside public/uploads after validating
 * real content (magic bytes), size (<= 10MB), and generating a safe server filename.
 * Returns the public URL path to access the file.
 */
export async function saveFileLocal(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Enforce 10 MB maximum size limit
  if (buffer.length > MAX_UPLOAD_SIZE) {
    throw new Error(
      `File size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds the 10 MB limit.`
    );
  }

  // Inspect actual file content via magic bytes
  const detected = detectAllowedFileType(buffer);
  if (!detected) {
    throw new Error(
      "Invalid file type. Only JPG, PNG, WebP, HEIC, and PDF files are allowed based on actual content."
    );
  }

  // Define upload directory relative to project root
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadDir, { recursive: true });

  // Generate completely server-controlled filename (client filename ignored)
  const fileName = generateSafeServerFileName(detected.ext);
  const filePath = path.join(uploadDir, fileName);
  await fs.writeFile(filePath, buffer);

  // Return via API route — more reliable than Next.js static /uploads/ in standalone mode
  return `/api/uploads/${fileName}`;
}

/**
 * Downloads a file from a remote URL (e.g. temporary presigned S3/R2 URL)
 * and archives it permanently into the local persistent uploads directory.
 * Returns the permanent local URL and metadata.
 */
export async function saveRemoteUrlToFile(
  remoteUrl: string,
  fallbackName?: string
): Promise<{ url: string; size: number; contentType: string; fileName: string }> {
  // If the URL is already an internal URL, return it directly
  if (remoteUrl.startsWith("/api/uploads/") || remoteUrl.startsWith("/uploads/")) {
    return {
      url: remoteUrl,
      size: 0,
      contentType: "application/octet-stream",
      fileName: path.basename(remoteUrl),
    };
  }

  const response = await fetch(remoteUrl);
  if (!response.ok) {
    throw new Error(`Failed to download remote file: HTTP ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const size = buffer.length;
  const contentType = response.headers.get("content-type") || "application/octet-stream";

  // Determine file extension
  let ext = "";
  try {
    const parsedUrl = new URL(remoteUrl);
    ext = path.extname(parsedUrl.pathname);
  } catch {
    // ignore
  }

  if (!ext) {
    if (contentType.includes("pdf")) ext = ".pdf";
    else if (contentType.includes("jpeg") || contentType.includes("jpg")) ext = ".jpg";
    else if (contentType.includes("png")) ext = ".png";
    else if (contentType.includes("webp")) ext = ".webp";
    else ext = ".bin";
  }

  const baseName = (fallbackName ? path.basename(fallbackName, path.extname(fallbackName)) : "evidence")
    .replace(/[^a-zA-Z0-9_-]/g, "_");
  const uniqueId = Math.random().toString(36).substring(2, 9);
  const fileName = `${baseName}_${uniqueId}${ext}`;

  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadDir, { recursive: true });

  const filePath = path.join(uploadDir, fileName);
  await fs.writeFile(filePath, buffer);

  return {
    url: `/api/uploads/${fileName}`,
    size,
    contentType,
    fileName,
  };
}

/**
 * Interface/helper for bucket storage when AWS S3 / R2 is configured.
 * Users can activate this by adding environment variables.
 */
export async function saveFileToCloud(file: File): Promise<string> {
  // Save file locally for now since S3 compatible bucket is not configured yet.
  return saveFileLocal(file);

  /*
  // NOTE: If R2/S3 is needed in the future, follow these steps:
  // 1. Run: npm install @aws-sdk/client-s3
  // 2. Uncomment the following code block:
  
  const bucketName = process.env.R2_BUCKET_NAME;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!bucketName || !accessKeyId || !secretAccessKey || !publicUrl) {
    return saveFileLocal(file);
  }

  try {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    
    const client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const uniqueId = Math.random().toString(36).substring(2, 9);
    const ext = path.extname(file.name);
    const baseName = path.basename(file.name, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `service-reports/${baseName}_${uniqueId}${ext}`;

    await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: buffer,
        ContentType: file.type,
      })
    );

    return `${publicUrl.replace(/\/$/, "")}/${fileName}`;
  } catch (error) {
    console.error("Cloud storage upload failed, falling back to local:", error);
    return saveFileLocal(file);
  }
  */
}
