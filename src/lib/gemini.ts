import { db } from "./db";

export interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string; // base64 without header
  };
}

export interface GeminiContent {
  role?: "user" | "model" | "system";
  parts: GeminiPart[];
}

export async function getActiveAiConfig() {
  try {
    const config = await db.aiConfig.findFirst({
      orderBy: { id: "desc" },
    });
    return config;
  } catch (err) {
    console.error("Failed to load AI config from database:", err);
    return null;
  }
}

export function sanitizeGeminiModel(inputModel?: string | null): string {
  if (!inputModel) return "gemini-3.8-flash";
  const trimmed = inputModel.trim();
  const deprecatedPrefixes = ["gemini-2.0", "gemini-1.5", "gemini-1.0", "gemini-2.5-computer-use"];
  if (deprecatedPrefixes.some((p) => trimmed.startsWith(p))) {
    return "gemini-3.8-flash";
  }
  return trimmed;
}

export async function callGeminiRaw({
  apiKey,
  model = "gemini-3.8-flash",
  contents,
  systemInstruction,
  temperature = 0.3,
}: {
  apiKey: string;
  model?: string;
  contents: GeminiContent[];
  systemInstruction?: string;
  temperature?: number;
}) {
  const activeModel = sanitizeGeminiModel(model);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(activeModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const bodyPayload: Record<string, any> = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: 2500,
    },
  };

  if (systemInstruction) {
    bodyPayload.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bodyPayload),
  });

  if (!res.ok) {
    const errText = await res.text();
    let errorDetail = errText;
    try {
      const parsed = JSON.parse(errText);
      if (parsed.error?.message) {
        errorDetail = parsed.error.message;
      }
    } catch {
      // use raw text
    }
    throw new Error(`Google Gemini API Error (${res.status}): ${errorDetail}`);
  }

  const json = await res.json();
  const candidate = json.candidates?.[0];
  const responseText = candidate?.content?.parts?.map((p: any) => p.text || "").join("") || "";

  return {
    text: responseText,
    finishReason: candidate?.finishReason,
    usage: json.usageMetadata,
  };
}
