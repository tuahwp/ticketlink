"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Volume2,
  VolumeX,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Trash2,
  X,
  CheckCheck,
} from "lucide-react";
import { useAuth } from "./AuthProvider";
import { getTickets } from "../actions";

interface NotificationItem {
  id: string;
  ticketId: number;
  ticketRefNo: string;
  siteName: string;
  type: "UNASSIGNED_FE" | "NEW_TICKET" | "SLA_ALERT";
  title: string;
  description: string;
  createdAt: string | Date;
  isRead: boolean;
}

interface NotificationCenterProps {
  tickets?: any[];
}

export default function NotificationCenter({ tickets: propTickets }: NotificationCenterProps = {}) {
  const router = useRouter();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const prevTicketCountRef = useRef<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initialize sound settings, read IDs & dismissed IDs from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedSound = localStorage.getItem("ticketlink_sound_enabled");
      if (savedSound !== null) {
        setSoundEnabled(savedSound === "true");
      }
      try {
        const savedReads = localStorage.getItem("ticketlink_read_notifications");
        if (savedReads) {
          setReadIds(new Set(JSON.parse(savedReads)));
        }
      } catch (e) {
        console.warn("Failed to parse read notifications from storage:", e);
      }
      try {
        const savedDismissed = localStorage.getItem("ticketlink_dismissed_notifications");
        if (savedDismissed) {
          setDismissedIds(new Set(JSON.parse(savedDismissed)));
        }
      } catch (e) {
        console.warn("Failed to parse dismissed notifications from storage:", e);
      }
    }
  }, []);

  // Web Audio API Dual-Tone Crystal Chime Generator
  const playChime = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Note 1: E5 (659.25 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.18, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Note 2: B5 (987.77 Hz) - Crisp high sparkle
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(987.77, now + 0.08);
      gain2.gain.setValueAtTime(0, now + 0.08);
      gain2.gain.linearRampToValueAtTime(0.22, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.55);
    } catch (err) {
      console.warn("Audio playback not allowed yet until first user interaction:", err);
    }
  }, [soundEnabled]);

  const toggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem("ticketlink_sound_enabled", String(next));
    if (next) {
      setTimeout(() => playChime(), 50);
    }
  };

  // Compute alert notifications from a tickets list
  const computeAlerts = useCallback((allTickets: any[]) => {
    if (!user || !Array.isArray(allTickets)) return;

    const items: NotificationItem[] = [];

    // 1. Unassigned FE Tickets (Agent & Superadmin)
    allTickets.forEach((t) => {
      const isAgentForTicket =
        user.role === "SUPERADMIN" || (user.role === "AGENT" && user.partnerId === t.partnerId);
      const alertId = `unassigned-fe-${t.id}`;
      if (
        isAgentForTicket &&
        t.partnerId &&
        !t.assignedFeId &&
        t.status !== "CLOSED" &&
        t.status !== "RESOLVED" &&
        !dismissedIds.has(alertId)
      ) {
        items.push({
          id: alertId,
          ticketId: t.id,
          ticketRefNo: t.ticketRefNo || `#${t.id}`,
          siteName: t.clientSiteName,
          type: "UNASSIGNED_FE",
          title: "FE Assignment Pending",
          description: `Ticket #${t.ticketRefNo || t.id} at ${t.clientSiteName} has no Field Engineer assigned yet.`,
          createdAt: t.createdAt || new Date(),
          isRead: readIds.has(alertId),
        });
      }
    });

    // 2. Recent Active Tickets (last 8)
    allTickets.slice(0, 8).forEach((t) => {
      const alertId = `ticket-active-${t.id}`;
      if (!dismissedIds.has(alertId)) {
        items.push({
          id: alertId,
          ticketId: t.id,
          ticketRefNo: t.ticketRefNo || `#${t.id}`,
          siteName: t.clientSiteName,
          type: "NEW_TICKET",
          title: `Ticket ${t.status}`,
          description: `${t.clientSiteName} (${t.state}) - ${t.severity || "Standard"} Priority`,
          createdAt: t.createdAt || new Date(),
          isRead: readIds.has(alertId),
        });
      }
    });

    // Check if new tickets arrived to trigger chime
    if (prevTicketCountRef.current !== null && allTickets.length > prevTicketCountRef.current) {
      playChime();
    }
    prevTicketCountRef.current = allTickets.length;

    setNotifications(items);
  }, [user, readIds, dismissedIds, playChime]);

  // If tickets are passed via props from Dashboard, react directly without background polling
  useEffect(() => {
    if (propTickets) {
      computeAlerts(propTickets);
    }
  }, [propTickets, computeAlerts]);

  // Periodic fallback polling only if propTickets is not supplied
  useEffect(() => {
    if (propTickets) return;
    if (!user) return;

    const poll = async () => {
      try {
        const allTickets = await getTickets();
        if (Array.isArray(allTickets)) {
          computeAlerts(allTickets);
        }
      } catch {
        // Silently ignore transient aborted requests
      }
    };

    poll();
    const interval = setInterval(poll, 15000);
    return () => clearInterval(interval);
  }, [propTickets, user, computeAlerts]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const markAllRead = () => {
    const newSet = new Set(readIds);
    notifications.forEach((n) => newSet.add(n.id));
    setReadIds(newSet);
    try {
      localStorage.setItem("ticketlink_read_notifications", JSON.stringify(Array.from(newSet)));
    } catch (e) {
      console.warn("Storage save failed:", e);
    }
  };

  const clearAllNotifications = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newDismissed = new Set(dismissedIds);
    notifications.forEach((n) => newDismissed.add(n.id));
    setDismissedIds(newDismissed);
    setNotifications([]);
    try {
      localStorage.setItem(
        "ticketlink_dismissed_notifications",
        JSON.stringify(Array.from(newDismissed))
      );
    } catch (err) {
      console.warn("Storage save failed:", err);
    }
  };

  const dismissSingle = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newDismissed = new Set(dismissedIds);
    newDismissed.add(id);
    setDismissedIds(newDismissed);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      localStorage.setItem(
        "ticketlink_dismissed_notifications",
        JSON.stringify(Array.from(newDismissed))
      );
    } catch (err) {
      console.warn("Storage save failed:", err);
    }
  };

  const handleNotificationClick = (item: NotificationItem) => {
    const newSet = new Set(readIds);
    newSet.add(item.id);
    setReadIds(newSet);
    try {
      localStorage.setItem("ticketlink_read_notifications", JSON.stringify(Array.from(newSet)));
    } catch (e) {
      console.warn("Storage save failed:", e);
    }
    setIsOpen(false);
    // Navigate directly to the ticket page /tickets/{id}
    router.push(`/tickets/${item.ticketId}`);
  };

  const unassignedCount = notifications.filter((n) => n.type === "UNASSIGNED_FE" && !n.isRead).length;
  const totalUnread = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-muted-text hover:text-foreground hover:bg-muted/80 transition-all focus:outline-none border border-transparent hover:border-card-border"
        title="Notifications & Alerts"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 transition-transform duration-200 hover:rotate-12" />

        {/* Pulsing indicator for urgent unassigned tickets */}
        {unassignedCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
          </span>
        )}

        {/* Unread badge count */}
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 px-1.5 py-0.2 min-w-[18px] h-[18px] bg-indigo-600 text-white font-bold text-[10px] rounded-full flex items-center justify-center shadow-md">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </button>

      {/* Dropdown Drawer */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-card border border-card-border rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-3.5 border-b border-card-border flex items-center justify-between bg-card/80 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-foreground">Alerts & Notifications</span>
              {totalUnread > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-extrabold bg-indigo-500/10 text-indigo-600 dark:text-cyan-400 rounded-md border border-indigo-500/20">
                  {totalUnread} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {/* Sound Mute/Unmute toggle */}
              <button
                type="button"
                onClick={toggleSound}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                  soundEnabled
                    ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
                    : "text-muted-text bg-muted/60 hover:bg-muted"
                }`}
                title={soundEnabled ? "Sound Alerts: ON" : "Sound Alerts: MUTED"}
              >
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                <span className="text-[10px] hidden sm:inline">{soundEnabled ? "Sound ON" : "Muted"}</span>
              </button>

              {totalUnread > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-[11px] text-muted-text hover:text-foreground font-semibold px-2 py-1 rounded-lg hover:bg-muted/60 transition-all flex items-center gap-1"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Mark read</span>
                </button>
              )}

              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={clearAllNotifications}
                  className="text-[11px] text-rose-500 hover:text-rose-600 dark:text-rose-400 font-semibold px-2 py-1 rounded-lg hover:bg-rose-500/10 transition-all flex items-center gap-1"
                  title="Clear all notifications"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clear</span>
                </button>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="max-h-80 overflow-y-auto divide-y divide-card-border/50">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-muted-text">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-muted-text/60" />
                <p className="text-xs font-medium">All caught up! No active notifications.</p>
              </div>
            ) : (
              notifications.map((item) => {
                const isUnassigned = item.type === "UNASSIGNED_FE";
                return (
                  <div
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    className={`group relative p-3.5 transition-colors cursor-pointer flex items-start gap-3 hover:bg-muted/50 ${
                      !item.isRead ? (isUnassigned ? "bg-amber-500/5" : "bg-primary/5") : ""
                    }`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {isUnassigned ? (
                        <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/30">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-cyan-400 flex items-center justify-center border border-indigo-500/30">
                          <Clock className="w-4 h-4" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span
                          className={`text-xs font-bold truncate ${
                            isUnassigned ? "text-amber-600 dark:text-amber-400" : "text-foreground"
                          }`}
                        >
                          {item.title}
                        </span>
                        <span className="text-[10px] font-mono text-muted-text flex-shrink-0">
                          {item.ticketRefNo}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-text line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                      <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-text/80 font-medium">
                        <span className="truncate max-w-[160px]">{item.siteName}</span>
                        <span className="inline-flex items-center gap-0.5 text-primary font-semibold hover:underline">
                          Open Ticket <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                        </span>
                      </div>
                    </div>

                    {/* Single notification dismiss X button */}
                    <button
                      type="button"
                      onClick={(e) => dismissSingle(e, item.id)}
                      className="absolute top-3 right-2.5 p-1 rounded-md text-muted-text/60 hover:text-rose-500 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all"
                      title="Dismiss notification"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>

                    {!item.isRead && (
                      <span
                        className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                          isUnassigned ? "bg-amber-500" : "bg-indigo-600"
                        }`}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 border-t border-card-border bg-card/60 text-center">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                router.push("/");
              }}
              className="text-[11px] font-bold text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1"
            >
              View all tickets in queue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
