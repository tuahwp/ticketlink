"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import type { CornerPoints, CornerPoint } from "@/lib/vendor/jscanify";
import {
  loadOpenCv,
  processImageFile,
  detectDocumentCorners,
  warpAndCropPaper,
  assemblePdfDocument,
  detectLivePaperCorners,
  captureHighResPhoto,
} from "./scannerUtils";

export interface DocumentScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (pdfFile: File) => void;
  onFallbackUpload?: () => void;
  ticketRefNo?: string;
  maxPages?: number; // lalai 10
}

interface ScannedPage {
  id: string;
  blob: Blob;
  previewUrl: string;
}

type ScannerStep = "loading" | "live" | "capture" | "adjust" | "review" | "assembling" | "error";
type CornerKey = "topLeftCorner" | "topRightCorner" | "bottomRightCorner" | "bottomLeftCorner";
type LiveStatus = "searching" | "detected" | "snapping";

export default function DocumentScanner({
  isOpen,
  onClose,
  onComplete,
  onFallbackUpload,
  ticketRefNo = "report",
  maxPages = 10,
}: DocumentScannerProps) {
  // Pengurusan status
  const [step, setStep] = useState<ScannerStep>("loading");
  const [statusMessage, setStatusMessage] = useState<string>("Memuatkan pengimbas... Sila tunggu sebentar.");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Status & kawalan Live Kamera (ADR 0034)
  const [isAutoSnapEnabled, setIsAutoSnapEnabled] = useState<boolean>(true);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>("searching");

  // Halaman-halaman yang telah siap diimbas
  const [pages, setPages] = useState<ScannedPage[]>([]);
  // Mengesan sama ada sedang menggantikan halaman tertentu (retake)
  const [retakeIndex, setRetakeIndex] = useState<number | null>(null);

  // Data pemprosesan imej semasa
  const rawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [corners, setCorners] = useState<CornerPoints | null>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeCornerRef = useRef<CornerKey | null>(null);

  // Rujukan input fail sandaran
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  // Rujukan elemen mod live
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const liveContainerRef = useRef<HTMLDivElement | null>(null);
  const processingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafIdRef = useRef<number | null>(null);

  // Sesi sandaran: Jika kamera live gagal sekali, kekalkan fallback ke native capture sepanjang sesi modal
  const fallbackToNativeCapture = useRef<boolean>(false);

  // Penjejakan pembatalan perlumbaan kamera & status buka modal
  const liveSessionRef = useRef<number>(0);
  const isOpenRef = useRef<boolean>(isOpen);
  isOpenRef.current = isOpen;

  // Penjejakan kestabilan auto-snap
  const liveCornersRef = useRef<CornerPoints | null>(null);
  const steadyStartRef = useRef<number | null>(null);
  const recentCornersRef = useRef<CornerPoints[]>([]);
  const lastSnapTimeRef = useRef<number>(0);
  const consecutiveSlowCyclesRef = useRef<number>(0);
  const adaptiveIntervalRef = useRef<number>(150);
  const isSnappingRef = useRef<boolean>(false);
  const isAutoSnapEnabledRef = useRef<boolean>(isAutoSnapEnabled);
  isAutoSnapEnabledRef.current = isAutoSnapEnabled;

  // Rujukan halaman & retake untuk kestabilan callback (elak kamera restart bila halaman berubah)
  const pagesRef = useRef<ScannedPage[]>([]);
  pagesRef.current = pages;
  const retakeIndexRef = useRef<number | null>(retakeIndex);
  retakeIndexRef.current = retakeIndex;
  const maxPagesRef = useRef<number>(maxPages);
  maxPagesRef.current = maxPages;

  // Bersihkan semua URL objek apabila modal ditutup atau unmount
  const cleanupPages = useCallback((items: ScannedPage[]) => {
    items.forEach((p) => {
      try {
        URL.revokeObjectURL(p.previewUrl);
      } catch {}
    });
  }, []);

  // Hentikan suapan kamera & gelung live
  const stopLiveCamera = useCallback(() => {
    liveSessionRef.current++;
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    const overlay = overlayCanvasRef.current;
    if (overlay) {
      const ctx = overlay.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, overlay.width, overlay.height);
    }
    liveCornersRef.current = null;
    steadyStartRef.current = null;
    recentCornersRef.current = [];
    isSnappingRef.current = false;
  }, []);

  // Lukis bingkai hijau langsung di atas kanvas overlay (diskalakan mengikut devicePixelRatio)
  const drawLiveOverlay = useCallback(
    (
      video: HTMLVideoElement,
      canvas: HTMLCanvasElement,
      container: HTMLElement,
      detected: CornerPoints | null,
      isValid: boolean
    ) => {
      const cW = container.clientWidth;
      const cH = container.clientHeight;
      if (!cW || !cH) return;

      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      const targetW = Math.round(cW * dpr);
      const targetH = Math.round(cH * dpr);

      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.save();
      ctx.clearRect(0, 0, targetW, targetH);
      ctx.scale(dpr, dpr);

      if (!detected || !isValid) {
        ctx.restore();
        return;
      }

      const vW = video.videoWidth || 1920;
      const vH = video.videoHeight || 1080;
      const scale = Math.min(cW / vW, cH / vH);
      const renderW = vW * scale;
      const renderH = vH * scale;
      const offX = (cW - renderW) / 2;
      const offY = (cH - renderH) / 2;

      const toDisp = (pt: CornerPoint) => ({
        x: offX + pt.x * scale,
        y: offY + pt.y * scale,
      });

      const tl = toDisp(detected.topLeftCorner);
      const tr = toDisp(detected.topRightCorner);
      const br = toDisp(detected.bottomRightCorner);
      const bl = toDisp(detected.bottomLeftCorner);

      ctx.beginPath();
      ctx.moveTo(tl.x, tl.y);
      ctx.lineTo(tr.x, tr.y);
      ctx.lineTo(br.x, br.y);
      ctx.lineTo(bl.x, bl.y);
      ctx.closePath();

      ctx.fillStyle = "rgba(16, 185, 129, 0.18)";
      ctx.fill();

      ctx.lineWidth = 3.5;
      ctx.strokeStyle = "#10b981";
      ctx.lineJoin = "round";
      ctx.stroke();

      [tl, tr, br, bl].forEach((pt) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#059669";
        ctx.fill();
      });

      ctx.restore();
    },
    []
  );

  // Ambil gambar secara langsung (manual atau auto-snap)
  const handlePerformSnap = useCallback(
    async (targetCorners?: CornerPoints | null) => {
      if (isSnappingRef.current) return;
      if (retakeIndexRef.current === null && pagesRef.current.length >= maxPagesRef.current) {
        toast.info(`Maksimum ${maxPagesRef.current} halaman telah dicapai.`);
        return;
      }

      isSnappingRef.current = true;
      lastSnapTimeRef.current = Date.now();
      setLiveStatus("snapping");

      const snapSession = liveSessionRef.current;

      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate(50);
        } catch {}
      }

      try {
        const video = videoRef.current;
        const stream = streamRef.current;
        if (!video || !stream) {
          throw new Error("Suapan kamera tidak aktif.");
        }

        const vW = video.videoWidth;
        const vH = video.videoHeight;

        // Ambil foto resolusi tinggi
        const blob = await captureHighResPhoto(video, stream);
        if (snapSession !== liveSessionRef.current || !isOpenRef.current) {
          return;
        }

        stopLiveCamera();

        setStatusMessage("Memproses imej dan melaraskan sudut...");
        setStep("loading");

        const { canvas, width, height } = await processImageFile(blob);
        if (!isOpenRef.current) {
          return;
        }

        rawCanvasRef.current = canvas;

        const capturedAspect = width / height;
        const videoAspect = vW && vH ? vW / vH : 0;
        const isAspectMatching = Math.abs(capturedAspect - videoAspect) < 0.02;

        if (targetCorners && isAspectMatching && vW && vH) {
          const scaleX = width / vW;
          const scaleY = height / vH;
          const clampX = (val: number) => Math.max(0, Math.min(Math.round(val * scaleX), width));
          const clampY = (val: number) => Math.max(0, Math.min(Math.round(val * scaleY), height));

          setCorners({
            topLeftCorner: { x: clampX(targetCorners.topLeftCorner.x), y: clampY(targetCorners.topLeftCorner.y) },
            topRightCorner: { x: clampX(targetCorners.topRightCorner.x), y: clampY(targetCorners.topRightCorner.y) },
            bottomRightCorner: { x: clampX(targetCorners.bottomRightCorner.x), y: clampY(targetCorners.bottomRightCorner.y) },
            bottomLeftCorner: { x: clampX(targetCorners.bottomLeftCorner.x), y: clampY(targetCorners.bottomLeftCorner.y) },
          });
        } else {
          const detected = await detectDocumentCorners(canvas);
          if (!isOpenRef.current) {
            return;
          }
          setCorners(detected);
        }

        setStep("adjust");
      } catch (err: any) {
        if (!isOpenRef.current) return;
        console.error("Ralat snap kamera:", err);
        toast.error(err.message || "Gagal mengambil gambar.");
        stopLiveCamera();
        setStep(fallbackToNativeCapture.current ? "capture" : "live");
      } finally {
        isSnappingRef.current = false;
      }
    },
    [stopLiveCamera]
  );

  // Proses satu bingkai live kamera
  const processLiveFrame = useCallback(async () => {
    const video = videoRef.current;
    const overlay = overlayCanvasRef.current;
    const container = liveContainerRef.current;
    if (!video || !overlay || !container || video.readyState < 2 || isSnappingRef.current) {
      return;
    }

    if (!processingCanvasRef.current) {
      processingCanvasRef.current = document.createElement("canvas");
    }

    const { corners: detected, isValid, processingTimeMs } = await detectLivePaperCorners(
      video,
      processingCanvasRef.current
    );

    // Penurunan kadar bingkai adaptif (Adaptive Throttling)
    if (processingTimeMs > 100) {
      adaptiveIntervalRef.current = 300;
    } else if (processingTimeMs < 40) {
      adaptiveIntervalRef.current = 150;
    }

    if (processingTimeMs > 250) {
      consecutiveSlowCyclesRef.current++;
      if (consecutiveSlowCyclesRef.current >= 3 && isAutoSnapEnabledRef.current) {
        setIsAutoSnapEnabled(false);
      }
    } else {
      consecutiveSlowCyclesRef.current = 0;
    }

    drawLiveOverlay(video, overlay, container, detected, isValid);

    if (detected && isValid) {
      liveCornersRef.current = detected;
      const recent = recentCornersRef.current;
      recent.push(detected);
      if (recent.length > 3) recent.shift();

      let maxMovement = 0;
      if (recent.length >= 2) {
        const prev = recent[recent.length - 2];
        const keys: (keyof CornerPoints)[] = [
          "topLeftCorner",
          "topRightCorner",
          "bottomRightCorner",
          "bottomLeftCorner",
        ];
        keys.forEach((k) => {
          const d = Math.hypot(detected[k].x - prev[k].x, detected[k].y - prev[k].y);
          if (d > maxMovement) maxMovement = d;
        });
      }

      const stabilityThreshold = (video.videoWidth || 1920) * 0.02;

      if (maxMovement <= stabilityThreshold) {
        if (!steadyStartRef.current) {
          steadyStartRef.current = Date.now();
          setLiveStatus("detected");
        } else if (Date.now() - steadyStartRef.current >= 1000) {
          const now = Date.now();
          if (
            isAutoSnapEnabledRef.current &&
            now - lastSnapTimeRef.current >= 1500 &&
            !isSnappingRef.current &&
            (retakeIndexRef.current !== null || pagesRef.current.length < maxPagesRef.current)
          ) {
            setLiveStatus("snapping");
            handlePerformSnap(detected);
            return;
          } else {
            setLiveStatus("detected");
          }
        }
      } else {
        steadyStartRef.current = null;
        setLiveStatus("detected");
      }
    } else {
      liveCornersRef.current = null;
      recentCornersRef.current = [];
      steadyStartRef.current = null;
      setLiveStatus("searching");
    }
  }, [drawLiveOverlay, handlePerformSnap]);

  // Gelung RequestAnimationFrame berjadual
  const startLiveDetectionLoop = useCallback(() => {
    let lastTime = 0;

    const loop = async (timestamp: number) => {
      if (timestamp - lastTime >= adaptiveIntervalRef.current) {
        lastTime = timestamp;
        await processLiveFrame();
      }

      if (streamRef.current) {
        rafIdRef.current = requestAnimationFrame(loop);
      }
    };

    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
    }
    rafIdRef.current = requestAnimationFrame(loop);
  }, [processLiveFrame]);

  // Memulakan suapan kamera live
  const startLiveCamera = useCallback(async () => {
    if (fallbackToNativeCapture.current) {
      setStep("capture");
      return;
    }

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function"
    ) {
      fallbackToNativeCapture.current = true;
      toast.info("Kamera live tak dapat dibuka, guna kamera telefon.");
      setStep("capture");
      return;
    }

    stopLiveCamera();
    const sessionId = ++liveSessionRef.current;
    let stream: MediaStream | null = null;

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (sessionId !== liveSessionRef.current || !isOpenRef.current) {
        stream.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {}
        });
        return;
      }

      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {}
        });
        return;
      }

      video.srcObject = stream;
      await video.play();

      if (sessionId !== liveSessionRef.current || !isOpenRef.current) {
        stream.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {}
        });
        video.srcObject = null;
        return;
      }

      streamRef.current = stream;
      startLiveDetectionLoop();
    } catch (err: any) {
      if (stream && stream !== streamRef.current) {
        stream.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {}
        });
      }
      if (sessionId !== liveSessionRef.current || !isOpenRef.current) {
        return;
      }
      console.warn("Kamera live tidak dapat dimulakan:", err);
      fallbackToNativeCapture.current = true;
      toast.info("Kamera live tak dapat dibuka, guna kamera telefon.");
      setStep("capture");
    }
  }, [stopLiveCamera, startLiveDetectionLoop]);

  // Pantau penukaran tab (visibilitychange)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopLiveCamera();
      } else if (isOpen && step === "live") {
        startLiveCamera();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isOpen, step, startLiveCamera, stopLiveCamera]);

  // Revoke semua blob URL halaman semasa komponen di-unmount
  useEffect(() => {
    return () => {
      stopLiveCamera();
      pagesRef.current.forEach((p) => {
        try {
          URL.revokeObjectURL(p.previewUrl);
        } catch {}
      });
    };
  }, [stopLiveCamera]);

  // Muat OpenCV sekali sahaja apabila modal dibuka (deps [isOpen] sahaja)
  useEffect(() => {
    if (!isOpen) {
      stopLiveCamera();
      setStep("loading");
      setErrorMessage(null);
      setCorners(null);
      setRetakeIndex(null);
      if (rawCanvasRef.current) {
        rawCanvasRef.current.width = 1;
        rawCanvasRef.current.height = 1;
        rawCanvasRef.current = null;
      }
      return;
    }

    let isMounted = true;
    setStatusMessage("Memuatkan pengimbas... Sila tunggu sebentar.");
    setErrorMessage(null);

    loadOpenCv()
      .then(() => {
        if (!isMounted) return;
        if (pagesRef.current.length > 0) {
          setStep("review");
        } else {
          setStep(fallbackToNativeCapture.current ? "capture" : "live");
        }
      })
      .catch((err: any) => {
        if (!isMounted) return;
        console.error("OpenCV load error:", err);
        setErrorMessage(
          err.message ||
            "Gagal memuatkan pengimbas. Sila pastikan sambungan internet stabil atau gunakan pilihan fail biasa."
        );
        setStep("error");
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, stopLiveCamera]);

  // Aktifkan kamera apabila masuk ke langkah 'live'
  useEffect(() => {
    if (isOpen && step === "live" && !document.hidden) {
      startLiveCamera();
    } else {
      stopLiveCamera();
    }
  }, [isOpen, step, startLiveCamera, stopLiveCamera]);

  // Tutup dan lepaskan memori
  const handleClose = () => {
    stopLiveCamera();
    setRetakeIndex(null);
    cleanupPages(pages);
    setPages([]);
    onClose();
  };

  // Tangani pemilihan imej sandaran (kamera native atau galeri)
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      setStatusMessage("Memproses imej dan mengesan dokumen...");
      setStep("loading");
      setErrorMessage(null);

      const { canvas, width, height } = await processImageFile(file);
      rawCanvasRef.current = canvas;

      const detectedCorners = await detectDocumentCorners(canvas);
      setCorners(detectedCorners);
      setStep("adjust");
    } catch (err: any) {
      console.error("Ralat memproses fail imej:", err);
      setErrorMessage(err.message || "Gagal memproses fail imej yang dipilih.");
      setStep(pages.length > 0 ? "review" : fallbackToNativeCapture.current ? "capture" : "live");
    }
  };

  // Lukis imej dan sudut pada displayCanvas di skrin adjust
  const drawDisplayCanvas = useCallback(() => {
    const displayCanvas = displayCanvasRef.current;
    const rawCanvas = rawCanvasRef.current;
    if (!displayCanvas || !rawCanvas || !corners) return;

    const ctx = displayCanvas.getContext("2d");
    if (!ctx) return;

    const containerWidth = displayCanvas.parentElement?.clientWidth || 320;
    const scale = Math.min(1, containerWidth / rawCanvas.width);
    const dispW = Math.round(rawCanvas.width * scale);
    const dispH = Math.round(rawCanvas.height * scale);

    if (displayCanvas.width !== dispW || displayCanvas.height !== dispH) {
      displayCanvas.width = dispW;
      displayCanvas.height = dispH;
    }

    ctx.clearRect(0, 0, dispW, dispH);
    ctx.drawImage(rawCanvas, 0, 0, dispW, dispH);

    const toDisp = (pt: CornerPoint) => ({
      x: pt.x * scale,
      y: pt.y * scale,
    });

    const tl = toDisp(corners.topLeftCorner);
    const tr = toDisp(corners.topRightCorner);
    const br = toDisp(corners.bottomRightCorner);
    const bl = toDisp(corners.bottomLeftCorner);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(tl.x, tl.y);
    ctx.lineTo(tr.x, tr.y);
    ctx.lineTo(br.x, br.y);
    ctx.lineTo(bl.x, bl.y);
    ctx.closePath();

    ctx.fillStyle = "rgba(6, 182, 212, 0.15)";
    ctx.fill();

    ctx.lineWidth = 3;
    ctx.strokeStyle = "#06b6d4";
    ctx.stroke();
    ctx.restore();

    const handlePoints: { key: CornerKey; pt: { x: number; y: number }; label: string }[] = [
      { key: "topLeftCorner", pt: tl, label: "TL" },
      { key: "topRightCorner", pt: tr, label: "TR" },
      { key: "bottomRightCorner", pt: br, label: "BR" },
      { key: "bottomLeftCorner", pt: bl, label: "BL" },
    ];

    handlePoints.forEach(({ pt }) => {
      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 16, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 11, 0, Math.PI * 2);
      ctx.fillStyle = "#0891b2";
      ctx.fill();

      ctx.restore();
    });
  }, [corners]);

  useEffect(() => {
    if (step === "adjust") {
      drawDisplayCanvas();
      const onResize = () => drawDisplayCanvas();
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }
  }, [step, drawDisplayCanvas]);

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const displayCanvas = displayCanvasRef.current;
    const rawCanvas = rawCanvasRef.current;
    if (!displayCanvas || !rawCanvas) return null;

    const rect = displayCanvas.getBoundingClientRect();
    const dispX = e.clientX - rect.left;
    const dispY = e.clientY - rect.top;

    const scaleX = rect.width / rawCanvas.width;
    const scaleY = rect.height / rawCanvas.height;

    const rawX = Math.max(0, Math.min(dispX / scaleX, rawCanvas.width));
    const rawY = Math.max(0, Math.min(dispY / scaleY, rawCanvas.height));

    return { dispX, dispY, rawX, rawY, scaleX, scaleY };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!corners || !rawCanvasRef.current) return;
    const coords = getCanvasCoords(e);
    if (!coords) return;

    const { dispX, dispY, scaleX, scaleY } = coords;
    const TOUCH_THRESHOLD = 40;

    const cornersList: { key: CornerKey; point: CornerPoint }[] = [
      { key: "topLeftCorner", point: corners.topLeftCorner },
      { key: "topRightCorner", point: corners.topRightCorner },
      { key: "bottomRightCorner", point: corners.bottomRightCorner },
      { key: "bottomLeftCorner", point: corners.bottomLeftCorner },
    ];

    let closestCorner: CornerKey | null = null;
    let minDistance = Infinity;

    cornersList.forEach(({ key, point }) => {
      const ptDispX = point.x * scaleX;
      const ptDispY = point.y * scaleY;
      const dist = Math.hypot(ptDispX - dispX, ptDispY - dispY);
      if (dist < TOUCH_THRESHOLD && dist < minDistance) {
        minDistance = dist;
        closestCorner = key;
      }
    });

    if (closestCorner) {
      activeCornerRef.current = closestCorner;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!activeCornerRef.current || !corners || !rawCanvasRef.current) return;
    const coords = getCanvasCoords(e);
    if (!coords) return;

    const { rawX, rawY } = coords;
    const key = activeCornerRef.current;

    setCorners((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        [key]: { x: Math.round(rawX), y: Math.round(rawY) },
      };
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeCornerRef.current) {
      activeCornerRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handleResetToFull = () => {
    const raw = rawCanvasRef.current;
    if (!raw) return;
    setCorners({
      topLeftCorner: { x: 0, y: 0 },
      topRightCorner: { x: raw.width, y: 0 },
      bottomRightCorner: { x: raw.width, y: raw.height },
      bottomLeftCorner: { x: 0, y: raw.height },
    });
  };

  const handleReDetect = async () => {
    const raw = rawCanvasRef.current;
    if (!raw) return;
    try {
      const detected = await detectDocumentCorners(raw);
      setCorners(detected);
    } catch (err) {
      console.warn("Gagal mengesan semula:", err);
    }
  };

  // Sahkan pemotongan dan kembali ke Live untuk halaman seterusnya
  const handleConfirmCrop = async () => {
    const raw = rawCanvasRef.current;
    if (!raw || !corners) return;

    if (retakeIndex === null && pages.length >= maxPages) {
      toast.error(`Had maksimum ${maxPages} halaman telah dicapai.`);
      return;
    }

    try {
      setStatusMessage("Membetulkan perspektif dan memotong dokumen...");
      setStep("loading");

      const blob = await warpAndCropPaper(raw, corners);
      const previewUrl = URL.createObjectURL(blob);
      const newPage: ScannedPage = {
        id: `page_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        blob,
        previewUrl,
      };

      raw.width = 1;
      raw.height = 1;
      rawCanvasRef.current = null;

      if (retakeIndex !== null && retakeIndex >= 0 && retakeIndex < pages.length) {
        const updated = [...pages];
        try {
          URL.revokeObjectURL(updated[retakeIndex].previewUrl);
        } catch {}
        updated[retakeIndex] = newPage;
        setPages(updated);
        setRetakeIndex(null);
        setStep("review");
      } else {
        const nextPages = [...pages, newPage];
        setPages(nextPages);
        if (nextPages.length >= maxPages) {
          toast.info(`Maksimum ${maxPages} halaman telah dicapai.`);
          setStep("review");
        } else {
          setStep(fallbackToNativeCapture.current ? "capture" : "live");
        }
      }
    } catch (err: any) {
      console.error("Ralat memotong dokumen:", err);
      setErrorMessage(err.message || "Gagal memotong dokumen.");
      setStep("adjust");
    }
  };

  const handleCancelCurrent = () => {
    if (rawCanvasRef.current) {
      rawCanvasRef.current.width = 1;
      rawCanvasRef.current.height = 1;
      rawCanvasRef.current = null;
    }
    if (retakeIndex !== null) {
      setRetakeIndex(null);
      setStep("review");
    } else if (pages.length > 0) {
      setStep("review");
    } else {
      setStep(fallbackToNativeCapture.current ? "capture" : "live");
    }
  };

  const handleDeletePage = (index: number) => {
    const item = pages[index];
    if (item) {
      try {
        URL.revokeObjectURL(item.previewUrl);
      } catch {}
    }
    const updated = pages.filter((_, i) => i !== index);
    setPages(updated);
    if (updated.length === 0) {
      setStep(fallbackToNativeCapture.current ? "capture" : "live");
    }
  };

  const handleRetakePage = (index: number) => {
    setRetakeIndex(index);
    setStep(fallbackToNativeCapture.current ? "capture" : "live");
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const updated = [...pages];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    setPages(updated);
  };

  const handleMoveDown = (index: number) => {
    if (index >= pages.length - 1) return;
    const updated = [...pages];
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;
    setPages(updated);
  };

  // Gabungkan semua halaman ke fail PDF dan semak had saiz 10MB
  const handleAssemblePdf = async () => {
    if (pages.length === 0) return;

    try {
      setStep("assembling");
      setStatusMessage("Menjana fail PDF berbilang halaman...");
      const pdfFile = await assemblePdfDocument(
        pages.map((p) => p.blob),
        ticketRefNo
      );

      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
      if (pdfFile.size > MAX_FILE_SIZE) {
        toast.error("Fail terlalu besar (maks 10MB). Kurangkan halaman atau scan semula.");
        setStep("review");
        return;
      }

      cleanupPages(pages);
      setPages([]);
      onComplete(pdfFile);
      onClose();
    } catch (err: any) {
      console.error("Ralat menjana PDF:", err);
      setErrorMessage(err.message || "Gagal menjana dokumen PDF.");
      setStep("review");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-slate-950 text-white overflow-hidden select-none">
      {/* Input Fail Tersembunyi untuk Sandaran */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelected}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* Header Bar */}
      <header className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-slate-800 shrink-0 z-30">
        <div className="flex items-center gap-2">
          <span className="text-xl">📸</span>
          <div>
            <h2 className="font-semibold text-sm text-slate-100">
              {retakeIndex !== null
                ? `Ambil Semula Halaman ${retakeIndex + 1}`
                : "Pengimbas Dokumen Service Report"}
            </h2>
            <p className="text-xs text-slate-400">
              {pages.length > 0
                ? `${pages.length} / ${maxPages} Halaman`
                : step === "live"
                ? "Mod Live Pintar"
                : "Ala CamScanner"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {step === "live" && (
            <button
              type="button"
              onClick={() => {
                setIsAutoSnapEnabled((prev) => {
                  const nextVal = !prev;
                  if (nextVal) {
                    consecutiveSlowCyclesRef.current = 0;
                  }
                  return nextVal;
                });
              }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition ${
                isAutoSnapEnabled
                  ? "bg-emerald-950/80 border-emerald-600 text-emerald-300"
                  : "bg-slate-800 border-slate-700 text-slate-400"
              }`}
              title="Togol Tangkapan Automatik"
            >
              ⚡ Auto: {isAutoSnapEnabled ? "ON" : "OFF"}
            </button>
          )}
          <button
            onClick={handleClose}
            type="button"
            className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
          >
            ✕ Tutup
          </button>
        </div>
      </header>

      {/* Paparan Ralat jika ada */}
      {errorMessage && (
        <div className="px-4 py-2.5 bg-rose-950/80 border-b border-rose-800 text-rose-200 text-xs flex items-center justify-between z-30">
          <span>⚠️ {errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            type="button"
            className="text-rose-300 hover:text-white ml-2 text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {/* Kandungan Mengikut Langkah (Steps) */}
      <main
        className={`flex-1 flex flex-col items-center justify-center ${
          step === "live" ? "p-0 overflow-hidden relative" : "p-4 overflow-y-auto"
        }`}
      >
        {/* 1. Status Loading / Assembling */}
        {(step === "loading" || step === "assembling") && (
          <div className="flex flex-col items-center justify-center gap-4 text-center p-6 max-w-sm">
            <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-slate-200">{statusMessage}</p>
            <p className="text-xs text-slate-400">
              Sistem sedang memproses dokumen pada kualiti tinggi.
            </p>
          </div>
        )}

        {/* 1b. Ralat OpenCV Gagal Dimuat */}
        {step === "error" && (
          <div className="flex flex-col items-center justify-center gap-6 text-center p-6 max-w-sm">
            <div className="w-20 h-20 rounded-2xl bg-rose-950/70 border border-rose-800/80 flex items-center justify-center text-4xl shadow-lg">
              ⚠️
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-semibold text-slate-100">
                Scanner tak dapat dibuka.
              </h3>
              <p className="text-sm text-slate-300">
                Sila guna Pilih Fail PDF / Gambar.
              </p>
              {errorMessage && (
                <p className="text-[11px] text-slate-400 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 mt-2">
                  {errorMessage}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3 w-full">
              <button
                type="button"
                onClick={() => {
                  handleClose();
                  onFallbackUpload?.();
                }}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white font-semibold text-xs rounded-xl shadow-md transition cursor-pointer"
              >
                <span className="text-base">📁</span>
                <span>Pilih Fail PDF / Gambar</span>
              </button>

              <button
                type="button"
                onClick={handleClose}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-xl border border-slate-700 transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        )}

        {/* 1c. Skrin Live Camera (Ala CamScanner - ADR 0034) */}
        {step === "live" && (
          <div
            ref={liveContainerRef}
            className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden bg-black select-none"
          >
            {/* Suapan Video Kamera */}
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="w-full h-full object-contain"
            />

            {/* Kanvas Bingkai Hijau Langsung */}
            <canvas
              ref={overlayCanvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none z-10"
            />

            {/* Status Pill Atas (BM santai) */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
              <div
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-lg backdrop-blur-md transition-all ${
                  liveStatus === "snapping"
                    ? "bg-emerald-600 text-white scale-105"
                    : liveStatus === "detected"
                    ? "bg-emerald-950/90 text-emerald-300 border border-emerald-500/80"
                    : "bg-slate-900/90 text-slate-300 border border-slate-700/80"
                }`}
              >
                <span>
                  {liveStatus === "snapping"
                    ? "⚡"
                    : liveStatus === "detected"
                    ? "🎯"
                    : "🔍"}
                </span>
                <span>
                  {liveStatus === "snapping"
                    ? "✓ Snap!"
                    : liveStatus === "detected"
                    ? "Pegang stabil..."
                    : "Halakan kamera ke borang"}
                </span>
              </div>
            </div>

            {/* Panel Kawalan Bawah */}
            <div className="absolute bottom-0 inset-x-0 z-20 p-4 pb-6 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col gap-3">
              <div className="flex items-center justify-between w-full max-w-md mx-auto px-2">
                {/* Kiri: Thumbnail Halaman Terkini atau Batal jika Retake */}
                <div className="w-24 flex items-center justify-start">
                  {retakeIndex !== null ? (
                    <button
                      type="button"
                      onClick={() => {
                        stopLiveCamera();
                        setRetakeIndex(null);
                        setStep("review");
                      }}
                      className="px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 border border-slate-700 rounded-lg shadow"
                    >
                      Batal
                    </button>
                  ) : pages.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        stopLiveCamera();
                        setStep("review");
                      }}
                      className="flex items-center gap-2 p-1.5 pr-2.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 rounded-xl shadow transition"
                      title="Semak halaman diimbas"
                    >
                      <div className="w-8 h-10 rounded bg-slate-950 overflow-hidden border border-slate-700 shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={pages[pages.length - 1].previewUrl}
                          alt="Halaman Terkini"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="text-left leading-tight">
                        <span className="block text-xs font-bold text-white">
                          {pages.length}
                        </span>
                        <span className="block text-[9px] text-slate-400">
                          Halaman
                        </span>
                      </div>
                    </button>
                  ) : (
                    <div className="w-8" />
                  )}
                </div>

                {/* Tengah: Butang Bulat Besar Shutter (Manual Snap) */}
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => handlePerformSnap(liveCornersRef.current)}
                    className="relative w-[72px] h-[72px] rounded-full border-4 border-white flex items-center justify-center bg-white/20 active:scale-95 shadow-2xl transition cursor-pointer"
                    title="Ambil Gambar"
                  >
                    <div className="w-[52px] h-[52px] rounded-full bg-white hover:bg-slate-100 transition shadow" />
                  </button>
                </div>

                {/* Kanan: Butang Selesai (hanya jika ada halaman dan BUKAN retake) atau Butang Galeri/Telefon */}
                <div className="w-24 flex items-center justify-end">
                  {retakeIndex === null && pages.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        stopLiveCamera();
                        setRetakeIndex(null);
                        setStep("review");
                      }}
                      className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-lg flex items-center gap-1 transition cursor-pointer"
                    >
                      <span>Selesai</span>
                      <span>→</span>
                    </button>
                  ) : retakeIndex === null ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => galleryInputRef.current?.click()}
                        className="p-2.5 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-xs flex items-center justify-center shadow"
                        title="Pilih dari Galeri"
                      >
                        🖼️
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          stopLiveCamera();
                          setStep("capture");
                        }}
                        className="p-2.5 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-xs flex items-center justify-center shadow"
                        title="Guna Kamera Telefon (Native)"
                      >
                        📷
                      </button>
                    </div>
                  ) : (
                    <div className="w-8" />
                  )}
                </div>
              </div>

              {/* Baris Pintasan Bawah jika sudah ada halaman */}
              {pages.length > 0 && (
                <div className="flex items-center justify-center gap-4 pt-1">
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="text-[11px] text-slate-300 hover:text-white flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-slate-900/60 border border-slate-800"
                  >
                    <span>🖼️</span>
                    <span>Pilih Galeri</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      stopLiveCamera();
                      setStep("capture");
                    }}
                    className="text-[11px] text-slate-300 hover:text-white flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-slate-900/60 border border-slate-800"
                  >
                    <span>📷</span>
                    <span>Kamera Telefon</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. Peringkat Pengambilan Sandaran (Native Fallback Capture) */}
        {step === "capture" && (
          <div className="flex flex-col items-center justify-center gap-6 w-full max-w-sm text-center">
            <div className="w-20 h-20 rounded-2xl bg-cyan-950/60 border border-cyan-800/80 flex items-center justify-center text-4xl shadow-lg">
              📄
            </div>

            <div>
              <h3 className="text-base font-semibold text-slate-100">
                {retakeIndex !== null
                  ? `Ambil Semula Halaman ${retakeIndex + 1}`
                  : pages.length > 0
                  ? `Tambah Halaman ${pages.length + 1}`
                  : "Imbas Halaman Service Report"}
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Pilih kamera untuk mengambil gambar borang atau pilih imej yang telah disimpan dalam galeri peranti.
              </p>
            </div>

            <div className="flex flex-col gap-3 w-full">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white font-medium text-sm rounded-xl shadow-md transition"
              >
                <span className="text-lg">📷</span>
                <span>Ambil Gambar Kamera Telefon</span>
              </button>

              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700 text-slate-200 font-medium text-sm rounded-xl transition"
              >
                <span className="text-lg">🖼️</span>
                <span>Pilih dari Galeri Peranti</span>
              </button>

              {/* Pilihan cuba mod live semula jika disokong */}
              {typeof navigator !== "undefined" &&
                navigator.mediaDevices &&
                typeof navigator.mediaDevices.getUserMedia === "function" && (
                  <button
                    type="button"
                    onClick={() => {
                      fallbackToNativeCapture.current = false;
                      setStep("live");
                    }}
                    className="w-full py-2.5 text-xs text-cyan-400 hover:text-cyan-300 flex items-center justify-center gap-1.5"
                  >
                    <span>🎥</span>
                    <span>Cuba Mod Kamera Live Semula</span>
                  </button>
                )}

              {pages.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setRetakeIndex(null);
                    setStep("review");
                  }}
                  className="w-full py-2.5 text-xs text-slate-400 hover:text-slate-200 underline mt-1"
                >
                  Kembali ke Senarai Halaman ({pages.length})
                </button>
              )}
            </div>
          </div>
        )}

        {/* 3. Peringkat Pelarasan Bucu (Adjust Corners) */}
        {step === "adjust" && (
          <div className="flex flex-col items-center justify-between w-full h-full max-w-md gap-3">
            <div className="flex items-center justify-between w-full px-2">
              <span className="text-xs text-cyan-300 font-medium">
                👆 Seret 4 bulatan untuk sesuaikan penjuru dokumen
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleReDetect}
                  className="px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
                >
                  Auto-Kesan
                </button>
                <button
                  type="button"
                  onClick={handleResetToFull}
                  className="px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
                >
                  Penuh
                </button>
              </div>
            </div>

            {/* Kanvas Interaktif */}
            <div className="flex-1 w-full flex items-center justify-center relative overflow-hidden bg-slate-900/60 rounded-xl border border-slate-800 p-2">
              <canvas
                ref={displayCanvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className="max-h-[62vh] max-w-full rounded shadow-xl touch-none cursor-crosshair"
              />
            </div>

            {/* Tindakan Pelarasan Bawah */}
            <div className="flex items-center gap-2 w-full pt-2">
              <button
                type="button"
                onClick={handleCancelCurrent}
                className="flex-1 py-3 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl border border-slate-700 transition"
              >
                Batal / Ambil Semula
              </button>
              <button
                type="button"
                onClick={handleConfirmCrop}
                className="flex-[2] py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-md transition flex items-center justify-center gap-1.5"
              >
                <span>✓</span>
                <span>Potong & Sahkan Halaman</span>
              </button>
            </div>
          </div>
        )}

        {/* 4. Peringkat Semakan & Berbilang Halaman (Review Multi-page) */}
        {step === "review" && (
          <div className="flex flex-col w-full max-w-md h-full justify-between gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100">
                Halaman Diimbas ({pages.length} daripada {maxPages})
              </h3>
              {pages.length < maxPages ? (
                <button
                  type="button"
                  onClick={() =>
                    setStep(fallbackToNativeCapture.current ? "capture" : "live")
                  }
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded-lg shadow transition flex items-center gap-1"
                >
                  <span>+</span>
                  <span>Tambah Halaman</span>
                </button>
              ) : (
                <span className="text-[11px] text-amber-400 font-medium">
                  Maksimum {maxPages} halaman telah dicapai
                </span>
              )}
            </div>

            {/* Senarai Thumbnail Halaman */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {pages.map((p, idx) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 p-2.5 bg-slate-900 border border-slate-800 rounded-xl shadow-sm"
                >
                  {/* Thumbnail */}
                  <div className="w-16 h-20 bg-slate-950 rounded border border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.previewUrl}
                      alt={`Halaman ${idx + 1}`}
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {/* Info Halaman */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-200">
                      Halaman {idx + 1}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {(p.blob.size / 1024).toFixed(0)} KB (A4 JPEG)
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => handleRetakePage(idx)}
                        className="text-[11px] text-cyan-400 hover:underline"
                      >
                        🔄 Ambil Semula
                      </button>
                      <span className="text-slate-600">•</span>
                      <button
                        type="button"
                        onClick={() => handleDeletePage(idx)}
                        className="text-[11px] text-rose-400 hover:underline"
                      >
                        🗑️ Padam
                      </button>
                    </div>
                  </div>

                  {/* Butang Susunan Naik/Turun */}
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveUp(idx)}
                      className={`p-1.5 rounded text-xs leading-none ${
                        idx === 0
                          ? "text-slate-600 cursor-not-allowed"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      }`}
                      title="Alih ke atas"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      disabled={idx === pages.length - 1}
                      onClick={() => handleMoveDown(idx)}
                      className={`p-1.5 rounded text-xs leading-none ${
                        idx === pages.length - 1
                          ? "text-slate-600 cursor-not-allowed"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      }`}
                      title="Alih ke bawah"
                    >
                      ▼
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Butang Gabung PDF */}
            <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleAssemblePdf}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2"
              >
                <span>📄</span>
                <span>Selesai & Jana Fail PDF ({pages.length} Halaman)</span>
              </button>
              <p className="text-[11px] text-center text-slate-400">
                Fail PDF standard A4 akan dimuat naik ke laporan perkhidmatan tiket.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
