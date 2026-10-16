import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { trackPageView } from "./track";

export function UsageTracker() {
  const { pathname } = useLocation();
  const accessToken = useAuthStore((state) => state.accessToken);
  const lastPath = useRef("");

  useEffect(() => {
    if (!accessToken) return;
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    trackPageView(pathname);
  }, [pathname, accessToken]);

  return null;
}
