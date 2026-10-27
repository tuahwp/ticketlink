"use client";

import { useEffect } from "react";
import { sanitizeErrorMessage } from "@/lib/errors";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Global Error Boundary]", error);
  }, [error]);

  const { message, isDeployMismatch } = sanitizeErrorMessage(error);

  const handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <html lang="ms">
      <body className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-900 text-slate-100 font-sans antialiased select-none">
        <div className="w-full max-w-sm sm:max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 text-left">
          {/* Header Icon & Title */}
          <div className="flex items-start gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-2xl font-bold ${
                isDeployMismatch
                  ? "bg-blue-950/70 text-blue-300 ring-4 ring-blue-500/10"
                  : "bg-rose-950/70 text-rose-300 ring-4 ring-rose-500/10"
              }`}
            >
              {isDeployMismatch ? "🔄" : "⚠️"}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <h2 className="text-lg font-black text-white tracking-tight">
                {isDeployMismatch ? "Versi Baharu Tersedia" : "Ralat"}
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed break-words">
                {message}
              </p>
            </div>
          </div>

          {/* Action Controls */}
          <div className="pt-2 flex items-center gap-2.5 w-full">
            {isDeployMismatch ? (
              <button
                type="button"
                onClick={handleReload}
                className="w-full min-h-[46px] py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-sm active:scale-98 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>🔄</span>
                <span>Muat Semula</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => reset()}
                  className="flex-1 min-h-[46px] py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm text-white bg-teal-600 hover:bg-teal-700 active:bg-teal-800 shadow-sm active:scale-98 transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>🔄</span>
                  <span>Cuba Lagi</span>
                </button>
                <button
                  type="button"
                  onClick={handleReload}
                  className="flex-1 min-h-[46px] py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm text-slate-200 bg-slate-800 hover:bg-slate-700 active:scale-98 transition flex items-center justify-center cursor-pointer"
                >
                  Muat Semula Halaman
                </button>
              </>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
