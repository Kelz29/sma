import { QueryClient } from "@tanstack/react-query";
import axios from "axios";

/**
 * Avoid hammering the API when the backend returns a client error (4xx) or when
 * many queries mount at once (dashboard). Still allow a single retry for network
 * blips and most 5xx responses.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false;
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status !== undefined && status >= 400 && status < 500) {
      return false;
    }
  }
  return true;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: shouldRetryQuery,
    },
  },
});
