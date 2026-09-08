/**
 * Swiss formatting helpers (de-CH): CHF, apostrophe thousands separator,
 * decimal point, dates as DD.MM.YYYY.
 */

const THOUSANDS = "'";

export function formatNumber(value: number, decimals = 2): string {
  const fixed = Math.abs(value).toFixed(decimals);
  const [intPart, fracPart] = fixed.split(".");
  const grouped = intPart!.replace(/\B(?=(\d{3})+(?!\d))/g, THOUSANDS);
  const sign = value < 0 ? "-" : "";
  return fracPart ? `${sign}${grouped}.${fracPart}` : `${sign}${grouped}`;
}

export function formatCHF(value: number): string {
  return `CHF ${formatNumber(value, 2)}`;
}

export function formatPercent(ratio: number, decimals = 1): string {
  return `${formatNumber(ratio * 100, decimals)} %`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "–";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "–";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "–";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "–";
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${formatDate(d)}, ${hh}:${mi}`;
}

/** ISO weekday (1 = Montag … 7 = Sonntag) */
export const WEEKDAYS: { value: number; short: string; label: string }[] = [
  { value: 1, short: "Mo", label: "Montag" },
  { value: 2, short: "Di", label: "Dienstag" },
  { value: 3, short: "Mi", label: "Mittwoch" },
  { value: 4, short: "Do", label: "Donnerstag" },
  { value: 5, short: "Fr", label: "Freitag" },
  { value: 6, short: "Sa", label: "Samstag" },
  { value: 7, short: "So", label: "Sonntag" },
];

export function formatWeekdays(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  return sorted
    .map((d) => WEEKDAYS.find((w) => w.value === d)?.short ?? String(d))
    .join(", ");
}
