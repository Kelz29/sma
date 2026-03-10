import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const LAST_ACTIVITY_KEY = "sma-last-activity";

export function SessionManager() {
  const navigate = useNavigate();
  const { accessToken, clearAuth } = useAuthStore();

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    let timeoutId: number | undefined;

    const markActivity = () => {
      if (!accessToken) return;
      const now = Date.now();
      try {
        window.localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
      } catch {
        // ignore storage issues; session will still be cleared when token expires
      }
    };

    const checkIdle = () => {
      let last = 0;
      try {
        last = Number(window.localStorage.getItem(LAST_ACTIVITY_KEY) || "0");
      } catch {
        last = 0;
      }
      const now = Date.now();
      const diff = now - last;
      if (!last || diff >= IDLE_TIMEOUT_MS) {
        clearAuth();
        navigate("/login");
        return;
      }
      const remaining = IDLE_TIMEOUT_MS - diff;
      timeoutId = window.setTimeout(checkIdle, remaining);
    };

    const resetTimer = () => {
      markActivity();
      if (timeoutId) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(checkIdle, IDLE_TIMEOUT_MS);
    };

    const onActivity = () => {
      resetTimer();
    };

    // Initialise
    resetTimer();
    window.addEventListener("mousemove", onActivity);
    window.addEventListener("keydown", onActivity);
    window.addEventListener("click", onActivity);
    window.addEventListener("focus", onActivity);

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("click", onActivity);
      window.removeEventListener("focus", onActivity);
    };
  }, [accessToken, clearAuth, navigate]);

  return null;
}

