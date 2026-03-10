import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppRoutes } from "./routes";
import { SessionManager } from "@/features/auth/components/SessionManager";

export function App() {
  return (
    <ErrorBoundary>
      <SessionManager />
      <AppRoutes />
    </ErrorBoundary>
  );
}

