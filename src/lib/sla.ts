export type SeverityType = "P1" | "P2" | "P3" | "P4";

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
 * Fallback SLA hours if no rule is found in the database.
 */
export function getFallbackSlaHours(severity: SeverityType, region: "Semenanjung" | "Sabah/Sarawak"): number {
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
 * 2. state (determining Semenanjung vs Sabah/Sarawak)
 * 3. endCustomer (specific custom SLA if any)
 * 4. severity (P1-P4)
 * 5. list of active SLA rules in the system
 */
export function calculateSlaDeadline(
  reportedAt: Date | string,
  stateName: string,
  endCustomer: string | null | undefined,
  severity: SeverityType | null | undefined,
  slaRules: SlaRuleLike[]
): Date | null {
  if (!severity) return null;
  
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

  const deadline = new Date(start.getTime());
  deadline.setHours(deadline.getHours() + hours);
  return deadline;
}
