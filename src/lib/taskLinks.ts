import type { Json } from "@/integrations/supabase/types";

type JsonRecord = Record<string, unknown>;

export type ResolvedTaskLink = {
  url: string | null;
  isInternal: boolean;
  reason?: string;
};

const PLACEHOLDER_URLS = new Set([
  "#",
  "about:blank",
  "null",
  "undefined",
  "tbd",
  "coming-soon",
  "coming soon",
  "placeholder",
  "n/a",
  "none",
]);

const DISALLOWED_SCHEMES = [
  "javascript:",
  "data:",
  "about:",
  "file:",
  "mailto:",
  "tel:",
  "chrome:",
  "chrome-extension:",
];

function asRecord(value: Json | null | undefined): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function isDisallowedUrl(value: string): boolean {
  const lowered = value.toLowerCase();
  if (PLACEHOLDER_URLS.has(lowered)) return true;
  return DISALLOWED_SCHEMES.some((scheme) => lowered.startsWith(scheme));
}

function hasScheme(value: string): boolean {
  return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value);
}

function normalizeCandidate(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("www.")) return `https://${trimmed}`;
  if (!hasScheme(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

export function normalizeAdminTaskUrlInput(raw: string | null | undefined): { url: string | null; error?: string } {
  const value = String(raw || "").trim();
  if (!value) return { url: null };
  if (value.startsWith("/")) {
    return { url: null, error: "Internal paths are not allowed. Use a full https:// URL." };
  }
  if (isDisallowedUrl(value)) {
    return { url: null, error: "Placeholder or unsafe URL is not allowed." };
  }

  const candidate = normalizeCandidate(value);
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:") {
      return { url: null, error: "Only https:// links are allowed." };
    }
    if (!parsed.hostname) {
      return { url: null, error: "Invalid URL host." };
    }
    return { url: parsed.toString() };
  } catch {
    return { url: null, error: "Invalid URL format." };
  }
}

export function resolveTaskDestinationUrl(raw: string | null | undefined): ResolvedTaskLink {
  const value = String(raw || "").trim();
  if (!value) return { url: null, isInternal: false, reason: "missing" };

  if (value.startsWith("/")) {
    return { url: value, isInternal: true };
  }

  if (isDisallowedUrl(value)) {
    return { url: null, isInternal: false, reason: "invalid" };
  }

  const candidate = normalizeCandidate(value);
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === "http:") {
      parsed.protocol = "https:";
    }
    if (parsed.protocol !== "https:") {
      return { url: null, isInternal: false, reason: "invalid" };
    }

    if (typeof window !== "undefined" && parsed.origin === window.location.origin) {
      const internalUrl = `${parsed.pathname}${parsed.search}${parsed.hash}` || "/";
      return { url: internalUrl, isInternal: true };
    }

    return { url: parsed.toString(), isInternal: false };
  } catch {
    return { url: null, isInternal: false, reason: "invalid" };
  }
}

export function resolveTaskLinkFromFields(input: {
  target_url?: string | null;
  video_url?: string | null;
  requirements?: Json | null;
}): ResolvedTaskLink {
  const requirements = asRecord(input.requirements);
  const candidates = [
    input.target_url,
    input.video_url,
    typeof requirements?.link === "string" ? requirements.link : null,
    typeof requirements?.url === "string" ? requirements.url : null,
    typeof requirements?.target_url === "string" ? requirements.target_url : null,
    typeof requirements?.video_url === "string" ? requirements.video_url : null,
  ];

  for (const candidate of candidates) {
    const resolved = resolveTaskDestinationUrl(candidate);
    if (resolved.url) return resolved;
  }

  const hadCandidate = candidates.some((item) => String(item || "").trim().length > 0);
  return { url: null, isInternal: false, reason: hadCandidate ? "invalid" : "missing" };
}
