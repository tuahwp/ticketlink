"use client";

import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { sanitizeErrorMessage } from "@/lib/errors";

interface ErrorDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  isDeployMismatch: boolean;
  onDismiss?: () => void;
}

interface ErrorDialogContextValue {
  showError: (err: unknown, options?: { title?: string; onDismiss?: () => void }) => void;
  hideError: () => void;
  registerRefreshHandler: (handler: () => Promise<void> | void) => () => void;
}

const ErrorDialogContext = createContext<ErrorDialogContextValue | null>(null);

export function useErrorDialog() {
  const ctx = useContext(ErrorDialogContext);
  if (!ctx) {
    throw new Error("useErrorDialog must be used within an ErrorDialogProvider");
  }
  return ctx;
}

export function ErrorDialogProvider({ children }: { children: React.ReactNode }) {
  const [dialogState, setDialogState] = useState<ErrorDialogState>({
    isOpen: false,
    title: "Ralat",
    message: "",
    isDeployMismatch: false,
  });

  const refreshHandlersRef = useRef<Set<() => Promise<void> | void>>(new Set());

  const registerRefreshHandler = useCallback((handler: () => Promise<void> | void) => {
    refreshHandlersRef.current.add(handler);
    return () => {
      refreshHandlersRef.current.delete(handler);
    };
  }, []);

  const showError = useCallback(
    (err: unknown, options?: { title?: string; onDismiss?: () => void }) => {
      // Log full technical trace in developer console for diagnosis
      console.error("[TicketLink Error Interceptor]", err);

      const { message, isDeployMismatch } = sanitizeErrorMessage(err);
      setDialogState({
        isOpen: true,
        title: options?.title || (isDeployMismatch ? "Versi Baharu Tersedia" : "Ralat"),
        message,
        isDeployMismatch,
        onDismiss: options?.onDismiss,
      });
    },
    []
  );

  const hideError = useCallback(() => {
    setDialogState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const handleDismiss = useCallback(async () => {
    const callback = dialogState.onDismiss;
    hideError();

    // Trigger registered background refresh handlers (syncFETickets / refreshData)
    // so the client immediately realigns with authoritative server state.
    if (callback) {
      try {
        await callback();
      } catch (e) {
        console.warn("[ErrorDialog] onDismiss callback error:", e);
      }
    }

    for (const handler of Array.from(refreshHandlersRef.current)) {
      try {
        await handler();
      } catch (e) {
        console.warn("[ErrorDialog] Background refresh error:", e);
      }
    }
  }, [dialogState.onDismiss, hideError]);

  const handleReload = useCallback(() => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }, []);

  return (
    <ErrorDialogContext.Provider value={{ showError, hideError, registerRefreshHandler }}>
      {children}

      {/* Global Center Modal ErrorDialog */}
      {dialogState.isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="error-dialog-title"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div
            className="w-full max-w-sm sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 text-left select-none overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header / Icon */}
            <div className="flex items-start gap-3.5">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 text-xl font-bold ${
                  dialogState.isDeployMismatch
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 ring-4 ring-blue-500/10"
                    : "bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 ring-4 ring-rose-500/10"
                }`}
              >
                {dialogState.isDeployMismatch ? "🔄" : "⚠️"}
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <h3
                  id="error-dialog-title"
                  className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight"
                >
                  {dialogState.title}
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed break-words whitespace-pre-wrap">
                  {dialogState.message}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center gap-2.5 w-full">
              {dialogState.isDeployMismatch ? (
                <button
                  type="button"
                  onClick={handleReload}
                  className="w-full min-h-[44px] py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-sm active:scale-98 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>🔄</span>
                  <span>Muat Semula</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="flex-1 min-h-[44px] py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 active:scale-98 transition flex items-center justify-center cursor-pointer"
                  >
                    OK
                  </button>
                  <button
                    type="button"
                    onClick={handleReload}
                    className="flex-1 min-h-[44px] py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm text-slate-900 dark:text-white bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 active:scale-98 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>🔄</span>
                    <span>Muat Semula</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </ErrorDialogContext.Provider>
  );
}
