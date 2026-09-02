export interface CustomFieldsSchemaConfig {
  default: string[];
  endCustomers: Record<string, string[]>;
}

/**
 * Parses raw customFieldsSchema (which could be an array of strings in legacy mode,
 * or an object with { default: string[], endCustomers: Record<string, string[]> })
 */
export function parseCustomFieldsSchema(raw: unknown): CustomFieldsSchemaConfig {
  if (!raw) {
    return { default: [], endCustomers: {} };
  }

  let parsed = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { default: [], endCustomers: {} };
    }
  }

  // Legacy format: raw is an array of strings e.g. ["POC", "Site Name"]
  if (Array.isArray(parsed)) {
    return {
      default: parsed.filter((f): f is string => typeof f === "string" && f.trim() !== ""),
      endCustomers: {},
    };
  }

  // Object format
  if (typeof parsed === "object" && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    const defaultFields = Array.isArray(obj.default)
      ? (obj.default.filter((f): f is string => typeof f === "string" && f.trim() !== "") as string[])
      : [];

    const endCustomers: Record<string, string[]> = {};
    if (obj.endCustomers && typeof obj.endCustomers === "object" && !Array.isArray(obj.endCustomers)) {
      for (const [custKey, custFields] of Object.entries(obj.endCustomers as Record<string, unknown>)) {
        if (Array.isArray(custFields)) {
          endCustomers[custKey] = custFields.filter((f): f is string => typeof f === "string" && f.trim() !== "");
        }
      }
    }

    return {
      default: defaultFields,
      endCustomers,
    };
  }

  return { default: [], endCustomers: {} };
}

/**
 * Returns the effective list of custom field names for a selected End-Customer.
 * If the End-Customer has dedicated fields configured, it uses them.
 * If not, it falls back to the Client's default schema.
 */
export function getEffectiveCustomFields(
  rawSchema: unknown,
  endCustomer?: string | null
): string[] {
  const schema = parseCustomFieldsSchema(rawSchema);

  if (endCustomer && schema.endCustomers && schema.endCustomers[endCustomer]) {
    const custFields = schema.endCustomers[endCustomer];
    if (custFields.length > 0) {
      return custFields;
    }
  }

  return schema.default;
}
