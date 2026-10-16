import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppRoutes } from "./routes";
import { SessionManager } from "@/features/auth/components/SessionManager";
import { UsageTracker } from "@/features/telemetry/UsageTracker";

export function App() {
  return (
    <ErrorBoundary>
      <SessionManager />
      <UsageTracker />
      <AppRoutes />
    </ErrorBoundary>
  );
}

