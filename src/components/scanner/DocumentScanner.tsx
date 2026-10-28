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

type ScannerStep = "loading" | "capture" | "adjust" | "review" | "assembling" | "error";
type CornerKey = "topLeftCorner" | "topRightCorner" | "bottomRightCorner" | "bottomLeftCorner";

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

  // Halaman-halaman yang telah siap diimbas
  const [pages, setPages] = useState<ScannedPage[]>([]);
  // Mengesan sama ada sedang menggantikan halaman tertentu (retake)
  const [retakeIndex, setRetakeIndex] = useState<number | null>(null);

  // Data pemprosesan imej semasa
  const rawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [corners, setCorners] = useState<CornerPoints | null>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeCornerRef = useRef<CornerKey | null>(null);

  // Rujukan input fail
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  // Rujukan halaman untuk elak dependensi pages.length dan untuk pembersihan semasa unmount
  const pagesRef = useRef<ScannedPage[]>([]);
  pagesRef.current = pages;

  // Bersihkan semua URL objek apabila modal ditutup atau unmount
  const cleanupPages = useCallback((items: ScannedPage[]) => {
    items.forEach((p) => {
      try {
        URL.revokeObjectURL(p.previewUrl);
      } catch {}
    });
  }, []);

  // Revoke semua blob URL halaman semasa komponen di-unmount
  useEffect(() => {
    return () => {
      pagesRef.current.forEach((p) => {
        try {
          URL.revokeObjectURL(p.previewUrl);
        } catch {}
      });
    };
  }, []);

  // Muat OpenCV sekali sahaja apabila modal dibuka (deps [isOpen] sahaja)
  useEffect(() => {
    if (!isOpen) {
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
        setStep((prev) => (pagesRef.current.length > 0 ? "review" : "capture"));
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
  }, [isOpen]);

  // Tutup dan lepaskan memori
  const handleClose = () => {
    cleanupPages(pages);
    setPages([]);
    onClose();
  };

  // Tangani pemilihan imej (kamera atau galeri)
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset nilai input supaya boleh memilih semula fail yang sama jika retake
    e.target.value = "";
    if (!file) return;

    try {
      setStatusMessage("Memproses imej dan mengesan dokumen...");
      setStep("loading");
      setErrorMessage(null);

      // 1. Baca EXIF & downscale kepada maksimum 1920px
      const { canvas, width, height } = await processImageFile(file);
      rawCanvasRef.current = canvas;

      // 2. Auto-kesan 4 sudut dokumen
      const detectedCorners = await detectDocumentCorners(canvas);
      setCorners(detectedCorners);
      setStep("adjust");
    } catch (err: any) {
      console.error("Ralat memproses fail imej:", err);
      setErrorMessage(err.message || "Gagal memproses fail imej yang dipilih.");
      setStep(pages.length > 0 ? "review" : "capture");
    }
  };

  // Lukis imej dan sudut pada displayCanvas
  const drawDisplayCanvas = useCallback(() => {
    const displayCanvas = displayCanvasRef.current;
    const rawCanvas = rawCanvasRef.current;
    if (!displayCanvas || !rawCanvas || !corners) return;

    const ctx = displayCanvas.getContext("2d");
    if (!ctx) return;

    const containerWidth = displayCanvas.parentElement?.clientWidth || 320;
    // Hadkan lebar kanvas paparan mengikut skrin peranti
    const scale = Math.min(1, containerWidth / rawCanvas.width);
    const dispW = Math.round(rawCanvas.width * scale);
    const dispH = Math.round(rawCanvas.height * scale);

    if (displayCanvas.width !== dispW || displayCanvas.height !== dispH) {
      displayCanvas.width = dispW;
      displayCanvas.height = dispH;
    }

    // Lukis imej latar belakang
    ctx.clearRect(0, 0, dispW, dispH);
    ctx.drawImage(rawCanvas, 0, 0, dispW, dispH);

    // Titik sudut berskala
    const toDisp = (pt: CornerPoint) => ({
      x: pt.x * scale,
      y: pt.y * scale,
    });

    const tl = toDisp(corners.topLeftCorner);
    const tr = toDisp(corners.topRightCorner);
    const br = toDisp(corners.bottomRightCorner);
    const bl = toDisp(corners.bottomLeftCorner);

    // 1. Lukis poligon dokumen
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

    // 2. Lukis 4 pemegang sudut (handles)
    const handlePoints: { key: CornerKey; pt: { x: number; y: number }; label: string }[] = [
      { key: "topLeftCorner", pt: tl, label: "TL" },
      { key: "topRightCorner", pt: tr, label: "TR" },
      { key: "bottomRightCorner", pt: br, label: "BR" },
      { key: "bottomLeftCorner", pt: bl, label: "BL" },
    ];

    handlePoints.forEach(({ pt }) => {
      ctx.save();
      // Bayang pemegang
      ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;

      // Bulatan luar putih
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 16, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();

      // Bulatan dalam cyan
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 11, 0, Math.PI * 2);
      ctx.fillStyle = "#0891b2";
      ctx.fill();

      ctx.restore();
    });
  }, [corners]);

  // Pantau perubahan sudut atau saiz tetingkap untuk lukisan semula
  useEffect(() => {
    if (step === "adjust") {
      drawDisplayCanvas();
      const onResize = () => drawDisplayCanvas();
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }
  }, [step, drawDisplayCanvas]);

  // Dapatkan koordinat pointer pada imej asal
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const displayCanvas = displayCanvasRef.current;
    const rawCanvas = rawCanvasRef.current;
    if (!displayCanvas || !rawCanvas) return null;

    const rect = displayCanvas.getBoundingClientRect();
    const dispX = e.clientX - rect.left;
    const dispY = e.clientY - rect.top;

    // Skala koordinat mesti guna getBoundingClientRect() (rect.width / raw.width, rect.height / raw.height)
    // kerana canvas dikecilkan oleh max-h-[62vh]
    const scaleX = rect.width / rawCanvas.width;
    const scaleY = rect.height / rawCanvas.height;

    const rawX = Math.max(0, Math.min(dispX / scaleX, rawCanvas.width));
    const rawY = Math.max(0, Math.min(dispY / scaleY, rawCanvas.height));

    return { dispX, dispY, rawX, rawY, scaleX, scaleY };
  };

  // Mula seret pemegang sudut dengan pointer events
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!corners || !rawCanvasRef.current) return;
    const coords = getCanvasCoords(e);
    if (!coords) return;

    const { dispX, dispY, scaleX, scaleY } = coords;
    const TOUCH_THRESHOLD = 40; // Kawasan sentuh 40px selesa untuk jari telefon

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

  // Semasa menyeret pemegang
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

  // Tamat menyeret
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeCornerRef.current) {
      activeCornerRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // Tetapkan 4 sudut kepada keseluruhan bingkai gambar
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

  // Jalankan semula auto-kesan kontur
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

  // Sahkan pemotongan dan warp ke format A4 JPEG
  const handleConfirmCrop = async () => {
    const raw = rawCanvasRef.current;
    if (!raw || !corners) return;

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

      // Bersihkan kanvas mentah untuk jimat RAM
      raw.width = 1;
      raw.height = 1;
      rawCanvasRef.current = null;

      if (retakeIndex !== null && retakeIndex >= 0 && retakeIndex < pages.length) {
        // Gantikan halaman lama
        const updated = [...pages];
        try {
          URL.revokeObjectURL(updated[retakeIndex].previewUrl);
        } catch {}
        updated[retakeIndex] = newPage;
        setPages(updated);
        setRetakeIndex(null);
      } else {
        setPages((prev) => [...prev, newPage]);
      }

      setStep("review");
    } catch (err: any) {
      console.error("Ralat memotong dokumen:", err);
      setErrorMessage(err.message || "Gagal memotong dokumen.");
      setStep("adjust");
    }
  };

  // Batalkan tangkapan semasa dan kembali
  const handleCancelCurrent = () => {
    if (rawCanvasRef.current) {
      rawCanvasRef.current.width = 1;
      rawCanvasRef.current.height = 1;
      rawCanvasRef.current = null;
    }
    setRetakeIndex(null);
    if (pages.length > 0) {
      setStep("review");
    } else {
      setStep("capture");
    }
  };

  // Padam satu halaman daripada senarai
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
      setStep("capture");
    }
  };

  // Retake halaman tertentu
  const handleRetakePage = (index: number) => {
    setRetakeIndex(index);
    setStep("capture");
  };

  // Gerakkan susunan halaman ke atas
  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const updated = [...pages];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    setPages(updated);
  };

  // Gerakkan susunan halaman ke bawah
  const handleMoveDown = (index: number) => {
    if (index >= pages.length - 1) return;
    const updated = [...pages];
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;
    setPages(updated);
  };

  // Gabungkan semua halaman ke fail PDF dan hantar balik
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
      {/* Input Fail Tersembunyi */}
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
      <header className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xl">📸</span>
          <div>
            <h2 className="font-semibold text-sm text-slate-100">Pengimbas Dokumen Service Report</h2>
            <p className="text-xs text-slate-400">
              {pages.length > 0 ? `${pages.length} / ${maxPages} Halaman` : "Ala CamScanner"}
            </p>
          </div>
        </div>
        <button
          onClick={handleClose}
          type="button"
          className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
        >
          ✕ Tutup
        </button>
      </header>

      {/* Paparan Ralat jika ada */}
      {errorMessage && (
        <div className="px-4 py-2.5 bg-rose-950/80 border-b border-rose-800 text-rose-200 text-xs flex items-center justify-between">
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
      <main className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-4">
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

        {/* 2. Peringkat Pengambilan (Capture) */}
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
                Pilih kamera untuk mengambil gambar borang atau pilih imej yang telah disimpan dalam galeri.
              </p>
            </div>

            <div className="flex flex-col gap-3 w-full">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white font-medium text-sm rounded-xl shadow-md transition"
              >
                <span className="text-lg">📷</span>
                <span>Ambil Gambar Kamera</span>
              </button>

              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700 text-slate-200 font-medium text-sm rounded-xl transition"
              >
                <span className="text-lg">🖼️</span>
                <span>Pilih dari Galeri Peranti</span>
              </button>

              {pages.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setRetakeIndex(null);
                    setStep("review");
                  }}
                  className="w-full py-2.5 text-xs text-slate-400 hover:text-slate-200 underline mt-2"
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
                  onClick={() => setStep("capture")}
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
                  <div className="w-16 h-20 bg-slate-950 rounded border border-slate-850 flex items-center justify-center overflow-hidden shrink-0">
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
