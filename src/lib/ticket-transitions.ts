/**
 * Ticket Transition Matrix & Field Engineer Lifecycle Engine
 *
 * Single Source of Truth for lifecycle transitions across UI (Classic FE Dashboard,
 * FE v2 Dashboard, and Ticket Details) and Server Actions (actions.ts).
 *
 * Reference: ADR 0026 & Concurrency / Lockout Rules in CONTEXT.md
 */

export interface FeTransitionCandidate {
  id: number;
  ticketRefNo?: string | null;
  status?: string | null;
  subStatus?: string | null;
  feAcknowledgeStatus?: string | null;
  eta?: Date | string | null;
  activities?: Array<{ subStatus?: string | null }> | null;
  [key: string]: any;
}

export type TicketStage =
  | "NEW"
  | "ACCEPTED"
  | "ENROUTE"
  | "CHECKED_IN"
  | "ON_HOLD"
  | "RESOLVED";

export type TicketActionType =
  | "ACCEPT"
  | "SET_ETA"
  | "UPDATE_ETA"
  | "CHECK_IN"
  | "RESOLVE"
  | "FOLLOW_UP"
  | "RESUME"
  | "NONE";

export interface TicketActionDef {
  type: TicketActionType;
  label: string;
  isPrimary: boolean;
  disabled?: boolean;
}

export interface TicketStageInfo {
  stage: TicketStage;
  label: string;
  color: string;
  ctaText: string;
  ctaDisabled: boolean;
  primaryAction: TicketActionDef;
  secondaryAction?: TicketActionDef | null;
  canResolve: boolean;
  canCheckIn: boolean;
  canSetEta: boolean;
  canAccept: boolean;
  canResume: boolean;
}

export interface TransitionValidationResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Checks if a ticket has genuinely undergone a check-in event.
 * Avoids false positives from legacy IN_PROGRESS statuses.
 */
export function hasTicketCheckedIn(ticket: FeTransitionCandidate): boolean {
  if (!ticket) return false;
  const sub = ticket.subStatus?.toUpperCase();
  if (sub === "CHECKED_IN") return true;

  if (Array.isArray(ticket.activities)) {
    return ticket.activities.some(
      (a) => a?.subStatus?.toUpperCase() === "CHECKED_IN"
    );
  }

  return false;
}

/**
 * Evaluates the authoritative lifecycle stage and available CTAs for a ticket.
 */
export function getTicketStageInfo(ticket: FeTransitionCandidate): TicketStageInfo {
  const stat = ticket?.status?.toUpperCase() || "";
  const sub = ticket?.subStatus?.toUpperCase() || "";
  const ack = ticket?.feAcknowledgeStatus?.toUpperCase() || "";

  // 1. RESOLVED / CLOSED / COMPLETE
  if (stat === "RESOLVED" || stat === "CLOSED" || stat === "COMPLETE") {
    return {
      stage: "RESOLVED",
      label: "Selesai",
      color: "text-emerald-600 bg-emerald-50 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800",
      ctaText: "TIKET SELESAI",
      ctaDisabled: true,
      primaryAction: {
        type: "NONE",
        label: "Tiket Selesai",
        isPrimary: true,
        disabled: true,
      },
      secondaryAction: null,
      canResolve: false,
      canCheckIn: false,
      canSetEta: false,
      canAccept: false,
      canResume: false,
    };
  }

  // 2. FOLLOW_UP / ON_HOLD
  if (stat === "FOLLOW_UP" || stat === "ON_HOLD") {
    return {
      stage: "ON_HOLD",
      label: stat === "FOLLOW_UP" ? "Susulan Tapak" : "Ditangguhkan",
      color: "text-amber-600 bg-amber-50 border-amber-300 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800",
      ctaText: "SAMBUNG SEMULA",
      ctaDisabled: false,
      primaryAction: {
        type: "RESUME",
        label: "Sambung Semula",
        isPrimary: true,
      },
      secondaryAction: null,
      canResolve: false,
      canCheckIn: false,
      canSetEta: false,
      canAccept: false,
      canResume: true,
    };
  }

  // 3. CHECKED_IN (Strict on-site check)
  const isCheckedIn = hasTicketCheckedIn(ticket);
  if (isCheckedIn) {
    return {
      stage: "CHECKED_IN",
      label: "Sedang Berlangsung",
      color: "text-blue-600 bg-blue-50 border-blue-300 dark:bg-blue-950/60 dark:text-blue-400 dark:border-blue-800",
      ctaText: "SELESAIKAN & DAFTAR KELUAR (RESOLVE)",
      ctaDisabled: false,
      primaryAction: {
        type: "RESOLVE",
        label: "Selesaikan & Daftar Keluar (Resolve)",
        isPrimary: true,
      },
      secondaryAction: {
        type: "FOLLOW_UP",
        label: "Susulan & Permintaan Alat Ganti",
        isPrimary: false,
      },
      canResolve: true,
      canCheckIn: false,
      canSetEta: false,
      canAccept: false,
      canResume: false,
    };
  }

  // 4. ENROUTE (ETA set or ENROUTE substatus, but not checked in)
  const isEnroute =
    sub === "ENROUTE" ||
    Boolean(ticket?.eta && (ack === "ACKNOWLEDGED" || stat === "IN_PROGRESS"));
  if (isEnroute) {
    let etaFormatted = "";
    if (ticket?.eta) {
      try {
        const d = new Date(ticket.eta);
        if (!isNaN(d.getTime())) {
          etaFormatted = ` (ETA ${d.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })})`;
        }
      } catch {
        // ignore date formatting error
      }
    }
    return {
      stage: "ENROUTE",
      label: `Dalam Perjalanan${etaFormatted}`,
      color: "text-indigo-600 bg-indigo-50 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-400 dark:border-indigo-800",
      ctaText: "DAFTAR MASUK TAPAK (CHECK-IN)",
      ctaDisabled: false,
      primaryAction: {
        type: "CHECK_IN",
        label: "Daftar Masuk Tapak (Check-In)",
        isPrimary: true,
      },
      secondaryAction: {
        type: "UPDATE_ETA",
        label: "Kemas Kini ETA",
        isPrimary: false,
      },
      canResolve: false,
      canCheckIn: true,
      canSetEta: true,
      canAccept: false,
      canResume: false,
    };
  }

  // 5. ACCEPTED (Acknowledged, or IN_PROGRESS from DB without check-in)
  // Handles existing tickets in IN_PROGRESS + ACKNOWLEDGED safely
  const isAccepted =
    ack === "ACKNOWLEDGED" ||
    sub === "FE_ACK" ||
    sub === "ACCEPTED" ||
    stat === "IN_PROGRESS";
  if (isAccepted) {
    return {
      stage: "ACCEPTED",
      label: "Pesanan Diterima",
      color: "text-sky-600 bg-sky-50 border-sky-300 dark:bg-sky-950/60 dark:text-sky-400 dark:border-sky-800",
      ctaText: "DAFTAR MASUK TAPAK (CHECK-IN)",
      ctaDisabled: false,
      primaryAction: {
        type: "CHECK_IN",
        label: "Daftar Masuk Tapak (Check-In)",
        isPrimary: true,
      },
      secondaryAction: {
        type: "SET_ETA",
        label: "Gerak ke Tapak (Set ETA)",
        isPrimary: false,
      },
      canResolve: false,
      canCheckIn: true,
      canSetEta: true,
      canAccept: false,
      canResume: false,
    };
  }

  // 6. NEW (Unaccepted dispatched order)
  return {
    stage: "NEW",
    label: "Tindakan: Terima Pesanan",
    color: "text-amber-600 bg-amber-50 border-amber-300 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800",
    ctaText: "TERIMA PESANAN",
    ctaDisabled: false,
    primaryAction: {
      type: "ACCEPT",
      label: "Terima Pesanan",
      isPrimary: true,
    },
    secondaryAction: null,
    canResolve: false,
    canCheckIn: false,
    canSetEta: false,
    canAccept: true,
    canResume: false,
  };
}

/**
 * Returns the single next recommended action for an engineer.
 */
export function getNextAction(ticket: FeTransitionCandidate): TicketActionDef {
  return getTicketStageInfo(ticket).primaryAction;
}

/**
 * Validates whether a state transition or action is permissible.
 * SUPERADMIN and MODERATOR bypass operational FE constraints.
 */
export function validateFeTransition(
  ticket: FeTransitionCandidate,
  targetAction: "RESOLVE" | "CHECK_IN" | "ENROUTE" | "ACCEPT",
  userRole?: string
): TransitionValidationResult {
  const isSuperOrMod = userRole === "SUPERADMIN" || userRole === "MODERATOR";
  if (isSuperOrMod) {
    return { allowed: true };
  }

  const stat = ticket?.status?.toUpperCase() || "";
  const isDone = stat === "RESOLVED" || stat === "CLOSED" || stat === "COMPLETE";

  if (isDone) {
    return {
      allowed: false,
      reason: "Peralihan tidak sah: Tiket telah selesai atau ditutup dan tidak boleh diubah lagi.",
    };
  }

  const stageInfo = getTicketStageInfo(ticket);

  if (targetAction === "RESOLVE") {
    if (!stageInfo.canResolve) {
      return {
        allowed: false,
        reason:
          "Peralihan tidak sah: Jurutera Lapangan tidak boleh menyelesaikan tiket tanpa mendaftar masuk (check-in) terlebih dahulu.",
      };
    }
  }

  if (targetAction === "CHECK_IN") {
    if (stageInfo.stage === "NEW") {
      return {
        allowed: false,
        reason:
          "Peralihan tidak sah: Pesanan mesti diterima terlebih dahulu sebelum mendaftar masuk ke tapak.",
      };
    }
  }

  if (targetAction === "ENROUTE") {
    if (stageInfo.stage === "NEW") {
      return {
        allowed: false,
        reason:
          "Peralihan tidak sah: Pesanan mesti diterima terlebih dahulu sebelum menetapkan status Enroute/ETA.",
      };
    }
  }

  if (targetAction === "ACCEPT") {
    if (stageInfo.stage !== "NEW") {
      return {
        allowed: false,
        reason: "Peralihan tidak sah: Pesanan ini telah pun diterima sebelum ini.",
      };
    }
  }

  return { allowed: true };
}
