"use client";

import React, { useState, useEffect } from "react";
import { isWeekendDay, getWeekendType } from "@/lib/sla";

interface SlaCountdownProps {
  slaDeadline: Date | string | null;
  status: string;
  severity?: string | null;
  state?: string | null;
  resolvedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  slaPaused?: boolean;
  slaPausedAt?: Date | string | null;
  lang?: "en" | "ms";
  hidePrefix?: boolean;
}

export default function SlaCountdown({
  slaDeadline,
  status,
  severity,
  state,
  resolvedAt,
  updatedAt,
  slaPaused = false,
  slaPausedAt,
  lang = "en",
  hidePrefix = false,
}: SlaCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isBreached, setIsBreached] = useState<boolean>(false);
  const [isNearBreach, setIsNearBreach] = useState<boolean>(false);
  const [isWeekendPaused, setIsWeekendPaused] = useState<boolean>(false);

  useEffect(() => {
    if (!slaDeadline || (severity && severity === "NA")) {
      setTimeLeft("");
      return;
    }

    const deadline = new Date(slaDeadline);
    const isCompleted =
      status === "RESOLVED" || status === "COMPLETE" || status === "CLOSED";

    // If already resolved/completed/closed, it's static
    if (isCompleted) {
      const resolvedTime = resolvedAt
        ? new Date(resolvedAt)
        : updatedAt
        ? new Date(updatedAt)
        : new Date();
      const met = resolvedTime.getTime() <= deadline.getTime();
      setIsBreached(!met);
      setIsNearBreach(false);
      setIsWeekendPaused(false);
      setTimeLeft(
        met
          ? lang === "ms" ? "SLA Dipatuhi" : "SLA Met"
          : lang === "ms" ? "SLA Terlanggar" : "SLA Breached"
      );
      return;
    }

    // If SLA is paused manually (e.g. ON_HOLD / FOLLOW_UP), freeze the countdown
    if (slaPaused) {
      const pausedTime = slaPausedAt ? new Date(slaPausedAt) : new Date();
      const diffMs = deadline.getTime() - pausedTime.getTime();
      setIsWeekendPaused(false);
      if (diffMs < 0) {
        setIsBreached(true);
        setIsNearBreach(false);
        setTimeLeft(lang === "ms" ? "SLA Terlanggar (Dijeda)" : "SLA Breached (Paused)");
      } else {
        setIsBreached(false);
        const totalSecs = Math.floor(diffMs / 1000);
        const hours = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        setIsNearBreach(hours < 2);
        setTimeLeft(
          lang === "ms"
            ? `Dijeda: ${hours}j ${String(mins).padStart(2, "0")}m berbaki`
            : `Paused: ${hours}h ${String(mins).padStart(2, "0")}m remaining`
        );
      }
      return;
    }

    // Dynamic ticking function
    const tick = () => {
      const now = new Date();
      const isRestDay = state ? isWeekendDay(now, state) : false;
      const weekendType = state ? getWeekendType(state) : "SAT_SUN";
      const weekendLabel = weekendType === "FRI_SAT" ? (lang === "ms" ? "Jum-Sab" : "Fri-Sat") : (lang === "ms" ? "Sab-Ahad" : "Sat-Sun");

      if (isRestDay) {
        const diffMs = deadline.getTime() - now.getTime();
        setIsBreached(diffMs < 0);
        setIsNearBreach(false);
        setIsWeekendPaused(true);
        setTimeLeft(lang === "ms" ? `Hujung Minggu Dijeda (${weekendLabel})` : `Weekend Paused (${weekendLabel})`);
        return;
      }

      setIsWeekendPaused(false);
      const diffMs = deadline.getTime() - now.getTime();

      if (diffMs < 0) {
        setIsBreached(true);
        setIsNearBreach(false);
        setTimeLeft(lang === "ms" ? "SLA Terlanggar" : "SLA Breached");
      } else {
        setIsBreached(false);
        const totalSecs = Math.floor(diffMs / 1000);
        const hours = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        const secs = totalSecs % 60;

        setIsNearBreach(hours < 2);
        setTimeLeft(
          lang === "ms"
            ? `${hours}j ${String(mins).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`
            : `${hours}h ${String(mins).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`
        );
      }
    };

    // Run immediately and set up 1s interval
    tick();
    const interval = setInterval(tick, 1000);

    return () => clearInterval(interval);
  }, [slaDeadline, status, severity, state, resolvedAt, updatedAt, slaPaused, slaPausedAt, lang]);

  if (!slaDeadline || (severity && severity === "NA")) return null;

  // Render static completed state
  const isCompleted =
    status === "RESOLVED" || status === "COMPLETE" || status === "CLOSED";

  if (isCompleted) {
    if (!isBreached) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          {lang === "ms" ? "SLA Dipatuhi" : "SLA Met"}
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase font-mono bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
          {lang === "ms" ? "SLA Terlanggar" : "SLA Breached"}
        </span>
      );
    }
  }

  // Render manual paused state
  if (slaPaused) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
        ⏸️ {timeLeft}
      </span>
    );
  }

  // Render state-specific weekend paused state
  if (isWeekendPaused) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase font-mono bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30">
        ⏸️ {timeLeft}
      </span>
    );
  }

  // Active counting state styles
  if (isBreached) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase font-mono bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 animate-glow-red">
        {lang === "ms" ? "SLA Terlanggar" : "SLA Breached"}
      </span>
    );
  }

  const prefix = hidePrefix ? "" : "SLA: ";

  if (isNearBreach) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse-soft">
        {prefix}{timeLeft}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase font-mono bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
      {prefix}{timeLeft}
    </span>
  );
}

