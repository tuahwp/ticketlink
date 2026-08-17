import fs from "fs/promises";
import path from "path";

/**
 * Saves a file to the local disk inside public/uploads.
 * Returns the public URL path to access the file.
 */
export async function saveFileLocal(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Define upload directory relative to project root
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  
  // Ensure the directory exists
  await fs.mkdir(uploadDir, { recursive: true });

  // Generate unique filename to avoid collisions
  const uniqueId = Math.random().toString(36).substring(2, 9);
  const ext = path.extname(file.name);
  const baseName = path.basename(file.name, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `${baseName}_${uniqueId}${ext}`;
  
  const filePath = path.join(uploadDir, fileName);
  await fs.writeFile(filePath, buffer);

  // Return the public URL path
  return `/uploads/${fileName}`;
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
