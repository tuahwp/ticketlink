export type SeverityType = "P1" | "P2" | "P3" | "P4" | "NA";

export interface SlaRuleLike {
  customer: string;
  severity: string;
  region: string;
  slaHours: number;
}

/**
 * Returns the region for a given state name.
 * States:
 * - Sabah, Sarawak, Labuan -> "Sabah/Sarawak"
 * - All other Malaysia states -> "Semenanjung"
 */
export function getRegionFromState(stateName: string): "Semenanjung" | "Sabah/Sarawak" {
  if (!stateName) return "Semenanjung";
  const eastMalaysiaStates = ["Sabah", "Sarawak", "Labuan"];
  const isEast = eastMalaysiaStates.some(
    s => s.toLowerCase() === stateName.trim().toLowerCase()
  );
  return isEast ? "Sabah/Sarawak" : "Semenanjung";
}

/**
 * Malaysian State Weekend Grouping:
 * - FRI_SAT (Friday & Saturday): Kedah, Kelantan, Terengganu
 * - SAT_SUN (Saturday & Sunday): Johor, Selangor, Kuala Lumpur, Putrajaya, Penang, Perak, Pahang, Negeri Sembilan, Melaka, Perlis, Sabah, Sarawak, Labuan
 */
export function getWeekendType(stateName: string): "FRI_SAT" | "SAT_SUN" {
  if (!stateName) return "SAT_SUN";
  const friSatStates = ["Kedah", "Kelantan", "Terengganu"];
  const isFriSat = friSatStates.some(
    s => s.toLowerCase() === stateName.trim().toLowerCase()
  );
  return isFriSat ? "FRI_SAT" : "SAT_SUN";
}

/**
 * Checks if a given Date is a rest day (weekend) for a specific state.
 * JavaScript getDay(): 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
 */
export function isWeekendDay(date: Date, stateName: string): boolean {
  if (!date || isNaN(date.getTime())) return false;
  const day = date.getDay();
  const weekendType = getWeekendType(stateName);
  if (weekendType === "FRI_SAT") {
    // Friday (5) and Saturday (6)
    return day === 5 || day === 6;
  } else {
    // Saturday (6) and Sunday (0)
    return day === 6 || day === 0;
  }
}

/**
 * Fallback SLA hours if no rule is found in the database.
 */
export function getFallbackSlaHours(severity: SeverityType, region: "Semenanjung" | "Sabah/Sarawak"): number {
  if (severity === "NA") return 0;
  if (region === "Sabah/Sarawak") {
    switch (severity) {
      case "P1": return 72;
      case "P2": return 96;
      case "P3": return 120;
      case "P4": return 168;
      default: return 72;
    }
  } else {
    // Semenanjung
    switch (severity) {
      case "P1": return 24;
      case "P2": return 48;
      case "P3": return 72;
      case "P4": return 120;
      default: return 24;
    }
  }
}

/**
 * Calculate the SLA deadline based on:
 * 1. reportedAt (reported time)
 * 2. state (determining Semenanjung vs Sabah/Sarawak AND Friday/Saturday vs Saturday/Sunday rest days)
 * 3. endCustomer (specific custom SLA if any)
 * 4. severity (P1-P4, or NA for no SLA)
 * 5. list of active SLA rules in the system
 * 
 * Automatically pauses and skips rest days based on state.
 */
export function calculateSlaDeadline(
  reportedAt: Date | string,
  stateName: string,
  endCustomer: string | null | undefined,
  severity: SeverityType | null | undefined,
  slaRules: SlaRuleLike[]
): Date | null {
  if (!severity || severity === "NA") return null;
  
  const start = new Date(reportedAt);
  if (isNaN(start.getTime())) return null;

  const region = getRegionFromState(stateName);
  
  // 1. Look for custom rule matching endCustomer
  let hours: number | null = null;
  if (endCustomer) {
    const customRule = slaRules.find(
      r =>
        r.customer.toLowerCase() === endCustomer.trim().toLowerCase() &&
        r.severity === severity &&
        r.region === region
    );
    if (customRule) {
      hours = customRule.slaHours;
    }
  }

  // 2. Look for DEFAULT fallback rule
  if (hours === null) {
    const defaultRule = slaRules.find(
      r =>
        r.customer === "DEFAULT" &&
        r.severity === severity &&
        r.region === region
    );
    if (defaultRule) {
      hours = defaultRule.slaHours;
    }
  }

  // 3. Fallback to hardcoded defaults
  if (hours === null) {
    hours = getFallbackSlaHours(severity, region);
  }

  if (hours <= 0) return null;

  // Step forward hour-by-hour, pausing/skipping state-specific rest days
  let remainingHours = hours;
  const current = new Date(start.getTime());

  // If reported on a rest day, push to the end of the rest period before consuming SLA hours
  while (isWeekendDay(current, stateName)) {
    current.setHours(current.getHours() + 1);
  }

  while (remainingHours > 0) {
    current.setHours(current.getHours() + 1);
    if (!isWeekendDay(current, stateName)) {
      remainingHours -= 1;
    }
  }

  return current;
}
