/**
 * Map pathname to feature flag key. Used by Sidebar and route guard.
 * Superadmin path (/superadmin) is not gated by a feature.
 * Accounting and Sales use one key per sub-feature.
 */
export const pathToFeatureKey: Record<string, string> = {
  "/dashboard": "dashboard",
  "/invoices": "invoices",
  "/customers": "customers",
  "/statements": "statements",
  "/expenses": "expenses",
  "/reports": "reports",
  "/banking": "banking",
  "/accounts": "accounts",
  "/sales/leads": "leads",
  "/sales/proposals": "proposals",
  "/sales/contracts": "contracts",
  "/sales/pitch-decks": "pitch_decks",
  "/sales/pipeline": "pipeline",
  "/employees": "hr",
  "/settings": "settings",
  "/team": "team",
  "/profile": "profile",
  "/portal": "portal",
};

export function getFeatureKeyForPath(pathname: string): string | null {
  return pathToFeatureKey[pathname] ?? null;
}
