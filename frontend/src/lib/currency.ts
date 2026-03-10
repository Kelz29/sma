export type CountryCode = "ZA" | "LS";

const COUNTRY: CountryCode =
  (import.meta.env.VITE_COUNTRY_CODE as CountryCode | undefined) ?? "ZA";

export const BASE_CURRENCY_CODE = COUNTRY === "LS" ? "LSL" : "ZAR";
export const CURRENCY_SYMBOL = COUNTRY === "LS" ? "M" : "R";

export interface FormatAmountOptions {
  /** Number of decimal places (default 2). */
  decimals?: number;
  /** If true, prefix with symbol (e.g. "R 1 234.00") instead of code suffix. */
  useSymbol?: boolean;
}

/**
 * Format a numeric amount with the project's currency (ZAR/LSL) or a given code.
 * Use this instead of hardcoding "$" or any currency symbol across the app.
 */
export function formatAmount(
  amount: number,
  currencyCode: string = BASE_CURRENCY_CODE,
  options: FormatAmountOptions = {}
): string {
  const { decimals = 2, useSymbol = false } = options;
  const formatted = Number(amount).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  if (useSymbol && (currencyCode === "ZAR" || currencyCode === "LSL")) {
    const symbol = currencyCode === "LSL" ? "M" : "R";
    return `${symbol} ${formatted}`;
  }
  return `${formatted} ${currencyCode}`;
}

