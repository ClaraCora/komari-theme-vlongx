export type CardVariant = "A" | "B" | "C";

export const CARD_VARIANT_STORAGE_KEY = "tasogare.cardVariant.v1";

export function isCardVariant(value: unknown): value is CardVariant {
  return value === "A" || value === "B" || value === "C";
}

export function readCardVariant(): CardVariant {
  try {
    const value = localStorage.getItem(CARD_VARIANT_STORAGE_KEY);
    return isCardVariant(value) ? value : "A";
  } catch {
    return "A";
  }
}

export function writeCardVariant(value: CardVariant): void {
  try {
    localStorage.setItem(CARD_VARIANT_STORAGE_KEY, value);
  } catch {
    // localStorage can be unavailable in private or restricted contexts.
  }
}
