import type { CornerPoint, CornerPoints } from "@/lib/vendor/jscanify";

let openCvLoadPromise: Promise<void> | null = null;

/**
 * Memuatkan OpenCV.js dari /public/vendor/opencv.js secara malas (lazy-load) sekali sahaja.
 * Dipinkan dan dicache melalui Promise.
 *
 * PENTING: cv ialah thenable (Module["then"]), jangan resolve/return terus dari async function atau Promise.
 */
export function loadOpenCv(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Pengimbas hanya disokong di pelayar web."));
  }

  const win = window as any;
  if (win.cv && typeof win.cv.Mat === "function") {
    // cv ialah thenable, jangan resolve/return terus dari async function atau Promise.
    return Promise.resolve();
  }

  if (openCvLoadPromise) {
    return openCvLoadPromise;
  }

  openCvLoadPromise = new Promise<void>((resolve, reject) => {
    let script = document.querySelector('script[src="/vendor/opencv.js"]') as HTMLScriptElement | null;
    let timer: NodeJS.Timeout | null = null;
    let pollInterval: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };

    const checkReady = () => {
      if (win.cv && typeof win.cv.Mat === "function") {
        cleanup();
        // cv ialah thenable, jangan resolve/return terus dari async function atau Promise.
        resolve();
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
          // cv ialah thenable, jangan resolve/return terus dari async function atau Promise.
          resolve();
        };
      }

      if (!pollInterval) {
        pollInterval = setInterval(() => {
          checkReady();
        }, 100);
      }
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
      if (!pollInterval) {
        pollInterval = setInterval(() => {
          checkReady();
        }, 100);
      }
    }
  });

  return openCvLoadPromise;
}

let cachedJscanifyScanner: any = null;

/**
 * Mengesahkan geometri poligon 4 penjuru:
 * 1. Nisbah Luas: 15% <= luas <= 95% daripada luas bingkai
 * 2. Cembung (strictly convex): Semua hasil darab silang bersebelahan mempunyai tanda arah yang sama
 * 3. Sudut dalaman: Semua 4 sudut antara 45° hingga 135°
 */
export function validatePaperContourGeometry(
  corners: CornerPoints,
  frameW: number,
  frameH: number
): boolean {
  const pts = [
    corners.topLeftCorner,
    corners.topRightCorner,
    corners.bottomRightCorner,
    corners.bottomLeftCorner,
  ];

  // 1. Luas Poligon (Shoelace Formula)
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const next = (i + 1) % 4;
    area += pts[i].x * pts[next].y - pts[next].x * pts[i].y;
  }
  area = Math.abs(area) / 2;
  const frameArea = frameW * frameH;
  if (frameArea <= 0) return false;
  const areaRatio = area / frameArea;

  if (areaRatio < 0.15 || areaRatio > 0.95) {
    return false;
  }

  // 2. Kecembungan (Convexity via Cross-Products)
  const edges: { x: number; y: number }[] = [];
  for (let i = 0; i < 4; i++) {
    const next = (i + 1) % 4;
    edges.push({
      x: pts[next].x - pts[i].x,
      y: pts[next].y - pts[i].y,
    });
  }

  let positiveCross = 0;
  let negativeCross = 0;
  for (let i = 0; i < 4; i++) {
    const next = (i + 1) % 4;
    const cp = edges[i].x * edges[next].y - edges[i].y * edges[next].x;
    if (cp > 0.001) positiveCross++;
    else if (cp < -0.001) negativeCross++;
  }

  if (positiveCross !== 4 && negativeCross !== 4) {
    return false;
  }

  // 3. Sudut Dalaman (45° hingga 135°)
  for (let i = 0; i < 4; i++) {
    const prev = (i + 3) % 4;
    const v1 = { x: pts[prev].x - pts[i].x, y: pts[prev].y - pts[i].y };
    const next = (i + 1) % 4;
    const v2 = { x: pts[next].x - pts[i].x, y: pts[next].y - pts[i].y };

    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.hypot(v1.x, v1.y);
    const mag2 = Math.hypot(v2.x, v2.y);

    if (mag1 < 1 || mag2 < 1) return false;

    const cosTheta = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
    const angleDeg = (Math.acos(cosTheta) * 180) / Math.PI;

    if (angleDeg < 45 || angleDeg > 135) {
      return false;
    }
  }

  return true;
}

/**
 * Mengesan 4 sudut dokumen secara langsung dari suapan video.
 * Dikecilkan kepada sisi maksimum 640px untuk keselamatan CPU dan memori.
 * Membebaskan semua memori OpenCV Mat dalam blok finally.
 */
export async function detectLivePaperCorners(
  video: HTMLVideoElement,
  processingCanvas: HTMLCanvasElement
): Promise<{
  corners: CornerPoints | null;
  isValid: boolean;
  processingTimeMs: number;
}> {
  const startTime = performance.now();
  const vW = video.videoWidth;
  const vH = video.videoHeight;

  if (!vW || !vH || vW < 10 || vH < 10) {
    return { corners: null, isValid: false, processingTimeMs: 0 };
  }

  // Sisi maksimum 640px untuk ketepatan pengesanan dokumen
  const MAX_PROC_SIDE = 640;
  const scale = MAX_PROC_SIDE / Math.max(vW, vH);
  const procW = Math.round(vW * scale);
  const procH = Math.round(vH * scale);

  if (processingCanvas.width !== procW || processingCanvas.height !== procH) {
    processingCanvas.width = procW;
    processingCanvas.height = procH;
  }

  const pCtx = processingCanvas.getContext("2d", { willReadFrequently: true });
  if (!pCtx) {
    return { corners: null, isValid: false, processingTimeMs: 0 };
  }

  pCtx.drawImage(video, 0, 0, procW, procH);

  let imgMat: any = null;
  let contour: any = null;

  try {
    if (!cachedJscanifyScanner) {
      const jscanifyModule = await import("@/lib/vendor/jscanify");
      const JscanifyClass = jscanifyModule.default || jscanifyModule;
      cachedJscanifyScanner = new JscanifyClass();
    }

    const win = window as any;
    const cv = win.cv;
    if (!cv || !cv.imread) {
      return { corners: null, isValid: false, processingTimeMs: performance.now() - startTime };
    }

    imgMat = cv.imread(processingCanvas);
    contour = cachedJscanifyScanner.findPaperContour(imgMat);
    if (!contour) {
      return { corners: null, isValid: false, processingTimeMs: performance.now() - startTime };
    }

    const detected = cachedJscanifyScanner.getCornerPoints(contour, imgMat);
    if (
      !detected ||
      !detected.topLeftCorner ||
      !detected.topRightCorner ||
      !detected.bottomRightCorner ||
      !detected.bottomLeftCorner
    ) {
      return { corners: null, isValid: false, processingTimeMs: performance.now() - startTime };
    }

    const isValid = validatePaperContourGeometry(detected, procW, procH);

    // Skala koordinat kembali ke resolusi video asal
    const scaleBack = 1 / scale;
    const clampX = (val: number) => Math.max(0, Math.min(Math.round(val * scaleBack), vW));
    const clampY = (val: number) => Math.max(0, Math.min(Math.round(val * scaleBack), vH));

    const scaledCorners: CornerPoints = {
      topLeftCorner: { x: clampX(detected.topLeftCorner.x), y: clampY(detected.topLeftCorner.y) },
      topRightCorner: { x: clampX(detected.topRightCorner.x), y: clampY(detected.topRightCorner.y) },
      bottomRightCorner: { x: clampX(detected.bottomRightCorner.x), y: clampY(detected.bottomRightCorner.y) },
      bottomLeftCorner: { x: clampX(detected.bottomLeftCorner.x), y: clampY(detected.bottomLeftCorner.y) },
    };

    const processingTimeMs = performance.now() - startTime;
    return { corners: scaledCorners, isValid, processingTimeMs };
  } catch (err) {
    console.warn("Live paper detection note:", err);
    return { corners: null, isValid: false, processingTimeMs: performance.now() - startTime };
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
}

export interface SmoothCornersOptions {
  alpha?: number; // lalai 0.35 (EMA)
  deadbandRatio?: number; // lalai 0.01 (1% videoWidth)
  jumpRatio?: number; // lalai 0.15 (15% videoWidth)
}

/**
 * Melicinkan koordinat bucu live menggunakan:
 * 1. EMA (Exponential Moving Average) dengan alpha ~0.35 mengikut susunan TL/TR/BR/BL
 * 2. Deadband: jika anjakan SETIAP bucu < 1% videoWidth, kekalkan posisi lama
 * 3. Lompatan besar: jika MANA-MANA bucu beranjak > 15% videoWidth, reset ke posisi baru serta-merta
 */
export function smoothLiveCorners(
  current: CornerPoints,
  previous: CornerPoints | null,
  videoWidth: number,
  options?: SmoothCornersOptions
): {
  smoothed: CornerPoints;
  isBigJump: boolean;
  isWithinDeadband: boolean;
} {
  const alpha = options?.alpha ?? 0.35;
  const deadbandThreshold = videoWidth * (options?.deadbandRatio ?? 0.01);
  const jumpThreshold = videoWidth * (options?.jumpRatio ?? 0.15);

  if (!previous) {
    return {
      smoothed: { ...current },
      isBigJump: false,
      isWithinDeadband: false,
    };
  }

  const keys: (keyof CornerPoints)[] = [
    "topLeftCorner",
    "topRightCorner",
    "bottomRightCorner",
    "bottomLeftCorner",
  ];

  // Anjakan Euclidean bagi setiap bucu berbanding bingkai sebelumnya
  const displacements = keys.map((k) =>
    Math.hypot(current[k].x - previous[k].x, current[k].y - previous[k].y)
  );

  // 1. Lompatan besar (> 15% videoWidth) pada mana-mana bucu: anggap dokumen/kertas baru
  const isBigJump = displacements.some((d) => d > jumpThreshold);
  if (isBigJump) {
    return {
      smoothed: { ...current },
      isBigJump: true,
      isWithinDeadband: false,
    };
  }

  // 2. Deadband: jika semua bucu beranjak < 1% videoWidth, kekalkan koordinat sedia ada
  const isWithinDeadband = displacements.every((d) => d < deadbandThreshold);
  if (isWithinDeadband) {
    return {
      smoothed: { ...previous },
      isBigJump: false,
      isWithinDeadband: true,
    };
  }

  // 3. EMA Smoothing (alpha ~0.35) pada setiap bucu TL, TR, BR, BL
  const calcEma = (prevVal: number, currVal: number) =>
    Math.round(prevVal + alpha * (currVal - prevVal));

  const smoothed: CornerPoints = {
    topLeftCorner: {
      x: calcEma(previous.topLeftCorner.x, current.topLeftCorner.x),
      y: calcEma(previous.topLeftCorner.y, current.topLeftCorner.y),
    },
    topRightCorner: {
      x: calcEma(previous.topRightCorner.x, current.topRightCorner.x),
      y: calcEma(previous.topRightCorner.y, current.topRightCorner.y),
    },
    bottomRightCorner: {
      x: calcEma(previous.bottomRightCorner.x, current.bottomRightCorner.x),
      y: calcEma(previous.bottomRightCorner.y, current.bottomRightCorner.y),
    },
    bottomLeftCorner: {
      x: calcEma(previous.bottomLeftCorner.x, current.bottomLeftCorner.x),
      y: calcEma(previous.bottomLeftCorner.y, current.bottomLeftCorner.y),
    },
  };

  return {
    smoothed,
    isBigJump: false,
    isWithinDeadband: false,
  };
}

/**
 * Mengambil foto resolusi tinggi dari video stream:
 * 1. Guna ImageCapture(track).takePhoto() jika disokong (dengan timeout 3 saat)
 * 2. Fallback: lukis frame video penuh resolusi ke canvas
 */
export async function captureHighResPhoto(
  video: HTMLVideoElement,
  stream: MediaStream
): Promise<Blob> {
  const track = stream.getVideoTracks()[0];
  if (track && typeof (window as any).ImageCapture !== "undefined") {
    try {
      const imageCapture = new (window as any).ImageCapture(track);
      let timer: NodeJS.Timeout | null = null;
      const takePhotoPromise = imageCapture.takePhoto();
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("ImageCapture timeout (>3s)")), 3000);
      });
      let blob: Blob;
      try {
        blob = await Promise.race([takePhotoPromise, timeoutPromise]);
      } finally {
        if (timer) clearTimeout(timer);
      }
      if (blob && blob.size > 0) {
        return blob;
      }
    } catch (err) {
      console.warn("takePhoto fallback to video snapshot:", err);
    }
  }

  // Fallback: Bingkai video penuh resolusi ke canvas
  const vW = video.videoWidth || 1920;
  const vH = video.videoHeight || 1080;
  const canvas = document.createElement("canvas");
  canvas.width = vW;
  canvas.height = vH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Gagal menyediakan kanvas tangkapan kamera.");
  }
  ctx.drawImage(video, 0, 0, vW, vH);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        canvas.width = 1;
        canvas.height = 1;
        if (b) resolve(b);
        else reject(new Error("Gagal menjana imej tangkapan kamera."));
      },
      "image/jpeg",
      0.92
    );
  });
}

/**
 * Memproses fail imej yang diambil dari kamera atau galeri:
 * 1. Membaca orientasi EXIF menggunakan createImageBitmap (imageOrientation: "from-image")
 * 2. Mengehadkan sisi maksimum kepada 1920px untuk keselamatan RAM telefon
 * 3. Mengembalikan kanvas yang telah dinormalkan
 */
export async function processImageFile(
  file: File | Blob
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
