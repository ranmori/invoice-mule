const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export const formatCents = (cents: number) => usd.format(cents / 100);

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** "12.50" -> 1250. Returns null for anything that isn't a non-negative amount. */
export function parseDollarsToCents(text: string): number | null {
  const trimmed = text.trim().replace(/^\$/, "");
  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) return null;
  return Math.round(Number(trimmed) * 100);
}

export const isoDateInDays = (days: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
