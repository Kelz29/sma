import { api } from "@/lib/axios";
import { useAuthStore } from "@/store/authStore";

function currentPath(): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname.split("?")[0] || "/";
}

function send(body: { kind: string; path: string; action?: string; message?: string; stack?: string }) {
  const { accessToken } = useAuthStore.getState();
  if (!accessToken) return;
  void api.post("/telemetry/events", body).catch(() => undefined);
}

export function trackPageView(pathname: string) {
  const path = pathname.split("?")[0].split("#")[0] || "/";
  send({ kind: "page_view", path });
}

export function trackClientError(message: string, stack?: string) {
  send({
    kind: "client_error",
    path: currentPath(),
    message: message.slice(0, 500),
    stack: stack?.slice(0, 2000),
  });
}

export function trackAction(action: string, path: string) {
  send({ kind: "action", action, path: path.split("?")[0] || "/" });
}
