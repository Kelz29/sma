import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { getFeatureKeyForPath } from "./constants";
import { useFeatureFlags } from "./useFeatureFlags";

/**
 * Redirects to a safe default when the current route's feature is disabled.
 * /superadmin is never gated. While flags are loading we render the outlet.
 */
export function RequireFeature() {
  const { pathname } = useLocation();
  const user = useAuthStore((s) => s.user);
  const { isEnabled, isLoading } = useFeatureFlags();

  if (pathname === "/superadmin") {
    return <Outlet />;
  }

  const featureKey = getFeatureKeyForPath(pathname);
  if (!featureKey) return <Outlet />;

  if (isLoading) return <Outlet />;
  if (isEnabled(featureKey)) return <Outlet />;

  const defaultPath =
    user?.role === "employee" ? "/portal" : user?.role === "superadmin" ? "/superadmin" : "/dashboard";
  return <Navigate to={defaultPath} replace />;
}
