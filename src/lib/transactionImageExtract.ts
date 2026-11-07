import type { TransactionType } from "../types/fety";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"]);

export type ExtractedTransactionDraft = {
  desc?: string;
  amount?: number;
  dateISO?: string;
  type?: TransactionType;
  category?: string;
  notes?: string;
  confidence: "high" | "medium" | "low";
  uncertainFields: string[];
};

export type TransactionImageExtractResult =
  | { ok: true; draft: ExtractedTransactionDraft }
  | { ok: false; error: string; unavailable?: boolean };

export function validateTransactionImageFile(file: File): string | null {
  if (!ACCEPTED_TYPES.has(file.type) && !file.name.match(/\.(jpe?g|png|webp|heic|heif)$/i)) {
    return "Please choose a JPG, PNG, or HEIC image.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "That image is too large. Please use a file under 8 MB.";
  }
  return null;
}

export async function extractTransactionFromImage(file: File): Promise<TransactionImageExtractResult> {
  const validation = validateTransactionImageFile(file);
  if (validation) return { ok: false, error: validation };

  const imageDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const extractUrl =
    (typeof import.meta !== "undefined" &&
      (import.meta as ImportMeta & { env?: { VITE_TRANSACTION_EXTRACT_URL?: string } }).env
        ?.VITE_TRANSACTION_EXTRACT_URL) ||
    "/api/transaction-extract";

  try {
    const res = await fetch(extractUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageDataUrl, mimeType: file.type }),
    });
    if (res.status === 501) {
      return {
        ok: false,
        unavailable: true,
        error:
          "Picture import is not set up on this device yet. Use Enter Manually, or ask your host to enable the secure picture reader.",
      };
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, error: body?.error ?? "We could not read that image. Try another photo or enter the transaction manually." };
    }
    const data = (await res.json()) as ExtractedTransactionDraft;
    return { ok: true, draft: data };
  } catch {
    return {
      ok: false,
      unavailable: true,
      error: "We could not reach the picture reader. Check your connection or enter the transaction manually.",
    };
  }
}
