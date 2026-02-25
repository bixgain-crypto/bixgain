const DEVICE_ID_KEY = "bg_device_id_v1";

function randomSuffix(length = 12): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let value = "";
  for (let i = 0; i < length; i += 1) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return value;
}

export function normalizeReferralCode(input: string | null | undefined): string {
  return String(input || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function generateReferralCode(userId: string, username?: string | null): string {
  const cleanName = String(username || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
  const cleanId = String(userId || "")
    .replace(/-/g, "")
    .toUpperCase()
    .slice(0, 8);

  const prefix = cleanName.length >= 3 ? cleanName : "BIX";
  return `${prefix}${cleanId}`.slice(0, 14);
}

export function getOrCreateDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing && existing.length >= 12) {
    return existing;
  }

  const generated =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `bg-${Date.now()}-${randomSuffix(8)}`;

  localStorage.setItem(DEVICE_ID_KEY, generated);
  return generated;
}
