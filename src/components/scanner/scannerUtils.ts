import type { CornerPoint, CornerPoints } from "@/lib/vendor/jscanify";

let openCvLoadPromise: Promise<any> | null = null;

/**
 * Memuatkan OpenCV.js dari /public/vendor/opencv.js secara malas (lazy-load) sekali sahaja.
 * Dipinkan dan dicache melalui Promise.
 */
export function loadOpenCv(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Pengimbas hanya disokong di pelayar web."));
  }

  const win = window as any;
  if (win.cv && typeof win.cv.Mat === "function") {
    return Promise.resolve(win.cv);
  }

  if (openCvLoadPromise) {
    return openCvLoadPromise;
  }

  openCvLoadPromise = new Promise((resolve, reject) => {
    let script = document.querySelector('script[src="/vendor/opencv.js"]') as HTMLScriptElement | null;
    let timer: NodeJS.Timeout | null = null;
    let pollInterval: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (pollInterval) clearInterval(pollInterval);
    };

    const checkReady = () => {
      if (win.cv && typeof win.cv.Mat === "function") {
        cleanup();
        resolve(win.cv);
        return true;
      }
      return false;
    };

    if (checkReady()) return;

    timer = setTimeout(() => {
      cleanup();
      openCvLoadPromise = null;
      reject(new Error("Masa memuatkan pengimbas telah tamat. Sila periksa sambungan internet atau guna pilihan fail biasa."));
    }, 45000);

    const onScriptLoaded = () => {
      if (checkReady()) return;

      if (win.cv && typeof win.cv.onRuntimeInitialized !== "undefined") {
        const prevInit = win.cv.onRuntimeInitialized;
        win.cv.onRuntimeInitialized = () => {
          if (typeof prevInit === "function") prevInit();
          cleanup();
          resolve(win.cv);
        };
      }

      pollInterval = setInterval(() => {
        checkReady();
      }, 100);
    };

    if (!script) {
      script = document.createElement("script");
      script.src = "/vendor/opencv.js";
      script.async = true;
      script.onload = onScriptLoaded;
      script.onerror = () => {
        cleanup();
        openCvLoadPromise = null;
        reject(new Error("Gagal memuatkan komponen OpenCV (/vendor/opencv.js)."));
      };
      document.body.appendChild(script);
    } else {
      script.addEventListener("load", onScriptLoaded);
      script.addEventListener("error", () => {
        cleanup();
        openCvLoadPromise = null;
        reject(new Error("Gagal memuatkan komponen OpenCV."));
      });
      pollInterval = setInterval(() => {
        checkReady();
      }, 100);
    }
  });

  return openCvLoadPromise;
}

/**
 * Memproses fail imej yang diambil dari kamera atau galeri:
 * 1. Membaca orientasi EXIF menggunakan createImageBitmap (imageOrientation: "from-image")
 * 2. Mengehadkan sisi maksimum kepada 1920px untuk keselamatan RAM telefon
 * 3. Mengembalikan kanvas yang telah dinormalkan
 */
export async function processImageFile(
  file: File
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  let bitmap: ImageBitmap | null = null;

  if (typeof window !== "undefined" && "createImageBitmap" in window) {
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Fallback jika pelayar lama tidak menyokong opsyen imageOrientation
      bitmap = await createImageBitmap(file);
    }
  }

  let srcW = 0;
  let srcH = 0;
  let sourceElement: ImageBitmap | HTMLImageElement;

  if (bitmap) {
    srcW = bitmap.width;
    srcH = bitmap.height;
    sourceElement = bitmap;
  } else {
    sourceElement = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Gagal membaca format imej."));
      };
      img.src = url;
    });
    srcW = sourceElement.width;
    srcH = sourceElement.height;
  }

  // Maksimum 1920px pada sisi terpanjang
  const MAX_SIDE = 1920;
  let targetW = srcW;
  let targetH = srcH;
  if (Math.max(srcW, srcH) > MAX_SIDE) {
    const scale = MAX_SIDE / Math.max(srcW, srcH);
    targetW = Math.round(srcW * scale);
    targetH = Math.round(srcH * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    if (bitmap && typeof bitmap.close === "function") bitmap.close();
    throw new Error("Gagal menyediakan kanvas imej.");
  }

  ctx.drawImage(sourceElement, 0, 0, targetW, targetH);

  // Bebaskan memori bitmap
  if (bitmap && typeof bitmap.close === "function") {
    bitmap.close();
  }

  return { canvas, width: targetW, height: targetH };
}

/**
 * Mengesan 4 sudut dokumen menggunakan jscanify.
 * Jika tiada kontur atau ralat berlaku, guna penjuru lalai (5% inset).
 */
export async function detectDocumentCorners(
  canvas: HTMLCanvasElement
): Promise<CornerPoints> {
  const w = canvas.width;
  const h = canvas.height;

  const defaultCorners: CornerPoints = {
    topLeftCorner: { x: Math.round(w * 0.05), y: Math.round(h * 0.05) },
    topRightCorner: { x: Math.round(w * 0.95), y: Math.round(h * 0.05) },
    bottomRightCorner: { x: Math.round(w * 0.95), y: Math.round(h * 0.95) },
    bottomLeftCorner: { x: Math.round(w * 0.05), y: Math.round(h * 0.95) },
  };

  let imgMat: any = null;
  let contour: any = null;

  try {
    const jscanifyModule = await import("@/lib/vendor/jscanify");
    const JscanifyClass = jscanifyModule.default || jscanifyModule;
    const scanner = new JscanifyClass();
    const win = window as any;
    const cv = win.cv;

    if (!cv || !cv.imread) {
      return defaultCorners;
    }

    imgMat = cv.imread(canvas);
    contour = scanner.findPaperContour(imgMat);
    if (!contour) {
      return defaultCorners;
    }

    const detected = scanner.getCornerPoints(contour, imgMat);

    if (
      detected &&
      detected.topLeftCorner &&
      detected.topRightCorner &&
      detected.bottomRightCorner &&
      detected.bottomLeftCorner
    ) {
      const clamp = (val: number, max: number) => Math.max(0, Math.min(Math.round(val), max));
      return {
        topLeftCorner: { x: clamp(detected.topLeftCorner.x, w), y: clamp(detected.topLeftCorner.y, h) },
        topRightCorner: { x: clamp(detected.topRightCorner.x, w), y: clamp(detected.topRightCorner.y, h) },
        bottomRightCorner: { x: clamp(detected.bottomRightCorner.x, w), y: clamp(detected.bottomRightCorner.y, h) },
        bottomLeftCorner: { x: clamp(detected.bottomLeftCorner.x, w), y: clamp(detected.bottomLeftCorner.y, h) },
      };
    }
  } catch (err) {
    console.warn("Auto-kesan jscanify tidak berjaya, menggunakan sudut lalai:", err);
  } finally {
    if (contour && typeof contour.delete === "function") {
      try {
        contour.delete();
      } catch {}
    }
    if (imgMat && typeof imgMat.delete === "function") {
      try {
        imgMat.delete();
      } catch {}
    }
  }

  return defaultCorners;
}

/**
 * Membetulkan perspektif dan memotong imej dokumen ke saiz A4 berkualiti tinggi.
 * Menghasilkan Blob JPEG dengan mampatan 0.7 dan membebaskan memori.
 */
export async function warpAndCropPaper(
  canvas: HTMLCanvasElement,
  corners: CornerPoints
): Promise<Blob> {
  const jscanifyModule = await import("@/lib/vendor/jscanify");
  const JscanifyClass = jscanifyModule.default || jscanifyModule;
  const scanner = new JscanifyClass();

  // Tentukan orientasi berdasarkan jarak titik
  const topWidth = Math.hypot(corners.topRightCorner.x - corners.topLeftCorner.x, corners.topRightCorner.y - corners.topLeftCorner.y);
  const bottomWidth = Math.hypot(corners.bottomRightCorner.x - corners.bottomLeftCorner.x, corners.bottomRightCorner.y - corners.bottomLeftCorner.y);
  const avgWidth = (topWidth + bottomWidth) / 2;

  const leftHeight = Math.hypot(corners.bottomLeftCorner.x - corners.topLeftCorner.x, corners.bottomLeftCorner.y - corners.topLeftCorner.y);
  const rightHeight = Math.hypot(corners.bottomRightCorner.x - corners.topRightCorner.x, corners.bottomRightCorner.y - corners.topRightCorner.y);
  const avgHeight = (leftHeight + rightHeight) / 2;

  const isLandscape = avgWidth > avgHeight;
  // Piawaian A4 pada nisbah ~1:1.414. Resolusi sederhana: 1240 x 1754
  const resultW = isLandscape ? 1754 : 1240;
  const resultH = isLandscape ? 1240 : 1754;

  const extractedCanvas = scanner.extractPaper(canvas, resultW, resultH, corners);
  const targetCanvas = extractedCanvas || canvas;

  const blob = await new Promise<Blob>((resolve, reject) => {
    targetCanvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Gagal menjana imej hasil imbasan."));
      },
      "image/jpeg",
      0.7
    );
  });

  // Bersihkan canvas yang diekstrak untuk mengelakkan kebocoran RAM
  if (extractedCanvas) {
    extractedCanvas.width = 1;
    extractedCanvas.height = 1;
  }

  return blob;
}

/**
 * Menggabungkan berbilang imej halaman menjadi SATU fail PDF (halaman A4).
 * Format nama: service_report_<ticketRef>_<YYYYMMDD>.pdf
 */
export async function assemblePdfDocument(
  pageBlobs: Blob[],
  ticketRefNo?: string
): Promise<File> {
  if (pageBlobs.length === 0) {
    throw new Error("Tiada halaman untuk dijana.");
  }

  const { PDFDocument } = await import("pdf-lib");
  const pdfDoc = await PDFDocument.create();
  const A4_WIDTH = 595.28;
  const A4_HEIGHT = 841.89;

  for (const blob of pageBlobs) {
    const arrayBuffer = await blob.arrayBuffer();
    const jpgImage = await pdfDoc.embedJpg(arrayBuffer);

    // Tentukan orientasi halaman berdasarkan nisbah imej
    const isImageLandscape = jpgImage.width > jpgImage.height;
    const pageWidth = isImageLandscape ? A4_HEIGHT : A4_WIDTH;
    const pageHeight = isImageLandscape ? A4_WIDTH : A4_HEIGHT;

    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    const imgDims = jpgImage.scaleToFit(pageWidth, pageHeight);

    const x = (pageWidth - imgDims.width) / 2;
    const y = (pageHeight - imgDims.height) / 2;

    page.drawImage(jpgImage, {
      x,
      y,
      width: imgDims.width,
      height: imgDims.height,
    });
  }

  const pdfBytes = await pdfDoc.save();
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const dateStr = `${yyyy}${mm}${dd}`;

  const cleanRef = (ticketRefNo || "report").trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `service_report_${cleanRef}_${dateStr}.pdf`;

  return new File([pdfBytes as Uint8Array<ArrayBuffer>], fileName, { type: "application/pdf" });
}
